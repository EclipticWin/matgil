import { PRESET_LOCATIONS } from '../../explore/data/locations.js';
import { translateSeoulDistrict, extractDistrictKo, formatKoreanAddressToEnglish } from '../../explore/data/seoulDistricts.js';

/**
 * Returns a short distance string for a course stop.
 * e.g. "250 m" or "1.4 km". Returns null when distanceKm is unavailable.
 * Falls back to stop.address if present.
 */
export function formatStopDistance(stop) {
  if (stop.distanceKm != null) {
    return stop.distanceKm < 1
      ? `${Math.round(stop.distanceKm * 1000)} m`
      : `${stop.distanceKm.toFixed(1)} km`;
  }
  return stop.address ?? null;
}

/** True when a fetchPlaceReviewStatsBatch()/fetchPlaceReviewStats() row has at
 *  least one active review with a usable average (mg_place_review_stats has no
 *  row at all for places with zero reviews — stats is undefined/null in that case). */
function hasUsableRating(stats) {
  return !!stats && Number(stats.rating_count) > 0 && stats.rating_avg != null;
}

/** "★ 4.6 (2) · ♥ 3" (or "{noRatingsLabel} · ♥ 3" with no reviews) — the rating+save-count
 *  head of a place's stats line. Distance is intentionally NOT part of this string: callers
 *  render it as a separate flex item (see formatStopDistance) so it can wrap to its own line
 *  on very narrow screens without truncating the rating/save-count part.
 *  `stats` is the row this place's id maps to in fetchPlaceReviewStatsBatch()'s result Map
 *  (or undefined — no reviews yet). `saveCount` is this place's mg_place_bookmark_stats
 *  save_count (or undefined/0 — no bookmarks yet; always shown, including "♥ 0"). */
export function formatPlaceRatingSaveLine(stats, saveCount, noRatingsLabel) {
  const ratingPart = hasUsableRating(stats)
    ? `★ ${Number(stats.rating_avg).toFixed(1)} (${stats.rating_count})`
    : noRatingsLabel;
  return `${ratingPart} · ♥ ${saveCount ?? 0}`;
}

/** Single source of truth for a course stop's full stats line, split into two
 *  renderable parts so callers can still wrap `distance` onto its own row on very
 *  narrow screens (see docs/42 §4) without losing the "·" separator in the common
 *  (single-line) case — see docs/44 for the bug this fixed. Every screen that shows
 *  this line should call this function instead of gluing formatPlaceRatingSaveLine()
 *  and formatStopDistance() together with a bare flex gap (which produces no visible
 *  separator character between them).
 *  - `head`: formatPlaceRatingSaveLine()'s result, e.g. "★ 4.6 (2) · ♥ 3"
 *  - `distance`: "· 241 m" (separator included) or null when there's nothing to show */
export function formatStopStatsParts(stop, stats, saveCount, noRatingsLabel) {
  const head = formatPlaceRatingSaveLine(stats, saveCount, noRatingsLabel);
  const distance = formatStopDistance(stop);
  return { head, distance: distance ? `· ${distance}` : null };
}

const ANCHOR_LABEL_KO = {
  'Selected area': '선택한 지역',
  'Current location': '현재 위치',
};

const KO_TITLE_TEMPLATES = {
  cafeAndBites: (loc) => `${loc} 카페 & 맛집`,
  streetFood:   (loc) => `${loc} 길거리 음식 탐방`,
  bbq:          (loc) => `${loc} 고기 구이 동선`,
  noodle:       (loc) => `${loc} 면 요리 동선`,
  default:      (loc) => `${loc} 맛집 동선`,
};

const EN_TITLE_TEMPLATES = {
  cafeAndBites: (loc) => `${loc} Cafe & Bites`,
  streetFood:   (loc) => `${loc} Street Food Tour`,
  bbq:          (loc) => `${loc} Korean BBQ Route`,
  noodle:       (loc) => `${loc} Noodle Walk`,
  default:      (loc) => `${loc} Food Walk`,
};

function detectTitleType(stops) {
  const allCats = (stops ?? []).flatMap((s) => s.matgilCategoryKeys ?? []);
  const hasCafe = allCats.includes('cafe');
  const hasNonCafe = (stops ?? []).some((s) =>
    (s.matgilCategoryKeys ?? []).some((k) => k !== 'cafe' && k !== 'other'),
  );
  if (hasCafe && hasNonCafe) return 'cafeAndBites';
  const mealCats = allCats.filter((k) => k !== 'cafe' && k !== 'other');
  const freq = {};
  for (const cat of mealCats) freq[cat] = (freq[cat] ?? 0) + 1;
  const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant === 'street') return 'streetFood';
  if (dominant === 'bbq') return 'bbq';
  if (dominant === 'noodle') return 'noodle';
  return 'default';
}

