import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { fetchPublicCourseByKey } from '../features/courses/services/publicFeedService.js';
import { softDeleteSavedCourse } from '../features/courses/services/savedCourseService.js';
import { fetchPlaceReviewStatsBatch } from '../features/places/services/placeReviewService.js';
import { fetchPlaceBookmarkStatsBatch } from '../features/places/services/placeBookmarkService.js';
import { getPlacesByIds } from '../api/placeApi.js';
import { formatCourseDistance, formatCourseDuration } from '../features/courses/utils/courseMetrics.js';
import {
  normalizeSavedCourseForDisplay,
  formatStopStatsParts,
  getPublicCourseAnchorDisplay,
  getSavedCoursePreferenceLine,
  mergeSavedStopWithLocalizedPlace,
} from '../features/courses/utils/courseDisplay.js';
import { useFoodCategories } from '../features/explore/context/FoodCategoryProvider.jsx';
import RemoveSavedCourseConfirmModal from '../features/courses/components/RemoveSavedCourseConfirmModal.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Thumbnail from '../shared/components/Thumbnail.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import {
  BackIcon,
  PinIcon,
  WalkIcon,
  ClockIcon,
  RouteIcon,
  TrashIcon,
  ChevronRightIcon,
} from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** Full-screen detail page for a "Traveler Picks" (Explore tab, PublicRoutesTab)
 *  public course — visually mirrors SavedCourseDetailPage.jsx (coral header,
 *  ROUTE STOPS timeline, sticky bottom CTA) but is a deliberately separate
 *  component, NOT a reuse of SavedCourseDetailPage itself: that page assumes a
 *  logged-in owner (`if (!user) return <Navigate to={ROUTES.explore} .../>`)
 *  and resolves its `:id` route param as a `mg_saved_courses.id` the current
 *  user owns (`fetchSavedCourseById({ userId, courseId: id })`). A public
 *  route has neither — it's identified by `public_route_key`, viewable by
 *  anyone logged in or not, and "is this saved" is a per-viewer fact
 *  (`row.is_saved`/`row.my_saved_course_id`) rather than an ownership premise.
 *
 *  Data: `location.state.publicCourse` (set by PublicRoutesTab.handleViewDetail)
 *  is used immediately for first paint when present — no fetch. When absent
 *  (direct URL open, or a hard refresh that lost router state), this fetches
 *  via fetchPublicCourseByKey() instead. Never redirects to the Map tab or to
 *  login on its own — "View map" is the only thing that ever navigates to
 *  ROUTES.home, and only on an explicit click. */
