import Modal from '../../explore/components/Modal.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Confirm-before-remove prompt for SavedCourseDetailPage's "Remove" CTA — same
 *  structural pattern as DeleteReviewConfirmModal (title/body/Cancel+confirm),
 *  but its own copy and a neutral (not full-red) confirm button, since removing
 *  a saved course is a lighter-weight, easily-re-saved action rather than a
 *  destructive review deletion. */
export default function RemoveSavedCourseConfirmModal({ open, onCancel, onConfirm, busy = false, failed = false }) {
  const { t } = useLocale();

  return (
    <Modal open={open} onClose={onCancel} variant="center">
      <div className="px-6 pb-6 pt-7 text-center">
        <p className="font-display text-lg font-bold text-ink">{t('savedCourses.removeConfirmTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('savedCourses.removeConfirmBody')}</p>
        {failed && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
            {t('savedCourses.removeFailed')}
          </p>
        )}
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-2xl border-[1.5px] border-ink/12 py-3 text-sm font-bold text-ink-soft disabled:cursor-default disabled:opacity-60"
          >
            {t('auth.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-2xl bg-coral py-3 text-sm font-bold text-white disabled:cursor-default disabled:opacity-60"
          >
            {busy ? t('savedCourses.removing') : t('savedCourses.remove')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
