import { AREAS } from '../data/mockAreas.js';
import { cn } from '../../../shared/utils/classNames.js';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { CheckIcon } from '../../../shared/components/Icon.jsx';

/** Grid of selectable neighbourhoods. Single select. */
export default function AreaSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {AREAS.map((area) => {
        const active = value === area.id;
        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onChange(area)}
            className={cn(
              'relative flex flex-col rounded-2xl border-[1.5px] bg-white p-3 text-left transition-colors',
              active ? 'border-coral' : 'border-transparent shadow-soft',
            )}
          >
            <Thumbnail tint={area.tint} className="mb-2.5 h-16 w-full" />
            <span className="text-sm font-bold text-ink">{area.name}</span>
            <span className="mt-0.5 text-xs text-ink-soft">{area.desc}</span>
            {active && (
              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-coral text-white">
                <CheckIcon size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
