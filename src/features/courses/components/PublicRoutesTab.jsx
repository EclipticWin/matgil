import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useAuthPrompt } from '../../auth/hooks/useAuthPrompt.jsx';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { buildReturnTo, navigateToLogin } from '../../../shared/utils/authRedirect.js';
import { getPlacesByIds } from '../../../api/placeApi.js';
import {
  getSavedCourseDisplayTitle,
  getPublicCourseAnchorDisplay,
  mergeSavedStopWithLocalizedPlace,
} from '../utils/courseDisplay.js';
import { fetchPublicCourseFeed, togglePublicCourseSave } from '../services/publicFeedService.js';
import PublicCourseCard from './PublicCourseCard.jsx';
import PublicRouteTeaserCard from './PublicRouteTeaserCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { RouteIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { MAX_PUBLIC_FEED_ITEMS, PUBLIC_FEED_PAGE_SIZE } from '../constants/publicFeed.js';

/** Explore tab's "routes" list — public, no login required to view.
 *  Renders PublicCourseCard (not CourseCard — this screen's info layout
 *  differs enough, e.g. no distance/time, an anchor-address line, an optional
 *  rank band, that it gets its own dedicated card component; see
 *  PublicCourseCard's own doc comment). Also computes each row's popular-sort
 *  rank and current-locale anchor-address line for that card.
 *
 *  Infinite scroll (5 rows/page, see PUBLIC_FEED_PAGE_SIZE): a sentinel div
 *  below the list is watched by an IntersectionObserver that calls the same
 *  handleLoadMore() a "load more" button used to call — no separate fetch
 *  path. `active` (passed by ExplorePage, which keeps both tabs mounted and
 *  only CSS-toggles which one shows) gates the observer so the hidden tab
 *  never fires background page requests. */
