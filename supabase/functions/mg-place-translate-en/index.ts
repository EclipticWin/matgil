import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POSTGRES_UNIQUE_VIOLATION = "23505";

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

interface KoTextRow {
    place_id: number;
    name: string | null;
    address: string | null;
    description: string | null;
    first_menu: string | null;
    treat_menu: string | null;
    open_time: string | null;
    rest_date: string | null;
    parking: string | null;
    packing: string | null;
    tags: string[] | null;
}

// Final, DB/response-shaped translation — first_menu/treat_menu are the existing
// "/"-joined strings mg_place_texts and the API response already use. The MODEL
// never produces this shape directly for the menu fields (see RawModelOutput
// below) — validateTranslation() assembles it after validating the model's
// menu-item arrays.
interface TranslatedText {
    name: string | null;
    address: string | null;
    description: string | null;
    first_menu: string | null;
    treat_menu: string | null;
    open_time: string | null;
    rest_date: string | null;
    parking: string | null;
    packing: string | null;
    tags: string[] | null;
}

// The JSON shape the MODEL is asked to return. first_menu/treat_menu are split
// into arrays (first_menu_items/treat_menu_items) instead of a single "/"-joined
// string — this is what lets validateTranslation() check the item COUNT exactly
// (array.length) instead of re-parsing a string and guessing which "/" characters
// are real separators (see splitMenuItems() and the menu-count bug this replaced).
interface RawModelOutput {
    name: string | null;
    address: string | null;
    description: string | null;
    first_menu_items: string[] | null;
    treat_menu_items: string[] | null;
    open_time: string | null;
    rest_date: string | null;
    parking: string | null;
    packing: string | null;
    tags: string[] | null;
}

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

// Provider calls return this — `translated` is whatever JSON.parse() produced,
// not yet trusted as RawModelOutput. validateTranslation() is the only place that
// checks its shape and upgrades it to a TranslatedText.
interface RawTranslationResult {
    translated: unknown;
    provider: "openai" | "solar";
    usage: TokenUsage;
}

// Passed to translateWithSolar()/translateWithOpenAI() for a corrective retry —
// carries the previous (rejected) raw output and why it was rejected, so the
// corrective prompt can ask the model to fix only that, not start over.
interface CorrectionContext {
    priorRaw: unknown;
    validationError: string;
}

// One real API call's outcome, kept regardless of whether the row's translation
// ultimately succeeds — see TranslateOutcome.attemptUsages, which is how usage
// from a validation-rejected attempt still reaches the response's token totals.
interface AttemptUsage {
    provider: "openai" | "solar";
    usage: TokenUsage;
}

// What translateText() returns for one row. Never throws for a "this row didn't
// work out" situation (schema failure, validation failure, provider errors) —
// only an outcome object, so the caller can always collect attemptUsages even
// when `ok` is false. An unexpected exception (a bug, a network layer throwing
// something bizarre) can still propagate — the serve() loop's per-row try/catch
// is the backstop for that.
interface TranslateOutcome {
    ok: boolean;
    translated?: TranslatedText;
    provider?: "openai" | "solar";
    error?: string;
    attemptUsages: AttemptUsage[];
}

function extractUsage(data: any): TokenUsage {
    return {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
    };
}

// Splits a "/"-separated menu field into trimmed, non-empty items. A trailing
// "등" always stays attached to the last real item in well-formed Korean source
// text (e.g. "육회 등"), so no special-casing is needed on this (source) side —
// only the model's OUTPUT array needs an exact length match against this.
function splitMenuItems(value: string | null): string[] {
    if (!value) return [];
    return value.split("/").map((s) => s.trim()).filter((s) => s.length > 0);
}

// The Korean source payload sent to the model, shared by the fresh prompt and the
// corrective retry prompt so both always describe the exact same input.
function buildSourceInputPayload(row: KoTextRow) {
    return {
        name: row.name,
        address: row.address,
        description: row.description,
        first_menu_items: row.first_menu === null ? null : splitMenuItems(row.first_menu),
        treat_menu_items: row.treat_menu === null ? null : splitMenuItems(row.treat_menu),
        open_time: row.open_time,
        rest_date: row.rest_date,
        parking: row.parking,
        packing: row.packing,
        tags: row.tags,
    };
}

// A JSON example whose null/non-null pattern always matches THIS row's actual
// source data — e.g. if row.first_menu is non-null, the example shows
// `"first_menu_items": [...]`, never a literal `null`. A static example with
// hardcoded nulls was previously nudging the model toward returning null even for
// fields whose Korean source had a real value (see 우정낙지's first_menu bug).
function buildOutputSchemaExample(row: KoTextRow): string {
    const str = (value: string | null) => (value === null ? "null" : '"..."');
    const arr = (value: string | null) => (value === null ? "null" : '["..."]');
    return `{
  "name": ${str(row.name)},
  "address": ${str(row.address)},
  "description": "...",
  "first_menu_items": ${arr(row.first_menu)},
  "treat_menu_items": ${arr(row.treat_menu)},
  "open_time": ${str(row.open_time)},
  "rest_date": ${str(row.rest_date)},
  "parking": ${str(row.parking)},
  "packing": ${str(row.packing)},
  "tags": ${row.tags === null ? "null" : '["..."]'}
}`;
}

