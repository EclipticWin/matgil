import { supabase } from '../../../lib/supabase.js';
import { computeCourseThemeKey } from '../utils/courseDisplay.js';
import { extractDistrictKo } from '../../explore/data/seoulDistricts.js';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Thrown by saveCourse() when the DB's active-route uniqueness index
 *  (uq_mg_saved_courses_user_route_signature_active — see docs/42) rejects the
 *  insert: same user, same place-set (regardless of stop order), already saved
 *  and not soft-deleted. Callers should show a "already saved" message instead of
 *  a generic save-failed one. */
export class DuplicateCourseError extends Error {
  constructor() {
    super('duplicate-course');
    this.name = 'DuplicateCourseError';
  }
}

/** Order-independent duplicate signature: dedup + ascending numeric sort, joined
 *  with '-' (e.g. [980, 92, 477] -> "92-477-980"). Mirrors the DB backfill done for
 *  existing rows (docs/42 §8) exactly, so newly-saved rows compare equal to older
 *  ones with the same place set regardless of which was saved in which order.
 *  Returns null for an empty/invalid id list — the partial UNIQUE index excludes
 *  null route_signature rows, so this intentionally opts such rows out of dedup
 *  rather than have every one of them collide on the same NULL. */
function buildRouteSignature(placeIds) {
  const normalized = [...new Set(placeIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (normalized.length === 0) return null;
  normalized.sort((a, b) => a - b);
  return normalized.join('-');
}

/** Maps the UI's selectedLocation (see HomePage.jsx: preset/search/map/gps shapes)
 *  to mg_saved_courses' anchor_* columns (docs/42 §12, refined by docs/45 to split
 *  "title-sized area" from "detail-sized specific location"). Provider-agnostic
 *  column names (not kakao_*) since a future map provider swap shouldn't require a
 *  schema change.
 *
 *  - anchor_area_original: wide district, used for the course TITLE. map/gps get it
 *    from reverseGeocodeCoords() (loc.area); search doesn't get its own geocode
 *    call (it already has an address from the Kakao Places result), so its area is
 *    extracted from that address with the same regex SearchOverlay already uses.
 *  - anchor_name_original: specific place/building/facility name, used for the
 *    Saved Courses detail's "기준 위치" line. search's is the picked place's name;
 *    map/gps's is Kakao's geocoded road_address.building_name when the coordinate
 *    happens to land inside a named building (often empty — that's expected, see
 *    getAnchorDisplayLocation()'s address/area fallbacks).
 *  - anchor_address_original: road-name (falls back to jibun) address, populated
 *    for search/map/gps alike now — previously search's address was discarded. */
function buildAnchorFields(selectedLocation) {
  const loc = selectedLocation ?? {};
  const anchorType = loc.source === 'search' || loc.source === 'gps' || loc.source === 'map'
    ? loc.source
    : 'preset';
  const hasGeoContext = anchorType === 'search' || anchorType === 'map' || anchorType === 'gps';

  const areaOriginal = anchorType === 'search'
    ? (loc.area ?? extractDistrictKo(loc.address))
    : (loc.area ?? null);

  const nameOriginal = anchorType === 'search'
    ? (loc.label ?? null)
    : (loc.placeName ?? null);

  return {
    anchor_type: anchorType,
    anchor_key: anchorType === 'preset' ? (loc.key ?? null) : null,
    anchor_name_original: hasGeoContext ? nameOriginal : null,
    anchor_area_original: hasGeoContext ? areaOriginal : null,
    anchor_address_original: hasGeoContext ? (loc.address ?? null) : null,
    anchor_lat: Number.isFinite(loc.lat) ? loc.lat : null,
    anchor_lng: Number.isFinite(loc.lng) ? loc.lng : null,
  };
}

export async function fetchSavedCourses({ userId }) {
  const { data, error } = await supabase
    .from('mg_saved_courses')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveCourse({ userId, locale, course, selectedLocation, metrics, preferenceKeys = [] }) {
  const { totalDistanceM, totalDurationMin, distanceSource, durationSource } = metrics;

  const placeIds = (course.stops ?? [])
    .map((stop) => Number(stop.id ?? stop.place_id ?? stop.placeId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const cleanPreferenceKeys = Array.isArray(preferenceKeys) ? preferenceKeys.filter(Boolean) : [];
  const anchorFields = buildAnchorFields(selectedLocation);

  const courseSnapshot = {
    ...course,
    anchor_label: selectedLocation?.label ?? '',
    // Map-service-agnostic (not tied to Kakao specifically) — read by
    // getSavedCourseAnchorDisplay() for the Saved Courses detail header.
    anchor_address: selectedLocation?.address ?? null,
    anchor_lat: selectedLocation?.lat ?? null,
    anchor_lng: selectedLocation?.lng ?? null,
    anchor_source: selectedLocation?.source ?? null,
    normalizedMetrics: {
      totalDistanceM,
      totalDurationMin,
      distanceSource,
      durationSource,
    },
  };

  const { data, error } = await supabase
    .from('mg_saved_courses')
    .insert({
      user_id: userId,
      locale: locale ?? 'en',
      title: course.title ?? '',
      subtitle: '',
      description: '',
      anchor_label: selectedLocation?.label ?? '',
      total_distance_m: totalDistanceM,
      total_duration_min: totalDurationMin,
      stop_count: course.stopCount ?? (course.stops?.length ?? 0),
      place_ids: placeIds,
      stops: course.stops ?? [],
      course_snapshot: courseSnapshot,
      ...anchorFields,
      preference_keys: cleanPreferenceKeys,
      course_theme_key: computeCourseThemeKey(course.stops, cleanPreferenceKeys),
      route_signature: buildRouteSignature(placeIds),
      title_schema_version: 2,
    })
    .select()
    .single();

  if (error) {
    if (error.code === POSTGRES_UNIQUE_VIOLATION) throw new DuplicateCourseError();
    throw error;
  }
  return data;
}

export async function fetchSavedCourseById({ userId, courseId }) {
  const { data, error } = await supabase
    .from('mg_saved_courses')
    .select('*')
    .eq('id', courseId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteSavedCourse({ userId, courseId }) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('mg_saved_courses')
    .update({ deleted_at: now, deleted_by: userId, updated_at: now })
    .eq('id', courseId)
    .eq('user_id', userId);
  if (error) throw error;
}

function getCoursePlaceIds(course) {
  return (course?.stops ?? [])
    .map((stop) => Number(stop.id ?? stop.place_id ?? stop.placeId))
    .filter((id) => Number.isFinite(id) && id > 0);
}

// Ascending numeric sort (never lexicographic — "100" must not sort before "20").
function sortedNumericIds(ids) {
  return [...ids].sort((a, b) => a - b);
}

/** Same duplicate rule the DB's route_signature UNIQUE index now enforces (docs/42):
 *  same place set regardless of stop order counts as the same route. Compares sorted
 *  id sets rather than positional order, matching buildRouteSignature() above. */
export async function checkCourseAlreadySaved({ userId, course }) {
  const placeIds = getCoursePlaceIds(course);
  if (placeIds.length === 0) return false;
  const { data, error } = await supabase
    .from('mg_saved_courses')
    .select('place_ids')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .contains('place_ids', placeIds);
  if (error) throw error;
  const sortedCourseIds = sortedNumericIds(placeIds);
  return (data ?? []).some((row) => {
    const savedIds = sortedNumericIds(
      (row.place_ids ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0),
    );
    return savedIds.length === sortedCourseIds.length
      && sortedCourseIds.every((id, index) => id === savedIds[index]);
  });
}

/** Same order-independent rule as checkCourseAlreadySaved() (see its comment) —
 *  used for the "Saved" badge on the course list rather than a DB round-trip. */
export function isSameCourse(course, savedRow) {
  try {
    const courseIds = sortedNumericIds(getCoursePlaceIds(course));
    const savedIds = sortedNumericIds(
      (savedRow.place_ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
    );
    if (courseIds.length > 0 && savedIds.length > 0 && courseIds.length === savedIds.length) {
      return courseIds.every((id, i) => id === savedIds[i]);
    }
    const courseStopCount = course.stopCount ?? (course.stops?.length ?? 0);
    return !!(course.title && savedRow.title === course.title && savedRow.stop_count === courseStopCount);
  } catch {
    return false;
  }
}
