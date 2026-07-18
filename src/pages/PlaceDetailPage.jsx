import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { getPlaceById } from '../api/placeApi.js';
import PlaceDetailSheet from '../features/explore/components/PlaceDetailSheet.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** Full-screen place detail (`/places/:placeId`) — used from Saved Courses, where a
 *  stop card opens the place's own page instead of a bottom sheet (unlike Map, which
 *  keeps the existing PlaceDetailSheet bottom sheet — see docs/42/43).
 *
 *  Reuses PlaceDetailSheet as-is (menu/reviews/location/visit-info tabs, bookmark
 *  heart, review composer — all unchanged) rather than re-building a second detail
 *  UI. selectedLocation is intentionally not restored here: this page is about the
 *  place itself, not the route it was reached from, so no anchor-based distance line
 *  is shown (see PlaceDetailSheet's `dist` — it renders nothing without a location).
 *
 *  `placeId` (the URL param) + the current locale is always the source of truth
 *  (docs/44) — router state's `place` (the Saved-Course stop, which may carry
 *  another language's text) is used ONLY as an instant loading fallback so the page
 *  doesn't start on a blank spinner; the getPlaceById() fetch below always runs and
 *  its result always replaces the fallback once it resolves, and re-runs whenever
 *  `locale` changes so a language switch refreshes the name/menu/description/address
 *  instead of leaving the entry-route snapshot on screen. A direct/refreshed visit
 *  (no state, e.g. a shared link) has no fallback and just shows the spinner until
 *  the fetch resolves — the same lookup PlaceReviewsPage uses for its own deep-link
 *  case. */
export default function PlaceDetailPage() {
  const { placeId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { locale } = useLocale();

  const numericPlaceId = Number(placeId);
  const isValidId = Number.isInteger(numericPlaceId) && numericPlaceId > 0;

  const statePlace = isValidId && state?.place?.id === numericPlaceId ? state.place : null;
  // distanceKm on a stop reflects distance from the saved course's anchor at save
  // time — stripped here so PlaceDetailSheet doesn't render a stale/context-less
  // distance line on this route-agnostic page (see file header).
  const initialPlace = statePlace ? { ...statePlace, distanceKm: null } : null;

  const [place, setPlace] = useState(initialPlace);
  const [loading, setLoading] = useState(!initialPlace);
  const [notFound, setNotFound] = useState(!isValidId);

  useEffect(() => {
    if (!isValidId) { setNotFound(true); return; }
    let cancelled = false;
    // `place` here is whatever this component already has to show (the route-state
    // fallback, or an earlier locale's fetch result) — only used to decide whether a
    // spinner is needed, never to skip the fetch itself. Deliberately NOT a
    // dependency of this effect (only placeId/locale are): including it would make
    // every successful fetch re-trigger the effect and refetch forever.
    const hadFallback = !!place;
    if (!hadFallback) setLoading(true);
    getPlaceById(numericPlaceId, locale)
      .then((p) => {
        if (cancelled) return;
        if (p) { setPlace(p); setNotFound(false); }
        else if (!hadFallback) setNotFound(true);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!hadFallback) setNotFound(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [numericPlaceId, locale, isValidId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(ROUTES.courses);
  }

  if (notFound) return <Navigate to={ROUTES.courses} replace />;

  if (loading || !place) {
    return (
      <div className="flex h-full items-center justify-center bg-paper-soft">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  return (
    <div className="h-full bg-paper-soft">
      <PlaceDetailSheet place={place} selectedLocation={null} onBack={handleBack} />
    </div>
  );
}
