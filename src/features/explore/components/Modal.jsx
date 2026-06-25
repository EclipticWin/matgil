import { useEffect, useRef, useState } from 'react';
import { findScrollParent } from '../../../shared/utils/dom.js';

const DRAG_THRESHOLD = 7;    // px vertical before tap becomes drag
const CLOSE_THRESHOLD = 80;  // px downward before release triggers close

/**
 * Overlay shell for bottom-sheet and center modals.
 *
 * Props:
 *  variant="sheet"   → slides up from the bottom
 *  variant="center"  → pops in centered
 *  fullHeight        → sheet occupies full height minus 12 px (covers floating search bar)
 *  draggableClose    → sheet can be dragged downward to dismiss (with threshold)
 */
export default function Modal({
  open,
  onClose,
  variant = 'sheet',
  fullHeight = false,
  draggableClose = false,
  children,
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  const sheetElRef = useRef(null);

  // Pointer-event gesture (desktop / mouse)
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);

  // Touch-event gesture (mobile / DevTools simulation)
  const isTouchActiveRef = useRef(false);
  const touchGestureRef = useRef(null);

  // Keep onClose current without re-running effects
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount / unmount with closing animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  // Touch event listeners attached imperatively so touchmove can be non-passive.
  // React's synthetic onTouchMove is passive and cannot call preventDefault to
  // stop the browser's scroll gesture — native addEventListener with passive:false can.
  useEffect(() => {
    if (!draggableClose || !mounted) return;
    const el = sheetElRef.current;
    if (!el) return;

    function onTouchStart(e) {
      isTouchActiveRef.current = true;
      suppressClickRef.current = false;
      const scrollEl = findScrollParent(e.target, el);
      touchGestureRef.current = {
        startY: e.touches[0].clientY,
        isDragging: false,
        scrollEl,
        scrollTopAtStart: scrollEl ? scrollEl.scrollTop : 0,
        currentOffset: 0,
      };
    }

    function onTouchMove(e) {
      const g = touchGestureRef.current;
      if (!g) return;

      const offset = e.touches[0].clientY - g.startY; // positive = finger moved down

      if (!g.isDragging) {
        if (Math.abs(offset) < DRAG_THRESHOLD) return;
        if (offset > 0) {
          // Swiping down — if content is scrolled, let browser scroll it up first
          if (g.scrollEl && g.scrollTopAtStart > 0) {
            touchGestureRef.current = null;
            return;
          }
          // scrollTop === 0: start drag-to-close
          g.isDragging = true;
          suppressClickRef.current = true;
        } else {
          // Swiping up: let browser scroll content down
          touchGestureRef.current = null;
          return;
        }
      }

      if (g.isDragging) {
        e.preventDefault(); // stop browser scroll during drag
        g.currentOffset = offset;
        const ty = Math.max(0, offset);
        el.style.transition = 'none';
        el.style.transform = `translateY(${ty}px)`;
      }
    }

    function onTouchEnd() {
      const g = touchGestureRef.current;
      touchGestureRef.current = null;
      isTouchActiveRef.current = false;

      if (!g || !g.isDragging) return;

      const offset = g.currentOffset;
      if (offset > CLOSE_THRESHOLD) {
        el.style.transition = '';
        el.style.transform = '';
        onCloseRef.current();
      } else {
        el.style.transition = 'transform 0.25s ease';
        el.style.transform = 'translateY(0)';
        setTimeout(() => {
          if (el) { el.style.transition = ''; el.style.transform = ''; }
        }, 250);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [draggableClose, mounted]);

  if (!mounted) return null;

  // ── Pointer-event drag handlers (desktop / mouse) ─────────────────────────

  function handlePointerDown(e) {
    if (!draggableClose || isTouchActiveRef.current) return;
    suppressClickRef.current = false;
    const scrollEl = findScrollParent(e.target, sheetElRef.current);
    gestureRef.current = {
      startY: e.clientY,
      isDragging: false,
      scrollEl,
      scrollTopAtStart: scrollEl ? scrollEl.scrollTop : 0,
      pointerId: e.pointerId,
      currentOffset: 0,
    };
  }

  function handlePointerMove(e) {
    if (!draggableClose || isTouchActiveRef.current) return;
    const g = gestureRef.current;
    if (!g) return;

    const offset = e.clientY - g.startY;

    if (!g.isDragging) {
      if (Math.abs(offset) < DRAG_THRESHOLD) return;

      if (offset > 0) {
        if (g.scrollEl && g.scrollTopAtStart > 0) {
          gestureRef.current = null;
          return;
        }
        g.isDragging = true;
        suppressClickRef.current = true;
        sheetElRef.current?.setPointerCapture(g.pointerId);
      } else {
        gestureRef.current = null;
        return;
      }
    }

    if (g.isDragging) {
      g.currentOffset = offset;
      const ty = Math.max(0, offset);
      if (sheetElRef.current) {
        sheetElRef.current.style.transition = 'none';
        sheetElRef.current.style.transform = `translateY(${ty}px)`;
      }
    }
  }

  function handlePointerUpCancel() {
    if (!draggableClose || isTouchActiveRef.current) return;
    const g = gestureRef.current;
    if (!g) return;

    if (g.isDragging) {
      const offset = g.currentOffset;
      if (offset > CLOSE_THRESHOLD) {
        if (sheetElRef.current) {
          sheetElRef.current.style.transition = '';
          sheetElRef.current.style.transform = '';
        }
        onClose();
      } else {
        const el = sheetElRef.current;
        if (el) {
          el.style.transition = 'transform 0.25s ease';
          el.style.transform = 'translateY(0)';
          setTimeout(() => {
            if (el) { el.style.transition = ''; el.style.transform = ''; }
          }, 250);
        }
      }
    }

    gestureRef.current = null;
  }

  function handleClickCapture(e) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  return (
    <div className={`absolute inset-0 z-40 ${closing ? 'modal-out' : 'modal-in'}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="modal-back absolute inset-0 cursor-default bg-ink/40"
      />
      {variant === 'sheet' ? (
        <div
          ref={sheetElRef}
          className={`modal-sheet absolute inset-x-0 bottom-0 flex select-none flex-col overflow-hidden rounded-t-[1.5rem] bg-paper-soft shadow-card${fullHeight ? '' : ' max-h-[84%]'}`}
          style={fullHeight ? { height: 'calc(100% - 12px)' } : undefined}
          onPointerDownCapture={handlePointerDown}
          onPointerMoveCapture={handlePointerMove}
          onPointerUpCapture={handlePointerUpCancel}
          onPointerCancelCapture={handlePointerUpCancel}
          onClickCapture={handleClickCapture}
        >
          {children}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-7">
          <div className="modal-center relative flex max-h-[76%] w-full max-w-[20rem] flex-col overflow-hidden rounded-[1.5rem] bg-paper-soft shadow-card">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
