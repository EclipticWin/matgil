import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-admin-seed-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TARGET_LOCALE = "zh-CN";
const SOURCE_LOCALE = "ko";
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;
const KO_PAGE_SIZE = 200;
const POSTGRES_UNIQUE_VIOLATION = "23505";

type Provider = "solar";

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
    tags: unknown;
}

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

interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

interface TranslationResult {
    translated: TranslatedText;
    provider: Provider;
    usage: TokenUsage;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...CORS,
            "Content-Type": "application/json; charset=utf-8",
        },
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) return JSON.stringify(error);
    return String(error);
}

function normalizeNullableString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value)
        .replace(/<br\s*\/?>/gi, " / ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > 0 ? text : null;
}

function normalizeTags(value: unknown): string[] | null {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return null;

    const tags = value
        .map((item) => normalizeNullableString(item))
        .filter((item): item is string => item !== null);

    return tags.length > 0 ? tags : [];
}

function normalizeZh(text: string | null | undefined): string | null {
    if (text == null) return null;
    if (text === "") return "";

    return text
        .replace(/总店/g, " 总店")
        .replace(/咖啡店/g, "咖啡厅")
        .replace(/\s+/g, " ")
        .trim();
}

function containsHangul(value: string | null): boolean {
    if (!value) return false;
    return /[ᄀ-ᇿ㄰-㆏가-힣]/.test(value);
}

// description/menu가 영어·로마자만으로 채워진 채 zh-CN에 저장되는 것을 막기
// 위한 검사 — 한자(CJK 통합 한자)를 하나라도 포함하는지만 확인한다. 숫자·
// 브랜드명이 섞여 있어도 한자가 하나라도 있으면 통과하므로, "汉堡A餐"처럼
// 정상적으로 숫자/영문이 섞인 중국어 표기는 그대로 허용된다. name/address는
// 공식 상호명이나 로마자 도로명 fallback을 허용해야 하므로 이 검사를 적용하지
// 않는다(resolveMenuItemTranslation/recoverDescription에서만 사용).
function containsHanCharacter(value: string | null): boolean {
    if (!value) return false;
    return /[一-鿿]/.test(value);
}

// name/address/description/first_menu/treat_menu/parking/packing은 이제
// applyAutoRecovery()가 한글 잔존을 코드로 정제하므로(요구사항 1~5), 단순 한글
// 잔존만으로 행을 실패시키지 않는다 — 이 목록에는 자동복구 대상이 아닌 필드만
// 남긴다(open_time/rest_date/tags). 요일·시간 자체가 바뀌었는지는 숫자·요일
// 전용 검사(hasSameNumberTokens/preservesTimeTokens/preservesWeekdays)가 맡는다.
function containsHangulAnywhere(value: TranslatedText): string | null {
    const stringFields: Array<keyof Omit<TranslatedText, "tags">> = ["open_time", "rest_date"];

    for (const key of stringFields) {
        if (containsHangul(value[key])) return String(key);
    }

    if (value.tags) {
        for (let i = 0; i < value.tags.length; i++) {
            if (containsHangul(value.tags[i])) return `tags[${i}]`;
        }
    }

    return null;
}

// applyAutoRecovery() 이후에도 혹시 한글이 남아 있다면(로직 결함에 대한
// 방어선) — 조용히 통과시키지 않고 실패로 분류해 failureBreakdown에 잡히게
// 한다. 정상 동작 시에는 이 함수가 문제를 찾는 일이 없어야 한다.
function findResidualHangulAfterRecovery(value: TranslatedText): string | null {
    const stringFields: Array<keyof Omit<TranslatedText, "tags">> = [
        "name", "address", "description", "first_menu", "treat_menu", "parking", "packing",
    ];

    for (const key of stringFields) {
        if (containsHangul(value[key])) return `${String(key)}에 자동복구 후에도 한글이 남아 있습니다.`;
    }

    return null;
}

function extractNumberTokens(value: string | null): string[] {
    if (!value) return [];
    return value.match(/\d+/g) ?? [];
}

function countTokens(tokens: string[]): Map<string, number> {
    const result = new Map<string, number>();
    for (const token of tokens) {
        result.set(token, (result.get(token) ?? 0) + 1);
    }
    return result;
}

function hasSameNumberTokens(source: string | null, translated: string | null): boolean {
    const sourceCounts = countTokens(extractNumberTokens(source));
    const translatedCounts = countTokens(extractNumberTokens(translated));

    if (sourceCounts.size !== translatedCounts.size) return false;

    for (const [token, count] of sourceCounts) {
        if (translatedCounts.get(token) !== count) return false;
    }

    return true;
}

// open_time/rest_date의 숫자는 "원문 숫자가 번역문에 포함되는지"가 아니라
// address와 동일한 기준(hasSameNumberTokens — 모든 숫자 토큰의 개수와 값이
// 정확히 같아야 함)으로 검증한다. 이전에는 포함 여부만 확인해서 "11:00~21:00"
// 원문이 "11:00~21:00 / 22:00"처럼 시간이 추가된 번역도 통과시키는 문제가
// 있었다 — 이제는 추가된 숫자도 hard failure다.
function preservesTimeTokens(source: string | null, translated: string | null): boolean {
    return hasSameNumberTokens(source, translated);
}

// 요일 변경도 여전히 hard validation 대상이다(요구사항 6). "OO요일" 형태로
// 명확히 등장하는 경우만 검사한다 — "화"/"수" 같은 단독 음절은 다른 단어의
// 일부일 수 있어 오탐 위험이 크므로 다루지 않는다(이 프로젝트의 "확실하지 않으면
// 추측하지 않는다" 원칙과 동일).
// 자동복구(recoverScheduleField)가 실제로 써넣는 값은 이 하나뿐이다(周一 등) —
// WEEKDAY_ZH_CANONICAL(아래)은 검증 전용으로, 모델이 이미 星期一처럼 정상적인
// 다른 표기를 썼을 때도 같은 요일로 정규화해 비교하기 위한 것이다(周一~周日,
// 星期一~星期日 모두 인정).
const WEEKDAY_ZH_MAP: Record<string, string> = {
    "월요일": "周一", "화요일": "周二", "수요일": "周三", "목요일": "周四",
    "금요일": "周五", "토요일": "周六", "일요일": "周日",
};

// 중국어 요일 표기(周一~周日, 星期一~星期日) -> 같은 요일의 한국어 표기로
// 정규화한다. preservesWeekdays()가 원문(한국어) 쪽 카운트와 직접 비교할 수
// 있도록 하는 역방향 매핑이다.
const WEEKDAY_ZH_CANONICAL: Record<string, string> = {
    "周一": "월요일", "星期一": "월요일",
    "周二": "화요일", "星期二": "화요일",
    "周三": "수요일", "星期三": "수요일",
    "周四": "목요일", "星期四": "목요일",
    "周五": "금요일", "星期五": "금요일",
    "周六": "토요일", "星期六": "토요일",
    "周日": "일요일", "星期日": "일요일",
};

function extractWeekdaysKo(value: string | null): string[] {
    if (!value) return [];
    return value.match(/월요일|화요일|수요일|목요일|금요일|토요일|일요일/g) ?? [];
}

function extractWeekdaysZhNormalized(value: string | null): string[] {
    if (!value) return [];
    const matches = value.match(/星期[一二三四五六日]|周[一二三四五六日]/g) ?? [];
    return matches
        .map((match) => WEEKDAY_ZH_CANONICAL[match])
        .filter((weekday): weekday is string => weekday !== undefined);
}

// 요일도 숫자와 동일하게 "포함 여부"가 아니라 "요일별 개수가 원문과 정확히
// 같은가"로 검증한다 — 누락된 요일뿐 아니라(예: 원문 일요일이 번역에 없음),
// 원문에 없는 요일이 추가된 경우도(예: 원문 일요일인데 번역이 "周日、周一")
// hard failure다.
function preservesWeekdays(source: string | null, translated: string | null): boolean {
    const sourceCounts = countTokens(extractWeekdaysKo(source));
    const translatedCounts = countTokens(extractWeekdaysZhNormalized(translated));

    if (sourceCounts.size !== translatedCounts.size) return false;

    for (const [weekday, count] of sourceCounts) {
        if (translatedCounts.get(weekday) !== count) return false;
    }

    return true;
}

