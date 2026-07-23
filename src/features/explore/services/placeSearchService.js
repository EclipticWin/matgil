import { PRESET_LOCATIONS, calcDistanceKm } from '../data/locations.js';
import { SEOUL_DISTRICT_EN } from '../data/seoulDistricts.js';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';
import { findAnchorPlace } from './anchorMatchService.js';

const MAX_INTERNAL_RESULTS = 5;
const MIN_INTERNAL_QUERY_LENGTH = 2;
const PRESET_DEDUPE_RADIUS_KM = 0.3;

/** Comparison-only normalization — never used for anything the user sees.
 *  Matches the exact style anchorMatchService.js already uses for name
 *  comparison (strip all whitespace, lowercase) so preset/internal-place
 *  matching stays consistent with the existing Kakao-anchor matching rules
 *  instead of inventing a second normalization convention. */
export function normalizeSearchText(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

/** exact > prefix > contains, 0 = no match. */
function scoreTermMatch(term, normalizedQuery) {
  if (!normalizedQuery) return 0;
  const normTerm = normalizeSearchText(term);
  if (!normTerm) return 0;
  if (normTerm === normalizedQuery) return 3;
  if (normTerm.startsWith(normalizedQuery)) return 2;
  if (normTerm.includes(normalizedQuery)) return 1;
  return 0;
}

/** label/labelKo/labelZh are always search terms; `aliases` (search-only —
 *  never shown, never used for the course title or saved-course anchor name)
 *  adds terms like "잠실역"/"Jamsil Station" that differ from the display name. */
export function getPresetSearchTerms(preset) {
  return [preset.label, preset.labelKo, preset.labelZh, ...(preset.aliases ?? [])].filter(Boolean);
}

/** All PRESET_LOCATIONS are searchable the same way — no per-key special-casing,
 *  so any future preset just needs label/labelKo/labelZh (+ optional aliases) to
 *  be found. Sorted exact > prefix > contains; ties keep PRESET_LOCATIONS' own
 *  order (stable sort, index tie-break only). */
export function searchPresets(query, presets = PRESET_LOCATIONS) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  return presets
    .map((preset, index) => ({
      preset,
      index,
      score: Math.max(0, ...getPresetSearchTerms(preset).map((term) => scoreTermMatch(term, normalizedQuery))),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map((entry) => entry.preset);
}

/** Name-only (place.name / place.nameKo) — description/tags/menu are out of
 *  scope for this pass. A minimum query length avoids flooding the list from a
 *  single character against ~1,633 places; PRESET_LOCATIONS has no such guard
 *  since it's a list of 12. Capped at MAX_INTERNAL_RESULTS, exact/prefix ranked
 *  above plain substring matches, ties broken by place id for a stable order. */
export function searchInternalPlaces(query, places = []) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < MIN_INTERNAL_QUERY_LENGTH) return [];
  const scored = [];
  for (const place of places) {
    if (!place?.name) continue;
    if (place.latitude == null || place.longitude == null) continue;
    const score = Math.max(
      scoreTermMatch(place.name, normalizedQuery),
      scoreTermMatch(place.nameKo, normalizedQuery),
    );
    if (score > 0) scored.push({ place, score });
  }
  return scored
    .sort((a, b) => (b.score - a.score) || (a.place.id - b.place.id))
    .slice(0, MAX_INTERNAL_RESULTS)
    .map((entry) => entry.place);
}

/** Kakao result vs. one preset: EXACT name match (same terms as searchPresets(),
 *  so a Kakao result named exactly like a preset counts) AND within ~300m.
 *  Deliberately not a substring check either direction — "광장시장" would
 *  otherwise swallow every real, distinct Kakao result that merely contains it
 *  ("광장시장 동문", "광장시장 전골목", ...), and "잠실역" would swallow "잠실역
 *  2호선"/"잠실역 8호선", which the user must be able to pick between. Distance
 *  alone would still risk conflating an unrelated place that happens to be
 *  nearby, so both conditions stay required. */
function kakaoMatchesPreset(kakaoResult, preset) {
  const kakaoName = normalizeSearchText(kakaoResult.place_name);
  if (!kakaoName) return false;
  const nameMatches = getPresetSearchTerms(preset).some((term) => normalizeSearchText(term) === kakaoName);
  if (!nameMatches) return false;
  const kakaoLat = Number(kakaoResult.y);
  const kakaoLng = Number(kakaoResult.x);
  if (!Number.isFinite(kakaoLat) || !Number.isFinite(kakaoLng)) return false;
  return calcDistanceKm(kakaoLat, kakaoLng, preset.lat, preset.lng) <= PRESET_DEDUPE_RADIUS_KM;
}

// Kakao query conversion only — deliberately separate from and more conservative
// than searchPresets()'s exact>prefix>contains display ranking (§4 of this pass).
// A query must reach this length before it's even considered a candidate prefix,
// so a stray first keystroke ("g", "광") never redirects Kakao. CJK gets a
// shorter floor than Latin/digits since two Hangul/Hanzi characters already
// carry as much disambiguating signal as three Latin ones.
const MIN_LATIN_KEYWORD_LENGTH = 3;
const MIN_CJK_KEYWORD_LENGTH = 2;
const CJK_CHAR_PATTERN = /[぀-ヿ㐀-䶿一-鿿가-힣豈-﫿]/;

function meetsMinimumKeywordLength(normalizedQuery) {
  if (!normalizedQuery) return false;
  const minLength = CJK_CHAR_PATTERN.test(normalizedQuery) ? MIN_CJK_KEYWORD_LENGTH : MIN_LATIN_KEYWORD_LENGTH;
  return normalizedQuery.length >= minLength;
}

/** Every preset with at least one search term (label/labelKo/labelZh/aliases)
 *  whose normalized form passes `predicate` against normalizedQuery — deduped to
 *  one entry per preset (a preset matching through two of its own terms, e.g.
 *  both its label and an alias, is not two candidates). */
function findPresetsByTermPredicate(normalizedQuery, predicate) {
  const matched = new Set();
  for (const preset of PRESET_LOCATIONS) {
    if (getPresetSearchTerms(preset).some((term) => predicate(normalizeSearchText(term), normalizedQuery))) {
      matched.add(preset);
    }
  }
  return [...matched];
}

/** Chooses the Korean keyword actually sent to Kakao — kakaoPlaceSearchService.js
 *  is called with whatever this returns, never the user's raw input directly.
 *  Kakao can't parse a zh-CN query at all (docs/47), and even for ko/en a
 *  preset's dedicated keyword can search better than its bare display name
 *  (e.g. "잠실역" surfaces the station/exits/facilities the user actually wants,
 *  where "잠실" alone is too generic).
 *
 *  Matches on a PREFIX of one of the preset's own search terms (exact match is
 *  just the prefix-equals-the-whole-term case, so it's covered by the same
 *  check) — this is what lets "gwangja" or "广藏市" redirect Kakao before the
 *  user finishes typing "Gwangjang"/"广藏市场", without waiting for a full
 *  match like the previous version of this function required. Still never a
 *  plain substring/contains check either direction ("시장" inside "광장시장",
 *  or "역" prefix-matching "잠실역" from the wrong end) — those would redirect
 *  an unrelated, more generic search into one specific preset's keyword.
 *
 *  Two independent guards keep this conservative:
 *  - meetsMinimumKeywordLength() — a query shorter than the floor never even
 *    becomes a candidate prefix (see its own doc comment for the thresholds).
 *  - Exact matches are checked before prefix matches, and each tier only fires
 *    when it resolves to exactly ONE preset. Ambiguous either way ("seo" is a
 *    prefix of both "Seongsu" and "Seoul City Hall") returns the original query
 *    untouched rather than guessing.
 *
 *  Falls back to the preset's labelKo when it has no kakaoSearchKeyword of its
 *  own. Never changes what the user sees in the search box or in the preset
 *  result card — those always use the original query / preset.label/labelKo/labelZh. */
export function resolveKakaoSearchKeyword(query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!meetsMinimumKeywordLength(normalizedQuery)) return query;

  const exactMatches = findPresetsByTermPredicate(normalizedQuery, (term, q) => term === q);
  if (exactMatches.length === 1) return exactMatches[0].kakaoSearchKeyword ?? exactMatches[0].labelKo ?? query;
  if (exactMatches.length > 1) return query;

  const prefixMatches = findPresetsByTermPredicate(normalizedQuery, (term, q) => term.startsWith(q));
  if (prefixMatches.length === 1) return prefixMatches[0].kakaoSearchKeyword ?? prefixMatches[0].labelKo ?? query;

  return query;
}