function buildTranslationPrompt(row: KoTextRow): string {
    const input = buildSourceInputPayload(row);

    return `You are a Korean-to-English translator for a restaurant recommendation app for foreign tourists visiting Seoul, Korea.

Translate the following Korean restaurant data fields to English.
Return ONLY valid JSON matching the exact structure below. No markdown, no code fences, no extra text outside the JSON.

[Critical accuracy rules — never violate]
- Never change, omit, or invent any number, day of week, business hour, building number, floor, or menu item from the Korean source.
- Preserve every numeric token exactly.
- A non-null source field must not become null.
- Translate 매주 일요일 only as "Every Sunday" — use the exact day name given in the source, never a different or additional day.
- "등" or "etc." does not create an additional menu item.

[Place name]
- Only render a word in English when a natural romanization or a well-known official English name is certain. Never invent an English word that does not exist.
- The final name should generally follow the format "English Name (한글 원문)".
- Never replace a brand name or proper noun with a semantic (meaning-based) translation — always keep the original Korean in parentheses.
- When you are not confident about a proper noun, romanize it conservatively (plain, readable romanization) rather than guessing at a meaning, but still keep the original Korean in parentheses.
  Examples: 남포면옥 → "Nampomyeonok (남포면옥)", 무교동 북어국집 → "Mugyodong Bugeogukjip (무교동 북어국집)", 가나돈까스의집 → "Gana Donkatsu House (가나돈까스의집)"
- If the Korean name starts with a "[백년가게]" prefix (a government "Centennial Store" recognition badge for businesses open 30+ years), never delete it. Render its meaning in English as "Centennial Store: " immediately before the translated name, and still keep the FULL original Korean text — including the "[백년가게]" prefix itself — in the parentheses.
  Example: [백년가게] 삼거리 먼지막 순대국 → "Centennial Store: Samgeori Meonjimak Sundaeguk ([백년가게] 삼거리 먼지막 순대국)"

[Menu items — first_menu_items, treat_menu_items]
- The source below already splits first_menu/treat_menu into an ARRAY of individual menu items. Translate each array element independently and return an array with the EXACT SAME NUMBER of elements, in the SAME ORDER. Never merge two items into one, split one item into two, drop an item, or add an item that isn't in the source array — the output array length must equal the input array length exactly.
- If the last source item ends with "등" (e.g. "육회 등"), translate that item's meaning and append ", etc." to that SAME array element — never create an extra array element for "등"/"etc.".
- Translate ordinary/generic dish names into natural, meaning-based English.
- For Korean dish names, an internationally recognized spelling plus a short plain-English description is fine.
  Examples: 즉석떡볶이 → "Instant Tteokbokki (즉석떡볶이)", 낙지볶음 → "Stir-fried Octopus (낙지볶음)", 생갈비살 → "Fresh Beef Rib Meat (생갈비살)", 산낙지해신탕 → "Seafood Soup with Live Octopus (산낙지해신탕)", 코다리조림 → "Braised Half-dried Pollock (코다리조림)", 치즈돈가스 → "Cheese Pork Cutlet (치즈돈가스)", 치킨까스 → "Chicken Cutlet (치킨까스)", 난자완스 → "Nanjawanse (난자완스)" (never "egg waffle"), 육개장 → "Yukgaejang, spicy beef soup (육개장)", 회덮밥 → "Hoedeopbap, raw fish rice bowl (회덮밥)".
- When a menu name is built from a foreign loanword written in Hangul, restore the original foreign word instead of romanizing the Korean spelling of it.
  Examples: 할라피뇨 → "Jalapeño", 로제 파스타 → "Rosé Pasta", 리코타 샐러드 → "Ricotta Salad", 트러플 → "Truffle".
- When a specific menu item's meaning is unclear or uncertain (e.g. it may be a coined/house-specific name), do not invent an English word for it — romanize it conservatively instead and always keep the original Korean in parentheses.
  Example: if you are not sure whether "로프치니" is a proper/house-specific term, write "Rofchini Mushroom Cream Risotto (로프치니 버섯크림 리조또)" rather than guessing at a meaning.
- Return null for first_menu_items/treat_menu_items only if the corresponding source array above is null.

[Address]
- Convert to a natural English address order: number, road name, gu (district), Seoul.
  Example: 서울특별시 강남구 언주로 608 → "608 Eonju-ro, Gangnam-gu, Seoul"
- Split the road-name suffix precisely from the road name itself (never a blind trailing-character substitution) — process it as a distinct token:
  대로 → "-daero", 로 → "-ro", 길 → "-gil", 가길 → "-ga-gil" (a numbered "가" sub-section of a numbered "길").
  Keep the boundary between the road name and any numbers exact.
  Examples: 마조로1길 → "Majo-ro 1-gil", 퇴계로76길 → "Toegye-ro 76-gil", 동일로217가길 → "Dongil-ro 217ga-gil", 백제고분로7길 → "Baekjegobun-ro 7-gil".
- For a floor number, prefer the "1F", "2F" style over "1st floor" — and NEVER drop the floor if the source has one.
- Every number in the source (road-internal number, building number, floor number) must appear in your translated address — none may be dropped, merged into another number, or replaced.
  Example: 서울특별시 성동구 마조로1길 2 1층 has three numbers: the "1" inside the road name, building number "2", and floor "1".
  Correct: "1F, 2 Majo-ro 1-gil, Seongdong-gu, Seoul" (all three numbers present: 1, 2, 1)
  Incorrect: "1 Majo-ro 1-gil, Seongdong-gu, Seoul" (the building number "2" was dropped and the floor disappeared — do not do this)
- A dong (neighborhood) name is optional context — only add it in parentheses at the end when it is actually present in the source address, never invent one.
- If you cannot confidently convert part of an address, do not delete information or invent a plausible-looking replacement — keep the conversion conservative (e.g. leave an uncertain segment closer to its original romanized form) rather than fabricating a standard-looking but wrong address.
- Return null if the original field is null.

[Description]
- 1-2 natural English sentences translating only the facts present in the Korean original. The existing mechanical "X is a restaurant located at ..." structure is fine to reuse.
- Do not add any claim of expertise, popularity, history, or quality rating that is not stated in the Korean original.
- If a representative menu is mentioned, use its natural English menu name (matching the menu-item rules above).
- Keep the place name's grammar/particles natural in English; there is no need to repeat the Korean original name inside the description every time.
- This is the ONE field allowed to be generated from name+address alone when the Korean original is null or empty — every other field must stay null when its source is null (see [Critical accuracy rules]).

[Operating info — open_time, rest_date, parking, packing]
- Translate briefly and consistently using the original meaning only — never guess at specific hours or closed days that are not stated, and never add a day of week that is not in the source.
  Examples: ※ 전화문의 요망 → "Please call for details", 연중무휴 → "Open year-round", 매주 수요일 → "Every Wednesday", 명절 당일 → "On major holidays", 설·추석 연휴 → "Lunar New Year and Chuseok holidays", 가능 → "Available", 불가능 → "Not available", 가능(일부 메뉴) → "Available for selected menu items".
- Return null if the original field is null.

[Tags]
- Translate each tag to English. Common mappings: 음식점 → "restaurant", 사진 있음 → "has photo", 위치 있음 → "has location", 메뉴 정보 있음 → "has menu info", 주차 가능 → "parking available", 포장 가능 → "takeout available". Return as array, or null if original is null.

[Output format]
- Return ONLY the exact JSON structure shown below — no markdown, no code fences, no explanatory text outside the JSON.
- Every key listed below must be present in your output, spelled exactly as shown.
- A field is null in your output ONLY when its source value above is null — the example below already reflects, for THIS specific place, which fields are null and which need a real value. Do not use null for a field whose source is non-null, and do not invent tags or menu items that do not exist in the source.

Korean data to translate:
${JSON.stringify(input, null, 2)}

Return exactly this JSON structure for this place (this example's null/non-null pattern already matches the source data above — keep it that way in your answer):
${buildOutputSchemaExample(row)}`;
}

