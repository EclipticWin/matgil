/** Options for the Map-tab filter sheet + language modal. ids match the
 *  fields on RESTAURANTS (cat / price / features) so filtering is exact. */
export const CATEGORIES = [
  { key: 'all',           label: 'All' },
  { key: 'bbq',           label: 'Korean BBQ' },
  { key: 'noodle',        label: 'Noodles' },
  { key: 'stew',          label: 'Stew & Soup' },
  { key: 'seafood',       label: 'Seafood' },
  { key: 'chicken',       label: 'Chicken' },
  { key: 'street',        label: 'Street Food' },
  { key: 'cafe',          label: 'Cafe & Dessert' },
  { key: 'rice',          label: 'Rice Meals' },
  { key: 'pork',          label: 'Pork Cutlet & Pork' },
  { key: 'chinese',       label: 'Chinese' },
  { key: 'japanese',      label: 'Japanese' },
  { key: 'western',       label: 'Western' },
  { key: 'pasta',         label: 'Pasta' },
  { key: 'pizza',         label: 'Pizza' },
  { key: 'burger',        label: 'Burger' },
  { key: 'indian',        label: 'Indian' },
  { key: 'southeast_asian', label: 'Southeast Asian' },
  { key: 'other',         label: 'Other' },
];

export const PRICES = ['₩', '₩₩', '₩₩₩'];

export const FEATURES = [
  { id: 'english', label: 'English menu' },
  { id: 'halal', label: 'Halal options' },
  { id: 'veg', label: 'Veg friendly' },
  { id: 'late', label: 'Late night' },
];

export const LANGUAGES = [
  { code: 'EN', short: 'EN', name: 'English' },
  { code: 'KO', short: '한', name: '한국어' },
  { code: 'ZH', short: '中', name: '中文' },
  { code: 'JA', short: '日', name: '日本語' },
];

export const EMPTY_FILTERS = { cat: [], price: [], features: [] };

export const filterCount = (f) =>
  (Array.isArray(f.cat) ? f.cat.length : 0) + f.price.length + f.features.length;

function matchesCat(place, cats) {
  const arr = Array.isArray(cats) ? cats : [];
  if (arr.length === 0) return true;
  return arr.some((cat) => (place.matgilCategoryKeys ?? []).includes(cat));
}

/** Apply the current filters to a list of restaurants. */
export function applyFilters(list, f) {
  return list.filter(
    (r) =>
      matchesCat(r, f.cat) &&
      (f.price.length === 0 || f.price.includes(r.price)) &&
      (f.features.length === 0 || f.features.every((x) => (r.features || []).includes(x))),
  );
}
