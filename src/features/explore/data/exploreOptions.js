/** Options for the Map-tab filter sheet + language modal. ids match the
 *  fields on RESTAURANTS (cat / price / features) so filtering is exact. */
export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'bbq', label: 'Korean BBQ' },
  { key: 'street', label: 'Street Food' },
  { key: 'noodle', label: 'Noodles' },
  { key: 'cafe', label: 'Café' },
  { key: 'stew', label: 'Stew & Soup' },
  { key: 'chicken', label: 'Chicken' },
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

export const EMPTY_FILTERS = { cat: 'all', price: [], features: [] };

export const filterCount = (f) =>
  (f.cat !== 'all' ? 1 : 0) + f.price.length + f.features.length;

/** Apply the current filters to a list of restaurants. */
export function applyFilters(list, f) {
  return list.filter(
    (r) =>
      (f.cat === 'all' || r.cat === f.cat) &&
      (f.price.length === 0 || f.price.includes(r.price)) &&
      (f.features.length === 0 || f.features.every((x) => (r.features || []).includes(x))),
  );
}
