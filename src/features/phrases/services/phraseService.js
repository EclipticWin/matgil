import { supabase } from '../../../lib/supabase.js';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

export async function fetchPhraseCategories() {
  const { data, error } = await supabase
    .from('mg_phrase_categories')
    .select('id, label_en, label_ko, label_zh, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label_en,
    labelKo: row.label_ko,
    labelZh: row.label_zh,
  }));
}

export async function fetchPhrasesByCategory(category) {
  const { data, error } = await supabase
    .from('mg_phrases')
    .select('id, phrase_key, category, ko_text, romanization, en_text, zh_text, note, bookmark_count, sort_order')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchPopularPhrases({ category = 'all', limit = 10 } = {}) {
  let query = supabase
    .from('mg_phrases')
    .select('id, phrase_key, category, ko_text, romanization, en_text, zh_text, note, bookmark_count, sort_order')
    .eq('is_active', true)
    .gt('bookmark_count', 0)
    .order('bookmark_count', { ascending: false })
    .order('id', { ascending: true })
    .limit(limit);

  if (category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** `korean` (`ko_text`) is the phrase itself — always Korean regardless of UI
 *  locale, since Phrases teaches Korean to foreign visitors (see ai-docs/18).
 *  `meaning` is the gloss shown under it. It deliberately has no `ko` entry:
 *  the ko UI locale showed the en_text gloss before zh-CN existed (unchanged
 *  behavior — showing ko_text twice, identical to `korean` above, would be a
 *  regression, not a fix), so ko falls through to en exactly as before.
 *  zh-CN gets its own zh_text gloss (falling back to en if not yet
 *  translated); a future ja would add `ja: row.ja_text` here the same way. */
export function normalizePhrase(row, locale, bookmarkedIds = []) {
  return {
    id: row.id,
    phraseKey: row.phrase_key,
    category: row.category,
    korean: row.ko_text,
    romanization: row.romanization ?? '',
    meaning: pickTranslated({ en: row.en_text, 'zh-CN': row.zh_text }, locale) ?? row.en_text ?? '',
    note: row.note ?? '',
    bookmarkCount: row.bookmark_count ?? 0,
    isBookmarked: bookmarkedIds.includes(row.id),
  };
}