// ─── 자동복구(auto recovery): "코드에서 안전하게 고칠 수 있는 문제"와 ──────────
// "데이터 훼손 위험이 있어 반드시 실패시켜야 하는 문제"를 분리한다. 아래 함수들은
// 전부 모델을 다시 호출하지 않고, 이미 받은 번역 결과를 코드로 정제한다. 정제
// 후에도 핵심 무결성(숫자/자치구/서울/non-null 정책)은 validateTranslatedText()가
// 다시 검사한다 — 자동복구는 검증을 느슨하게 만드는 것이 아니라 검증에 들어가기
// 전 입력을 정제하는 전처리 단계다.

// ── 한글 → 로마자(Revised Romanization) ─────────────────────────────────────
// 표준 국어의 로마자 표기법 순서 그대로. 어떤 완성형 한글 음절도 안전하게 라틴
// 문자로 변환할 수 있어(발음 정확도가 아니라 "한글을 남기지 않는 보수적 표기"가
// 목적), 확실한 중국어 한자를 만들 수 없을 때의 최후 fallback으로 쓴다 — 절대
// 임의의 한자를 새로 만들어내지 않는다(요구사항 2/9).
const ROMAN_INITIALS = [
    "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];
const ROMAN_MEDIALS = [
    "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const ROMAN_FINALS = [
    "", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t",
];

const HANGUL_SYLLABLE_FIRST = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;

/** 완성형 한글 음절 하나를 로마자로 분해한다. 완성형 음절이 아니면 null(호출부가
 *  그 문자를 그대로 두거나 다른 방식으로 처리하도록 위임한다 — 절대 잘못된 문자를
 *  억지로 변환하지 않는다). */
function romanizeSyllable(char: string): string | null {
    const code = char.codePointAt(0);
    if (code === undefined || code < HANGUL_SYLLABLE_FIRST || code > HANGUL_SYLLABLE_LAST) return null;
    const offset = code - HANGUL_SYLLABLE_FIRST;
    const initial = Math.floor(offset / (21 * 28));
    const medial = Math.floor((offset % (21 * 28)) / 28);
    const final = offset % 28;
    return `${ROMAN_INITIALS[initial]}${ROMAN_MEDIALS[medial]}${ROMAN_FINALS[final]}`;
}

/** 한글 단어(음절 나열) 하나를 로마자로 변환하고 첫 글자만 대문자화한다. 완성형
 *  한글이 아닌 문자가 섞여 있으면 null을 반환해 호출부가 그 구간을 원문 그대로
 *  남기게 한다(절반만 변환된 결과를 만들지 않는다). */
function romanizeHangulWord(word: string): string | null {
    let result = "";
    for (const ch of word) {
        const syllable = romanizeSyllable(ch);
        if (syllable === null) return null;
        result += syllable;
    }
    if (!result) return null;
    return result.charAt(0).toUpperCase() + result.slice(1);
}

/** 문자열에 남은 모든 한글 구간(연속된 한글 syllable 묶음)을 각각 로마자로
 *  치환한다. 숫자·중국어·기존 영문·구두점은 정규식이 애초에 매칭하지 않으므로
 *  건드리지 않는다. `onRun`으로 구간별 커스텀 처리(주소의 길/층 등)를 허용한다. */
function replaceHangulRuns(
    text: string,
    onRun?: (run: string, precededByDigit: boolean, whole: string, offset: number) => string | null,
): string {
    return text.replace(/[가-힣]+/g, (run, offset: number, whole: string) => {
        const precededByDigit = offset > 0 && /\d/.test(whole[offset - 1]);
        const custom = onRun ? onRun(run, precededByDigit, whole, offset) : null;
        if (custom !== null && custom !== undefined) return custom;
        return romanizeHangulWord(run) ?? run;
    });
}

// ── 서울/자치구 고정 치환 (요구사항 1) ────────────────────────────────────────
// SEOUL_DISTRICT_ZH_MAP(아래쪽에 선언됨)을 이 치환 함수와 검증 함수
// (validateFixedDistrictMapping) 양쪽에서 그대로 재사용한다 — 값을 중복
// 선언하지 않는다. 함수 본문은 호출 시점(요청 처리 중)에만 실행되므로, 모듈
// 하단에 선언된 상수를 여기서 참조해도 문제없다(모듈 최상위 선언은 첫 요청이
// 오기 전에 이미 전부 초기화된다).
const SEOUL_CITY_ZH_MAP: Array<[string, string]> = [
    ["서울특별시", "首尔特别市"],
    ["서울시", "首尔市"],
    ["서울", "首尔"],
];

// 서울/자치구를 로마자화 이전에 먼저 고정 치환해야 한다 — 로마자화부터 하면
// "서울특별시 강남구"가 "Seoulteukbyeolsi Gangnam-gu"가 되어 버려서 이후
// validateSeoulCityMapping()/validateFixedDistrictMapping()이 자치구 hard
// failure로 그대로 이어지는 문제가 있었다(주소 한글 잔존 실패가 자치구
// 실패로 이름만 바뀌는 것일 뿐 실제로는 고쳐지지 않았다).
function applyFixedSeoulReplacements(address: string): string {
    let result = address;

    for (const [ko, zh] of SEOUL_CITY_ZH_MAP) {
        result = result.split(ko).join(zh);
    }

    for (const [ko, zh] of Object.entries(SEOUL_DISTRICT_ZH_MAP).sort((a, b) => b[0].length - a[0].length)) {
        result = result.split(ko).join(zh);
    }

    // 중국 주소 표기 관용상 "시/자치구" 단위 사이에는 공백을 두지 않는다
    // (예: 首尔特别市江南区). 도로명 앞의 공백은 그대로 둔다.
    const cityZhAlternation = SEOUL_CITY_ZH_MAP.map(([, zh]) => zh).join("|");
    const districtZhAlternation = Object.values(SEOUL_DISTRICT_ZH_MAP).join("|");
    result = result.replace(
        new RegExp(`(${cityZhAlternation})\\s+(${districtZhAlternation})`),
        "$1$2",
    );

    return result;
}

// 도로/동 접미사는 하이픈으로 분리한 표준 로마자 표기를 우선 시도한다(예:
// 테헤란로 -> Teheran-ro, 다동길 -> Dadong-gil) — 통짜 로마자화(Teheranno)보다
// 실제 관광공사 표기 관례에 가깝다. 긴 접미사(대로)를 짧은 접미사(로)보다 먼저
// 검사해야 "대로"가 "로"로 잘못 잘리지 않는다. 확실히 판단할 수 없으면(어간이
// 완성형 한글이 아니면) null을 반환해 호출부가 일반 단어 로마자화로 넘어가게
// 한다 — 절대 추측하지 않는다.
const ADDRESS_UNIT_SUFFIXES: Array<[string, string]> = [
    ["대로", "daero"],
    ["로", "ro"],
    ["길", "gil"],
    ["동", "dong"],
];

function romanizeAddressUnit(word: string): string | null {
    // "OO로NN길"(번호가 붙은 세부 도로명) 형태를 먼저 처리한다.
    const sideStreet = word.match(/^(.+로)(\d+)길$/);
    if (sideStreet) {
        const roadPart = romanizeAddressUnit(sideStreet[1]);
        if (!roadPart) return null;
        return `${roadPart} ${sideStreet[2]}-gil`;
    }

    for (const [suffixKo, suffixEn] of ADDRESS_UNIT_SUFFIXES) {
        if (word.endsWith(suffixKo) && word.length > suffixKo.length) {
            const stemRoman = romanizeHangulWord(word.slice(0, -suffixKo.length));
            if (!stemRoman) return null;
            return `${stemRoman}-${suffixEn}`;
        }
    }

    return null;
}

// ── 주소 자동복구 ────────────────────────────────────────────────────────────
// 순서가 중요하다: 1) 서울/자치구 고정 치환(중국어) → 2) 남은 한글 중 "길"이
// 도로 접미사로 쓰일 때만(숫자 뒤) 街로, "층"은 楼로 → 3) 그래도 남은 한글은
// 도로/동 접미사 로마자 표기(가능하면) 또는 일반 단어 로마자 표기. 숫자/중국어/
// 기존 영문/구두점은 정규식이 애초에 매칭하지 않으므로 절대 바뀌지 않는다.
function sanitizeTranslatedAddress(address: string | null): string | null {
    if (!address) return address;
    if (!containsHangul(address)) return address;

    const withFixedRegionNames = applyFixedSeoulReplacements(address);
    if (!containsHangul(withFixedRegionNames)) return withFixedRegionNames;

    return replaceHangulRuns(withFixedRegionNames, (run, precededByDigit) => {
        if (run === "층") return "楼";
        if (run === "길" && precededByDigit) return "街";
        return romanizeAddressUnit(run);
    });
}

// ── name 자동복구 ────────────────────────────────────────────────────────────
// "본점"/"지점"/"점"처럼 이미 뜻이 확정된 접미사는 임의 로마자화 전에 먼저
// 정확한 중국어로 치환한다(순서 중요 — 본점/지점을 먼저 치환해야 남는 "점"에만
// 마지막 규칙이 적용된다). "백년가게"는 [ ]/（ ）/( ) 세 괄호 스타일 모두
// 대괄호를 포함해 통째로 百年老店으로 바꾼다(요구사항 8).
function applyKnownNameSuffixFixes(text: string): string {
    let result = text
        .replace(/[\[（(]\s*백년가게\s*[\]）)]/g, "百年老店")
        .replace(/본점/g, "总店")
        .replace(/지점/g, "分店")
        .replace(/점(?=\s|$)/g, "店");

    // 위 치환 이후에도(또는 모델이 애초에) 짝이 맞지 않는 대괄호만 남아 있으면
    // (예: "百年老店]가게이름"처럼 여는 대괄호 없이 닫는 대괄호만 남는 경우 —
    // 요구사항 8) 고립된 대괄호만 제거한다. 괄호(), （）의 일반적인 불균형은
    // 그대로 findBracketImbalanceIssue()의 hard failure 대상으로 남긴다.
    if (countOccurrences(result, "[") !== countOccurrences(result, "]")) {
        result = result.replace(/\[|\]/g, "");
    }

    return result;
}

/** name에 한글이 남아도 행 전체를 실패시키지 않는다(요구사항 2). 우선순위:
 *  1) 모델이 이미 만든 값(기존 영문/라틴 브랜드 표기, 부분적으로 번역된 중국어)을
 *     최대한 보존하고, 알려진 접미사만 정확한 한자로 고친다.
 *  2) 그래도 한글이 남으면 그 구간만 보수적으로 로마자 표기한다(임의 한자 생성
 *     금지 — 요구사항 2/9).
 *  3) 결과가 여전히 일반명(GENERIC_BAD_NAMES)이면 원문 이름 전체를 접미사 규칙 +
 *     로마자화로 재구성해, 서로 다른 가게가 같은 통칭으로 뭉개지지 않게 한다. */
function recoverName(sourceName: string | null, translatedName: string | null): string | null {
    if (sourceName === null) return translatedName;

    const modelBase = translatedName && translatedName.trim().length > 0 ? translatedName : sourceName;
    let candidate = applyKnownNameSuffixFixes(modelBase);
    if (containsHangul(candidate)) {
        candidate = replaceHangulRuns(candidate);
    }

    if (isGenericBadName(candidate)) {
        candidate = replaceHangulRuns(applyKnownNameSuffixFixes(sourceName));
    }

    return candidate;
}

// ── first_menu / treat_menu 자동복구 ─────────────────────────────────────────
// 원본과 동일한 "/"로 구분된 항목 문자열이라고 가정한다(mg-place-translate-en과
// 동일한 관례). 최종 결과는 항상 "원본 항목 개수 및 순서"를 기준으로 조립되므로,
// 모델이 항목을 합치거나 빠뜨려도 개수가 틀어지지 않는다(요구사항 3).
function splitMenuItems(value: string | null): string[] {
    if (!value) return [];
    return value.split("/").map((s) => s.trim()).filter((s) => s.length > 0);
}

// 긴 표현을 먼저 검사해야 "순대"가 "순대국"보다 먼저 매칭되는 사고를 막는다
// (요구사항 9 — 순대국을 顺代国처럼 엉뚱하게 음차하는 사고 방지: 이미 뜻이
// 확정된 요리는 모델 출력과 무관하게 이 사전값을 강제 적용한다).
const FIXED_FOOD_NAME_MAP: Array<[string, string]> = [
    ["돌솥비빔밥", "韩式石锅拌饭"],
    ["김치찌개", "韩国泡菜锅"],
    ["된장찌개", "韩式大酱汤"],
    ["부대찌개", "韩式部队锅"],
    ["감자탕", "韩式猪骨土豆汤"],
    ["삼계탕", "韩式参鸡汤"],
    ["비빔밥", "韩式拌饭"],
    ["불고기", "韩式烤肉"],
    ["삼겹살", "韩式烤五花肉"],
    ["순대국", "韩式血肠汤"],
    ["순대", "韩式血肠"],
    ["보쌈", "韩式菜包肉"],
    ["족발", "韩式酱猪蹄"],
    ["떡볶이", "韩式炒年糕"],
    ["냉면", "韩式冷面"],
    ["칼국수", "韩式刀切面"],
    ["짜장면", "韩式炸酱面"],
    ["자장면", "韩式炸酱面"],
    ["짬뽕", "韩式辣海鲜汤面"],
    ["탕수육", "韩式糖醋肉"],
    ["한정식", "韩式套餐"],
].sort((a, b) => b[0].length - a[0].length);

function applyFixedFoodNameOverride(originalItem: string): string | null {
    for (const [ko, zh] of FIXED_FOOD_NAME_MAP) {
        if (originalItem.includes(ko)) return zh;
    }
    return null;
}

// 모르는 메뉴는 구체적인 다른 요리로 추측하지 않고 안전하게 넓은 카테고리로
// 분류한다(요구사항 3) — 순서는 더 구체적인 키워드가 먼저 오도록 배치했다.
const MENU_FALLBACK_CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
    [/면|국수|냉면|칼국수|짬뽕|자장/, "韩式面食"],
    [/탕|국|찌개|전골/, "韩式汤类料理"],
    [/고기|갈비|불고기|삼겹살|곱창|막창/, "韩式肉类料理"],
    [/해물|회|생선|아구|낙지|주꾸미|조개|새우|게/, "韩式海鲜料理"],
    [/밥|덮밥|볶음밥|죽/, "韩式米饭料理"],
];