// A follow-up prompt used only after a previous attempt from the SAME provider
// failed validateTranslation() — carries the prior wrong JSON and the exact
// validation failure so the model can target-fix just that, instead of
// re-translating everything from scratch (which risks introducing a NEW mistake
// while "fixing" the old one).
// Best-effort extraction of the `address` field from a prior (untrusted, not yet
// shape-validated) model output, so the corrective prompt can quote back exactly
// what the model previously produced for the address — returns null rather than
// throwing when priorRaw isn't shaped as expected.
function extractPriorAddress(priorRaw: unknown): string | null {
    if (typeof priorRaw !== "object" || priorRaw === null) return null;
    const address = (priorRaw as Record<string, unknown>).address;
    return typeof address === "string" ? address : null;
}

function buildCorrectivePrompt(row: KoTextRow, priorRaw: unknown, validationError: string): string {
    const input = buildSourceInputPayload(row);
    const priorAddress = extractPriorAddress(priorRaw);
    const requiredAddressNumbers = extractNumberTokens(row.address);

    return `You previously translated the following Korean restaurant data, but your JSON output failed a validation check. Fix ONLY the specific problem described below — do not re-translate or rewrite fields that were already correct.

Korean source data:
${JSON.stringify(input, null, 2)}

Your previous (incorrect) JSON output:
${JSON.stringify(priorRaw, null, 2)}

Validation failure reason:
${validationError}

[Address accuracy — apply this whenever the failure above involves the address's numbers]
- Original Korean address (full): ${row.address ?? "(null)"}
- Number tokens required from the original address, in order: ${requiredAddressNumbers.length > 0 ? requiredAddressNumbers.join(", ") : "(none)"}
- Your previous translated address: ${priorAddress ?? "(none)"}
- Every required number token listed above must appear in your corrected address exactly as many times as listed — never omit, change, or add a number.

Rules to apply while fixing this:
- Never change, omit, or invent any number, day of week, business hour, building number, floor, or menu item from the Korean source.
- A non-null source field must not become null.
- first_menu_items/treat_menu_items must have exactly the same number of elements, in the same order, as the corresponding source array above — "등"/"etc." is never its own element.
- Do NOT recreate the entire translation from scratch — keep every field from your previous output that the failure reason above does not mention, and correct only the field(s) it does.

Return ONLY the corrected JSON, with the exact same key structure as before (every key present, correct null/string/array typing matching the source data above). No markdown, no code fences, no extra text outside the JSON.`;
}

