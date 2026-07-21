import { useEffect, useRef, useState } from 'react';
import { StarIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useFoodCategories } from '../context/FoodCategoryProvider.jsx';
import { EMPTY_FILTERS } from '../data/exploreOptions.js';
import CategoryIcon from './CategoryIcon.jsx';

const RATING_STEPS = [1, 2, 3, 4, 5];
const RATING_STAR_SIZE = 36;
const RATING_POSITION_EPSILON = 0.0001;

/** Floors a continuous 0–5 slider position to the integer rating it represents —
 *  [n, n+1) all mean "n stars", so a boundary is only crossed once the position
 *  reaches it, never on approach (a plain round() would light a star half a point
 *  early). The tiny epsilon absorbs float noise from repeated 0.01-step dragging
 *  (e.g. a logical 3.0 landing as 2.9999999999996) without rounding a genuine 2.99
 *  up to 3. Clamped to 5 since floor(5 + epsilon) would otherwise overshoot. */
function integerRatingFromPosition(position) {
  const clamped = Math.min(5, Math.max(0, position));
  return Math.min(5, Math.floor(clamped + RATING_POSITION_EPSILON));
}

// `className` overrides (not appends to) the default margin-top — two Tailwind
// classes setting the same property have no defined precedence between them, so
// letting a caller "add more spacing" via an appended class would be a coin flip.
// Replacing the whole margin utility keeps every section's spacing deterministic
// (see the RATING section below, which needs more room than FOOD TYPE without
// changing FOOD TYPE's or any other section's default).
function SectionLabel({ children, className = 'mt-5' }) {
  return (
    <div className={cn('mb-3 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint', className)}>
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
/** Two synchronized inputs share one `sliderPosition`: each star is its own
 *  button (a direct "jump to n" shortcut, real accessible name via aria-label —
 *  never just a decorative icon now that it's clickable) and the range input
 *  below it (continuous drag). Both funnel through commitPosition(), so clicking
 *  star 3 moves the thumb to exactly position 3 and dragging past a boundary
 *  fills/empties a star — they can never disagree. A fixed 5-button row and a
 *  fixed `gap` (not `justify-between`, which would stretch to the wrapper's
 *  edges) mean neither element ever changes size or spacing as the value
 *  changes, so the layout around them never shifts. Stars and slider share one
 *  `max-w-[13.5rem]` wrapper — sized to the star row's own content width
 *  (5 × 36px + 4 × 8px gaps) — so both read as the same visual width. `disabled`
 *  covers the mg_place_review_stats fetch failing — the control still renders
 *  (no layout gap) but stops accepting input until stats are available; the
 *  whole wrapper dims via opacity rather than restyling each child. Track/thumb/
 *  progress are all explicitly styled by the `.matgil-rating-slider` class in
 *  index.css.
 *
 *  The range input itself moves continuously (`step={0.01}`, native touch/mouse
 *  drag) — `value`/`onChange` are still the committed INTEGER minimumRating
 *  (FilterSheet's external contract is unchanged), but internally the drag
 *  position is tracked separately in `sliderPosition` so the thumb never has to
 *  jump between 6 fixed ticks. `onChange(int)` only fires when the position
 *  actually crosses a whole-point boundary (integerRatingFromPosition), and the
 *  external `value` is re-synced into `sliderPosition` only when NOT mid-drag —
 *  otherwise onChange's own round-trip back down through the parent would snap
 *  the thumb to that integer tick and throw away the in-progress drag position. */
function RatingFilter({ value, onChange, t, disabled = false }) {
  const [sliderPosition, setSliderPosition] = useState(() => Number(value) || 0);
  const lastEmittedRef = useRef(integerRatingFromPosition(Number(value) || 0));
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDraggingRef.current) return;
    const next = Number(value) || 0;
    setSliderPosition(next);
    lastEmittedRef.current = integerRatingFromPosition(next);
  }, [value]);

  const displayRating = integerRatingFromPosition(sliderPosition);
  const valueText = displayRating > 0
    ? t('filter.minimumRatingValue', { rating: displayRating })
    : t('filter.noMinimumRating');

  function commitPosition(rawPosition) {
    const clamped = Math.min(5, Math.max(0, rawPosition));
    setSliderPosition(clamped);
    const integer = integerRatingFromPosition(clamped);
    if (integer !== lastEmittedRef.current) {
      lastEmittedRef.current = integer;
      onChange(integer);
    }
  }

  // Native step={0.01} makes ArrowLeft/Right crawl by a hundredth of a point —
  // overridden here to move a full point at a time, matching the mouse/touch
  // drag's "one star per crossed boundary" feel instead of a near-invisible nudge.
  // Home/End are left to native handling (already jump to 0/5 with no extra code).
  function handleKeyDown(e) {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      commitPosition(Math.min(5, Math.floor(sliderPosition) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      commitPosition(Math.max(0, Math.ceil(sliderPosition) - 1));
    }
  }

  const progressPercent = (Math.min(5, Math.max(0, sliderPosition)) / 5) * 100;

  return (
    <div className={cn('mx-auto w-full max-w-[13.5rem]', disabled && 'opacity-40')}>
      <div className="flex items-center justify-center gap-2">
        {RATING_STEPS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => commitPosition(n)}
            aria-label={t('filter.minimumRatingValue', { rating: n })}
            className="flex items-center justify-center border-0 bg-transparent p-0 leading-none disabled:cursor-not-allowed"
          >
            <StarIcon size={RATING_STAR_SIZE} className={!disabled && n <= displayRating ? 'text-coral' : 'text-ink/15'} />
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.01}
        value={sliderPosition}
        disabled={disabled}
        aria-disabled={disabled}
        onChange={(e) => commitPosition(Number(e.target.value))}
        onKeyDown={handleKeyDown}
        onPointerDown={() => { isDraggingRef.current = true; }}
        onPointerUp={() => { isDraggingRef.current = false; }}
        onPointerCancel={() => { isDraggingRef.current = false; }}
        aria-label={t('filter.rating')}
        aria-valuetext={valueText}
        style={{ '--rating-progress': `${progressPercent}%` }}
        className="matgil-rating-slider mt-3 h-6 w-full cursor-pointer"
      />
    </div>
  );
}

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
export default function FilterSheet({ value, onApply, onClose, ratingFilterAvailable = true }) {
  const { locale, t } = useLocale();
  const { filterCategories, getCategoryLabel, getCategoryIconKey } = useFoodCategories();
  const categories = [{ key: 'all' }, ...filterCategories];
  // Stats unavailable → open with the rating filter cleared rather than showing (and
  // then re-submitting) a minimum the candidate pool can no longer honor.
  const [draft, setDraft] = useState(() => (
    ratingFilterAvailable ? value : { ...value, minimumRating: 0 }
  ));
  const [catLimitHit, setCatLimitHit] = useState(false);
  const limitTimerRef = useRef(null);
  useEffect(() => () => { if (limitTimerRef.current) clearTimeout(limitTimerRef.current); }, []);

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
        <h2 className="font-display text-[1.375rem] font-bold tracking-tight text-ink">{t('filter.title')}</h2>
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

        <SectionLabel className="mt-10">{t('filter.rating')}</SectionLabel>
        <RatingFilter
          value={Number(draft.minimumRating) || 0}
          onChange={(minimumRating) => setDraft((d) => ({ ...d, minimumRating }))}
          t={t}
          disabled={!ratingFilterAvailable}
        />
        {!ratingFilterAvailable && (
          <p className="mt-2 text-center text-[0.78rem] text-ink-faint">
            {t('filter.ratingUnavailable')}
          </p>
        )}
      </div>

      {/* py-3.5 both sides — half of the previous py-7, still equal top/bottom so
          divider-to-buttons and buttons-to-bottom read as the same visual gap. */}
      <div className="shrink-0 border-t border-ink/5 px-5 py-3.5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setDraft(EMPTY_FILTERS); clearLimitToast(); }}
            className="h-[3.25rem] flex-1 rounded-[0.9375rem] border border-ink/10 bg-white text-base font-bold text-ink/80 transition-colors duration-100 active:bg-ink/[0.03]"
          >
            {t('filter.reset')}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-[3.25rem] flex-1 rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)] transition-colors duration-100 active:bg-[#E83D19]"
          >
            {t('filter.showResults')}
          </button>
        </div>
      </div>
    </>
  );
}