function classifyMenuFallbackCategory(originalItem: string): string {
    for (const [pattern, category] of MENU_FALLBACK_CATEGORY_KEYWORDS) {
        if (pattern.test(originalItem)) return category;
    }
    return "韩国料理";
}

/** 메뉴 항목 하나(원본 한국어 `originalItem`, 같은 인덱스의 모델 번역
 *  `modelItem`)를 받아 최종 텍스트를 절대 실패 없이 반환한다. */
function resolveMenuItemTranslation(originalItem: string, modelItem: string | undefined): string {
    const fixed = applyFixedFoodNameOverride(originalItem);
    if (fixed) return fixed;

    // 한글이 없어도 한자가 전혀 없으면(영어·로마자만으로 된 메뉴) 신뢰하지
    // 않는다 — 숫자·브랜드명이 섞여 있어도 한자가 하나라도 있으면 통과한다.
    if (
        modelItem &&
        modelItem.trim().length > 0 &&
        !containsHangul(modelItem) &&
        containsHanCharacter(modelItem)
    ) {
        return modelItem.trim();
    }

    return classifyMenuFallbackCategory(originalItem);
}

/** first_menu/treat_menu 하나를 조립하는 최상위 함수. `original`이 null이면
 *  null을 반환하고, 그렇지 않으면 원본 배열의 개수·순서를 절대 기준으로 삼아 각
 *  인덱스마다 resolveMenuItemTranslation()을 호출해 " / "로 합친 문자열을
 *  반환한다. 모델 항목이 부족하거나(undefined) 원본보다 많아도(초과 인덱스는
 *  애초에 순회 대상이 아님) 개수가 항상 원본과 같다. */
