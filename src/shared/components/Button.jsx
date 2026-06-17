import { cn } from '../utils/classNames.js';

const VARIANTS = {
  primary: 'bg-coral text-white shadow-coral active:bg-coral-deep disabled:bg-coral/40 disabled:shadow-none',
  secondary: 'border-[1.5px] border-coral text-coral bg-transparent active:bg-coral-tint',
  soft: 'bg-white text-ink shadow-soft active:bg-paper',
  ghost: 'text-ink-soft',
};

/** Shared button. `variant` controls the look; `full` makes it stretch. */
export default function Button({ variant = 'primary', full = false, className, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex h-[3.25rem] items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors disabled:cursor-default',
        full && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
