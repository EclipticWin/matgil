import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { useSavedCourses } from '../features/courses/hooks/useSavedCourses.jsx';
import CourseCard from '../features/courses/components/CourseCard.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import EmptyState from '../shared/components/EmptyState.jsx';
import Button from '../shared/components/Button.jsx';
import { RouteIcon, TrashIcon } from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { formatCourseDistance, formatCourseDuration } from '../features/courses/utils/courseMetrics.js';
import { getLocalizedCourseTitle } from '../features/courses/utils/courseDisplay.js';

function formatSavedDate(iso, locale) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function CoursesPage() {
  const { t, locale } = useLocale();
  const { user, loading: authLoading } = useAuth();
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

  return (
    <PageShell>
      <PageHeader
        title={t('savedCourses.title')}
        subtitle={t('savedCourses.subtitle')}
        subtitleClassName="mt-1"
      />

      {/* 비로그인 */}
      {!authLoading && !user && (
        <EmptyState
          className="mt-20"
          icon={<RouteIcon size={26} />}
          title={t('savedCourses.loginPrompt')}
          description={t('savedCourses.loginHint')}
          action={
            <Button onClick={() => navigate(ROUTES.login)}>
              {t('savedCourses.login')}
            </Button>
          }
        />
      )}

      {/* 로딩 */}
      {user && loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
        </div>
      )}

      {/* 로그인 + 저장 코스 없음 */}
      {user && !loading && courses.length === 0 && (
        <EmptyState
          className="mt-20"
          icon={<RouteIcon size={26} />}
          title={t('savedCourses.empty')}
          description={t('savedCourses.emptyHint')}
        />
      )}

      {/* 저장 코스 목록 */}
      {user && !loading && courses.length > 0 && (
        <div className="mt-5 flex flex-col gap-4">
          {courses.map((saved) => {
            const snapshot = saved.course_snapshot ?? {};
            const rawStops = saved.stops ?? snapshot.stops ?? [];
            const anchorLabel = saved.anchor_label ?? snapshot.anchor_label ?? '';
            const adaptedCourse = {
              id: saved.id,
              title: getLocalizedCourseTitle(rawStops, anchorLabel, locale),
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
      )}
    </PageShell>
  );
}
