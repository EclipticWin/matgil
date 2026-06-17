import { cn } from '../utils/classNames.js';

/**
 * Page-level h1 + optional subtitle.
 * `titleClassName` extends the h1 (e.g. mb-5).
 * `subtitleClassName` extends the subtitle <p> (e.g. mt-1, [text-wrap:pretty]).
 */
export default function PageHeader({ title, subtitle, titleClassName, subtitleClassName }) {
  return (
    <>
      <h1 className={cn('font-display text-[1.75rem] font-bold tracking-tight text-ink', titleClassName)}>
        {title}
      </h1>
      {subtitle && (
        <p className={cn('text-sm text-ink-soft', subtitleClassName)}>{subtitle}</p>
      )}
    </>
  );
}
