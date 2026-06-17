import { calcDistanceKm } from './locations.js';

const DEFAULT_STOP_COUNT = 3;
const COURSE_CANDIDATE_LIMIT = 20;
const IDEAL_ROUTE_DISTANCE_KM = 1.0;       // ~10-12 min walk
const MAX_PREFERRED_ROUTE_DISTANCE_KM = 1.5; // ~15 min walk, allowed when ideal pool is empty

// Radius tiers for selecting candidates relative to selectedLocation.
// Tier 1 (local): if any places exist within this radius, use only those.
// Tier 2 (extended): expand only when tier 1 is empty.
// Fallback: use the full sorted list only when both tiers are empty.
const LOCAL_RADIUS_KM = 2.0;
const EXTENDED_RADIUS_KM = 4.0;

const TINTS = [
  '#FFE3D4', '#FFEFC9', '#E2F1DE', '#FBE0E4', '#E6E9F7',
  '#FFE0CE', '#DDEFEA', '#F0E6FF', '#E6F0FF', '#FFF3E0',
];

const ESTIMATED_TIME = { 1: '~30 min', 2: '~1 hr', 3: '~1.5 hr', 4: '~2 hr' };

// ─── combinatorics ───────────────────────────────────────────────────────────

function combinations(arr, k) {
  if (k === 1) return arr.map((x) => [x]);
  if (k === arr.length) return [arr.slice()];
  const result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      result.push([arr[i], ...rest]);
    }
  }
  return result;
}

// ─── distance helpers ────────────────────────────────────────────────────────

function totalStopDist(stops) {
  let d = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    d += calcDistanceKm(
      stops[i].latitude, stops[i].longitude,
      stops[i + 1].latitude, stops[i + 1].longitude,
    );
  }
  return d;
}

// Returns distanceKm from selectedLocation, falling back to live calculation
// when the field hasn't been pre-populated (e.g. in unit tests).
function distFromSelected(place, selectedLocation) {
  return place.distanceKm != null
    ? place.distanceKm
    : calcDistanceKm(
        selectedLocation.lat, selectedLocation.lng,
        place.latitude, place.longitude,
      );
}

// ─── scoring components ──────────────────────────────────────────────────────

function calcClusterScore(stops) {
  const d = totalStopDist(stops);
  if (d <= 0.5) return 35;
  if (d <= 1.0) return 28;
  if (d <= 1.5) return 20;
  if (d <= 2.0) return 12;
  return 5;
}

function calcDiversityScore(stops, isFoodTypeSelected) {
  const primaries = new Set(
    stops.map((s) => (s.matgilCategoryKeys ?? [])[0]).filter(Boolean),
  );
  const n = primaries.size;
  if (isFoodTypeSelected) return n >= 3 ? 10 : n === 2 ? 6 : 3;
  return n >= 3 ? 20 : n === 2 ? 12 : 5;
}

function calcCafeBonus(stops) {
  return stops.some((s) => (s.matgilCategoryKeys ?? []).includes('cafe')) ? 15 : 0;
}

function calcDataQualityScore(stops) {
  let sum = 0;
  for (const s of stops) {
    if (s.imageUrl || s.hasImage) sum += 3;
    if (s.firstMenu || s.hasMenuInfo) sum += 2;
    if (s.latitude != null && s.longitude != null) sum += 2;
    const keys = s.matgilCategoryKeys ?? [];
    if (keys.length > 0 && !(keys.length === 1 && keys[0] === 'other')) sum += 2;
  }
  return Math.min(20, sum);
}

function calcStartAccessScore(firstStop, selectedLocation) {
  const dist = distFromSelected(firstStop, selectedLocation);
  if (dist <= 0.5) return 10;
  if (dist <= 1.0) return 8;
  if (dist <= 2.0) return 5;
  if (dist <= 3.0) return 2;
  return 0;
}

function calcWeakOtherPenalty(stops, selectedFoodTypes) {
  if (selectedFoodTypes.includes('other')) return 0;
  if (selectedFoodTypes.length > 0) return 0;
  let penalty = 0;
  for (const s of stops) {
    const keys = s.matgilCategoryKeys ?? [];
    if (keys.length === 1 && keys[0] === 'other') penalty += 2;
  }
  return penalty;
}

function calcScore(stops, selectedLocation, foodTypes) {
  const isFoodTypeSelected = foodTypes.length > 0;
  return (
    calcClusterScore(stops)
    + calcDiversityScore(stops, isFoodTypeSelected)
    + calcCafeBonus(stops)
    + calcDataQualityScore(stops)
    + calcStartAccessScore(stops[0], selectedLocation)
    - calcWeakOtherPenalty(stops, foodTypes)
  );
}

// ─── title generation ────────────────────────────────────────────────────────