/** The one Kakao result (if any) that IS the preset itself, by the same
 *  exact-name + 300m rule kakaoMatchesPreset() uses for dedupe — reused here so
 *  the preset card can borrow that result's address before the duplicate row
 *  gets dropped below. */
function findPresetRepresentative(preset, kakaoResults) {
  return kakaoResults.find((r) => kakaoMatchesPreset(r, preset)) ?? null;
}

/** Every preset's stable, always-available district — used only as a search-result
 *  address fallback (never the preset name, course title, or saved-course anchor
 *  name). ko: "서울 {districtKo}". en/zh-CN reuse the same SEOUL_DISTRICT_EN table
 *  (and English wording) formatSeoulDistrictAddress() already uses for every other
 *  unmatched Kakao result — no new zh-CN district translation table. null only if
 *  a preset has no districtKo or the district isn't in SEOUL_DISTRICT_EN, neither
 *  of which happens for any of the current 12 presets. */
function formatPresetFallbackAddress(preset, locale) {
  if (!preset.districtKo) return null;
  if (locale === 'ko') return `서울 ${preset.districtKo}`;
  const districtEn = SEOUL_DISTRICT_EN[preset.districtKo];
  return districtEn ? `Seoul · ${districtEn}` : null;
}

/** Priority: an exact-name + 300m Kakao representative's own (locale-formatted)
 *  address when one exists (unchanged from before this pass — a preset with a
 *  precise Kakao match, like Gwangjang Market, still gets its road-name address
 *  in ko); otherwise the preset's own district (formatPresetFallbackAddress()),
 *  so an address-type preset with no exact Kakao counterpart (Seongsu, Jongno,
 *  Hongdae, Gangnam, ...) never shows a blank address just because Kakao only
 *  returns related-but-differently-named results ("성수역 2호선", "잠실역 8호선",
 *  ...) — those are correctly NOT treated as the preset's own address (that
 *  would need loosening the exact-match representative search back into a
 *  substring match, which stays out of scope here). */
