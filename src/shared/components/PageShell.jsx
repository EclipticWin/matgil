import { cn } from '../utils/classNames.js';

/** Standard outer wrapper for tab pages: horizontal padding + top/bottom spacing. */
export default function PageShell({ children, className }) {
  return (
    <div className={cn('px-5 pb-6 pt-6', className)}>
      {children}
    </div>
  );
}
