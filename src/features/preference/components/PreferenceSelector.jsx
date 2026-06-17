import { FOOD_PREFERENCES, DIETARY_PREFERENCES } from '../data/preferenceOptions.js';
import { cn } from '../../../shared/utils/classNames.js';

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border-[1.5px] px-4 py-2.5 text-sm font-semibold transition-colors',
        active ? 'border-coral bg-coral text-white' : 'border-ink/10 bg-white text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, options, selected, onToggle }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-ink-faint">{title}</h3>
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => (
          <Chip key={opt.id} active={selected.includes(opt.id)} onClick={() => onToggle(opt.id)}>
            {opt.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Multi-select preference picker. `value` is an array of selected ids. */
export default function PreferenceSelector({ value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-7">
      <Group title="Food type" options={FOOD_PREFERENCES} selected={value} onToggle={toggle} />
      <Group title="Good for" options={DIETARY_PREFERENCES} selected={value} onToggle={toggle} />
    </div>
  );
}