function resolvePresetDisplayAddress(preset, kakaoResults, locale) {
  const representative = findPresetRepresentative(preset, kakaoResults);
  if (representative) {
    const rawAddress = representative.road_address_name || representative.address_name;
    if (rawAddress) return locale === 'ko' ? rawAddress : formatSeoulDistrictAddress(rawAddress);
  }
  return formatPresetFallbackAddress(preset, locale);
}

/** Kakao is always queried with the raw Korean keyword the user typed (see
 *  kakaoPlaceSearchService.js) and only ever returns Korean place names — making
 *  it understand a non-Korean query is out of scope (docs/47). For a result that
 *  doesn't match an internal place, the name stays raw Korean and the address
 *  falls back to this English "Seoul · District" abbreviation for en AND zh-CN
 *  alike — an accepted, already-documented exception (docs/47), not something
 *  this pass changes. Moved here (was inline in SearchOverlay.jsx) purely so the
 *  merge step that needs it doesn't reach back into the component. */
function formatSeoulDistrictAddress(addressStr) {
  if (!addressStr) return null;
  if (!addressStr.includes('서울')) return addressStr;
  const match = addressStr.match(/([가-힣]+구)/);
  if (!match) return 'Seoul';
  const districtEn = SEOUL_DISTRICT_EN[match[1]];
  if (!districtEn) return addressStr;
  return `Seoul · ${districtEn}`;
}

/** Single entry point SearchOverlay calls: merges preset + internal-DB-place +
 *  Kakao results into one normalized, deduped, already-locale-displayed list, in
 *  priority order (preset > internal-place > kakao). Each entry:
 *  { resultType, id, displayName, displayAddress, lat, lng, raw, internalPlaceId?, presetKey?, matchedNameKo? }
 *  `raw` keeps a reference (not a copy) to the original preset/place/kakao object
 *  for whatever a resultType-specific click handler still needs from it. */
export function buildMergedSearchResults({ query, locale, places = [], kakaoResults = [] }) {
  const presetMatches = searchPresets(query);
  const presetResults = presetMatches.map((preset) => ({
    resultType: 'preset',
    id: `preset:${preset.key}`,
    presetKey: preset.key,
    displayName: pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label,
    displayAddress: resolvePresetDisplayAddress(preset, kakaoResults, locale),
    lat: preset.lat,
    lng: preset.lng,
    raw: preset,
  }));

  const internalMatches = searchInternalPlaces(query, places);
  const internalResults = internalMatches.map((place) => ({
    resultType: 'internal-place',
    id: `internal:${place.id}`,
    internalPlaceId: place.id,
    displayName: place.name,
    displayAddress: place.address ?? null,
    lat: place.latitude,
    lng: place.longitude,
    raw: place,
  }));

  // Only dedupe against presets/places actually shown for THIS query — a preset
  // or internal place that didn't match the query text has nothing on screen to
  // duplicate, so a Kakao result for it (if the query happened to surface one
  // unrelated to that preset/place) is left alone rather than silently dropped.
  const usedInternalIds = new Set(internalResults.map((r) => r.internalPlaceId));

  const kakaoResultsNormalized = [];
  for (const r of kakaoResults) {
    const dupPreset = presetMatches.find((preset) => kakaoMatchesPreset(r, preset));
    if (dupPreset) continue;

    // Applied to every Kakao result regardless of locale (previously gated to
    // non-Korean locales only) — matching now also drives which internal place
    // becomes the anchor on click, which is just as useful in ko as elsewhere.
    const matched = findAnchorPlace(r, places);
    if (matched && usedInternalIds.has(matched.id)) continue;

    const displayName = matched ? matched.name : r.place_name;
    const displayAddress = matched
      ? (matched.address ?? null)
      : locale === 'ko'
        ? (r.road_address_name || r.address_name)
        : formatSeoulDistrictAddress(r.address_name || r.road_address_name);

    kakaoResultsNormalized.push({
      resultType: 'kakao',
      id: `kakao:${r.id}`,
      internalPlaceId: matched ? matched.id : undefined,
      matchedNameKo: matched ? matched.nameKo : undefined,
      displayName,
      displayAddress,
      lat: Number(r.y),
      lng: Number(r.x),
      raw: r,
    });
  }

  return [...presetResults, ...internalResults, ...kakaoResultsNormalized];
}