function recoverMenuField(original: string | null, translated: string | null): string | null {
    if (original === null) return null;

    const originalItems = splitMenuItems(original);
    const translatedItems = splitMenuItems(translated);

    return originalItems
        .map((item, index) => resolveMenuItemTranslation(item, translatedItems[index]))
        .join(" / ");
}

// ── parking / packing 자동복구 ───────────────────────────────────────────────
// 이 두 필드는 값의 종류가 몇 가지로 한정되어 있으므로, 모델 출력보다 "원본
// 한국어 값"을 기준으로 결정하는 편이 안전하다(요구사항 5). 한글이 남아 있다는
// 이유만으로 행 전체를 실패시키지 않는다. 모델 출력은 이 4개 중국어 허용값과
// 정확히 일치할 때만 신뢰한다 — "Not available"/"Available" 같은 영어나 다른
// 표현은 한글이 없어도 신뢰하지 않고 원본 기준으로 다시 매핑한다(요구사항 3).
const ALLOWED_AVAILABILITY_VALUES = new Set(["可", "不可", "部分可", "请咨询"]);

function recoverAvailabilityField(source: string | null, translated: string | null): string | null {
    if (source === null) return null;

    const trimmed = translated?.trim() ?? "";
    if (ALLOWED_AVAILABILITY_VALUES.has(trimmed)) {
        return trimmed;
    }

    if (source.includes("불가능")) return "不可";
    if (source.includes("일부") || source.includes("부분")) return "部分可";
    if (source.includes("가능")) return "可";

    return "请咨询";
}

// ── tags 자동복구 (요구사항 2) ────────────────────────────────────────────────
// 원본(한국어) tags를 기준으로 고정 매핑만 적용한다 — 모델이 만든 tags는 신뢰
// 하지 않는다(영어 태그가 그대로 zh-CN에 저장되는 문제를 막기 위해). 알 수
// 없는 태그는 임의 번역하지 않고 제외한다.
const FIXED_TAG_MAP: Array<[RegExp, string]> = [
    [/^음식점$|^restaurant$/i, "餐厅"],
    [/^사진\s*있음$|^has\s*photo$/i, "有照片"],
    [/^위치\s*있음$|^has\s*location$/i, "有位置信息"],
    [/^메뉴\s*정보\s*있음$|^has\s*menu\s*info$/i, "有菜单信息"],
    [/^주차\s*가능$|^parking\s*available$/i, "可停车"],
    [/^포장\s*가능$|^takeout\s*available$/i, "可打包"],
];

function mapFixedTag(tag: string): string | null {
    const trimmed = tag.trim();
    for (const [pattern, zh] of FIXED_TAG_MAP) {
        if (pattern.test(trimmed)) return zh;
    }
    return null;
}

function recoverTags(sourceTagsRaw: unknown): string[] | null {
    const sourceTags = normalizeTags(sourceTagsRaw);
    if (sourceTags === null) return null;

    return sourceTags
        .map((tag) => mapFixedTag(tag))
        .filter((tag): tag is string => tag !== null);
}

// ── open_time / rest_date 자동복구 (요구사항 4) ───────────────────────────────
// 숫자·시간은 건드리지 않는다 — 이미 뜻이 확정된 한국어 표현 단어만 고정
// 치환한다. 긴 표현을 먼저 검사해야 "전화문의"가 "전화문의 요망"보다 먼저
// 매칭돼 " 요망"만 남는 사고를 막는다. 요일 단어(월요일 등)는 아래
// WEEKDAY_ZH_MAP(周一 등)을 그대로 재사용한다 — 중복 선언하지 않는다.
const OPERATING_SCHEDULE_TERM_MAP: Array<[string, string]> = [
    ["전화문의 요망", "请电话咨询"],
    ["전화문의", "请电话咨询"],
    ["연중무휴", "全年无休"],
    ["브레이크타임", "休息时间"],
    ["라스트오더", "最后点单"],
    ["공휴일", "法定节假日"],
    ["설날", "春节"],
    ["추석", "中秋节"],
    // "매주 + 요일"은 "每周周一"처럼 공백 없이 붙여 쓰는 자연스러운 표기를
    // 우선 적용한다(정렬 시 길이가 더 긴 이 항목들이 아래 "매주"/개별 요일
    // 항목보다 먼저 매칭된다).
    ...Object.entries(WEEKDAY_ZH_MAP).map(([ko, zh]): [string, string] => [`매주 ${ko}`, `每周${zh}`]),
    ["매주", "每周"],
    ["평일", "工作日"],
    ["주말", "周末"],
    ["휴무", "休息"],
    ...Object.entries(WEEKDAY_ZH_MAP),
].sort((a, b) => b[0].length - a[0].length);

// source도 함께 받는다 — 모델이 "Open year-round"/"Every Sunday"처럼 영어로
// 반환하면 한글이 없어 그대로 신뢰되던 문제를 막기 위해서다. translated가
// 한글 없이 한자를 하나 이상 포함하면(=실제 중국어) 그대로 신뢰하고, 그 외
// (영어·로마자 전용이거나 한글 잔존)에는 모델 출력을 버리고 source(한국어
// 원문) 전체에 OPERATING_SCHEDULE_TERM_MAP을 적용해 중국어 값을 새로 만든다.
// 숫자·시간·물결표·괄호·슬래시는 이 치환에서 건드리지 않는다(사전 항목이
// 전부 순수 한글 단어라 숫자/기호는 애초에 매칭되지 않는다). source 치환
// 이후에도 한글이 남으면(사전에 없는 표현) 임의로 로마자화하지 않고 그대로
// 반환해 기존 hard validation(containsHangulAnywhere)이 실패시키게 둔다.
function recoverScheduleField(source: string | null, translated: string | null): string | null {
    if (!translated) return translated; // null 정책은 sourceNullPatternMatches()가 별도로 검증한다.

    if (!containsHangul(translated) && containsHanCharacter(translated)) {
        return translated;
    }

    if (source === null) return translated; // source가 없으면 재구성할 근거가 없다.

    let result = source;
    for (const [ko, zh] of OPERATING_SCHEDULE_TERM_MAP) {
        result = result.split(ko).join(zh);
    }
    return result;
}

// ── description 자동복구 ─────────────────────────────────────────────────────
// 한글이 남으면 기존 번역을 버리고, 최종 name + 정제된 address + 대표 메뉴로
// 새로 짧은 중국어 설명을 조립한다(요구사항 4). 원문에 없는 유명세·역사·인기
// 정보는 만들지 않는다 — 사실관계(이름/위치/대표 메뉴)만 나열한다. source
// description이 null이어도(요구사항 5) 이 정책은 동일하게 적용된다 — description
// 은 원래부터 source가 null이어도 생성 가능한 유일한 필드다(sourceNullPatternMatches
// 가 description을 검사 대상에서 제외하는 것과 동일한 기존 정책).
function extractRepresentativeMenuZh(menuField: string | null): string | null {
    if (!menuField) return null;
    const first = menuField.split(" / ")[0]?.trim();
    return first && first.length > 0 ? first : null;
}

function buildSafeDescription(
    finalName: string | null,
    finalAddress: string | null,
    representativeMenuZh: string | null,
): string {
    const parts: string[] = [];
    if (finalName) parts.push(finalName);
    if (finalAddress) parts.push(`位于${finalAddress}`);
    if (representativeMenuZh) parts.push(`推荐菜品包括${representativeMenuZh}等`);

    if (parts.length === 0) return "该餐厅是一家韩国餐厅。";
    return `${parts.join("，")}，是一家韩国餐厅。`;
}

