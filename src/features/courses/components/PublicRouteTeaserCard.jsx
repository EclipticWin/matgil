import PublicFeedTeaserOverlay from './PublicFeedTeaserOverlay.jsx';

/** Fake "next rank" card shown to guests once they hit the 5-item cap on the
 *  public routes feed, in place of the old standalone CTA card. Three
 *  stacked layers over the exact same outer shape as PublicCourseCard
 *  (rounded-3xl/shadow/white, copied verbatim) so it reads as the next real
 *  card rather than a separate, differently-sized banner:
 *   - layer A: a gray skeleton (bg-ink/[0.13], deliberately soft — dark
 *     enough to read as structure, faint enough to lose to the CTA's own
 *     text/button) in normal document flow, mirroring PublicCourseCard's own
 *     region layout region-for-region (rank line, title, divider, anchor
 *     line, stops/counts line, 1→2→3 stop path with connecting arrows,
 *     divider, save-count/view-detail row) — this is what gives the card
 *     its height, the same way real content would. `opacity-65 blur-[2px]`
 *     on this layer's own wrapper (not just layer B's backdrop-blur) softens
 *     each block's edges directly, so it reads as obscured content rather
 *     than sharp gray bars competing with the CTA on top of it.
 *   - layer B + C (PublicFeedTeaserOverlay): a thin white scrim
 *     (bg-white/32 backdrop-blur-[4px] — a neutral white tint, not opaque)
 *     and the sign-in copy, both absolutely positioned over layer A.
 *  No real rank number, title, stop, count, or image is ever rendered here,
 *  and no 6th-place row is ever fetched to build it — `sort` only decides
 *  whether the rank-line placeholder renders at all, matching the real
 *  card's own rank!=null condition (popular vs latest). Not interactive
 *  itself (no role/tabIndex/onClick, skeleton wrapped in aria-hidden) — only
 *  the overlay's sign-in button is a real, focusable action. */
export default function PublicRouteTeaserCard({ sort, onSignInClick, className }) {
  const showRank = sort === 'popular';
  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)] ${className ?? ''}`}
    >
      <div aria-hidden="true" className="relative z-0 opacity-65 blur-[2px]">
        <div className="w-full border-b border-ink/5 px-[0.9375rem] py-[0.9375rem]">
          {showRank && <div className="mx-auto h-4 w-12 rounded-full bg-ink/[0.13]" />}
          <div className={`h-5 w-2/3 rounded-md bg-ink/[0.13] ${showRank ? 'mt-2.5' : ''}`} />
          <div className="mt-2 border-t border-ink/5" />
          <div className="mt-2.5 h-3 w-1/2 rounded bg-ink/[0.13]" />
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-4 w-10 rounded-md bg-ink/[0.13]" />
            <div className="h-3 w-24 rounded bg-ink/[0.13]" />
          </div>
        </div>

        <div className="bg-white px-[0.9375rem] pb-[0.9375rem]">
          <div className="mt-3.5 grid items-start gap-x-1" style={{ gridTemplateColumns: '1fr auto 1fr auto 1fr' }}>
            {[0, 1, 2].map((i) => {
              const col = i * 2 + 1;
              return (
                <div key={`stop-${i}`} className="contents">
                  <span style={{ gridColumn: col, gridRow: 1 }} className="mx-auto block h-5 w-5 shrink-0 rounded-full bg-ink/[0.13]" />
                  <span style={{ gridColumn: col, gridRow: 2 }} className="mt-2 block h-3 w-full rounded bg-ink/[0.13]" />
                  <span style={{ gridColumn: col, gridRow: 3 }} className="mx-auto mt-1 block h-2.5 w-2/3 rounded bg-ink/[0.13]" />
                </div>
              );
            })}
            {[0, 1].map((i) => (
              <span
                key={`arrow-${i}`}
                style={{ gridColumn: i * 2 + 2, gridRow: 1 }}
                className="mx-auto mt-2 block h-2 w-2 rounded-full bg-ink/[0.13]"
              />
            ))}
          </div>

          <div className="mt-3.5 border-t border-ink/5" />

          <div className="mt-3 flex min-h-[1.125rem] items-center justify-between gap-2">
            <div className="h-3 w-14 rounded bg-ink/[0.13]" />
            <div className="h-3 w-20 rounded bg-ink/[0.13]" />
          </div>
        </div>
      </div>

      <PublicFeedTeaserOverlay onSignInClick={onSignInClick} />
    </div>
  );
}
