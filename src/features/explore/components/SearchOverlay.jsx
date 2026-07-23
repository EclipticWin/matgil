import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, FunnelIcon, PinIcon } from '../../../shared/components/Icon.jsx';
import { searchPlacesByKeyword } from '../services/kakaoPlaceSearchService.js';
import { buildMergedSearchResults, resolveKakaoSearchKeyword } from '../services/placeSearchService.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

export default function SearchOverlay({ open, onSelect, onClose, onFilterClick, places = [] }) {
  const { locale, t } = useLocale();
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // What the user actually typed — never rewritten, always what's shown in the
  // input and used for preset/internal-place search. Kakao is a separate leg
  // (see resolveKakaoSearchKeyword()): it may be called with a different,
  // Korean keyword than this, but this value itself is untouched either way.
  const [query, setQuery] = useState('');
  // Kakao's async leg only — { userQuery, data } so a response is only ever
  // used for the userQuery it actually answers (see `kakaoRaw` below), never
  // compared against the (possibly different) Korean keyword Kakao was called
  // with. preset/internal-place results are synchronous and don't need this.
  const [kakaoState, setKakaoState] = useState({ userQuery: '', data: [] });
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  // Bumped on every query change (and on reopen) so a Kakao response that
  // resolves after the user has already moved on — typed something else,
  // cleared the box, or closed the overlay — is discarded instead of
  // clobbering whatever is on screen for the current query.
  const requestSeqRef = useRef(0);

  // Mount / unmount with closing animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setQuery('');
      setKakaoState({ userQuery: '', data: [] });
      setSearching(false);
      requestSeqRef.current += 1;
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

  // Debounced Kakao Places search — preset/internal-place results are computed
  // synchronously in the `results` useMemo below and never wait on this.
  // Kakao itself is called with resolveKakaoSearchKeyword(trimmed), NOT the raw
  // user query — for a query that exactly matches a preset (in any locale, e.g.
  // "广藏市场"/"蚕室") this substitutes that preset's own Korean Kakao keyword,
  // since Kakao cannot search a zh-CN string at all and searches some ko/en
  // presets better with a dedicated keyword than their bare display name (see
  // resolveKakaoSearchKeyword()'s doc comment). Everything else about the
  // query — what's shown in the input, and what preset/internal-place search
  // and dedupe use below — stays the user's original, untouched `query`.
  useEffect(() => {
    const trimmed = query.trim();
    const mySeq = (requestSeqRef.current += 1);
    clearTimeout(timerRef.current);

    if (!trimmed) {
      setSearching(false);
      return;
    }

    setSearching(true);
    const kakaoQuery = resolveKakaoSearchKeyword(trimmed);
    timerRef.current = setTimeout(async () => {
      let data = [];
      try {
        data = await searchPlacesByKeyword(kakaoQuery);
      } catch {
        data = [];
      } finally {
        if (requestSeqRef.current === mySeq) {
          setKakaoState({ userQuery: trimmed, data });
          setSearching(false);
        }
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const trimmedQuery = query.trim();
  // Only trust kakaoState.data when it actually belongs to the current USER
  // query — never compared against the (possibly different) Kakao keyword it
  // was fetched with. Otherwise (query just changed, response for the old one
  // hasn't been discarded by the effect above yet) treat it as empty rather
  // than show a stale query's Kakao results next to the new query's
  // preset/internal ones.
  const kakaoRaw = kakaoState.userQuery === trimmedQuery ? kakaoState.data : [];
  const results = useMemo(
    () => (trimmedQuery ? buildMergedSearchResults({ query: trimmedQuery, locale, places, kakaoResults: kakaoRaw }) : []),
    [trimmedQuery, locale, places, kakaoRaw],
  );

  if (!mounted) return null;

  function handleResultClick(entry) {
    if (entry.resultType === 'preset') {
      // Raw preset object, untouched — no source/key/categoryGroupCode added,
      // so HomePage.handleSearchSelect() treats it exactly like a LocationSheet
      // preset pick (anchor=null, selectedLocation=the preset itself).
      onSelect(entry.raw);
      return;
    }
    if (entry.resultType === 'internal-place') {
      const place = entry.raw;
      onSelect({
        key: null,
        label: place.name,
        labelKo: place.nameKo,
        lat: place.latitude,
        lng: place.longitude,
        source: 'search',
        address: place.address,
        internalPlaceId: place.id,
      });
      return;
    }
    // kakao
    const r = entry.raw;
    if (entry.internalPlaceId != null) {
      onSelect({
        key: null,
        label: entry.displayName,
        labelKo: entry.matchedNameKo ?? r.place_name,
        lat: entry.lat,
        lng: entry.lng,
        source: 'search',
        address: entry.displayAddress,
        categoryGroupCode: r.category_group_code,
        internalPlaceId: entry.internalPlaceId,
      });
      return;
    }
    onSelect({
      key: null,
      label: r.place_name,
      lat: entry.lat,
      lng: entry.lng,
      source: 'search',
      // Road-name address preferred, falling back to the jibun address
      // (mg_saved_courses.anchor_address_original convention — see docs/42).
      address: r.road_address_name || r.address_name,
      categoryGroupCode: r.category_group_code,
    });
  }

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
              placeholder={t('nearby.searchPlaceholder')}
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
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-1">
        {!trimmedQuery ? (
          <div className="mt-1 rounded-2xl bg-coral-tint px-4 py-3.5">
            <p className="text-[0.82rem] leading-relaxed text-ink-soft">
              {t('search.guide')}
            </p>
          </div>
        ) : results.length > 0 ? (
          // Preset/internal-place results are already computed synchronously above,
          // so they render immediately even while the Kakao leg (searching===true)
          // is still in flight — a slow or zero-result Kakao response never hides
          // results the app already knows about.
          results.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleResultClick(entry)}
              className="mb-1 flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-ink/[0.04]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-coral shadow-soft">
                <PinIcon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] font-semibold text-ink">{entry.displayName}</span>
                {entry.displayAddress && (
                  <span className="mt-0.5 block truncate text-[0.75rem] text-ink-faint">
                    {entry.displayAddress}
                  </span>
                )}
              </span>
            </button>
          ))
        ) : searching ? (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">{t('search.searching')}</p>
        ) : (
          <p className="mt-6 text-center text-[0.85rem] text-ink-faint">{t('search.noResults')}</p>
        )}
      </div>
    </div>
  );
}
