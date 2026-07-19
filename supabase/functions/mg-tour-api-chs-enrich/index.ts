import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Loads OFFICIAL Chinese-Simplified (중문간체) TourAPI data (ChsService2) onto
// EXISTING mg_places rows that have already been safely matched by a separate,
// offline process. This function never creates a new mg_places row, never
// guesses a match, and never calls an LLM — it only reads the already-decided
// 56 safe mappings (embedded below as a code constant, per requirement — no
// runtime file reads of the project-root scratch JSON files) and writes
// locale='zh-CN' rows sourced directly from the public API.
//
// Modeled directly on the two existing TourAPI ingestion functions in this
// repo:
//   - supabase/functions/mg-tour-seed/index.ts       (KorService2, fresh insert)
//   - supabase/functions/mg-tour-en-enrich/index.ts  (EngService2, enrich an
//     existing matched place — the closer analog to this function)
// CORS, admin-token auth, the Supabase client construction, the TourAPI fetch
// wrapper shape, and the mg_api_fetch_logs logging convention are copied
// verbatim from those two files. Two deliberate differences from
// mg-tour-en-enrich, both explained where they occur below:
//   1. mg_place_texts uses INSERT + pre-existence-check (never upsert) instead
//      of upsert(onConflict:"place_id,locale") — this function must never
//      silently overwrite an existing zh-CN row, regardless of its
//      translation_status (source OR machine), since doing so without an
//      explicit instruction to "upgrade" machine-translated rows would be the
//      exact kind of silent-overwrite risk this whole project has repeatedly
//      guarded against elsewhere (see supabase/functions/mg-place-translate-zh).
//   2. This function's own request body has no numOfRows/pageNo pagination —
//      it always processes the fixed, embedded SAFE_MAPPINGS list in full
//      (bounded at 56 items), since (unlike the other two functions) it is not
//      paging through a live TourAPI list.

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOUR_CHS_API_BASE_URL = "https://apis.data.go.kr/B551011/ChsService2";
const CHS_RESTAURANT_CONTENT_TYPE_ID = "82";
const SOURCE_NAME = "TOUR_API_CHS";
const SOURCE_LANGUAGE = "zh-CN";

// How many rows to request from ONE areaBasedList2 call so raw_list can be
// looked up by contentid for every SAFE_MAPPINGS entry without paginating —
// the reference dump (tour-api-chs-seoul-restaurants.json, not read at
// runtime) showed 78 total Seoul CHS restaurant listings, so 100 leaves
// headroom. If the live catalog ever grows past this, raw_list simply comes
// back null for the missing entries (see buildTagsAndRawList()'s caller) —
// that is a documented, non-fatal limitation, not a silent bug: raw_common
// (the full detailCommon2 response) is still stored either way.
const CHS_LIST_FETCH_ROWS = 100;

// The 21 entries in tour-api-chs-review-mappings.json are NEVER read or
// processed here — this constant exists purely so the response can report how
// many are still pending manual review, per the safety requirement that this
// function must never auto-match or auto-save them.
const REVIEW_MAPPING_COUNT = 21;

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) return JSON.stringify(error);
    return String(error);
}

function hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

