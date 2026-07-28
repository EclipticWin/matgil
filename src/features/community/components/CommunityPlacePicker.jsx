import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, PinIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { getPlaces } from '../../../api/placeApi.js';
import { searchInternalPlaces } from '../../explore/services/placeSearchService.js';

/** Community-only place search — internal Matgil DB places only (getPlaces() +
 *  searchInternalPlaces()), no Kakao, no presets, no routes. Deliberately not a
 *  reuse of SearchOverlay.jsx (that overlay mixes in preset hotspots, Kakao
 *  external results, and route-less results — none of which have a stable
 *  internal place id a community post can be linked to).
 *
 *  Places are fetched once via getPlaces(locale) the first time this opens,
 *  then reused for every reopen while the same composer/picker instance stays
 *  mounted (hasFetchedRef), so switching the picker open/closed repeatedly
 *  while writing one post never re-fetches the full place list. */
export default function CommunityPlacePicker({ open, onClose, onSelect }) {
  const { locale, t } = useLocale();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const hasFetchedRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setQuery('');
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 150);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setStatus('loading');
    getPlaces(locale)
      .then((data) => {
        setPlaces(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [open, locale]);

  useEffect(() => {
    if (open && mounted && !closing) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [open, mounted, closing]);

  const trimmedQuery = query.trim();
  const results = useMemo(
    () => searchInternalPlaces(trimmedQuery, places),
    [trimmedQuery, places],
  );

  if (!mounted) return null;

  return (
    <div
      className={`absolute inset-0 z-[60] flex flex-col bg-white ${closing ? 'search-overlay-out' : 'search-overlay-in'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* search bar — same layout/tokens as SearchOverlay's, without the filter button */}
      <div className="shrink-0 px-4 pb-3 pt-3.5">
        <div className="flex h-[3.25rem] items-center gap-1 rounded-full bg-ink/[0.07] px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
            <PinIcon size={18} className="shrink-0 text-coral" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('community.searchPlacePlaceholder')}
              className="min-w-0 w-0 flex-1 bg-transparent text-[0.95rem] font-medium text-ink placeholder:text-ink-faint outline-none"
            />
          </div>
          <button
            type="button"
            aria-label={query ? 'Clear' : 'Close'}
            onClick={query ? () => setQuery('') : onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-faint"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-1">
        {status === 'error' ? (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">{t('community.placesLoadFailed')}</p>
        ) : status === 'loading' ? (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">{t('community.loadingPlaces')}</p>
        ) : !trimmedQuery ? (
          <div className="mt-1 rounded-2xl bg-coral-tint px-4 py-3.5">
            <p className="text-[0.82rem] leading-relaxed text-ink-soft">{t('community.searchPlaceGuide')}</p>
          </div>
        ) : results.length > 0 ? (
          results.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => onSelect(place)}
              className="mb-1 flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-ink/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-coral shadow-soft">
                <PinIcon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.95rem] font-semibold text-ink">{place.name}</span>
                {place.address && (
                  <span className="mt-0.5 block truncate text-[0.75rem] text-ink-faint">{place.address}</span>
                )}
              </span>
            </button>
          ))
        ) : (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">{t('community.noPlacesFound')}</p>
        )}
      </div>
    </div>
  );
}
