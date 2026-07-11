import { PRESET_LOCATIONS } from '../../explore/data/locations.js';

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

export function getLocalizedStopName(stop, locale) {
  if (!stop) return '';
  if (locale === 'ko') return stop.nameKo ?? stop.name ?? '';
  return stop.name ?? stop.nameKo ?? '';
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

/** Localize a full DB saved-course row for the current locale.
 *  Does NOT mutate the row — returns a new object. */
export function normalizeSavedCourseForDisplay(savedRow, locale) {
  if (!savedRow) return null;
  const snapshot = savedRow.course_snapshot ?? {};
  const rawStops = savedRow.stops ?? snapshot.stops ?? [];
  const anchorLabel = savedRow.anchor_label ?? snapshot.anchor_label ?? '';
  const title = getLocalizedCourseTitle(rawStops, anchorLabel, locale);
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
