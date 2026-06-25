import Card from '../../../shared/components/Card.jsx';

export default function StatCard({ value, label, onClick, valueClassName }) {
  return (
    <Card as="button" onClick={onClick} className="flex-1 active:opacity-80">
      <div className="flex flex-col items-center justify-center px-1 py-4">
        <div className="line-clamp-2 text-center text-[0.7rem] font-semibold leading-tight text-ink-soft">
          {label}
        </div>
        <div className={`mt-1 font-display font-bold text-coral ${valueClassName ?? 'text-2xl'}`}>
          {value === null ? '–' : value}
        </div>
      </div>
    </Card>
  );
}
