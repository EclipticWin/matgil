import { useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 7;    // px vertical before tap becomes drag
const CLOSE_THRESHOLD = 80;  // px downward before release triggers close

/** Walk up the DOM from startEl to boundary returning first scrollable ancestor. */
function findScrollParent(startEl, boundary) {
  let node = startEl;
  while (node && node !== boundary) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

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

  // Drag-to-close refs (only used when draggableClose=true)
  const sheetElRef = useRef(null);
  const gestureRef = useRef(null); // { startY, isDragging, scrollEl, scrollTopAtStart, pointerId, currentOffset }
  const suppressClickRef = useRef(false);

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

  if (!mounted) return null;

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handlePointerDown(e) {
    if (!draggableClose) return;
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
    if (!draggableClose) return;
    const g = gestureRef.current;
    if (!g) return;

    const offset = e.clientY - g.startY; // positive = finger moved down

    if (!g.isDragging) {
      if (Math.abs(offset) < DRAG_THRESHOLD) return;

      if (offset > 0) {
        // Swiping down — check scroll conflict
        if (g.scrollEl && g.scrollTopAtStart > 0) {
          // Content scrolled: let browser scroll content upward
          gestureRef.current = null;
          return;
        }
        // scrollTop === 0: start drag-to-close
        g.isDragging = true;
        suppressClickRef.current = true;
        sheetElRef.current?.setPointerCapture(g.pointerId);
      } else {
        // Swiping up: let browser scroll content downward
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
    if (!draggableClose) return;
    const g = gestureRef.current;
    if (!g) return;

    if (g.isDragging) {
      const offset = g.currentOffset;
      if (offset > CLOSE_THRESHOLD) {
        // Reset inline style so modal-out CSS animation plays cleanly
        if (sheetElRef.current) {
          sheetElRef.current.style.transition = '';
          sheetElRef.current.style.transform = '';
        }
        onClose();
      } else {
        // Spring back to resting position
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
          className={`modal-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[1.5rem] bg-paper-soft shadow-card${fullHeight ? '' : ' max-h-[84%]'}`}
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
