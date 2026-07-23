export const PRESET_LOCATIONS = [
  { key: 'city_hall',      label: 'Seoul City Hall', labelKo: '서울시청',    labelZh: '首尔市厅', lat: 37.5663, lng: 126.9779, type: 'landmark', districtKo: '중구' },
  { key: 'myeongdong',     label: 'Myeongdong',      labelKo: '명동',        labelZh: '明洞',     lat: 37.5636, lng: 126.9834, type: 'area', districtKo: '중구' },
  { key: 'hongdae',        label: 'Hongdae',          labelKo: '홍대',        labelZh: '弘大',     lat: 37.5563, lng: 126.9236, type: 'area', districtKo: '마포구' },
  { key: 'gangnam',        label: 'Gangnam',          labelKo: '강남',        labelZh: '江南',     lat: 37.4979, lng: 127.0276, type: 'area', districtKo: '강남구' },
  { key: 'seongsu',        label: 'Seongsu',          labelKo: '성수',        labelZh: '圣水洞',   lat: 37.5446, lng: 127.0557, type: 'area', districtKo: '성동구' },
  { key: 'jongno',         label: 'Jongno',           labelKo: '종로',        labelZh: '钟路',     lat: 37.5704, lng: 126.9922, type: 'area', districtKo: '종로구' },
  { key: 'gyeongbokgung',  label: 'Gyeongbokgung',   labelKo: '경복궁',      labelZh: '景福宫',   lat: 37.5796, lng: 126.9770, type: 'landmark', districtKo: '종로구' },
  { key: 'itaewon',        label: 'Itaewon',          labelKo: '이태원',      labelZh: '梨泰院',   lat: 37.5345, lng: 126.9946, type: 'area', districtKo: '용산구' },
  { key: 'dongdaemun',     label: 'Dongdaemun',       labelKo: '동대문',      labelZh: '东大门',   lat: 37.5700, lng: 127.0095, type: 'area', districtKo: '종로구' },
  { key: 'gwangjang_market', label: 'Gwangjang Market', labelKo: '광장시장', labelZh: '广藏市场', lat: 37.5701196320637, lng: 126.999798964693, type: 'area', aliases: ['Gwangjang'], kakaoSearchKeyword: '광장시장', districtKo: '종로구' },
  { key: 'yeouido',        label: 'Yeouido',          labelKo: '여의도',      labelZh: '汝矣岛',   lat: 37.5219, lng: 126.9246, type: 'area', districtKo: '영등포구' },
  { key: 'jamsil',         label: 'Jamsil',           labelKo: '잠실',        labelZh: '蚕室',     lat: 37.513859279255, lng: 127.101857941447, type: 'area', aliases: ['잠실역', 'Jamsil Station'], kakaoSearchKeyword: '잠실역', districtKo: '송파구' },
];

export const DEFAULT_LOCATION = PRESET_LOCATIONS[0];

export function calcDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortPlacesByDistance(places, location) {
  if (!location) return places;
  return [...places]
    .map((p) => ({
      ...p,
      distanceKm:
        p.latitude != null && p.longitude != null
          ? calcDistanceKm(location.lat, location.lng, p.latitude, p.longitude)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}