export default function PublicCourseDetailPage() {
  const { publicRouteKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, t } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const { user } = useAuth();

  const stateCourse = location.state?.publicCourse ?? null;
  const incomingSort = location.state?.sort ?? 'popular';

  const [row, setRow] = useState(stateCourse);
  const [fetchLoading, setFetchLoading] = useState(!stateCourse);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [reviewStatsById, setReviewStatsById] = useState(new Map());
  const [saveCountById, setSaveCountById] = useState(new Map());
  const [localizedPlacesById, setLocalizedPlacesById] = useState(new Map());
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [removeToast, setRemoveToast] = useState(false);

  // Only fetches when router state didn't already give us a row (direct URL
  // access, or a refresh that lost `location.state`) — a normal card-click
  // arrival trusts the feed-fresh row it already has, same as every other
  // router-state-fed screen in this app (e.g. SavedCourseDetailPage trusts its
  // own single fetch without re-verifying elsewhere).
  useEffect(() => {
    if (stateCourse) return;
    let cancelled = false;
    setFetchLoading(true);
    setFetchError(false);
    setNotFound(false);
    fetchPublicCourseByKey(publicRouteKey)
      .then((data) => {
        if (cancelled) return;
        if (!data) { setNotFound(true); setFetchLoading(false); return; }
        setRow(data);
        setFetchLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError(true);
        setFetchLoading(false);
      });
    return () => { cancelled = true; };
  }, [publicRouteKey, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same batched-lookup discipline as SavedCourseDetailPage — one query per
  // stat kind for every stop on this course, never per-stop. Kept above the
  // loading/notFound/error early returns below so these hooks always run
  // (rules of hooks), same as SavedCourseDetailPage.
  const rawStops = row?.stops ?? row?.course_snapshot?.stops ?? [];
  const stopIdsKey = [...new Set(rawStops.map((s) => s.id).filter((sid) => sid != null))].join(',');

  useEffect(() => {
    if (!stopIdsKey) {
      setReviewStatsById(new Map());
      return;
    }
    let cancelled = false;
    fetchPlaceReviewStatsBatch(stopIdsKey.split(',').map(Number))
      .then((statsMap) => { if (!cancelled) setReviewStatsById(statsMap); })
      .catch(() => { if (!cancelled) setReviewStatsById(new Map()); });
    return () => { cancelled = true; };
  }, [stopIdsKey]);

  useEffect(() => {
    if (!stopIdsKey) {
      setSaveCountById(new Map());
      return;
    }
    let cancelled = false;
    fetchPlaceBookmarkStatsBatch(stopIdsKey.split(',').map(Number))
      .then((countMap) => { if (!cancelled) setSaveCountById(countMap); })
      .catch(() => { if (!cancelled) setSaveCountById(new Map()); });
    return () => { cancelled = true; };
  }, [stopIdsKey]);

  // Current-locale place text merged over whatever locale the public snapshot
  // happened to carry — same getPlacesByIds() batch SavedCourseDetailPage uses,
  // so this page never freezes at "whichever saver's locale" text regardless
  // of the viewer's own current locale.
  useEffect(() => {
    if (!stopIdsKey) {
      setLocalizedPlacesById(new Map());
      return;
    }
    let cancelled = false;
    getPlacesByIds(stopIdsKey.split(',').map(Number), locale)
      .then((places) => { if (!cancelled) setLocalizedPlacesById(new Map(places.map((p) => [p.id, p]))); })
      .catch(() => { if (!cancelled) setLocalizedPlacesById(new Map()); });
    return () => { cancelled = true; };
  }, [stopIdsKey, locale]);

  // Back → ExplorePage's Routes tab, handing the sort we arrived with back so
  // a 'latest' selection doesn't silently reset to the 'popular' default (see
  // ExplorePage's own location.state?.sort). Scroll position is NOT restored
  // (out of scope — see the final report's accepted limitations).
  function handleBack() {
    navigate(ROUTES.explore, { state: { tab: 'routes', sort: incomingSort } });
  }

  if (fetchLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-paper-soft">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper-soft px-6 text-center">
        <p className="text-sm text-ink-soft">{t('publicFeed.notFound')}</p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white"
        >
          {t('publicFeed.backToExplore')}
        </button>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper-soft px-6 text-center">
        <p className="text-sm text-ink-soft">{t('publicFeed.loadError')}</p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            className="rounded-full bg-ink/8 px-4 py-2 text-sm font-bold text-ink-soft"
          >
            {t('savedPlaces.retry')}
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full bg-coral px-4 py-2 text-sm font-bold text-white"
          >
            {t('publicFeed.backToExplore')}
          </button>
        </div>
      </div>
    );
  }

  if (!row) return null; // unreachable given the states above — defensive only

  // Current-locale place text merged over the public snapshot (same pattern/
  // rationale as SavedCourseDetailPage — see mergeSavedStopWithLocalizedPlace's
  // own doc comment). Computed before `display` so it can feed a more accurate
  // menu-based title regeneration via displayHelpers.localizedStops.
  const stops = rawStops.map((stop) => mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(stop.id)));
  const displayHelpers = { getCategoryLabel, t, localizedStops: stops };
  const display = normalizeSavedCourseForDisplay(row, locale, displayHelpers);
  const snapshot = display.course_snapshot ?? {};
  const stopCount = display.stop_count ?? stops.length;

  // getPublicCourseAnchorDisplay (not getSavedCourseAnchorLine) — the same
  // util PublicRoutesTab's own card already uses for "기준 위치", so the list
  // and this detail page always agree on the same value for the same row.
  const anchorLine = getPublicCourseAnchorDisplay(row, locale, { t });

  // Preference line is conditional here (unlike SavedCourseDetailPage, which
  // always shows a "None selected" placeholder) — only rendered when the
  // public row actually carries real preference_keys, per this feature's spec.
  const preferenceKeys = Array.isArray(row.preference_keys) ? row.preference_keys.filter(Boolean) : [];
  const preferenceLine = preferenceKeys.length > 0
    ? getSavedCoursePreferenceLine(row, locale, { getCategoryLabel })
    : null;

  const distM = display.total_distance_m ?? snapshot.normalizedMetrics?.totalDistanceM ?? null;
  const durMin = display.total_duration_min ?? snapshot.normalizedMetrics?.totalDurationMin ?? null;
  const displayDistance = distM != null ? formatCourseDistance(distM) : snapshot.km ?? '—';
  const displayDuration = durMin != null ? formatCourseDuration(durMin, locale) : snapshot.hr ?? '—';

  const isSaved = !!row.is_saved;
  const mySavedCourseId = row.my_saved_course_id ?? null;
  // Only offer Remove when there's an actual row id to delete — is_saved=true
  // with no id (shouldn't normally happen, but see task spec) falls through
  // to the View-map-only CTA instead of showing a Remove that can't work.
  const canRemove = !!user && isSaved && mySavedCourseId != null;

  function handleViewOnMap() {
    const rawSnap = row.course_snapshot ?? {};
    navigate(ROUTES.home, {
      state: {
        savedCourse: {
          ...rawSnap,
          stops,
          anchor_label: row.anchor_label ?? rawSnap.anchor_label ?? '',
        },
      },
    });
  }

  // Soft-deletes this viewer's own saved copy of the public route — the
  // public route itself (and every other viewer's save of it) is untouched.
  // Unlike SavedCourseDetailPage's Remove, this never navigates away
  // afterward — the public course still exists and stays viewable.
  async function handleConfirmRemove() {
    if (removeBusy || !user || mySavedCourseId == null) return;
    setRemoveBusy(true);
    setRemoveFailed(false);
    try {
      await softDeleteSavedCourse({ userId: user.id, courseId: mySavedCourseId });
      setRemoveBusy(false);
      setRemoveConfirmOpen(false);
      setRow((prev) => (prev && {
        ...prev,
        is_saved: false,
        my_saved_course_id: null,
        save_count: Math.max(0, (prev.save_count ?? 0) - 1),
      }));
      setRemoveToast(true);
      setTimeout(() => setRemoveToast(false), 1800);
    } catch {
      setRemoveBusy(false);
      setRemoveFailed(true);
    }
  }

  return (
    <div className="relative flex h-full flex-col bg-paper-soft">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* tinted header */}
        <div className="rounded-b-[1.625rem] bg-coral px-5 pb-[1.375rem] pt-[3.625rem] text-white">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="mb-[1.125rem] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"
          >
            <BackIcon />
          </button>
          <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider opacity-90">
            {t('publicFeed.detailLabel')}
          </div>
          <h1 className="mt-[0.4375rem] font-display text-[1.75rem] font-bold leading-[1.05] tracking-tight">
            {display.title}
          </h1>
          {anchorLine && (
            <p className="mt-1 truncate text-[0.8125rem] font-medium text-white/75">
              {t('courseDetail.startingPointLine', { value: anchorLine })}
            </p>
          )}
          {preferenceLine && (
            <p className="mt-0.5 truncate text-[0.75rem] font-medium text-white/70">
              {t('courseDetail.preferencesLine', { value: preferenceLine })}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 text-[0.8125rem] font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon size={14} /> {t('courseDetail.stops', { n: stopCount })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <WalkIcon /> {displayDistance}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon /> {displayDuration}
            </span>
          </div>
        </div>

        {/* stops */}
        <div className="px-5 pb-6 pt-5">
          <div className="mb-3 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
            {t('courseDetail.routeStops')}
          </div>

          <div className="relative space-y-3">
            <div
              className="absolute bottom-10 left-[1.0625rem] top-10 w-[2.5px]"
              style={{
                background:
                  'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
              }}
            />

            {stops.map((stop, i) => {
              const subtitle = stop.firstMenu || t('courseDetail.restaurantFallback');
              const { head: statsHead, distance } = formatStopStatsParts(
                stop,
                reviewStatsById.get(stop.id),
                saveCountById.get(stop.id),
                t('courseDetail.noRatings'),
              );
              const canOpenDetail = Number.isFinite(stop.id) && stop.id > 0;

              const cardBody = (
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ink/5 bg-white/45 px-3 py-3 shadow-[0_0.25rem_1rem_rgba(34,24,20,0.04)]">
                  <Thumbnail
                    src={stop.imageUrl}
                    tint={stop.tint}
                    className="h-14 w-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-ink-faint">
                      <span className="whitespace-nowrap">{statsHead}</span>
                      {distance && <span className="whitespace-nowrap">{distance}</span>}
                    </div>
                  </div>
                  <ChevronRightIcon size={14} className="shrink-0 text-ink-faint" />
                </div>
              );

              return (
                <div key={stop.id ?? i} className="relative flex items-center gap-5">
                  <div className="z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)]">
                    {i + 1}
                  </div>
                  {canOpenDetail ? (
                    <Link to={ROUTES.placeDetail(stop.id)} state={{ place: stop }} className="min-w-0 flex-1">
                      {cardBody}
                    </Link>
                  ) : cardBody}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 삭제 성공 안내 — pointer-events-none 오버레이, 페이지는 그대로 유지된다
          (SavedCourseDetailPage와 달리 navigate로 이어지지 않음 — 공개 동선 자체는
          삭제 후에도 계속 존재하기 때문). */}
      {removeToast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-5">
          <div className="rounded-full bg-ink/85 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {t('savedCourses.removed')}
          </div>
        </div>
      )}

      {/* sticky CTA — Remove+View map (1:1, saved) or View map alone (full
          width, not saved / not logged in) — same button styling
          SavedCourseDetailPage's sticky CTA uses. */}
      <div className="shrink-0 border-t border-ink/5 bg-paper-soft px-5 pb-3 pt-3">
        {canRemove ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRemoveConfirmOpen(true)}
              className="flex h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-[0.9375rem] border border-ink/10 bg-white text-base font-bold text-ink/80 transition-colors duration-100 active:bg-ink/[0.03]"
            >
              <TrashIcon size={18} />
              {t('savedCourses.remove')}
            </button>
            <button
              type="button"
              onClick={handleViewOnMap}
              className="flex h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)] transition-colors duration-100 active:bg-[#E83D19]"
            >
              <RouteIcon size={18} />
              {t('savedCourses.viewMap')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleViewOnMap}
            className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)] transition-colors duration-100 active:bg-[#E83D19]"
          >
            <RouteIcon size={18} />
            {t('savedCourses.viewMap')}
          </button>
        )}
      </div>

      <RemoveSavedCourseConfirmModal
        open={removeConfirmOpen}
        onCancel={() => { if (!removeBusy) setRemoveConfirmOpen(false); }}
        onConfirm={handleConfirmRemove}
        busy={removeBusy}
        failed={removeFailed}
      />
    </div>
  );
}
