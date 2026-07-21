import { cn } from '../utils/classNames.js';

/** Text-centric top tab switcher shared by Phrases/Courses: no pill or background,
 *  a coral underline + coral text mark the active tab. `border-b-2` renders on every
 *  button regardless of state (only the color toggles) so switching tabs never
 *  changes button width/layout. */
export default function UnderlineTabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex border-b border-ink/8', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 border-b-2 py-3 text-[0.95rem] transition-colors',
            value === tab.id
              ? 'border-coral font-bold text-coral'
              : 'border-transparent font-semibold text-ink-soft',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
