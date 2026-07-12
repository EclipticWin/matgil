import Modal from '../../explore/components/Modal.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

/** Shared confirm-before-delete prompt for a review, used by both the place
 *  detail sheet's Reviews preview and the full reviews page. */
export default function DeleteReviewConfirmModal({ open, onCancel, onConfirm, busy = false, failed = false }) {
  const { t } = useLocale();

  return (
    <Modal open={open} onClose={onCancel} variant="center">
      <div className="px-6 pb-6 pt-7 text-center">
        <p className="font-display text-lg font-bold text-ink">{t('placeDetail.deleteReviewTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('placeDetail.deleteReviewBody')}</p>
        {failed && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
            {t('placeDetail.reviewDeleteFailed')}
          </p>
        )}
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-2xl border-[1.5px] border-ink/12 py-3 text-sm font-bold text-ink-soft"
          >
            {t('auth.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {t('community.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
