/**
 * Normalizes course distance and duration from any course object shape.
 * course.hr is intentionally NOT used for duration: it is a fixed lookup
 * by stop count in courseBuilder, not based on actual route distance.
 */

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Resolves totalDistanceM and totalDurationMin from any course object.
 * Priority order documented inline.
 */
export function normalizeCourseMetrics(course) {
  if (!course) {
    return { totalDistanceM: null, totalDurationMin: null, distanceSource: 'none', durationSource: 'none' };
  }

  // ── Distance ──────────────────────────────────────────────────────────────
  let totalDistanceM = null;
  let distanceSource = 'none';

  if (typeof course.totalDistanceM === 'number' && Number.isFinite(course.totalDistanceM)) {
    totalDistanceM = Math.round(course.totalDistanceM);
    distanceSource = 'totalDistanceM';
  } else if (typeof course.totalDistanceMeters === 'number' && Number.isFinite(course.totalDistanceMeters)) {
    totalDistanceM = Math.round(course.totalDistanceMeters);
    distanceSource = 'totalDistanceMeters';
  } else if (typeof course.totalDistanceKm === 'number' && Number.isFinite(course.totalDistanceKm)) {
    totalDistanceM = Math.round(course.totalDistanceKm * 1000);
    distanceSource = 'totalDistanceKm';
  } else if (typeof course.km === 'string') {
    const match = course.km.match(/^([\d.]+)\s*km$/i);
    if (match) {
      totalDistanceM = Math.round(parseFloat(match[1]) * 1000);
      distanceSource = 'km_string';
    }
  }

  // Fallback: haversine sum of consecutive stop coordinates
  if (totalDistanceM === null && Array.isArray(course.stops) && course.stops.length >= 2) {
    let sum = 0;
    let ok = true;
    for (let i = 0; i < course.stops.length - 1; i++) {
      const a = course.stops[i];
      const b = course.stops[i + 1];
      if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
        sum += haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      } else {
        ok = false;
        break;
      }
    }
    if (ok) {
      totalDistanceM = Math.round(sum * 1000);
      distanceSource = 'haversine';
    }
  }

  // ── Duration (walking estimate; course.hr intentionally skipped) ──────────
  let totalDurationMin = null;
  let durationSource = 'none';

  if (typeof course.totalDurationMin === 'number' && Number.isFinite(course.totalDurationMin)) {
    totalDurationMin = course.totalDurationMin;
    durationSource = 'totalDurationMin';
  } else if (typeof course.durationMin === 'number' && Number.isFinite(course.durationMin)) {
    totalDurationMin = course.durationMin;
    durationSource = 'durationMin';
  } else if (typeof course.walkingDurationMin === 'number' && Number.isFinite(course.walkingDurationMin)) {
    totalDurationMin = course.walkingDurationMin;
    durationSource = 'walkingDurationMin';
  } else if (totalDistanceM !== null) {
    // 15 min per km walking estimate
    totalDurationMin = Math.ceil((totalDistanceM / 1000) * 15);
    durationSource = 'walkingEstimate';
  }

  return { totalDistanceM, totalDurationMin, distanceSource, durationSource };
}

export function formatCourseDistance(totalDistanceM) {
  if (totalDistanceM == null) return null;
  if (totalDistanceM < 1000) return `${totalDistanceM} m`;
  return `${(totalDistanceM / 1000).toFixed(1)} km`;
}

export function formatCourseDuration(totalDurationMin, locale) {
  if (totalDurationMin == null) return null;
  const isKo = locale === 'ko';
  if (totalDurationMin < 60) {
    return isKo ? `~${totalDurationMin}분` : `~${totalDurationMin} min`;
  }
  const hours = Math.floor(totalDurationMin / 60);
  const mins = totalDurationMin % 60;
  if (isKo) return mins === 0 ? `~${hours}시간` : `~${hours}시간 ${mins}분`;
  return mins === 0 ? `~${hours} hr` : `~${hours} hr ${mins} min`;
}

/**
 * Returns display-ready distance/duration strings for a course object.
 * Falls back to course.km / course.hr if normalization yields null.
 */
export function getDisplayMetrics(course, locale) {
  const { totalDistanceM, totalDurationMin } = normalizeCourseMetrics(course);
  const displayDistance = formatCourseDistance(totalDistanceM) ?? course.km ?? '—';
  const displayDuration =
    totalDurationMin != null
      ? formatCourseDuration(totalDurationMin, locale)
      : course.hr ?? '—';
  return { displayDistance, displayDuration, totalDistanceM, totalDurationMin };
}
