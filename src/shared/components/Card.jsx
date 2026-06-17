import { cn } from '../utils/classNames.js';

/** Simple white surface with the app's soft shadow. */
export default function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cn('rounded-3xl bg-white shadow-soft', className)} {...props}>
      {children}
    </Tag>
  );
}
