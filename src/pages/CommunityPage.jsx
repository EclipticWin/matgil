import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { useAuthPrompt } from '../features/auth/hooks/useAuthPrompt.jsx';
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
import { getPlacesByIds } from '../api/placeApi.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import PostComposer from '../features/community/components/PostComposer.jsx';
import CommentBottomSheet from '../features/community/components/CommentBottomSheet.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { buildReturnTo } from '../shared/utils/authRedirect.js';

export default function CommunityPage() {
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const location = useLocation();
  const { locale, t } = useLocale();

  const [filter, setFilter] = useState('all');
  const [dbPosts, setDbPosts] = useState(null);
  const [placesById, setPlacesById] = useState(new Map());
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [composing, setComposing] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [commentPost, setCommentPost] = useState(null); // post object for CommentBottomSheet
  const placesRequestSeqRef = useRef(0);

  const isPopular = filter === 'popular';

  const loadPosts = useCallback(async () => {
    try {
      const rows = await fetchPosts({ popular: isPopular });
      setDbPosts(rows);
    } catch {
      setDbPosts([]);
    }
  }, [isPopular]);

  // Batch-fetch every post's linked place in ONE call (never per-post), keyed
  // by locale so ko/en/zh-CN switches re-fetch with locale-correct name/address.
  // A stale response (locale/post list changed again before this resolves) is
  // discarded via placesRequestSeqRef so it can never clobber a newer result.
  // A failed fetch clears placesById (post.place becomes null for all posts)
  // but never touches dbPosts — the posts themselves stay visible, only their
  // place area disappears.
  useEffect(() => {
    if (!dbPosts) return;
    const placeIds = [...new Set(dbPosts.map((p) => p.place_id).filter((id) => id != null))];
    const mySeq = (placesRequestSeqRef.current += 1);
    if (placeIds.length === 0) {
      setPlacesById(new Map());
      return;
    }
    getPlacesByIds(placeIds, locale)
      .then((places) => {
        if (placesRequestSeqRef.current !== mySeq) return;
        setPlacesById(new Map(places.map((place) => [place.id, place])));
      })
      .catch(() => {
        if (placesRequestSeqRef.current !== mySeq) return;
        setPlacesById(new Map());
      });
  }, [dbPosts, locale]);

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

  const sourcePosts = useMemo(
    () =>
      dbPosts && dbPosts.length > 0
        ? dbPosts.map((p, i) => normalizeDbPost(p, i, placesById))
        : COMMUNITY_POSTS,
    [dbPosts, placesById],
  );
  const posts = filterPosts(sourcePosts, filter);

  // — compose —
  const handlePostButtonClick = () => {
    if (!user) { openAuthPrompt({ messageKey: 'community.joinPrompt', returnTo: buildReturnTo(location) }); return; }
    setComposing(true);
  };

  const handleSubmit = async ({ category, content, imageUrls = [], placeId = null }) => {
    await createPost({ userId: user.id, category, locale, content, authorName: user.name, imageUrls, placeId });
    setComposing(false);
    loadPosts();
  };

  // — edit —
  const handleEdit = (post) => setEditingPost(post);

  const handleEditSubmit = async ({ category, content, imageUrls, placeId }) => {
    await updatePost(editingPost.id, { category, content, imageUrls, placeId });
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
    if (!user) { openAuthPrompt({ messageKey: 'community.joinPrompt', returnTo: buildReturnTo(location) }); return; }
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
          initialPlaceId={editingPost.placeId}
          initialPlace={editingPost.place}
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
          onLoginClick={() => { setCommentPost(null); openAuthPrompt({ messageKey: 'community.joinPrompt', returnTo: buildReturnTo(location) }); }}
        />
      )}
    </>
  );
}
