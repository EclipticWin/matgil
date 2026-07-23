import { useEffect, useRef } from 'react';

/** Calls `onClose` on Escape only while `active` is true — scoped per-modal
 *  rather than one always-on listener, and independent of Modal.jsx (which has
 *  no built-in Escape handling for any variant, so adding it there would change
 *  every sheet/center modal's keyboard behavior at once). `onClose` is read
 *  through a ref (same idiom Modal.jsx's own `onCloseRef` already uses) so an
 *  inline arrow function passed fresh every render doesn't re-subscribe the
 *  listener each time. */
export function useEscapeToClose(active, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
