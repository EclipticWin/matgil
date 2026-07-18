import { loadKakaoMapSdk } from '../map/loadKakaoMapSdk.js';

/**
 * Reverse-geocodes a lat/lng into a full address + a short district-level area
 * name + (when Kakao has one) a building/facility name, using the Kakao
 * services.Geocoder that ships with the same `libraries=services` bundle already
 * loaded for kakaoPlaceSearchService.
 *
 * Resolves `{ address, area, placeName }` (all nullable) on success, or `null` when
 * the SDK/key is unavailable or Kakao has no match for the coordinate — always
 * best-effort, never throws, so a failed lookup degrades to "no address/area/name"
 * rather than breaking the save flow (see mg_saved_courses.anchor_address_original /
 * anchor_area_original / anchor_name_original).
 *
 * `address` = full road-name address (falls back to the jibun address).
 * `area` = the original Korean 구 (district) name — display-side code (courseDisplay.js)
 * translates it to English via seoulDistricts.js when needed.
 * `placeName` = Kakao's road_address.building_name (a registered building/facility
 * name, e.g. an office tower) when the coordinate happens to fall inside one —
 * empty for most street-level points, which is expected (see courseDisplay.js's
 * getAnchorDisplayLocation() fallback to `address` when this is null).
 */
export function reverseGeocodeCoords(lat, lng) {
  return loadKakaoMapSdk()
    .then(() => {
      const services = window.kakao?.maps?.services;
      if (!services?.Geocoder) return null;

      return new Promise((resolve) => {
        const geocoder = new services.Geocoder();
        geocoder.coord2Address(lng, lat, (result, status) => {
          if (status !== services.Status.OK || !result?.[0]) {
            resolve(null);
            return;
          }
          const row = result[0];
          const road = row.road_address;
          const jibun = row.address;
          const address = road?.address_name || jibun?.address_name || null;
          const area = jibun?.region_2depth_name || road?.region_2depth_name || null;
          const placeName = road?.building_name?.trim() || null;
          resolve({ address, area, placeName });
        });
      });
    })
    .catch(() => null);
}
