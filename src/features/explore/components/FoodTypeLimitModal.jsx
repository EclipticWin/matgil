import { useEffect, useRef } from 'react';
import Modal from './Modal.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useEscapeToClose } from '../../../shared/hooks/useEscapeToClose.js';

/** Central "you already picked 3" notice for FilterSheet's food-type pills —
 *  replaces the old inline, auto-dismissing toast (see FilterSheet's own doc
 *  comment on catLimit handling) with a modal that stays open until the user
 *  actually acts on it. Reuses the shared Modal shell + useEscapeToClose the
 *  same way every other center notice in the app already does (compare
 *  AuthRequiredModal, JapaneseComingSoonModal) rather than inventing a new
 *  overlay pattern. `dismissOnBackdrop` covers the "click outside the card"
 *  close path; the card itself never triggers onClose since a click there
 *  never targets the backdrop wrapper. */
export default function FoodTypeLimitModal({ open, onClose }) {
  const { t } = useLocale();
  const confirmRef = useRef(null);
  useEscapeToClose(open, onClose);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} variant="center" dismissOnBackdrop>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-limit-title"
        aria-describedby="cat-limit-desc"
        className="px-6 pb-6 pt-7 text-center"
      >
        <p id="cat-limit-title" className="font-display text-lg font-bold text-ink">
          {t('filter.catLimitTitle')}
        </p>
        <p id="cat-limit-desc" className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t('filter.catLimit')}
        </p>
        <button
          ref={confirmRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-coral py-3 text-sm font-bold text-white"
        >
          {t('filter.catLimitConfirm')}
        </button>
      </div>
    </Modal>
  );
}
