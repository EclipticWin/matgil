import Card from '../../../shared/components/Card.jsx';
import PublicFeedTeaserOverlay from './PublicFeedTeaserOverlay.jsx';

/** Fake "next rank" card shown to guests once they hit the 5-item cap on the
 *  public places feed, in place of the old standalone CTA card. Three
 *  stacked layers over the exact same outer shape as PublicPlaceCard (same
 *  shared `Card` component, no className override on rounded/background/
 *  shadow) so it reads as the next real card rather than a separate,
 *  differently-sized banner:
 *   - layer A: a gray skeleton (bg-ink/[0.13], deliberately soft — dark
 *     enough to read as structure, faint enough to lose to the CTA's own
 *     text/button) in normal document flow, mirroring PublicPlaceCard's own
 *     region layout region-for-region (rank header, thumbnail-left/
 *     text-right body, name, subtitle, address, save-count/rating line) —
 *     this is what gives the card its height. `opacity-65 blur-[2px]` on
 *     this layer's own wrapper (not just layer B's backdrop-blur) softens
 *     each block's edges directly, so it reads as obscured content rather
 *     than sharp gray bars competing with the CTA on top of it.
 *   - layer B + C (PublicFeedTeaserOverlay): a thin white scrim
 *     (bg-white/32 backdrop-blur-[4px] — a neutral white tint, not opaque)
 *     and the sign-in copy, both absolutely positioned over layer A.
 *  No real rank number, name, image, address, or count is ever rendered
 *  here, and no next-place row is ever fetched to build it — `sort` only
 *  decides whether the rank-header placeholder renders at all, matching the
 *  real card's own rank!=null condition (popular vs latest). Not
 *  interactive itself (no role/tabIndex/onClick, skeleton wrapped in
 *  aria-hidden) — only the overlay's sign-in button is a real, focusable
 *  action. */
export default function PublicPlaceTeaserCard({ sort, onSignInClick, className }) {
  const showRank = sort === 'popular';
  return (
    <Card as="div" className={`relative overflow-hidden ${className ?? ''}`}>
      <div aria-hidden="true" className="relative z-0 opacity-65 blur-[2px]">
        {showRank && (
          <div className="flex items-center justify-center gap-1 border-b border-ink/5 px-3 py-2">
            <div className="h-4 w-12 rounded-full bg-ink/[0.13]" />
          </div>
        )}

        <div className="flex w-full items-center gap-3 p-3">
          <div className="aspect-[4/3] w-[4.5rem] shrink-0 rounded-lg bg-ink/[0.13]" />

          <div className="min-w-0 flex-1">
            <div className="h-4 w-4/5 rounded bg-ink/[0.13]" />
            <div className="mt-1.5 h-4 w-1/2 rounded bg-ink/[0.13]" />
            <div className="mt-2 h-3 w-2/5 rounded bg-ink/[0.13]" />
            <div className="mt-2 h-3 w-3/5 rounded bg-ink/[0.13]" />
            <div className="mt-2 h-3 w-1/3 rounded bg-ink/[0.13]" />
          </div>
        </div>
      </div>

      <PublicFeedTeaserOverlay onSignInClick={onSignInClick} />
    </Card>
  );
}