export function getLocalizedLocationLabel(anchorLabel, locale) {
  if (!anchorLabel) return locale === 'ko' ? '선택한 지역' : 'Selected area';
  if (locale !== 'ko') return anchorLabel;
  const preset = PRESET_LOCATIONS.find((p) => p.label === anchorLabel);
  if (preset) return preset.labelKo;
  return ANCHOR_LABEL_KO[anchorLabel] ?? anchorLabel;
}

export function getLocalizedCourseTitle(stops, anchorLabel, locale) {
  const type = detectTitleType(stops);
  const loc = getLocalizedLocationLabel(anchorLabel, locale);
  const templates = locale === 'ko' ? KO_TITLE_TEMPLATES : EN_TITLE_TEMPLATES;
  return templates[type]?.(loc) ?? `${loc} Food Walk`;
}

/** Distinguishes multiple recommended-course cards that would otherwise share the
 *  exact same title — e.g. three Itaewon/All-filter courses all detect the same
 *  stops-based theme bucket (see detectTitleType() above) and all end up
 *  "Itaewon Food Walk" with nothing telling them apart. courseBuilder.js's
 *  buildRecommendedCourses() picks every course with the identical
 *  score-then-tiebreak rule (just excluding places used by an earlier course) —
 *  there's no real per-course "strategy" to label them with, so this appends a
 *  plain deterministic 1-based sequence number instead of inventing a distinction
 *  that isn't real (no fake "Popular"/"Variety" labels, no guessed food category).
 *  Same trailing "{title} {n}" form in both locales — a bare number needs no
 *  translation. */
export function appendCourseSequenceNumber(title, sequenceNumber) {
  return `${title} ${sequenceNumber}`;
}

// ─── title_schema_version = 2: structured title/anchor/preference display ──────
//
// v1 rows (above) regenerate a title by re-detecting a theme from stops each time —
// there is no stored theme or preference data to work from. v2 rows instead carry
// anchor_type/anchor_key/anchor_area_original/course_theme_key/preference_keys
// (see docs/42), so the title/anchor/preference lines below are built from those
// structured fields instead of re-guessing, and render correctly in whichever
// locale is currently selected regardless of the locale saved at save time.

/** course_theme_key is the user's first selected food-type filter, or null when no
 *  filter was selected (the "All" state). Deliberately does NOT fall back to a
 *  dominant category guessed from the stops' matgilCategoryKeys — a course with no
 *  filter applied can easily end up with several seafood stops by chance, and that
 *  is not the same thing as the user asking for a seafood course (see docs/44,
 *  which fixed an earlier version of this function that used the stops' dominant
 *  category as a fallback, producing titles like "Seafood Walk" for an All-filter
 *  save). null here is what tells getCourseThemeLabel() to render the safe
 *  "Food"/"맛집" default instead of inventing a theme. */
export function computeCourseThemeKey(stops, preferenceKeys) {
  const keys = Array.isArray(preferenceKeys) ? preferenceKeys.filter(Boolean) : [];
  return keys.length > 0 ? keys[0] : null;
}

/** anchor_type === 'map' | 'gps' district (originally Korean, e.g. "종로구") displayed
 *  in the current locale — English uses the same Seoul district map SearchOverlay
 *  already relies on, so results stay consistent across the two features. */
function getLocalizedDistrict(districtKo, locale) {
  if (!districtKo) return null;
  return locale === 'ko' ? districtKo : translateSeoulDistrict(districtKo);
}

/** Best-effort "is this raw Korean text?" check. Kakao search results and
 *  reverse-geocoded addresses are always the original Korean string — this project
 *  calls no translation service — so a Korean-locale screen can show them as-is,
 *  but an English screen showing them verbatim mixes languages. Used to gate
 *  anchor_name_original/anchor_address_original in English (see
 *  getAnchorDisplayLocation()/getAnchorAreaPart()) rather than ever inventing a
 *  translated address. Only detects the presence of Hangul syllables — doesn't
 *  judge whether non-Korean text is "real" English (a plain ASCII business name
 *  like "Starbucks" passes through untouched, which is correct). */
function containsHangul(value) {
  return typeof value === 'string' && /[가-힣]/.test(value);
}

