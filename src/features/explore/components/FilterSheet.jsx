import { useState } from 'react';
import { CATEGORIES, PRICES, FEATURES, EMPTY_FILTERS, filterCount } from '../data/exploreOptions.js';
import CategoryIcon from './CategoryIcon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

function SectionLabel({ children }) {
  return (
    <div className="mb-3 mt-5 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-[0.8125rem] px-[0.9375rem] text-[0.84rem] font-semibold transition-colors',
        active ? 'bg-coral text-white' : 'border-[1.5px] border-ink/10 bg-white text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Bottom-sheet filter form (food type / price / good-for). Edits a draft and
 *  commits on "Show results". */
export default function FilterSheet({ value, onApply, onClose }) {
  const [draft, setDraft] = useState(value);
  const count = filterCount(draft);

  const toggleArr = (key, val) =>
    setDraft((d) => {
      const a = d[key];
      return { ...d, [key]: a.includes(val) ? a.filter((x) => x !== val) : [...a, val] };
    });

  return (
    <>
      <div className="shrink-0 px-5 pb-1 pt-2.5">
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[1.375rem] font-bold tracking-tight text-ink">Filters</h2>
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className={cn('text-[0.84rem] font-bold', count ? 'text-coral' : 'text-ink-faint')}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">
        <SectionLabel>Food type</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = draft.cat === c.key;
            return (
              <Pill key={c.key} active={active} onClick={() => setDraft((d) => ({ ...d, cat: c.key }))}>
                <CategoryIcon name={c.key} className={active ? 'text-white' : 'text-coral'} />
                {c.label}
              </Pill>
            );
          })}
        </div>

        <SectionLabel>Price</SectionLabel>
        <div className="flex gap-2">
          {PRICES.map((p) => {
            const active = draft.price.includes(p);
            return (
              <Pill key={p} active={active} onClick={() => toggleArr('price', p)}>
                <span className={cn('font-extrabold', active ? 'text-white' : 'text-green')}>{p}</span>
              </Pill>
            );
          })}
        </div>

        <SectionLabel>Good for</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <Pill key={f.id} active={draft.features.includes(f.id)} onClick={() => toggleArr('features', f.id)}>
              {f.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-ink/5 px-5 pb-7 pt-3">
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className="h-[3.25rem] w-full rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-coral"
        >
          Show results{count ? ` · ${count}` : ''}
        </button>
      </div>
    </>
  );
}
