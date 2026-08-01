import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
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
import { usePullToRefresh } from '../features/community/hooks/usePullToRefresh.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import PostComposer from '../features/community/components/PostComposer.jsx';
import CommentBottomSheet from '../features/community/components/CommentBottomSheet.jsx';
import PullToRefreshIndicator from '../features/community/components/PullToRefreshIndicator.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { buildReturnTo } from '../shared/utils/authRedirect.js';

const PAGE_SIZE = 5;

// Target gap, both above AND below the floating write button, and the
// button's own fixed height (h-12) — see AppLayout.jsx for
// --matgil-bottom-nav-h, the live-measured nav height WRITE_BUTTON_BOTTOM
// builds on instead of a guessed px constant (font metrics/line-height for
// the nav's own labels differ enough across Samsung Internet/Chrome
// Android/iOS Safari that a hard-coded value read as visibly uneven
// top-vs-bottom spacing around the button). The fallback (3.5rem) only
// matters for the very first paint, before AppLayout's ResizeObserver has
// measured once.
//
// FEED_CONTENT_PB deliberately does NOT include the nav height — AppLayout's
// <main> (the feed's own scroll container) already ends exactly where the
// nav begins (they're separate flex siblings, main never extends behind
// it), so "scrolled all the way down" already lands the content's bottom
// edge flush with main's own bottom edge with zero nav height involved.
// Adding navHeight to this padding on top of that (an earlier version of
// this file did) double-counted it, inflating the gap under the last card
// far past the button-to-nav gap instead of matching it. The two gaps are
// equal by construction here: card-to-button gap = PB - GAP - BUTTON_HEIGHT
// = 2*GAP + BUTTON_HEIGHT - GAP - BUTTON_HEIGHT = GAP; button-to-nav gap =
// (navHeight + GAP) - navHeight = GAP. Same GAP either way, independent of
// navHeight and independent of whether the CSS variable has measured yet.
//
// Neither value adds env(safe-area-inset-bottom): BottomNavigation itself
// doesn't reserve any (confirmed by reading it — no safe-area handling
// there, out of scope to add here since it'd affect every tab, not just
// Community), and the button already sits comfortably above it once GAP is
// added to the nav's own measured height, so adding safe-area again on top
// would just reintroduce an asymmetric gap.
const WRITE_BUTTON_GAP_REM = 0.75;
const WRITE_BUTTON_HEIGHT_REM = 3;
const NAV_HEIGHT_FALLBACK_REM = 3.5;
const WRITE_BUTTON_BOTTOM = `calc(var(--matgil-bottom-nav-h, ${NAV_HEIGHT_FALLBACK_REM}rem) + ${WRITE_BUTTON_GAP_REM}rem)`;
const FEED_CONTENT_PB = `calc(${WRITE_BUTTON_GAP_REM * 2}rem + ${WRITE_BUTTON_HEIGHT_REM}rem)`;

