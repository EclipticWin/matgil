import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { fetchSavedPlaces, removePlaceBookmark } from '../../places/services/placeBookmarkService.js';
import { fetchPlaceReviewStatsBatch } from '../../places/services/placeReviewService.js';
import { setLastPlaceView } from '../../explore/data/lastPlaceView.js';
import SavedPlaceCard from '../../places/components/SavedPlaceCard.jsx';
import EmptyState from '../../../shared/components/EmptyState.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { HeartIcon } from '../../../shared/components/Icon.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';

/** Courses page's "Saved Places" tab — the user's individually bookmarked places
 *  (mg_place_bookmarks), separate from Saved Routes. Tapping a card sends the user
 *  to the Map tab with a synthetic single-stop "course" wrapping just that place, via
 *  the same router-state channel SavedCourseDetailPage's "View on map" already uses —
 *  NearbySheet then opens straight to that place's detail sheet (see the initialCourse/
 *  initialPlaceId handling in NearbySheet.jsx). */
export default function SavedPlacesTab() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [places, setPlaces] = useState([]);
  const [statsById, setStatsById] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(false);

  const load = useCallback(() => {
    if (!user) { setPlaces([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    fetchSavedPlaces({ userId: user.id, locale })
      .then((rows) => {
        setPlaces(rows);
        const ids = rows.map((p) => p.id);
        fetchPlaceReviewStatsBatch(ids).then(setStatsById).catch(() => {});
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [user?.id, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // 사진 업로드 실패 배너와 동일한 패턴 — 잠시 보여준 뒤 자동으로 닫는다.
  useEffect(() => {
    if (!removeError) return;
    const timer = setTimeout(() => setRemoveError(false), 5000);
    return () => clearTimeout(timer);
  }, [removeError]);

  async function handleRemove(place) {
    if (removingId != null || !user) return;
    setRemovingId(place.id);
    setRemoveError(false);
    const snapshot = places;
    setPlaces((prev) => prev.filter((p) => p.id !== place.id)); // 낙관적 삭제
    try {
      await removePlaceBookmark({ placeId: place.id, userId: user.id });
    } catch {
      setPlaces(snapshot); // 실패 시 원복
      setRemoveError(true);
    } finally {
      setRemovingId(null);
    }
  }

  function handleOpen(place) {
    setLastPlaceView({ placeId: place.id });
    const singleStopCourse = {
      title: place.name || '',
      anchor_label: '',
      stops: [{ ...place, tint: '#FFE3D4' }],
      accent: '#F8481F',
    };
    navigate(ROUTES.home, { state: { savedCourse: singleStopCourse } });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-ink-faint">{t('savedPlaces.loadError')}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-ink/8 px-4 py-1.5 text-xs font-bold text-ink-soft"
        >
          {t('savedPlaces.retry')}
        </button>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <EmptyState
        className="mt-12"
        icon={<HeartIcon active size={22} />}
        title={t('savedPlaces.empty')}
        description={t('savedPlaces.emptyHint')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {removeError && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
          {t('savedPlaces.removeFailed')}
        </div>
      )}
      {places.map((place) => (
        <SavedPlaceCard
          key={place.id}
          place={place}
          reviewStats={statsById.get(place.id)}
          removing={removingId === place.id}
          onOpen={handleOpen}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
