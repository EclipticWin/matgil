import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getRecommendation } from '../services/recommendationService.js';

const RecommendationContext = createContext(null);

/**
 * Holds the recommendation flow state (chosen area + preferences) and the
 * generated result, so the Area → Preference → Loading → Result pages can
 * share data without prop-drilling.
 */
export function RecommendationProvider({ children }) {
  const [area, setArea] = useState(null);
  const [prefs, setPrefs] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecommendation({ area, prefs });
      setResult(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [area, prefs]);

  const reset = useCallback(() => {
    setArea(null);
    setPrefs([]);
    setResult(null);
  }, []);

  const value = useMemo(
    () => ({ area, setArea, prefs, setPrefs, result, loading, generate, reset }),
    [area, prefs, result, loading, generate, reset],
  );

  return <RecommendationContext.Provider value={value}>{children}</RecommendationContext.Provider>;
}

export function useRecommendation() {
  const ctx = useContext(RecommendationContext);
  if (!ctx) throw new Error('useRecommendation must be used within a RecommendationProvider');
  return ctx;
}
