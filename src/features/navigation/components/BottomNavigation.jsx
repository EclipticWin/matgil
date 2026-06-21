import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import { cn } from '../../../shared/utils/classNames.js';
import { HomeIcon, RouteIcon, ChatIcon, UsersIcon, UserIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const TABS = [
  { to: ROUTES.home, labelKey: 'nav.map', Icon: HomeIcon, end: true },
  { to: ROUTES.courses, labelKey: 'nav.courses', Icon: RouteIcon },
  { to: ROUTES.phrases, labelKey: 'nav.phrases', Icon: ChatIcon },
  { to: ROUTES.community, labelKey: 'nav.community', Icon: UsersIcon },
  { to: ROUTES.my, labelKey: 'nav.you', Icon: UserIcon },
];

/** Fixed 5-tab bottom navigation for the main tab pages. */
export default function BottomNavigation() {
  const { t } = useLocale();
  return (
    <nav className="flex shrink-0 items-center border-t border-ink/5 bg-paper-soft/95 py-2.5 backdrop-blur">
      {TABS.map(({ to, labelKey, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="flex flex-1 flex-col items-center gap-0.5">
          {({ isActive }) => (
            <>
              <Icon active={isActive} className={isActive ? 'text-coral' : 'text-ink-faint'} />
              <span className={cn('text-[0.6rem] font-semibold', isActive ? 'text-coral' : 'text-ink-faint')}>
                {t(labelKey)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
