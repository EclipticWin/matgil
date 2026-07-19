import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Horizontal, scrollable category selector. Receives categories as props. */
export default function PhraseCategoryTabs({ categories, value, onChange }) {
  const { locale } = useLocale();
  return (
    <div className="category-scroll w-full max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-1">
      <div className="flex min-w-max gap-2">
        {categories.map((cat) => {
          const active = value === cat.id;
          const label = locale === 'ko'
            ? (cat.labelKo ?? cat.label)
            : locale === 'zh-CN'
              ? (cat.labelZh ?? cat.label)
              : cat.label;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={cn(
                'h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors',
                active
                  ? 'bg-coral text-white'
                  : 'bg-white text-ink-soft',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
