import { cn } from '../utils/classNames.js';
import { BackIcon } from './Icon.jsx';

/**
 * Page header with an optional back button and right-side slot.
 * Top padding leaves room for the device status bar.
 */
export default function Header({ title, subtitle, onBack, right, className }) {
  return (
    <div className={cn('px-5 pb-3 pt-14', className)}>
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-soft"
          >
            <BackIcon />
          </button>
        )}
        <h1 className="flex-1 font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
        {right}
      </div>
      {subtitle && <p className="mt-1 pl-1 text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}
