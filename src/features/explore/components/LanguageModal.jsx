import { LANGUAGES } from '../data/exploreOptions.js';
import { CloseIcon, CheckIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Centered language picker. Reads and writes locale via LocaleProvider. */
export default function LanguageModal({ onClose }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between px-5 pb-1.5 pt-5">
        <h2 className="font-display text-[1.3125rem] font-bold tracking-tight text-ink">{t('language.title')}</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-ink-soft">
          <CloseIcon />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3.5 pb-4 pt-1">
        {LANGUAGES.map((l) => {
          const active = l.code === locale;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLocale(l.code);
                onClose();
              }}
              className={cn(
                'mb-1 flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors',
                active ? 'bg-coral-tint' : 'bg-transparent',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-bold',
                  active ? 'bg-coral text-white' : 'bg-white text-ink shadow-soft',
                )}
              >
                {l.short}
              </span>
              <span className={cn('flex-1 text-base', active ? 'font-bold text-ink' : 'font-semibold text-ink')}>
                {l.name}
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
