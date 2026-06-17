import { AuthProvider } from '../features/auth/hooks/useAuth.jsx';
import { RecommendationProvider } from '../features/recommendation/hooks/useRecommendation.jsx';
import { BookmarkProvider } from '../shared/hooks/useBookmarks.jsx';

/**
 * Composes all global context providers in one place so App.jsx stays small.
 * Order is outer → inner; none depend on each other today.
 */
export default function Providers({ children }) {
  return (
    <AuthProvider>
      <RecommendationProvider>
        <BookmarkProvider>{children}</BookmarkProvider>
      </RecommendationProvider>
    </AuthProvider>
  );
}
