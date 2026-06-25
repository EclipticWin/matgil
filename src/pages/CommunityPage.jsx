import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { COMMUNITY_POSTS, filterPosts } from '../features/community/data/communityPosts.js';
import {
  fetchPosts,
  createPost,
  updatePost,
  deletePost,
  fetchLikedPostIds,
  likePost,
  unlikePost,
  normalizeDbPost,
} from '../features/community/services/communityService.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import PostComposer from '../features/community/components/PostComposer.jsx';
import CommentBottomSheet from '../features/community/components/CommentBottomSheet.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

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
  const [commentPost, setCommentPost] = useState(null); // post object for CommentBottomSheet

  const isPopular = filter === 'popular';

  const loadPosts = useCallback(async () => {
    try {
      let rows = await fetchPosts({ locale, popular: isPopular });
      if (rows.length === 0) {
        rows = await fetchPosts({ popular: isPopular });
      }
      setDbPosts(rows);
    } catch {
      setDbPosts([]);
    }
  }, [locale, isPopular]);

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
      : COMMUNITY_POSTS;
  const posts = filterPosts(sourcePosts, filter);

  // — compose —
  const handlePostButtonClick = () => {
    if (!user) { setLoginPrompt(true); return; }
    setComposing(true);
  };

  const handleSubmit = async ({ category, content, imageUrls = [] }) => {
    await createPost({ userId: user.id, category, locale, content, authorName: user.name, imageUrls });
    setComposing(false);
    loadPosts();
  };

  // — edit —
  const handleEdit = (post) => setEditingPost(post);

  const handleEditSubmit = async ({ category, content, imageUrls }) => {
    await updatePost(editingPost.id, { category, content, imageUrls });
    setEditingPost(null);
    loadPosts();
  };

  // — delete (soft) —
  const handleDelete = async (post) => {
    if (!window.confirm(t('community.confirmDelete'))) return;
    try {
      await deletePost(post.id, user.id);
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

  // — comments —
  const handleToggleComments = (post) => {
    setCommentPost((prev) => (prev?.id === post.id ? null : post));
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

        <div className="flex flex-col gap-3.5 px-5 pt-3.5">
          {posts.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-ink-faint">
              {t('community.noMatches')}
            </div>
          ) : (
            posts.map((post, i) => (
              <PostCard
                key={post.id}
                post={post}
                index={i}
                user={user}
                likedByMe={likedPostIds.has(post.id)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onLike={handleLike}
                onToggleComments={handleToggleComments}
              />
            ))
          )}
        </div>
      </div>

      {/* floating compose button */}
      <button
        type="button"
        onClick={handlePostButtonClick}
        className="absolute bottom-[5.5rem] right-5 z-30 inline-flex h-12 items-center gap-1.5 rounded-3xl bg-coral px-5 text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.16)]"
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
        <PostComposer
          onSubmit={handleSubmit}
          onClose={() => setComposing(false)}
          userId={user?.id}
        />
      )}

      {/* edit post composer */}
      {editingPost && (
        <PostComposer
          isEditing
          initialContent={editingPost.text}
          initialCategory={editingPost.kind}
          initialImageUrls={editingPost.imageUrls}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingPost(null)}
          userId={user?.id}
        />
      )}

      {/* comment bottom sheet */}
      {commentPost && (
        <CommentBottomSheet
          post={commentPost}
          user={user}
          onClose={() => setCommentPost(null)}
          onCommentAdded={loadPosts}
          onLoginClick={() => { setCommentPost(null); setLoginPrompt(true); }}
        />
      )}
    </>
  );
}
