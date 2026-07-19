import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapSdk } from '../map/loadKakaoMapSdk.js';
import { PinIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const INITIAL_LEVEL = 5;
const CORAL = '#F8481F';


function makeMarkerContent(number) {
  return `<div style="
    width:28px;height:28px;border-radius:50%;
    background:${CORAL};color:#fff;
    font-size:13px;font-weight:700;line-height:1;
    display:flex;align-items:center;justify-content:center;
    border:2.5px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.28);
    pointer-events:none;
  ">${number}</div>`;
}

// Base location marker — plain blue teardrop pin, no white border/dot.
function makeLocationMarkerContent() {
  const blue = '#3B82F6';
  return `<div style="
    display:flex;flex-direction:column;align-items:center;
    pointer-events:none;
  ">
    <div style="
      width:22px;height:22px;border-radius:50%;
      background:${blue};
      box-shadow:0 1px 4px rgba(0,0,0,0.22);
    "></div>
    <div style="
      width:0;height:0;
      border-left:5px solid transparent;
      border-right:5px solid transparent;
      border-top:8px solid ${blue};
      margin-top:-1px;
    "></div>
  </div>`;
}

export default function KakaoMap({ selectedLocation, course, onMapMoved, mapApiRef }) {
  const { t } = useLocale();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const polylineRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const onMapMovedRef = useRef(onMapMoved);
  const [status, setStatus] = useState('idle'); // 'idle'|'loading'|'ready'|'no-key'|'error'

  // Keep ref in sync so the dragend listener always calls the latest callback
  useEffect(() => {
    onMapMovedRef.current = onMapMoved;
  }, [onMapMoved]);

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

        // Expose getCenter() to parent so it can read the latest map center on demand
        if (mapApiRef) {
          mapApiRef.current = {
            getCenter: () => {
              if (!mapRef.current) return null;
              const c = mapRef.current.getCenter();
              return { lat: c.getLat(), lng: c.getLng() };
            },
          };
        }

        // Signal parent that user dragged the map — no coords needed (parent reads on click)
        kakao.maps.event.addListener(map, 'dragend', () => {
          onMapMovedRef.current?.();
        });

        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(err.message === 'no-key' ? 'no-key' : 'error');
      });

    return () => {
      alive = false;
      clearOverlaysAndPolyline();
      if (locationMarkerRef.current) {
        locationMarkerRef.current.setMap(null);
        locationMarkerRef.current = null;
      }
      mapRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Centre map + update base location marker ───────────────────────
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const { kakao } = window;
    const center = new kakao.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
    mapRef.current.setCenter(center);

    // Remove old base marker and place a new one at the selected location.
    if (locationMarkerRef.current) {
      locationMarkerRef.current.setMap(null);
    }
    const overlay = new kakao.maps.CustomOverlay({
      position: center,
      content: makeLocationMarkerContent(),
      xAnchor: 0.5,
      yAnchor: 1.0, // pin tip (bottom of element) sits on the coordinate
      zIndex: 1,
    });
    overlay.setMap(mapRef.current);
    locationMarkerRef.current = overlay;
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

    // Straight-line polyline — always coral regardless of course accent.
    if (stops.length >= 2) {
      const path = stops.map((s) => new kakao.maps.LatLng(s.latitude, s.longitude));
      const polyline = new kakao.maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: CORAL,
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
            <span className="text-xs font-semibold uppercase tracking-wide">{t('nearby.mapUnavailable')}</span>
          </div>
        </div>
      )}
    </>
  );
}