// Same 14-digit TourAPI datetime format (createdtime/modifiedtime) parsed
// identically to mg-tour-seed/index.ts and mg-tour-en-enrich/index.ts.
function parseTourDateTime(value: unknown): string | null {
    if (!value) return null;
    const text = String(value).trim();
    if (text.length !== 14) return null;
    const year = text.slice(0, 4);
    const month = text.slice(4, 6);
    const day = text.slice(6, 8);
    const hour = text.slice(8, 10);
    const minute = text.slice(10, 12);
    const second = text.slice(12, 14);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

// Identical shape to the existing TourAPI functions' getItems(): the "item"
// field is sometimes a single object, sometimes an array, sometimes absent.
function getItems(data: any): any[] {
    const item = data?.response?.body?.items?.item;
    if (!item) return [];
    if (Array.isArray(item)) return item;
    return [item];
}

// ── Text normalization (minimal, per the requested "화면용 값만 최소 정규화") ──
//
// The official API's own field values are trusted as-is beyond this — no menu
// splitting, no fixed-dictionary substitution, no LLM post-processing. That
// machinery belongs to mg-place-translate-zh (LLM output); this function only
// ever writes translation_status='source' data taken directly from the public
// API.

// <br> variants -> " / " (per this function's explicit spec — note this is
// NOT the same replacement mg-tour-en-enrich's cleanText() uses ("\n"); this
// function follows its own, separately-specified normalization), then
// collapse whitespace.
function cleanShortField(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value)
        .replaceAll("<br />", " / ")
        .replaceAll("<br/>", " / ")
        .replaceAll("<br>", " / ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > 0 ? text : null;
}

// description/overview: same <br> handling, PLUS strips any other remaining
// HTML tag (the official API occasionally embeds other markup in overview) —
// the actual text content is preserved verbatim, only markup is removed.
function stripHtmlForDescription(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value)
        .replaceAll("<br />", " / ")
        .replaceAll("<br/>", " / ")
        .replaceAll("<br>", " / ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > 0 ? text : null;
}

// addr2 floor references ("5층") -> "5楼", per spec. Applied after the shared
// <br>/whitespace cleanup above.
function normalizeAddr2(value: unknown): string | null {
    const cleaned = cleanShortField(value);
    if (!cleaned) return null;
    return cleaned.replace(/(\d)\s*층/g, "$1楼");
}

function buildAddress(commonItem: any): string | null {
    const addr1 = cleanShortField(commonItem?.addr1);
    const addr2 = normalizeAddr2(commonItem?.addr2);
    const parts = [addr1, addr2].filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(" ") : null;
}

// parkingfood/packing: the CHS service is expected to already return these in
// Chinese, but defensively normalizes a leftover Korean "가능"/"불가능" value
// (checked in this order — "불가능" first, since it contains "가능" as a
// substring) to "可"/"不可". Any other value (already-Chinese, or something
// else entirely) is trusted and passed through unchanged — never guessed at.
function normalizeAvailability(value: unknown): string | null {
    const cleaned = cleanShortField(value);
    if (!cleaned) return null;
    if (cleaned.includes("불가능")) return "不可";
    if (cleaned.includes("가능")) return "可";
    return cleaned;
}

// Hangul syllable block only — sufficient for this file's one narrow use
// (deciding whether a paren group's content is a genuine Chinese/Latin display
// name or accidentally the Korean part of the title). Deliberately NOT the
// broader jamo-inclusive regex used elsewhere in this project's zh-CN
// functions; this file is self-contained and this check doesn't need that
// generality.
const HANGUL_RE = /[가-힣]/;

function containsHangul(text: string): boolean {
    return HANGUL_RE.test(text);
}

function looksLikeUsableDisplayName(text: string): boolean {
    return /[一-鿿]/.test(text) || /[A-Za-z]/.test(text);
}

const FULLWIDTH_PAREN_RE = /（([^（）]+)）/;
const HALFWIDTH_PAREN_RE = /\(([^()]+)\)/;

// Extracts the official Chinese display name from detailCommon2's `title`.
// The real API's bilingual title shape (confirmed against a live sample) is
// "한국어 원문（중문 표시명）" — this returns ONLY the content of the
// full-width parentheses (never the parentheses themselves, never the Korean
// prefix). Falls back to half-width parentheses if no full-width group is
// found, and finally accepts the whole title only if it contains no Hangul at
// all (meaning it's already a pure Chinese/Latin name with no bilingual
// wrapper). Returns null — never a guessed/invented name — when none of these
// produce a usable result, so the caller can fail that row instead of
// fabricating a Chinese name (see the "안전 정책" requirement).
function extractChsDisplayName(title: unknown): string | null {
    if (!hasValue(title)) return null;

    const trimmedTitle = String(title)
        .replace(/\s+/g, " ")
        .trim();

    // 우선 괄호와 괄호 안의 한국어 원문을 제거한 바깥쪽 이름을 사용한다.
    // 예:
    // Buvette 总店（부베트 본점） -> Buvette 总店
    // 105405麻谷(105405 마곡) -> 105405麻谷
    const outside = trimmedTitle
        // 반각/전각 괄호가 서로 섞여 있어도 제거
        .replace(/[\(（][^()（）]*[\)）]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (
        outside &&
        !containsHangul(outside) &&
        looksLikeUsableDisplayName(outside)
    ) {
        return outside;
    }

    // 바깥쪽을 쓸 수 없을 때만 괄호 안 후보를 검사한다.
    const parenthesizedCandidates: string[] = [];

    for (const match of trimmedTitle.matchAll(/（([^（）]+)）/g)) {
        parenthesizedCandidates.push(match[1].trim());
    }

    for (const match of trimmedTitle.matchAll(/\(([^()]+)\)/g)) {
        parenthesizedCandidates.push(match[1].trim());
    }

    for (const candidate of parenthesizedCandidates) {
        if (
            candidate &&
            !containsHangul(candidate) &&
            looksLikeUsableDisplayName(candidate)
        ) {
            return candidate;
        }
    }

    // 애초에 한글이 없는 순수 중문/영문 제목이면 전체 사용
    if (
        !containsHangul(trimmedTitle) &&
        looksLikeUsableDisplayName(trimmedTitle)
    ) {
        return trimmedTitle;
    }

    return null;
}

function buildTags(commonItem: any, introItem: any, parking: string | null, packing: string | null): string[] {
    const tags = ["餐厅"];
    if (hasValue(commonItem?.firstimage)) tags.push("有照片");
    if (hasValue(commonItem?.mapx) && hasValue(commonItem?.mapy)) tags.push("有位置信息");
    if (hasValue(introItem?.firstmenu) || hasValue(introItem?.treatmenu)) tags.push("有菜单信息");
    if (parking === "可") tags.push("可停车");
    if (packing === "可") tags.push("可打包");
    return tags;
}

// ── SAFE_MAPPINGS: the 56 already-confirmed matches (embedded, not read from
// tour-api-chs-safe-mappings.json at runtime, per requirement) ─────────────
//
// The already-manually-saved 57th match (chs_contentid 3576599 / place_id
// 460) is intentionally NOT included here — it was never present in the
// source safe-mappings file to begin with (confirmed: 0 occurrences of either
// value in that file), so no separate exclusion filter is needed to keep it
// out of this list. The runtime duplicate-mapping checks below (both the
// static self-check over this array and the DB existence checks in
// processMapping()) still defensively guard against it — or any other
// already-linked place/contentid — being processed a second time if this
// constant is ever hand-edited later.
interface ChsSafeMapping {
    chsContentId: string;
    placeId: number;
    chsTitle: string;
    koName: string;
}

const SAFE_MAPPINGS: ChsSafeMapping[] = [
    { chsContentId: "3480903", placeId: 1611, chsTitle: "105405麻谷(105405 마곡)", koName: "105405 마곡" },
    { chsContentId: "3528347", placeId: 575, chsTitle: "Bokidang(복이당)", koName: "복이당" },
    { chsContentId: "3576607", placeId: 593, chsTitle: "Buvette 总店（부베트 본점）", koName: "부베트 본점" },
    { chsContentId: "3576292", placeId: 1361, chsTitle: "Carols总店(캐롤스 본점)", koName: "캐롤스 본점" },
    { chsContentId: "4071361", placeId: 75, chsTitle: "GOUM(고움)", koName: "고움" },
    { chsContentId: "4009804", placeId: 1117, chsTitle: "Insa Dodam仁寺唠谈（인사도담）", koName: "인사도담" },
    { chsContentId: "3061974", placeId: 439, chsTitle: "Maison Hannam（메종 한남）", koName: "메종 한남" },
    { chsContentId: "3576248", placeId: 459, chsTitle: "Modern Nulang Central City店(모던눌랑 센트럴시티점)", koName: "모던눌랑 센트럴시티점" },
    { chsContentId: "3359534", placeId: 1446, chsTitle: "PERBACCO（페르바코）", koName: "페르바코" },
    { chsContentId: "3576278", placeId: 1414, chsTitle: "Texas de Brazil 中心城市店(텍사스 데 브라질 센트럴시티점)", koName: "텍사스 데 브라질 센트럴시티점" },
    { chsContentId: "3556871", placeId: 1029, chsTitle: "WUMOK(우모크)", koName: "우모크" },
    { chsContentId: "3390720", placeId: 1625, chsTitle: "mmn(미미네)", koName: "mmn(미미네)" },
    { chsContentId: "3576613", placeId: 419, chsTitle: "万里之花 总店(만리지화 본점)", koName: "만리지화 본점" },
    { chsContentId: "4010804", placeId: 663, chsTitle: "三峰Dodam(삼봉도담)", koName: "삼봉도담" },
    { chsContentId: "4010823", placeId: 1046, chsTitle: "云从街(운종가)", koName: "운종가" },
    { chsContentId: "4009790", placeId: 1120, chsTitle: "仁寺洞蒜蓉菜包肉（인사동마늘보쌈）", koName: "인사동마늘보쌈" },
    { chsContentId: "3471455", placeId: 1437, chsTitle: "八角道总店(팔각도 본점)", koName: "팔각도 본점" },
    { chsContentId: "1947611", placeId: 792, chsTitle: "史密斯喜爱的韩屋（스미스가 좋아하는 한옥）", koName: "스미스가 좋아하는 한옥" },
    { chsContentId: "1870732", placeId: 1607, chsTitle: "喜来登(희래등)", koName: "희래등" },
    { chsContentId: "3576922", placeId: 819, chsTitle: "四川屋 总店(시추안하우스 본점)", koName: "시추안하우스 본점" },
    { chsContentId: "1789167", placeId: 1420, chsTitle: "土俗村参鸡汤（토속촌삼계탕）", koName: "토속촌삼계탕" },
    { chsContentId: "3489056", placeId: 726, chsTitle: "圣水NORU(성수노루)", koName: "성수노루" },
    { chsContentId: "2944697", placeId: 728, chsTitle: "圣水洞大林仓库画廊(성수동 대림창고 갤러리)", koName: "성수동 대림창고 갤러리" },
    { chsContentId: "3400927", placeId: 810, chsTitle: "天空披萨(스카이피자)", koName: "스카이피자" },
    { chsContentId: "1358533", placeId: 651, chsTitle: "寺院料理专门店钵盂供养(사찰음식 전문점 발우공양)", koName: "사찰음식 전문점 발우공양" },
    { chsContentId: "1714387", placeId: 780, chsTitle: "寿砚山房（수연산방）", koName: "수연산방" },
    { chsContentId: "3510119", placeId: 762, chsTitle: "手精菜包肉餐厅（손정보쌈）", koName: "손정보쌈" },
    { chsContentId: "3353149", placeId: 832, chsTitle: "新义州糯米血肠(신의주찹쌀순대)", koName: "신의주찹쌀순대" },
    { chsContentId: "3511918", placeId: 450, chsTitle: "明洞小章鱼(명동쭈꾸미)", koName: "명동쭈꾸미" },
    { chsContentId: "3391239", placeId: 1206, chsTitle: "朝鲜火炉烤肉(조선화로구이)", koName: "조선화로구이" },
    { chsContentId: "3395922", placeId: 907, chsTitle: "本色音乐弘大店(언플러그드)", koName: "언플러그드" },
    { chsContentId: "3409458", placeId: 1001, chsTitle: "满月(옹근달)", koName: "옹근달" },
    { chsContentId: "3556860", placeId: 61, chsTitle: "烤肉店烈(고깃집열)", koName: "고깃집열" },
    { chsContentId: "4081497", placeId: 1254, chsTitle: "真清油店（진청유점）", koName: "진청유점" },
    { chsContentId: "1375780", placeId: 1147, chsTitle: "紫霞手工饺子（자하손만두）", koName: "자하손만두" },
    { chsContentId: "1649992", placeId: 509, chsTitle: "美进(미진）", koName: "미진" },
    { chsContentId: "3102449", placeId: 1429, chsTitle: "茶疗 (티테라피)", koName: "티테라피" },
    { chsContentId: "3556886", placeId: 285, chsTitle: "道正肉馆(도정육관)", koName: "도정육관" },
    { chsContentId: "3104227", placeId: 123, chsTitle: "金猪餐厅（금돼지식당）", koName: "금돼지식당" },
    { chsContentId: "4010855", placeId: 1211, chsTitle: "钟路班常会（종로반상회）", koName: "종로반상회" },
    { chsContentId: "4010688", placeId: 1162, chsTitle: "长寿天牛仁寺洞店(장수하늘소 인사점)", koName: "장수하늘소 인사점" },
    { chsContentId: "3361089", placeId: 746, chsTitle: "闻名的圣水脊骨土豆汤别馆 (소문난성수감자탕 별관)", koName: "소문난성수감자탕 별관" },
    { chsContentId: "1362546", placeId: 1247, chsTitle: "陈玉华奶奶元祖一只鸡（진옥화할매원조닭한마리）", koName: "진옥화할매원조닭한마리" },
    { chsContentId: "398556", placeId: 394, chsTitle: "马福林奶奶炒年糕店（마복림할머니집）", koName: "마복림할머니집" },
    { chsContentId: "3021900", placeId: 1593, chsTitle: "黄金豆田(황금콩밭)", koName: "황금콩밭" },
    { chsContentId: "3400523", placeId: 919, chsTitle: "AB咖啡店 At Bali(에이비카페 At Bali)", koName: "에이비카페" },
    { chsContentId: "3393052", placeId: 1501, chsTitle: "HAHA&金钟国的401精肉餐厅(하하&김종국의 401정육식당)", koName: "하하&김종국의 401정육식당" },
    { chsContentId: "3398863", placeId: 1609, chsTitle: "HILLS & EUROPA(힐즈앤유로파)", koName: "힐즈앤유로파" },
    { chsContentId: "3103197", placeId: 355, chsTitle: "LONDON BAGEL MUSEUM安国店（런던베이글뮤지엄 안국점）", koName: "런던베이글뮤지엄 안국" },
    { chsContentId: "3392037", placeId: 401, chsTitle: "Mouse Rabbit(마우스래빗)", koName: "마우스래빗" },
    { chsContentId: "1304605", placeId: 182, chsTitle: "NOBIZIB ( 너비집 )", koName: "너비집" },
    { chsContentId: "3352518", placeId: 1434, chsTitle: "PASSI 0914(파시0914)　", koName: "파시0914" },
    { chsContentId: "3392023", placeId: 1355, chsTitle: "Pleno咖啡厅(카페쁠레노)", koName: "카페쁠레노" },
    { chsContentId: "3393127", placeId: 1413, chsTitle: "TEISTY汉堡(테이스티버거)", koName: "테이스티버거" },
    { chsContentId: "3340495", placeId: 1069, chsTitle: "Yoojung餐厅(유정식당)", koName: "유정식당" },
    { chsContentId: "3406881", placeId: 1484, chsTitle: "彼得潘1978(피터팬1978)", koName: "피터팬1978" },
];

// Defensive self-check over SAFE_MAPPINGS itself: neither a chs_contentid nor
// a place_id may appear twice in this embedded list — this is what "한 중문
// contentid가 여러 place_id에 연결되지 않게 검사" / "한 place_id에 여러
// 중문 contentid가 연결되지 않게 검사" mean at the level of OUR OWN input
// data (the DB-level equivalent checks happen per-row in processMapping()).
// Confirmed clean (0 duplicates) when this list was built; kept as a runtime
// guard in case the constant is hand-edited later.
function findDuplicateMappingIssue(mappings: ChsSafeMapping[]): string | null {
    const seenContentIds = new Set<string>();
    const seenPlaceIds = new Set<number>();
    for (const mapping of mappings) {
        if (seenContentIds.has(mapping.chsContentId)) {
            return `SAFE_MAPPINGS 내부에 동일한 chs_contentid(${mapping.chsContentId})가 두 번 이상 있습니다.`;
        }
        seenContentIds.add(mapping.chsContentId);
        if (seenPlaceIds.has(mapping.placeId)) {
            return `SAFE_MAPPINGS 내부에 동일한 place_id(${mapping.placeId})가 두 번 이상 있습니다.`;
        }
        seenPlaceIds.add(mapping.placeId);
    }
    return null;
}

// ── TourAPI (ChsService2) fetch helpers ──────────────────────────────────────
//
// Shape copied verbatim from fetchTourApi()/fetchEngApi() in the existing KO/EN
// functions — same MobileOS/_type, same resultCode check — only the base URL
// and service-key env var differ (TOUR_CHS_API_SERVICE_KEY, following the
// established TOUR_{LANG}_API_SERVICE_KEY naming convention documented in
// ai-docs/SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE.md; this Chinese-Simplified key
// does not exist yet and must be added to Supabase Function Secrets before
// this function can be deployed/run for real). MobileApp is set to "Matgil"
// (capitalized) as explicitly specified for this function, rather than the
// lowercase "matgil" the two older functions happen to use — TourAPI does not
// validate this value against anything, so both are accepted by the API.
async function fetchChsApi(endpoint: string, params: Record<string, string | number>) {
    const serviceKey = (Deno.env.get("TOUR_CHS_API_SERVICE_KEY") ?? "").trim();

    if (!serviceKey) {
        throw new Error("TOUR_CHS_API_SERVICE_KEY가 설정되지 않았습니다.");
    }

    const url = new URL(`${TOUR_CHS_API_BASE_URL}/${endpoint}`);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("MobileOS", "ETC");
    url.searchParams.set("MobileApp", "Matgil");
    url.searchParams.set("_type", "json");

    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    const res = await fetch(url);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ChsService2 HTTP 오류: ${res.status} ${text}`);
    }

    // Read as text first (rather than res.json() directly) so a non-JSON or
    // unexpected-shape response can be surfaced with its actual raw body
    // instead of the unhelpful "undefined undefined" that resulted from
    // reading resultCode/resultMsg off of a value that was never the expected
    // shape to begin with (e.g. an XML error page, an HTML error page, or a
    // JSON body missing `response.header` entirely).
    const raw = await res.text();

    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Raw response: ${raw}`);
    }

    const header = data?.response?.header;

    if (!header) {
        throw new Error(`Unexpected response: ${raw}`);
    }

    if (header?.resultCode !== "0000") {
        throw new Error(`ChsService2 응답 오류: ${header?.resultCode} ${header?.resultMsg}`);
    }

    return data;
}

