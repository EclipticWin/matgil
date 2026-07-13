import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../explore/components/Modal.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { BackIcon } from '../../../shared/components/Icon.jsx';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';

/** Account-deletion screen shown inside EditProfileSheet's own bottom-sheet view
 *  state (no route change). `onBusyChange` lets the parent sheet disable its own
 *  backdrop-close while a request is in flight, so tapping outside can't dismiss
 *  the sheet mid-deletion. */
export default function DeleteAccountView({ onBack, onBusyChange }) {
  const { t } = useLocale();
  const { deleteAccount, clearLocalSession } = useAuth();
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [busy, setBusyState] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState('');

  const setBusy = (next) => {
    setBusyState(next);
    onBusyChange?.(next);
  };

  // Case-sensitive on purpose — only whitespace is forgiving.
  const canDelete = confirmText.trim() === 'DELETE' && !busy;

  const handleBack = () => {
    if (busy) return;
    onBack();
  };

  const handleConfirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      setSucceeded(true);
      // Navigate away from MyPage first, then clear local session state — MyPage
      // itself redirects to /login the instant `user` becomes null, so clearing it
      // before leaving this page would flash the login screen instead of landing
      // on the app's home screen as intended.
      setTimeout(() => {
        navigate(ROUTES.home, { replace: true });
        clearLocalSession();
      }, 1400);
    } catch (err) {
      const status = err?.context?.status;
      setError(status === 401 ? t('my.deleteSessionExpired') : t('my.deleteFailure'));
      setBusy(false);
      setShowFinalConfirm(false);
    }
  };

  return (
    <div className="flex max-h-[80vh] flex-col overflow-y-auto">
      <div className="mb-4 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleBack}
          disabled={busy}
          aria-label="Back"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-soft disabled:opacity-50"
        >
          <BackIcon size={16} />
        </button>
        <h2 className="font-display text-xl font-bold text-ink">{t('my.deleteTitle')}</h2>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">{t('my.deleteIntro')}</p>

      <div className="mt-4 rounded-2xl bg-ink/5 p-4">
        <p className="text-sm font-bold text-ink">{t('my.deleteDataTitle')}</p>
        <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-soft">{t('my.deleteDataBody')}</p>
      </div>

      <div className="mt-3 rounded-2xl bg-ink/5 p-4">
        <p className="text-sm font-bold text-ink">{t('my.deleteReviewsTitle')}</p>
        <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-soft">{t('my.deleteReviewsBody')}</p>
      </div>

      <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-faint">{t('my.deleteSocialBody')}</p>

      <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-[0.8rem] leading-relaxed text-red-600">
        {t('my.deleteWarning')}
      </p>

      <label className="mb-1.5 mt-4 block text-sm font-semibold text-ink-soft">
        {t('my.deleteConfirmLabel')}
      </label>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        disabled={busy}
        placeholder={t('my.deleteConfirmPlaceholder')}
        className="w-full rounded-2xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-stone-400 focus:ring-1 focus:ring-stone-200 disabled:opacity-60"
      />

      {error && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>
      )}

      <div className="mb-1 mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={handleBack}
          disabled={busy}
          className="h-[3.25rem] flex-1 rounded-2xl border-[1.5px] border-ink/12 text-sm font-bold text-ink-soft disabled:opacity-50"
        >
          {t('my.deleteBack')}
        </button>
        <button
          type="button"
          onClick={() => setShowFinalConfirm(true)}
          disabled={!canDelete}
          className="h-[3.25rem] flex-1 rounded-2xl bg-red-600 text-sm font-bold text-white disabled:opacity-40"
        >
          {t('my.deleteButton')}
        </button>
      </div>

      <Modal
        open={showFinalConfirm}
        onClose={() => { if (!busy && !succeeded) setShowFinalConfirm(false); }}
        variant="center"
      >
        <div className="px-6 pb-6 pt-7 text-center">
          {succeeded ? (
            <p className="text-sm font-semibold text-ink">{t('my.deleteSuccess')}</p>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-ink">{t('my.deleteFinalConfirmTitle')}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t('my.deleteFinalConfirmBody')}</p>
              <div className="mt-6 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFinalConfirm(false)}
                  disabled={busy}
                  className="flex-1 rounded-2xl border-[1.5px] border-ink/12 py-3 text-sm font-bold text-ink-soft disabled:opacity-50"
                >
                  {t('my.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={busy}
                  className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner className="h-3.5 w-3.5 border-white/35 border-t-white" />
                      {t('my.deleting')}
                    </span>
                  ) : (
                    t('my.deleteConfirmButton')
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
