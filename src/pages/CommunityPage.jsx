import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { COMMUNITY_POSTS, filterPosts, filterPostsByLocale } from '../features/community/data/communityPosts.js';
import {
  fetchPosts,
  createPost,
  updatePost,
  deletePost,
  fetchLikedPostIds,
  likePost,
  unlikePost,
} from '../features/community/services/communityService.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import PostComposer from '../features/community/components/PostComposer.jsx';
import PostCommentSection from '../features/community/components/PostCommentSection.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

const POST_TINTS = ['#FFE3D4', '#FFEFC9', '#E6E9F7', '#E2F1DE'];

function normalizeDbPost(p, i) {
  const diff = Date.now() - new Date(p.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  const ago =
    mins < 60
      ? `${Math.max(1, mins)}m`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h`
        : `${Math.floor(mins / 1440)}d`;
  return {
    id: String(p.id),
    userId: String(p.user_id),
    kind: p.category,
    author: p.author_name || 'Traveller',
    from: p.country || '',
    ago,
    text: p.content,
    place: null,
    likes: p.like_count ?? 0,
    comments: p.comment_count ?? 0,
    photo: false,
    tint: POST_TINTS[i % POST_TINTS.length],
  };
}

export default function CommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { locale, t } = useLocale();

  const [filter, setFilter] = useState('all');
  const [dbPosts, setDbPosts] = useState(null);
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [composing, setComposing] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [openCommentPostId, setOpenCommentPostId] = useState(null);

  const loadPosts = useCallback(async () => {
    try {
      const rows = await fetchPosts(locale);
      setDbPosts(rows);
    } catch {
      setDbPosts([]);
    }
  }, [locale]);

  const loadLikedIds = useCallback(async () => {
    if (!user) { setLikedPostIds(new Set()); return; }
    try {
      const ids = await fetchLikedPostIds(user.id);
      setLikedPostIds(ids);
    } catch {
      setLikedPostIds(new Set());
    }
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => { loadLikedIds(); }, [loadLikedIds]);

  const sourcePosts =
    dbPosts && dbPosts.length > 0
      ? dbPosts.map(normalizeDbPost)
      : filterPostsByLocale(COMMUNITY_POSTS, locale);
  const posts = filterPosts(sourcePosts, filter);

  // — compose (new post) —
  const handlePostButtonClick = () => {
    if (!user) { setLoginPrompt(true); return; }
    setComposing(true);
  };

  const handleSubmit = async ({ category, content }) => {
    await createPost({ userId: user.id, category, locale, content, authorName: user.name });
    setComposing(false);
    loadPosts();
  };

  // — edit —
  const handleEdit = (post) => setEditingPost(post);

  const handleEditSubmit = async ({ category, content }) => {
    await updatePost(editingPost.id, { category, content });
    setEditingPost(null);
    loadPosts();
  };

  // — delete —
  const handleDelete = async (post) => {
    if (!window.confirm(t('community.confirmDelete'))) return;
    try {
      await deletePost(post.id);
      loadPosts();
    } catch {
      // silent
    }
  };

  // — like —
  const handleLike = async (post) => {
    if (!user) return;
    const alreadyLiked = likedPostIds.has(post.id);
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    try {
      if (alreadyLiked) {
        await unlikePost(post.id, user.id);
      } else {
        await likePost(post.id, user.id);
      }
      await loadPosts();
    } catch {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        alreadyLiked ? next.add(post.id) : next.delete(post.id);
        return next;
      });
    }
  };

  // — comments toggle —
  const handleToggleComments = (post) => {
    setOpenCommentPostId((prev) => (prev === post.id ? null : post.id));
  };

  return (
    <>
      <div className="pb-[6.5rem] pt-6">
        <div className="px-5">
          <PageHeader
            title={t('community.title')}
            subtitle={t('community.subtitle')}
            subtitleClassName="[text-wrap:pretty]"
          />
        </div>

        <CommunityTabs value={filter} onChange={setFilter} />

        <div className="flex flex-col gap-3.5 px-0 pt-3.5">
          {posts.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-ink-faint">
              {t('community.noMatches')}
            </div>
          ) : (
            posts.map((post, i) => (
              <div key={post.id}>
                <div className="px-5">
                  <PostCard
                    post={post}
                    index={i}
                    user={user}
                    likedByMe={likedPostIds.has(post.id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    onToggleComments={handleToggleComments}
                  />
                </div>
                {openCommentPostId === post.id && (
                  <PostCommentSection
                    post={post}
                    user={user}
                    onLoginClick={() => { setLoginPrompt(true); }}
                    onCommentAdded={loadPosts}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* floating compose button */}
      <button
        type="button"
        onClick={handlePostButtonClick}
        className="absolute bottom-[5.5rem] right-5 z-30 inline-flex h-12 items-center gap-1.5 rounded-3xl bg-coral px-5 text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.22)]"
      >
        <PencilIcon /> {t('community.post')}
      </button>

      {/* login prompt sheet */}
      {loginPrompt && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30"
          onClick={() => setLoginPrompt(false)}
        >
          <div
            className="animate-rise rounded-t-3xl bg-paper px-5 pb-8 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-center font-display text-lg font-bold text-ink">
              {t('community.loginToPost')}
            </p>
            <p className="mb-5 text-center text-sm text-ink-soft">
              {t('community.joinPrompt')}
            </p>
            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-2xl border-[1.5px] border-coral py-3.5 font-bold text-coral"
                onClick={() => setLoginPrompt(false)}
              >
                {t('community.later')}
              </button>
              <button
                className="flex-1 rounded-2xl bg-coral py-3.5 font-bold text-white"
                onClick={() => { setLoginPrompt(false); navigate(ROUTES.login); }}
              >
                {t('community.login')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* new post composer */}
      {composing && (
        <PostComposer onSubmit={handleSubmit} onClose={() => setComposing(false)} />
      )}

      {/* edit post composer */}
      {editingPost && (
        <PostComposer
          isEditing
          initialContent={editingPost.text}
          initialCategory={editingPost.kind}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingPost(null)}
        />
      )}
    </>
  );
}
