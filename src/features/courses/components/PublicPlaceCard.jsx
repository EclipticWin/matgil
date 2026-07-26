import { cn } from '../../../shared/utils/classNames.js';
import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { StarIcon, PinIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { RANK_BAND_STYLES, RANK_MEDAL_SRC } from '../utils/rankDisplay.js';

/** Public "popular places" feed card — same two-region shape as
 *  PublicCourseCard (see its own doc comment): a full-width rank section
 *  (medal + rank text, colored end-to-end for rank 1-3, plain white for 4+,
 *  nothing at all for latest sort) with its own faint bottom border, then a
 *  plain white body (thumbnail, name, subtitle, current-locale address,
 *  save-count/rating). One `role=button` div, not two separate click
 *  targets — unlike the course card, this card's rank section and body
 *  always lead to the same place detail, so there's nothing to disambiguate.
 *  No list-level save action here (unlike the old always-active heart) — the
 *  existing bookmark heart on the place detail page is the only way to save
 *  from this flow now (see PublicPlacesTab).
 *  `rank`: 1-based popular-sort position (see PublicPlacesTab), or null for
 *  latest sort — the whole rank section is omitted for null. */
export default function PublicPlaceCard({ place, rank = null, reviewStats, onOpen }) {
  const { t } = useLocale();
  const subtitle = place.firstMenu || place.tags?.[0] || null;
  const hasStats = reviewStats && reviewStats.rating_count > 0;
  const rankStyle = rank != null && rank >= 1 && rank <= 3 ? RANK_BAND_STYLES[rank] : null;

  return (
    <Card
      as="div"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(place)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(place); } }}
      className="overflow-hidden text-left"
    >
      {rank != null && (
        <div
          className={cn(
            'flex items-center justify-center gap-1 border-b border-ink/5 px-3 py-2',
            rankStyle ? cn(rankStyle.wrap, rankStyle.text) : 'text-ink',
          )}
        >
          {rankStyle && (
            <img
              src={RANK_MEDAL_SRC[rank]}
              alt=""
              aria-hidden="true"
              className="h-5 w-5 shrink-0 object-contain"
            />
          )}
          <span className="font-display text-sm font-extrabold">
            {t('publicFeed.rankLabel', { rank })}
          </span>
        </div>
      )}

      <div className="flex w-full items-center gap-3 p-3">
        <Thumbnail src={place.imageUrl} className="h-[4.5rem] w-[4.5rem] shrink-0" />

        <div className="min-w-0 flex-1">
          {/* Same text-ink/90 the route card's title uses in its own default
              (non-ranked) state — this name never sits inside a rank color
              band, so it should read the same as that baseline, not the
              fully-opaque text-ink this used to be. */}
          <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink/90">{place.name}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>}
          {place.address && (
            <p className="mt-1 flex items-center gap-1 text-xs text-ink-faint">
              <PinIcon size={11} className="shrink-0" />
              <span className="truncate">{place.address}</span>
            </p>
          )}
          {/* One neutral stats line — save count, rating, and review count all
              share the same color/weight so this reads as plain aggregate
              info, not a coral "you saved this" call to action. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-ink/75">
            <span>{t('publicFeed.saveCount', { n: place.saveCount ?? 0 })}</span>
            <span>·</span>
            {hasStats ? (
              <span className="inline-flex items-center gap-1">
                <StarIcon size={10} />
                {Number(reviewStats.rating_avg).toFixed(1)}
                <span>({reviewStats.rating_count})</span>
              </span>
            ) : (
              <span>{t('placeDetail.noReviewsYet')}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
