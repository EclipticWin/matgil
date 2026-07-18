import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSavedCourses } from '../hooks/useSavedCourses.jsx';
import CourseCard from './CourseCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { RouteIcon, TrashIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { formatCourseDistance, formatCourseDuration } from '../utils/courseMetrics.js';
import { getSavedCourseDisplayTitle } from '../utils/courseDisplay.js';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { formatSavedDate } from '../../../shared/utils/formatDate.js';

/** Courses page's "Saved Routes" tab — the pre-existing saved-course list, unchanged
 *  in behavior, just extracted from CoursesPage so it can sit alongside Saved Places. */
export default function SavedRoutesTab() {
  const { t, locale } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { courses, loading, remove } = useSavedCourses();
  const navigate = useNavigate();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

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
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {courses.map((saved) => {
        const snapshot = saved.course_snapshot ?? {};
        const rawStops = saved.stops ?? snapshot.stops ?? [];
        const adaptedCourse = {
          id: saved.id,
          title: getSavedCourseDisplayTitle(saved, locale, { getCategoryLabel, t }),
          stops: rawStops,
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

        return (
          <div key={saved.id}>
            <CourseCard
              course={adaptedCourse}
              disableLink
              isActive={false}
              onClick={() => navigate(ROUTES.savedCourseDetail(saved.id))}
            />
            <div className="mt-1.5 flex items-center justify-between px-1">
              <span className="text-[0.7rem] text-ink-faint">
                {formatSavedDate(saved.created_at, locale)}
              </span>

              {pendingDeleteId === saved.id ? (
                <div className="flex items-center gap-3 text-[0.78rem] font-semibold">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    className="text-ink-soft"
                  >
                    {t('community.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(saved.id)}
                    className="text-coral"
                  >
                    {t('community.delete')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(saved.id)}
                  className="inline-flex items-center gap-1 text-[0.7rem] text-ink-faint"
                >
                  <TrashIcon size={12} />
                  {t('savedCourses.delete')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
