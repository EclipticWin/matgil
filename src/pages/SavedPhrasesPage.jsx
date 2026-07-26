import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import SavedPhrasesTab from '../features/phrases/components/SavedPhrasesTab.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { BackIcon } from '../shared/components/Icon.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** MyPage's "저장한 표현" destination — same rationale as SavedRoutesPage/SavedPlacesPage
 *  (its siblings): a real route rather than in-page view state. */
export default function SavedPhrasesPage() {
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
      <PageHeader title={t('savedPhrases.title')} subtitle={t('savedPhrases.subtitle')} titleClassName="mb-1" subtitleClassName="mt-1" />
      <div className="mt-4">
        <SavedPhrasesTab />
      </div>
    </PageShell>
  );
}
