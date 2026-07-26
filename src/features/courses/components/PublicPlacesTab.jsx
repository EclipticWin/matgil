import { useCallback, useEffect, useState } from 'react';
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
import Spinner from '../../../shared/components/Spinner.jsx';
import { FlameIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { MAX_PUBLIC_FEED_ITEMS } from '../constants/publicFeed.js';

const LOGGED_IN_PAGE_SIZE = 10;
const GUEST_LIMIT = 5;

/** Explore tab's "places" list — public, no login required to view.
 *  One feed RPC + one getPlacesByIds() batch + one review-stats batch per
 *  page (no per-place queries — see docs/56-adjacent locale-consistency work
 *  this mirrors for SavedRoutesTab). */
export default function PublicPlacesTab({ sort }) {
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const limit = user ? LOGGED_IN_PAGE_SIZE : GUEST_LIMIT;
    fetchPublicPlaceFeed({ sort, limit, offset: 0 })
      .then(async (rows) => {
        if (cancelled) return;
        const merged = await mergeFeedRows(rows);
        if (cancelled) return;
        setPlaces(merged);
        setOffset(rows.length);
        setTotalCount(rows[0]?.total_count ?? 0);
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
    if (loadingMore) return;
    // Never request past the 150-item cap — the last page before it may need
    // fewer than a full LOGGED_IN_PAGE_SIZE rows (see MAX_PUBLIC_FEED_ITEMS).
    const remaining = MAX_PUBLIC_FEED_ITEMS - places.length;
    if (remaining <= 0) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const rows = await fetchPublicPlaceFeed({ sort, limit: Math.min(LOGGED_IN_PAGE_SIZE, remaining), offset });
      const merged = await mergeFeedRows(rows);
      setPlaces((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...merged.filter((p) => !seen.has(p.id))].slice(0, MAX_PUBLIC_FEED_ITEMS);
      });
      setOffset((prev) => prev + rows.length);
      if (rows[0]?.total_count != null) setTotalCount(rows[0].total_count);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

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

  const effectiveTotal = Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS);
  const hasMore = places.length < effectiveTotal;

  return (
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
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mt-1 flex h-11 items-center justify-center gap-2 rounded-2xl bg-ink/5 text-sm font-bold text-ink-soft disabled:opacity-60"
        >
          {loadingMore ? <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" /> : t('publicFeed.loadMore')}
        </button>
      )}
      {loadMoreError && (
        <p className="text-center text-xs text-red-500">{t('publicFeed.loadError')}</p>
      )}
    </div>
  );
}
