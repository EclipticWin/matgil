import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes.js';
import AppLayout from '../shared/components/AppLayout.jsx';

import LoginPage from '../pages/LoginPage.jsx';
import SignUpPage from '../pages/SignUpPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import AreaPage from '../pages/AreaPage.jsx';
import PreferencePage from '../pages/PreferencePage.jsx';
import LoadingPage from '../pages/LoadingPage.jsx';
import ResultPage from '../pages/ResultPage.jsx';
import CoursesPage from '../pages/CoursesPage.jsx';
import CourseDetailPage from '../pages/CourseDetailPage.jsx';
import SavedCourseDetailPage from '../pages/SavedCourseDetailPage.jsx';
import CommunityPage from '../pages/CommunityPage.jsx';
import PhrasesPage from '../pages/PhrasesPage.jsx';
import PopularPage from '../pages/PopularPage.jsx';
import BookmarkPage from '../pages/BookmarkPage.jsx';
import MyPage from '../pages/MyPage.jsx';

/**
 * Two route groups:
 *  - Full-screen flow pages (login + the area→preference→loading→result wizard)
 *    render without the bottom navigation.
 *  - Tab pages render inside <AppLayout/>, which adds the bottom navigation.
 */
export default function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<LoginPage />} />
      <Route path={ROUTES.signup} element={<SignUpPage />} />
      <Route path={ROUTES.area} element={<AreaPage />} />
      <Route path={ROUTES.preference} element={<PreferencePage />} />
      <Route path={ROUTES.loading} element={<LoadingPage />} />
      <Route path={ROUTES.result} element={<ResultPage />} />
      <Route path={ROUTES.courseDetail(':id')} element={<CourseDetailPage />} />
      <Route path={ROUTES.savedCourseDetail(':id')} element={<SavedCourseDetailPage />} />

      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.courses} element={<CoursesPage />} />
        <Route path={ROUTES.community} element={<CommunityPage />} />
        <Route path={ROUTES.popular} element={<PopularPage />} />
        <Route path={ROUTES.phrases} element={<PhrasesPage />} />
        <Route path={ROUTES.bookmark} element={<BookmarkPage />} />
        <Route path={ROUTES.my} element={<MyPage />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
}
