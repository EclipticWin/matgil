import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { formatRelativeOrAbsolute } from '../../../shared/utils/formatTime.js';
import {
  fetchMyPosts,
  softDeletePosts,
  normalizeCommunityImageUrls,
} from '../../community/services/communityService.js';

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M2 5l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompactPostCard({ post, selected, onToggle }) {
  const images = normalizeCommunityImageUrls(post.image_urls);
  const thumb = images[0] ?? null;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-soft transition-all ${
        selected ? 'ring-2 ring-coral' : ''
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="mt-0.5 shrink-0"
        aria-label="select"
      >
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
            selected ? 'border-coral bg-coral' : 'border-stone-300'
          }`}
        >
          {selected && <CheckMark />}
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-ink">{post.content}</p>
        <div className="mt-1.5 flex items-center gap-2.5 text-xs text-ink-faint">
          <span>{formatRelativeOrAbsolute(post.created_at)}</span>
          <span>♥ {post.like_count ?? 0}</span>
          <span>· {post.comment_count ?? 0}</span>
        </div>
      </div>

      {thumb && (
        <img
          src={thumb}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
          draggable={false}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

export default function MyPostsView({ user, onBack, onPostsChanged }) {
  const { t } = useLocale();
  const [posts, setPosts] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    fetchMyPosts(user.id)
      .then(setPosts)
      .catch(() => { setPosts([]); setError(t('my.failedToLoadPosts')); });
  }, [user.id, t]);

  useEffect(() => { load(); }, [load]);

  const allSelected = posts?.length > 0 && selected.size === posts.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await softDeletePosts([...selected], user.id);
      setSelected(new Set());
      setConfirming(false);
      load();
      onPostsChanged?.();
    } catch {
      setError(t('my.failedToDeletePosts'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 pb-6 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-soft active:bg-ink/10"
          aria-label={t('my.back')}
        >
          <BackIcon />
        </button>
        <h2 className="flex-1 font-display text-lg font-bold text-ink">{t('my.myPosts')}</h2>
        {posts?.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold text-ink-soft"
          >
            {allSelected ? t('my.deselectAll') : t('my.selectAll')}
          </button>
        )}
      </div>

      {/* Delete bar */}
      {selected.size > 0 && !confirming && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-coral/10 px-4 py-2.5">
          <span className="text-sm font-semibold text-coral">
            {selected.size} {t('my.selected')}
          </span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full bg-coral px-3.5 py-1.5 text-xs font-bold text-white"
          >
            {t('my.deleteSelected')}
          </button>
        </div>
      )}

      {/* Confirm banner */}
      {confirming && (
        <div className="mb-3 rounded-2xl bg-red-50 px-4 py-3">
          <p className="mb-2.5 text-sm font-semibold text-red-700">{t('my.confirmDeletePosts')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-full border border-ink/10 py-1.5 text-xs font-semibold text-ink-soft"
            >
              {t('my.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 rounded-full bg-red-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? '…' : t('my.deleteSelected')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>
      )}

      {/* List */}
      {posts === null ? (
        <p className="py-10 text-center text-sm text-ink-faint">…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">{t('my.noPosts')}</p>
      ) : (
        <div className="space-y-2.5">
          {posts.map((p) => (
            <CompactPostCard
              key={p.id}
              post={p}
              selected={selected.has(p.id)}
              onToggle={() => toggleOne(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
