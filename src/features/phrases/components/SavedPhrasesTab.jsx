import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import Card from '../../../shared/components/Card.jsx';
import { ChatIcon } from '../../../shared/components/Icon.jsx';
import PhraseCategoryTabs from './PhraseCategoryTabs.jsx';
import PhraseCard from './PhraseCard.jsx';
import { fetchPhraseCategories, fetchPhrasesByIds, normalizePhrase } from '../services/phraseService.js';
import { fetchMyPhraseBookmarksDetailed, removePhraseBookmark } from '../services/phraseBookmarkService.js';

const ALL_CATEGORY = { id: 'all', label: 'All', labelKo: '전체', labelZh: '全部' };

/** MyPage's "저장한 표현" destination — reuses PhraseCard/PhraseCategoryTabs (the exact
 *  components the Phrases tab itself renders) rather than a second copy, so bookmark
 *  toggling, TTS playback, and current-locale text all come from the same code path.
 *  Phrase ids are locale-independent (one mg_phrases row carries ko_text/en_text/zh_text
 *  together), so a phrase saved while browsing in one language still shows up correctly
 *  — and stays bookmarked — after switching locale. */
export default function SavedPhrasesTab() {
  const { t, locale } = useLocale();
  const { user } = useAuth();

  const [phrases, setPhrases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Two queries total regardless of how many phrases are bookmarked: the bookmark
  // rows (for the id list + save order) and one batched fetchPhrasesByIds() — no
  // per-phrase request. fetchPhrasesByIds() doesn't preserve input order, so `ids`
  // (already most-recently-bookmarked first) is used to re-sort the result.
  const load = useCallback(() => {
    if (!user) { setPhrases([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const [bookmarks, categoryRows] = await Promise.all([
          fetchMyPhraseBookmarksDetailed(user.id),
          fetchPhraseCategories().catch(() => []),
        ]);
        const ids = bookmarks.map((b) => b.phrase_id);
        const rows = ids.length > 0 ? await fetchPhrasesByIds(ids) : [];
        const rowById = new Map(rows.map((row) => [row.id, row]));
        const ordered = ids.map((id) => rowById.get(id)).filter(Boolean);
        setPhrases(ordered.map((row) => normalizePhrase(row, locale, ids)));
        setCategories(categoryRows);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    setActiveCategory('all'); // avoid landing on a category that no longer has any saved phrases after a reload
  }, [load]);

  // Unlike the Phrases tab (toggle on/off), this list only ever un-saves — a phrase
  // that loses its bookmark here has no reason to stay in a "saved phrases" list, so
  // it's removed immediately rather than re-fetched.
  async function handleUnbookmark(phraseId) {
    if (!user) return;
    const snapshot = phrases;
    setPhrases((prev) => prev.filter((p) => p.id !== phraseId));
    try {
      await removePhraseBookmark({ phraseId, userId: user.id });
    } catch {
      setPhrases(snapshot); // restore on failure — same optimistic-then-rollback pattern PhrasesPage uses
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="mt-12 text-center text-sm text-ink-faint">{t('phrases.loadError')}</p>
    );
  }

  if (phrases.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={<ChatIcon size={26} />}
        title={t('savedPhrases.empty')}
        description={t('savedPhrases.emptyHint')}
      />
    );
  }

  // Only categories that actually have a saved phrase — an empty pill for a category
  // with nothing saved would just be a dead end for this particular list.
  const availableCategoryIds = new Set(phrases.map((p) => p.category));
  const filterCategories = [ALL_CATEGORY, ...categories.filter((c) => availableCategoryIds.has(c.id))];

  const visiblePhrases = activeCategory === 'all'
    ? phrases
    : phrases.filter((p) => p.category === activeCategory);

  return (
    <div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <PhraseCategoryTabs categories={filterCategories} value={activeCategory} onChange={setActiveCategory} />
      </div>

      {visiblePhrases.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink-faint">{t('savedPhrases.emptyCategory')}</p>
      ) : (
        <Card className="mt-4 px-4 py-1">
          {visiblePhrases.map((phrase, i) => (
            <div key={phrase.id} className={i > 0 ? 'border-t border-ink/5' : ''}>
              <PhraseCard phrase={phrase} onBookmark={handleUnbookmark} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
