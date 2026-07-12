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
