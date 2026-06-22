import { Link } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { WalkIcon, ClockIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { getDisplayMetrics } from '../utils/courseMetrics.js';

function CourseCardInner({ course, isActive = true }) {
  const { locale, t } = useLocale();
  const { displayDistance, displayDuration } = getDisplayMetrics(course, locale);

  return (
    <>
      <div className="flex h-24">
        {course.stops.slice(0, 3).map((stop, i) => (
          <Thumbnail
            key={stop.id ?? i}
            src={stop.imageUrl}
            tint={stop.tint}
            rounded="rounded-none"
            className={`h-24 flex-1 ${i < Math.min(course.stops.length, 3) - 1 ? 'border-r-2 border-white' : ''}`}
          />
        ))}
      </div>

      <div className="p-[0.9375rem]">
        <span
          className={cn(
            'inline-block rounded-md px-2 py-[0.1875rem] font-display text-[0.625rem] font-extrabold uppercase tracking-wide',
            isActive ? 'bg-coral text-white' : 'bg-ink/15 text-ink-soft',
          )}
        >
          {t('courseDetail.stops', { n: course.stops.length })}
        </span>
        <h3 className="mt-2 font-display text-[1.1875rem] font-bold tracking-tight text-ink">
          {course.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-3.5 text-[0.78rem] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <WalkIcon className="text-ink-soft" /> {displayDistance}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="text-ink-soft" /> {displayDuration}
          </span>
        </div>
      </div>
    </>
  );
}

/** A course summary card: a row of stop thumbnails + meta.
 *  Pass `disableLink` to suppress navigation (e.g. when used in Map tab).
 *  Pass `onClick` together with `disableLink` to make the card interactive.
 *  Pass `isActive={false}` to show a neutral (muted) stops badge. */
export default function CourseCard({ course, disableLink = false, onClick, isActive = true }) {
  if (disableLink) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
          className="block w-full overflow-hidden rounded-3xl bg-white shadow-card text-left"
        >
          <CourseCardInner course={course} isActive={isActive} />
        </button>
      );
    }
    return (
      <div className="block overflow-hidden rounded-3xl bg-white shadow-card">
        <CourseCardInner course={course} isActive={isActive} />
      </div>
    );
  }

  return (
    <Link
      to={ROUTES.courseDetail(course.id)}
      className="block overflow-hidden rounded-3xl bg-white shadow-card"
    >
      <CourseCardInner course={course} isActive={isActive} />
    </Link>
  );
}