/** Best-effort translatable district/area name for a saved anchor, trying
 *  progressively less direct sources when anchor_area_original itself is missing
 *  (legacy rows saved before every anchor_type populated it — see
 *  savedCourseService.js's buildAnchorFields()). Reuses the same district-name
 *  regex extractDistrictKo() already uses for search-type saves; never guesses
 *  beyond what's actually extractable as a "OO구" segment. */
function resolveAnchorAreaKo(savedRow) {
  if (savedRow.anchor_area_original) return savedRow.anchor_area_original;
  return extractDistrictKo(savedRow.anchor_address_original) ?? extractDistrictKo(savedRow.anchor_name_original);
}

/** Course-TITLE location part — always the WIDE district/area for search/map/gps
 *  anchors, never the specific place name or address (docs/45 — showing the same
 *  wide area in both the title and the "기준 위치" detail line, e.g. two "종로구
 *  일대"s, was the bug this split fixed). presets have no separate "wide area"
 *  concept (a preset IS already a specific, proper-noun location), so they use the
 *  same value here and in getAnchorDisplayLocation().
 *  Falls back to the specific name only when no area could be derived at all (a
 *  non-Seoul address, a geocode failure, ...) so the title doesn't lose its
 *  location entirely — see getStructuredCourseTitle()'s theme-only fallback for
 *  when even that isn't available. */
export function getAnchorAreaPart(savedRow, locale, { t } = {}) {
  if (!savedRow) return null;
  const anchorType = savedRow.anchor_type;

  if (anchorType === 'preset' && savedRow.anchor_key) {
    const preset = PRESET_LOCATIONS.find((p) => p.key === savedRow.anchor_key);
    if (preset) return locale === 'ko' ? (preset.labelKo ?? preset.label) : preset.label;
  }

  if (anchorType === 'search' || anchorType === 'map' || anchorType === 'gps') {
    const areaKo = resolveAnchorAreaKo(savedRow);
    const area = getLocalizedDistrict(areaKo, locale);
    if (area) return t ? t('courseTitle.areaSuffix', { area }) : area;
  }

  // Name fallback only when no area could be derived at all — gated the same way
  // as getAnchorDisplayLocation() so an English title never mixes in raw Korean
  // text (anchor_name_original is always the original Kakao string).
  if (anchorType === 'search' && savedRow.anchor_name_original
    && (locale === 'ko' || !containsHangul(savedRow.anchor_name_original))) {
    return savedRow.anchor_name_original;
  }

  return null;
}

/** Saved Courses detail header's "기준 위치"/"Starting point" location part — the
 *  MOST SPECIFIC value available (docs/45 §2 priority), deliberately different from
 *  getAnchorAreaPart()'s title-only wide area:
 *   1. anchor_name_original — a picked search place, or a geocoded building/facility
 *      name (Kakao's road_address.building_name — often empty, which is expected)
 *   2. anchor_address_original — road-name address, falling back to jibun (Kakao
 *      already resolves that fallback into one field — see reverseGeocodeService.js)
 *   3. anchor_area_original through courseTitle.areaSuffix — only when nothing more
 *      specific exists at all (never a generic placeholder like "Selected area")
 *  presets use the same specific value as getAnchorAreaPart() (see its comment). */
export function getAnchorDisplayLocation(savedRow, locale, { t } = {}) {
  if (!savedRow) return null;
  const anchorType = savedRow.anchor_type;

  if (anchorType === 'preset' && savedRow.anchor_key) {
    const preset = PRESET_LOCATIONS.find((p) => p.key === savedRow.anchor_key);
    if (preset) return locale === 'ko' ? (preset.labelKo ?? preset.label) : preset.label;
  }

  // In Korean, raw Kakao text is always safe to show as stored. In English, only
  // show it when it ISN'T Korean text this project has no translation for —
  // otherwise fall through to the next candidate rather than mixing a Korean
  // name/address into an English screen.
  const isDisplayable = (value) => !!value && (locale === 'ko' || !containsHangul(value));
  if (isDisplayable(savedRow.anchor_name_original)) return savedRow.anchor_name_original;

  const address = savedRow.anchor_address_original;
  if (isDisplayable(address)) return address;
  if (address && locale !== 'ko') {
    // The address is Korean — try a structural Korean→English conversion
    // (romanization, not translation, and never a guess: see
    // formatKoreanAddressToEnglish()'s own null-on-uncertainty contract) before
    // dropping all the way down to the district-level fallback below.
    const englishAddress = formatKoreanAddressToEnglish(address);
    if (englishAddress) return englishAddress;
  }

  if (anchorType === 'search' || anchorType === 'map' || anchorType === 'gps') {
    const area = getLocalizedDistrict(resolveAnchorAreaKo(savedRow), locale);
    if (area) return t ? t('courseTitle.areaSuffix', { area }) : area;
  }

  return null;
}

