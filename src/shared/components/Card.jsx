import { cn } from '../utils/classNames.js';

/** Simple white surface with the app's soft shadow. `rounded` lets one caller
 *  opt into a different corner radius (e.g. MyPage's slightly squarer cards)
 *  without touching every other screen that renders a Card — the default
 *  matches every existing caller's current look exactly. */
export default function Card({ as: Tag = 'div', className, rounded = 'rounded-3xl', children, ...props }) {
  return (
    <Tag className={cn(rounded, 'bg-white shadow-soft', className)} {...props}>
      {children}
    </Tag>
  );
}
