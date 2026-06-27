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
import { cn } from '../shared/utils/classNames.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import {
  fetchPhraseCategories,
  fetchPhrasesByCategory,
  normalizePhrase,
} from '../features/phrases/services/phraseService.js';
import {
  fetchMyPhraseBookmarks,
  addPhraseBookmark,
  removePhraseBookmark,
} from '../features/phrases/services/phraseBookmarkService.js';

export default function PhrasesPage() {
  const { t } = useLocale();
  const { user } = useAuth();

  const [activeTab, setActiveTab]   = useState('common');
  const [categories, setCategories] = useState(PHRASE_CATEGORIES);
  const [category, setCategory]     = useState('waiting');
  const [phrases, setPhrases]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loginBanner, setLoginBanner] = useState(false);

  const TOP_TABS = [
    { id: 'common', label: t('phrases.common') },
    { id: 'voice',  label: t('phrases.voice') },
  ];

  // 카테고리 목록 로드 (마운트 시 1회)
  useEffect(() => {
    fetchPhraseCategories()
      .then(setCategories)
      .catch(() => { /* 정적 데이터 유지 */ });
  }, []);

  // 카테고리 또는 로그인 상태 변경 시 표현 + 북마크 재로드
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
        if (!cancelled) setPhrases(rows.map((row) => normalizePhrase(row, bookmarkedIds)));
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [category, user, activeTab]);

  const handleBookmark = useCallback(async (phraseId) => {
    if (!user) {
      setLoginBanner(true);
      setTimeout(() => setLoginBanner(false), 3000);
      return;
    }

    const target = phrases.find((p) => p.id === phraseId);
    if (!target) return;
    const wasBookmarked = target.isBookmarked;

    // Optimistic update
    setPhrases((prev) =>
      prev.map((p) =>
        p.id !== phraseId
          ? p
          : {
              ...p,
              isBookmarked: !wasBookmarked,
              bookmarkCount: wasBookmarked ? p.bookmarkCount - 1 : p.bookmarkCount + 1,
            },
      ),
    );

    try {
      if (wasBookmarked) {
        await removePhraseBookmark({ phraseId, userId: user.id });
      } else {
        await addPhraseBookmark({ phraseId, userId: user.id });
      }
    } catch {
      // 롤백
      setPhrases((prev) =>
        prev.map((p) =>
          p.id !== phraseId
            ? p
            : {
                ...p,
                isBookmarked: wasBookmarked,
                bookmarkCount: wasBookmarked ? p.bookmarkCount + 1 : p.bookmarkCount - 1,
              },
        ),
      );
    }
  }, [user, phrases]);

  return (
    <PageShell>
      <PageHeader title={t('phrases.title')} />

      {/* Top-level tab switcher */}
      <div className="mt-3 flex rounded-xl bg-ink/5 p-1">
        {TOP_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-bold transition-colors',
              activeTab === tab.id
                ? 'bg-white text-ink shadow-soft'
                : 'text-ink-soft',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'common' && (
        <>
          {isTTSSupported() && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-coral-tint px-3 py-1.5 text-[0.8rem] font-semibold text-coral-deep">
              <SpeakerIcon size={15} className="text-coral" /> {t('phrases.tapToHear')}
            </div>
          )}

          {loginBanner && (
            <div className="mt-3 rounded-xl bg-coral-tint px-4 py-2.5 text-sm font-semibold text-coral-deep">
              {t('phrases.loginToBookmark')}
            </div>
          )}

          <div className="mt-4 min-w-0 max-w-full overflow-hidden">
            <PhraseCategoryTabs
              categories={categories}
              value={category}
              onChange={setCategory}
            />
          </div>

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

      {activeTab === 'voice' && <VoiceHelpPlaceholder />}
    </PageShell>
  );
}