// One-time list fetch used ONLY to populate mg_place_sources.raw_list by
// looking up each SAFE_MAPPINGS entry's contentid in the result — NOT used for
// matching (matching was already done offline) and NOT paginated by the
// request body (see CHS_LIST_FETCH_ROWS's doc comment).
async function fetchChsAreaBasedList(): Promise<any[]> {
    const data = await fetchChsApi("areaBasedList2", {
        numOfRows: CHS_LIST_FETCH_ROWS,
        pageNo: 1,
        contentTypeId: CHS_RESTAURANT_CONTENT_TYPE_ID,
        lDongRegnCd: 11,
    });
    return getItems(data);
}

// contentTypeId is deliberately NOT sent — per the v4.4 detailCommon2 spec
// this function targets, contentId alone is sufficient and contentTypeId is
// no longer accepted/needed. `addrinfoYN` is also deliberately NOT sent —
// ChsService2 v4.4 rejects it with INVALID_REQUEST_PARAMETER_ERROR(addrinfoYN),
// so address fields (addr1/addr2) come back as part of defaultYN instead. The
// remaining *YN flags are the standard detailCommon2 parameters (also used by
// KorService2/EngService2's same endpoint in the wider TourAPI family) needed
// so overview/image fields are actually populated in the response rather than
// defaulting to omitted.
async function fetchChsDetailCommon(contentId: string) {
    const data = await fetchChsApi("detailCommon2", {
        contentId,
    });

    const items = getItems(data);
    return { raw: data, item: items[0] ?? null };
}