/** course_theme_key → its display label (via the DB-backed food-category
 *  translations, same source FilterSheet uses), or a safe default when the key is
 *  missing/unknown — never displays a raw internal key to the user. */
export function getCourseThemeLabel(themeKey, locale, { getCategoryLabel, t } = {}) {
  if (themeKey && getCategoryLabel) {
    const label = getCategoryLabel(themeKey, locale);
    if (label && label !== themeKey) return label;
  }
  return t ? t('courseTitle.defaultTheme') : (locale === 'ko' ? '맛집' : 'Food');
}

/** Full v2 title: "{location} {theme} Walk/동선" when a location part is available,
 *  otherwise "{theme} Recommended Walk/{theme} 추천 동선" — a missing location never
 *  collapses every course into the same generic title (docs/42 §14/§15). Uses
 *  getAnchorAreaPart() (the wide area), not getAnchorDisplayLocation() — the title
 *  and the detail "기준 위치" line are deliberately different values (docs/45). */
function getStructuredCourseTitle(savedRow, locale, helpers) {
  const location = getAnchorAreaPart(savedRow, locale, helpers);
  const theme = getCourseThemeLabel(savedRow?.course_theme_key, locale, helpers);
  if (!helpers?.t) return location ? `${location} ${theme}` : theme;
  return location
    ? helpers.t('courseTitle.withLocation', { location, theme })
    : helpers.t('courseTitle.themeOnly', { theme });
}

/** Saved-course title for the current locale, dispatching on title_schema_version:
 *  v2 rows use the structured fields above; v1 (or missing) rows keep the pre-existing
 *  re-detection behavior (getLocalizedCourseTitle) unchanged — see docs/41. `helpers`
 *  is `{ getCategoryLabel, t }`, both optional (falls back to a plain join without them). */
export function getSavedCourseDisplayTitle(savedRow, locale, helpers = {}) {
  if (!savedRow) return '';
  if (Number(savedRow.title_schema_version) >= 2) {
    return getStructuredCourseTitle(savedRow, locale, helpers);
  }
  const snapshot = savedRow.course_snapshot ?? {};
  const rawStops = savedRow.stops ?? snapshot.stops ?? [];
  const anchorLabel = savedRow.anchor_label ?? snapshot.anchor_label ?? '';
  return getLocalizedCourseTitle(rawStops, anchorLabel, locale);
}

/** "기준 위치"/"Starting point" line value for the Saved Courses detail header.
 *  v2 rows use getAnchorDisplayLocation() (the specific place/address, NOT the wide
 *  area the title uses — docs/45 fixed the two showing the same "종로구 일대" twice);
 *  v1 rows keep the pre-existing getSavedCourseAnchorDisplay() behavior (raw
 *  address/label, unchanged). */
export function getSavedCourseAnchorLine(savedRow, locale, helpers = {}) {
  if (!savedRow) return null;
  if (Number(savedRow.title_schema_version) >= 2) {
    return getAnchorDisplayLocation(savedRow, locale, helpers);
  }
  return getSavedCourseAnchorDisplay(savedRow);
}

/** "선택 취향"/"Preferences" line value — "고기 구이 · 돼지고기"/"BBQ · Pork" when the
 *  saved course has preference_keys, otherwise the "선택 안 함"/"None selected"
 *  placeholder (never null — the line is always shown, including for the All/no-
 *  filter state, which the DB already records honestly as an empty array rather
 *  than a guessed theme). */
export function getSavedCoursePreferenceLine(savedRow, locale, { getCategoryLabel, t } = {}) {
  const keys = Array.isArray(savedRow?.preference_keys) ? savedRow.preference_keys.filter(Boolean) : [];
  if (keys.length === 0) return t ? t('courseDetail.preferencesNone') : (locale === 'ko' ? '선택 안 함' : 'None selected');
  if (!getCategoryLabel) return keys.join(' · ');
  return keys.map((key) => getCategoryLabel(key, locale)).join(' · ');
}

export function getLocalizedStopName(stop, locale) {
  if (!stop) return '';
  if (locale === 'ko') return stop.nameKo ?? stop.name ?? '';
  return stop.name ?? stop.nameKo ?? '';
}