function recoverDescription(
    translated: string | null,
    finalName: string | null,
    finalAddress: string | null,
    representativeMenuZh: string | null,
): string | null {
    // source가 null이든 아니든 규칙은 같다: 모델 출력이 한글 없이 한자를
    // 포함하면(=실제 중국어 문장이면) 유지하고, null이거나 한글이 남아 있거나
    // 영어·로마자로만 되어 있으면(한자가 하나도 없으면) 중립적인 문장을 새로
    // 만든다(요구사항 5 — 이전에는 source가 null이면 무조건 translated를 그대로
    // 반환해 한글이 남아도 자동복구되지 않는 버그가 있었다).
    if (translated && !containsHangul(translated) && containsHanCharacter(translated)) {
        return translated;
    }
    return buildSafeDescription(finalName, finalAddress, representativeMenuZh);
}

/** 한 행의 번역 결과 전체에 위 자동복구 함수들을 적용한다. 모델을 다시 호출하지
 *  않고, 이미 받은 translated 값과 원본 row만으로 결정한다. */
function applyAutoRecovery(row: KoTextRow, translated: TranslatedText): TranslatedText {
    const address = sanitizeTranslatedAddress(translated.address);
    const name = recoverName(row.name, translated.name);
    const first_menu = recoverMenuField(row.first_menu, translated.first_menu);
    const treat_menu = recoverMenuField(row.treat_menu, translated.treat_menu);
    const parking = recoverAvailabilityField(row.parking, translated.parking);
    const packing = recoverAvailabilityField(row.packing, translated.packing);
    const open_time = recoverScheduleField(row.open_time, translated.open_time);
    const rest_date = recoverScheduleField(row.rest_date, translated.rest_date);
    const tags = recoverTags(row.tags);
    const representativeMenuZh = extractRepresentativeMenuZh(first_menu) ?? extractRepresentativeMenuZh(treat_menu);
    const description = recoverDescription(translated.description, name, address, representativeMenuZh);

    return {
        ...translated,
        name,
        address,
        first_menu,
        treat_menu,
        parking,
        packing,
        open_time,
        rest_date,
        tags,
        description,
    };
}

// ── 서울/자치구 검증 (hard validation — 요구사항 6, 이전에는 숫자만 검사하고
// 자치구 표기 자체는 검사하지 않았다) ────────────────────────────────────────
const SEOUL_DISTRICT_ZH_MAP: Record<string, string> = {
    "종로구": "钟路区", "중구": "中区", "용산구": "龙山区", "성동구": "城东区",
    "광진구": "广津区", "동대문구": "东大门区", "중랑구": "中浪区", "성북구": "城北区",
    "강북구": "江北区", "도봉구": "道峰区", "노원구": "芦原区", "은평구": "恩平区",
    "서대문구": "西大门区", "마포구": "麻浦区", "양천구": "阳川区", "강서구": "江西区",
    "구로구": "九老区", "금천구": "衿川区", "영등포구": "永登浦区", "동작구": "铜雀区",
    "관악구": "冠岳区", "서초구": "瑞草区", "강남구": "江南区", "송파구": "松坡区",
    "강동구": "江东区",
};

function extractSeoulDistrictKo(address: string | null): string | null {
    if (!address) return null;
    const match = address.match(/([가-힣]+구)(?=[^가-힣]|$)/);
    return match ? match[1] : null;
}

function validateFixedDistrictMapping(source: KoTextRow, translated: TranslatedText): string | null {
    const districtKo = extractSeoulDistrictKo(source.address);
    if (!districtKo) return null;

    const expectedZh = SEOUL_DISTRICT_ZH_MAP[districtKo];
    if (!expectedZh) return null;

    if (!translated.address || !translated.address.includes(expectedZh)) {
        return `address에서 자치구(${districtKo} → ${expectedZh}) 표기가 원문과 다르게 바뀌었습니다.`;
    }

    return null;
}

function validateSeoulCityMapping(source: KoTextRow, translated: TranslatedText): string | null {
    if (!source.address || !source.address.includes("서울")) return null;
    if (!translated.address || !translated.address.includes("首尔")) {
        return "address에서 서울(首尔) 표기가 원문과 다르게 바뀌었습니다.";
    }
    return null;
}

// ── 번체자 자동 간체화(요구사항 6) — 대응표에 있는 문자는 검증 전에 코드로
// 미리 치환한다(예: 雪濃湯 → 雪浓汤). 대응표 밖의 문자는 다루지 않으므로,
// findTraditionalCharacterIssue()는 이 치환 이후에도 남는 것(=이 표에 있는데
// 치환이 빠졌다는 뜻이므로 정상 동작 시 발생하지 않아야 함)만 걸러내는
// 방어선으로 남는다 — "대응표 밖의 명확한 번체자"에 대한 별도 사전은 아직 없다.
const TRADITIONAL_CHARACTER_MAP: Record<string, string> = {
    "麵": "面", "飯": "饭", "館": "馆", "濃": "浓", "湯": "汤", "麗": "丽",
    "國": "国", "韓": "韩", "專": "专", "農": "农", "廳": "厅", "醬": "酱",
    "雞": "鸡", "魚": "鱼", "蝦": "虾", "貝": "贝", "豬": "猪", "燒": "烧",
    "廚": "厨", "廣": "广", "後": "后", "臺": "台", "與": "与", "們": "们",
    "來": "来", "說": "说", "個": "个", "為": "为", "會": "会", "從": "从",
    "區": "区", "點": "点", "麥": "麦", "薑": "姜", "鹹": "咸", "麪": "面",
    "飲": "饮", "雙": "双", "雲": "云", "壽": "寿", "蘿": "萝", "蔔": "卜",
};

function convertTextTraditionalToSimplified(text: string | null): string | null {
    if (!text) return text;
    let result = text;
    for (const [traditional, simplified] of Object.entries(TRADITIONAL_CHARACTER_MAP)) {
        if (result.includes(traditional)) result = result.split(traditional).join(simplified);
    }
    return result;
}

/** TranslatedText 전체 필드(+tags)에 번체자 자동 간체화를 적용한다. 대응표에
 *  없는 글자는 건드리지 않는다 — 절대 추측 치환하지 않는다. */
function convertTraditionalToSimplified(value: TranslatedText): TranslatedText {
    return {
        ...value,
        name: convertTextTraditionalToSimplified(value.name),
        address: convertTextTraditionalToSimplified(value.address),
        description: convertTextTraditionalToSimplified(value.description),
        first_menu: convertTextTraditionalToSimplified(value.first_menu),
        treat_menu: convertTextTraditionalToSimplified(value.treat_menu),
        open_time: convertTextTraditionalToSimplified(value.open_time),
        rest_date: convertTextTraditionalToSimplified(value.rest_date),
        parking: convertTextTraditionalToSimplified(value.parking),
        packing: convertTextTraditionalToSimplified(value.packing),
        tags: value.tags ? value.tags.map((tag) => convertTextTraditionalToSimplified(tag) as string) : value.tags,
    };
}

function findTraditionalCharacterIssue(value: TranslatedText): string | null {
    const stringFields: Array<keyof Omit<TranslatedText, "tags">> = [
        "name", "address", "description", "first_menu", "treat_menu",
        "open_time", "rest_date", "parking", "packing",
    ];

    for (const key of stringFields) {
        const text = value[key];
        if (!text) continue;
        for (const ch of text) {
            const simplified = TRADITIONAL_CHARACTER_MAP[ch];
            if (simplified) {
                return `${String(key)}에 번체자("${ch}" → "${simplified}")가 포함되어 있습니다.`;
            }
        }
    }

    if (value.tags) {
        for (let i = 0; i < value.tags.length; i++) {
            const text = value.tags[i];
            for (const ch of text) {
                const simplified = TRADITIONAL_CHARACTER_MAP[ch];
                if (simplified) return `tags[${i}]에 번체자("${ch}" → "${simplified}")가 포함되어 있습니다.`;
            }
        }
    }

    return null;
}

// ── 괄호 균형 검증(요구사항 9 — 예: "百年老店]塞满浦面屋"처럼 여는 괄호 없이
// 닫는 괄호만 남는 사고 방지) ─────────────────────────────────────────────────
const BRACKET_PAIRS: Array<[string, string]> = [
    ["(", ")"], ["（", "）"], ["[", "]"], ["【", "】"],
];