// ── Safety net around the raw model output ──────────────────────────────────
//
// Everything below runs on EVERY provider's output before it is trusted enough
// to save (or even show in a dryRun preview) — see validateTranslation(), the
// single entry point called from translateText(). None of this fixes a bad
// translation; it only decides whether to accept it as-is (after restoring any
// field the model shouldn't have touched, and applying normalizeAddressSpacing()'s
// pure formatting fix) or reject it with a clear error so the caller records a
// "failed" result instead of saving something wrong.

// Fields (besides first_menu/treat_menu, which validateMenuItemsField handles
// separately) that stay null when the Korean source is null — `description` is
// the one field the prompt explicitly allows to be generated from name+address
// when the original is null, so it's excluded here.
const NON_DESCRIPTION_KEYS: (keyof TranslatedText)[] = [
    "name", "address", "open_time", "rest_date", "parking", "packing",
];

// Confirms the parsed JSON has the exact shape RawModelOutput requires — every
// key present, every value either null or the expected primitive/array type.
// This is what catches a provider returning a differently-shaped object (missing
// keys, a string where an array was expected, a stray first_menu string instead
// of first_menu_items, etc.) before any of it is trusted.
function isRawModelOutputShape(value: unknown): value is RawModelOutput {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;

    const stringKeys: (keyof RawModelOutput)[] = [
        "name", "address", "description", "open_time", "rest_date", "parking", "packing",
    ];
    for (const key of stringKeys) {
        if (!(key in v)) return false;
        const val = v[key];
        if (val !== null && typeof val !== "string") return false;
    }

    const arrayKeys: (keyof RawModelOutput)[] = ["first_menu_items", "treat_menu_items", "tags"];
    for (const key of arrayKeys) {
        if (!(key in v)) return false;
        const val = v[key];
        if (val !== null && !(Array.isArray(val) && val.every((t) => typeof t === "string"))) return false;
    }

    return true;
}

// The prompt explicitly allows `description` to be generated from name+address
// when the Korean original is null — every other (non-menu) field must stay null
// if the source was null. This forces that back rather than trusting the model
// not to have invented a value out of nothing.
function restoreNullsFromSource(row: KoTextRow, translated: TranslatedText): TranslatedText {
    const restored: TranslatedText = { ...translated };
    for (const key of NON_DESCRIPTION_KEYS) {
        if (row[key] === null) restored[key] = null;
    }
    if (row.tags === null) restored.tags = null;
    return restored;
}

// Validates one menu field's translated ITEM ARRAY against the Korean source and
// assembles the final "/"-joined string mg_place_texts/the API response expect.
// - Source null -> always null in the output, regardless of whatever the model
//   invented (same "silently restore, never fail" policy every other null-source
//   field gets — see restoreNullsFromSource above).
// - Source non-null -> the translated array must exist and have EXACTLY the same
//   length as the source's split items (order is not re-checked here beyond
//   length, since the prompt instructs the model to preserve order 1:1 and a
//   length mismatch is what actually caused real validation failures in practice).
function validateMenuItemsField(
    fieldLabel: "first_menu" | "treat_menu",
    original: string | null,
    translatedItems: string[] | null,
): { ok: true; value: string | null } | { ok: false; error: string } {
    if (original === null) {
        return { ok: true, value: null };
    }
    const originalItems = splitMenuItems(original);
    if (translatedItems === null) {
        return { ok: false, error: `Translated ${fieldLabel}_items is null but the Korean original is not.` };
    }
    if (translatedItems.length !== originalItems.length) {
        return {
            ok: false,
            error: `Translated ${fieldLabel}_items has ${translatedItems.length} item(s), expected exactly ${originalItems.length}.`,
        };
    }
    return { ok: true, value: translatedItems.join(" / ") };
}

// All digit sequences in a string, as strings (so "01" and "1" are NOT treated as
// equal — Korean addresses/hours don't use leading zeros in a way that would make
// that ambiguous in practice, and staying literal is the conservative choice).
function extractNumberTokens(text: string | null): string[] {
    if (!text) return [];
    return text.match(/\d+/g) ?? [];
}

function countOccurrences(items: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
}

function countsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false;
    for (const [key, count] of a) {
        if (b.get(key) !== count) return false;
    }
    return true;
}

// True when the original and translated strings contain EXACTLY the same
// multiset of numeric tokens — same distinct values, same count of each,
// order-independent (English address reordering is expected and fine). Catches
// a building/road/floor number silently dropped OR changed (missing count) AND
// catches an extra invented number (added count) — e.g. original [1, 2, 1]
// requires the translation to have exactly two "1"s and one "2": not [1, 1]
// (the "2" went missing) and not [1, 2, 1, 99] (a number was invented).
function hasExactlySameNumberTokens(original: string | null, translated: string | null): boolean {
    const requiredCounts = countOccurrences(extractNumberTokens(original));
    if (requiredCounts.size === 0) return true;
    if (!translated) return false;
    const translatedCounts = countOccurrences(extractNumberTokens(translated));
    return countsEqual(requiredCounts, translatedCounts);
}

