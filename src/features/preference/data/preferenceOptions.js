/**
 * Preference options for the recommendation flow.
 * `food` ids match restaurant `cat` values in mockRecommendations.js.
 * Designed to grow — add groups/options without touching the selector UI.
 */
export const FOOD_PREFERENCES = [
  { id: 'bbq', label: 'Korean BBQ' },
  { id: 'street', label: 'Street Food' },
  { id: 'noodle', label: 'Noodles' },
  { id: 'cafe', label: 'Café' },
  { id: 'stew', label: 'Stew & Soup' },
  { id: 'chicken', label: 'Chicken' },
];

export const DIETARY_PREFERENCES = [
  { id: 'english', label: 'English menu' },
  { id: 'halal', label: 'Halal options' },
  { id: 'veg', label: 'Veg friendly' },
  { id: 'budget', label: 'Budget friendly' },
];
