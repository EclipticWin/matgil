import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapSdk } from '../../explore/map/loadKakaoMapSdk.js';
import { PinIcon } from '../../../shared/components/Icon.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { cn } from '../../../shared/utils/classNames.js';

/** Minimal, provider-independent mini map for a single coordinate — the only
 *  responsibility is centering one marker on {latitude, longitude}. Kept separate
 *  from the main explore map (KakaoMap.jsx) so a future map-provider swap only
 *  has to touch this file plus KakaoMap.jsx, not the place detail screen. */
export default function PlaceLocationMap({ latitude, longitude, className }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading'|'ready'|'no-key'|'error'

  useEffect(() => {
    let alive = true;
    setStatus('loading');

    loadKakaoMapSdk()
      .then(() => {
        if (!alive || !containerRef.current) return;
        const { kakao } = window;
        const center = new kakao.maps.LatLng(latitude, longitude);
        const map = new kakao.maps.Map(containerRef.current, { center, level: 4 });
        mapRef.current = map;
        new kakao.maps.Marker({ position: center }).setMap(map);
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setStatus(err.message === 'no-key' ? 'no-key' : 'error');
      });

    return () => {
      alive = false;
      mapRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [latitude, longitude]);

  // This section is off-screen until the user scrolls to it, so Kakao's initial
  // size measurement can be stale — relayout once the container's box settles.
  useEffect(() => {
    const el = containerRef.current;
    if (status !== 'ready' || !el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout();
      mapRef.current?.setCenter(new window.kakao.maps.LatLng(latitude, longitude));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [status, latitude, longitude]);

  const showFallback = status === 'no-key' || status === 'error';

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ visibility: showFallback || status === 'loading' ? 'hidden' : 'visible' }}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/5">
          <Spinner className="h-5 w-5 border-ink/10 border-t-ink/30" />
        </div>
      )}
      {showFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/5">
          <PinIcon size={22} className="text-coral/40" />
        </div>
      )}
    </div>
  );
}