function countOccurrences(text: string, ch: string): number {
    let count = 0;
    for (const c of text) if (c === ch) count++;
    return count;
}

function findBracketImbalanceIssue(value: TranslatedText): string | null {
    const stringFields: Array<keyof Omit<TranslatedText, "tags">> = [
        "name", "address", "description", "first_menu", "treat_menu",
        "open_time", "rest_date", "parking", "packing",
    ];

    for (const key of stringFields) {
        const text = value[key];
        if (!text) continue;
        for (const [open, close] of BRACKET_PAIRS) {
            if (countOccurrences(text, open) !== countOccurrences(text, close)) {
                return `${String(key)}의 괄호("${open}${close}")가 짝이 맞지 않습니다.`;
            }
        }
    }

    return null;
}

const GENERIC_BAD_NAMES = new Set([
    "韩国餐厅",
    "韩国料理店",
    "韩式餐厅",
    "餐厅",
    "韩国餐馆",
]);

function isGenericBadName(name: string | null): boolean {
    if (!name) return true;
    const compact = name.replace(/\s+/g, "").replace(/[（）()]/g, "");
    return GENERIC_BAD_NAMES.has(compact);
}

function sourceNullPatternMatches(
    source: KoTextRow,
    translated: TranslatedText,
): string | null {
    const keys: Array<keyof Omit<TranslatedText, "tags" | "description">> = [
        "name",
        "address",
        "first_menu",
        "treat_menu",
        "open_time",
        "rest_date",
        "parking",
        "packing",
    ];

    for (const key of keys) {
        const sourceValue = source[key];
        const translatedValue = translated[key];

        if (sourceValue === null && translatedValue !== null) {
            return `${String(key)}: 원문이 null인데 번역값이 생성되었습니다.`;
        }

        if (sourceValue !== null && translatedValue === null) {
            return `${String(key)}: 원문이 있는데 번역값이 null입니다.`;
        }
    }

    if (source.tags === null && translated.tags !== null) {
        return "tags: 원문이 null인데 번역값이 생성되었습니다.";
    }

    if (source.tags !== null && translated.tags === null) {
        return "tags: 원문이 있는데 번역값이 null입니다.";
    }

    return null;
}

function validateTranslatedText(
    source: KoTextRow,
    translated: TranslatedText,
): string | null {
    // ── 1) JSON/구조·null 정책 (hard validation, 요구사항 6) ──────────────────
    const nullPatternError = sourceNullPatternMatches(source, translated);
    if (nullPatternError) return nullPatternError;

    if (isGenericBadName(translated.name)) {
        return `name이 일반명("${translated.name ?? "null"}")으로 뭉개졌습니다.`;
    }

    // applyAutoRecovery() 대상이 아닌 필드(open_time/rest_date/tags)의 한글 잔존만
    // 여전히 hard failure다.
    const hangulField = containsHangulAnywhere(translated);
    if (hangulField) {
        return `${hangulField}에 한글이 남아 있습니다.`;
    }

    // ── 2) 숫자·시간·요일 (hard validation, 요구사항 6) ───────────────────────
    if (!hasSameNumberTokens(source.address, translated.address)) {
        return "address의 숫자가 원문과 다릅니다.";
    }

    if (!preservesTimeTokens(source.open_time, translated.open_time)) {
        return "open_time의 시간 숫자가 원문과 다릅니다.";
    }

    if (!preservesTimeTokens(source.rest_date, translated.rest_date)) {
        return "rest_date의 시간 숫자가 원문과 다릅니다.";
    }

    if (!preservesWeekdays(source.open_time, translated.open_time)) {
        return "open_time의 요일이 원문과 다릅니다.";
    }

    if (!preservesWeekdays(source.rest_date, translated.rest_date)) {
        return "rest_date의 요일이 원문과 다릅니다.";
    }

    if (
        translated.address &&
        (translated.address.includes("吉尔") || /\d吉/.test(translated.address))
    ) {
        return 'address에서 한국어 도로 접미사 "길"을 吉/吉尔로 잘못 번역했습니다.';
    }

    // ── 3) 서울/자치구 (hard validation, 요구사항 6 — 신규: 이전에는 주소 숫자만
    // 검사하고 자치구 표기 자체는 검사하지 않았다) ─────────────────────────────
    const districtError = validateFixedDistrictMapping(source, translated);
    if (districtError) return districtError;

    const cityError = validateSeoulCityMapping(source, translated);
    if (cityError) return cityError;

    // ── 4) 자동복구 이후에도 남은 한글 (방어선, 정상 동작 시 발생하지 않아야 함) ─
    const residualHangulError = findResidualHangulAfterRecovery(translated);
    if (residualHangulError) return residualHangulError;

    // ── 5) 저장 품질 보정 (요구사항 9: 번체자·괄호 불균형) ────────────────────
    const traditionalCharError = findTraditionalCharacterIssue(translated);
    if (traditionalCharError) return traditionalCharError;

    const bracketError = findBracketImbalanceIssue(translated);
    if (bracketError) return bracketError;

    return null;
}

function parseTranslatedText(raw: unknown): TranslatedText {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("Solar 응답이 JSON 객체가 아닙니다.");
    }

    const value = raw as Record<string, unknown>;
    const requiredKeys = [
        "name",
        "address",
        "description",
        "first_menu",
        "treat_menu",
        "open_time",
        "rest_date",
        "parking",
        "packing",
        "tags",
    ];

    for (const key of requiredKeys) {
        if (!(key in value)) {
            throw new Error(`Solar 응답에 ${key} 키가 없습니다.`);
        }
    }

    const stringOrNull = (key: string): string | null => {
        const item = value[key];
        if (item === null) return null;
        if (typeof item !== "string") {
            throw new Error(`Solar 응답의 ${key}가 문자열 또는 null이 아닙니다.`);
        }
        return normalizeNullableString(item);
    };

    if (
        value.tags !== null &&
        !(Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string"))
    ) {
        throw new Error("Solar 응답의 tags가 문자열 배열 또는 null이 아닙니다.");
    }

    return {
        name: stringOrNull("name"),
        address: stringOrNull("address"),
        description: stringOrNull("description"),
        first_menu: stringOrNull("first_menu"),
        treat_menu: stringOrNull("treat_menu"),
        open_time: stringOrNull("open_time"),
        rest_date: stringOrNull("rest_date"),
        parking: stringOrNull("parking"),
        packing: stringOrNull("packing"),
        tags: normalizeTags(value.tags),
    };
}

