import { NavLink } from 'react-router-dom';
import { ROUTES } from '../../../shared/constants/routes.js';
import { cn } from '../../../shared/utils/classNames.js';
import { HomeIcon, RouteIcon, ChatIcon, UsersIcon, UserIcon } from '../../../shared/components/Icon.jsx';

const TABS = [
  { to: ROUTES.home, label: 'Map', Icon: HomeIcon, end: true },
  { to: ROUTES.courses, label: 'Courses', Icon: RouteIcon },
  { to: ROUTES.phrases, label: 'Phrases', Icon: ChatIcon },
  { to: ROUTES.community, label: 'Community', Icon: UsersIcon },
  { to: ROUTES.my, label: 'You', Icon: UserIcon },
];

/** Fixed 5-tab bottom navigation for the main tab pages. */
export default function BottomNavigation() {
  return (
    <nav className="flex shrink-0 items-center border-t border-ink/5 bg-paper-soft/95 py-2.5 backdrop-blur">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="flex flex-1 flex-col items-center gap-0.5">
          {({ isActive }) => (
            <>
              <Icon active={isActive} className={isActive ? 'text-coral' : 'text-ink-faint'} />
              <span className={cn('text-[0.6rem] font-semibold', isActive ? 'text-coral' : 'text-ink-faint')}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
