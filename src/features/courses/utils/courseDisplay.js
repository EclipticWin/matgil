import { PRESET_LOCATIONS } from '../../explore/data/locations.js';
import { translateSeoulDistrict, translateSeoulDistrictZh, extractDistrictKo, formatKoreanAddressToEnglish } from '../../explore/data/seoulDistricts.js';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

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

// English literal anchor label -> its translation per locale (see
// getLocalizedLocationLabel()). Keyed by the literal EN string these ad-hoc
// "no real place selected" locations always carry as `label` (see
// nearby.selectedArea/nearby.currentLocation in dictionary.js and HomePage.jsx).
const ANCHOR_LABEL_TRANSLATIONS = {
  'Selected area': { ko: '선택한 지역', 'zh-CN': '已选地区' },
  'Current location': { ko: '현재 위치', 'zh-CN': '当前位置' },
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

const ZH_TITLE_TEMPLATES = {
  cafeAndBites: (loc) => `${loc}咖啡·美食路线`,
  streetFood:   (loc) => `${loc}街头小吃之旅`,
  bbq:          (loc) => `${loc}烤肉路线`,
  noodle:       (loc) => `${loc}面食路线`,
  default:      (loc) => `${loc}美食路线`,
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
  if (!anchorLabel) {
    return pickTranslated({ ko: '선택한 지역', en: 'Selected area', 'zh-CN': '已选地区' }, locale);
  }
  const preset = PRESET_LOCATIONS.find((p) => p.label === anchorLabel);
  if (preset) {
    return pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label;
  }
  const known = ANCHOR_LABEL_TRANSLATIONS[anchorLabel];
  if (!known) return anchorLabel;
  return pickTranslated({ ...known, en: anchorLabel }, locale) ?? anchorLabel;
}

/** Course-title/header location name for a *live* Map-tab selectedLocation object
 *  (HomePage.jsx's `{ source, label, area, placeName, address, key }` state — not a
 *  saved-course DB row, so getAnchorAreaPart() below doesn't apply here). Mirrors
 *  that function's anchor_type='map' priority (docs/45): the reverse-geocoded
 *  district (selectedLocation.area, populated asynchronously by
 *  reverseGeocodeService.js — falling back to extractDistrictKo(selectedLocation.address)
 *  on the rare response that has an address but no region_2depth_name) through the
 *  same "{area} 일대"/"{area} Area" wording courseTitle.areaSuffix uses for saved
 *  courses — inlined here rather than routed through the runtime dictionary because
 *  this module has no `t()`/React context available (same pattern as
 *  getCourseThemeLabel()'s no-helpers fallback above).
 *  Falls through to the plain label (e.g. "Selected area") until geocoding resolves
 *  or if it fails — never blocks course generation.
 *  'search'/gps locations are untouched: search already carries the picked
 *  place's own name as `label` (more specific than any district), GPS intentionally
 *  keeps its generic "Current location" wording per this feature's scope (only the
 *  map-center flow lost a real location name). Preset locations (LocationSheet's
 *  hot-place picks) are matched by `selectedLocation.key` against PRESET_LOCATIONS
 *  and re-translated the same way getLocalizedLocationLabel()/getAnchorAreaPart()
 *  already do for their own preset branches — `selectedLocation.label` is always
 *  the EN string (see locations.js), so returning it as-is for ko/zh-CN left the
 *  course title's location stuck in English after a locale switch (no re-select
 *  needed to reproduce — this function just never looked the preset back up). */
export function getLocationDisplayName(selectedLocation, locale) {
  if (!selectedLocation) return null;
  if (selectedLocation.source === 'map') {
    const districtKo = selectedLocation.area || extractDistrictKo(selectedLocation.address);
    const area = getLocalizedDistrict(districtKo, locale);
    if (area) return pickTranslated({ ko: `${area} 일대`, en: `${area} Area`, 'zh-CN': `${area}一带` }, locale);
  }
  const preset = PRESET_LOCATIONS.find((item) => item.key === selectedLocation.key);
  if (preset) {
    return pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label;
  }
  return selectedLocation.label ?? null;
}

export function getLocalizedCourseTitle(stops, anchorLabel, locale) {
  const type = detectTitleType(stops);
  const loc = getLocalizedLocationLabel(anchorLabel, locale);
  const templates = pickTranslated({ ko: KO_TITLE_TEMPLATES, en: EN_TITLE_TEMPLATES, 'zh-CN': ZH_TITLE_TEMPLATES }, locale);
  const fallback = pickTranslated({ ko: `${loc} 맛집 동선`, en: `${loc} Food Walk`, 'zh-CN': `${loc}美食路线` }, locale);
  return templates[type]?.(loc) ?? fallback;
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
 *  translation.
 *  No longer called by buildRecommendedCourses() — live recommendations now
 *  resolve duplicate titles with real data instead (see
 *  resolveLiveCourseTitleCollisions() below). Left in place in case anything
 *  else still depends on it. */
export function appendCourseSequenceNumber(title, sequenceNumber) {
  return `${title} ${sequenceNumber}`;
}

// ─── live-recommendation title generation ───────────────────────────────────
//
// Separate from getLocalizedCourseTitle() above (which stays exactly as-is — it's
// still used for title_schema_version 1 saved courses and as the legacy fallback
// for snapshots without titleTheme). This is the only title path that knows about
// selectedFoodTypes/getCategoryLabel and per-stop menu text.

const MAX_MENU_CANDIDATE_LABEL_LENGTH = 10;

/** Cleans a raw firstMenu/treatMenu string into a short title-worthy candidate, or
 *  null when nothing usable survives. Strips HTML tags, splits on <br>/newline/
 *  slash/comma/middle-dot and keeps only the first segment (menu fields are often
 *  "김치찌개, 된장찌개" or "김치찌개<br>된장찌개" — the first dish is enough for a
 *  title), then normalizes whitespace. A segment longer than
 *  MAX_MENU_CANDIDATE_LABEL_LENGTH is rejected in favor of a category label instead
 *  of dumping a whole sentence into a title. Never translates — this is always
 *  text already fetched for the current locale (see normalizePlace() in
 *  placeApi.js), so there's nothing to invent. */
function normalizeMenuCandidate(raw) {
  if (typeof raw !== 'string') return null;
  const withoutTags = raw.replace(/<[^>]*>/g, ' ');
  const parts = withoutTags.split(/<br\s*\/?>|\r?\n|\/|,|·/).map((part) => part.trim()).filter(Boolean);
  const first = parts[0];
  if (!first) return null;
  const normalized = first.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > MAX_MENU_CANDIDATE_LABEL_LENGTH) return null;
  return normalized;
}

/** One stop's best available title-theme signal, in priority order: firstMenu →
 *  treatMenu → its first non-'other' matgilCategoryKeys entry (via
 *  getCategoryLabel). Returns null when the stop has nothing usable. */
function getStopThemeCandidate(stop, locale, getCategoryLabel) {
  const menu = normalizeMenuCandidate(stop?.firstMenu) ?? normalizeMenuCandidate(stop?.treatMenu);
  if (menu) return { label: menu, source: 'menu', categoryKey: null };
  const categoryKey = (stop?.matgilCategoryKeys ?? []).find((k) => k && k !== 'other');
  if (categoryKey && getCategoryLabel) {
    const label = getCategoryLabel(categoryKey, locale);
    if (label && label !== categoryKey) return { label, source: 'category', categoryKey };
  }
  return null;
}

/** Collects up to 2 deduped theme-candidate labels across a course's stops, menu-
 *  based candidates first (more specific) then category-based ones, plus whatever
 *  is left over as `candidateLabels` (used for same-render duplicate-title
 *  disambiguation — see resolveLiveCourseTitleCollisions()). `source` is 'menu'
 *  when at least one menu candidate made it into the chosen labels, 'category'
 *  when only category labels were found, 'fallback' when the stops had nothing
 *  usable at all. */
function buildThemeCandidatesFromStops(stops, locale, getCategoryLabel) {
  const seenLabels = new Set();
  const menuCandidates = [];
  const categoryCandidates = [];
  for (const stop of stops ?? []) {
    const candidate = getStopThemeCandidate(stop, locale, getCategoryLabel);
    if (!candidate || seenLabels.has(candidate.label)) continue;
    seenLabels.add(candidate.label);
    (candidate.source === 'menu' ? menuCandidates : categoryCandidates).push(candidate);
  }
  const ordered = [...menuCandidates, ...categoryCandidates];
  return {
    labels: ordered.slice(0, 2).map((c) => c.label),
    candidateLabels: ordered.slice(2).map((c) => c.label),
    source: ordered.length === 0 ? 'fallback' : (menuCandidates.length > 0 ? 'menu' : 'category'),
    categoryKeys: ordered.filter((c) => c.categoryKey).map((c) => c.categoryKey),
  };
}

/** Single source for the live-recommendation title grammar (§13 of the spec this
 *  implements) — "{location} {theme1}·{theme2} 동선" / "Route" / "路线", falling
 *  back to a theme-only form when there's no location, and to the plain
 *  "맛집"/"Food"/"美食" default when there are no theme labels at all. Deliberately
 *  its own template (not courseTitle.withLocation/themeOnly from dictionary.js,
 *  which use "Walk" wording for the pre-existing preference-based saved-course
 *  title) — kept in JS template literals here rather than dictionary.js the same
 *  way KO/EN/ZH_TITLE_TEMPLATES above already are, so this stays single-sourced
 *  rather than spread across per-locale JSX. */
function formatLiveCourseTitle(location, themeLabels, locale) {
  const defaultTheme = pickTranslated({ ko: '맛집', en: 'Food', 'zh-CN': '美食' }, locale);
  const labels = (themeLabels ?? []).slice(0, 2);
  const themeText = labels.length > 0
    ? labels.join(pickTranslated({ ko: '·', en: ' & ', 'zh-CN': '·' }, locale))
    : defaultTheme;
  if (location) {
    return pickTranslated({
      ko: `${location} ${themeText} 동선`,
      en: `${location} ${themeText} Route`,
      'zh-CN': `${location}${themeText}路线`,
    }, locale);
  }
  return pickTranslated({
    ko: `${themeText} 동선`,
    en: `${themeText} Route`,
    'zh-CN': `${themeText}路线`,
  }, locale);
}

/** Live Map-tab recommendation title — the ONLY title function that knows about
 *  selectedFoodTypes. Priority (stop data first, filter picks as a fallback —
 *  see docs on the bug this order fixes: every course generated under the same
 *  filter selection used to get the identical filter-label title regardless of
 *  which stops it actually contained, e.g. three different "Cafe & Dessert &
 *  Chinese" courses that shared nothing but the filter):
 *   1. Per-stop candidates (firstMenu → treatMenu → category), max 2, deduped,
 *      preferring different stops over the same stop's own two menu fields —
 *      this is what actually varies between courses built from the same
 *      filter, so it has to win whenever any stop has something usable.
 *   2. Only when the stops have nothing usable at all: selectedFoodTypes (the
 *      user's actual filter picks) via getCategoryLabel, max 2, deduped,
 *      'all'/empty excluded — never a raw key.
 *   3. Neither available: the plain "맛집"/"Food"/"美食" default.
 *  Location logic is untouched — getLocationDisplayName()/getLocalizedLocationLabel()
 *  above, unchanged.
 *  Returns `{ title, titleTheme }` — titleTheme is attached to the course object by
 *  courseBuilder.js and flows into course_snapshot on save (see savedCourseService.js),
 *  letting getSavedCourseDisplayTitle() regenerate an equivalent title later without
 *  extra queries. */
export function getLiveRecommendedCourseTitle(stops, selectedLocation, locale, { selectedFoodTypes = [], getCategoryLabel } = {}) {
  const location = getLocationDisplayName(selectedLocation, locale) ?? getLocalizedLocationLabel(null, locale);

  const built = buildThemeCandidatesFromStops(stops, locale, getCategoryLabel);
  let themeLabels = built.labels;
  let candidateLabels = built.candidateLabels;
  let source = built.source;
  let categoryKeys = built.categoryKeys;

  if (themeLabels.length === 0) {
    const cleanPreferenceKeys = Array.isArray(selectedFoodTypes)
      ? [...new Set(selectedFoodTypes.filter((key) => key && key !== 'all'))]
      : [];

    if (cleanPreferenceKeys.length > 0 && getCategoryLabel) {
      const labels = [];
      const usedKeys = [];
      for (const key of cleanPreferenceKeys) {
        const label = getCategoryLabel(key, locale);
        if (label && label !== key && !labels.includes(label)) {
          labels.push(label);
          usedKeys.push(key);
        }
        if (labels.length >= 2) break;
      }
      if (labels.length > 0) {
        themeLabels = labels;
        source = 'preference';
        categoryKeys = usedKeys;
      }
    }
  }

  const title = formatLiveCourseTitle(location, themeLabels, locale);

  return {
    title,
    titleTheme: {
      source,
      categoryKeys,
      labelsByLocale: themeLabels.length > 0 ? { [locale]: themeLabels } : {},
      themeLabels,
      candidateLabels,
    },
  };
}

/** Replaces numeric-suffix disambiguation (the old appendCourseSequenceNumber
 *  loop) for live recommendations with real-data alternatives, in priority order:
 *   (a) swap in another of this course's own unused theme candidates
 *       (titleTheme.candidateLabels — menu/category labels that lost out to the
 *       2-label cap in getLiveRecommendedCourseTitle);
 *   (b) otherwise leave the title as-is. A duplicate title across two
 *       recommendation cards is preferred over ever appending a stop/place
 *       name, a sequence number, or any fabricated adjective — every live
 *       title must always end in "동선"/"Route"/"路线" with nothing after it
 *       (a stop-name suffix here used to break that, e.g. "... Route —
 *       Gwanghwamun Gukbap").
 *  Deterministic (same courses/locale in → same titles out) and never mutates the
 *  input array. */
export function resolveLiveCourseTitleCollisions(courses, selectedLocation, locale) {
  const titleCounts = new Map();
  for (const course of courses) titleCounts.set(course.title, (titleCounts.get(course.title) ?? 0) + 1);
  if (![...titleCounts.values()].some((n) => n > 1)) return courses;

  const location = getLocationDisplayName(selectedLocation, locale) ?? getLocalizedLocationLabel(null, locale);
  const finalTitles = new Set();

  return courses.map((course) => {
    if ((titleCounts.get(course.title) ?? 0) <= 1) {
      finalTitles.add(course.title);
      return course;
    }

    const theme = course.titleTheme ?? {};
    const usedLabels = theme.themeLabels ?? [];
    const pool = theme.candidateLabels ?? [];

    for (const candidate of pool) {
      const labels = usedLabels.length >= 2 ? [usedLabels[0], candidate] : [...usedLabels, candidate];
      const dedupedLabels = [...new Set(labels)];
      const candidateTitle = formatLiveCourseTitle(location, dedupedLabels, locale);
      if (candidateTitle !== course.title && !finalTitles.has(candidateTitle)) {
        finalTitles.add(candidateTitle);
        return {
          ...course,
          title: candidateTitle,
          titleTheme: {
            ...theme,
            themeLabels: dedupedLabels,
            labelsByLocale: { ...(theme.labelsByLocale ?? {}), [locale]: dedupedLabels },
          },
        };
      }
    }

    finalTitles.add(course.title);
    return course;
  });
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
  return pickTranslated(
    { ko: districtKo, en: translateSeoulDistrict(districtKo), 'zh-CN': translateSeoulDistrictZh(districtKo) },
    locale,
  );
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
    if (preset) {
      return pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label;
    }
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
    if (preset) {
      return pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label;
    }
  }

  // In Korean, raw Kakao text is always safe to show as stored. In English, only
  // show it when it ISN'T Korean text this project has no translation for —
  // otherwise fall through to the next candidate rather than mixing a Korean
  // name/address into an English screen.
  const isDisplayable = (value) => !!value && (locale === 'ko' || !containsHangul(value));
  if (isDisplayable(savedRow.anchor_name_original)) return savedRow.anchor_name_original;

  const address = savedRow.anchor_address_original;
  if (isDisplayable(address)) return address;
  if (address && locale === 'en') {
    // The address is Korean — try a structural Korean→English conversion
    // (romanization, not translation, and never a guess: see
    // formatKoreanAddressToEnglish()'s own null-on-uncertainty contract) before
    // dropping all the way down to the district-level fallback below. There is
    // no equivalent structural Korean→Chinese conversion (Chinese doesn't
    // romanize street names the way Revised Romanization does), so zh-CN skips
    // straight to the district-level fallback below, which IS fully
    // translated (see getLocalizedDistrict()/SEOUL_DISTRICT_ZH).
    const englishAddress = formatKoreanAddressToEnglish(address);
    if (englishAddress) return englishAddress;
  }

  if (anchorType === 'search' || anchorType === 'map' || anchorType === 'gps') {
    const area = getLocalizedDistrict(resolveAnchorAreaKo(savedRow), locale);
    if (area) return t ? t('courseTitle.areaSuffix', { area }) : area;
  }

  return null;
}

