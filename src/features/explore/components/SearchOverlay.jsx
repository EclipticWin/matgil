import { useEffect, useRef, useState } from 'react';
import { CloseIcon, FunnelIcon, PinIcon } from '../../../shared/components/Icon.jsx';
import { searchPlacesByKeyword } from '../services/kakaoPlaceSearchService.js';
import { findAnchorPlace } from '../services/anchorMatchService.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const SEOUL_DISTRICT_EN = {
  강남구: 'Gangnam-gu',   강동구: 'Gangdong-gu',  강북구: 'Gangbuk-gu',
  강서구: 'Gangseo-gu',   관악구: 'Gwanak-gu',    광진구: 'Gwangjin-gu',
  구로구: 'Guro-gu',      금천구: 'Geumcheon-gu', 노원구: 'Nowon-gu',
  도봉구: 'Dobong-gu',    동대문구: 'Dongdaemun-gu', 동작구: 'Dongjak-gu',
  마포구: 'Mapo-gu',      서대문구: 'Seodaemun-gu', 서초구: 'Seocho-gu',
  성동구: 'Seongdong-gu', 성북구: 'Seongbuk-gu',  송파구: 'Songpa-gu',
  양천구: 'Yangcheon-gu', 영등포구: 'Yeongdeungpo-gu', 용산구: 'Yongsan-gu',
  은평구: 'Eunpyeong-gu', 종로구: 'Jongno-gu',   중구: 'Jung-gu',
  중랑구: 'Jungnang-gu',
};

function formatSeoulDistrictAddress(addressStr) {
  if (!addressStr) return null;
  if (!addressStr.includes('서울')) return addressStr;
  const match = addressStr.match(/([가-힣]+구)/);
  if (!match) return 'Seoul';
  const districtEn = SEOUL_DISTRICT_EN[match[1]];
  if (!districtEn) return addressStr;
  return `Seoul · ${districtEn}`;
}

export default function SearchOverlay({ open, onSelect, onClose, filterCount = 0, onFilterClick, places = [] }) {
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Mount / unmount with closing animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setQuery('');
      setResults([]);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 150);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus when overlay opens
  useEffect(() => {
    if (open && mounted && !closing) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open, mounted, closing]);

  // Debounced Kakao Places search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      clearTimeout(timerRef.current);
      return;
    }
    setSearching(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchPlacesByKeyword(trimmed);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  if (!mounted) return null;

  return (
    <div className={`absolute inset-0 z-40 flex flex-col bg-white ${closing ? 'search-overlay-out' : 'search-overlay-in'}`}>

      {/* ── Search bar — same layout as the default search bar ── */}
      <div className="shrink-0 px-4 pt-3.5 pb-3">
        <div className="flex h-[3.25rem] items-center gap-1 rounded-full bg-ink/[0.07] px-3">
          {/* Left: icon + input grouped — mirrors main search bar (pl-1 wrapper, gap-2.5) */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
            <PinIcon size={18} className="shrink-0 text-coral" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes, places…"
              className="flex-1 bg-transparent text-[0.95rem] font-medium text-ink placeholder:text-ink-faint outline-none"
            />
          </div>

          {/* Right: X (clears text or closes search mode) */}
          <button
            type="button"
            aria-label={query ? 'Clear' : 'Close search'}
            onClick={query ? () => setQuery('') : onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-ink-faint"
          >
            <CloseIcon size={16} />
          </button>

          {/* Right: filter button — matches main search bar style */}
          <button
            type="button"
            aria-label="Filters"
            onClick={onFilterClick}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft"
          >
            <FunnelIcon size={18} />
            {filterCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full border-2 border-white bg-ink px-1 text-[0.6rem] font-extrabold text-white">
                {filterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-1">
        {!query.trim() ? (
          <div className="mt-1 rounded-2xl bg-coral-tint px-4 py-3.5">
            <p className="text-[0.82rem] leading-relaxed text-ink-soft">
              Pick up to 3 food types, then search for any place in Seoul to discover matching restaurants nearby.
            </p>
          </div>
        ) : searching ? (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">Searching…</p>
        ) : results.length === 0 ? (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">No results</p>
        ) : (
          results.map((r) => {
            const isEnglish = locale === 'en';
            const matched = isEnglish ? findAnchorPlace(r, places) : null;
            const displayName = matched ? matched.name : r.place_name;
            const displayAddress = matched
              ? matched.address
              : formatSeoulDistrictAddress(r.address_name || r.road_address_name);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelect({
                    key: null,
                    label: r.place_name,
                    lat: Number(r.y),
                    lng: Number(r.x),
                    source: 'search',
                    address: r.address_name,
                    categoryGroupCode: r.category_group_code,
                  });
                }}
                className="mb-1 flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-ink/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-coral shadow-soft">
                  <PinIcon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-semibold text-ink">{displayName}</span>
                  {displayAddress && (
                    <span className="mt-0.5 block truncate text-[0.75rem] text-ink-faint">
                      {displayAddress}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