function makeTitle(stops, locationLabel) {
  const allCats = stops.flatMap((s) => s.matgilCategoryKeys ?? []);
  const hasCafe = allCats.includes('cafe');
  const hasNonCafe = stops.some((s) =>
    (s.matgilCategoryKeys ?? []).some((k) => k !== 'cafe' && k !== 'other'),
  );
  if (hasCafe && hasNonCafe) return `${locationLabel} Cafe & Bites`;

  const mealCats = allCats.filter((k) => k !== 'cafe' && k !== 'other');
  const freq = {};
  for (const cat of mealCats) freq[cat] = (freq[cat] ?? 0) + 1;
  const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (dominant === 'street') return `${locationLabel} Street Food Tour`;
  if (dominant === 'bbq')    return `${locationLabel} Korean BBQ Route`;
  if (dominant === 'noodle') return `${locationLabel} Noodle Walk`;
  return `${locationLabel} Food Walk`;
}

// ─── public API ──────────────────────────────────────────────────────────────

export function buildTodayCourse({ places, selectedLocation, selectedFoodTypes }) {
  const foodTypes = Array.isArray(selectedFoodTypes) ? selectedFoodTypes : [];

  const validPlaces = places.filter((p) => p && p.latitude != null && p.longitude != null);

  if (validPlaces.length === 0) return null;

  // ── Radius-based candidate selection ──────────────────────────────────────
  // Places are pre-sorted by distance from selectedLocation (via sortPlacesByDistance).
  // We enforce a local radius before scoring so that a tight, high-quality cluster
  // far from selectedLocation cannot outcompete nearby places purely on cluster score.
  //
  // Tier 1 (≤2 km): use only these when any exist — even if fewer than 3 stops.
  // Tier 2 (≤4 km): expand only when tier 1 is empty.
  // Fallback: use the nearest COURSE_CANDIDATE_LIMIT places when both tiers are empty.
  const tier1 = validPlaces.filter((p) => distFromSelected(p, selectedLocation) <= LOCAL_RADIUS_KM);
  const tier2 = validPlaces.filter((p) => distFromSelected(p, selectedLocation) <= EXTENDED_RADIUS_KM);

  let candidates;
  if (tier1.length >= DEFAULT_STOP_COUNT) {
    // 2km 이내 3개 이상: tier1만 사용
    candidates = tier1.slice(0, COURSE_CANDIDATE_LIMIT);
  } else if (tier2.length >= 1) {
    // tier1 부족(< 3): 4km 이내로 확장
    // tier2가 3개 이상이면 3-stop 코스, 부족하면 stopCount가 자동으로 줄어들어 1~2 stop 허용
    candidates = tier2.slice(0, COURSE_CANDIDATE_LIMIT);
  } else {
    // 4km 이내 아무것도 없을 때만 전체 fallback
    candidates = validPlaces.slice(0, COURSE_CANDIDATE_LIMIT);
  }

  const stopCount = Math.min(DEFAULT_STOP_COUNT, candidates.length);
  const combos = combinations(candidates, stopCount);

  const scored = combos.map((stops) => ({
    stops,
    score: calcScore(stops, selectedLocation, foodTypes),
    dist: totalStopDist(stops),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // tie-break 1: shorter total inter-stop distance
    if (Math.abs(a.dist - b.dist) > 1e-9) return a.dist - b.dist;
    // tie-break 2: more stops with images
    const aImg = a.stops.filter((s) => s.imageUrl || s.hasImage).length;
    const bImg = b.stops.filter((s) => s.imageUrl || s.hasImage).length;
    if (aImg !== bImg) return bImg - aImg;
    // tie-break 3: first stop closer to selectedLocation
    const firstDist = (stops) => distFromSelected(stops[0], selectedLocation);
    const diff = firstDist(a.stops) - firstDist(b.stops);
    if (Math.abs(diff) > 1e-9) return diff;
    // tie-break 4: lexicographic by sorted stop ids
    const aKey = a.stops.map((s) => s.id).sort().join(',');
    const bKey = b.stops.map((s) => s.id).sort().join(',');
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  const idealPool = scored.filter((c) => c.dist <= IDEAL_ROUTE_DISTANCE_KM);
  const preferredPool = scored.filter((c) => c.dist <= MAX_PREFERRED_ROUTE_DISTANCE_KM);
  let chosen, routeDistanceLevel;
  if (idealPool.length > 0) {
    chosen = idealPool[0];
    routeDistanceLevel = 'ideal';
  } else if (preferredPool.length > 0) {
    chosen = preferredPool[0];
    routeDistanceLevel = 'preferred';
  } else {
    chosen = scored[0];
    routeDistanceLevel = 'fallback';
  }
  const { stops, score, dist } = chosen;
  const title = makeTitle(stops, selectedLocation.label);

  return {
    id: 'today-pick',
    title,
    stops: stops.map((stop, i) => ({ ...stop, tint: TINTS[i % TINTS.length] })),
    km: `${dist.toFixed(1)} km`,
    hr: ESTIMATED_TIME[stops.length] ?? '~1.5 hr',
    accent: '#F8481F',
    score,
    totalDistanceKm: dist,
    stopCount: stops.length,
    routeDistanceLevel,
  };
}
