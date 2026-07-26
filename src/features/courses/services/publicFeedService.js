import { supabase } from '../../../lib/supabase.js';
import { MAX_PUBLIC_FEED_ITEMS } from '../constants/publicFeed.js';

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

/** Best-effort single-route lookup by public_route_key, for PublicCourseDetailPage's
 *  direct-URL-access/refresh case (no router state to use for first paint).
 *
 *  There is no dedicated by-key public RPC yet — get_public_course_feed only
 *  supports sort+limit+offset pagination (see fetchPublicCourseFeed above). Per
 *  this feature's scope, no new RPC is invented/called here; instead this reuses
 *  that existing RPC across both sort orders, up to the same MAX_PUBLIC_FEED_ITEMS
 *  cap the list itself is capped at, and searches the combined rows for the key.
 *  A route that has fallen out of BOTH the popular and latest "top N" windows
 *  will come back as not-found (null) even though it may still technically be a
 *  valid public route elsewhere in the full feed — this is a known, accepted
 *  limitation of doing this without a real by-key RPC (see
 *  docs/sql-public-course-detail-rpc-2026-07-27.md for the proper fix this
 *  should eventually be replaced with).
 *
 *  Returns null ONLY for a genuine miss (both RPC calls succeeded, neither
 *  contained the key) — callers should treat that as "not found". A failed
 *  RPC call (network/server error) throws, same as fetchPublicCourseFeed
 *  itself — callers should treat that as a retryable load error, distinct
 *  from "not found". */
export async function fetchPublicCourseByKey(publicRouteKey) {
  if (!publicRouteKey) return null;
  const [popular, latest] = await Promise.all([
    fetchPublicCourseFeed({ sort: 'popular', limit: MAX_PUBLIC_FEED_ITEMS, offset: 0 }),
    fetchPublicCourseFeed({ sort: 'latest', limit: MAX_PUBLIC_FEED_ITEMS, offset: 0 }),
  ]);
  return [...popular, ...latest].find((row) => row.public_route_key === publicRouteKey) ?? null;
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
