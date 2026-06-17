import { useEffect, useState } from 'react';
import { getPlaces } from '../api/placeApi.js';
import PopularPlaceCard from '../features/popular/components/PopularPlaceCard.jsx';

export default function PopularPage() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPlaces('ko')
      .then((data) => { if (!cancelled) setPlaces(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-ink">인기 맛집</h1>
      <p className="mt-1 text-sm text-ink-soft">등록된 음식점 정보</p>

      {loading && (
        <p className="mt-10 text-center text-sm text-ink-soft">맛집 정보를 불러오는 중입니다.</p>
      )}
      {!loading && error && (
        <p className="mt-10 text-center text-sm text-ink-soft">
          맛집 정보를 불러오지 못했습니다.<br />잠시 후 다시 시도해 주세요.
        </p>
      )}
      {!loading && !error && places.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-soft">아직 등록된 맛집 정보가 없습니다.</p>
      )}
      {!loading && !error && places.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {places.map((place, i) => (
            <PopularPlaceCard key={place.id} place={place} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
