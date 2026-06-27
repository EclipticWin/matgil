import { supabase } from '../../../lib/supabase.js';

export async function fetchMyPhraseBookmarks(userId) {
  const { data, error } = await supabase
    .from('mg_phrase_bookmarks')
    .select('phrase_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.phrase_id);
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
