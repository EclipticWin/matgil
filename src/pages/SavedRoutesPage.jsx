import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import SavedRoutesTab from '../features/courses/components/SavedRoutesTab.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { BackIcon } from '../shared/components/Icon.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** MyPage's "저장한 동선" destination — the pre-existing SavedRoutesTab, now
 *  reached via its own route (rather than a tab inside the now-public
 *  Courses page) so browser back / direct URL / return-from-detail all behave
 *  like an ordinary page instead of transient in-page view state. Reusing
 *  MyPage's own "no user -> redirect to /login" guard, since this is reached
 *  only from an already-login-gated screen but should still be safe as a
 *  direct URL. */
export default function SavedRoutesPage() {
  const { t } = useLocale();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => navigate(ROUTES.my)}
        aria-label="Back"
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink"
      >
        <BackIcon />
      </button>
      <PageHeader title={t('savedCourses.title')} subtitle={t('savedCourses.subtitle')} titleClassName="mb-1" subtitleClassName="mt-1" />
      <div className="mt-4">
        <SavedRoutesTab />
      </div>
    </PageShell>
  );
}