export default function PublicRoutesTab({ sort, active = true }) {
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

  // Tracks which locale the currently-cached localizedPlacesById entries
  // belong to, and mirrors the Map synchronously (state updates are async,
  // so a plain read of `localizedPlacesById` inside this effect could be
  // stale). A real locale switch must fully discard the cache (a name cached
  // under 'ko' would be wrong once shown in 'en'), but `rows` merely growing
  // (an infinite-scroll page appended, same locale) must NOT wipe
  // already-fetched entries — only the newly appended pages' stop ids need
  // fetching. Fixing this (rather than just not-showing-a-spinner below) also
  // means an appended page's own cards get their real localized text sooner,
  // without waiting on a full re-fetch of ids already resolved earlier.
  const localizedLocaleRef = useRef(locale);
  const localizedPlacesByIdRef = useRef(new Map());

  useEffect(() => {
    const localeChanged = localizedLocaleRef.current !== locale;
    localizedLocaleRef.current = locale;

    if (!allStopIdsKey) {
      localizedPlacesByIdRef.current = new Map();
      setLocalizedPlacesById(new Map());
      setLocalizedPlacesLoading(false);
      return undefined;
    }

    if (localeChanged) {
      localizedPlacesByIdRef.current = new Map();
      setLocalizedPlacesById(new Map());
    }

    const missingIds = allStopIdsKey
      .split(',')
      .map(Number)
      .filter((id) => !localizedPlacesByIdRef.current.has(id));

    if (missingIds.length === 0) {
      setLocalizedPlacesLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLocalizedPlacesLoading(true);
    getPlacesByIds(missingIds, locale)
      .then((places) => {
        if (cancelled) return;
        setLocalizedPlacesById((prev) => {
          const next = new Map(prev);
          places.forEach((p) => next.set(p.id, p));
          localizedPlacesByIdRef.current = next;
          return next;
        });
      })
      .catch(() => {
        // Leave whatever's already cached alone — a failed batch for the
        // newly appended ids just means those specific stops keep showing
        // their raw snapshot fallback (see mergeSavedStopWithLocalizedPlace)
        // instead of wiping out rows that localized fine earlier.
      })
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

  // Guards a stale in-flight load-more response (requested under one `sort`)
  // from overwriting the freshly-reset rows/offset of a `sort` the user has
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
  // Callback-ref-as-state (not a plain useRef) — the actual bug this fixes:
  // this component has a THIRD early-return branch below (`localizedPlacesLoading
  // && allStopIdsKey`) between the `loading` gate and the final JSX, so the
  // render that finally produces the sentinel div doesn't necessarily coincide
  // with a `loading` transition the effect below is watching. A plain ref
  // wouldn't tell the effect anything changed on that render, so the observer
  // was never attached on a fresh Routes visit — it only ever got a chance to
  // notice the (by-then long-since-mounted) sentinel when `active` toggled via
  // a tab switch away and back. Tracking the DOM node itself as state sidesteps
  // the whole "which early-return branch fired" question entirely: the effect
  // below re-runs exactly when the sentinel mounts or unmounts, full stop.
  const [sentinelNode, setSentinelNode] = useState(null);
  const handleLoadMoreRef = useRef(() => {});
  const hasMoreRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchPublicCourseFeed({ sort, limit: PUBLIC_FEED_PAGE_SIZE, offset: 0 })
      .then((data) => {
        if (cancelled) return;
        setRows(dedupeRows(data));
        setOffset(data.length);
        setTotalCount(data[0]?.total_count ?? 0);
        setLoadMoreError(false);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, user?.id, reloadTick, dedupeRows]);

  async function handleLoadMore() {
    if (!user) return;
    if (fetchingRef.current) return;
    // Never request past the 150-item cap — the last page before it may need
    // fewer than a full PUBLIC_FEED_PAGE_SIZE rows (see MAX_PUBLIC_FEED_ITEMS).
    const remaining = MAX_PUBLIC_FEED_ITEMS - rows.length;
    if (remaining <= 0) return;
    const requestedSort = sort;
    fetchingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const data = await fetchPublicCourseFeed({ sort, limit: Math.min(PUBLIC_FEED_PAGE_SIZE, remaining), offset });
      // sort changed while this page was in flight — a fresh offset-0 fetch
      // for the new sort has already replaced rows/offset, so this stale
      // page must not be appended on top of it.
      if (sortRef.current !== requestedSort) return;
      setRows((prev) => dedupeRows([...prev, ...data]).slice(0, MAX_PUBLIC_FEED_ITEMS));
      setOffset((prev) => prev + data.length);
      if (data[0]?.total_count != null) setTotalCount(data[0].total_count);
    } catch {
      if (sortRef.current === requestedSort) setLoadMoreError(true);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }

  // This one control skips the shared AuthRequiredModal (unlike every other
  // login-required action on this tab, e.g. handleToggleHeart above) — the
  // teaser card overlay itself already explains why signing in is needed, so
  // a second confirmation modal on top of it would be redundant. Still reuses
  // the existing login route/returnTo pipeline (navigateToLogin), just
  // without the modal step in between.
  function handleGuestCtaClick() {
    navigateToLogin(navigate, `${ROUTES.explore}?tab=routes&sort=${sort}`);
  }
  handleLoadMoreRef.current = handleLoadMore;

  const effectiveTotal = Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS);
  const hasMore = rows.length < effectiveTotal;
  hasMoreRef.current = hasMore;

  // Re-attaches exactly when the sentinel node mounts/unmounts or `active`
  // toggles — NOT when loadingMore/rows/offset change, since tearing the
  // observer down and recreating it on every page load would fire its
  // "already intersecting" initial callback again immediately and could
  // cascade through pages without the user scrolling further. Live values
  // the callback needs (hasMore/user/in-flight) are read from refs instead,
  // since this effect intentionally runs far less often than they change.
  //
  // `root: null` (the browser viewport) is correct here even though the real
  // scroll container is AppLayout's `<main overflow-y-auto>`, not the window —
  // nested scrollable ancestors are still accounted for when computing
  // intersection against the viewport (an element's rendered position already
  // reflects any ancestor's scroll offset), and AppLayout's `<main>` is sized
  // to fill the whole app-frame viewport. The actual bug traced here was the
  // stale `sentinelRef` above, not the observer's root.
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

  // Opens the public course's own full-screen detail page (PublicCourseDetailPage)
  // instead of jumping straight to the Map tab — that "View on map" behavior now
  // lives on the detail page's own View map button (see PublicCourseDetailPage's
  // handleViewOnMap, which uses the exact same ROUTES.home/{state:{savedCourse}}
  // channel SavedCourseDetailPage's "View on map" already used, just one step
  // later). `state.publicCourse` carries the current-locale-merged row so the
  // detail page can render immediately without its own fetch — see
  // PublicCourseDetailPage's fallback fetch (fetchPublicCourseByKey) for the
  // direct-URL/refresh case where this state isn't available. `sort` is passed
  // through so the detail page's back button can hand it back to ExplorePage
  // (see ExplorePage's location.state?.sort) instead of always resetting to
  // 'popular'.
  function handleViewDetail(row, localizedStops) {
    const snapshot = row.course_snapshot ?? {};
    navigate(ROUTES.publicCourseDetail(row.public_route_key), {
      state: {
        publicCourse: {
          ...row,
          course_snapshot: { ...snapshot, stops: localizedStops },
          stops: localizedStops,
        },
        sort,
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

  // Full-page spinner ONLY for the very first localization pass (no cached
  // entries at all yet) — same flicker-prevention as SavedRoutesTab. Once any
  // entries are cached, a later page's incremental localization must never
  // hide the already-rendered cards behind this spinner again — that
  // collapsed the whole list's height and force-clamped the scroll
  // container's scrollTop back to the top (the actual bug this fixes). A
  // freshly appended page's cards simply render with
  // mergeSavedStopWithLocalizedPlace's raw-snapshot fallback until their
  // specific stop ids resolve moments later.
  if (localizedPlacesLoading && allStopIdsKey && localizedPlacesById.size === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

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
            onViewDetail={() => handleViewDetail(row, localizedStops)}
          />
        );
      })}

      {hasMore && (user ? (
        <div ref={setSentinelNode} className="mt-1 flex justify-center py-1">
          {loadingMore && <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" />}
        </div>
      ) : (
        <PublicRouteTeaserCard sort={sort} onSignInClick={handleGuestCtaClick} />
      ))}
      {loadMoreError && (
        <p className="text-center text-xs text-red-500">{t('publicFeed.loadError')}</p>
      )}
    </div>
  );
}
