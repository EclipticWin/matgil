import { calcDistanceKm } from '../data/locations.js';

const GEO_THRESHOLD_KM = 0.15;
const ANCHOR_GROUP_CODES = new Set(['FD6', 'CB2']); // 음식점, 카페

export function isEligibleForAnchor(kakaoResult) {
  return ANCHOR_GROUP_CODES.has(kakaoResult?.category_group_code);
}

/**
 * Kakao 검색 결과가 FD6/CB2이고 우리 DB places와 좌표(150m) + 이름이 일치하면
 * 해당 DB place를 반환. 매칭 실패 시 null.
 */
export function findAnchorPlace(kakaoResult, places) {
  if (!isEligibleForAnchor(kakaoResult)) return null;

  const kakaoLat = Number(kakaoResult.y);
  const kakaoLng = Number(kakaoResult.x);
  const kakaoName = (kakaoResult.place_name ?? '').replace(/\s/g, '').toLowerCase();

  // 1단계: 좌표 150m 이내 후보
  const geoMatches = places.filter((p) => {
    if (p.latitude == null || p.longitude == null) return false;
    return calcDistanceKm(kakaoLat, kakaoLng, p.latitude, p.longitude) <= GEO_THRESHOLD_KM;
  });

  if (geoMatches.length === 0) return null;

  // 2단계: 이름 매칭 (공백 제거 후 포함 관계)
  const nameMatches = geoMatches.filter((p) => {
    const dbName = (p.name ?? '').replace(/\s/g, '').toLowerCase();
    return (
      kakaoName === dbName ||
      kakaoName.includes(dbName) ||
      dbName.includes(kakaoName)
    );
  });

  if (nameMatches.length === 0) return null;
  if (nameMatches.length === 1) return nameMatches[0];

  // 복수 후보 → 가장 가까운 place 선택
  return nameMatches.reduce((best, p) => {
    const d = calcDistanceKm(kakaoLat, kakaoLng, p.latitude, p.longitude);
    const bestD = calcDistanceKm(kakaoLat, kakaoLng, best.latitude, best.longitude);
    return d < bestD ? p : best;
  });
}
