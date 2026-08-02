import { StarIcon } from '../../../shared/components/Icon.jsx';

const STARS = [5, 4, 3, 2, 1];
const STAR_SLOTS = [0, 1, 2, 3, 4];

/** 5 stars in a row, coral-filled up to `rating / 5 * 100%` — an exact, unrounded
 *  fraction (4.5 -> half the 5th star, 3.2 -> 64%), not "round to N whole stars".
 *  Two identical star rows stacked via CSS overflow: a light, empty base row
 *  behind, and a coral row on top clipped to that same percentage width — since
 *  both rows share the same size/gap, the clip lands exactly at the fractional
 *  point across the row regardless of icon boundaries. */
function StarRatingRow({ rating, size = 15 }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <div className="relative inline-block leading-none" aria-hidden="true">
      <div className="flex gap-0.5 text-ink/15">
        {STAR_SLOTS.map((i) => <StarIcon key={i} size={size} />)}
      </div>
      <div className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-coral" style={{ width: `${pct}%` }}>
        {STAR_SLOTS.map((i) => <StarIcon key={i} size={size} />)}
      </div>
    </div>
  );
}

function RatingDistributionBars({ distribution, total }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {STARS.map((star) => {
        const count = distribution[star] ?? 0;
        // Guarded at 0 total (no reviews) — an empty track, not NaN/Infinity;
        // a lone 5-star review correctly renders as 100% on that row and 0%
        // everywhere else, never a fixed/sample value.
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="w-3 shrink-0 text-[0.7rem] font-semibold text-ink-faint">{star}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-5 shrink-0 text-right text-[0.68rem] text-ink-faint">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Picks at most one positive rating badge from the FULL rating distribution
 *  (never the composer's own unsaved star pick — see ReviewComposer, which
 *  never feeds this). Priority matches the product requirement exactly:
 *  too few reviews to say anything meaningful outranks the other two, and no
 *  badge at all outranks showing something discouraging (no "mixed reviews"
 *  or similarly negative-reading badge exists here by design). Returns a
 *  dictionary key (under `placeDetail.`) or null. */
export function computeRatingBadgeKey({ distribution, reviewCount }) {
  if (reviewCount <= 0) return null;
  if (reviewCount <= 1) return 'badgeNotEnoughReviews';

  const fiveCount = distribution?.[5] ?? 0;
  if (fiveCount === reviewCount) return 'badgeAllFiveStars';

  const fourPlusCount = fiveCount + (distribution?.[4] ?? 0);
  if (fourPlusCount / reviewCount >= 0.8) return 'badgeMostlyPositive';

  return null;
}

/** Shared average-rating + 5→1 distribution card — used as-is (same component,
 *  same props, same server-fetched data) whether the reviews page is showing
 *  the plain list or has the write-review composer expanded, so the two states
 *  can never visually diverge or show stale/out-of-sync numbers.
 *
 *  Row 1 is the two-column layout: a ~35% left column (avg+/5 on one line,
 *  then the star-fill row, then "based on N reviews") and a ~65% right column
 *  (the 5→1 bar list). Row 2 — full card width, below both columns — is a
 *  single left-aligned badge row (at most one rating badge + the save-count
 *  badge); giving badges their own full-width row instead of squeezing them
 *  into the narrow left column is what stops a long badge label from wrapping
 *  onto 2-3 lines. Renders nothing when there are no reviews yet (see caller
 *  for the empty-state copy instead of a forced 0.0/empty-bars card). */
export default function RatingStatsCard({ ratingAvg, reviewCount, distribution, badgeKey, saveCount, t }) {
  if (!reviewCount || reviewCount <= 0) return null;

  return (
    <div className="rounded-3xl border border-solid border-ink/15 bg-white/70 p-5">
      <div className="flex items-start gap-4">
        <div className="flex-[35] min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[2rem] font-bold leading-none text-ink">{ratingAvg.toFixed(1)}</span>
            <span className="text-sm font-semibold text-ink-faint">/ 5</span>
          </div>
          <div className="mt-1.5">
            <StarRatingRow rating={ratingAvg} />
          </div>
          <p className="mt-1.5 text-[0.72rem] leading-snug text-ink-faint">
            {t('placeDetail.basedOnReviews', { count: reviewCount })}
          </p>
        </div>
        <div className="flex-[65] min-w-0">
          <RatingDistributionBars distribution={distribution} total={reviewCount} />
        </div>
      </div>
      {(badgeKey || saveCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {badgeKey && (
            <span className="whitespace-nowrap rounded-full bg-coral-tint px-2.5 py-1 text-[0.68rem] font-bold leading-normal text-coral">
              {t(`placeDetail.${badgeKey}`)}
            </span>
          )}
          {saveCount > 0 && (
            <span className="whitespace-nowrap rounded-full bg-ink/5 px-2.5 py-1 text-[0.68rem] font-semibold leading-normal text-ink-soft">
              {t('placeDetail.savedByCount', { count: saveCount })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
