import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { getCourse } from '../features/courses/data/courses.js';
import { ROUTES } from '../shared/constants/routes.js';
import Thumbnail from '../shared/components/Thumbnail.jsx';
import Button from '../shared/components/Button.jsx';
import { BackIcon, PinIcon, WalkIcon, ClockIcon, StarIcon, NavIcon } from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** Full-screen course detail (동선코스 상세): tinted header + numbered route timeline. */
export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const course = getCourse(id);

  if (!course) return <Navigate to={ROUTES.courses} replace />;

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* tinted header */}
        <div
          className="rounded-b-[1.625rem] px-5 pb-[1.375rem] pt-[3.625rem] text-white"
          style={{ background: `linear-gradient(160deg, ${course.accent} 0%, #D5350E 120%)` }}
        >
          <button
            type="button"
            onClick={() => navigate(ROUTES.courses)}
            aria-label="Back"
            className="mb-[1.125rem] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
          >
            <BackIcon />
          </button>
          <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider opacity-90">
            {t('courses.curatedRoute')}
          </div>
          <h1 className="mt-[0.4375rem] font-display text-[1.75rem] font-bold leading-[1.05] tracking-tight">
            {course.title}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-[0.8125rem] font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon size={14} /> {t('courseDetail.stops', { n: course.stops.length })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WalkIcon /> {course.km}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon /> {course.hr}
            </span>
          </div>
        </div>

        {/* blurb + route */}
        <div className="px-5 pb-6 pt-5">
          <p className="mb-[1.375rem] text-sm leading-relaxed text-ink-soft [text-wrap:pretty]">
            {course.blurb}
          </p>
          <div className="mb-3 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
            {t('courseDetail.routeStops')}
          </div>

          <div className="relative">
            {/* dashed connector */}
            <div
              className="absolute left-[1.125rem] bottom-10 top-4 w-[2.5px]"
              style={{
                background:
                  'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
              }}
            />
            {course.stops.map((stop, i) => (
              <div key={`${stop.id}-${i}`} className="relative flex items-center gap-3.5 py-2">
                <div className="z-[1] flex h-[2.375rem] w-[2.375rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[1.0625rem] font-bold text-white">
                  {i + 1}
                </div>
                <Thumbnail tint={stop.tint} className="h-14 w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-soft">{stop.cuisine}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink">
                    <StarIcon size={12} className="text-amber" /> {stop.rating}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="shrink-0 border-t border-ink/5 bg-paper-soft px-5 pb-7 pt-3">
        <Button full>
          <NavIcon /> {t('courses.startCourse')}
        </Button>
      </div>
    </div>
  );
}
