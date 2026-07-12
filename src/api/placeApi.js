import { supabase } from "../lib/supabase.js";

export function normalizePlace(row, locale = "ko") {
  const texts = row.mg_place_texts ?? [];

  // Primary text for the requested locale; fallback to the other locale.
  const fallbackLocale = locale === "en" ? "ko" : "en";
  const text =
    texts.find((t) => t.locale === locale) ||
    texts.find((t) => t.locale === fallbackLocale) ||
    {};

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
