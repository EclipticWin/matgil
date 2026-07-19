import { useState, useRef, useEffect } from 'react';
import { EMPTY_FILTERS, filterCount } from '../data/exploreOptions.js';
import CategoryIcon from './CategoryIcon.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useFoodCategories } from '../context/FoodCategoryProvider.jsx';

function SectionLabel({ children }) {
  return (
    <div className="mb-3 mt-5 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
      {children}
    </div>
  );
}

// active/inactive must render at IDENTICAL width so selecting a pill never
// reflows the flex-wrap layout (this bit zh-CN hardest — some category
// labels sit right at the wrap threshold, so even a few px of width drift
// changes which pills share a row). box-border makes width = content +
// padding + border explicitly (belt-and-suspenders alongside Tailwind's
// Preflight, which already sets border-box globally); border-[1.5px] is
// applied in BOTH states (only the color toggles to transparent when active)
// so the border never adds/removes width; font-synthesis-none stops the
// browser from synthesizing a fake bold face for CJK glyphs the real font
// weight doesn't have, which can otherwise shift glyph advance widths.
function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'box-border inline-flex h-10 items-center gap-2 rounded-[0.8125rem] border-[1.5px] px-[0.9375rem] text-[0.84rem] font-semibold transition-colors [font-synthesis:none]',
        active ? 'border-transparent bg-coral text-white' : 'border-ink/10 bg-white text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Bottom-sheet filter form (food type / price / good-for). Edits a draft and
 *  commits on "Show results". */
export default function FilterSheet({ value, onApply, onClose }) {
  const { locale, t } = useLocale();
  const { filterCategories, getCategoryLabel, getCategoryIconKey } = useFoodCategories();
  const categories = [{ key: 'all' }, ...filterCategories];
  const [draft, setDraft] = useState(value);
  const [catLimitHit, setCatLimitHit] = useState(false);
  const limitTimerRef = useRef(null);
  useEffect(() => () => { if (limitTimerRef.current) clearTimeout(limitTimerRef.current); }, []);
  const count = filterCount(draft);

  const showLimitToast = () => {
    setCatLimitHit(true);
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    limitTimerRef.current = setTimeout(() => setCatLimitHit(false), 2000);
  };
  const clearLimitToast = () => {
    setCatLimitHit(false);
    if (limitTimerRef.current) { clearTimeout(limitTimerRef.current); limitTimerRef.current = null; }
  };

  return (
    <>
      <div className="shrink-0 px-5 pb-1 pt-2.5">
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[1.375rem] font-bold tracking-tight text-ink">{t('filter.title')}</h2>
          <button
            type="button"
            onClick={() => { setDraft(EMPTY_FILTERS); clearLimitToast(); }}
            className={cn('text-[0.84rem] font-bold', count ? 'text-coral' : 'text-ink-faint')}
          >
            {t('filter.reset')}
          </button>
        </div>
        {catLimitHit && (
          <div
            role="status"
            aria-live="polite"
            className="mt-2.5 rounded-xl bg-coral/10 px-3.5 py-2 text-[0.8rem] font-semibold text-coral"
          >
            {t('filter.catLimit')}
          </div>
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">
        <SectionLabel>{t('filter.foodType')}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const isAll = c.key === 'all';
            const cur = Array.isArray(draft.cat) ? draft.cat : [];
            const active = isAll ? cur.length === 0 : cur.includes(c.key);
            return (
              <Pill
                key={c.key}
                active={active}
                onClick={() => {
                  if (isAll) {
                    clearLimitToast();
                    setDraft((d) => ({ ...d, cat: [] }));
                  } else {
                    setDraft((d) => {
                      const prev = Array.isArray(d.cat) ? d.cat : [];
                      if (prev.includes(c.key)) {
                        clearLimitToast();
                        return { ...d, cat: prev.filter((x) => x !== c.key) };
                      }
                      if (prev.length >= 3) {
                        showLimitToast();
                        return d;
                      }
                      clearLimitToast();
                      return { ...d, cat: [...prev, c.key] };
                    });
                  }
                }}
              >
                <CategoryIcon name={isAll ? 'all' : getCategoryIconKey(c.key)} className={active ? 'text-white' : 'text-coral'} />
                {isAll ? t('filter.all') : getCategoryLabel(c.key, locale)}
              </Pill>
            );
          })}
        </div>

      </div>

      <div className="shrink-0 border-t border-ink/5 px-5 pb-7 pt-3">
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className="h-[3.25rem] w-full rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)]"
        >
          {t('filter.showResults')}{count ? ` · ${count}` : ''}
        </button>
      </div>
    </>
  );
}
