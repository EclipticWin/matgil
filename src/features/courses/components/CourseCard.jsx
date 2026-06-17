import { Link } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { WalkIcon, ClockIcon } from '../../../shared/components/Icon.jsx';

function CourseCardInner({ course }) {
  return (
    <>
      <div className="flex h-24">
        {course.stops.slice(0, 3).map((stop, i) => (
          <Thumbnail
            key={stop.id}
            src={stop.imageUrl}
            tint={stop.tint}
            rounded="rounded-none"
            className={`h-24 flex-1 ${i < Math.min(course.stops.length, 3) - 1 ? 'border-r-2 border-white' : ''}`}
          />
        ))}
      </div>

      <div className="p-[0.9375rem]">
        <span
          className="inline-block rounded-md px-2 py-[0.1875rem] font-display text-[0.625rem] font-extrabold uppercase tracking-wide text-white"
          style={{ background: course.accent }}
        >
          {course.stops.length} stops
        </span>
        <h3 className="mt-2 font-display text-[1.1875rem] font-bold tracking-tight text-ink">
          {course.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-3.5 text-[0.78rem] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <WalkIcon className="text-ink-soft" /> {course.km}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="text-ink-soft" /> {course.hr}
          </span>
        </div>
      </div>
    </>
  );
}

/** A course summary card: a row of stop thumbnails + meta.
 *  Pass `disableLink` to suppress navigation (e.g. when used in Map tab).
 *  Pass `onClick` together with `disableLink` to make the card interactive. */
export default function CourseCard({ course, disableLink = false, onClick }) {
  if (disableLink) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
          className="block w-full overflow-hidden rounded-3xl bg-white shadow-card text-left"
        >
          <CourseCardInner course={course} />
        </button>
      );
    }
    return (
      <div className="block overflow-hidden rounded-3xl bg-white shadow-card">
        <CourseCardInner course={course} />
      </div>
    );
  }

  return (
    <Link
      to={ROUTES.courseDetail(course.id)}
      className="block overflow-hidden rounded-3xl bg-white shadow-card"
    >
      <CourseCardInner course={course} />
    </Link>
  );
}
