import { PRESET_LOCATIONS } from '../data/locations.js';
import { PinIcon, CheckIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

export default function LocationSheet({ value, onSelect, onClose }) {
  return (
    <>
      <div className="shrink-0 px-5 pb-1 pt-2.5">
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-ink/15" />
        <h2 className="font-display text-[1.375rem] font-bold tracking-tight text-ink">Choose location</h2>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3.5 pb-5 pt-1">
        {PRESET_LOCATIONS.map((loc) => {
          const active = value?.key === loc.key;
          return (
            <button
              key={loc.key}
              type="button"
              onClick={() => { onSelect(loc); onClose(); }}
              className={cn(
                'mb-1 flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors',
                active ? 'bg-coral-tint' : 'bg-transparent',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  active ? 'bg-coral text-white' : 'bg-white text-coral shadow-soft',
                )}
              >
                <PinIcon size={15} />
              </span>
              <span className={cn('flex-1 text-[0.95rem]', active ? 'font-bold text-ink' : 'font-semibold text-ink')}>
                {loc.label}
              </span>
              {active && (
                <span className="flex h-[1.625rem] w-[1.625rem] items-center justify-center rounded-full bg-coral text-white">
                  <CheckIcon size={15} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
