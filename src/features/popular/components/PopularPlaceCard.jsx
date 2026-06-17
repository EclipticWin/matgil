import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon } from '../../../shared/components/Icon.jsx';
import { useBookmarks } from '../../../shared/hooks/useBookmarks.jsx';
import { cn } from '../../../shared/utils/classNames.js';

const TINTS = ['#FFE3D4','#FFEFC9','#E2F1DE','#FBE0E4','#E6E9F7','#FFE0CE','#DDEFEA','#F0E6FF','#E6F0FF','#FFF3E0'];

export default function PopularPlaceCard({ place, rank }) {
  const { toggle, isBookmarked } = useBookmarks();
  const saved = isBookmarked(place.id);
  const tint = TINTS[(rank - 1) % TINTS.length];
  const subtitle = place.firstMenu || place.tags?.[0] || '음식점';

  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="relative shrink-0">
        <Thumbnail src={place.imageUrl} tint={tint} className="h-[4.5rem] w-[4.5rem]" />
        <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink font-display text-xs font-bold text-white">
          {rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-bold text-ink">{place.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
        {place.address && (
          <p className="mt-1 truncate text-xs text-ink-faint">{place.address}</p>
        )}
      </div>

      <button
        type="button"
        aria-label={saved ? 'Remove bookmark' : 'Add bookmark'}
        onClick={() => toggle(place)}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
          saved ? 'bg-coral-tint text-coral' : 'border-[1.5px] border-ink/10 text-coral',
        )}
      >
        <HeartIcon active={saved} size={18} />
      </button>
    </Card>
  );
}
