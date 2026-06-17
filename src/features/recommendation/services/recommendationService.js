import { getPlaces } from '../../../api/placeApi.js';

export async function getRecommendation({ area }) {
  const places = await getPlaces('ko');

  // MVP: 저장된 음식점 앞 3개를 추천 결과로 사용
  const stops = places.slice(0, 3);
  const stopCount = stops.length;

  return {
    title: `${area?.name || 'Seoul'} Food Course`,
    area: area?.name || 'Seoul',
    stops,
    stopCount,
    distance: `${(0.4 * stopCount).toFixed(1)} km`,
    duration: `~${stopCount * 30} min`,
  };
}
