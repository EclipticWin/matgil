/** Seoul district (구) Korean → English name map. Shared by SearchOverlay (address
 *  preview for EN search results) and courseDisplay (EN display of a reverse-geocoded
 *  anchor district) so the two don't maintain separate copies. */
export const SEOUL_DISTRICT_EN = {
  강남구: 'Gangnam-gu',   강동구: 'Gangdong-gu',  강북구: 'Gangbuk-gu',
  강서구: 'Gangseo-gu',   관악구: 'Gwanak-gu',    광진구: 'Gwangjin-gu',
  구로구: 'Guro-gu',      금천구: 'Geumcheon-gu', 노원구: 'Nowon-gu',
  도봉구: 'Dobong-gu',    동대문구: 'Dongdaemun-gu', 동작구: 'Dongjak-gu',
  마포구: 'Mapo-gu',      서대문구: 'Seodaemun-gu', 서초구: 'Seocho-gu',
  성동구: 'Seongdong-gu', 성북구: 'Seongbuk-gu',  송파구: 'Songpa-gu',
  양천구: 'Yangcheon-gu', 영등포구: 'Yeongdeungpo-gu', 용산구: 'Yongsan-gu',
  은평구: 'Eunpyeong-gu', 종로구: 'Jongno-gu',   중구: 'Jung-gu',
  중랑구: 'Jungnang-gu',
};

/** Best-effort district name localization: returns the English name when known,
 *  otherwise the original Korean string unchanged (never guesses/mistranslates). */
export function translateSeoulDistrict(districtKo) {
  if (!districtKo) return districtKo;
  return SEOUL_DISTRICT_EN[districtKo] ?? districtKo;
}

/** Pulls a "OO구" district name out of a Korean address string (same regex
 *  SearchOverlay already used inline for its own EN address preview). Used to
 *  derive a course-title-sized area for anchor_type='search' saves, which don't get
 *  their own reverseGeocodeCoords() call (they already have a road/jibun address
 *  from the Kakao Places search result — see savedCourseService.js's
 *  buildAnchorFields()). Returns null when no "구" segment is found (non-Seoul
 *  address, unusual format, ...) rather than guessing. */
export function extractDistrictKo(address) {
  if (!address) return null;
  const match = address.match(/([가-힣]+구)/);
  return match ? match[1] : null;
}

// ─── Korean → English address formatting ──────────────────────────────────────
//
// formatKoreanAddressToEnglish() converts a Kakao-style Seoul address string
// (jibun or road-name) into a best-effort English form — used so an English
// screen can show the actual address instead of collapsing straight to a
// district-level fallback (see courseDisplay.js's getAnchorDisplayLocation()).
// This is NOT a translation: it's mechanical Revised Romanization (표준 로마자
// 표기법) applied to a syllable, plus the existing SEOUL_DISTRICT_EN table for the
// district. No cross-syllable pronunciation assimilation is applied (e.g. "종로"
// stays "Jong-ro", not the phonetically-assimilated "Jongno") — that's out of
// scope for this project's "safe subset" (see module doc below).

const CITY_EN = 'Seoul';
const CITY_KO_PATTERN = /^(서울특별시|서울)\s*/;

// Revised Romanization jamo tables, in the exact order Unicode's Hangul Syllable
// decomposition uses: code - 0xAC00 = (initial * 21 + medial) * 28 + final.
const ROMAN_INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const ROMAN_MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const ROMAN_FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

const HANGUL_SYLLABLE_FIRST = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;

/** Decomposes one precomposed Hangul syllable into its Revised-Romanization
 *  spelling via the standard jamo tables. Returns null for any character that
 *  isn't a precomposed Hangul syllable (so callers can bail out cleanly instead of
 *  emitting a half-romanized string) — not a general Unicode/Hangul-Jamo-block
 *  decomposer, just enough for the syllable blocks Korean address text uses. */
function romanizeSyllable(char) {
  const code = char.codePointAt(0);
  if (code < HANGUL_SYLLABLE_FIRST || code > HANGUL_SYLLABLE_LAST) return null;
  const offset = code - HANGUL_SYLLABLE_FIRST;
  const initial = Math.floor(offset / (21 * 28));
  const medial = Math.floor((offset % (21 * 28)) / 28);
  const final = offset % 28;
  return `${ROMAN_INITIALS[initial]}${ROMAN_MEDIALS[medial]}${ROMAN_FINALS[final]}`;
}

