import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes.js';
import { consumeOAuthReturnTo } from '../shared/utils/authRedirect.js';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import AppLayout from '../shared/components/AppLayout.jsx';

import LoginPage from '../pages/LoginPage.jsx';
import SignUpPage from '../pages/SignUpPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import AreaPage from '../pages/AreaPage.jsx';
import PreferencePage from '../pages/PreferencePage.jsx';
import LoadingPage from '../pages/LoadingPage.jsx';
import ResultPage from '../pages/ResultPage.jsx';
import ExplorePage from '../pages/ExplorePage.jsx';
import CourseDetailPage from '../pages/CourseDetailPage.jsx';
import SavedCourseDetailPage from '../pages/SavedCourseDetailPage.jsx';
import PublicCourseDetailPage from '../pages/PublicCourseDetailPage.jsx';
import PlaceDetailPage from '../pages/PlaceDetailPage.jsx';
import PlaceReviewsPage from '../pages/PlaceReviewsPage.jsx';
import CommunityPage from '../pages/CommunityPage.jsx';
import PhrasesPage from '../pages/PhrasesPage.jsx';
import PopularPage from '../pages/PopularPage.jsx';
import BookmarkPage from '../pages/BookmarkPage.jsx';
import MyPage from '../pages/MyPage.jsx';
import SavedRoutesPage from '../pages/SavedRoutesPage.jsx';
import SavedPlacesPage from '../pages/SavedPlacesPage.jsx';
import SavedPhrasesPage from '../pages/SavedPhrasesPage.jsx';
import DataSourcesPage from '../pages/DataSourcesPage.jsx';

/**
 * Two route groups:
 *  - Full-screen flow pages (login + the area→preference→loading→result wizard)
 *    render without the bottom navigation.
 *  - Tab pages render inside <AppLayout/>, which adds the bottom navigation.
 */
export default function AppRouter() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // OAuth (Google/Facebook) always redirects back to the app root, so this is
  // the one place that can restore the page a "log in required" prompt was
  // opened from for that flow — see storeOAuthReturnTo() in LoginForm.jsx.
  // No-ops (nothing to consume) for the ordinary email/password login, which
  // already handles its own returnTo via LoginPage's onDone.
  useEffect(() => {
    if (!user) return;
    const returnTo = consumeOAuthReturnTo();
    if (returnTo) navigate(returnTo, { replace: true });
  }, [user, navigate]);

  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.signup} element={<SignUpPage />} />
      {/* Public data/image source disclosure — no login required, reached from
          both LoginPage and MyPage's Settings section (see DataSourcesPage.jsx). */}
      <Route path={ROUTES.dataSources} element={<DataSourcesPage />} />
      <Route path={ROUTES.area} element={<AreaPage />} />
      <Route path={ROUTES.preference} element={<PreferencePage />} />
      <Route path={ROUTES.loading} element={<LoadingPage />} />
      <Route path={ROUTES.result} element={<ResultPage />} />
      <Route path={ROUTES.courseDetail(':id')} element={<CourseDetailPage />} />
      <Route path={ROUTES.savedCourseDetail(':id')} element={<SavedCourseDetailPage />} />
      <Route path={ROUTES.publicCourseDetailPattern} element={<PublicCourseDetailPage />} />
      <Route path={ROUTES.placeDetail(':placeId')} element={<PlaceDetailPage />} />
      <Route path={ROUTES.placeReviews(':placeId')} element={<PlaceReviewsPage />} />
      {/* Old public-tab URL — /courses/:id (an individual course) is a
          separate, more specific route above and never hits this one. */}
      <Route path={ROUTES.courses} element={<Navigate to={ROUTES.explore} replace />} />

      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.explore} element={<ExplorePage />} />
        <Route path={ROUTES.community} element={<CommunityPage />} />
        <Route path={ROUTES.popular} element={<PopularPage />} />
        <Route path={ROUTES.phrases} element={<PhrasesPage />} />
        <Route path={ROUTES.bookmark} element={<BookmarkPage />} />
        <Route path={ROUTES.my} element={<MyPage />} />
        <Route path={ROUTES.mySavedRoutes} element={<SavedRoutesPage />} />
        <Route path={ROUTES.mySavedPlaces} element={<SavedPlacesPage />} />
        <Route path={ROUTES.mySavedPhrases} element={<SavedPhrasesPage />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