export default function CommunityPage() {
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const location = useLocation();
  const { locale, t } = useLocale();
  // The real scroll container (AppLayout's shared <main>) — see
  // AppLayout.jsx's doc comment. Only pull-to-refresh needs direct DOM
  // access to it; every other page on this route tree ignores this context
  // entirely.
  const { scrollContainerRef } = useOutletContext() ?? {};

  const [filter, setFilter] = useState('all');
  // null = current filter's first page hasn't resolved yet (sourcePosts falls
  // back to the mock COMMUNITY_POSTS placeholder, same as before pagination
  // existed); [] = first page resolved with zero real rows (also mock
  // fallback — a real, empty result and a failed fetch are both handled this
  // way, matching the original loadPosts()'s silent catch-to-[] behavior).
  const [dbPosts, setDbPosts] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [placesById, setPlacesById] = useState(new Map());
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [composing, setComposing] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [commentPost, setCommentPost] = useState(null); // post object for CommentBottomSheet
  const placesRequestSeqRef = useRef(0);
  const placesByIdRef = useRef(new Map());
  const placesLocaleRef = useRef(locale);

  const isPopular = filter === 'popular';
  // 'all'/'popular' are feed-wide views (no server-side category filter);
  // every other tab key is a real mg_community_posts.category value (see
  // communityConstants.js's WRITE_CATEGORIES, the same source PostComposer's
  // own category picker uses).
  const category = filter === 'all' || filter === 'popular' ? null : filter;

  // Guards both the initial page-1 fetch and every load-more page against a
  // stale response from a filter the user has since switched away from.
  // Bumped once per filter change (loadFirstPage) — handleLoadMore only
  // reads it, so consecutive pages of the SAME filter share one generation,
  // but switching tabs mid-request immediately invalidates whatever was
  // in flight for the old one. Same "ignore a response that's no longer
  // current" idiom placesRequestSeqRef already uses for place lookups below.
  const postsRequestSeqRef = useRef(0);
  // Synchronous concurrency guard, separate from `loadingMore` (which only
  // drives the spinner) — a rapid IntersectionObserver callback fires as a
  // plain browser callback, not synchronized with React's commit, so it
  // could otherwise read a stale `loadingMore` closure before React commits.
  const fetchingRef = useRef(false);
  // Mirrors the pull-to-refresh hook's own 'refreshing' phase (set right
  // below, once the hook is wired up) — checked by the load-more observer
  // so a refresh in flight can never overlap with a load-more request, and
  // vice versa (see usePullToRefresh's own `disabled`, which includes
  // `loadingMore`).
  const refreshingRef = useRef(false);
  const hasMoreRef = useRef(true);
  hasMoreRef.current = hasMore;
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  // Callback-ref-as-state (not a plain useRef) so the observer effect below
  // reacts exactly when the sentinel mounts/unmounts — same pattern (and the
  // bug it fixes) documented in PublicRoutesTab.jsx/PublicPlacesTab.jsx.
  const [sentinelNode, setSentinelNode] = useState(null);
  const handleLoadMoreRef = useRef(() => {});
  // The scrollTop that counts as "the current filter's feed is at its own
  // top" — usePullToRefresh only ever compares main.scrollTop against this
  // value (see its own doc comment for why a plain scrollTop comparison
  // replaced an earlier, buggier getBoundingClientRect()-based check).
  // Reset to 0 every time loadFirstPage() runs, in lockstep with actually
  // scrolling the container back to 0 there — so this is always a value
  // main.scrollTop can realistically reach again by scrolling up.
  const feedTopScrollRef = useRef(0);

  // Fetches this filter's first PAGE_SIZE posts, replacing whatever was
  // loaded before — used on mount, on every filter change, and after
  // create/edit/delete (all three can change which posts belong in the
  // current view, so resetting to page 1 is the simplest correct response).
  // Deliberately NOT used after a like or a new comment — see handleLike/
  // handleCommentAdded, which patch the already-loaded pages in place
  // instead, so a heart tap doesn't collapse a deep infinite-scroll position
  // back to page 1.
  const loadFirstPage = useCallback(() => {
    const mySeq = (postsRequestSeqRef.current += 1);
    let cancelled = false;
    // Scroll back to the top synchronously (not animated) so switching
    // filters/creating-editing-deleting a post always lands on a screen
    // where the new first page is actually visible — and so the
    // feedTopScrollRef baseline below is a scrollTop pull-to-refresh can
    // realistically return to, not a leftover position from whatever the
    // previous filter's list looked like.
    if (scrollContainerRef?.current) scrollContainerRef.current.scrollTop = 0;
    feedTopScrollRef.current = 0;
    setDbPosts(null);
    setOffset(0);
    setHasMore(true);
    setLoadMoreError(false);
    fetchPosts({ popular: isPopular, category, limit: PAGE_SIZE, offset: 0 })
      .then((rows) => {
        if (cancelled || postsRequestSeqRef.current !== mySeq) return;
        setDbPosts(rows);
        setOffset(rows.length);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => {
        if (cancelled || postsRequestSeqRef.current !== mySeq) return;
        setDbPosts([]);
        setHasMore(false);
      });
    return () => { cancelled = true; };
  }, [isPopular, category]);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  const handleLoadMore = useCallback(async () => {
    if (fetchingRef.current || refreshingRef.current || !hasMoreRef.current) return;
    const mySeq = postsRequestSeqRef.current;
    fetchingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const rows = await fetchPosts({ popular: isPopular, category, limit: PAGE_SIZE, offset: offsetRef.current });
      if (postsRequestSeqRef.current !== mySeq) return;
      setDbPosts((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...rows.filter((r) => !seen.has(r.id))];
      });
      setOffset((prev) => prev + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (postsRequestSeqRef.current === mySeq) setLoadMoreError(true);
    } finally {
      fetchingRef.current = false;
      if (postsRequestSeqRef.current === mySeq) setLoadingMore(false);
    }
  }, [isPopular, category]);
  handleLoadMoreRef.current = handleLoadMore;

  // Pull-to-refresh's own re-fetch — deliberately NOT loadFirstPage(),
  // which nulls dbPosts synchronously and would flash the mock
  // COMMUNITY_POSTS placeholder over the real list for a moment. The
  // existing list stays on screen for the entire request; only a
  // successful response replaces it, and a failed one leaves it untouched.
  const refreshFirstPage = useCallback(async () => {
    if (fetchingRef.current || refreshingRef.current) return;
    const mySeq = postsRequestSeqRef.current;
    refreshingRef.current = true;
    try {
      const rows = await fetchPosts({ popular: isPopular, category, limit: PAGE_SIZE, offset: 0 });
      if (postsRequestSeqRef.current !== mySeq) return; // filter changed mid-refresh
      setDbPosts(rows);
      setOffset(rows.length);
      setHasMore(rows.length === PAGE_SIZE);
      setLoadMoreError(false);
    } catch {
      // Keep the existing list exactly as it was.
    } finally {
      refreshingRef.current = false;
    }
  }, [isPopular, category]);

  // Blocks a pull from arming (and cancels one already in progress — see
  // usePullToRefresh's own `disabled` effect) whenever any modal/sheet is
  // open or a load-more is already in flight; `resetOn: filter` cancels a
  // live gesture the instant the user switches tabs mid-drag.
  const { pullDistance, phase: pullPhase } = usePullToRefresh({
    scrollContainerRef,
    feedTopScrollRef,
    onRefresh: refreshFirstPage,
    disabled: composing || !!editingPost || !!commentPost || loadingMore,
    resetOn: filter,
  });
  refreshingRef.current = pullPhase === 'refreshing';

  // Re-attaches exactly when the sentinel node mounts/unmounts — NOT when
  // loadingMore/dbPosts/offset change, for the same reason PublicPlacesTab's
  // observer effect avoids those deps (see its own comment). `root: null`
  // is correct even though the real scroll container is AppLayout's
  // `<main overflow-y-auto>`, not the window — nested scrollable ancestors
  // are still accounted for when computing intersection against the
  // viewport.
  useEffect(() => {
    if (!sentinelNode) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMoreRef.current || fetchingRef.current || refreshingRef.current) return;
        handleLoadMoreRef.current();
      },
      { root: null, rootMargin: '160px 0px', threshold: 0 },
    );
    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode]);

  // Batch-fetch every post's linked place in ONE call, but only for place
  // ids not already cached — dbPosts now grows via infinite-scroll append
  // (not a full replace each time), so re-requesting every previously-seen
  // id on every page load would get progressively more wasteful the deeper
  // someone scrolls. A locale switch still fully discards the cache (a name
  // cached under 'ko' would be wrong once shown in 'en'), same as
  // PublicRoutesTab.jsx's localizedPlacesById handling, which this mirrors.
  // A stale response (locale/list changed again before this resolves) is
  // discarded via placesRequestSeqRef so it can never clobber a newer
  // result. A failed fetch leaves the cache alone — the posts themselves
  // stay visible, only their place area doesn't render for the new ids.
  useEffect(() => {
    if (!dbPosts) return;
    const localeChanged = placesLocaleRef.current !== locale;
    placesLocaleRef.current = locale;
    if (localeChanged) {
      placesByIdRef.current = new Map();
      setPlacesById(new Map());
    }
    const missingIds = [...new Set(
      dbPosts.map((p) => p.place_id).filter((id) => id != null && !placesByIdRef.current.has(id)),
    )];
    if (missingIds.length === 0) return;
    const mySeq = (placesRequestSeqRef.current += 1);
    getPlacesByIds(missingIds, locale)
      .then((places) => {
        if (placesRequestSeqRef.current !== mySeq) return;
        setPlacesById((prev) => {
          const next = new Map(prev);
          places.forEach((place) => next.set(place.id, place));
          placesByIdRef.current = next;
          return next;
        });
      })
      .catch(() => {
        // Leave whatever's already cached alone.
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

  useEffect(() => { loadLikedIds(); }, [loadLikedIds]);

  const sourcePosts = useMemo(
    () =>
      dbPosts && dbPosts.length > 0
        ? dbPosts.map((p, i) => normalizeDbPost(p, i, placesById))
        : COMMUNITY_POSTS,
    [dbPosts, placesById],
  );
  const posts = filterPosts(sourcePosts, filter);
  // Only the real, paginated feed ever shows the infinite-scroll sentinel —
  // never the mock placeholder (dbPosts still null on first mount, or
  // resolved to a genuinely empty page), which has no next page to fetch.
  const showSentinel = dbPosts !== null && hasMore;
  // Only after at least one real DB post has actually loaded for the
  // current filter — never over the mock COMMUNITY_POSTS placeholder
  // (dbPosts still null, or resolved empty), and never while a load-more
  // is in flight or has just failed.
  const showReachedEnd = dbPosts !== null && dbPosts.length > 0 && !hasMore && !loadingMore && !loadMoreError;

  // — compose —
  const handlePostButtonClick = () => {
    if (!user) { openAuthPrompt({ messageKey: 'community.joinPrompt', returnTo: buildReturnTo(location) }); return; }
    setComposing(true);
  };

  const handleSubmit = async ({ category: postCategory, content, imageUrls = [], placeId = null }) => {
    await createPost({ userId: user.id, category: postCategory, locale, content, authorName: user.name, imageUrls, placeId });
    setComposing(false);
    loadFirstPage();
  };

  // — edit —
  const handleEdit = (post) => setEditingPost(post);

  const handleEditSubmit = async ({ category: postCategory, content, imageUrls, placeId }) => {
    await updatePost(editingPost.id, { category: postCategory, content, imageUrls, placeId });
    setEditingPost(null);
    loadFirstPage();
  };

  // — delete (soft) —
  const handleDelete = async (post) => {
    if (!window.confirm(t('community.confirmDelete'))) return;
    try {
      await deletePost(post.id, user.id);
      loadFirstPage();
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
    // Optimistic like_count patch on the already-loaded page(s) — NOT
    // loadFirstPage(), which would reset pagination back to page 1 and
    // throw away the user's infinite-scroll position just to reflect one
    // heart tap. Reverted on failure below, the same optimistic-then-revert
    // shape PublicRoutesTab.jsx's handleToggleHeart already uses for saves.
    const delta = alreadyLiked ? -1 : 1;
    setDbPosts((prev) => (prev ?? []).map((p) => (
      String(p.id) === post.id ? { ...p, like_count: Math.max(0, (p.like_count ?? 0) + delta) } : p
    )));
    try {
      if (alreadyLiked) {
        await unlikePost(post.id, user.id);
      } else {
        await likePost(post.id, user.id);
      }
    } catch {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        alreadyLiked ? next.add(post.id) : next.delete(post.id);
        return next;
      });
      setDbPosts((prev) => (prev ?? []).map((p) => (
        String(p.id) === post.id ? { ...p, like_count: Math.max(0, (p.like_count ?? 0) - delta) } : p
      )));
    }
  };

  // — comments —
  const handleToggleComments = (post) => {
    setCommentPost((prev) => (prev?.id === post.id ? null : post));
  };

  // Increments the open post's comment_count in place — same reasoning as
  // handleLike's optimistic patch: a loadFirstPage() reload here would
  // collapse the list back to page 1 while the comment sheet is still open.
  const handleCommentAdded = () => {
    if (!commentPost) return;
    setDbPosts((prev) => (prev ?? []).map((p) => (
      String(p.id) === commentPost.id ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p
    )));
  };

  return (
    <>
      {/* Fixed header — PageHeader scrolls normally; the tabs bar is sticky
          (stays pinned once the title has scrolled past) so it reads as the
          fixed reference area the feed below gets pulled away from. Neither
          element is ever part of the pull-to-refresh transform. */}
      <div className="pt-6">
        <div className="px-5">
          <PageHeader
            title={t('community.title')}
            subtitle={t('community.subtitle')}
            subtitleClassName="[text-wrap:pretty]"
          />
        </div>

        {/* data-no-pull-refresh: a touch starting anywhere in the tabs bar
            (including its own horizontal category scroller) never arms a
            pull — usePullToRefresh's interactive-element check matches this
            attribute the same way it matches button/a/etc. */}
        <div className="sticky top-0 z-10 bg-paper" data-no-pull-refresh>
          <CommunityTabs value={filter} onChange={setFilter} />
        </div>
      </div>

      {/* Pull-to-refresh anchor — this div itself never moves; the
          indicator sits fixed near its top (just below the sticky tabs),
          and only the feed wrapper just below it gets translated, so the
          indicator appears to be "revealed" above the feed as it's pulled
          down. Only this feed wrapper (cards, sentinel, load-more error,
          reached-end divider) is ever part of the transform — PageHeader
          and CommunityTabs above are outside it entirely. */}
      <div className="relative">
        <PullToRefreshIndicator pullDistance={pullDistance} phase={pullPhase} />
        <div
          className={`matgil-ptr-content px-5 pt-3.5 ${
            pullPhase === 'pulling' || pullPhase === 'ready' ? 'matgil-ptr-content--dragging' : ''
          }`}
          style={{
            paddingBottom: FEED_CONTENT_PB,
            ...(pullDistance > 0 ? { transform: `translateY(${pullDistance}px)` } : null),
          }}
        >
          <div className="flex flex-col gap-3.5">
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

            {/* Infinite-scroll sentinel — once hasMore is false, this whole
                block simply stops rendering (observer disconnects via its
                own cleanup) and showReachedEnd's quiet divider takes over
                instead of a footer card or "end of list" marker. */}
            {showSentinel && (
              <div ref={setSentinelNode} className="flex justify-center py-2">
                {loadingMore && <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" />}
              </div>
            )}
            {loadMoreError && (
              <p className="text-center text-xs text-red-500">{t('community.loadMoreError')}</p>
            )}
            {showReachedEnd && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-ink/10" />
                <span className="shrink-0 text-xs font-semibold text-ink-faint">{t('community.reachedEnd')}</span>
                <div className="h-px flex-1 bg-ink/10" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* floating compose button — color/icon/text/size/radius/shadow all
          unchanged; only `bottom` (see WRITE_BUTTON_BOTTOM above) is
          structural now, derived from the live-measured nav height. */}
      <button
        type="button"
        onClick={handlePostButtonClick}
        style={{ bottom: WRITE_BUTTON_BOTTOM }}
        className="absolute right-5 z-30 inline-flex h-12 items-center gap-1.5 rounded-3xl bg-coral px-5 text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.16)]"
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
          onCommentAdded={handleCommentAdded}
          onLoginClick={() => { setCommentPost(null); openAuthPrompt({ messageKey: 'community.joinPrompt', returnTo: buildReturnTo(location) }); }}
        />
      )}
    </>
  );
}
