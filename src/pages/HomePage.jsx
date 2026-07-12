import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { getPlaces } from '../api/placeApi.js';
import {
  EMPTY_FILTERS,
  filterCount,
  applyFilters,
} from '../features/explore/data/exploreOptions.js';
import { DEFAULT_LOCATION, sortPlacesByDistance } from '../features/explore/data/locations.js';
import { buildRecommendedCourses } from '../features/explore/data/courseBuilder.js';
import { findAnchorPlace } from '../features/explore/services/anchorMatchService.js';
import { consumeLastPlaceView } from '../features/explore/data/lastPlaceView.js';
import Modal from '../features/explore/components/Modal.jsx';
import FilterSheet from '../features/explore/components/FilterSheet.jsx';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocationSheet from '../features/explore/components/LocationSheet.jsx';
import SearchOverlay from '../features/explore/components/SearchOverlay.jsx';
import NearbySheet from '../features/explore/components/NearbySheet.jsx';
import KakaoMap from '../features/explore/components/KakaoMap.jsx';
import { PinIcon, FunnelIcon, FlameIcon, GlobeIcon } from '../shared/components/Icon.jsx';

/** Map tab — full-bleed map with floating controls and a draggable "Eat near here" sheet. */
export default function HomePage() {
  const { locale, t } = useLocale();
  const { state: routeState } = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sheet, setSheet] = useState(null); // 'filters' | 'language' | 'location' | null
  const [isSearching, setIsSearching] = useState(false);
  const [places, setPlaces] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);
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
    getPlaces(locale)
      .then((data) => {
        if (!cancelled) {
          setPlaces(data);
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

  const nearby = useMemo(
    () => sortPlacesByDistance(applyFilters(places, filters), selectedLocation),
    [places, filters, selectedLocation],
  );

  const recommendedCourses = useMemo(
    () => buildRecommendedCourses({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat, maxCourses: 9, anchorPlace, locale }),
    [nearby, selectedLocation, filters.cat, anchorPlace, locale],
  );

  // Reset to first course whenever location or food-type filter changes.
  useEffect(() => {
    setActiveCourseId(null);
    setSavedCourseForMap(null);
  }, [selectedLocation, filters.cat]);

  // Process savedCourse from router state (navigating from SavedCourseDetailPage)
  useEffect(() => {
    if (!routeState?.savedCourse) return;
    setSavedCourseForMap(routeState.savedCourse);
    navigate('/', { replace: true, state: null });
  }, [!!routeState?.savedCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCourse =
    savedCourseForMap ??
    (recommendedCourses.find((c) => c.id === activeCourseId) ?? recommendedCourses[0] ?? null);

  const count = filterCount(filters);

  function handleMapMoved() {
    setShowFindHere(true);
    setGpsStatus('idle');
  }

  function handleFindHere() {
    const center = mapApiRef.current?.getCenter();
    if (!center) return;
    setSelectedLocation({ key: 'map_center', label: t('nearby.selectedArea'), labelKo: '선택한 지역', lat: center.lat, lng: center.lng, source: 'map', address: null });
    setAnchorPlace(null);
    setGpsStatus('idle');
    setShowFindHere(false);
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
        setSelectedLocation({ key: 'current_location', label: t('nearby.currentLocation'), labelKo: '현재 위치', lat, lng, source: 'gps', address: null });
        setAnchorPlace(null);
        setGpsStatus('active');
        setShowFindHere(false);
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function handleSearchSelect(loc) {
    const kakaoResult = loc.source === 'search' && loc.categoryGroupCode
      ? { category_group_code: loc.categoryGroupCode, y: String(loc.lat), x: String(loc.lng), place_name: loc.label }
      : null;
    const anchor = kakaoResult ? findAnchorPlace(kakaoResult, places) : null;
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
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-ink px-1 text-[0.6rem] font-extrabold text-white">
                {count}
              </span>
            )}
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
        filterCount={count}
        onFilterClick={() => setSheet('filters')}
        places={places}
      />

      {/* filter sheet */}
      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} variant="sheet" fullHeight draggableClose>
        <FilterSheet value={filters} onApply={setFilters} onClose={() => setSheet(null)} />
      </Modal>

      {/* language modal */}
      <Modal open={sheet === 'language'} onClose={() => setSheet(null)} variant="center">
        <LanguageModal onClose={() => setSheet(null)} />
      </Modal>

      {/* hot place preset sheet */}
      <Modal open={sheet === 'location'} onClose={() => setSheet(null)} variant="sheet">
        <LocationSheet value={selectedLocation} onSelect={handleLocationPresetSelect} onClose={() => setSheet(null)} />
      </Modal>
    </div>
  );
}