// General, reusable (not Seoul-specific or place-specific) Korean day-of-week
// vocabulary — safe to hardcode since there are exactly 7 and the mapping never
// changes.
const KOREAN_DAY_TO_ENGLISH: Record<string, string> = {
    "월요일": "Monday",
    "화요일": "Tuesday",
    "수요일": "Wednesday",
    "목요일": "Thursday",
    "금요일": "Friday",
    "토요일": "Saturday",
    "일요일": "Sunday",
};
const ALL_ENGLISH_DAYS = Object.values(KOREAN_DAY_TO_ENGLISH);

function extractKoreanDays(text: string | null): string[] {
    if (!text) return [];
    return Object.keys(KOREAN_DAY_TO_ENGLISH).filter((day) => text.includes(day));
}

function extractEnglishDays(text: string | null): string[] {
    if (!text) return [];
    return ALL_ENGLISH_DAYS.filter((day) => text.includes(day));
}

function sameStringSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((item) => setA.has(item));
}

// HH:MM-shaped time values (e.g. "12:00", "02:30") — the exact literal substrings
// the source uses, so a translation is only accepted if it reuses the same digits.
function extractTimeTokens(text: string | null): string[] {
    if (!text) return [];
    return text.match(/\d{1,2}:\d{2}/g) ?? [];
}

// True when the SET of English day names in the translated text exactly matches
// the source's Korean days (converted to English) — not just "contains", so a
// translation that keeps the correct day but ALSO adds an invented one (e.g.
// "Every Sunday and Wednesday" for a "매주 일요일" source) fails too, not only one
// that drops or swaps the day. Every HH:MM time value from the source must also
// appear verbatim (simple containment — phrasing around it may vary freely).
function preservesDaysAndTimes(original: string | null, translated: string | null): boolean {
    const requiredDays = extractKoreanDays(original).map((ko) => KOREAN_DAY_TO_ENGLISH[ko]);
    const requiredTimes = extractTimeTokens(original);
    if (requiredDays.length === 0 && requiredTimes.length === 0) return true;
    if (!translated) return false;

    if (requiredDays.length > 0 && !sameStringSet(requiredDays, extractEnglishDays(translated))) {
        return false;
    }
    for (const time of requiredTimes) {
        if (!translated.includes(time)) return false;
    }
    return true;
}

// Substrings that must stay glued to a preceding digit: a numbered "가" sub-street
// suffix ("217ga-gil") and a floor marker's "F" ("1F", "2F"). Listed explicitly
// (rather than only inline in the regex) so the exception set is easy to audit
// or extend without re-deriving the pattern from scratch.
const ADDRESS_SPACING_GLUE_EXCEPTIONS = ["ga-gil", "F"];
const ADDRESS_SPACING_RE = new RegExp(
    `(\\d)(?!(?:${ADDRESS_SPACING_GLUE_EXCEPTIONS.join("|")}))(?=[A-Za-z])`,
    "g",
);

// Kakao/LLM-derived English addresses can end up missing the space between a
// leading building number and the road name right after it (e.g. "55Toegye-ro
// 76-gil" -> "55 Toegye-ro 76-gil"). Verified directly against
// validateTranslation()'s final return value in this session's test run (see the
// completion report) — "217ga-gil" and "1F"/"2F" are left untouched.
function normalizeAddressSpacing(address: string | null): string | null {
    if (!address) return address;
    return address.replace(ADDRESS_SPACING_RE, "$1 ");
}

// Fields that must not silently become null when the Korean original has a real
// value — a translation that drops one of these to null is treated as a failure,
// not a value worth previewing or saving. `name` has its own dedicated empty
// check below; `first_menu`/`treat_menu` are checked by validateMenuItemsField
// (with a more specific error message); `description` is deliberately excluded —
// the prompt allows generating one from name+address when the original is null.
const MUST_NOT_BECOME_NULL_KEYS: (keyof TranslatedText)[] = [
    "address", "open_time", "rest_date", "parking", "packing",
];

// The Korean source may carry a "[백년가게]" ("Centennial Store" — a government
// recognition badge for businesses open 30+ years) prefix on `name`. The prompt
// asks the model to render it as "Centennial Store: " while still keeping the
// full original Korean (prefix included) in parentheses — but the badge prefix
// itself isn't part of the store's own name, so it's excluded only from this
// comparison, never from the output data.
const CENTENNIAL_STORE_PREFIX = "[백년가게]";

// NFKC-normalizes and collapses whitespace so the name-preservation check below
// isn't tripped up by spacing or width-variant differences between the Korean
// source and the model's output.
function normalizeForNameComparison(text: string): string {
    return text.normalize("NFKC").replace(/\s+/g, "");
}

interface ValidationResult {
    ok: boolean;
    error?: string;
    value?: TranslatedText;
}