function buildOfficialStylePrompt(row: KoTextRow): string {
    return `你是为赴韩中文游客提供首尔餐厅信息的韩文→简体中文数据翻译器。

请把下面一条韩国餐厅数据库记录翻译成简体中文，并且只返回合法 JSON。
不得输出 Markdown、代码围栏、解释或 JSON 之外的文字。

【最重要：店名规则】
韩国观光公社官方简体中文数据的真实店名风格包括：
- 105405 마곡 → 105405麻谷
- 복이당 → Bokidang
- 부베트 본점 → Buvette 总店
- 캐롤스 본점 → Carols总店
- 인사도담 → Insa Dodam仁寺唠谈
- 모던눌랑 센트럴시티점 → Modern Nulang Central City店
- 만리지화 본점 → 万里之花 总店
- 인사동마늘보쌈 → 仁寺洞蒜蓉菜包肉
- 토속촌삼계탕 → 土俗村参鸡汤
- 런던베이글뮤지엄 안국 → LONDON BAGEL MUSEUM安国店
- 카페쁠레노 → Pleno咖啡厅
- 피터팬1978 → 彼得潘1978

必须遵守：
1. name 必须是这个店自身可区分的名称，不能统一写成“韩国餐厅”“韩式餐厅”“餐厅”等通用名称。
2. 已知英文/拉丁品牌名可保留，并可加“总店、店、咖啡厅”等简体中文分店或业态词。
3. 名称含明确可翻译的地区、菜品、业态时，可按官方数据风格翻译成简体中文。
4. 无法可靠确定汉字店名时，优先使用保守的拉丁字母音译/品牌写法；不得擅自创造看似正式但可能错误的汉字店名。
5. name 以及所有其他字段中不得保留韩文。
6. 不要把不同餐厅翻译成同一个通用名称。

【地址规则】
- 使用自然的中国地址顺序，保留所有数字。
- 首尔/서울特别市 → 首尔特别市，서울 → 首尔。
- 区名使用：钟路区、中区、龙山区、城东区、广津区、东大门区、中浪区、城北区、江北区、道峰区、芦原区、恩平区、西大门区、麻浦区、阳川区、江西区、九老区、衿川区、永登浦区、铜雀区、冠岳区、瑞草区、江南区、松坡区、江东区。
- “길”作为道路后缀时写“街”，绝对不能写“吉”或“吉尔”。
- 楼层写“楼”。无法可靠转换的专有道路词可使用稳定的拉丁字母音译。
- 原文中的每一个数字必须完整保留，不能新增或删除。

【菜品规则】
- 使用中国游客易懂且明确为韩国料理的简体中文名称。
- 常用固定翻译：
  김치찌개=韩国泡菜锅，된장찌개=韩式大酱汤，삼계탕=韩式参鸡汤，
  감자탕=韩式猪骨土豆汤，부대찌개=韩式部队锅，비빔밥=韩式拌饭，
  돌솥비빔밥=韩式石锅拌饭，불고기=韩式烤肉，삼겹살=韩式烤五花肉，
  보쌈=韩式菜包肉，족발=韩式酱猪蹄，떡볶이=韩式炒年糕，
  냉면=韩式冷面，칼국수=韩式刀切面，순대=韩式血肠，
  순대국=韩式血肠汤，짜장면/자장면=韩式炸酱面，
  짬뽕=韩式辣海鲜汤面，탕수육=韩式糖醋肉，한정식=韩式套餐。
- 不确定具体含义的自创菜名，不要硬猜成另一道具体中国菜；使用较保守的“韩国料理、韩式面食、韩式肉类料理、韩式海鲜料理、韩式汤类料理、韩式米饭料理”。
- first_menu/treat_menu 原文为 null 时必须返回 null；不为 null 时不得遗漏项目。

【其他字段】
- description：翻译原意，不新增“著名、传统、老字号、最受欢迎”等原文没有的事实。原文为空时可生成一句中性的完整中文说明。
- open_time/rest_date：时间与星期必须严格保持。연중무휴=全年无休，전화문의=请电话咨询。
- parking/packing：가능=可，불가능=不可，部分 가능=部分可。
- tags 常用：음식점=餐厅，사진 있음=有照片，위치 있음=有位置信息，메뉴 정보 있음=有菜单信息，주차 가능=可停车，포장 가능=可打包。
- 所有文字使用简体字，不使用繁体字。
- 原字段为 null 时，除 description 外必须返回 null。

【输入】
${JSON.stringify(
        {
            name: row.name,
            address: row.address,
            description: row.description,
            first_menu: row.first_menu,
            treat_menu: row.treat_menu,
            open_time: row.open_time,
            rest_date: row.rest_date,
            parking: row.parking,
            packing: row.packing,
            tags: row.tags,
        },
        null,
        2,
    )}

【严格输出结构】
{
  "name": string | null,
  "address": string | null,
  "description": string | null,
  "first_menu": string | null,
  "treat_menu": string | null,
  "open_time": string | null,
  "rest_date": string | null,
  "parking": string | null,
  "packing": string | null,
  "tags": string[] | null
}`;
}

function buildCorrectionPrompt(
    row: KoTextRow,
    previous: unknown,
    error: string,
): string {
    return `${buildOfficialStylePrompt(row)}

你刚才的输出未通过验证。

【上一版输出】
${JSON.stringify(previous, null, 2)}

【验证错误】
${error}

只修正导致验证失败的字段。仍然只返回完整 JSON，不得输出其他文字。`;
}

function extractUsage(data: any): TokenUsage {
    return {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
    };
}

