import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { fetchMyActivityCounts } from '../features/community/services/communityService.js';
import { fetchMySavedCounts } from '../features/courses/services/publicFeedService.js';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocaleInfoNotice from '../features/explore/components/LocaleInfoNotice.jsx';
import Modal from '../features/explore/components/Modal.jsx';
import { LANGUAGES } from '../features/explore/data/exploreOptions.js';
import { useLocaleNotice } from '../features/explore/hooks/useLocaleNotice.js';
import EditProfileSheet from '../features/profile/components/EditProfileSheet.jsx';
import LikedPostsView from '../features/profile/components/LikedPostsView.jsx';
import MyPostsView from '../features/profile/components/MyPostsView.jsx';
import StatCard from '../features/profile/components/StatCard.jsx';
import Card from '../shared/components/Card.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useEscapeToClose } from '../shared/hooks/useEscapeToClose.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../shared/utils/avatarColor.js';

export default function MyPage() {
  const { user, logout, loading, updateDisplayName, updatePassword } = useAuth();
  const { locale, t } = useLocale();
  const navigate = useNavigate();

  const [view, setView] = useState('home'); // 'home' | 'myPosts' | 'likedPosts'
  const [counts, setCounts] = useState(null);
  const [savedCounts, setSavedCounts] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [toast, setToast] = useState('');

  // DB-driven notice (mg_locale_notices) shown only right after the user
  // explicitly picks a locale in LanguageModal (see handleLanguageSelected) —
  // never from an effect watching `locale`, so a saved locale restored on
  // load never triggers a query or the modal on its own.
  const { notice: localeNotice, handleLanguageSelected: loadLocaleNotice, closeNotice: closeLocaleNotice } = useLocaleNotice();

  useEscapeToClose(!!localeNotice, closeLocaleNotice);

  async function handleLanguageSelected(code) {
    setLangOpen(false);
    await loadLocaleNotice(code);
  }

  const loadCounts = useCallback(() => {
    if (!user) return;
    fetchMyActivityCounts(user.id)
      .then(setCounts)
      .catch(() => setCounts({ myPosts: 0, likedPosts: 0, likedComments: 0 }));
  }, [user]);

  // Independent of loadCounts()/fetchMyActivityCounts() above — a failure in
  // one must never zero out the other's already-loaded numbers. Re-runs on
  // every mount, which is exactly what happens when the user navigates back
  // here from /my/saved-routes or /my/saved-places (separate routes, not an
  // in-page view — see SavedRoutesPage/SavedPlacesPage), so a delete there is
  // reflected here without any extra cross-page state.
  const loadSavedCounts = useCallback(() => {
    if (!user) return;
    fetchMySavedCounts()
      .then(setSavedCounts)
      .catch(() => setSavedCounts({ savedCourseCount: 0, savedPlaceCount: 0 }));
  }, [user]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadSavedCounts(); }, [loadSavedCounts]);

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
          {(user.name || '?').charAt(0).toUpperCase()}
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

      {/* Saved lists — moved here from the now-public Courses tab (see
          CoursesPage.jsx); each card links to its own route (SavedRoutesPage/
          SavedPlacesPage) rather than an in-page view. */}
      <div className="mt-2 flex gap-2">
        <StatCard
          value={savedCounts?.savedCourseCount ?? null}
          label={t('savedCourses.title')}
          onClick={() => navigate(ROUTES.mySavedRoutes)}
        />
        <StatCard
          value={savedCounts?.savedPlaceCount ?? null}
          label={t('savedPlaces.title')}
          onClick={() => navigate(ROUTES.mySavedPlaces)}
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
        <p className="mt-2">
          <a
            href="https://www.flaticon.com/kr/free-icons/"
            title={t('my.medalAttribution')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.65rem] text-ink-faint underline underline-offset-2"
          >
            {t('my.medalAttribution')}
          </a>
        </p>
        <p className="mt-3 text-[0.65rem] text-stone-300">{t('my.footerCopy')}</p>
      </div>

      {editingProfile && (
        <EditProfileSheet
          currentName={user.name}
          onSave={handleSaveProfile}
          onClose={() => setEditingProfile(false)}
        />
      )}

      <Modal open={langOpen} onClose={() => setLangOpen(false)} variant="center" dismissOnBackdrop>
        <LanguageModal onClose={() => setLangOpen(false)} onLanguageSelected={handleLanguageSelected} />
      </Modal>

      <Modal open={!!localeNotice} onClose={closeLocaleNotice} variant="center" dismissOnBackdrop={localeNotice?.dismissOnBackdrop ?? false}>
        {localeNotice && <LocaleInfoNotice title={localeNotice.title} message={localeNotice.message} onClose={closeLocaleNotice} />}
      </Modal>
    </PageShell>
  );
}
