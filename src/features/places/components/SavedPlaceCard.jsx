import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon, StarIcon } from '../../../shared/components/Icon.jsx';
import { formatStopDistance } from '../../courses/utils/courseDisplay.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Saved-place card for the Courses → Saved Places tab. Tapping the card opens the
 *  place (via the Map tab's detail sheet); tapping the heart unsaves it without
 *  navigating — `onRemove` fires on a plain div-as-button card, not a nested
 *  <button>, precisely so the heart button inside it stays valid HTML. */
export default function SavedPlaceCard({ place, reviewStats, removing = false, onOpen, onRemove }) {
  const { t } = useLocale();
  const subtitle = place.firstMenu || place.tags?.[0] || null;
  const locationLabel = formatStopDistance(place) ?? place.address ?? null;
  const hasStats = reviewStats && reviewStats.rating_count > 0;

  return (
    <Card
      as="div"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(place)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(place); } }}
      className="flex w-full items-center gap-3 p-3 text-left"
    >
      <Thumbnail src={place.imageUrl} className="h-[4.5rem] w-[4.5rem] shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">{place.name}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>}
        {locationLabel && <p className="mt-1 truncate text-xs text-ink-faint">{locationLabel}</p>}
        {hasStats ? (
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-coral">
            <StarIcon size={10} />
            {Number(reviewStats.rating_avg).toFixed(1)}
            <span className="font-normal text-ink-faint">({reviewStats.rating_count})</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-faint">{t('placeDetail.noReviewsYet')}</p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(place); }}
        disabled={removing}
        aria-label={t('savedPlaces.remove')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral-tint text-coral disabled:opacity-50"
      >
        <HeartIcon active size={18} />
      </button>
    </Card>
  );
}
