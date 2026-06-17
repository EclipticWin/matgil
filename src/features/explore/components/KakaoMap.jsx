import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapSdk } from '../map/loadKakaoMapSdk.js';
import { PinIcon } from '../../../shared/components/Icon.jsx';

const INITIAL_LEVEL = 5;

function makeMarkerContent(number) {
  return `<div style="
    width:28px;height:28px;border-radius:50%;
    background:#F8481F;color:#fff;
    font-size:13px;font-weight:700;line-height:1;
    display:flex;align-items:center;justify-content:center;
    border:2.5px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.28);
    pointer-events:none;
  ">${number}</div>`;
}

export default function KakaoMap({ selectedLocation, course }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const polylineRef = useRef(null);
  const [status, setStatus] = useState('idle'); // 'idle'|'loading'|'ready'|'no-key'|'error'

  // ── Effect 1: SDK load + map initialisation (runs once on mount) ─────────────
  useEffect(() => {
    let alive = true;
    setStatus('loading');

    loadKakaoMapSdk()
      .then(() => {
        if (!alive || !containerRef.current) return;
        const { kakao } = window;
        const center = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
        const map = new kakao.maps.Map(containerRef.current, { center, level: INITIAL_LEVEL });
        mapRef.current = map;
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(err.message === 'no-key' ? 'no-key' : 'error');
      });

    return () => {
      alive = false;
      clearOverlaysAndPolyline();
      mapRef.current = null;
      // Clear the container so Kakao doesn't retain a stale map instance.
      // This also lets StrictMode's double-invocation recreate the map cleanly.
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Centre map on selectedLocation ──────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const center = new window.kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
    mapRef.current.setCenter(center);
  }, [selectedLocation, status]);

  // ── Effect 3: Render course stops as numbered markers + straight polyline ─────
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const { kakao } = window;

    clearOverlaysAndPolyline();

    const stops = (course?.stops ?? []).filter(
      (s) => s.latitude != null && s.longitude != null,
    );

    if (stops.length === 0) return;

    // Numbered CustomOverlay markers (1-based)
    stops.forEach((stop, i) => {
      const position = new kakao.maps.LatLng(stop.latitude, stop.longitude);
      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: makeMarkerContent(i + 1),
        xAnchor: 0.5,
        yAnchor: 0.5,
      });
      overlay.setMap(mapRef.current);
      overlaysRef.current.push(overlay);
    });

    // Straight-line polyline connecting stops in order.
    // This is a visual connection between recommended stops, not an actual walking route.
    if (stops.length >= 2) {
      const path = stops.map((s) => new kakao.maps.LatLng(s.latitude, s.longitude));
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: course?.accent ?? '#F8481F',
        strokeOpacity: 0.65,
        strokeStyle: 'solid',
      });
      polyline.setMap(mapRef.current);
      polylineRef.current = polyline;

      // Fit map to show all stops with 60px padding on each side.
      const bounds = new kakao.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.latitude, s.longitude)));
      mapRef.current.setBounds(bounds, 60);
    } else {
      // Single stop — just centre the map on it.
      mapRef.current.setCenter(new kakao.maps.LatLng(stops[0].latitude, stops[0].longitude));
    }
  }, [course, status]);

  function clearOverlaysAndPolyline() {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }

  // Fallback placeholder — matches existing "Map view" style
  const showFallback = status === 'no-key' || status === 'error';

  return (
    <>
      {/* Map container — kept in DOM during loading so Kakao can calculate dimensions */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ visibility: showFallback ? 'hidden' : 'visible' }}
      />
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-ink-faint/60">
            <PinIcon size={26} className="text-coral/40" />
            <span className="text-xs font-semibold uppercase tracking-wide">Map view</span>
          </div>
        </div>
      )}
    </>
  );
}
