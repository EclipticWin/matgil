import { Link } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import { WalkIcon, ClockIcon, ChevronRightIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { getDisplayMetrics } from '../utils/courseMetrics.js';
import { getLocalizedStopName } from '../utils/courseDisplay.js';

/** Short "what is this place" label for one stop of the compact route path —
 *  matgilCategoryKeys[0] is the same "primary category" convention courseBuilder
 *  already uses (calcDiversityScore/detectTitleType); 'other'/missing falls
 *  through to firstMenu, and both missing reuses the existing generic
 *  restaurantFallback copy (courseDetail.restaurantFallback) rather than a new key. */
function getStopSummaryLabel(stop, locale, getCategoryLabel, t) {
  const primaryKey = stop.matgilCategoryKeys?.[0];
  if (primaryKey && primaryKey !== 'other') return getCategoryLabel(primaryKey, locale);
  return stop.firstMenu || t('courseDetail.restaurantFallback');
}

function CourseCardInner({ course, isTodayPick = false, isActive = true }) {
  const { locale, t } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { displayDistance, displayDuration } = getDisplayMetrics(course, locale);
  const stops = course.stops ?? [];
  const pathStops = stops.slice(0, 3);

  // Same 'cafe' membership check courseBuilder's calcCafeBonus() already uses —
  // Math.max(0, ...) only guards against an unexpected data shape, never expected
  // to actually clamp anything in practice.
  const cafeCount = stops.filter((s) => (s.matgilCategoryKeys ?? []).includes('cafe')).length;
  const restaurantCount = Math.max(0, stops.length - cafeCount);

  return (
    <div className="p-[0.9375rem]">
      {/* badge row — TODAY'S PICK (first course only) on the left, stop count on
          the right. Reuses courseDetail.label ("★ Today's pick"/"★ 오늘의 추천"/
          "★ 今日推荐"), the same copy TodayCourseDetail's header already shows,
          instead of adding a near-duplicate key. */}
      <div className="flex min-h-[1.0625rem] items-center justify-between gap-2">
        {isTodayPick ? (
          <span className="font-display text-[0.625rem] font-extrabold uppercase tracking-wide text-coral">
            {t('courseDetail.label')}
          </span>
        ) : <span />}
        <span
          className={cn(
            'inline-block shrink-0 rounded-md px-2 py-[0.1875rem] font-display text-[0.625rem] font-extrabold uppercase tracking-wide',
            isActive ? 'bg-coral text-white' : 'bg-ink/15 text-ink-soft',
          )}
        >
          {t('courseDetail.stops', { n: stops.length })}
        </span>
      </div>

      <h3 className="mt-2 line-clamp-2 font-display text-[1.1875rem] font-bold leading-snug tracking-tight text-ink/90">
        {course.title}
      </h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[0.78rem] font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <WalkIcon className="text-ink-soft" /> {displayDistance}
        </span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="text-ink-soft" /> {displayDuration}
        </span>
        <span>
          {t('courseCard.restaurantCount', { n: restaurantCount })} · {t('courseCard.cafeCount', { n: cafeCount })}
        </span>
      </div>

      {/* Faint divider — same border-ink/5 convention TodayCourseDetail already
          uses for its own section dividers — separates the summary metrics
          above from the route path below. */}
      <div className="mt-3.5 border-t border-ink/5" />

      {/* Compact 1→2→3 path — replaces the old 3-thumbnail row. Each stop's own
          box is min-w-0 flex-1 so long names truncate instead of overflowing;
          the connecting chevron sits between boxes (never after the last one),
          which naturally yields 0/1/2 arrows for 1/2/3 stops with no special-casing.
          No min-height on the name paragraph (a previous version had one, to keep
          every stop's height equal) — that reserved a 2nd line's worth of space
          even for a short single-line name, reading as an oversized gap before the
          category text below it. Letting the name hug its own content and keeping
          the category margin small instead makes name+category read as one group,
          at the cost of neighboring stops occasionally differing in height when
          one name wraps and another doesn't. */}
      <div className="mt-3.5 flex items-start gap-1">
        {pathStops.map((stop, i) => (
          <div key={stop.id ?? i} className="flex min-w-0 flex-1 items-start">
            <div className="min-w-0 flex-1 text-center">
              <span className="mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.65rem] font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-2 line-clamp-2 text-[0.75rem] font-bold leading-snug text-ink/75">
                {getLocalizedStopName(stop, locale)}
              </p>
              <p className="mt-1 truncate text-[0.68rem] text-ink-faint">
                {getStopSummaryLabel(stop, locale, getCategoryLabel, t)}
              </p>
            </div>
            {i < pathStops.length - 1 && (
              <ChevronRightIcon size={9} className="mt-2 shrink-0 text-ink-faint" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center gap-0.5 text-[0.75rem] font-bold text-coral">
          {t('courseCard.viewDetails')}
          <ChevronRightIcon size={11} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

/** A course summary card: compact route info (no place images — see docs/54+).
 *  Shadow is a ~60%-alpha version of the shared `shadow-card` utility
 *  (0.10/0.08 → 0.06/0.048, same offsets/blur), scoped to this component only —
 *  a lighter, less "floating" feel without touching `shadow-card` itself, which
 *  other screens still use at full strength.
 *  Pass `disableLink` to suppress navigation (e.g. when used in Map tab).
 *  Pass `onClick` together with `disableLink` to make the card interactive.
 *  Pass `isActive={false}` to show a neutral (muted) stops badge.
 *  Pass `isTodayPick` to show the "★ Today's pick" badge — independent of
 *  `isActive` (which tracks "same as the map's currently-active course", not
 *  "first in the list"). */
export default function CourseCard({ course, disableLink = false, onClick, isActive = true, isTodayPick = false }) {
  if (disableLink) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
          className="block w-full overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)] text-left"
        >
          <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} />
        </button>
      );
    }
    return (
      <div className="block overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]">
        <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} />
      </div>
    );
  }

  return (
    <Link
      to={ROUTES.courseDetail(course.id)}
      className="block overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]"
    >
      <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} />
    </Link>
  );
}