async function fetchChsDetailIntro(contentId: string) {
    const data = await fetchChsApi("detailIntro2", {
        contentId,
        contentTypeId: CHS_RESTAURANT_CONTENT_TYPE_ID,
        numOfRows: 1,
        pageNo: 1,
    });
    const items = getItems(data);
    return { raw: data, item: items[0] ?? null };
}

// ── DB existence checks (dedup / conflict detection) ────────────────────────
//
// All three are read-only SELECTs — safe to run during dryRun as well as a
// real save, so a dryRun preview accurately reflects inserted/updated/skipped
// outcomes rather than just "would call the API".

async function findChsSourceByContentId(supabase: any, contentId: string) {
    const { data, error } = await supabase
        .from("mg_place_sources")
        .select("id, place_id")
        .eq("source", SOURCE_NAME)
        .eq("source_language", SOURCE_LANGUAGE)
        .eq("external_id", contentId)
        .eq("external_content_type_id", CHS_RESTAURANT_CONTENT_TYPE_ID)
        .maybeSingle();
    if (error) throw error;
    return data as { id: number; place_id: number } | null;
}

async function findChsSourceByPlaceId(supabase: any, placeId: number) {
    const { data, error } = await supabase
        .from("mg_place_sources")
        .select("id, external_id")
        .eq("source", SOURCE_NAME)
        .eq("source_language", SOURCE_LANGUAGE)
        .eq("place_id", placeId)
        .eq("external_content_type_id", CHS_RESTAURANT_CONTENT_TYPE_ID)
        .maybeSingle();
    if (error) throw error;
    return data as { id: number; external_id: string } | null;
}

