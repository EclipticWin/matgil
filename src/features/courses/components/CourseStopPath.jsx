import { ChevronRightIcon } from '../../../shared/components/Icon.jsx';
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

/** Compact 1→2→3 route-path grid — extracted out of CourseCard so
 *  PublicCourseCard (the public "popular routes" feed card) can reuse the
 *  exact same rendering instead of a second, easily-drifting copy. A shared
 *  CSS Grid (not independent per-stop flex columns) so the name row's height
 *  is one value shared by every stop: if ANY stop's name wraps to 2 lines,
 *  that row grows for all stops at once and every category label still
 *  starts on the same horizontal line; when every name fits on 1 line, the
 *  row shrinks back down instead of always reserving a fixed 2-line height
 *  (no JS text-length guessing, no DOM-measuring effect — the grid track
 *  sizes itself from actual rendered content). Each stop is a `contents`
 *  wrapper (adds no box of its own) so its badge/name/category cells sit
 *  directly in the grid at column `i*2+1`, rows 1/2/3; the connecting
 *  chevrons live in their own `auto`-width wrapper columns (even tracks) so
 *  they line up with the badge row without needing the icon component
 *  itself to accept a style prop. Long names still truncate (min-w-0 lets
 *  the 1fr track shrink them) and stay capped at 2 lines (line-clamp-2). */
export default function CourseStopPath({ stops, locale, getCategoryLabel, t }) {
  const pathStops = (stops ?? []).slice(0, 3);
  const pathGridTemplateColumns = pathStops
    .map((_, i) => (i < pathStops.length - 1 ? '1fr auto' : '1fr'))
    .join(' ');

  return (
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
  );
}
