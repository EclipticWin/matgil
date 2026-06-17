import { useNavigate, Navigate } from 'react-router-dom';
import { useRecommendation } from '../features/recommendation/hooks/useRecommendation.jsx';
import RecommendationSummary from '../features/recommendation/components/RecommendationSummary.jsx';
import RecommendationCard from '../features/recommendation/components/RecommendationCard.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Header from '../shared/components/Header.jsx';
import Button from '../shared/components/Button.jsx';

/** Shows the generated route: summary + ordered stops. */
export default function ResultPage() {
  const navigate = useNavigate();
  const { result } = useRecommendation();

  // No result yet (e.g. refreshed/deep-linked) — send back to the start.
  if (!result) return <Navigate to={ROUTES.area} replace />;

  return (
    <div className="flex h-full flex-col bg-paper">
      <Header title="Your route" onBack={() => navigate(ROUTES.home)} />

      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6">
        <RecommendationSummary result={result} />

        <h2 className="mb-3 mt-6 text-xs font-extrabold uppercase tracking-wide text-ink-faint">
          {result.stopCount} stops on this course
        </h2>
        <div className="flex flex-col gap-3">
          {result.stops.map((stop, i) => (
            <RecommendationCard key={stop.id} stop={stop} index={i} />
          ))}
        </div>

        <Button full className="mt-6" onClick={() => navigate(ROUTES.home)}>
          Done
        </Button>
        <Button variant="ghost" full className="mt-1" onClick={() => navigate(ROUTES.area)}>
          Start over
        </Button>
      </div>
    </div>
  );
}
