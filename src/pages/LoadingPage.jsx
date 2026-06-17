import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecommendation } from '../features/recommendation/hooks/useRecommendation.jsx';
import { ROUTES } from '../shared/constants/routes.js';

const MESSAGES = [
  'Scanning nearby spots…',
  'Matching your cravings…',
  'Planning the shortest walk…',
];

/** Generates the recommendation, then routes to the result. */
export default function LoadingPage() {
  const navigate = useNavigate();
  const { area, generate } = useRecommendation();
  const [msg, setMsg] = useState(0);

  // Guard: if the user deep-links here without choosing an area, restart.
  useEffect(() => {
    if (!area) {
      navigate(ROUTES.area, { replace: true });
      return undefined;
    }
    let active = true;
    const cycle = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 600);
    generate().then(() => {
      if (active) navigate(ROUTES.result, { replace: true });
    });
    return () => {
      active = false;
      clearInterval(cycle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-paper px-8 text-center">
      <div className="h-12 w-12 rounded-full border-4 border-coral/20 border-t-coral animate-spin-slow" />
      <p className="mt-6 font-display text-lg font-bold text-ink">Finding your route</p>
      <p className="mt-1.5 text-sm text-ink-soft">{MESSAGES[msg]}</p>
    </div>
  );
}