async function findExistingZhText(supabase: any, placeId: number) {
    const { data, error } = await supabase
        .from("mg_place_texts")
        .select("id, translation_status")
        .eq("place_id", placeId)
        .eq("locale", SOURCE_LANGUAGE)
        .maybeSingle();
    if (error) throw error;
    return data as { id: number; translation_status: string } | null;
}

// `status` is the single, simplified per-row outcome shown in the response's
// `results[]` (matching the requested result shape exactly). `sourceOutcome`/
// `textOutcome` are the finer-grained, per-TABLE outcomes used only to
// aggregate the response's insertedSourceCount/insertedTextCount/updatedCount/
// skippedExistingCount — since mg_place_sources and mg_place_texts can land in
// different states for the same row (e.g. a rerun refreshes the source row
// while the text row is left untouched because it already existed), one
// unified per-row status can't represent both counts accurately on its own.
interface MappingResult {
    chsContentId: string;
    placeId: number;
    koName: string;
    zhName: string | null;
    status: "inserted" | "skippedExisting" | "preview" | "failed";
    error: string | null;
    sourceOutcome: "inserted" | "updated" | null;
    textOutcome: "inserted" | "skipped" | null;
}

function baseResult(mapping: ChsSafeMapping): MappingResult {
    return {
        chsContentId: mapping.chsContentId,
        placeId: mapping.placeId,
        koName: mapping.koName,
        zhName: null,
        status: "failed",
        error: null,
        sourceOutcome: null,
        textOutcome: null,
    };
}

