import { supabase } from '../../../lib/supabase.js';

export async function fetchMyPhraseBookmarks(userId) {
  const { data, error } = await supabase
    .from('mg_phrase_bookmarks')
    .select('phrase_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.phrase_id);
}

/** Same table as fetchMyPhraseBookmarks(), plus `created_at` and sorted most-recently-
 *  saved first — used by the MyPage "저장한 표현" list, which (unlike the plain id
 *  list above) needs an actual display order. Kept as a separate function rather than
 *  changing fetchMyPhraseBookmarks()'s return shape, since that one's few existing
 *  callers only ever check membership (`ids.includes(...)`) and never cared about order. */
export async function fetchMyPhraseBookmarksDetailed(userId) {
  const { data, error } = await supabase
    .from('mg_phrase_bookmarks')
    .select('phrase_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addPhraseBookmark({ phraseId, userId }) {
  const { error } = await supabase
    .from('mg_phrase_bookmarks')
    .insert({ phrase_id: phraseId, user_id: userId });
  if (error) throw error;
}

export async function removePhraseBookmark({ phraseId, userId }) {
  const { error } = await supabase
    .from('mg_phrase_bookmarks')
    .delete()
    .eq('phrase_id', phraseId)
    .eq('user_id', userId);
  if (error) throw error;
}
