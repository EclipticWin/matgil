import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { fetchMyActivityCounts } from '../features/community/services/communityService.js';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import Modal from '../features/explore/components/Modal.jsx';
import { LANGUAGES } from '../features/explore/data/exploreOptions.js';
import EditProfileSheet from '../features/profile/components/EditProfileSheet.jsx';
import LikedPostsView from '../features/profile/components/LikedPostsView.jsx';
import MyPostsView from '../features/profile/components/MyPostsView.jsx';
import Card from '../shared/components/Card.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../shared/utils/avatarColor.js';

function StatCard({ value, label, onClick, valueClassName }) {
  return (
    <Card as="button" onClick={onClick} className="flex-1 active:opacity-80">
      <div className="flex flex-col items-center justify-center px-1 py-4">
        <div className="line-clamp-2 text-center text-[0.7rem] font-semibold leading-tight text-ink-soft">
          {label}
        </div>
        <div className={`mt-1 font-display font-bold text-coral ${valueClassName ?? 'text-2xl'}`}>
          {value === null ? '–' : value}
        </div>
      </div>
    </Card>
  );
}

export default function MyPage() {
  const { user, logout, loading, updateDisplayName, updatePassword } = useAuth();
  const { locale, t } = useLocale();

  const [view, setView] = useState('home'); // 'home' | 'myPosts' | 'likedPosts'
  const [counts, setCounts] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
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

  const handleSaveProfile = useCallback(async ({ displayName, newPassword }) => {
    if (displayName !== user.name) {
      await updateDisplayName(displayName);
    }
    if (newPassword) {
      await updatePassword(newPassword);
    }
    setEditingProfile(false);
    setToast(t('my.profileUpdated'));
    setTimeout(() => setToast(''), 3000);
  }, [updateDisplayName, updatePassword, user, t]);

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  if (view === 'myPosts') {
    return <MyPostsView user={user} onBack={goHome} onPostsChanged={loadCounts} />;
  }
  if (view === 'likedPosts') {
    return <LikedPostsView user={user} onBack={goHome} />;
  }

  const currentLang = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

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

      {/* Activity + Language cards */}
      <div className="mt-3.5 flex gap-2">
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
        <StatCard
          value={currentLang.short}
          label={t('my.language')}
          onClick={() => setLangOpen(true)}
          valueClassName="text-xl"
        />
      </div>

      <button
        type="button"
        onClick={logout}
        className="mt-6 w-full rounded-2xl border border-coral/70 bg-coral/10 py-3 text-sm font-bold text-coral shadow-[0_2px_6px_rgba(248,72,31,0.10)] active:opacity-75"
      >
        {t('my.logout')}
      </button>

      <div className="mb-8 mt-10 ">
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine1')}</p>
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine2')}</p>
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine3')}</p>
        <p className="mt-2 text-xs leading-relaxed text-stone-400">{t('my.footerContact')}</p>
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerAddress')}</p>
        <p className="mt-3 text-[0.65rem] text-stone-300">{t('my.footerCopy')}</p>
      </div>

      {editingProfile && (
        <EditProfileSheet
          currentName={user.name}
          onSave={handleSaveProfile}
          onClose={() => setEditingProfile(false)}
        />
      )}

      <Modal open={langOpen} onClose={() => setLangOpen(false)} variant="center">
        <LanguageModal onClose={() => setLangOpen(false)} />
      </Modal>
    </PageShell>
  );
}
