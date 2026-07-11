import { LocaleProvider } from '../shared/i18n/LocaleProvider.jsx';
import { AuthProvider } from '../features/auth/hooks/useAuth.jsx';
import { RecommendationProvider } from '../features/recommendation/hooks/useRecommendation.jsx';
import { BookmarkProvider } from '../shared/hooks/useBookmarks.jsx';
import { FoodCategoryProvider } from '../features/explore/context/FoodCategoryProvider.jsx';

/**
 * Composes all global context providers in one place so App.jsx stays small.
 * LocaleProvider is outermost so every tab page can read/set locale.
 */
export default function Providers({ children }) {
  return (
    <LocaleProvider>
      <FoodCategoryProvider>
        <AuthProvider>
          <RecommendationProvider>
            <BookmarkProvider>{children}</BookmarkProvider>
          </RecommendationProvider>
        </AuthProvider>
      </FoodCategoryProvider>
    </LocaleProvider>
  );
}
