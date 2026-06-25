import { useEffect, useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { fetchSavedCourseById } from '../features/courses/services/savedCourseService.js';
import { formatCourseDistance, formatCourseDuration } from '../features/courses/utils/courseMetrics.js';
import { normalizeSavedCourseForDisplay, formatStopDistance } from '../features/courses/utils/courseDisplay.js';
import { ROUTES } from '../shared/constants/routes.js';
import Thumbnail from '../shared/components/Thumbnail.jsx';
import Button from '../shared/components/Button.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import {
  BackIcon,
  PinIcon,
  WalkIcon,
  ClockIcon,
  RouteIcon,
  ChevronRightIcon,
} from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

export default function SavedCourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [savedCourse, setSavedCourse] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setNotFound(true); setFetchLoading(false); return; }

    setFetchLoading(true);
    fetchSavedCourseById({ userId: user.id, courseId: id })
      .then((data) => {
        setSavedCourse(data);
        setFetchLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setFetchLoading(false);
      });
  }, [id, user?.id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authLoading && !user) return <Navigate to={ROUTES.courses} replace />;
  if (!fetchLoading && notFound) return <Navigate to={ROUTES.courses} replace />;

  if (fetchLoading || authLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-paper-soft">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  const display = normalizeSavedCourseForDisplay(savedCourse, locale);
  const snapshot = display.course_snapshot ?? {};
  const stops = display.stops ?? [];
  const stopCount = display.stop_count ?? stops.length;

  const distM = display.total_distance_m ?? snapshot.normalizedMetrics?.totalDistanceM ?? null;
  const durMin = display.total_duration_min ?? snapshot.normalizedMetrics?.totalDurationMin ?? null;
  const displayDistance = distM != null ? formatCourseDistance(distM) : snapshot.km ?? '—';
  const displayDuration = durMin != null ? formatCourseDuration(durMin, locale) : snapshot.hr ?? '—';

  function handleViewOnMap() {
    // Pass raw snapshot with anchor_label so NearbySheet can re-localize
    const rawSnap = savedCourse.course_snapshot ?? {};
    navigate(ROUTES.home, {
      state: { savedCourse: { ...rawSnap, anchor_label: savedCourse.anchor_label ?? rawSnap.anchor_label ?? '' } },
    });
  }

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* tinted header */}
        <div className="rounded-b-[1.625rem] bg-coral px-5 pb-[1.375rem] pt-[3.625rem] text-white">
          <button
            type="button"
            onClick={() => navigate(ROUTES.courses)}
            aria-label="Back"
            className="mb-[1.125rem] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
          >
            <BackIcon />
          </button>
          <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider opacity-90">
            {t('savedCourses.title')}
          </div>
          <h1 className="mt-[0.4375rem] font-display text-[1.75rem] font-bold leading-[1.05] tracking-tight">
            {display.title}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-[0.8125rem] font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon size={14} /> {t('courseDetail.stops', { n: stopCount })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WalkIcon /> {displayDistance}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon /> {displayDuration}
            </span>
          </div>
        </div>

        {/* stops */}
        <div className="px-5 pb-6 pt-5">
          <div className="mb-3 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
            {t('courseDetail.routeStops')}
          </div>

          <div className="relative space-y-3">
            <div
              className="absolute bottom-10 left-[1.0625rem] top-10 w-[2.5px]"
              style={{
                background:
                  'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
              }}
            />

            {stops.map((stop, i) => {
              const subtitle = stop.firstMenu || t('courseDetail.restaurantFallback');
              const dist = formatStopDistance(stop);

              return (
                <div key={stop.id ?? i} className="relative flex items-center gap-5">
                  <div className="z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)]">
                    {i + 1}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ink/5 bg-white/45 px-3 py-3 shadow-[0_0.25rem_1rem_rgba(34,24,20,0.04)]">
                    <Thumbnail
                      src={stop.imageUrl}
                      tint={stop.tint}
                      className="h-14 w-14 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
                      {dist && (
                        <p className="mt-0.5 truncate text-xs text-ink-faint">{dist}</p>
                      )}
                    </div>
                    <ChevronRightIcon size={14} className="shrink-0 text-ink-faint" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="shrink-0 border-t border-ink/5 bg-paper-soft px-5 pb-7 pt-3">
        <Button full onClick={handleViewOnMap}>
          <RouteIcon size={18} /> {t('savedCourses.viewOnMap')}
        </Button>
      </div>
    </div>
  );
}