// The one gate every translated row passes through before it can be previewed
// or saved. Rejects (never silently patches, except normalizeAddressSpacing()'s
// pure formatting fix) anything that looks structurally wrong: a malformed
// shape, an empty/unrelated name, a non-null source field turned null, a menu
// item array whose length doesn't exactly match the source, a changed/added/
// dropped address number, or a changed/added/dropped day-of-week or time value.
function validateTranslation(row: KoTextRow, raw: unknown): ValidationResult {
    if (!isRawModelOutputShape(raw)) {
        return { ok: false, error: "Translated JSON did not match the expected schema." };
    }

    const firstMenuResult = validateMenuItemsField("first_menu", row.first_menu, raw.first_menu_items);
    if (!firstMenuResult.ok) return { ok: false, error: firstMenuResult.error };
    const treatMenuResult = validateMenuItemsField("treat_menu", row.treat_menu, raw.treat_menu_items);
    if (!treatMenuResult.ok) return { ok: false, error: treatMenuResult.error };

    const assembled: TranslatedText = {
        name: raw.name,
        address: raw.address,
        description: raw.description,
        first_menu: firstMenuResult.value,
        treat_menu: treatMenuResult.value,
        open_time: raw.open_time,
        rest_date: raw.rest_date,
        parking: raw.parking,
        packing: raw.packing,
        tags: raw.tags,
    };

    const restored = restoreNullsFromSource(row, assembled);
    restored.address = normalizeAddressSpacing(restored.address);

    if (!restored.name || !restored.name.trim()) {
        return { ok: false, error: "Translated name is empty." };
    }
    // The prompt requires "English Name (한글 원문)" — if the Korean original
    // name's body doesn't appear anywhere in the translated name, the model
    // likely drifted into an unrelated or invented value. A "[백년가게]" badge
    // prefix (see CENTENNIAL_STORE_PREFIX) is excluded from this comparison only —
    // the prompt still requires it in the output's parenthetical Korean text, this
    // just doesn't force it to also appear literally in that exact bracketed form
    // right before the comparison. The comparison itself is NFKC-normalized and
    // whitespace-insensitive so spacing/width variants don't cause a false failure.
    const originalNameBody = row.name && row.name.startsWith(CENTENNIAL_STORE_PREFIX)
        ? row.name.slice(CENTENNIAL_STORE_PREFIX.length)
        : row.name;
    if (originalNameBody) {
        const normalizedBody = normalizeForNameComparison(originalNameBody);
        if (normalizedBody && !normalizeForNameComparison(restored.name).includes(normalizedBody)) {
            return { ok: false, error: "Translated name does not preserve the original Korean text." };
        }
    }

    for (const key of MUST_NOT_BECOME_NULL_KEYS) {
        if (row[key] !== null && restored[key] === null) {
            return { ok: false, error: `Translated ${key} is null but the Korean original is not.` };
        }
    }

    if (!hasExactlySameNumberTokens(row.address, restored.address)) {
        return {
            ok: false,
            error: "Translated address numbers do not exactly match the original (a number was dropped, changed, or added — building number, road number, or floor).",
        };
    }

    if (!preservesDaysAndTimes(row.open_time, restored.open_time)) {
        return { ok: false, error: "Translated open_time changed, dropped, or added a day-of-week or time value from the original." };
    }
    if (!preservesDaysAndTimes(row.rest_date, restored.rest_date)) {
        return { ok: false, error: "Translated rest_date changed, dropped, or added a day-of-week or time value from the original." };
    }

    return { ok: true, value: restored };
}

async function translateWithSolar(row: KoTextRow, correction: CorrectionContext | null = null): Promise<RawTranslationResult> {
    const apiKey = Deno.env.get("SOLAR_API_KEY");
    if (!apiKey) throw new Error("SOLAR_API_KEY is not configured.");

    const prompt = correction
        ? buildCorrectivePrompt(row, correction.priorRaw, correction.validationError)
        : buildTranslationPrompt(row);

    const res = await fetch("https://api.upstage.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "solar-pro",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Solar error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Solar.");

    return {
        translated: JSON.parse(content),
        provider: "solar",
        usage: extractUsage(data),
    };
}

async function translateWithOpenAI(row: KoTextRow, correction: CorrectionContext | null = null): Promise<RawTranslationResult> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const prompt = correction
        ? buildCorrectivePrompt(row, correction.priorRaw, correction.validationError)
        : buildTranslationPrompt(row);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: { type: "json_object" },
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error: ${res.status} ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI.");

    return {
        translated: JSON.parse(content),
        provider: "openai",
        usage: extractUsage(data),
    };
}

type AttemptResult =
    | { ok: true; raw: RawTranslationResult }
    | { ok: false; error: string };

// One real API call attempt (fresh or corrective), never throwing — network/API
// failures come back as `{ ok: false }` so the caller can move on to the next
// provider/retry instead of the whole row blowing up.
async function attemptProvider(
    provider: "openai" | "solar",
    row: KoTextRow,
    correction: CorrectionContext | null,
): Promise<AttemptResult> {
    try {
        const raw = provider === "openai"
            ? await translateWithOpenAI(row, correction)
            : await translateWithSolar(row, correction);
        return { ok: true, raw };
    } catch (err) {
        return { ok: false, error: getErrorMessage(err) };
    }
}

