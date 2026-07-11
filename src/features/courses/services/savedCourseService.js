import { supabase } from '../../../lib/supabase.js';

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

export async function saveCourse({ userId, locale, course, selectedLocation, metrics }) {
  const { totalDistanceM, totalDurationMin, distanceSource, durationSource } = metrics;

  const placeIds = (course.stops ?? [])
    .map((stop) => Number(stop.id ?? stop.place_id ?? stop.placeId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const courseSnapshot = {
    ...course,
    anchor_label: selectedLocation?.label ?? '',
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
    })
    .select()
    .single();

  if (error) throw error;
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
  return (data ?? []).some((row) => {
    const savedIds = (row.place_ids ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0);
    return savedIds.length === placeIds.length && placeIds.every((id, index) => id === savedIds[index]);
  });
}

export function isSameCourse(course, savedRow) {
  try {
    const courseIds = getCoursePlaceIds(course);
    const savedIds = (savedRow.place_ids ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (courseIds.length > 0 && savedIds.length > 0 && courseIds.length === savedIds.length) {
      return courseIds.every((id, i) => id === savedIds[i]);
    }
    const courseStopCount = course.stopCount ?? (course.stops?.length ?? 0);
    return !!(course.title && savedRow.title === course.title && savedRow.stop_count === courseStopCount);
  } catch {
    return false;
  }
}
