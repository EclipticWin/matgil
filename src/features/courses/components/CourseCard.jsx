import { Link } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import { WalkIcon, ClockIcon, ChevronRightIcon, BookmarkIcon } from '../../../shared/components/Icon.jsx';
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

/** `topLeftLabel`/`bottomLeftSlot`/`onViewDetail` only exist for SavedRoutesTab's
 *  `actionMode` (see CourseCard below) — every other caller leaves them unset and
 *  gets the exact same rendering as before (TODAY'S PICK/isSaved indicator, plain
 *  "View course" text with no button of its own). */
function CourseCardInner({
  course,
  isTodayPick = false,
  isActive = true,
  isSaved = false,
  topLeftLabel = null,
  bottomLeftSlot = null,
  onViewDetail = null,
}) {
  const { locale, t } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { displayDistance, displayDuration } = getDisplayMetrics(course, locale);
  const stops = course.stops ?? [];
  const pathStops = stops.slice(0, 3);
  // Odd tracks are stops (1fr each, share leftover width equally); even tracks
  // are the connecting chevrons (auto-width) — 2 stops need 3 tracks, 3 stops
  // need 5, one fewer arrow than stop.
  const pathGridTemplateColumns = pathStops
    .map((_, i) => (i < pathStops.length - 1 ? '1fr auto' : '1fr'))
    .join(' ');

  // Same 'cafe' membership check courseBuilder's calcCafeBonus() already uses —
  // Math.max(0, ...) only guards against an unexpected data shape, never expected
  // to actually clamp anything in practice.
  const cafeCount = stops.filter((s) => (s.matgilCategoryKeys ?? []).includes('cafe')).length;
  const restaurantCount = Math.max(0, stops.length - cafeCount);

  // isTodayPick and topLeftLabel (SavedRoutesTab's saved-date, via `actionMode`
  // below) never co-occur in practice, but isTodayPick still wins if they ever
  // did — a live "today's pick" badge is never itself a saved-list card.
  // min-w-0/flex-1/truncate keep a long date from pushing the stops badge
  // (already shrink-0) out of the row instead of wrapping under it.
  const topLeftContent = isTodayPick ? (
    <span className="font-display text-[0.625rem] font-extrabold uppercase tracking-wide text-coral">
      {t('courseDetail.label')}
    </span>
  ) : topLeftLabel ? (
    <span className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold text-ink-faint">
      {topLeftLabel}
    </span>
  ) : <span />;

  const viewDetailContent = (
    <>
      {t('courseCard.viewDetails')}
      <ChevronRightIcon size={11} aria-hidden="true" />
    </>
  );

  // Everything above the bottom action row — pulled into its own fragment so
  // `actionMode` (see CourseCard below) can wrap just this part in its own
  // button, leaving the action row's delete/view-detail buttons as siblings
  // rather than nested inside another button.
  const upperContent = (
    <>
      {/* badge row — TODAY'S PICK (first course only) on the left, stop count on
          the right. Reuses courseDetail.label ("★ Today's pick"/"★ 오늘의 추천"/
          "★ 今日推荐"), the same copy TodayCourseDetail's header already shows,
          instead of adding a near-duplicate key. */}
      <div className="flex min-h-[1.0625rem] items-center justify-between gap-2">
        {topLeftContent}
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

      {/* Compact 1→2→3 path — replaces the old 3-thumbnail row. A shared CSS Grid
          (not independent per-stop flex columns) so the name row's height is one
          value shared by every stop: if ANY stop's name wraps to 2 lines, that
          row grows for all stops at once and every category label still starts
          on the same horizontal line; when every name fits on 1 line, the row
          shrinks back down instead of always reserving a fixed 2-line height (no
          JS text-length guessing, no DOM-measuring effect — the grid track sizes
          itself from actual rendered content). Each stop is a `contents` wrapper
          (adds no box of its own) so its badge/name/category cells sit directly
          in the grid at column `i*2+1`, rows 1/2/3; the connecting chevrons live
          in their own `auto`-width wrapper columns (even tracks) so they line up
          with the badge row without needing the icon component itself to accept
          a style prop. Long names still truncate (min-w-0 lets the 1fr track
          shrink them) and stay capped at 2 lines (line-clamp-2). */}
      <div className="mt-3.5 grid items-start gap-x-1" style={{ gridTemplateColumns: pathGridTemplateColumns }}>
        {pathStops.map((stop, i) => {
          const col = i * 2 + 1;
          return (
            <div key={stop.id ?? i} className="contents">
              <span
                style={{ gridColumn: col, gridRow: 1 }}
                className="mx-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.65rem] font-bold text-white"
              >
                {i + 1}
              </span>
              <p
                style={{ gridColumn: col, gridRow: 2 }}
                className="mt-2 line-clamp-2 min-w-0 text-center text-[0.75rem] font-bold leading-snug text-ink/75"
              >
                {getLocalizedStopName(stop, locale)}
              </p>
              <p
                style={{ gridColumn: col, gridRow: 3 }}
                className="mt-1 min-w-0 truncate text-center text-[0.68rem] text-ink-faint"
              >
                {getStopSummaryLabel(stop, locale, getCategoryLabel, t)}
              </p>
            </div>
          );
        })}
        {pathStops.slice(0, -1).map((stop, i) => (
          <div
            key={`arrow-${stop.id ?? i}`}
            style={{ gridColumn: i * 2 + 2, gridRow: 1 }}
            className="flex justify-center"
          >
            <ChevronRightIcon size={9} className="mt-2 shrink-0 text-ink-faint" aria-hidden="true" />
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="p-[0.9375rem]">
      {onViewDetail ? (
        <button type="button" onClick={onViewDetail} className="block w-full text-left">
          {upperContent}
        </button>
      ) : upperContent}

      {/* Left slot is either a status indicator (isSaved — never its own button,
          since the whole card above is already the click target) or, in
          `actionMode`, a fully independent delete button/confirm UI
          (bottomLeftSlot) that sits as a SIBLING of the button above, never
          nested inside it. A fixed min-height keeps "View course"/코스 상세
          보기 pinned to the same spot regardless of which of these — or
          neither — is present. */}
      <div className="mt-3 flex min-h-[1.125rem] items-center justify-between gap-2">
        {bottomLeftSlot ?? (isSaved ? (
          // Only the icon carries an explicit coral color — the wrapper/text stay
          // plain ink-faint (a neutral gray, not a translucent coral) so "저장됨"
          // reads as secondary info, never competing with the title/metrics above it.
          <span className="inline-flex items-center gap-1 text-[0.72rem] font-bold text-ink-faint">
            <BookmarkIcon active size={13} className="text-coral" />
            {t('savedCourses.saved')}
          </span>
        ) : <span />)}
        {onViewDetail ? (
          <button
            type="button"
            onClick={onViewDetail}
            className="inline-flex shrink-0 items-center gap-0.5 text-[0.75rem] font-bold text-ink-soft transition-colors hover:text-ink active:text-ink"
          >
            {viewDetailContent}
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[0.75rem] font-bold text-ink-soft transition-colors hover:text-ink active:text-ink">
            {viewDetailContent}
          </span>
        )}
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
 *  "first in the list").
 *  Pass `isSaved` to show a "Saved" indicator next to "View course" — only
 *  meaningful for NearbySheet's live recommendation list (which knows whether
 *  each course is already saved); SavedRoutesTab's own list never passes it,
 *  since every card there is saved by definition.
 *  Pass `actionMode` (SavedRoutesTab only) to get an independent bottom action
 *  row instead of one card-wide button/Link: `onClick` still opens the course
 *  detail, but now only the content above the action row (and the "코스 상세
 *  보기" button within it) triggers it — `deleteSlot` renders its own
 *  completely separate delete button/confirm UI as a sibling, so a delete click
 *  can never accidentally navigate and no button ends up nested inside another.
 *  `savedDateLabel` replaces the TODAY'S PICK slot with a saved-date string. */
export default function CourseCard({
  course,
  disableLink = false,
  onClick,
  isActive = true,
  isTodayPick = false,
  isSaved = false,
  actionMode = false,
  savedDateLabel = null,
  deleteSlot = null,
}) {
  if (actionMode) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]">
        <CourseCardInner
          course={course}
          isActive={isActive}
          isTodayPick={isTodayPick}
          topLeftLabel={savedDateLabel}
          bottomLeftSlot={deleteSlot}
          onViewDetail={onClick}
        />
      </div>
    );
  }

  if (disableLink) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
          className="block w-full overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)] text-left"
        >
          <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} isSaved={isSaved} />
        </button>
      );
    }
    return (
      <div className="block overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]">
        <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} isSaved={isSaved} />
      </div>
    );
  }

  return (
    <Link
      to={ROUTES.courseDetail(course.id)}
      className="block overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]"
    >
      <CourseCardInner course={course} isActive={isActive} isTodayPick={isTodayPick} isSaved={isSaved} />
    </Link>
  );
}