// Runs a bounded attempt sequence for one row and returns every real API call's
// token usage alongside the final outcome (see TranslateOutcome) — so the caller
// can aggregate actual spend even when the row ultimately fails, not just when it
// succeeds (this fixes usage silently disappearing for validation-rejected calls).
//
// Sequence (OPENAI_API_KEY present — max 3 calls):
//   1. OpenAI, fresh prompt
//   2. Solar, fresh prompt      — runs if (1) network-failed OR failed validation
//   3. Solar, corrective prompt — runs only if (2) was a successful CALL that
//      failed validation; passes (2)'s output + validation error back to the model
//
// Sequence (no OPENAI_API_KEY — max 2 calls):
//   1. Solar, fresh prompt
//   2. Solar, corrective prompt — runs only if (1) was a successful CALL that
//      failed validation
//
// A corrective retry only ever follows a *validation* failure (a real,
// parseable-but-wrong answer) on the LAST provider in the fallback list — never a
// network error (nothing concrete to correct) and never before other providers
// have had their turn. This never grows unbounded: the list above is the entire
// set of attempts, there is no loop that can retry more than once.
async function translateText(row: KoTextRow): Promise<TranslateOutcome> {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const providers: Array<"openai" | "solar"> = openaiKey ? ["openai", "solar"] : ["solar"];
    const attemptUsages: AttemptUsage[] = [];
    let lastError = "Translation failed.";

    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const result = await attemptProvider(provider, row, null);

        if (!result.ok) {
            lastError = result.error;
            continue; // network/call failure — move to the next provider, no corrective retry
        }

        attemptUsages.push({ provider, usage: result.raw.usage });
        const validation = validateTranslation(row, result.raw.translated);
        if (validation.ok && validation.value) {
            return { ok: true, translated: validation.value, provider, attemptUsages };
        }
        lastError = validation.error ?? "Translation failed validation.";

        // One corrective retry, same provider — only once we're on the LAST
        // provider in the fallback list (no more providers left to hand off to).
        if (i === providers.length - 1) {
            const correctiveResult = await attemptProvider(provider, row, {
                priorRaw: result.raw.translated,
                validationError: lastError,
            });
            if (!correctiveResult.ok) {
                lastError = correctiveResult.error;
                break;
            }
            attemptUsages.push({ provider, usage: correctiveResult.raw.usage });
            const correctiveValidation = validateTranslation(row, correctiveResult.raw.translated);
            if (correctiveValidation.ok && correctiveValidation.value) {
                return { ok: true, translated: correctiveValidation.value, provider, attemptUsages };
            }
            lastError = correctiveValidation.error ?? "Corrective retry failed validation.";
        }
    }

    return { ok: false, error: lastError, attemptUsages };
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "POST requests only." }, 405);
    }

    try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const adminToken = req.headers.get("x-admin-seed-token");
        const expectedToken = (Deno.env.get("ADMIN_SEED_TOKEN") ?? "").trim();

        if (!expectedToken) {
            return jsonResponse({ error: "ADMIN_SEED_TOKEN is not configured." }, 500);
        }

        if (!adminToken || adminToken !== expectedToken) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json().catch(() => ({}));
        const rawLimit = Number(body.limit ?? 5);
        const safeLimit = Math.min(Math.max(rawLimit, 1), 50);
        const dryRun: boolean = body.dryRun !== false; // default true

        // ── Supabase client ───────────────────────────────────────────────────
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false } }
        );

        // ── Step 1: collect place_ids that already have an en row ─────────────
        // Paginated via .range() — a single unbounded select() was silently
        // capped by PostgREST's default row limit (1000), so once en rows passed
        // that count (1,052 currently) the tail went missing from this list and
        // those place_ids got re-queued for translation even though they already
        // had an en row (caught and skipped later, but only after wasting a real
        // API call/tokens on each one — see mg_place_texts row count).
        //
        // NOTE (scale risk, reported as-is per prior instructions — not changed):
        // the collected ids are still inlined into a `.not(place_id, in, (...))`
        // filter below. Both that query string size and the filter's cost grow
        // linearly with the en-row count — there is no RPC/view/NOT EXISTS-based
        // alternative elsewhere in this project (checked supabase/functions/
        // mg-tour-en-enrich and mg-tour-seed; neither implements this pattern,
        // and there is no supabase/migrations directory defining one). Revisit if
        // this ever grows large enough to hit statement-size or latency limits.
        const EN_PLACE_ID_PAGE_SIZE = 1000;
        const enPlaceIdSet = new Set<number>();
        for (let from = 0; ; from += EN_PLACE_ID_PAGE_SIZE) {
            const { data: enPage, error: enQueryError } = await supabase
                .from("mg_place_texts")
                .select("place_id")
                .eq("locale", "en")
                .range(from, from + EN_PLACE_ID_PAGE_SIZE - 1);

            if (enQueryError) throw enQueryError;

            for (const r of (enPage ?? []) as { place_id: number }[]) {
                enPlaceIdSet.add(r.place_id);
            }

            if (!enPage || enPage.length < EN_PLACE_ID_PAGE_SIZE) break;
        }
        const enPlaceIds: number[] = [...enPlaceIdSet];

        // ── Step 2: fetch ko rows with no en counterpart ──────────────────────
        let koQuery = supabase
            .from("mg_place_texts")
            .select("place_id, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags")
            .eq("locale", "ko")
            .order("place_id", { ascending: true })
            .limit(safeLimit);

        if (enPlaceIds.length > 0) {
            koQuery = koQuery.not("place_id", "in", `(${enPlaceIds.join(",")})`);
        }

        const { data: koRows, error: koQueryError } = await koQuery;

        if (koQueryError) throw koQueryError;

        if (!koRows || koRows.length === 0) {
            return jsonResponse({
                message: dryRun
                    ? "No untranslated records found (preview)."
                    : "No untranslated records found.",
                dryRun,
                requestedCount: safeLimit,
                translatedCount: 0,
                savedCount: 0,
                failedCount: 0,
                results: [],
            });
        }

        // ── Step 3: translate + (optionally) save ────────────────────────────
        const results: Array<{
            placeId: number;
            koName: string | null;
            enName: string | null;
            provider: "openai" | "solar" | null;
            status: "preview" | "saved" | "skipped" | "failed";
            error: string | null;
            translated?: TranslatedText;
        }> = [];

        let translatedCount = 0;
        let savedCount = 0;
        let failedCount = 0;

        const usageByProvider = {
            openai: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            solar: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };

        for (const row of koRows as KoTextRow[]) {
            try {
                const outcome = await translateText(row);

                // Every real API call's usage counts toward the totals, whether
                // or not the row's translation was ultimately accepted.
                for (const attempt of outcome.attemptUsages) {
                    usageByProvider[attempt.provider].promptTokens += attempt.usage.promptTokens;
                    usageByProvider[attempt.provider].completionTokens += attempt.usage.completionTokens;
                    usageByProvider[attempt.provider].totalTokens += attempt.usage.totalTokens;
                }

                if (!outcome.ok || !outcome.translated || !outcome.provider) {
                    failedCount++;
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        enName: null,
                        provider: null,
                        status: "failed",
                        error: outcome.error ?? "Translation failed.",
                    });
                    continue;
                }

                translatedCount++;
                const { translated, provider } = outcome;

                if (dryRun) {
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        enName: translated.name,
                        provider,
                        status: "preview",
                        error: null,
                        translated,
                    });
                    continue;
                }

                // Safety re-check: confirm no en row was inserted since the initial query
                const { data: existingEn, error: existingCheckError } = await supabase
                    .from("mg_place_texts")
                    .select("place_id")
                    .eq("place_id", row.place_id)
                    .eq("locale", "en")
                    .maybeSingle();

                if (existingCheckError) throw existingCheckError;

                if (existingEn) {
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        enName: translated.name,
                        provider,
                        status: "skipped",
                        error: "en row already exists",
                    });
                    continue;
                }

                // .insert(), never .upsert() — an INSERT can only create a new row
                // or fail on the (place_id, locale) UNIQUE constraint; it can never
                // UPDATE an existing row, so an existing en row (including any
                // translation_status='source' official row) can never be
                // overwritten here even under a race with another call. The
                // existingEn re-check above is a fast-path, not the real
                // guarantee — the UNIQUE constraint + this insert-only write are.
                const { error: insertError } = await supabase
                    .from("mg_place_texts")
                    .insert({
                        place_id: row.place_id,
                        locale: "en",
                        name: translated.name,
                        address: translated.address,
                        description: translated.description,
                        first_menu: translated.first_menu,
                        treat_menu: translated.treat_menu,
                        open_time: translated.open_time,
                        rest_date: translated.rest_date,
                        parking: translated.parking,
                        packing: translated.packing,
                        tags: translated.tags,
                        translation_status: "machine",
                    });

                if (insertError) {
                    if (insertError.code === POSTGRES_UNIQUE_VIOLATION) {
                        results.push({
                            placeId: row.place_id,
                            koName: row.name,
                            enName: translated.name,
                            provider,
                            status: "skipped",
                            error: "en row already exists",
                        });
                        continue;
                    }
                    throw insertError;
                }

                savedCount++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    enName: translated.name,
                    provider,
                    status: "saved",
                    error: null,
                });
            } catch (error) {
                failedCount++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    enName: null,
                    provider: null,
                    status: "failed",
                    error: getErrorMessage(error),
                });
            }
        }

        const totalPromptTokens = usageByProvider.openai.promptTokens + usageByProvider.solar.promptTokens;
        const totalCompletionTokens = usageByProvider.openai.completionTokens + usageByProvider.solar.completionTokens;

        return jsonResponse({
            message: dryRun
                ? "English machine translation preview complete"
                : "English machine translation enrichment complete",
            dryRun,
            requestedCount: koRows.length,
            translatedCount,
            savedCount,
            failedCount,
            usage: {
                totalPromptTokens,
                totalCompletionTokens,
                totalTokens: totalPromptTokens + totalCompletionTokens,
                byProvider: usageByProvider,
            },
            results,
        });
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});