// Processes exactly one SAFE_MAPPINGS entry end-to-end. Never throws — every
// failure mode (API call, missing Chinese name, DB conflict, insert error)
// is caught and turned into a "failed" result so one bad row never stops the
// other 55 from being processed.
async function processMapping(
    supabase: any,
    mapping: ChsSafeMapping,
    rawListByContentId: Map<string, any>,
    dryRun: boolean,
): Promise<MappingResult> {
    const result = baseResult(mapping);

    try {
        // ── Cross-duplication safety (DB-level; see also the static
        // findDuplicateMappingIssue() check over SAFE_MAPPINGS itself) ──────
        const existingByContentId = await findChsSourceByContentId(supabase, mapping.chsContentId);
        if (existingByContentId && existingByContentId.place_id !== mapping.placeId) {
            result.error = `chs_contentid ${mapping.chsContentId}는 이미 place_id ${existingByContentId.place_id}에 연결되어 있어 place_id ${mapping.placeId}에는 연결할 수 없습니다.`;
            return result;
        }

        const existingByPlaceId = await findChsSourceByPlaceId(supabase, mapping.placeId);
        if (existingByPlaceId && existingByPlaceId.external_id !== mapping.chsContentId) {
            result.error = `place_id ${mapping.placeId}는 이미 chs_contentid ${existingByPlaceId.external_id}에 연결되어 있어 chs_contentid ${mapping.chsContentId}에는 연결할 수 없습니다.`;
            return result;
        }

        const existingText = await findExistingZhText(supabase, mapping.placeId);

        // ── Official API calls ─────────────────────────────────────────────
        const { raw: commonRaw, item: commonItem } = await fetchChsDetailCommon(mapping.chsContentId);
        if (!commonItem) {
            result.error = "detailCommon2 응답에서 항목을 찾을 수 없습니다.";
            return result;
        }

        const { raw: introRaw, item: introItem } = await fetchChsDetailIntro(mapping.chsContentId);

        const zhName = extractChsDisplayName(commonItem.title);
        if (!zhName) {
            result.error = `공식 중문 표시명을 title("${commonItem.title ?? ""}")에서 추출할 수 없습니다.`;
            return result;
        }
        result.zhName = zhName;

        const address = buildAddress(commonItem);
        const description = stripHtmlForDescription(commonItem.overview);
        const firstMenu = cleanShortField(introItem?.firstmenu);
        const treatMenu = cleanShortField(introItem?.treatmenu);
        const openTime = cleanShortField(introItem?.opentimefood);
        const restDate = cleanShortField(introItem?.restdatefood);
        const parking = normalizeAvailability(introItem?.parkingfood);
        const packing = normalizeAvailability(introItem?.packing);
        const tags = buildTags(commonItem, introItem, parking, packing);

        const rawListItem = rawListByContentId.get(mapping.chsContentId) ?? null;
        const sourceModifiedAt = parseTourDateTime(commonItem.modifiedtime ?? rawListItem?.modifiedtime ?? null);

        // The per-table outcome is decided the same way whether this is a
        // dryRun preview or a real save — only whether we actually WRITE
        // differs (see below). This is what lets dryRun accurately preview
        // inserted/updated/skippedExisting instead of a generic "would call
        // the API".
        result.textOutcome = existingText ? "skipped" : "inserted";
        result.sourceOutcome = existingByContentId ? "updated" : "inserted";
        result.status = result.textOutcome === "skipped" ? "skippedExisting" : "inserted";

        if (dryRun) {
            result.status = "preview";
            return result;
        }

        // ── mg_place_texts: INSERT only, never upsert (see file-level doc
        // comment for why) — an existing zh-CN row, of ANY translation_status,
        // is left completely untouched. ──────────────────────────────────────
        if (!existingText) {
            const { error: textError } = await supabase.from("mg_place_texts").insert({
                place_id: mapping.placeId,
                locale: SOURCE_LANGUAGE,
                name: zhName,
                address,
                description,
                first_menu: firstMenu,
                treat_menu: treatMenu,
                open_time: openTime,
                rest_date: restDate,
                parking,
                packing,
                tags,
                translation_status: "source",
                translation_provider: null,
                translated_from_locale: null,
            });

            if (textError) {
                if (textError.code === "23505") {
                    result.textOutcome = "skipped";
                    result.status = "skippedExisting";
                } else {
                    throw textError;
                }
            }
        }

        // ── mg_place_sources: upsert is safe here (unlike mg_place_texts) —
        // this table is ONLY ever written by ingestion functions, so
        // refreshing the same kind of official metadata on a rerun cannot
        // clobber a different kind of data the way overwriting a
        // machine-translated mg_place_texts row could. ─────────────────────
        const { error: sourceError } = await supabase
            .from("mg_place_sources")
            .upsert(
                {
                    place_id: mapping.placeId,
                    source: SOURCE_NAME,
                    source_language: SOURCE_LANGUAGE,
                    external_id: mapping.chsContentId,
                    external_content_type_id: CHS_RESTAURANT_CONTENT_TYPE_ID,
                    license_type: "공공데이터",
                    attribution: "한국관광공사 TourAPI 중문간체",
                    cache_policy: "stored",
                    source_modified_at: sourceModifiedAt,
                    raw_list: rawListItem,
                    raw_common: commonRaw,
                    raw_intro: introRaw,
                    raw_images: null,
                },
                { onConflict: "source,source_language,external_id,external_content_type_id" },
            );

        if (sourceError) throw sourceError;

        return result;
    } catch (error) {
        result.error = getErrorMessage(error);
        result.status = "failed";
        result.sourceOutcome = null;
        result.textOutcome = null;
        return result;
    }
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST 요청만 허용됩니다." }, 405);
    }

    try {
        const adminToken = req.headers.get("x-admin-seed-token");
        const expectedToken = (Deno.env.get("ADMIN_SEED_TOKEN") ?? "").trim();

        if (!expectedToken) {
            return jsonResponse({ error: "ADMIN_SEED_TOKEN이 설정되지 않았습니다." }, 500);
        }

        if (!adminToken || adminToken !== expectedToken) {
            return jsonResponse({ error: "권한이 없습니다." }, 401);
        }

        const duplicateIssue = findDuplicateMappingIssue(SAFE_MAPPINGS);
        if (duplicateIssue) {
            return jsonResponse({ error: duplicateIssue }, 500);
        }

        const body = await req.json().catch(() => ({}));

        const dryRun: boolean = body.dryRun !== false;

        const rawStartIndex = Number(body.startIndex ?? 0);
        const rawLimit = Number(body.limit ?? 5);

        if (
            !Number.isInteger(rawStartIndex) ||
            rawStartIndex < 0 ||
            !Number.isInteger(rawLimit) ||
            rawLimit < 1
        ) {
            return jsonResponse(
                {
                    error: "startIndex는 0 이상의 정수, limit은 1 이상의 정수여야 합니다.",
                },
                400,
            );
        }

        const startIndex = rawStartIndex;
        const limit = Math.min(rawLimit, 10);

        const selectedMappings = SAFE_MAPPINGS.slice(
            startIndex,
            startIndex + limit,
        );

        const nextStartIndex = startIndex + selectedMappings.length;
        const hasMore = nextStartIndex < SAFE_MAPPINGS.length;

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
        );

        // One-time list fetch for raw_list lookups only (see its doc comment) —
        // a failure here is non-fatal to the whole run: every row just gets a
        // null raw_list instead (raw_common/raw_intro still capture the
        // official data in full).
        let rawListByContentId = new Map<string, any>();
        try {
            const listItems = await fetchChsAreaBasedList();
            rawListByContentId = new Map(listItems.map((item) => [String(item.contentid), item]));
        } catch {
            rawListByContentId = new Map();
        }

        const results: MappingResult[] = [];

        for (const mapping of selectedMappings) {
            const result = await processMapping(
                supabase,
                mapping,
                rawListByContentId,
                dryRun,
            );

            results.push(result);
        }

        // Aggregated from the per-table sourceOutcome/textOutcome fields (see
        // MappingResult's doc comment) rather than the single row-level
        // `status`, so insertedSourceCount/updatedCount reflect mg_place_sources
        // specifically and insertedTextCount/skippedExistingCount reflect
        // mg_place_texts specifically — the two tables can genuinely differ
        // for the same row (e.g. a rerun refreshes source while text is left
        // untouched because it already existed).
        const insertedSourceCount = results.filter((r) => r.sourceOutcome === "inserted").length;
        const updatedCount = results.filter((r) => r.sourceOutcome === "updated").length;
        const insertedTextCount = results.filter((r) => r.textOutcome === "inserted").length;
        const skippedExistingCount = results.filter((r) => r.textOutcome === "skipped").length;
        const failedCount = results.filter((r) => r.status === "failed").length;
        const matchedCount = results.length - failedCount;

        if (!dryRun) {
            await supabase.from("mg_api_fetch_logs").insert({
                source: SOURCE_NAME,
                endpoint: "areaBasedList2 + detailCommon2 + detailIntro2",
                request_params: {
                    mappingCount: selectedMappings.length,
                    contentTypeId: CHS_RESTAURANT_CONTENT_TYPE_ID,
                    lDongRegnCd: 11,
                },
                response_status: 200,
                result_code: "0000",
                result_message: "OK",
                success: failedCount === 0,
                fetched_count: insertedTextCount,
                error_message: failedCount > 0 ? `${failedCount}개 처리 실패` : null,
            });
        }

        // Public result shape is exactly {chsContentId, placeId, koName, zhName,
        // status, error} as specified — sourceOutcome/textOutcome were only
        // ever needed internally to compute the aggregate counts above.
        const publicResults = results.map((r) => ({
            chsContentId: r.chsContentId,
            placeId: r.placeId,
            koName: r.koName,
            zhName: r.zhName,
            status: r.status,
            error: r.error,
        }));

        return jsonResponse({
            message: dryRun
                ? "TourAPI 중문간체 데이터 적재 미리보기 완료"
                : "TourAPI 중문간체 데이터 적재 완료",
            dryRun,
            totalTargetCount: SAFE_MAPPINGS.length,
            startIndex,
            limit,
            requestedCount: selectedMappings.length,
            nextStartIndex,
            hasMore,
            matchedCount,
            insertedSourceCount,
            insertedTextCount,
            updatedCount,
            skippedExistingCount,
            reviewCount: REVIEW_MAPPING_COUNT,
            failedCount,
            results: publicResults,
        });
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