/** Public "popular routes" feed card's one-line "기준 위치" display —
 *  deliberately ADDRESS-first (unlike getAnchorDisplayLocation()'s name-first
 *  order for the Saved Courses detail header): a concrete street address reads
 *  as a more useful trust signal on an anonymous public-feed card than a
 *  business/building name would. Priority:
 *   1. row.anchor_address_original (road/jibun address; attempts the same
 *      Korean→English structural conversion getAnchorDisplayLocation() does
 *      for 'en' before falling through)
 *   2. row.course_snapshot?.anchor_address (the map-service address string
 *      saveCourse() writes into the snapshot at save time)
 *   3. row.anchor_name_original
 *   4. a locale-correct fallback location name — a translated preset label
 *      (never the raw key), or the reverse-geocoded district
 *   5. row.anchor_label / row.course_snapshot?.anchor_label, only if
 *      meaningful (never a raw "Selected area"/"Current location"-style
 *      placeholder — see isMeaningfulAnchorLabel())
 *   6. null — caller renders no line at all.
 *  Never mixes a different locale's raw Korean text into an en/zh-CN screen
 *  (same isDisplayable() gate getAnchorDisplayLocation() uses). */
export function getPublicCourseAnchorDisplay(row, locale, { t } = {}) {
  if (!row) return null;
  const anchorType = row.anchor_type;
  const isDisplayable = (value) => typeof value === 'string' && value.trim().length > 0
    && (locale === 'ko' || !containsHangul(value));

  const addressOriginal = row.anchor_address_original;
  if (isDisplayable(addressOriginal)) return addressOriginal.trim();
  if (addressOriginal && locale === 'en') {
    const englishAddress = formatKoreanAddressToEnglish(addressOriginal);
    if (englishAddress) return englishAddress;
  }

  const snapshotAddress = row.course_snapshot?.anchor_address;
  if (isDisplayable(snapshotAddress)) return snapshotAddress.trim();

  if (isDisplayable(row.anchor_name_original)) return row.anchor_name_original.trim();

  if (anchorType === 'preset' && row.anchor_key) {
    const preset = PRESET_LOCATIONS.find((p) => p.key === row.anchor_key);
    if (preset) return pickTranslated({ ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh }, locale) ?? preset.label;
  }
  if (anchorType === 'search' || anchorType === 'map' || anchorType === 'gps') {
    const area = getLocalizedDistrict(resolveAnchorAreaKo(row), locale);
    if (area) return t ? t('courseTitle.areaSuffix', { area }) : area;
  }

  const rawLabel = row.anchor_label ?? row.course_snapshot?.anchor_label;
  if (isMeaningfulAnchorLabel(rawLabel)) return rawLabel.trim();

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
  if (t) return t('courseTitle.defaultTheme');
  return pickTranslated({ ko: '맛집', en: 'Food', 'zh-CN': '美食' }, locale);
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

/** Picks up to 2 current-locale theme labels out of a live-recommendation
 *  titleTheme (course_snapshot.titleTheme — see getLiveRecommendedCourseTitle()),
 *  in accuracy order:
 *   1. `localizedStops` (helpers) — current-locale stop data already batch-fetched
 *      by the caller (SavedCourseDetailPage's getPlacesByIds) — regenerated fresh,
 *      the most accurate option and the only one that can produce a correct
 *      menu-based title in a locale different from the one the course was saved in.
 *   2. titleTheme.labelsByLocale[locale] — an exact match for the currently
 *      viewed locale. Checked before categoryKeys: a menu-based title
 *      ("Sashimi & Pasta") already computed for THIS locale is more specific and
 *      more accurate than re-deriving a category label ("Western") from
 *      categoryKeys would be, so it must win whenever it's available for the
 *      locale actually being displayed.
 *   3. titleTheme.categoryKeys via getCategoryLabel — safe fallback in ANY
 *      locale (unlike raw menu text, category keys translate on demand), used
 *      only when this exact locale has no labelsByLocale entry.
 *  Never falls back to another locale's labelsByLocale entry — that would mix a
 *  different language's raw menu text into the current screen.
 *  Returns null when none of these produce anything — callers fall back to the
 *  existing structured/default title instead. */
function pickTitleThemeLabels(titleTheme, locale, { getCategoryLabel, localizedStops } = {}) {
  if (!titleTheme) return null;

  if (Array.isArray(localizedStops) && localizedStops.length > 0) {
    const built = buildThemeCandidatesFromStops(localizedStops, locale, getCategoryLabel);
    if (built.labels.length > 0) return built.labels;
  }

  if (Array.isArray(titleTheme.labelsByLocale?.[locale]) && titleTheme.labelsByLocale[locale].length > 0) {
    return titleTheme.labelsByLocale[locale];
  }

  if (Array.isArray(titleTheme.categoryKeys) && titleTheme.categoryKeys.length > 0 && getCategoryLabel) {
    const mapped = titleTheme.categoryKeys
      .map((key) => getCategoryLabel(key, locale))
      .filter((label, i) => label && label !== titleTheme.categoryKeys[i]);
    if (mapped.length > 0) return mapped;
  }

  return null;
}

/** getSavedCourseDisplayTitle()'s branch for v2 rows saved with NO preference_keys
 *  (the "All" filter state) — before this, such rows always fell through to
 *  getStructuredCourseTitle()'s generic "맛집"/"Food" default, because
 *  course_theme_key is deliberately null in that case (see computeCourseThemeKey()'s
 *  comment). Rows saved with the new live-title system carry course_snapshot.titleTheme,
 *  which lets this produce the same kind of menu/category-based title the live
 *  recommendation had — the title part uses getAnchorAreaPart() (the same
 *  locale-correct wide-area value the structured title already uses), never the
 *  frozen live-session location text. Returns null (falls through to
 *  getStructuredCourseTitle()) for rows saved before this feature, or when nothing
 *  usable survives pickTitleThemeLabels(). */
function getTitleFromTitleTheme(savedRow, locale, helpers = {}) {
  const titleTheme = savedRow?.course_snapshot?.titleTheme;
  const labels = pickTitleThemeLabels(titleTheme, locale, helpers);
  if (!labels || labels.length === 0) return null;
  const location = getAnchorAreaPart(savedRow, locale, helpers);
  return formatLiveCourseTitle(location, labels, locale);
}

/** Saved-course title for the current locale, dispatching on title_schema_version:
 *  v2 rows with preference_keys use the structured fields above, unchanged; v2 rows
 *  with NO preference_keys and a titleTheme prefer the exact title the user saw and
 *  saved (savedRow.title) whenever the row's own save-time locale matches the
 *  locale currently being displayed — this is the one case where the raw saved
 *  string is guaranteed correct, including any first-stop-name suffix
 *  resolveLiveCourseTitleCollisions() may have added at save time, which
 *  regenerating from titleTheme labels alone would lose. Only when the displayed
 *  locale differs from savedRow.locale (or savedRow.title is unusable) does it
 *  fall to the live-title-derived titleTheme regeneration (getTitleFromTitleTheme()),
 *  then to the same structured default; v1 (or missing) rows keep the
 *  pre-existing re-detection behavior (getLocalizedCourseTitle) unchanged — see
 *  docs/41. `helpers` is `{ getCategoryLabel, t, localizedStops }`, all optional
 *  (falls back to a plain join without them). */
export function getSavedCourseDisplayTitle(savedRow, locale, helpers = {}) {
  if (!savedRow) return '';
  if (Number(savedRow.title_schema_version) >= 2) {
    const preferenceKeys = Array.isArray(savedRow.preference_keys) ? savedRow.preference_keys.filter(Boolean) : [];
    if (preferenceKeys.length === 0) {
      const titleTheme = savedRow.course_snapshot?.titleTheme;
      if (titleTheme && savedRow.locale === locale && savedRow.title) {
        return savedRow.title;
      }
      const titleThemeTitle = getTitleFromTitleTheme(savedRow, locale, helpers);
      if (titleThemeTitle) return titleThemeTitle;
    }
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
  if (keys.length === 0) {
    if (t) return t('courseDetail.preferencesNone');
    return pickTranslated({ ko: '선택 안 함', en: 'None selected', 'zh-CN': '未选择' }, locale);
  }
  if (!getCategoryLabel) return keys.join(' · ');
  return keys.map((key) => getCategoryLabel(key, locale)).join(' · ');
}

export function getLocalizedStopName(stop, locale) {
  if (!stop) return '';
  return pickTranslated({ ko: stop.nameKo, en: stop.name }, locale) ?? stop.name ?? stop.nameKo ?? '';
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

/** Localize a raw course snapshot (passed via router state, e.g.
 *  SavedCourseDetailPage's "View on map" → NearbySheet) for the current locale.
 *  When the snapshot carries a live-title titleTheme (saved by the new
 *  getLiveRecommendedCourseTitle() system), regenerates the title from it via the
 *  same pickTitleThemeLabels() priority getSavedCourseDisplayTitle() uses —
 *  category-based titles resolve correctly in any locale via getCategoryLabel;
 *  menu-based ones only reuse the frozen label when it matches the current locale
 *  (labelsByLocale[locale]), never mixing another locale's raw menu text in.
 *  Snapshots without titleTheme (existing saved courses, pre-this-feature) fall
 *  through to the unchanged legacy getLocalizedCourseTitle() re-detection.
 *  `helpers` is `{ getCategoryLabel }`, optional. Location logic itself is
 *  untouched — same getLocalizedLocationLabel(anchorLabel, locale) either path. */
export function localizeSnapshotForDisplay(snapshot, locale, helpers = {}) {
  if (!snapshot) return null;
  const rawStops = snapshot.stops ?? [];
  const anchorLabel = snapshot.anchor_label ?? '';
  const stops = rawStops.map((stop) => ({
    ...stop,
    name: getLocalizedStopName(stop, locale),
  }));

  const themeLabels = pickTitleThemeLabels(snapshot.titleTheme, locale, helpers);
  const title = themeLabels && themeLabels.length > 0
    ? formatLiveCourseTitle(getLocalizedLocationLabel(anchorLabel, locale), themeLabels, locale)
    : getLocalizedCourseTitle(rawStops, anchorLabel, locale);

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

// Generic placeholder labels (nearby.selectedArea / nearby.currentLocation, all
// locales) carry no real location information, so they are hidden rather than shown.
const MEANINGLESS_ANCHOR_LABELS = new Set([
  ...Object.keys(ANCHOR_LABEL_TRANSLATIONS),
  ...Object.values(ANCHOR_LABEL_TRANSLATIONS).flatMap((translations) => Object.values(translations)),
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
