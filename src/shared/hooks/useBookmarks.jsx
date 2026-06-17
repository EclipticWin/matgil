import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const KEY = 'matgil.bookmarks';
const BookmarkContext = createContext(null);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Lightweight bookmark store shared across features (popular places,
 * recommendation stops, …). Persists the full place objects to localStorage
 * so the Bookmark page can render them without a cross-feature lookup.
 */
export function BookmarkProvider({ children }) {
  const [items, setItems] = useState(load);

  const persist = useCallback((next) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, []);

  const toggle = useCallback(
    (place) =>
      persist(
        items.some((p) => p.id === place.id)
          ? items.filter((p) => p.id !== place.id)
          : [place, ...items],
      ),
    [items, persist],
  );

  const isBookmarked = useCallback((id) => items.some((p) => p.id === id), [items]);

  const value = useMemo(() => ({ items, toggle, isBookmarked }), [items, toggle, isBookmarked]);

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarks() {
  const ctx = useContext(BookmarkContext);
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarkProvider');
  return ctx;
}
