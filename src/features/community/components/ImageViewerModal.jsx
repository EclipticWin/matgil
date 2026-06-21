import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export default function ImageViewerModal({ imageUrls, initialIndex = 0, onClose }) {
  const { t } = useLocale();
  const [idx, setIdx] = useState(Math.min(initialIndex, Math.max(0, imageUrls.length - 1)));
  const [scale, setScaleState] = useState(1);
  const scaleRef = useRef(1);
  const pinchStartScale = useRef(1);
  const pinchStartDist = useRef(null);
  const swipeStartX = useRef(null);
  const isPinching = useRef(false);

  const resetScale = useCallback(() => {
    scaleRef.current = 1;
    pinchStartScale.current = 1;
    setScaleState(1);
  }, []);

  const goTo = useCallback((i) => {
    setIdx(Math.min(Math.max(0, i), imageUrls.length - 1));
    resetScale();
  }, [imageUrls.length, resetScale]);

  useEffect(() => { resetScale(); }, [idx, resetScale]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      pinchStartDist.current = getTouchDist(e.touches);
      pinchStartScale.current = scaleRef.current;
      swipeStartX.current = null;
    } else if (e.touches.length === 1) {
      isPinching.current = false;
      swipeStartX.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchStartDist.current !== null) {
      const d = getTouchDist(e.touches);
      const newScale = Math.min(4, Math.max(1,
        pinchStartScale.current * (d / pinchStartDist.current)
      ));
      scaleRef.current = newScale;
      setScaleState(newScale);
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchStartDist.current = null;
    if (e.touches.length === 0) isPinching.current = false;
    if (
      !isPinching.current &&
      swipeStartX.current !== null &&
      scaleRef.current <= 1.05 &&
      e.changedTouches.length > 0
    ) {
      const dx = e.changedTouches[0].clientX - swipeStartX.current;
      if (Math.abs(dx) > 50) {
        setIdx((prev) => {
          if (dx < 0) return Math.min(prev + 1, imageUrls.length - 1);
          return Math.max(prev - 1, 0);
        });
        resetScale();
      }
      swipeStartX.current = null;
    }
  }, [imageUrls.length, resetScale]);

  return (
    /*
     * absolute inset-0 — nearest positioned ancestor is AppLayout's
     * `relative flex h-full flex-col`, which fills the full app frame.
     * The mobile frame has overflow-hidden so nothing bleeds outside.
     */
    <div
      className="absolute inset-0 z-[300] bg-black/75"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* vertically+horizontally centering wrapper */}
      <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden">

        {/* image box: w-full so image fills app frame width.
            relative so badge/X/arrows are positioned inside it. */}
        <div className="relative w-full">

          {/* image: block w-full h-auto — full width, height by aspect ratio.
              scale transform only here, never on wrapper or controls. */}
          <img
            key={idx}
            src={imageUrls[idx]}
            alt={`${idx + 1} / ${imageUrls.length}`}
            draggable={false}
            className="block h-auto w-full select-none touch-none"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
          />

          {/* badge: top-left of image */}
          {imageUrls.length > 1 && (
            <span className="absolute left-2 top-2 z-30 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] font-bold text-white">
              {idx + 1}/{imageUrls.length}
            </span>
          )}

          {/* X button: top-right of image */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('community.closeViewer')}
            className="absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <CloseIcon size={17} />
          </button>

          {/* prev arrow: left center of image */}
          {imageUrls.length > 1 && idx > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goTo(idx - 1); }}
              aria-label={t('community.prevImage')}
              className="absolute left-2 top-1/2 z-30 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xl font-bold leading-none text-white"
            >
              ‹
            </button>
          )}

          {/* next arrow: right center of image */}
          {imageUrls.length > 1 && idx < imageUrls.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goTo(idx + 1); }}
              aria-label={t('community.nextImage')}
              className="absolute right-2 top-1/2 z-30 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-xl font-bold leading-none text-white"
            >
              ›
            </button>
          )}
        </div>

        {/* dots: below image, small */}
        {imageUrls.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === idx ? 'bg-white' : 'bg-white/35'
                }`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
