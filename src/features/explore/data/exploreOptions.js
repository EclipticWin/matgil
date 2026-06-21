/** Options for the Map-tab filter sheet + language modal. ids match the
 *  fields on RESTAURANTS (cat / price / features) so filtering is exact.
 *  labelKo is shown in KO mode; label is always the EN fallback. */
export const CATEGORIES = [
  { key: 'all',            label: 'All',              labelKo: '전체' },
  { key: 'bbq',            label: 'Korean BBQ',       labelKo: '한국식 BBQ' },
  { key: 'noodle',         label: 'Noodles',          labelKo: '면 요리' },
  { key: 'stew',           label: 'Stew & Soup',      labelKo: '찌개·탕' },
  { key: 'seafood',        label: 'Seafood',          labelKo: '해산물' },
  { key: 'chicken',        label: 'Chicken',          labelKo: '치킨' },
  { key: 'street',         label: 'Street Food',      labelKo: '길거리 음식' },
  { key: 'cafe',           label: 'Cafe & Dessert',   labelKo: '카페·디저트' },
  { key: 'rice',           label: 'Rice Meals',       labelKo: '밥·덮밥' },
  { key: 'pork',           label: 'Pork Cutlet & Pork', labelKo: '돼지고기' },
  { key: 'chinese',        label: 'Chinese',          labelKo: '중식' },
  { key: 'japanese',       label: 'Japanese',         labelKo: '일식' },
  { key: 'western',        label: 'Western',          labelKo: '양식' },
  { key: 'pasta',          label: 'Pasta',            labelKo: '파스타' },
  { key: 'pizza',          label: 'Pizza',            labelKo: '피자' },
  { key: 'burger',         label: 'Burger',           labelKo: '버거' },
  { key: 'indian',         label: 'Indian',           labelKo: '인도 음식' },
  { key: 'southeast_asian', label: 'Southeast Asian', labelKo: '동남아 음식' },
  { key: 'other',          label: 'Other',            labelKo: '기타' },
];

export const PRICES = ['₩', '₩₩', '₩₩₩'];

export const FEATURES = [
  { id: 'english', label: 'English menu',   labelKo: '영어 메뉴' },
  { id: 'halal',   label: 'Halal options',  labelKo: '할랄 옵션' },
  { id: 'veg',     label: 'Veg friendly',   labelKo: '채식 친화' },
  { id: 'late',    label: 'Late night',     labelKo: '심야 영업' },
];

// code matches locale values ('en' | 'ko') used throughout the app
export const LANGUAGES = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'ko', short: '한', name: '한국어' },
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
