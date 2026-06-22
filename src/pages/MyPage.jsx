import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Card from '../shared/components/Card.jsx';
import Button from '../shared/components/Button.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../shared/utils/avatarColor.js';
import EditProfileSheet from '../features/profile/components/EditProfileSheet.jsx';
import MyPostsView from '../features/profile/components/MyPostsView.jsx';
import LikedPostsView from '../features/profile/components/LikedPostsView.jsx';
import { fetchMyActivityCounts } from '../features/community/services/communityService.js';

function StatCard({ value, label, onClick }) {
  return (
    <Card as="button" onClick={onClick} className="flex-1 active:opacity-80">
      <div className="flex flex-col items-center justify-center px-2 py-4">
        <div className="font-display text-2xl font-bold text-coral">
          {value === null ? '–' : value}
        </div>
        <div className="mt-1 text-center text-[0.7rem] font-semibold leading-tight text-ink-soft">
          {label}
        </div>
      </div>
    </Card>
  );
}

export default function MyPage() {
  const { user, logout, loading, updateDisplayName } = useAuth();
  const { t } = useLocale();

  const [view, setView] = useState('home'); // 'home' | 'myPosts' | 'likedPosts'
  const [counts, setCounts] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState('');

  const loadCounts = useCallback(() => {
    if (!user) return;
    fetchMyActivityCounts(user.id)
      .then(setCounts)
      .catch(() => setCounts({ myPosts: 0, likedPosts: 0, likedComments: 0 }));
  }, [user]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const goHome = useCallback(() => {
    setView('home');
    loadCounts();
  }, [loadCounts]);

  const handleSaveProfile = useCallback(async (displayName) => {
    await updateDisplayName(displayName);
    setEditingProfile(false);
    setToast(t('my.profileUpdated'));
    setTimeout(() => setToast(''), 3000);
  }, [updateDisplayName, t]);

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  if (view === 'myPosts') {
    return <MyPostsView user={user} onBack={goHome} onPostsChanged={loadCounts} />;
  }
  if (view === 'likedPosts') {
    return <LikedPostsView user={user} onBack={goHome} />;
  }

  return (
    <PageShell>
      <PageHeader title={t('my.title')} titleClassName="mb-5" />

      {/* Profile card */}
      <Card className="flex items-center gap-3.5 p-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(user.id)} font-display text-2xl font-bold text-white`}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.05rem] font-bold text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingProfile(true)}
          className="shrink-0 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink-soft active:bg-ink/10"
        >
          {t('my.editProfile')}
        </button>
      </Card>

      {toast && (
        <p className="mt-2 text-center text-xs font-semibold text-green-600">{toast}</p>
      )}

      {/* Activity stat cards — 2개, 정렬 안정화 */}
      <div className="mt-3.5 flex gap-2.5">
        <StatCard
          value={counts?.myPosts ?? null}
          label={t('my.myPosts')}
          onClick={() => setView('myPosts')}
        />
        <StatCard
          value={counts?.likedPosts ?? null}
          label={t('my.likedPosts')}
          onClick={() => setView('likedPosts')}
        />
      </div>

      <Button variant="secondary" full className="mt-6" onClick={logout}>
        {t('my.logout')}
      </Button>

      {editingProfile && (
        <EditProfileSheet
          currentName={user.name}
          onSave={handleSaveProfile}
          onClose={() => setEditingProfile(false)}
        />
      )}
    </PageShell>
  );
}
