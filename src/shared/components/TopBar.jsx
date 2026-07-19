import { PinIcon } from './Icon.jsx';
import { useLocale } from '../i18n/LocaleProvider.jsx';

/**
 * Slim brand bar that fills the top of the frame (replacing the old phone
 * status-bar gap). Same surface as the bottom navigation, with the project
 * name centered. Shown on every tab page and the login screen.
 */
export default function TopBar() {
  const { t } = useLocale();
  return (
    <header className="hidden h-[3.25rem] shrink-0 items-center justify-center gap-1.5 border-b border-ink/5 bg-paper-soft/95 backdrop-blur lg:flex">
      <PinIcon size={18} className="text-coral" />
      <span className="font-display text-[1.0625rem] font-extrabold tracking-tight text-ink">
        {t('brand.name')}
      </span>
    </header>
  );
}
