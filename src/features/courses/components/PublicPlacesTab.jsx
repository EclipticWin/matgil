import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useAuthPrompt } from '../../auth/hooks/useAuthPrompt.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { buildReturnTo } from '../../../shared/utils/authRedirect.js';
import { getPlacesByIds } from '../../../api/placeApi.js';
import { calcDistanceKm, DEFAULT_LOCATION } from '../../explore/data/locations.js';
import { fetchPlaceReviewStatsBatch } from '../../places/services/placeReviewService.js';
import { fetchPublicPlaceFeed } from '../services/publicFeedService.js';
import PublicPlaceCard from './PublicPlaceCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import PublicDataAttribution from '../../../shared/components/PublicDataAttribution.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { FlameIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { MAX_PUBLIC_FEED_ITEMS, PUBLIC_FEED_PAGE_SIZE } from '../constants/publicFeed.js';

/** Explore tab's "places" list — public, no login required to view.
 *  One feed RPC + one getPlacesByIds() batch + one review-stats batch per
 *  page (no per-place queries — see docs/56-adjacent locale-consistency work
 *  this mirrors for SavedRoutesTab).
 *
 *  Infinite scroll (5 rows/page, see PUBLIC_FEED_PAGE_SIZE): a sentinel div
 *  below the list is watched by an IntersectionObserver that calls the same
 *  handleLoadMore() a "load more" button used to call — no separate fetch
 *  path. `active` (passed by ExplorePage, which keeps both tabs mounted and
 *  only CSS-toggles which one shows) gates the observer so the hidden tab
 *  never fires background page requests. */
export default function PublicPlacesTab({ sort, active = true }) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const location = useLocation();
  const navigate = useNavigate();

  const [places, setPlaces] = useState([]); // merged: place + saveCount/latestSavedAt/isSaved/distanceKm
  const [statsById, setStatsById] = useState(new Map());
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  // Rebuilds the merged `places` array from a feed page in RPC order (the feed
  // itself IS the sort — never re-sort after merging place/review data in).
  const mergeFeedRows = useCallback(async (rows) => {
    const placeIds = rows.map((row) => row.place_id).filter((id) => Number.isFinite(id));
    if (placeIds.length === 0) return [];
    const [resolvedPlaces, stats] = await Promise.all([
      getPlacesByIds(placeIds, locale),
      fetchPlaceReviewStatsBatch(placeIds),
    ]);
    setStatsById(stats);
    const placeById = new Map(resolvedPlaces.map((p) => [p.id, p]));
    return rows
      .map((row) => {
        const place = placeById.get(row.place_id);
        if (!place) return null;
        return {
          ...place,
          saveCount: row.save_count ?? 0,
          latestSavedAt: row.latest_saved_at ?? null,
          isSaved: !!row.is_saved,
          distanceKm: place.latitude != null && place.longitude != null
            ? calcDistanceKm(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, place.latitude, place.longitude)
            : null,
        };
      })
      .filter(Boolean);
  }, [locale]);

  // Guards a stale in-flight load-more response (requested under one `sort`)
  // from overwriting the freshly-reset places/offset of a `sort` the user has
  // since switched to — read at the point the response resolves, not at
  // request time, so it always reflects the LATEST sort.
  const sortRef = useRef(sort);
  sortRef.current = sort;

  // Synchronous concurrency guard for handleLoadMore, separate from the
  // `loadingMore` state (which only drives the spinner) — a rapid back-to-back
  // IntersectionObserver callback fires as a plain browser callback, not
  // synchronized with React's commit, so it could otherwise read a stale
  // `loadingMore` closure before React has committed the state update.
  const fetchingRef = useRef(false);
  // Callback-ref-as-state (not a plain useRef) so the observer effect below
  // can react directly to the sentinel actually mounting/unmounting, rather
  // than inferring it from `loading`/`hasMore` transitions — see the matching
  // comment in PublicRoutesTab.jsx for the real bug this pattern fixes there
  // (an extra early-return branch that could produce the sentinel-bearing JSX
  // on a render the observer effect's old dependency array didn't fire on).
  // This tab doesn't have that extra branch today, but using the same robust
  // pattern here keeps both tabs' observer lifecycle identical and immune to
  // the same class of bug if an early-return branch is ever added later.
  const [sentinelNode, setSentinelNode] = useState(null);
  const handleLoadMoreRef = useRef(() => {});
  const hasMoreRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchPublicPlaceFeed({ sort, limit: PUBLIC_FEED_PAGE_SIZE, offset: 0 })
      .then(async (rows) => {
        if (cancelled) return;
        const merged = await mergeFeedRows(rows);
        if (cancelled) return;
        setPlaces(merged);
        setOffset(rows.length);
        setTotalCount(rows[0]?.total_count ?? 0);
        setLoadMoreError(false);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, user?.id, mergeFeedRows, reloadTick]);

  async function handleLoadMore() {
    if (!user) {
      openAuthPrompt({ messageKey: 'publicFeed.loginToLoadMorePlaces', returnTo: buildReturnTo(location) });
      return;
    }
    if (fetchingRef.current) return;
    // Never request past the 150-item cap — the last page before it may need
    // fewer than a full PUBLIC_FEED_PAGE_SIZE rows (see MAX_PUBLIC_FEED_ITEMS).
    const remaining = MAX_PUBLIC_FEED_ITEMS - places.length;
    if (remaining <= 0) return;
    const requestedSort = sort;
    fetchingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const rows = await fetchPublicPlaceFeed({ sort, limit: Math.min(PUBLIC_FEED_PAGE_SIZE, remaining), offset });
      const merged = await mergeFeedRows(rows);
      // sort changed while this page was in flight — a fresh offset-0 fetch
      // for the new sort has already replaced places/offset, so this stale
      // page must not be appended on top of it.
      if (sortRef.current !== requestedSort) return;
      setPlaces((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...merged.filter((p) => !seen.has(p.id))].slice(0, MAX_PUBLIC_FEED_ITEMS);
      });
      setOffset((prev) => prev + rows.length);
      if (rows[0]?.total_count != null) setTotalCount(rows[0].total_count);
    } catch {
      if (sortRef.current === requestedSort) setLoadMoreError(true);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }
  handleLoadMoreRef.current = handleLoadMore;

  const effectiveTotal = Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS);
  const hasMore = places.length < effectiveTotal;
  hasMoreRef.current = hasMore;

  // Re-attaches exactly when the sentinel node mounts/unmounts or `active`
  // toggles — NOT when loadingMore/places/offset change, since tearing the
  // observer down and recreating it on every page load would fire its
  // "already intersecting" initial callback again immediately and could
  // cascade through pages without the user scrolling further. Live values
  // the callback needs (hasMore/user/in-flight) are read from refs instead.
  //
  // `root: null` (the browser viewport) is correct here even though the real
  // scroll container is AppLayout's `<main overflow-y-auto>`, not the window —
  // nested scrollable ancestors are still accounted for when computing
  // intersection against the viewport, and AppLayout's `<main>` is sized to
  // fill the whole app-frame viewport.
  useEffect(() => {
    if (!active || !sentinelNode) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!hasMoreRef.current || !userRef.current || fetchingRef.current) return;
        handleLoadMoreRef.current();
      },
      { root: null, rootMargin: '160px 0px', threshold: 0 },
    );
    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [active, sentinelNode]);

  // Opens the full-screen PlaceDetailPage (`/places/:placeId`) instead of the
  // old Map-tab detour (navigate(ROUTES.home, {state:{savedCourse: <fake
  // single-stop course>}}), which relied on lastPlaceView.js's one-shot store
  // to also auto-open PlaceDetailSheet inside NearbySheet — no longer needed
  // here since we're not routing through the Map tab at all anymore).
  // `place` is already the current-locale-merged object from mergeFeedRows()
  // (a real getPlacesByIds() result plus saveCount/isSaved/distanceKm), so
  // it's passed as `state.place` for PlaceDetailPage's existing "instant
  // first paint from router state, always re-verified by its own
  // getPlaceById() fetch" logic — unchanged, see PlaceDetailPage.jsx.
  // `returnTo` lets PlaceDetailPage's back button return here with the
  // Places tab (not Routes) and this `sort` restored — see its handleBack().
  function handleViewDetail(place) {
    navigate(ROUTES.placeDetail(place.id), {
      state: {
        place,
        fromPublicFeed: true,
        returnTo: { pathname: ROUTES.explore, tab: 'places', sort },
      },
    });
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
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-ink-faint">{t('publicFeed.loadError')}</p>
        <button
          type="button"
          onClick={() => setReloadTick((n) => n + 1)}
          className="rounded-full bg-ink/8 px-4 py-1.5 text-xs font-bold text-ink-soft"
        >
          {t('savedPlaces.retry')}
        </button>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={<FlameIcon size={24} />}
        title={t('publicFeed.emptyPlaces')}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {places.map((place, index) => (
          <PublicPlaceCard
            key={place.id}
            place={place}
            rank={sort === 'popular' ? index + 1 : null}
            reviewStats={statsById.get(place.id)}
            onOpen={handleViewDetail}
          />
        ))}

        {hasMore && (
          <div ref={setSentinelNode} className="mt-1 flex justify-center py-1">
            {loadingMore && <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" />}
          </div>
        )}
        {loadMoreError && (
          <p className="text-center text-xs text-red-500">{t('publicFeed.loadError')}</p>
        )}
      </div>

      {/* 이미지 출처 링크 footer — 이전에는 이 위 flex-col의 gap-3(12px)+링크 자신의
          mt-1/mb-4로 상하 여백을 "계산"했지만, 그 계산은 이 div 자체의 경계까지만
          따진 것이었다. 실제 화면에 보이는 하단 경계는 이 div 다음에 오는
          ExplorePage(PageShell)의 pb-6(24px)까지 포함해야 하는데, 그 값이 빠져
          있어 아래쪽이 훨씬 넓어 보였다(24px+mb-4(16px)=40px vs 위쪽 16px).
          그래서 링크를 목록의 gap-3 컨테이너 밖으로 꺼내 별도 footer로 만들고,
          위쪽은 pt-4(16px)로 직접 지정하고, 아래쪽은 PageShell의 pb-6(24px)까지
          합쳐 정확히 16px이 되도록 -mb-2(-8px)로 보정했다(24-8=16). PageShell.jsx
          자체는 건드리지 않았고, 이 보정은 Places 탭 이 사용처에만 적용되며
          PublicDataAttribution 공용 컴포넌트나 다른 화면에는 영향이 없다. */}
      <div className="pt-4 -mb-2">
        <PublicDataAttribution />
      </div>
    </>
  );
}
