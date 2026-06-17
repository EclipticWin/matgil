import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getPlaces } from '../api/placeApi.js';
import {
  EMPTY_FILTERS,
  filterCount,
  applyFilters,
  LANGUAGES,
} from '../features/explore/data/exploreOptions.js';
import { DEFAULT_LOCATION, sortPlacesByDistance } from '../features/explore/data/locations.js';
import { buildTodayCourse } from '../features/explore/data/courseBuilder.js';
import Modal from '../features/explore/components/Modal.jsx';
import FilterSheet from '../features/explore/components/FilterSheet.jsx';
import LanguageModal from '../features/explore/components/LanguageModal.jsx';
import LocationSheet from '../features/explore/components/LocationSheet.jsx';
import NearbySheet from '../features/explore/components/NearbySheet.jsx';
import { SearchIcon, FilterIcon, PinIcon, GlobeIcon, ChevronRightIcon } from '../shared/components/Icon.jsx';

/** Map tab — a full-bleed (placeholder) map with floating search / location /
 *  language controls and a draggable "Eat near here" sheet. */
export default function HomePage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [lang, setLang] = useState('EN');
  const [sheet, setSheet] = useState(null); // 'filters' | 'language' | 'location' | null
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

  const todayCourse = useMemo(
    () => buildTodayCourse({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat }),
    [nearby, selectedLocation, filters.cat],
  );

  const count = filterCount(filters);
  const langShort = LANGUAGES.find((l) => l.code === lang)?.short ?? 'EN';

  return (
    <div ref={mapRef} className="relative h-full overflow-hidden bg-map-land">
      {/* blank map base (no backend) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-ink-faint/60">
          <PinIcon size={26} className="text-coral/40" />
          <span className="text-xs font-semibold uppercase tracking-wide">Map view</span>
        </div>
      </div>

      {/* floating controls */}
      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-3.5">
        <div className="flex h-[3.25rem] items-center gap-2.5 rounded-2xl bg-white px-3.5 shadow-card">
          <SearchIcon className="text-ink-soft" />
          <span className="flex-1 truncate text-[0.95rem] font-medium text-ink-faint">
            Search dishes, places…
          </span>
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setSheet('filters')}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-coral text-white shadow-coral"
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
          <button
            type="button"
            onClick={() => setSheet('location')}
            className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 shadow-soft"
          >
            <PinIcon size={14} className="text-coral" />
            <span className="leading-none">
              <span className="block text-[0.55rem] font-bold uppercase tracking-wide text-ink-faint">
                You're in
              </span>
              <span className="mt-0.5 block text-[0.85rem] font-bold text-ink">{selectedLocation.label}</span>
            </span>
            <ChevronRightIcon size={10} className="ml-0.5 rotate-90 text-ink-faint" />
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
      <NearbySheet vh={vh} course={todayCourse} places={nearby} selectedLocation={selectedLocation} />

      {/* filter sheet (slides up) */}
      <Modal open={sheet === 'filters'} onClose={() => setSheet(null)} variant="sheet">
        <FilterSheet value={filters} onApply={setFilters} onClose={() => setSheet(null)} />
      </Modal>

      {/* language modal (centered) */}
      <Modal open={sheet === 'language'} onClose={() => setSheet(null)} variant="center">
        <LanguageModal value={lang} onSelect={setLang} onClose={() => setSheet(null)} />
      </Modal>

      {/* location picker sheet */}
      <Modal open={sheet === 'location'} onClose={() => setSheet(null)} variant="sheet">
        <LocationSheet value={selectedLocation} onSelect={setSelectedLocation} onClose={() => setSheet(null)} />
      </Modal>
    </div>
  );
}
