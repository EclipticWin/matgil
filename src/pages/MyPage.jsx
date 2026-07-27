import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { fetchMyActivityCounts } from '../features/community/services/communityService.js';
import { fetchMySavedCounts } from '../features/courses/services/publicFeedService.js';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocaleInfoNotice from '../features/explore/components/LocaleInfoNotice.jsx';
import JapaneseComingSoonModal from '../features/explore/components/JapaneseComingSoonModal.jsx';
import Modal from '../features/explore/components/Modal.jsx';
import { LANGUAGES } from '../features/explore/data/exploreOptions.js';
import { useLocaleNotice } from '../features/explore/hooks/useLocaleNotice.js';
import EditProfileSheet from '../features/profile/components/EditProfileSheet.jsx';
import LikedPostsView from '../features/profile/components/LikedPostsView.jsx';
import MyPostsView from '../features/profile/components/MyPostsView.jsx';
import Card from '../shared/components/Card.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import { ChevronRightIcon } from '../shared/components/Icon.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useEscapeToClose } from '../shared/hooks/useEscapeToClose.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../shared/utils/avatarColor.js';

// Carrot-market "나의 당근"-style section: a title label over a set of
// one-line rows sharing one big card, instead of MyPage's old scattered
// small StatCard squares. Purely presentational — every row's onClick still
// goes through whatever existing navigate()/setView() call the caller
// already used with StatCard, so no destination/data-fetch logic changes.
function MySection({ title, children }) {
  return (
    <Card rounded="rounded-2xl" className="mt-3.5 overflow-hidden">
      <p className="px-4 pb-1 pt-4 text-[0.9rem] font-bold uppercase text-ink-soft">
        {title}
      </p>
      {/* Title→first-row gap = title's own pb-1 (4px) + this pt + the first
          row's own py-2 top (8px). Was 22px (pt-2.5, 10px); pt-[0.42rem]
          (~6.7px) brings the total to ~18.7px, ~85% of that 22px, without
          touching the row-to-row gap (each row's own py-2, unaffected) or the
          trailing space below the last row (pb-1.5 below, unaffected). */}
      <div className="pb-1.5 pt-[0.42rem]">{children}</div>
    </Card>
  );
}

// `value` is optional and rendered only when passed (the language row is the
// only caller that still shows one — every count-based row below omits it
// entirely so no count number reaches the screen, even though the counts are
// still fetched/held in state upstream). Same light gray as the title
// (text-ink-soft) — this used to be the count number's own color, now reused
// for both the section title and every row label so nothing in this card
// reads as heavier/darker than that.
function MyRow({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors active:bg-ink/[0.03]"
    >
      <span className="text-[0.95rem] font-medium text-ink-soft">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ink-soft">
        {value != null && value}
        <ChevronRightIcon size={13} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </span>
    </button>
  );
}

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
  // Fixed front-end notice for the 日本語 "coming soon" entry — no DB, no locale
  // switch; see JapaneseComingSoonModal.
  const [jaComingSoonOpen, setJaComingSoonOpen] = useState(false);

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
      <Card rounded="rounded-2xl" className="flex items-center gap-3.5 p-4">
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

      {/* 나의 여행 — saved routes/places, moved here from the now-public
          Explore tab (see ExplorePage.jsx); each row goes to its own route
          (SavedRoutesPage/SavedPlacesPage) rather than an in-page view. */}
      <MySection title={t('my.travelSection')}>
        <MyRow
          label={t('savedCourses.title')}
          onClick={() => navigate(ROUTES.mySavedRoutes)}
        />
        <MyRow
          label={t('savedPlaces.title')}
          onClick={() => navigate(ROUTES.mySavedPlaces)}
        />
      </MySection>

      {/* 나의 표현 — saved phrases, its own route (SavedPhrasesPage) like the
          travel section above rather than an in-page view. */}
      <MySection title={t('my.phrasesSection')}>
        <MyRow
          label={t('savedPhrases.title')}
          onClick={() => navigate(ROUTES.mySavedPhrases)}
        />
      </MySection>

      {/* 나의 커뮤니티 활동 */}
      <MySection title={t('my.communitySection')}>
        <MyRow
          label={t('my.myPosts')}
          onClick={() => setView('myPosts')}
        />
        <MyRow
          label={t('my.likedPosts')}
          onClick={() => setView('likedPosts')}
        />
      </MySection>

      {/* 설정 */}
      <MySection title={t('my.settingsSection')}>
        <MyRow
          label={t('my.language')}
          value={currentLang.short}
          onClick={() => setLangOpen(true)}
        />
      </MySection>

      {/* Low-emphasis: logout is a routine, reversible action (unlike account
          deletion), so it deliberately does not use the coral accent color —
          a quiet neutral button rather than a call to action. */}
      <button
        type="button"
        onClick={logout}
        className="mt-3.5 w-full rounded-2xl border-[1.5px] border-ink/12 bg-white py-3 text-sm font-bold text-ink-soft active:bg-ink/[0.03]"
      >
        {t('my.logout')}
      </button>

      <div className="mb-8 mt-10 ">
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine1')}</p>
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine2')}</p>
        <p className="text-xs leading-relaxed text-stone-400">{t('my.footerLine3')}</p>
        <p className="mt-2 break-all text-xs leading-relaxed text-stone-400">{t('my.footerContact')}</p>
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
        <LanguageModal
          onClose={() => setLangOpen(false)}
          onLanguageSelected={handleLanguageSelected}
          onComingSoonSelect={() => setJaComingSoonOpen(true)}
        />
      </Modal>

      <Modal open={!!localeNotice} onClose={closeLocaleNotice} variant="center" dismissOnBackdrop={localeNotice?.dismissOnBackdrop ?? false}>
        {localeNotice && <LocaleInfoNotice title={localeNotice.title} message={localeNotice.message} onClose={closeLocaleNotice} />}
      </Modal>

      {/* 日本語 coming-soon notice — opens on top of the still-open language
          modal above (never closes it), fixed copy, no locale change. */}
      <JapaneseComingSoonModal open={jaComingSoonOpen} onClose={() => setJaComingSoonOpen(false)} />
    </PageShell>
  );
}
