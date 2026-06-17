import { cn } from '../utils/classNames.js';

/** Centered empty-state with an icon bubble, title and optional description. */
export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-8 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-coral-tint text-coral">
          {icon}
        </div>
      )}
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      {description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
