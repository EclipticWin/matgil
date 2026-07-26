import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSavedCourses } from '../hooks/useSavedCourses.jsx';
import CourseCard from './CourseCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import Button from '../../../shared/components/Button.jsx';
import { RouteIcon, TrashIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { formatCourseDistance, formatCourseDuration } from '../utils/courseMetrics.js';
import { getSavedCourseDisplayTitle, mergeSavedStopWithLocalizedPlace } from '../utils/courseDisplay.js';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { formatSavedDate } from '../../../shared/utils/formatDate.js';
import { getPlacesByIds } from '../../../api/placeApi.js';

/** Courses page's "Saved Routes" tab — the pre-existing saved-course list, extracted
 *  from CoursesPage so it can sit alongside Saved Places. */
export default function SavedRoutesTab() {
  const { t, locale } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { courses, loading, remove } = useSavedCourses();
  const navigate = useNavigate();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Current-locale place data for every stop across every saved course, ONE
  // batched query for the whole tab (not per-course, not per-stop) — the same
  // getPlacesByIds() SavedCourseDetailPage already uses for this. Without this,
  // each card showed its saved-time-locale snapshot text (docs/44's original
  // fix only covered the detail page, never this list).
  const allStopIds = useMemo(() => {
    const ids = courses.flatMap((saved) => {
      const snapshot = saved.course_snapshot ?? {};
      const stops = saved.stops ?? snapshot.stops ?? [];
      return stops.map((stop) => Number(stop.id)).filter(Number.isFinite);
    });
    return [...new Set(ids)].sort((a, b) => a - b);
  }, [courses]);
  const allStopIdsKey = allStopIds.join(',');

  const [localizedPlacesById, setLocalizedPlacesById] = useState(new Map());
  const [localizedPlacesLoading, setLocalizedPlacesLoading] = useState(false);

  useEffect(() => {
    if (!allStopIdsKey) {
      setLocalizedPlacesById(new Map());
      setLocalizedPlacesLoading(false);
      return;
    }

    let cancelled = false;
    setLocalizedPlacesLoading(true);
    // Clear immediately so a locale switch never shows the previous locale's
    // text while the new batch is in flight.
    setLocalizedPlacesById(new Map());

    // Derived from the key string (not the `allStopIds` array reference) so this
    // effect's only real dependencies are allStopIdsKey/locale — both already
    // listed below, same pattern SavedCourseDetailPage's own batch fetch uses.
    getPlacesByIds(allStopIdsKey.split(',').map(Number), locale)
      .then((localizedPlaces) => {
        if (cancelled) return;
        setLocalizedPlacesById(new Map(localizedPlaces.map((place) => [place.id, place])));
      })
      .catch(() => {
        if (!cancelled) setLocalizedPlacesById(new Map());
      })
      .finally(() => {
        if (!cancelled) setLocalizedPlacesLoading(false);
      });

    return () => { cancelled = true; };
  }, [allStopIdsKey, locale]);

  async function handleDelete(id) {
    try {
      await remove(id);
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={<RouteIcon size={26} />}
        title={t('savedCourses.empty')}
        description={t('savedCourses.emptyHint')}
        action={
          <Button onClick={() => navigate(ROUTES.home)} className="h-11 px-6 text-sm">
            {t('savedCourses.exploreRoutes')}
          </Button>
        }
      />
    );
  }

  // Only while the current-locale batch is actually in flight (never once it's
  // resolved, even to an empty/failed result) — this is what keeps a locale
  // switch from flashing the previous locale's snapshot text, without hiding
  // the whole list on every render the way `loading` above does.
  if (localizedPlacesLoading && allStopIdsKey) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {courses.map((saved) => {
        const snapshot = saved.course_snapshot ?? {};
        const rawStops = saved.stops ?? snapshot.stops ?? [];
        // Current-locale place text merged over the saved snapshot (docs/44) —
        // mergeSavedStopWithLocalizedPlace() keeps the route-context fields the
        // localized place record has none of (distanceKm, tint, stop order) and
        // only falls back to the snapshot's own (possibly stale-locale) text when
        // the place has no localized record at all (deleted, or batch fetch failed).
        const localizedStops = rawStops.map((stop) =>
          mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(Number(stop.id))),
        );
        const adaptedCourse = {
          id: saved.id,
          title: getSavedCourseDisplayTitle(saved, locale, { getCategoryLabel, t }),
          stops: localizedStops,
          totalDistanceM: saved.total_distance_m,
          totalDurationMin: saved.total_duration_min,
          accent: snapshot.accent ?? '#F8481F',
          km: saved.total_distance_m != null
            ? formatCourseDistance(saved.total_distance_m)
            : snapshot.km,
          hr: saved.total_duration_min != null
            ? formatCourseDuration(saved.total_duration_min, locale)
            : snapshot.hr,
        };

        const savedDateLabel = t('savedCourses.savedDate', { date: formatSavedDate(saved.created_at, locale) });

        // Independent of the card's own "코스 상세 보기" button (see CourseCard's
        // actionMode) — a sibling, not nested inside it, so this click can never
        // trigger navigation and vice versa.
        const deleteSlot = pendingDeleteId === saved.id ? (
          <div className="flex items-center gap-3 text-[0.72rem] font-semibold">
            <button type="button" onClick={() => setPendingDeleteId(null)} className="text-ink-soft">
              {t('community.cancel')}
            </button>
            <button type="button" onClick={() => handleDelete(saved.id)} className="text-coral">
              {t('community.delete')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPendingDeleteId(saved.id)}
            className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-ink-faint"
          >
            <TrashIcon size={13} />
            {t('savedCourses.delete')}
          </button>
        );

        return (
          <CourseCard
            key={saved.id}
            course={adaptedCourse}
            actionMode
            isActive={false}
            savedDateLabel={savedDateLabel}
            deleteSlot={deleteSlot}
            onClick={() => navigate(ROUTES.savedCourseDetail(saved.id))}
          />
        );
      })}
    </div>
  );
}
