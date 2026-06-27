import { supabase } from '../../../lib/supabase.js';

export async function fetchPhraseCategories() {
  const { data, error } = await supabase
    .from('mg_phrase_categories')
    .select('id, label_en, label_ko, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label_en,
    labelKo: row.label_ko,
  }));
}

export async function fetchPhrasesByCategory(category) {
  const { data, error } = await supabase
    .from('mg_phrases')
    .select('id, phrase_key, category, ko_text, romanization, en_text, note, bookmark_count, sort_order')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export function normalizePhrase(row, bookmarkedIds = []) {
  return {
    id: row.id,
    phraseKey: row.phrase_key,
    category: row.category,
    korean: row.ko_text,
    romanization: row.romanization ?? '',
    intentEn: row.en_text ?? '',
    note: row.note ?? '',
    bookmarkCount: row.bookmark_count ?? 0,
    isBookmarked: bookmarkedIds.includes(row.id),
  };
}
