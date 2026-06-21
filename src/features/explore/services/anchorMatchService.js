import { calcDistanceKm } from '../data/locations.js';

const GEO_THRESHOLD_KM = 0.15;
const ANCHOR_GROUP_CODES = new Set(['FD6', 'CB2']); // 음식점, 카페

export function isEligibleForAnchor(kakaoResult) {
  return ANCHOR_GROUP_CODES.has(kakaoResult?.category_group_code);
}

/**
 * Kakao 검색 결과가 FD6/CB2이고 우리 DB places와 좌표(150m) + 이름이 일치하면
 * 해당 DB place를 반환. 매칭 실패 시 null.
 *
 * Kakao는 항상 한국어 place_name을 반환한다. places가 EN locale로 로드된 경우
 * p.name이 영어라 직접 비교가 실패하므로, placeApi에서 추가된 p.nameKo(한국어 이름)도
 * 함께 비교해 EN 모드에서도 매칭이 깨지지 않도록 한다.
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

  // 2단계: 이름 매칭 — p.name(locale 기반) AND p.nameKo(항상 한국어) 모두 비교
  const nameMatches = geoMatches.filter((p) => {
    const dbName = (p.name ?? '').replace(/\s/g, '').toLowerCase();
    const dbNameKo = (p.nameKo ?? '').replace(/\s/g, '').toLowerCase();

    const matchesName =
      dbName &&
      (kakaoName === dbName || kakaoName.includes(dbName) || dbName.includes(kakaoName));

    const matchesNameKo =
      dbNameKo &&
      (kakaoName === dbNameKo || kakaoName.includes(dbNameKo) || dbNameKo.includes(kakaoName));

    return matchesName || matchesNameKo;
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
