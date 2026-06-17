import { useEffect, useState } from 'react';

/**
 * Overlay shell that mirrors the web app's modals:
 *  - variant="sheet"  → slides up from the bottom (filters)
 *  - variant="center" → pops in centered (language)
 * Mounts on `open`, plays the close animation before unmounting. The backdrop
 * and panel carry `modal-back` / `modal-sheet` / `modal-center` classes that
 * the keyframes in index.css animate via the `modal-in` / `modal-out` parent.
 */
export default function Modal({ open, onClose, variant = 'sheet', children }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

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

  return (
    <div className={`absolute inset-0 z-40 ${closing ? 'modal-out' : 'modal-in'}`}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="modal-back absolute inset-0 cursor-default bg-ink/40"
      />
      {variant === 'sheet' ? (
        <div className="modal-sheet absolute inset-x-0 bottom-0 flex max-h-[84%] flex-col overflow-hidden rounded-t-[1.5rem] bg-paper-soft shadow-card">
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
