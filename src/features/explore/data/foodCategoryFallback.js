const rows = [
  ['bbq', 'Korean BBQ', '고기 구이', 'bbq', 10],
  ['noodle', 'Noodles', '면 요리', 'noodle', 20],
  ['stew', 'Stew & Soup', '찌개·탕', 'stew', 30],
  ['seafood', 'Seafood', '해산물', 'default', 40],
  ['chicken', 'Chicken', '치킨', 'chicken', 50],
  ['street', 'Street Food', '길거리 음식', 'street', 60],
  ['cafe', 'Cafe & Dessert', '카페·디저트', 'cafe', 70],
  ['rice', 'Rice Meals', '밥·덮밥', 'default', 80],
  ['pork', 'Pork Cutlet & Pork', '돼지고기', 'default', 90],
  ['chinese', 'Chinese', '중식', 'default', 100],
  ['japanese', 'Japanese', '일식', 'default', 110],
  ['western', 'Western', '양식', 'default', 120],
  ['pasta', 'Pasta', '파스타', 'default', 130],
  ['pizza', 'Pizza', '피자', 'default', 140],
  ['burger', 'Burger', '버거', 'default', 150],
  ['indian', 'Indian', '인도 음식', 'default', 160],
  ['southeast_asian', 'Southeast Asian', '동남아 음식', 'default', 170],
  ['other', 'Other', '기타', 'default', 999],
];

export const FOOD_CATEGORY_FALLBACK = rows.map(([key, en, ko, iconKey, sortOrder]) => ({
  key, iconKey, sortOrder, isActive: true, isFilterable: true, deletedAt: null,
  translations: { en: { label: en, description: null }, ko: { label: ko, description: null } },
}));
