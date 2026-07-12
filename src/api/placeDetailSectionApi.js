import { supabase } from '../lib/supabase.js';

export async function getPlaceDetailSections() {
  const [sectionsResult, translationsResult] = await Promise.all([
    supabase.from('mg_place_detail_sections').select('*'),
    supabase.from('mg_place_detail_section_translations').select('*'),
  ]);

  if (sectionsResult.error) throw sectionsResult.error;
  if (translationsResult.error) throw translationsResult.error;

  const translationsByKey = {};
  for (const row of translationsResult.data ?? []) {
    if (!translationsByKey[row.section_key]) translationsByKey[row.section_key] = {};
    translationsByKey[row.section_key][row.locale] = {
      label: row.label,
      emptyTitle: row.empty_title,
      emptyDescription: row.empty_description,
    };
  }

  return (sectionsResult.data ?? [])
    .map((row) => ({
      key: row.section_key,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      translations: translationsByKey[row.section_key] ?? {},
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}
