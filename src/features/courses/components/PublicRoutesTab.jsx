import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useAuthPrompt } from '../../auth/hooks/useAuthPrompt.jsx';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { buildReturnTo } from '../../../shared/utils/authRedirect.js';
import { getPlacesByIds } from '../../../api/placeApi.js';
import {
  getSavedCourseDisplayTitle,
  getPublicCourseAnchorDisplay,
  mergeSavedStopWithLocalizedPlace,
} from '../utils/courseDisplay.js';
import { fetchPublicCourseFeed, togglePublicCourseSave } from '../services/publicFeedService.js';
import PublicCourseCard from './PublicCourseCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { RouteIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { MAX_PUBLIC_FEED_ITEMS } from '../constants/publicFeed.js';

const LOGGED_IN_PAGE_SIZE = 10;
const GUEST_LIMIT = 5;

/** Explore tab's "routes" list — public, no login required to view.
 *  Renders PublicCourseCard (not CourseCard — this screen's info layout
 *  differs enough, e.g. no distance/time, an anchor-address line, an optional
 *  rank band, that it gets its own dedicated card component; see
 *  PublicCourseCard's own doc comment). Also computes each row's popular-sort
 *  rank and current-locale anchor-address line for that card. */
export default function PublicRoutesTab({ sort }) {
  const { t, locale } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const location = useLocation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [reloadTick, setReloadTick] = useState(0);

  // Current-locale place data for every stop across every row currently on
  // screen — ONE batched query for the whole page (same pattern SavedRoutesTab
  // uses), not per-row/per-stop. Public feed rows carry whichever saver's
  // locale snapshot happened to be picked as representative, so this is what
  // keeps a Korean screen from showing an English/Chinese saver's raw text.
  const allStopIds = useMemo(() => {
    const ids = rows.flatMap((row) => {
      const snapshot = row.course_snapshot ?? {};
      const stops = row.stops ?? snapshot.stops ?? [];
      return stops.map((stop) => Number(stop.id)).filter(Number.isFinite);
    });
    return [...new Set(ids)].sort((a, b) => a - b);
  }, [rows]);
  const allStopIdsKey = allStopIds.join(',');

  const [localizedPlacesById, setLocalizedPlacesById] = useState(new Map());
  const [localizedPlacesLoading, setLocalizedPlacesLoading] = useState(false);

  useEffect(() => {
    if (!allStopIdsKey) {
      setLocalizedPlacesById(new Map());
      setLocalizedPlacesLoading(false);
      return;
    }
    let cancelled = false;
    setLocalizedPlacesLoading(true);
    setLocalizedPlacesById(new Map());
    getPlacesByIds(allStopIdsKey.split(',').map(Number), locale)
      .then((places) => {
        if (cancelled) return;
        setLocalizedPlacesById(new Map(places.map((p) => [p.id, p])));
      })
      .catch(() => { if (!cancelled) setLocalizedPlacesById(new Map()); })
      .finally(() => { if (!cancelled) setLocalizedPlacesLoading(false); });
    return () => { cancelled = true; };
  }, [allStopIdsKey, locale]);

  const dedupeRows = useCallback((list) => {
    const seen = new Set();
    return list.filter((row) => {
      if (seen.has(row.public_route_key)) return false;
      seen.add(row.public_route_key);
      return true;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const limit = user ? LOGGED_IN_PAGE_SIZE : GUEST_LIMIT;
    fetchPublicCourseFeed({ sort, limit, offset: 0 })
      .then((data) => {
        if (cancelled) return;
        setRows(dedupeRows(data));
        setOffset(data.length);
        setTotalCount(data[0]?.total_count ?? 0);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, user?.id, reloadTick, dedupeRows]);

  async function handleLoadMore() {
    if (!user) {
      openAuthPrompt({ messageKey: 'publicFeed.loginToLoadMoreRoutes', returnTo: buildReturnTo(location) });
      return;
    }
    if (loadingMore) return;
    // Never request past the 150-item cap — the last page before it may need
    // fewer than a full LOGGED_IN_PAGE_SIZE rows (see MAX_PUBLIC_FEED_ITEMS).
    const remaining = MAX_PUBLIC_FEED_ITEMS - rows.length;
    if (remaining <= 0) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const data = await fetchPublicCourseFeed({ sort, limit: Math.min(LOGGED_IN_PAGE_SIZE, remaining), offset });
      setRows((prev) => dedupeRows([...prev, ...data]).slice(0, MAX_PUBLIC_FEED_ITEMS));
      setOffset((prev) => prev + data.length);
      if (data[0]?.total_count != null) setTotalCount(data[0].total_count);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleToggleHeart(row) {
    if (busyKeys.has(row.public_route_key)) return;
    if (!user) {
      openAuthPrompt({ messageKey: 'publicFeed.loginToSaveRoute', returnTo: buildReturnTo(location) });
      return;
    }
    const prevSaved = row.is_saved;
    const prevCount = row.save_count ?? 0;
    const nextSaved = !prevSaved;
    const nextCount = Math.max(0, prevCount + (nextSaved ? 1 : -1));

    setBusyKeys((prev) => new Set(prev).add(row.public_route_key));
    setRows((prev) => prev.map((r) => (r.public_route_key === row.public_route_key
      ? { ...r, is_saved: nextSaved, save_count: nextCount }
      : r)));

    try {
      const result = await togglePublicCourseSave({ publicRouteKey: row.public_route_key });
      setRows((prev) => prev.map((r) => (r.public_route_key === row.public_route_key
        ? {
          ...r,
          is_saved: result?.is_saved ?? nextSaved,
          save_count: Math.max(0, result?.save_count ?? nextCount),
          my_saved_course_id: result?.my_saved_course_id ?? r.my_saved_course_id,
        }
        : r)));
    } catch {
      setRows((prev) => prev.map((r) => (r.public_route_key === row.public_route_key
        ? { ...r, is_saved: prevSaved, save_count: prevCount }
        : r)));
    } finally {
      setBusyKeys((prev) => { const next = new Set(prev); next.delete(row.public_route_key); return next; });
    }
  }

  // Same router-state channel SavedCourseDetailPage's "View on map" and
  // SavedPlacesTab's card-open already use — NearbySheet re-localizes via
  // localizeSnapshotForDisplay() on arrival, so passing the already-merged
  // (current-locale) stops here just makes that first paint accurate instead
  // of relying solely on that re-localization pass.
  function handleViewOnMap(row, localizedStops) {
    const snapshot = row.course_snapshot ?? {};
    navigate(ROUTES.home, {
      state: {
        savedCourse: {
          ...snapshot,
          stops: localizedStops,
          anchor_label: snapshot.anchor_label ?? '',
        },
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

  if (rows.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={<RouteIcon size={26} />}
        title={t('publicFeed.emptyRoutes')}
      />
    );
  }

  // Only while the current-locale batch is actually in flight — same
  // flicker-prevention as SavedRoutesTab, not a full-list loading gate.
  if (localizedPlacesLoading && allStopIdsKey) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  const effectiveTotal = Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS);
  const hasMore = rows.length < effectiveTotal;

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row, index) => {
        const snapshot = row.course_snapshot ?? {};
        const rawStops = row.stops ?? snapshot.stops ?? [];
        const localizedStops = rawStops.map((stop) =>
          mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(Number(stop.id))),
        );
        const adaptedCourse = {
          id: row.public_route_key,
          title: getSavedCourseDisplayTitle(row, locale, { getCategoryLabel, t, localizedStops }),
          stops: localizedStops,
          totalDistanceM: snapshot.normalizedMetrics?.totalDistanceM ?? null,
          totalDurationMin: snapshot.normalizedMetrics?.totalDurationMin ?? null,
          accent: snapshot.accent ?? '#F8481F',
          km: snapshot.km,
          hr: snapshot.hr,
        };

        // rows is the concatenation of every fetched page in strictly
        // increasing offset order (see handleLoadMore) with only exact-
        // duplicate keys removed, so array index === global popular-rank
        // position. Only meaningful for 'popular' — 'latest' never shows a
        // rank band regardless of position.
        const rank = sort === 'popular' ? index + 1 : null;
        const anchorLabel = getPublicCourseAnchorDisplay(row, locale, { t });

        return (
          <PublicCourseCard
            key={row.public_route_key}
            course={adaptedCourse}
            rank={rank}
            anchorLabel={anchorLabel}
            saveCount={row.save_count ?? 0}
            isSaved={!!row.is_saved}
            busy={busyKeys.has(row.public_route_key)}
            onToggleHeart={() => handleToggleHeart(row)}
            onViewDetail={() => handleViewOnMap(row, localizedStops)}
          />
        );
      })}

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
