import { supabase } from '../../../lib/supabase.js';
import { getPlacesByIds } from '../../../api/placeApi.js';
import { calcDistanceKm, DEFAULT_LOCATION } from '../../explore/data/locations.js';

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

/** Batched save-count lookup via mg_place_bookmark_stats (place_id, save_count only —
 *  no bookmarking user is ever exposed). One query regardless of list size, keyed by
 *  place_id. Places with zero saves have no row in the view and are absent from the
 *  returned map — callers should default to 0 with `.get(id) ?? 0`. */
export async function fetchPlaceBookmarkStatsBatch(placeIds) {
  const uniqueIds = [...new Set((placeIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('mg_place_bookmark_stats')
    .select('place_id, save_count')
    .in('place_id', uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.place_id, row.save_count]));
}

/** The current user's saved places, most recently bookmarked first. One bookmarks
 *  query + one batched place lookup (getPlacesByIds), regardless of list size — no
 *  per-place request. Each place gets a `distanceKm` from Seoul City Hall (the app's
 *  default reference point) so cards can reuse the existing distance formatting. */
export async function fetchSavedPlaces({ userId, locale = 'ko' }) {
  const { data: bookmarks, error } = await supabase
    .from('mg_place_bookmarks')
    .select('place_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!bookmarks || bookmarks.length === 0) return [];

  const placeIds = bookmarks.map((row) => row.place_id);
  const places = await getPlacesByIds(placeIds, locale);
  const placeById = new Map(places.map((place) => [place.id, place]));

  return bookmarks
    .map((row) => placeById.get(row.place_id))
    .filter(Boolean)
    .map((place) => ({
      ...place,
      distanceKm: place.latitude != null && place.longitude != null
        ? calcDistanceKm(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, place.latitude, place.longitude)
        : null,
    }));
}
