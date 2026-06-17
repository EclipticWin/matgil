import { COMMUNITY_FILTERS } from '../data/communityPosts.js';
import { cn } from '../../../shared/utils/classNames.js';

/** Horizontal sub-tab chips for filtering community posts. */
export default function CommunityTabs({ value, onChange }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1 pt-[0.9375rem]">
      {COMMUNITY_FILTERS.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'h-[2.125rem] shrink-0 rounded-[1.0625rem] px-[0.9375rem] text-[0.8125rem] font-bold transition-colors',
              active ? 'bg-coral text-white shadow-coral' : 'bg-white text-ink-soft shadow-soft',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
