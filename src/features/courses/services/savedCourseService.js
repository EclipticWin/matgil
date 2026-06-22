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

export async function checkCourseAlreadySaved({ userId, title }) {
  const { data } = await supabase
    .from('mg_saved_courses')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('title', title)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}
