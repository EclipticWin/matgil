import { useState, useEffect } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { formatRelativeOrAbsolute } from '../../../shared/utils/formatTime.js';
import { avatarGradient } from '../../../shared/utils/avatarColor.js';
import { fetchMyLikedPosts, normalizeCommunityImageUrls } from '../../community/services/communityService.js';

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function LikedPostCard({ post }) {
  const images = normalizeCommunityImageUrls(post.image_urls);
  const thumb = images[0] ?? null;
  const gradient = avatarGradient(String(post.user_id || post.author_name || ''));
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-sm font-bold text-white`}
      >
        {(post.author_name || 'T').charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] font-semibold text-ink-soft">{post.author_name}</p>
        <p className="mt-0.5 line-clamp-2 text-[0.875rem] leading-relaxed text-ink">{post.content}</p>
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

export default function LikedPostsView({ user, onBack }) {
  const { t } = useLocale();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyLikedPosts(user.id)
      .then(setPosts)
      .catch(() => { setPosts([]); setError(t('my.failedToLoadPosts')); });
  }, [user.id, t]);

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
        <h2 className="flex-1 font-display text-lg font-bold text-ink">{t('my.likedPosts')}</h2>
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>
      )}

      {posts === null ? (
        <p className="py-10 text-center text-sm text-ink-faint">…</p>
      ) : posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">{t('my.noLikedPosts')}</p>
      ) : (
        <div className="space-y-2.5">
          {posts.map((p) => (
            <LikedPostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
