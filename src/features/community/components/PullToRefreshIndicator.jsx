import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { RotateCwIcon } from '../../../shared/components/Icon.jsx';
import { PULL_THRESHOLD, RETURN_DURATION_MS } from '../hooks/usePullToRefresh.js';

// Outer badge diameter and the (slightly smaller) inner rotation wrapper.
const BADGE_SIZE = 36;
const SPIN_SIZE = BADGE_SIZE - 6;
// Must match CommunityPage.jsx's feed content wrapper's own `pt-3.5`
// (0.875rem = 14px). The true gap this indicator sits inside runs from the
// tabs' bottom all the way down to the first card's top — which is
// pullDistance (how far the content has been pushed down) PLUS this static
// padding-top the content wrapper always has, not pullDistance alone. The
// slot below used to span only [0, pullDistance], leaving this padding as
// extra space below the badge that was never mirrored above it — a
// constant ~14px bottomGap-over-topGap mismatch at every pull distance,
// which is what this fixes.
const FEED_CONTENT_TOP_PADDING_PX = 14;

/** Pull-to-refresh indicator for CommunityPage. Three layers, each solving
 *  one specific problem the previous version had:
 *
 *  1. A "slot" — `position: absolute`, full width, `height: slotHeight`
 *     (pullDistance + FEED_CONTENT_TOP_PADDING_PX, see below — the FULL gap
 *     between the tabs and the first card, not just the dynamic part),
 *     `display: flex; align-items: center; justify-content: center` —
 *     instead of a fixed `top` offset computed by hand. Centering the badge
 *     is the flexbox engine's job now, not arithmetic that clamped wrong
 *     once the gap was smaller than the badge itself; the space above and
 *     below the badge is equal by construction for any slot height.
 *  2. A solid white badge (so the arrow reads clearly against the app's
 *     paper/beige background) that never itself rotates — a perfectly
 *     circular, uniformly-colored shape spinning shows no visible motion
 *     at all, which was the real reason rotation "wasn't visible" before.
 *  3. A separate rotation wrapper *inside* the badge, carrying only the
 *     RotateCw arrow — this is the one thing that actually spins. (An
 *     earlier version also drew a faint coral ring accent in here so the
 *     sweep would read on the ring, not just the arrow; that ring itself
 *     looked like an unwanted extra shape around the arrow, so it's gone —
 *     rotation is conveyed by the arrow's own asymmetric shape alone.)
 *
 *  Position (the slot's `height`) and rotation (this inner wrapper's own
 *  transform/animation) are always two different DOM elements — never the
 *  same one — so a CSS animation's `transform` on the rotation wrapper can
 *  never be clobbered by the slot's own layout changes.
 *
 *  Color is coral at every phase — only opacity/height change with pull
 *  progress; nothing here ever fades to gray. `animate-spin-slow`
 *  (index.css, 0.9s/turn — already used elsewhere in the app) drives the
 *  continuous spin once an actual refresh request is in flight (held for at
 *  least 600ms by usePullToRefresh's own minimum-display timer, regardless
 *  of how fast the request resolves); while merely dragging, rotation
 *  instead tracks pull progress directly and is skipped under
 *  prefers-reduced-motion (decorative motion tied to finger position,
 *  unlike the spin above, which is treated the same as every other loading
 *  spinner in this app — those already spin regardless of that
 *  preference). */
export default function PullToRefreshIndicator({ pullDistance, phase }) {
  const { t } = useLocale();
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const visible = phase !== 'idle';
  const refreshing = phase === 'refreshing';
  const dragging = phase === 'pulling' || phase === 'ready';
  const ready = progress >= 1;
  const statusText = refreshing
    ? t('community.refreshingPosts')
    : ready
      ? t('community.releaseToRefresh')
      : t('community.pullToRefresh');
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);
  const dragRotationDeg = reducedMotion ? 0 : progress * 360;
  // See FEED_CONTENT_TOP_PADDING_PX above — the slot spans the FULL gap
  // (static padding + dynamic pull distance), not pullDistance alone, so
  // flex-centering the badge inside it puts equal space above and below
  // regardless of how far the content has been pulled down.
  const slotHeight = pullDistance + FEED_CONTENT_TOP_PADDING_PX;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center overflow-visible"
      style={{
        height: slotHeight,
        opacity: visible ? (refreshing ? 1 : progress) : 0,
        // Untransitioned while dragging so height/opacity track the finger
        // with zero lag; eased back in once the finger lifts (returning/
        // refreshing/idle) — same duration as the feed content's own
        // return transform (RETURN_DURATION_MS), imported rather than a
        // second hard-coded number, so the two never drift out of sync.
        transition: dragging ? 'none' : `height ${RETURN_DURATION_MS}ms ease-out, opacity ${RETURN_DURATION_MS}ms ease-out`,
      }}
    >
      {/* Layer 2 — the static white badge. Never rotates. */}
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(38,26,17,0.14)]"
        style={{ width: BADGE_SIZE, height: BADGE_SIZE }}
      >
        {/* Layer 3 — the only element that actually rotates: just the
            arrow. Svg (Icon.jsx's shared wrapper) only forwards size/vb/
            className/fill — not style — so the arrow can't carry its own
            rotation; it rotates by virtue of being inside this wrapper
            instead. No ring/border accent here — a coral ring around the
            arrow read as an unwanted extra shape outside the arrow itself,
            so rotation is conveyed by the arrow's own asymmetric shape
            alone. */}
        <div
          className={`flex shrink-0 items-center justify-center rounded-full ${refreshing ? 'animate-spin-slow' : ''}`}
          style={{
            width: SPIN_SIZE,
            height: SPIN_SIZE,
            ...(refreshing ? null : { transform: `rotate(${dragRotationDeg}deg)` }),
          }}
        >
          <RotateCwIcon size={16} className="text-coral" />
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {visible ? statusText : ''}
      </p>
    </div>
  );
}