/** Romanizes a bare Korean word (a street/neighborhood name stem with no manual
 *  entry in SEOUL_DISTRICT_EN) syllable-by-syllable, capitalizing only the first
 *  letter of the result (a proper-noun stem, not per-syllable). Returns null if any
 *  character isn't a precomposed Hangul syllable. */
function romanizeWord(word) {
  let result = '';
  for (const char of word) {
    const syllable = romanizeSyllable(char);
    if (syllable === null) return null;
    result += syllable;
  }
  if (!result) return null;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Longest suffix first — "대로" ends in "로" too, so it must be tried before it.
const ADDRESS_UNIT_SUFFIXES = [
  ['대로', 'daero'],
  ['로', 'ro'],
  ['길', 'gil'],
  ['동', 'dong'],
];

/** Romanizes one Korean address "unit" token — the segment between the district
 *  and the building/lot number (a dong name, or a road/street name) — using
 *  suffix-based tokenization per the project's address-formatting rule (never a
 *  blind trailing-character swap): strip a known administrative/road suffix
 *  (동/로/길/대로), romanize the stem, then rejoin as "{Stem}-{suffix}".
 *  Also handles the "OO로NN길" numbered-side-street pattern common in the road-name
 *  address system (e.g. 수표로28길 -> "Supyo-ro 28-gil").
 *  Returns null when the token doesn't end in any supported suffix, or its stem
 *  contains anything romanizeWord() can't handle — the caller falls back to a
 *  district-level label rather than show a partially-wrong result. */
function romanizeAddressUnit(token) {
  const sideStreet = token.match(/^(.+로)(\d+)길$/);
  if (sideStreet) {
    const roadEn = romanizeAddressUnit(sideStreet[1]);
    if (!roadEn) return null;
    return `${roadEn} ${sideStreet[2]}-gil`;
  }

  for (const [suffixKo, suffixEn] of ADDRESS_UNIT_SUFFIXES) {
    if (token.endsWith(suffixKo)) {
      const stemEn = romanizeWord(token.slice(0, -suffixKo.length));
      if (!stemEn) return null;
      return `${stemEn}-${suffixEn}`;
    }
  }
  return null;
}

/**
 * Converts a Kakao-style Korean address string into a best-effort English form —
 * Seoul addresses only (this project has no data for other regions). Returns
 * `null` when any part can't be confidently parsed; callers must fall back to a
 * district-level label (see courseDisplay.js's getAnchorDisplayLocation()) rather
 * than accept a partial/guessed result — this function never emits one.
 *
 * Supported shapes:
 *   "서울 영등포구 신길동 4936"              -> "4936, Singil-dong, Yeongdeungpo-gu, Seoul"       (jibun)
 *   "서울특별시 종로구 종로 19"              -> "19, Jong-ro, Jongno-gu, Seoul"                    (road-name)
 *   "서울특별시 중구 세종대로 110"           -> "110, Sejong-daero, Jung-gu, Seoul"                (road-name, 대로)
 *   "서울특별시 종로구 수표로28길 33-5"      -> "33-5, Supyo-ro 28-gil, Jongno-gu, Seoul"          (numbered side-street)
 *
 * Not supported (returns null): non-Seoul addresses, an unmapped district, jibun
 * "가"-numbered dong units (e.g. "신문로1가"), any unit token that doesn't end in
 * 동/로/길/대로, or a building/lot number in an unexpected shape.
 */
export function formatKoreanAddressToEnglish(address) {
  if (!address) return null;

  const cityMatch = address.match(CITY_KO_PATTERN);
  if (!cityMatch) return null;
  const rest = address.slice(cityMatch[0].length).trim();

  const districtMatch = rest.match(/^([가-힣]+구)\s*/);
  if (!districtMatch) return null;
  const districtEn = SEOUL_DISTRICT_EN[districtMatch[1]];
  if (!districtEn) return null; // unmapped district — don't guess

  const remainder = rest.slice(districtMatch[0].length).trim();
  const tokens = remainder.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const number = tokens[tokens.length - 1];
  if (!/^\d+(-\d+)?$/.test(number)) return null;

  const unitEn = romanizeAddressUnit(tokens.slice(0, -1).join(' '));
  if (!unitEn) return null;

  return `${number}, ${unitEn}, ${districtEn}, ${CITY_EN}`;
}
