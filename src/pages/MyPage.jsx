import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { useBookmarks } from '../shared/hooks/useBookmarks.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Card from '../shared/components/Card.jsx';
import Button from '../shared/components/Button.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

function Stat({ value, label, onClick }) {
  return (
    <Card
      as={onClick ? 'button' : 'div'}
      onClick={onClick}
      className="flex-1 px-2 py-3.5 text-center"
    >
      <div className="font-display text-2xl font-bold text-coral">{value}</div>
      <div className="mt-0.5 text-[0.7rem] font-semibold leading-tight text-ink-soft">{label}</div>
    </Card>
  );
}

/** My tab: profile when logged in, otherwise redirect to the login page. */
export default function MyPage() {
  const { user, logout, loading } = useAuth();
  const { items } = useBookmarks();
  const navigate = useNavigate();
  const { t } = useLocale();

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  return (
    <PageShell>
      <PageHeader title={t('my.title')} titleClassName="mb-5" />

      <Card className="flex items-center gap-3.5 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber to-coral font-display text-2xl font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-bold text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
        </div>
      </Card>

      <div className="mt-3.5 flex gap-2.5">
        <Stat value={items.length} label={t('my.savedPlaces')} onClick={() => navigate(ROUTES.bookmark)} />
        <Stat value="2" label={t('my.coursesWalked')} />
        <Stat value="14" label={t('my.reviewsLeft')} />
      </div>

      <Button variant="secondary" full className="mt-6" onClick={logout}>
        {t('my.logout')}
      </Button>
    </PageShell>
  );
}
