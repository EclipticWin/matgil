import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFoodCategories } from '../../../api/foodCategoryApi.js';
import { FOOD_CATEGORY_FALLBACK } from '../data/foodCategoryFallback.js';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

const FoodCategoryContext = createContext(null);

export function FoodCategoryProvider({ children }) {
  const [allCategories, setAllCategories] = useState(FOOD_CATEGORY_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('fallback');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const categories = await getFoodCategories();
      setAllCategories(categories);
      setError(null);
      setSource('db');
    } catch (nextError) {
      setAllCategories(FOOD_CATEGORY_FALLBACK);
      setError(nextError);
      setSource('fallback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const categoryMap = useMemo(
    () => new Map(allCategories.map((category) => [category.key, category])),
    [allCategories],
  );
  const filterCategories = useMemo(() => allCategories
    .filter((category) => category.isActive && category.isFilterable && category.deletedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)), [allCategories]);
  const getCategoryLabel = useCallback((key, locale = 'en') => {
    const translations = categoryMap.get(key)?.translations ?? {};
    const labelByLocale = {};
    for (const [loc, translation] of Object.entries(translations)) labelByLocale[loc] = translation?.label;
    return pickTranslated(labelByLocale, locale) ?? key;
  }, [categoryMap]);
  const getCategoryIconKey = useCallback(
    (key) => categoryMap.get(key)?.iconKey ?? 'default',
    [categoryMap],
  );

  const value = useMemo(() => ({
    allCategories, filterCategories, categoryMap, getCategoryLabel, getCategoryIconKey,
    loading, error, source, reload,
  }), [allCategories, filterCategories, categoryMap, getCategoryLabel, getCategoryIconKey, loading, error, source, reload]);

  return <FoodCategoryContext.Provider value={value}>{children}</FoodCategoryContext.Provider>;
}

export function useFoodCategories() {
  const value = useContext(FoodCategoryContext);
  if (!value) throw new Error('useFoodCategories must be used within FoodCategoryProvider');
  return value;
}
