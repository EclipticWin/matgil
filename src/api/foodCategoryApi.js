import { supabase } from '../lib/supabase.js';

export async function getFoodCategories() {
  const [categoriesResult, translationsResult] = await Promise.all([
    supabase.from('mg_food_categories').select('*'),
    supabase.from('mg_food_category_translations').select('*'),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (translationsResult.error) throw translationsResult.error;

  const translationsByKey = {};
  for (const row of translationsResult.data ?? []) {
    if (!translationsByKey[row.category_key]) translationsByKey[row.category_key] = {};
    translationsByKey[row.category_key][row.locale] = {
      label: row.label,
      description: row.description ?? null,
    };
  }

  return (categoriesResult.data ?? []).map((row) => ({
    key: row.key,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isFilterable: row.is_filterable,
    deletedAt: row.deleted_at ?? null,
    translations: translationsByKey[row.key] ?? {},
  }));
}
