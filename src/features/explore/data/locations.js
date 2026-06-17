export const PRESET_LOCATIONS = [
  { key: 'city_hall',      label: 'Seoul City Hall', lat: 37.5663, lng: 126.9779, type: 'landmark' },
  { key: 'myeongdong',     label: 'Myeongdong',      lat: 37.5636, lng: 126.9834, type: 'area' },
  { key: 'hongdae',        label: 'Hongdae',          lat: 37.5563, lng: 126.9236, type: 'area' },
  { key: 'gangnam',        label: 'Gangnam',          lat: 37.4979, lng: 127.0276, type: 'area' },
  { key: 'seongsu',        label: 'Seongsu',          lat: 37.5446, lng: 127.0557, type: 'area' },
  { key: 'jongno',         label: 'Jongno',           lat: 37.5704, lng: 126.9922, type: 'area' },
  { key: 'gyeongbokgung',  label: 'Gyeongbokgung',   lat: 37.5796, lng: 126.9770, type: 'landmark' },
  { key: 'itaewon',        label: 'Itaewon',          lat: 37.5345, lng: 126.9946, type: 'area' },
  { key: 'dongdaemun',     label: 'Dongdaemun',       lat: 37.5700, lng: 127.0095, type: 'area' },
  { key: 'yeouido',        label: 'Yeouido',          lat: 37.5219, lng: 126.9246, type: 'area' },
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