async function callSolar(prompt: string): Promise<{
    raw: unknown;
    usage: TokenUsage;
}> {
    const apiKey = (Deno.env.get("SOLAR_API_KEY") ?? "").trim();

    if (!apiKey) {
        throw new Error("SOLAR_API_KEY가 설정되지 않았습니다.");
    }

    const response = await fetch("https://api.upstage.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "solar-pro",
            messages: [
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.15,
            response_format: {
                type: "json_object",
            },
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Solar API 오류: ${response.status} ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("Solar 응답 내용이 비어 있습니다.");
    }

    try {
        return {
            raw: JSON.parse(content),
            usage: extractUsage(data),
        };
    } catch {
        throw new Error(`Solar JSON 파싱 실패: ${content}`);
    }
}

/** Solar raw 출력을 파싱 → normalizeZh → applyAutoRecovery까지 한 번에
 *  처리한다. 두 번의 호출 시도(최초/보정 재시도)가 정확히 같은 순서로 처리되게
 *  하나로 통합했다. */
function normalizeAndRecover(row: KoTextRow, raw: unknown): TranslatedText {
    const parsed = parseTranslatedText(raw);
    parsed.name = normalizeZh(parsed.name);
    parsed.address = normalizeZh(parsed.address);
    parsed.description = normalizeZh(parsed.description);
    parsed.first_menu = normalizeZh(parsed.first_menu);
    parsed.treat_menu = normalizeZh(parsed.treat_menu);
    parsed.open_time = normalizeZh(parsed.open_time);
    parsed.rest_date = normalizeZh(parsed.rest_date);
    parsed.parking = normalizeZh(parsed.parking);
    parsed.packing = normalizeZh(parsed.packing);

    if (parsed.tags) {
        parsed.tags = parsed.tags.map(normalizeZh).filter(Boolean) as string[];
    }

    // 번체자 자동 간체화(요구사항 6)는 나머지 자동복구보다 먼저 적용한다 —
    // 이후 로직은 전부 이미 간체자로 정제된 텍스트를 기준으로 동작한다.
    const simplified = convertTraditionalToSimplified(parsed);

    // 자동복구(요구사항 1~5)는 모델 재호출 없이 이미 받은 값을 코드로 정제한다 —
    // validateTranslatedText()는 정제된 이 값을 기준으로 hard validation만 한다.
    return applyAutoRecovery(row, simplified);
}

async function translateWithSolar(row: KoTextRow): Promise<TranslationResult> {
    const firstAttempt = await callSolar(buildOfficialStylePrompt(row));
    let translated = normalizeAndRecover(row, firstAttempt.raw);
    let validationError = validateTranslatedText(row, translated);

    if (!validationError) {
        return {
            translated,
            provider: "solar",
            usage: firstAttempt.usage,
        };
    }

    const secondAttempt = await callSolar(
        buildCorrectionPrompt(row, firstAttempt.raw, validationError),
    );

    translated = normalizeAndRecover(row, secondAttempt.raw);
    validationError = validateTranslatedText(row, translated);

    if (validationError) {
        throw new Error(`보정 재시도 후에도 검증 실패: ${validationError}`);
    }

    return {
        translated,
        provider: "solar",
        usage: {
            promptTokens:
                firstAttempt.usage.promptTokens + secondAttempt.usage.promptTokens,
            completionTokens:
                firstAttempt.usage.completionTokens +
                secondAttempt.usage.completionTokens,
            totalTokens: firstAttempt.usage.totalTokens + secondAttempt.usage.totalTokens,
        },
    };
}

// ── 실패 분류 (요구사항 7) ────────────────────────────────────────────────────
// validateTranslatedText()/parseTranslatedText()가 던지는 한국어 에러 메시지를
// 보고 실패 원인을 버킷으로 분류한다. "숫자" 키워드를 "address" 키워드보다
// 먼저 검사해야 "address의 숫자가 원문과 다릅니다" 같은 메시지가 numberMismatch로
// 정확히 분류된다(둘 다 "address"라는 단어를 포함하기 때문).
interface FailureBreakdown {
    name: number;
    address: number;
    treat_menu: number;
    description: number;
    parking: number;
    numberMismatch: number;
    other: number;
}

function createEmptyFailureBreakdown(): FailureBreakdown {
    return {
        name: 0,
        address: 0,
        treat_menu: 0,
        description: 0,
        parking: 0,
        numberMismatch: 0,
        other: 0,
    };
}

function classifyFailureReason(message: string): keyof FailureBreakdown {
    if (message.includes("숫자")) return "numberMismatch";
    if (message.includes("name")) return "name";
    if (message.includes("address")) return "address";
    if (message.includes("treat_menu") || message.includes("first_menu") || message.includes("메뉴")) {
        return "treat_menu";
    }
    if (message.includes("description")) return "description";
    if (message.includes("parking") || message.includes("packing")) return "parking";
    return "other";
}

async function fetchUntranslatedKoRows(
    supabase: any,
    limit: number,
    startAfterPlaceId: number | null,
): Promise<KoTextRow[]> {
    const selected: KoTextRow[] = [];

    for (let from = 0; selected.length < limit; from += KO_PAGE_SIZE) {
        let koQuery = supabase
            .from("mg_place_texts")
            .select(
                "place_id, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags",
            )
            .eq("locale", SOURCE_LOCALE);

        // 여기 건너뛰기:
        // startAfterPlaceId보다 큰 place_id만 조회한다.
        if (startAfterPlaceId !== null) {
            koQuery = koQuery.gt("place_id", startAfterPlaceId);
        }

        const { data: koPage, error: koError } = await koQuery
            .order("place_id", { ascending: true })
            .range(from, from + KO_PAGE_SIZE - 1);

        if (koError) throw koError;
        if (!koPage || koPage.length === 0) break;

        const placeIds = koPage.map((row: KoTextRow) => row.place_id);

        const { data: existingRows, error: existingError } = await supabase
            .from("mg_place_texts")
            .select("place_id")
            .eq("locale", TARGET_LOCALE)
            .in("place_id", placeIds);

        if (existingError) throw existingError;

        const existingSet = new Set<number>(
            (existingRows ?? []).map((row: { place_id: number }) => row.place_id),
        );

        for (const row of koPage as KoTextRow[]) {
            if (!existingSet.has(row.place_id)) {
                selected.push(row);

                if (selected.length >= limit) {
                    break;
                }
            }
        }

        if (koPage.length < KO_PAGE_SIZE) break;
    }

    return selected;
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
            return jsonResponse(
                { error: "ADMIN_SEED_TOKEN이 설정되지 않았습니다." },
                500,
            );
        }

        if (!adminToken || adminToken !== expectedToken) {
            return jsonResponse({ error: "권한이 없습니다." }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const requestedLimit = Number(body.limit ?? DEFAULT_LIMIT);
        const dryRun = body.dryRun !== false;

        // 여기 건너뛰기:
        // 값이 없으면 기존처럼 처음부터 조회한다.
        const startAfterPlaceId =
            body.startAfterPlaceId === undefined ||
                body.startAfterPlaceId === null
                ? null
                : Number(body.startAfterPlaceId);

        if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
            return jsonResponse(
                { error: "limit은 1 이상의 정수여야 합니다." },
                400,
            );
        }

        if (
            startAfterPlaceId !== null &&
            (!Number.isInteger(startAfterPlaceId) || startAfterPlaceId < 0)
        ) {
            return jsonResponse(
                { error: "startAfterPlaceId는 0 이상의 정수여야 합니다." },
                400,
            );
        }

        const limit = Math.min(requestedLimit, MAX_LIMIT);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse(
                {
                    error:
                        "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.",
                },
                500,
            );
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
            },
        });

        const koRows = await fetchUntranslatedKoRows(
            supabase,
            limit,
            startAfterPlaceId,
        );

        if (koRows.length === 0) {
            return jsonResponse({
                message: dryRun
                    ? "중국어 미번역 데이터가 없습니다. 미리보기 종료"
                    : "중국어 미번역 데이터가 없습니다.",
                dryRun,
                requestedLimit: limit,
                requestedCount: 0,
                translatedCount: 0,
                savedCount: 0,
                skippedCount: 0,
                failedCount: 0,
                failureBreakdown: createEmptyFailureBreakdown(),
                usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    byProvider: {
                        solar: {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                        },
                    },
                },
                results: [],
            });
        }

        const results: Array<{
            placeId: number;
            koName: string | null;
            zhName: string | null;
            provider: Provider | null;
            status: "preview" | "saved" | "skipped" | "failed";
            error: string | null;
            translated?: TranslatedText;
        }> = [];

        let translatedCount = 0;
        let savedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const failureBreakdown = createEmptyFailureBreakdown();

        const usage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        for (const row of koRows) {
            try {
                const translation = await translateWithSolar(row);

                usage.promptTokens += translation.usage.promptTokens;
                usage.completionTokens += translation.usage.completionTokens;
                usage.totalTokens += translation.usage.totalTokens;
                translatedCount++;

                if (dryRun) {
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        zhName: translation.translated.name,
                        provider: translation.provider,
                        status: "preview",
                        error: null,
                        translated: translation.translated,
                    });
                    continue;
                }

                const { data: existingZh, error: existingCheckError } = await supabase
                    .from("mg_place_texts")
                    .select("id, translation_status")
                    .eq("place_id", row.place_id)
                    .eq("locale", TARGET_LOCALE)
                    .maybeSingle();

                if (existingCheckError) throw existingCheckError;

                if (existingZh) {
                    skippedCount++;
                    results.push({
                        placeId: row.place_id,
                        koName: row.name,
                        zhName: translation.translated.name,
                        provider: translation.provider,
                        status: "skipped",
                        error: `zh-CN 데이터가 이미 존재합니다(${existingZh.translation_status ?? "unknown"}).`,
                    });
                    continue;
                }

                const { error: insertError } = await supabase
                    .from("mg_place_texts")
                    .insert({
                        place_id: row.place_id,
                        locale: TARGET_LOCALE,
                        name: translation.translated.name,
                        address: translation.translated.address,
                        description: translation.translated.description,
                        first_menu: translation.translated.first_menu,
                        treat_menu: translation.translated.treat_menu,
                        open_time: translation.translated.open_time,
                        rest_date: translation.translated.rest_date,
                        parking: translation.translated.parking,
                        packing: translation.translated.packing,
                        tags: translation.translated.tags,
                        translation_status: "machine",
                        translation_provider: "solar",
                        translated_from_locale: SOURCE_LOCALE,
                    });

                if (insertError) {
                    if (insertError.code === POSTGRES_UNIQUE_VIOLATION) {
                        skippedCount++;
                        results.push({
                            placeId: row.place_id,
                            koName: row.name,
                            zhName: translation.translated.name,
                            provider: translation.provider,
                            status: "skipped",
                            error: "동시에 생성된 zh-CN 데이터가 있어 건너뛰었습니다.",
                        });
                        continue;
                    }

                    throw insertError;
                }

                savedCount++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    zhName: translation.translated.name,
                    provider: translation.provider,
                    status: "saved",
                    error: null,
                });
            } catch (error) {
                failedCount++;
                const errorMessage = getErrorMessage(error);
                failureBreakdown[classifyFailureReason(errorMessage)]++;
                results.push({
                    placeId: row.place_id,
                    koName: row.name,
                    zhName: null,
                    provider: null,
                    status: "failed",
                    error: errorMessage,
                });
            }
        }

        return jsonResponse({
            message: dryRun
                ? "공식 TourAPI 표현 규칙 기반 중문간체 번역 미리보기 완료"
                : "공식 TourAPI 표현 규칙 기반 중문간체 번역 적재 완료",
            dryRun,
            startAfterPlaceId,
            requestedLimit: limit,
            requestedCount: koRows.length,
            translatedCount,
            savedCount,
            skippedCount,
            failedCount,
            failureBreakdown,
            usage: {
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                byProvider: {
                    solar: usage,
                },
            },
            results,
        });
    } catch (error) {
        return jsonResponse({ error: getErrorMessage(error) }, 500);
    }
});