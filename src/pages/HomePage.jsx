import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getPlaces } from '../api/placeApi.js';
import {
  EMPTY_FILTERS,
  filterCount,
  applyFilters,
  LANGUAGES,
} from '../features/explore/data/exploreOptions.js';
import { DEFAULT_LOCATION, sortPlacesByDistance } from '../features/explore/data/locations.js';
import { buildRecommendedCourses } from '../features/explore/data/courseBuilder.js';
import Modal from '../features/explore/components/Modal.jsx';
import FilterSheet from '../features/explore/components/FilterSheet.jsx';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocationSheet from '../features/explore/components/LocationSheet.jsx';
import SearchOverlay from '../features/explore/components/SearchOverlay.jsx';
import NearbySheet from '../features/explore/components/NearbySheet.jsx';
import KakaoMap from '../features/explore/components/KakaoMap.jsx';
import { SearchIcon, FilterIcon, FlameIcon, GlobeIcon, ChevronRightIcon } from '../shared/components/Icon.jsx';

/** Map tab — full-bleed map with floating controls and a draggable "Eat near here" sheet. */
export default function HomePage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [lang, setLang] = useState('EN');
  const [sheet, setSheet] = useState(null); // 'filters' | 'language' | 'location' | null
  const [isSearching, setIsSearching] = useState(false);
  const [places, setPlaces] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_LOCATION);

  const mapRef = useRef(null);
  const [vh, setVh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPlaces('ko')
      .then((data) => { if (!cancelled) setPlaces(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    () => buildRecommendedCourses({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat, maxCourses: 9 }),
    [nearby, selectedLocation, filters.cat],
  );

  const [activeCourseId, setActiveCourseId] = useState(null);

  // Reset to first course whenever location or food-type filter changes.
  useEffect(() => {
    setActiveCourseId(null);
  }, [selectedLocation, filters.cat]);

  const activeCourse =
    recommendedCourses.find((c) => c.id === activeCourseId) ?? recommendedCourses[0] ?? null;

  const count = filterCount(filters);
  const langShort = LANGUAGES.find((l) => l.code === lang)?.short ?? 'EN';

  function handleSearchSelect(loc) {
    setSelectedLocation(loc);
    setIsSearching(false);
  }

  return (
    <div ref={mapRef} className="relative h-full overflow-hidden bg-map-land">
      {/* Kakao Map */}
      <KakaoMap selectedLocation={selectedLocation} course={activeCourse} />

      {/* floating controls */}
      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-3.5">
        {/* Search bar — click opens full-screen SearchOverlay */}
        <div className="flex h-[3.25rem] items-center gap-2.5 rounded-2xl bg-white px-3.5 shadow-soft">
          <button
            type="button"
            aria-label="Search places"
            onClick={() => setIsSearching(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5"
          >
            <SearchIcon className="shrink-0 text-ink-soft" />
            <span className="truncate text-[0.95rem] font-medium text-ink-faint">
              Search dishes, places…
            </span>
          </button>
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setSheet('filters')}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-coral text-white shadow-[0_2px_6px_rgba(248,72,31,0.22)]"
          >
            <FilterIcon />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-ink px-1 text-[0.6rem] font-extrabold text-white">
                {count}
              </span>
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          {/* Hot place preset button */}
          <button
            type="button"
            aria-label="Choose a hot place"
            onClick={() => setSheet('location')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft"
          >
            <FlameIcon size={20} className="text-coral" />
          </button>

          <button
            type="button"
            onClick={() => setSheet('language')}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 shadow-soft"
          >
            <GlobeIcon className="text-ink-soft" />
            <span className="text-[0.85rem] font-bold text-ink">{langShort}</span>
            <ChevronRightIcon size={10} className="rotate-90 text-ink-faint" />
          </button>
        </div>
      </div>

      {/* draggable nearby sheet */}
      <NearbySheet
        vh={vh}
        courses={recommendedCourses}
        activeCourse={activeCourse}
        onSelectCourse={(c) => setActiveCourseId(c.id)}
        selectedLocation={selectedLocation}
      />

      {/* full-screen search overlay — rendered before modals so modals stack on top */}
      <SearchOverlay
        open={isSearching}
        onSelect={handleSearchSelect}
        onClose={() => setIsSearching(false)}
        filterCount={count}
        onFilterClick={() => setSheet('filters')}
      />

      {/* filter sheet */}
      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} variant="sheet">
        <FilterSheet value={filters} onApply={setFilters} onClose={() => setSheet(null)} />
      </Modal>

      {/* language modal */}
      <Modal open={sheet === 'language'} onClose={() => setSheet(null)} variant="center">
        <LanguageModal value={lang} onSelect={setLang} onClose={() => setSheet(null)} />
      </Modal>

      {/* hot place preset sheet */}
      <Modal open={sheet === 'location'} onClose={() => setSheet(null)} variant="sheet">
        <LocationSheet value={selectedLocation} onSelect={setSelectedLocation} onClose={() => setSheet(null)} />
      </Modal>
    </div>
  );
}
