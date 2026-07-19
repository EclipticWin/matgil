import { COMMUNITY_FILTERS } from '../data/communityPosts.js';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Horizontal sub-tab chips for filtering community posts. */
export default function CommunityTabs({ value, onChange }) {
  const { locale } = useLocale();
  return (
    <div className="min-w-0 max-w-full overflow-hidden">
      <div className="category-scroll flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 pt-[0.9375rem]">
        <div className="flex min-w-max gap-2">
          {COMMUNITY_FILTERS.map((f) => {
            const active = value === f.key;
            const label = locale === 'ko'
              ? (f.labelKo ?? f.label)
              : locale === 'zh-CN'
                ? (f.labelZh ?? f.label)
                : f.label;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onChange(f.key)}
                className={cn(
                  'h-[2.125rem] shrink-0 whitespace-nowrap rounded-[1.0625rem] px-[0.9375rem] text-[0.8125rem] font-bold transition-colors',
                  active
                    ? 'bg-coral text-white shadow-[0_2px_6px_rgba(248,72,31,0.22)]'
                    : 'bg-white text-ink-soft shadow-soft',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
