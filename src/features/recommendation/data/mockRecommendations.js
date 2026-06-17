/**
 * Mock restaurant pool used to assemble recommended routes.
 * `cat` matches the food preference ids; `features` matches dietary ids.
 */
export const RESTAURANTS = [
  { id: 'r4', name: 'Tteok Street Kitchen', cuisine: 'Street Food · Tteokbokki', cat: 'street', rating: 4.6, reviews: '3.4k', price: '₩', area: 'Myeongdong', features: ['budget'], tint: '#FBE0E4' },
  { id: 'r2', name: 'Gogi House BBQ', cuisine: 'Korean BBQ · Pork belly', cat: 'bbq', rating: 4.7, reviews: '1.3k', price: '₩₩₩', area: 'Myeongdong', features: ['halal', 'english'], tint: '#FFEFC9' },
  { id: 'r6', name: 'Chimaek Corner', cuisine: 'Chicken · Beer', cat: 'chicken', rating: 4.7, reviews: '1.9k', price: '₩₩', area: 'Myeongdong', features: [], tint: '#FFE0CE' },
  { id: 'r1', name: 'Myeongdong Gyoza', cuisine: 'Dumplings · Kalguksu', cat: 'noodle', rating: 4.8, reviews: '2.1k', price: '₩₩', area: 'Myeongdong', features: ['english'], tint: '#FFE3D4' },
  { id: 'r3', name: 'Hodu Coffee Bar', cuisine: 'Coffee · Walnut cake', cat: 'cafe', rating: 4.9, reviews: '860', price: '₩₩', area: 'Myeongdong', features: ['veg'], tint: '#E2F1DE' },
  { id: 'r5', name: 'Jjigae Jip', cuisine: 'Stew · Kimchi jjigae', cat: 'stew', rating: 4.5, reviews: '720', price: '₩₩', area: 'Euljiro', features: ['english'], tint: '#DDEFEA' },
  { id: 'r7', name: 'Gwangjang Bites', cuisine: 'Street Food · Bindaetteok', cat: 'street', rating: 4.8, reviews: '5.2k', price: '₩', area: 'Gwangjang Market', features: ['budget'], tint: '#E6E9F7' },
  { id: 'r8', name: 'Seoul Ramyeon Lab', cuisine: 'Noodles · Ramyeon', cat: 'noodle', rating: 4.4, reviews: '540', price: '₩₩', area: 'Euljiro', features: ['veg'], tint: '#E2F1DE' },
];
