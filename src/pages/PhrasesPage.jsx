import { useState, useEffect, useCallback } from 'react';
import { PHRASE_CATEGORIES } from '../features/phrases/data/phrases.js';
import PhraseCategoryTabs from '../features/phrases/components/PhraseCategoryTabs.jsx';
import PhraseCard from '../features/phrases/components/PhraseCard.jsx';
import VoiceHelpPlaceholder from '../features/phrases/components/VoiceHelpPlaceholder.jsx';
import Card from '../shared/components/Card.jsx';
import { SpeakerIcon } from '../shared/components/Icon.jsx';
import { isTTSSupported } from '../features/phrases/services/ttsService.js';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import UnderlineTabs from '../shared/components/UnderlineTabs.jsx';
import { cn } from '../shared/utils/classNames.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import {
  fetchPhraseCategories,
  fetchPhrasesByCategory,
  fetchPopularPhrases,
  normalizePhrase,
} from '../features/phrases/services/phraseService.js';
import {
  fetchMyPhraseBookmarks,
  addPhraseBookmark,
  removePhraseBookmark,
} from '../features/phrases/services/phraseBookmarkService.js';

export default function PhrasesPage() {
  const { t, locale } = useLocale();
  const { user } = useAuth();

  const [activeTab, setActiveTab]   = useState('common');
  const [phraseMode, setPhraseMode] = useState('all');

  // 일반 표현 모드 상태
  const [categories, setCategories] = useState(PHRASE_CATEGORIES);
  const [category, setCategory]     = useState('waiting');
  const [phrases, setPhrases]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // 인기 표현 모드 상태
  const [popularCategory, setPopularCategory] = useState('all');
  const [popularPhrases, setPopularPhrases]   = useState([]);
  const [popularLoading, setPopularLoading]   = useState(false);
  const [popularFailed, setPopularFailed]     = useState(false);

  const [loginBanner, setLoginBanner] = useState(false);

  const TOP_TABS = [
    { id: 'common', label: t('phrases.common') },
    { id: 'voice',  label: t('phrases.voice') },
  ];

  const PHRASE_MODE_TABS = [
    { id: 'all',     label: t('phrases.allPhrases') },
    { id: 'popular', label: t('phrases.popularPhrases') },
  ];

  // 카테고리 목록 로드 (마운트 시 1회)
  useEffect(() => {
    fetchPhraseCategories()
      .then(setCategories)
      .catch(() => { /* 정적 데이터 유지 */ });
  }, []);

  // 카테고리 또는 로그인 상태 변경 시 일반 표현 + 북마크 재로드
  useEffect(() => {
    if (activeTab !== 'common') return;
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    (async () => {
      try {
        const [rows, bookmarkedIds] = await Promise.all([
          fetchPhrasesByCategory(category),
          user ? fetchMyPhraseBookmarks(user.id) : Promise.resolve([]),
        ]);
        if (!cancelled) setPhrases(rows.map((row) => normalizePhrase(row, locale, bookmarkedIds)));
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [category, user, activeTab, locale]);

  // 인기 표현 로드 (popular 모드 진입, 카테고리 전환, 로그인 상태 변경 시)
  useEffect(() => {
    if (activeTab !== 'common' || phraseMode !== 'popular') return;
    let cancelled = false;
    setPopularLoading(true);
    setPopularFailed(false);

    (async () => {
      try {
        const [rows, bookmarkedIds] = await Promise.all([
          fetchPopularPhrases({ category: popularCategory }),
          user ? fetchMyPhraseBookmarks(user.id) : Promise.resolve([]),
        ]);
        if (!cancelled) setPopularPhrases(rows.map((row) => normalizePhrase(row, locale, bookmarkedIds)));
      } catch {
        if (!cancelled) setPopularFailed(true);
      } finally {
        if (!cancelled) setPopularLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [phraseMode, user, activeTab, popularCategory, locale]);

  const handleBookmark = useCallback(async (phraseId) => {
    if (!user) {
      setLoginBanner(true);
      setTimeout(() => setLoginBanner(false), 3000);
      return;
    }

    const target = phrases.find((p) => p.id === phraseId) ?? popularPhrases.find((p) => p.id === phraseId);
    if (!target) return;
    const wasBookmarked = target.isBookmarked;

    // Optimistic update: 두 목록 모두 isBookmarked 반영
    const toggle = (list) =>
      list.map((p) => p.id === phraseId ? { ...p, isBookmarked: !wasBookmarked } : p);
    setPhrases(toggle);
    setPopularPhrases(toggle);

    try {
      if (wasBookmarked) {
        await removePhraseBookmark({ phraseId, userId: user.id });
      } else {
        await addPhraseBookmark({ phraseId, userId: user.id });
      }
      // 인기 표현 모드: bookmark_count 변경으로 순위가 달라질 수 있으므로 재조회
      if (phraseMode === 'popular') {
        const [rows, bIds] = await Promise.all([
          fetchPopularPhrases({ category: popularCategory }),
          fetchMyPhraseBookmarks(user.id),
        ]);
        setPopularPhrases(rows.map((row) => normalizePhrase(row, locale, bIds)));
      }
    } catch {
      // 롤백
      const rollback = (list) =>
        list.map((p) => p.id === phraseId ? { ...p, isBookmarked: wasBookmarked } : p);
      setPhrases(rollback);
      setPopularPhrases(rollback);
    }
  }, [user, phrases, popularPhrases, phraseMode, popularCategory, locale]);

  return (
    <PageShell>
      <PageHeader
        title={t('phrases.title')}
        subtitle={t('phrases.subtitle')}
        subtitleClassName="[text-wrap:pretty]"
      />

      {/* 1차 탭: Common phrases / Voice help — text 중심 스위처(당근마켓 스타일),
          Courses 페이지와 공유하는 UnderlineTabs 컴포넌트 사용 */}
      <UnderlineTabs tabs={TOP_TABS} value={activeTab} onChange={setActiveTab} className="mt-5" />

      {activeTab === 'common' && (
        <>
          {/* 2차 탭: All phrases / Popular */}
          <div className="mt-5 flex rounded-xl bg-ink/5 p-1">
            {PHRASE_MODE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPhraseMode(tab.id)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
                  phraseMode === tab.id
                    ? 'bg-white text-ink shadow-soft'
                    : 'text-ink-soft',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loginBanner && (
            <div className="mt-3 rounded-xl bg-coral-tint px-4 py-2.5 text-sm font-semibold text-coral-deep">
              {t('phrases.loginToBookmark')}
            </div>
          )}

          {/* 일반 표현 모드 */}
          {phraseMode === 'all' && (
            <>
              <div className="mt-5 min-w-0 max-w-full overflow-hidden">
                <PhraseCategoryTabs
                  categories={categories}
                  value={category}
                  onChange={setCategory}
                />
              </div>

              {isTTSSupported() && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-coral-tint px-3 py-1.5 text-[0.8rem] font-semibold text-coral-deep">
                  <SpeakerIcon size={15} className="text-coral" /> {t('phrases.tapToHear')}
                </div>
              )}

              {loadFailed ? (
                <p className="mt-6 text-center text-sm text-ink-faint">
                  {t('phrases.loadError')}
                </p>
              ) : loading ? (
                <p className="mt-6 text-center text-sm text-ink-faint">…</p>
              ) : (
                <Card className="mt-4 px-4 py-1">
                  {phrases.map((phrase, i) => (
                    <div key={phrase.id} className={i > 0 ? 'border-t border-ink/5' : ''}>
                      <PhraseCard phrase={phrase} onBookmark={handleBookmark} />
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          {/* 인기 표현 모드 */}
          {phraseMode === 'popular' && (
            <>
              <div className="mt-5 min-w-0 max-w-full overflow-hidden">
                <PhraseCategoryTabs
                  categories={[
                    { id: 'all', label: 'All', labelKo: '전체', labelZh: '全部' },
                    ...categories,
                  ]}
                  value={popularCategory}
                  onChange={setPopularCategory}
                />
              </div>

              {isTTSSupported() && (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-coral-tint px-3 py-1.5 text-[0.8rem] font-semibold text-coral-deep">
                  <SpeakerIcon size={15} className="text-coral" /> {t('phrases.tapToHear')}
                </div>
              )}

              {popularFailed ? (
                <p className="mt-6 text-center text-sm text-ink-faint">
                  {t('phrases.loadError')}
                </p>
              ) : popularLoading ? (
                <p className="mt-6 text-center text-sm text-ink-faint">…</p>
              ) : popularPhrases.length === 0 ? (
                <p className="mt-6 text-center text-sm text-ink-faint">
                  {popularCategory === 'all'
                    ? t('phrases.noPopularPhrases')
                    : t('phrases.noPopularPhrasesInCategory')}
                </p>
              ) : (
                <Card className="mt-4 px-4 py-1">
                  {popularPhrases.map((phrase, i) => (
                    <div key={phrase.id} className={i > 0 ? 'border-t border-ink/5' : ''}>
                      <PhraseCard phrase={phrase} onBookmark={handleBookmark} />
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'voice' && <VoiceHelpPlaceholder />}
    </PageShell>
  );
}
