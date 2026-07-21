/** Options for the Map-tab filter sheet + language modal. ids match the
 *  fields on RESTAURANTS (cat / price / features) so filtering is exact.
 *  labelKo is shown in KO mode; label is always the EN fallback. */
export const PRICES = ['₩', '₩₩', '₩₩₩'];

export const FEATURES = [
  { id: 'english', label: 'English menu', labelKo: '영어 메뉴' },
  { id: 'halal', label: 'Halal options', labelKo: '할랄 옵션' },
  { id: 'veg', label: 'Veg friendly', labelKo: '채식 친화' },
  { id: 'late', label: 'Late night', labelKo: '심야 영업' },
];

// code matches locale values ('en' | 'ko' | 'zh-CN') used throughout the app
export const LANGUAGES = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'ko', short: '한', name: '한국어' },
  { code: 'zh-CN', short: '中', name: '简体中文' },
];

export const EMPTY_FILTERS = { cat: [], price: [], features: [], minimumRating: 0 };

export const filterCount = (f) =>
  (Array.isArray(f.cat) ? f.cat.length : 0) + f.price.length + f.features.length + (f.minimumRating > 0 ? 1 : 0);

function matchesCat(place, cats) {
  const arr = Array.isArray(cats) ? cats : [];
  if (arr.length === 0) return true;
  return arr.some((cat) => (place.matgilCategoryKeys ?? []).includes(cat));
}

/** A place passes when its average review rating (mg_place_review_stats.rating_avg,
 *  merged onto the place object as ratingAvg/ratingCount by getPlacesWithReviewStats)
 *  is at or above minimumRating. Places with no reviews yet, or whose stats came back
 *  non-numeric, only pass when no minimum is set (0 = no rating filter). */
function matchesRating(place, minimumRating) {
  const min = Number(minimumRating) || 0;
  if (min <= 0) return true;
  const avg = Number(place.ratingAvg);
  const count = Number(place.ratingCount);
  return Number.isFinite(avg) && Number.isFinite(count) && count > 0 && avg >= min;
}

/** Apply the current filters to a list of restaurants. */
export function applyFilters(list, f) {
  return list.filter(
    (r) =>
      matchesCat(r, f.cat) &&
      (f.price.length === 0 || f.price.includes(r.price)) &&
      (f.features.length === 0 || f.features.every((x) => (r.features || []).includes(x))) &&
      matchesRating(r, f.minimumRating),
  );
}
