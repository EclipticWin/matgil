import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { getPlacesWithReviewStats } from '../api/placeApi.js';
import {
  EMPTY_FILTERS,
  applyFilters,
} from '../features/explore/data/exploreOptions.js';
import { DEFAULT_LOCATION, sortPlacesByDistance } from '../features/explore/data/locations.js';
import { buildRecommendedCourses } from '../features/explore/data/courseBuilder.js';
import { findAnchorPlace } from '../features/explore/services/anchorMatchService.js';
import { reverseGeocodeCoords } from '../features/explore/services/reverseGeocodeService.js';
import { consumeLastPlaceView } from '../features/explore/data/lastPlaceView.js';
import Modal from '../features/explore/components/Modal.jsx';
import FilterSheet from '../features/explore/components/FilterSheet.jsx';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocationSheet from '../features/explore/components/LocationSheet.jsx';
import SearchOverlay from '../features/explore/components/SearchOverlay.jsx';
import NearbySheet from '../features/explore/components/NearbySheet.jsx';
import KakaoMap from '../features/explore/components/KakaoMap.jsx';
import { PinIcon, FunnelIcon, FlameIcon, GlobeIcon, CloseIcon } from '../shared/components/Icon.jsx';

const ZH_INFO_NOTICE_SESSION_KEY = 'matgil_zh_info_notice_seen';

