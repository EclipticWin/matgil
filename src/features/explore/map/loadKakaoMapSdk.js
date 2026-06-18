// Cached promise — prevents duplicate <script> insertion across re-renders / StrictMode double-invocation.
let sdkPromise = null;

/**
 * Dynamically loads the Kakao Maps JavaScript SDK and resolves after
 * kakao.maps.load() completes. Uses autoload=false so we control the timing.
 *
 * Rejects with Error('no-key') when VITE_KAKAO_MAP_JS_KEY is missing.
 * Rejects with Error('sdk-load-failed') when the script tag fails to load.
 */
export function loadKakaoMapSdk() {
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

  if (!key) {
    return Promise.reject(new Error('no-key'));
  }

  // SDK already fully loaded — resolve immediately without re-appending the script.
  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  // SDK is already loading — return the in-flight promise so callers share one load.
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;

    script.onload = () => {
      // kakao object exists now, but maps API is not ready until this callback fires.
      window.kakao.maps.load(resolve);
    };

    script.onerror = () => {
      sdkPromise = null; // allow retry on next call
      reject(new Error('sdk-load-failed'));
    };

    document.head.appendChild(script);
  });

  return sdkPromise;
}
