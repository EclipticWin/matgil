/** Restaurant phrases grouped by situation. `ko` is spoken via TTS. */
export const PHRASE_CATEGORIES = [
  { id: 'arriving', label: 'Getting seated' },
  { id: 'ordering', label: 'Ordering' },
  { id: 'during', label: 'During the meal' },
  { id: 'paying', label: 'Paying' },
];

export const PHRASES = [
  { id: 'p-seat-1', category: 'arriving', ko: '두 명이요', ro: 'Du myeong-iyo', en: 'Table for two, please' },
  { id: 'p-seat-2', category: 'arriving', ko: '자리 있어요?', ro: 'Jari isseoyo?', en: 'Do you have a table?' },
  { id: 'p-order-1', category: 'ordering', ko: '메뉴 주세요', ro: 'Menyu juseyo', en: 'Menu, please' },
  { id: 'p-order-2', category: 'ordering', ko: '이거 주세요', ro: 'Igeo juseyo', en: "I'll have this, please" },
  { id: 'p-order-3', category: 'ordering', ko: '안 맵게 해 주세요', ro: 'An maepge hae juseyo', en: 'Not spicy, please' },
  { id: 'p-order-4', category: 'ordering', ko: '추천 메뉴가 뭐예요?', ro: 'Chucheon menyuga mwoyeyo?', en: 'What do you recommend?' },
  { id: 'p-during-1', category: 'during', ko: '맛있어요!', ro: 'Masisseoyo!', en: "It's delicious!" },
  { id: 'p-during-2', category: 'during', ko: '물 좀 주세요', ro: 'Mul jom juseyo', en: 'Water, please' },
  { id: 'p-during-3', category: 'during', ko: '리필 돼요?', ro: 'Ripil dwaeyo?', en: 'Can I get a refill?' },
  { id: 'p-pay-1', category: 'paying', ko: '계산서 주세요', ro: 'Gyesanseo juseyo', en: 'Check, please' },
  { id: 'p-pay-2', category: 'paying', ko: '카드 돼요?', ro: 'Kadeu dwaeyo?', en: 'Do you take card?' },
];
