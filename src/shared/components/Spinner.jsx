import { cn } from '../utils/classNames.js';

/**
 * Loading spinner. Pass size + border colors via className.
 * Example: <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
 */
export default function Spinner({ className }) {
  return <div className={cn('animate-spin rounded-full border-2', className)} />;
}
