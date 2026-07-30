import { getPlacesByIds } from '../../../api/placeApi.js';
import { supabase } from '../../../lib/supabase.js';
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

export async function fetchPlaceBookmarkCount(placeId) {
  const numericPlaceId = Number(placeId);
  if (!Number.isFinite(numericPlaceId) || numericPlaceId <= 0) return 0;

  const { data, error } = await supabase.rpc('get_place_bookmark_count', {
    p_place_id: numericPlaceId,
  });

  if (error) throw error;
  return Number(data) || 0;
}

/** Batched save-count lookup — calls fetchPlaceBookmarkCount(id) (the same
 *  get_place_bookmark_count RPC PlaceDetailSheet.jsx uses) once per unique
 *  place id, in parallel, and collects the results into a Map.
 *
 *  This used to query the mg_place_bookmark_stats view directly
 *  (`supabase.from('mg_place_bookmark_stats')...`). That view is created
 *  `security_invoker = true` (docs/42 §3), so its `count(*)` runs under the
 *  querying user's own RLS on the underlying mg_place_bookmarks table —
 *  effectively only counting whatever bookmark rows the current caller is
 *  allowed to see, not the true public total. That is the same problem
 *  PlaceDetailSheet.jsx's own save count used to have before it was switched
 *  to get_place_bookmark_count (docs/61 §7); this batch function was left on
 *  the old path at the time and never migrated, which is the actual cause of
 *  course-detail stop cards showing 0/understated hearts while the place
 *  detail screen for the same place shows the correct count.
 *
 *  A course's stop list is small (a handful of places), so N parallel RPC
 *  calls here is an acceptable, minimal fix that reuses the existing,
 *  already-correct single-place RPC instead of adding a new batch RPC. Every
 *  requested id (including ones with zero saves) is present in the returned
 *  Map, keyed and valued as numbers. A failed RPC call for any id is not
 *  swallowed here — it propagates via Promise.all so callers' existing
 *  `.catch()` treats it as a load failure, the same as before, instead of
 *  silently reporting an incorrect 0. */
export async function fetchPlaceBookmarkStatsBatch(placeIds) {
  const uniqueIds = [...new Set((placeIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const counts = await Promise.all(uniqueIds.map((id) => fetchPlaceBookmarkCount(id)));
  return new Map(uniqueIds.map((id, index) => [id, Number(counts[index]) || 0]));
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