// sessionStorage (not localStorage — this notice is meant to reappear in a fresh
// session, see the spec) can throw in some environments (privacy mode, storage
// disabled); either helper failing must never block a language switch, so both
// are wrapped and degrade to "not seen yet" / "silently didn't persist".
function hasSeenChineseInfoNotice() {
  try {
    return sessionStorage.getItem(ZH_INFO_NOTICE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markChineseInfoNoticeSeen() {
  try {
    sessionStorage.setItem(ZH_INFO_NOTICE_SESSION_KEY, '1');
  } catch {
    // best-effort only
  }
}

/** Map tab — full-bleed map with floating controls and a draggable "Eat near here" sheet. */
export default function HomePage() {
  const { locale, t } = useLocale();
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(null); // 'filters' | 'language' | 'location' | null
  // Shown only right after the user explicitly picks zh-CN in LanguageModal (see
  // handleLanguageSelected) — never from a useEffect watching `locale`, so a
  // page load/refresh that already has zh-CN saved never triggers it on its own.
  const [showChineseInfoNotice, setShowChineseInfoNotice] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  // false only once getPlacesWithReviewStats() confirms the stats fetch failed —
  // starts true so the rating filter isn't disabled while the very first load is in flight.
  const [reviewStatsAvailable, setReviewStatsAvailable] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);
  const [anchorPlace, setAnchorPlace] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle'|'loading'|'active'|'denied'|'error'|'unsupported'
  const [showFindHere, setShowFindHere] = useState(false);

  const [activeCourseId, setActiveCourseId] = useState(null);
  // Saved course injected via router state from SavedCourseDetailPage
  const [savedCourseForMap, setSavedCourseForMap] = useState(null);
  // Place to auto-reopen after a round trip to the full reviews page (see lastPlaceView.js)
  const [initialPlaceId, setInitialPlaceId] = useState(null);

  const mapRef = useRef(null);
  const mapApiRef = useRef(null);
  const [vh, setVh] = useState(0);
  const restoredViewRef = useRef(false);

  // One-shot restoration of the Map view after returning from /places/:id/reviews.
  // A ref guard (not just the effect's empty deps) protects against StrictMode's
  // dev-only double-invoke, which would otherwise consume-and-lose the pending value.
  useEffect(() => {
    if (restoredViewRef.current) return;
    restoredViewRef.current = true;
    const pending = consumeLastPlaceView();
    if (!pending) return;
    if (pending.selectedLocation) setSelectedLocation(pending.selectedLocation);
    if (pending.placeId != null) setInitialPlaceId(pending.placeId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPlacesLoading(true);
    setAnchorPlace(null);
    setActiveCourseId(null);
    getPlacesWithReviewStats(locale)
      .then(({ places: data, reviewStatsAvailable: statsOk }) => {
        if (!cancelled) {
          setPlaces(data);
          setReviewStatsAvailable(statsOk);
          setPlacesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPlacesLoading(false);
      });
    return () => { cancelled = true; };
  }, [locale]);

  useLayoutEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const update = () => setVh(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When the review-stats fetch failed, minimumRating can't be evaluated (every place
  // would look review-less) — force it back to 0 so FOOD TYPE/location filtering still
  // works instead of the candidate pool silently going empty. filters itself stays
  // untouched so the committed minimumRating reappears once stats become available again.
  const effectiveFilters = useMemo(
    () => (reviewStatsAvailable ? filters : { ...filters, minimumRating: 0 }),
    [filters, reviewStatsAvailable],
  );

  const nearby = useMemo(
    () => sortPlacesByDistance(applyFilters(places, effectiveFilters), selectedLocation),
    [places, effectiveFilters, selectedLocation],
  );

  const recommendedCourses = useMemo(
    () => buildRecommendedCourses({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat, maxCourses: 9, anchorPlace, locale }),
    [nearby, selectedLocation, filters.cat, anchorPlace, locale],
  );

  // Reset to first course whenever location, food-type, or minimum-rating filter changes.
  useEffect(() => {
    setActiveCourseId(null);
    setSavedCourseForMap(null);
  }, [selectedLocation, filters.cat, filters.minimumRating]);

  // Process savedCourse from router state (navigating from SavedCourseDetailPage)
  useEffect(() => {
    if (!routeState?.savedCourse) return;
    setSavedCourseForMap(routeState.savedCourse);
    navigate('/', { replace: true, state: null });
  }, [!!routeState?.savedCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCourse =
    savedCourseForMap ??
    (recommendedCourses.find((c) => c.id === activeCourseId) ?? recommendedCourses[0] ?? null);

  function handleMapMoved() {
    setShowFindHere(true);
    setGpsStatus('idle');
  }

  // Best-effort reverse geocode: augments the already-set selectedLocation with
  // address/area once Kakao resolves it, guarded so a stale response from a since-
  // replaced location (user moved the map/GPS again before this resolved) is dropped
  // instead of clobbering the newer selection. Never blocks or fails the selection
  // itself — anchor_address_original/anchor_area_original just stay null on failure.
  function augmentWithReverseGeocode(source, lat, lng) {
    reverseGeocodeCoords(lat, lng).then((geo) => {
      if (!geo) return;
      setSelectedLocation((prev) => (
        prev?.source === source && prev.lat === lat && prev.lng === lng
          ? { ...prev, address: geo.address ?? prev.address, area: geo.area ?? prev.area, placeName: geo.placeName ?? prev.placeName }
          : prev
      ));
    });
  }

  function handleFindHere() {
    const center = mapApiRef.current?.getCenter();
    if (!center) return;
    setSelectedLocation({ key: 'map_center', label: t('nearby.selectedArea'), labelKo: '선택한 지역', lat: center.lat, lng: center.lng, source: 'map', address: null, area: null, placeName: null });
    setAnchorPlace(null);
    setGpsStatus('idle');
    setShowFindHere(false);
    augmentWithReverseGeocode('map', center.lat, center.lng);
  }

  function handleGpsClick() {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setSelectedLocation({ key: 'current_location', label: t('nearby.currentLocation'), labelKo: '현재 위치', lat, lng, source: 'gps', address: null, area: null, placeName: null });
        setAnchorPlace(null);
        setGpsStatus('active');
        setShowFindHere(false);
        augmentWithReverseGeocode('gps', lat, lng);
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function handleSearchSelect(loc) {
    // internalPlaceId means SearchOverlay already resolved this selection to a
    // specific mg_places row (an internal-DB-place result, or a Kakao result it
    // matched via findAnchorPlace) — use that id directly instead of re-deriving
    // it through fuzzy category/geo/name matching a second time.
    let anchor = null;
    if (loc.internalPlaceId != null) {
      anchor = places.find((p) => p.id === loc.internalPlaceId) ?? null;
    } else if (loc.source === 'search' && loc.categoryGroupCode) {
      const kakaoResult = { category_group_code: loc.categoryGroupCode, y: String(loc.lat), x: String(loc.lng), place_name: loc.label };
      anchor = findAnchorPlace(kakaoResult, places);
    }
    setSelectedLocation(loc);
    setAnchorPlace(anchor);
    setIsSearching(false);
    setGpsStatus('idle');
    setShowFindHere(false);
  }

  function handleLocationPresetSelect(loc) {
    setSelectedLocation(loc);
    setAnchorPlace(null);
    setGpsStatus('idle');
    setShowFindHere(false);
  }

  // Fires once per LanguageModal pick, right before it closes (see its onClick) —
  // never from watching `locale` itself, so a saved zh-CN locale restored on load
  // or kept across a refresh never re-triggers this on its own.
  function handleLanguageSelected(code) {
    if (code === 'zh-CN' && !hasSeenChineseInfoNotice()) {
      markChineseInfoNoticeSeen();
      setShowChineseInfoNotice(true);
    }
  }

  // Modal.jsx has no built-in Escape handling for any variant, and adding one
  // there would change every sheet/center modal's keyboard behavior at once —
  // out of scope for a notice that only this one modal needs. Scoped to just
  // this state instead of a global always-on listener.
  useEffect(() => {
    if (!showChineseInfoNotice) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') setShowChineseInfoNotice(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChineseInfoNotice]);

  return (
    <div ref={mapRef} className="relative h-full overflow-hidden bg-map-land">
      {/* Kakao Map */}
      <KakaoMap selectedLocation={selectedLocation} course={activeCourse} onMapMoved={handleMapMoved} mapApiRef={mapApiRef} />

      {/* floating controls */}
      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-3.5">
        {/* Search bar — click opens full-screen SearchOverlay */}
        <div className="flex h-[3.25rem] items-center gap-1 rounded-full bg-white px-3 shadow-soft">
          <button
            type="button"
            aria-label="Search places"
            onClick={() => setIsSearching(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-1"
          >
            <PinIcon size={18} className="shrink-0 text-coral" />
            <span className="truncate text-[0.95rem] font-medium text-ink-faint">
              {t('nearby.searchPlaceholder')}
            </span>
          </button>
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setSheet('filters')}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft"
          >
            <FunnelIcon size={18} />
          </button>
        </div>

        {/* Second row: flame | [Find routes here] | globe — 3-col grid keeps center slot fixed */}
        <div className="mt-3 grid grid-cols-3 items-center">
          {/* Left: Hot place preset */}
          <button
            type="button"
            aria-label="Choose a hot place"
            onClick={() => setSheet('location')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft"
          >
            <FlameIcon size={20} className="text-coral" />
          </button>

          {/* Center: Find routes here — only when map was dragged */}
          <div className="flex justify-center">
            {showFindHere && (
              <button
                type="button"
                onClick={handleFindHere}
                className="whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-[0.8rem] font-semibold text-ink shadow-soft"
              >
                {t('nearby.findRoutesHere')}
              </button>
            )}
          </div>

          {/* Right: Language — icon only */}
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Choose language"
              onClick={() => setSheet('language')}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft"
            >
              <GlobeIcon size={20} className="text-ink-soft" />
            </button>
          </div>
        </div>
      </div>

      {/* draggable nearby sheet */}
      <NearbySheet
        vh={vh}
        courses={recommendedCourses}
        activeCourse={activeCourse}
        onSelectCourse={(c) => {
          setActiveCourseId(c.id);
          setSavedCourseForMap(null);
        }}
        selectedLocation={selectedLocation}
        selectedFoodTypes={filters.cat}
        minimumRating={filters.minimumRating}
        isLoading={placesLoading}
        gpsStatus={gpsStatus}
        onGpsClick={handleGpsClick}
        onGpsStatusChange={setGpsStatus}
        initialCourse={savedCourseForMap}
        initialPlaceId={initialPlaceId}
      />

      {/* full-screen search overlay — rendered before modals so modals stack on top */}
      <SearchOverlay
        open={isSearching}
        onSelect={handleSearchSelect}
        onClose={() => setIsSearching(false)}
        onFilterClick={() => setSheet('filters')}
        places={places}
      />

      {/* filter sheet */}
      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} variant="sheet" fullHeight draggableClose>
        <FilterSheet
          value={filters}
          onApply={setFilters}
          onClose={() => setSheet(null)}
          ratingFilterAvailable={reviewStatsAvailable}
        />
      </Modal>

      {/* language modal */}
      <Modal open={sheet === 'language'} onClose={() => setSheet(null)} variant="center">
        <LanguageModal onClose={() => setSheet(null)} onLanguageSelected={handleLanguageSelected} />
      </Modal>

      {/* zh-CN info notice — opens right after LanguageModal closes on a zh-CN pick
          (handleLanguageSelected), never overlapping it (same click batches both
          `sheet` and `showChineseInfoNotice` in one render). */}
      <Modal open={showChineseInfoNotice} onClose={() => setShowChineseInfoNotice(false)} variant="center">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1.5 pt-5">
          <h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
            {t('language.chineseNoticeTitle')}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setShowChineseInfoNotice(false)}
            className="shrink-0 p-1 text-ink-soft"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-1.5 px-5 pb-6 pt-1">
          <p className="text-[0.85rem] leading-relaxed text-ink-soft">{t('language.chineseNoticeBodyLine1')}</p>
          <p className="text-[0.85rem] leading-relaxed text-ink-soft">{t('language.chineseNoticeBodyLine2')}</p>
        </div>
      </Modal>

      {/* hot place preset sheet */}
      <Modal open={sheet === 'location'} onClose={() => setSheet(null)} variant="sheet">
        <LocationSheet value={selectedLocation} onSelect={handleLocationPresetSelect} onClose={() => setSheet(null)} />
      </Modal>
    </div>
  );
}
