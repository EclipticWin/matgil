import { supabase } from "../lib/supabase.js";
import { pickTranslatedRow } from "../shared/i18n/localeFallback.js";
import { fetchAllPlaceReviewStats } from "../features/places/services/placeReviewService.js";

export function normalizePlace(row, locale = "ko") {
  const texts = row.mg_place_texts ?? [];

  // Primary text for the requested locale; fallback down its shared locale
  // chain (see src/shared/i18n/localeFallback.js).
  const text = pickTranslatedRow(texts, locale) ?? {};

  // Always store the Korean name regardless of locale — used by
  // anchorMatchService to match Kakao results (which always return Korean names).
  const textKo = texts.find((t) => t.locale === "ko") ?? {};

  const details = (row.mg_place_food_details ?? [])[0] ?? {};

  const images = (row.mg_place_images ?? []).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const imageUrl =
    images[0]?.image_url || row.default_image_url || null;

  return {
    id: row.id,
    name: text.name ?? null,
    nameKo: textKo.name ?? null,
    address: text.address ?? null,
    description: text.description ?? null,
    imageUrl,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,

    firstMenu: text.first_menu ?? null,
    treatMenu: text.treat_menu ?? null,
    openTime: text.open_time ?? null,
    restDate: text.rest_date ?? null,
    parking: text.parking ?? null,
    packing: text.packing ?? null,
    tags: text.tags ?? [],

    tel: details.tel ?? null,
    hasParking: details.has_parking ?? null,
    hasPacking: details.has_packing ?? null,
    hasOpenTime: details.has_open_time ?? false,
    hasMenuInfo: details.has_menu_info ?? false,
    hasImage: details.has_image ?? false,
    hasLocation: details.has_location ?? false,

    matgilCategoryKeys: row.matgil_category_keys ?? [],

    // Only ever populated by getPlacesWithReviewStats() below (Map tab) — a plain
    // getPlaces() call leaves these at their no-reviews-yet default.
    ratingAvg: null,
    ratingCount: 0,
  };
}

export async function getPlaces(locale = "ko") {
  const { data, error } = await supabase
    .from("mg_places")
    .select(
      `
      id,
      latitude,
      longitude,
      default_image_url,
      matgil_category_keys,
      mg_place_texts(locale, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags),
      mg_place_food_details(tel, has_parking, has_packing, has_open_time, has_menu_info, has_image, has_location),
      mg_place_images(image_url, thumbnail_url, sort_order)
    `
    )
    .eq("is_active", true)
    .order("id");

  if (error) throw error;

  return (data ?? []).map((row) => normalizePlace(row, locale));
}

/** Map tab only — everything getPlaces() returns, plus mg_place_review_stats merged
 *  onto each place (ratingAvg/ratingCount), for the FilterSheet's minimum-rating
 *  filter. Kept separate from getPlaces() so PopularPage/recommendationService/etc.
 *  never pay for a stats fetch they don't use.
 *
 *  Fetches all active places and all review-stats rows independently (fetchAllPlaceReviewStats(),
 *  paginated — never a per-place or single oversized .in() lookup) and merges them by place_id.
 *  If the stats fetch fails, the place list is still returned in full — only
 *  reviewStatsAvailable flips to false, so the caller can disable the rating filter
 *  without losing FOOD TYPE filtering or location-based recommendations. A stats
 *  fetch that succeeds with zero rows (e.g. no reviews exist yet) is a normal,
 *  available result — reviewStatsAvailable stays true. */
export async function getPlacesWithReviewStats(locale = "ko") {
  const places = await getPlaces(locale);

  let statsByPlaceId;
  try {
    statsByPlaceId = await fetchAllPlaceReviewStats();
  } catch {
    return { places, reviewStatsAvailable: false };
  }

  const merged = places.map((p) => {
    const stats = statsByPlaceId.get(p.id);
    return stats ? { ...p, ratingAvg: stats.ratingAvg, ratingCount: stats.ratingCount } : p;
  });
  return { places: merged, reviewStatsAvailable: true };
}

/** Batched lookup for a set of place ids — one query regardless of list size (used by
 *  Saved Places, which otherwise would need one getPlaceById call per bookmarked place). */
export async function getPlacesByIds(ids, locale = "ko") {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("mg_places")
    .select(
      `
      id,
      latitude,
      longitude,
      default_image_url,
      matgil_category_keys,
      mg_place_texts(locale, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags),
      mg_place_food_details(tel, has_parking, has_packing, has_open_time, has_menu_info, has_image, has_location),
      mg_place_images(image_url, thumbnail_url, sort_order)
    `
    )
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []).map((row) => normalizePlace(row, locale));
}

/** Single-place lookup (used e.g. as a place-name fallback on a deep-linked reviews page). */
export async function getPlaceById(id, locale = "ko") {
  const { data, error } = await supabase
    .from("mg_places")
    .select(
      `
      id,
      latitude,
      longitude,
      default_image_url,
      matgil_category_keys,
      mg_place_texts(locale, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags),
      mg_place_food_details(tel, has_parking, has_packing, has_open_time, has_menu_info, has_image, has_location),
      mg_place_images(image_url, thumbnail_url, sort_order)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePlace(data, locale) : null;
}
