import { PinIcon } from './Icon.jsx';

/**
 * Slim brand bar that fills the top of the frame (replacing the old phone
 * status-bar gap). Same surface as the bottom navigation, with the project
 * name centered. Shown on every tab page and the login screen.
 */
export default function TopBar() {
  return (
    <header className="flex h-[3.25rem] shrink-0 items-center justify-center gap-1.5 border-b border-ink/5 bg-paper-soft/95 backdrop-blur">
      <PinIcon size={15} className="text-coral" />
      <span className="font-display text-[1.0625rem] font-extrabold tracking-tight text-ink">
        Matgil
      </span>
    </header>
  );
}
