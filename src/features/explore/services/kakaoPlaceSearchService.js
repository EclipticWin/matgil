/**
 * Wraps window.kakao.maps.services.Places.keywordSearch in a Promise.
 * Requires the SDK to be loaded with &libraries=services.
 * Returns only results located in Seoul (address contains '서울').
 */
export function searchPlacesByKeyword(keyword) {
  return new Promise((resolve, reject) => {
    const services = window.kakao?.maps?.services;
    if (!services) {
      reject(new Error('kakao-services-not-loaded'));
      return;
    }
    const ps = new services.Places();
    ps.keywordSearch(keyword, (data, status) => {
      if (status === services.Status.OK) {
        const seoulOnly = data.filter((r) => {
          const addr = r.address_name ?? '';
          const roadAddr = r.road_address_name ?? '';
          return addr.startsWith('서울') || roadAddr.startsWith('서울');
        });
        resolve(seoulOnly);
      } else if (status === services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error('search-failed'));
      }
    });
  });
}
