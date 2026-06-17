import { cn } from '../utils/classNames.js';

/** Progress dots for the multi-step recommendation flow. */
export default function StepIndicator({ step, total, className }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < step ? 'w-6 bg-coral' : 'w-1.5 bg-ink-faint/30',
          )}
        />
      ))}
    </div>
  );
}