/** Merges a saved-course stop (a route-context snapshot: distanceKm, tint, saved
 *  order, and a possibly stale-locale copy of the place's text) with the SAME
 *  place fetched fresh for the CURRENT locale (see getPlacesByIds() in placeApi.js).
 *  The current-locale record wins for every locale-dependent text field (name,
 *  firstMenu, treatMenu, description, address, openTime, restDate, parking,
 *  packing, tags, ...) — fixing the bug where a course saved in one language kept
 *  showing that language's place text forever, mismatched against the current UI
 *  language and the (already-relocalized) course title (docs/44).
 *
 *  The saved stop still supplies whatever a place record has no field for at all
 *  (distanceKm, tint, saved stop order) and an image fallback for places that
 *  currently have none — those aren't locale-dependent, so there's nothing to
 *  refresh. When `localizedPlace` is null (place deleted from mg_places, or the
 *  batch fetch failed) the saved snapshot is used as-is — the ONLY situation where
 *  snapshot text should ever reach the screen. */
export function mergeSavedStopWithLocalizedPlace(savedStop, localizedPlace) {
  if (!localizedPlace) return savedStop;
  return {
    ...savedStop,
    ...localizedPlace,
    imageUrl: localizedPlace.imageUrl || savedStop.imageUrl || null,
  };
}

/** Localize a raw course snapshot (passed via router state) for the current locale. */
export function localizeSnapshotForDisplay(snapshot, locale) {
  if (!snapshot) return null;
  const rawStops = snapshot.stops ?? [];
  const anchorLabel = snapshot.anchor_label ?? '';
  const title = getLocalizedCourseTitle(rawStops, anchorLabel, locale);
  const stops = rawStops.map((stop) => ({
    ...stop,
    name: getLocalizedStopName(stop, locale),
  }));
  return { ...snapshot, title, stops };
}

/** Localize a full DB saved-course row for the current locale. `helpers` is
 *  `{ getCategoryLabel, t }` (both optional) — passed through to
 *  getSavedCourseDisplayTitle() so title_schema_version 2 rows get the structured
 *  anchor/theme title instead of the v1 re-detected one.
 *  Does NOT mutate the row — returns a new object. */
export function normalizeSavedCourseForDisplay(savedRow, locale, helpers = {}) {
  if (!savedRow) return null;
  const snapshot = savedRow.course_snapshot ?? {};
  const rawStops = savedRow.stops ?? snapshot.stops ?? [];
  const anchorLabel = savedRow.anchor_label ?? snapshot.anchor_label ?? '';
  const title = getSavedCourseDisplayTitle(savedRow, locale, helpers);
  const stops = rawStops.map((stop) => ({
    ...stop,
    name: getLocalizedStopName(stop, locale),
  }));
  return {
    ...savedRow,
    title,
    stops,
    course_snapshot: { ...snapshot, title, stops, anchor_label: anchorLabel },
  };
}

// Generic placeholder labels (nearby.selectedArea / nearby.currentLocation, both
// locales) carry no real location information, so they are hidden rather than shown.
const MEANINGLESS_ANCHOR_LABELS = new Set([
  ...Object.keys(ANCHOR_LABEL_KO),
  ...Object.values(ANCHOR_LABEL_KO),
]);

function isMeaningfulAnchorLabel(label) {
  if (typeof label !== 'string') return false;
  const trimmed = label.trim();
  return trimmed.length > 0 && !MEANINGLESS_ANCHOR_LABELS.has(trimmed);
}

/** Saved Courses 상세의 제목 아래 보조 텍스트로 쓸, 저장 당시 기준 위치 표시값.
 *  우선순위: course_snapshot.anchor_address → 최상위 anchor_label →
 *  course_snapshot.anchor_label → 표시하지 않음(null). "선택한 지역"/"Selected area"
 *  류 일반 라벨은 실질 정보가 없으므로 숨긴다. 기존 저장 데이터(신규 필드 없음)도
 *  안전하게 null-safe 처리된다. */
export function getSavedCourseAnchorDisplay(savedRow) {
  const snapshot = savedRow?.course_snapshot ?? {};

  const address = snapshot?.anchor_address;
  if (typeof address === 'string' && address.trim()) return address.trim();

  if (isMeaningfulAnchorLabel(savedRow?.anchor_label)) return savedRow.anchor_label.trim();
  if (isMeaningfulAnchorLabel(snapshot?.anchor_label)) return snapshot.anchor_label.trim();

  return null;
}
