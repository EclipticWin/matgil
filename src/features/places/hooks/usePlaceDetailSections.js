import { useEffect, useMemo, useState } from 'react';
import { getPlaceDetailSections } from '../../../api/placeDetailSectionApi.js';
import { PLACE_DETAIL_SECTION_FALLBACK } from '../data/placeDetailSectionFallback.js';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

// Module-level cache — the sections rarely change, so the first PlaceDetailSheet
// (or reviews page) mount in a session fetches once and every later mount reuses it.
let cachedPromise = null;

function loadSections() {
  if (!cachedPromise) {
    cachedPromise = getPlaceDetailSections().catch((err) => {
      cachedPromise = null; // allow a retry on the next mount
      throw err;
    });
  }
  return cachedPromise;
}

/** Loads place-detail section metadata (label / empty-state copy per locale,
 *  sort order, active flag) once per session, falling back to static data on
 *  failure or on an empty DB response. */
export function usePlaceDetailSections() {
  const [allSections, setAllSections] = useState(PLACE_DETAIL_SECTION_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSections()
      .then((sections) => {
        if (cancelled) return;
        setAllSections(sections.length > 0 ? sections : PLACE_DETAIL_SECTION_FALLBACK);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAllSections(PLACE_DETAIL_SECTION_FALLBACK);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeSections = useMemo(
    () =>
      allSections
        .filter((s) => s.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)),
    [allSections],
  );

  function getLabel(key, locale) {
    const translations = allSections.find((s) => s.key === key)?.translations ?? {};
    const labelByLocale = {};
    for (const [loc, translation] of Object.entries(translations)) labelByLocale[loc] = translation?.label;
    return pickTranslated(labelByLocale, locale) ?? key;
  }

  function getEmpty(key, locale) {
    const translations = allSections.find((s) => s.key === key)?.translations ?? {};
    const pick = pickTranslated(translations, locale) ?? {};
    return { title: pick.emptyTitle ?? '', description: pick.emptyDescription ?? '' };
  }

  return { activeSections, loading, getLabel, getEmpty };
}
