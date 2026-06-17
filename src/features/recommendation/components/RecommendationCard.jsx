import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon } from '../../../shared/components/Icon.jsx';
import { useBookmarks } from '../../../shared/hooks/useBookmarks.jsx';
import { cn } from '../../../shared/utils/classNames.js';

const TINTS = ['#FFE3D4','#FFEFC9','#E2F1DE','#FBE0E4','#E6E9F7','#FFE0CE','#DDEFEA','#F0E6FF','#E6F0FF','#FFF3E0'];

export default function RecommendationCard({ stop, index }) {
  const { toggle, isBookmarked } = useBookmarks();
  const saved = isBookmarked(stop.id);
  const tint = TINTS[index % TINTS.length];
  const subtitle = stop.firstMenu || stop.tags?.[0] || '음식점';

  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="relative shrink-0">
        <Thumbnail src={stop.imageUrl} tint={tint} className="h-16 w-16" />
        <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-coral font-display text-xs font-bold text-white shadow-coral">
          {index + 1}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
        {stop.address && (
          <p className="mt-1 truncate text-xs text-ink-faint">{stop.address}</p>
        )}
      </div>

      <button
        type="button"
        aria-label={saved ? 'Remove bookmark' : 'Add bookmark'}
        onClick={() => toggle(stop)}
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
