import { supabase } from '../../../lib/supabase.js';

/** Public "popular routes" feed (Explore tab) — every row also carries
 *  `total_count` (same value on every row) so callers can compute `hasMore`
 *  without a separate count query. Errors are thrown, not swallowed — callers
 *  decide how to show a failed-load state. */
export async function fetchPublicCourseFeed({ sort = 'popular', limit = 10, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_public_course_feed', {
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

/** Public "popular places" feed — place_id + aggregate stats only; callers
 *  batch-resolve the actual place records via getPlacesByIds(). */
export async function fetchPublicPlaceFeed({ sort = 'popular', limit = 10, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_public_place_feed', {
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

/** Toggles the current user's save on a public route (identified by its
 *  public_route_key, never the underlying mg_saved_courses id of whichever
 *  user's save the public feed happens to be representing). The RPC does the
 *  save/un-save (insert or soft-delete) and returns the resulting state —
 *  callers should prefer this over re-deriving it from their own optimistic
 *  update. */
export async function togglePublicCourseSave({ publicRouteKey }) {
  const { data, error } = await supabase.rpc('toggle_public_course_save', {
    p_public_route_key: publicRouteKey,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/** The current user's saved-course/saved-place counts (MyPage's two new
 *  StatCards) — one RPC call, server-computed so it can't drift from what
 *  fetchSavedCourses()/fetchSavedPlaces() would actually return. */
export async function fetchMySavedCounts() {
  const { data, error } = await supabase.rpc('get_my_saved_counts');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    savedCourseCount: row?.saved_course_count ?? 0,
    savedPlaceCount: row?.saved_place_count ?? 0,
  };
}
