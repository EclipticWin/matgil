import { supabase } from '../../../lib/supabase.js';

const REVIEW_IMAGE_BUCKET = 'place-review-images';

function normalizeReview(row) {
  const images = (row.mg_place_review_images ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img) => supabase.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(img.storage_path).data?.publicUrl)
    .filter(Boolean);

  return {
    id: row.id,
    placeId: row.place_id,
    userId: row.user_id,
    authorName: row.author_name,
    rating: row.rating,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    images,
  };
}

/** Average rating + review count for one place. Returns null when the place has no reviews yet
 *  (mg_place_review_stats has no row for it — this is expected, not an error). */
export async function fetchPlaceReviewStats(placeId) {
  const { data, error } = await supabase
    .from('mg_place_review_stats')
    .select('*')
    .eq('place_id', placeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Reviews for one place, newest first (created_at desc, id desc — matches the
 *  partial index backing this query). Pass `cursor` (the last row of the previous
 *  page) for cursor-based pagination instead of offset pagination. */
export async function fetchPlaceReviews({ placeId, cursor = null, limit = 5 }) {
  let query = supabase
    .from('mg_place_reviews')
    .select('*, mg_place_review_images(storage_path, sort_order)')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeReview);
}

/** The current user's own active review for a place, or null if they haven't written one yet.
 *  Used to show "you already reviewed this place" instead of the write form. */
export async function fetchMyPlaceReview({ placeId, userId }) {
  const { data, error } = await supabase
    .from('mg_place_reviews')
    .select('*, mg_place_review_images(storage_path, sort_order)')
    .eq('place_id', placeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeReview(data) : null;
}

/** Creates a review. place_id/rating/content/ui_locale are the only columns the
 *  authenticated role may insert — user_id defaults to auth.uid() and author_name
 *  is server-enforced by a trigger (see docs/sql-place-detail-bookmark-review-2026-07-12.md). */
export async function createPlaceReview({ placeId, rating, content, uiLocale }) {
  const { data, error } = await supabase
    .from('mg_place_reviews')
    .insert({ place_id: placeId, rating, content: content || null, ui_locale: uiLocale })
    .select('*, mg_place_review_images(storage_path, sort_order)')
    .single();
  if (error) throw error;
  return normalizeReview(data);
}

/** Updates a review. Only rating/content are ever sent — matches the exact column
 *  grant given to authenticated (place_id/user_id/author_name/created_at/edited_at
 *  are not updatable this way; author_name stays server-enforced, edited_at is
 *  recomputed by the mg_place_reviews_before_write trigger only when rating or
 *  content actually changed). */
export async function updatePlaceReview({ reviewId, rating, content }) {
  const { data, error } = await supabase
    .from('mg_place_reviews')
    .update({ rating, content: content || null })
    .eq('id', reviewId)
    .select('*, mg_place_review_images(storage_path, sort_order)')
    .single();
  if (error) throw error;
  return normalizeReview(data);
}

/** Soft-deletes the caller's own review via the dedicated RPC — deleted_at/deleted_by
 *  are not directly updatable by authenticated, this is the only allowed path. */
export async function deletePlaceReview(reviewId) {
  const { error } = await supabase.rpc('soft_delete_my_place_review', { p_review_id: reviewId });
  if (error) throw error;
}

/** Rating-only fetch across every active review for a place, used to compute the
 *  5→1 star distribution. A single skinny column, not the paginated review list,
 *  so the distribution stays accurate regardless of how many pages are loaded. */
export async function fetchPlaceRatingDistribution(placeId) {
  const { data, error } = await supabase
    .from('mg_place_reviews')
    .select('rating')
    .eq('place_id', placeId);
  if (error) throw error;

  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of data ?? []) {
    if (counts[row.rating] != null) counts[row.rating] += 1;
  }
  return counts;
}
