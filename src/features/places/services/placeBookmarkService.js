import { supabase } from '../../../lib/supabase.js';

export async function isPlaceBookmarked({ placeId, userId }) {
  const { data, error } = await supabase
    .from('mg_place_bookmarks')
    .select('place_id')
    .eq('user_id', userId)
    .eq('place_id', placeId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function addPlaceBookmark({ placeId, userId }) {
  const { error } = await supabase
    .from('mg_place_bookmarks')
    .insert({ place_id: placeId, user_id: userId });
  if (error) throw error;
}

export async function removePlaceBookmark({ placeId, userId }) {
  const { error } = await supabase
    .from('mg_place_bookmarks')
    .delete()
    .eq('place_id', placeId)
    .eq('user_id', userId);
  if (error) throw error;
}
