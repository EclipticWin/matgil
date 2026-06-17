import { PinIcon, WalkIcon, ClockIcon } from '../../../shared/components/Icon.jsx';

function Stat({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      {icon}
      {children}
    </span>
  );
}

/** Headline summary of a generated route (title + key stats). */
export default function RecommendationSummary({ result }) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-coral to-coral-deep p-5 text-white shadow-coral">
      <p className="text-xs font-extrabold uppercase tracking-wide opacity-90">★ Recommended route</p>
      <h2 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight">{result.title}</h2>
      <div className="mt-3 flex items-center gap-4">
        <Stat icon={<PinIcon size={14} />}>{result.stopCount} stops</Stat>
        <Stat icon={<WalkIcon size={14} />}>{result.distance}</Stat>
        <Stat icon={<ClockIcon size={14} />}>{result.duration}</Stat>
      </div>
    </div>
  );
}
