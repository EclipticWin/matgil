import { PHRASE_CATEGORIES } from '../data/phrases.js';
import { cn } from '../../../shared/utils/classNames.js';

/** Horizontal, scrollable category selector for the phrases page. */
export default function PhraseCategoryTabs({ value, onChange }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {PHRASE_CATEGORIES.map((cat) => {
        const active = value === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={cn(
              'h-9 shrink-0 rounded-full px-4 text-sm font-bold transition-colors',
              active ? 'bg-coral text-white shadow-coral' : 'bg-white text-ink-soft shadow-soft',
            )}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
