import { useNavigate } from 'react-router-dom';
import Modal from '../../explore/components/Modal.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { navigateToLogin } from '../../../shared/utils/authRedirect.js';

/** Centered "please log in" prompt. Purely presentational — mounted/unmounted
 *  entirely by its caller (AuthPromptRenderer in App.jsx) based on whether a
 *  prompt is open, so this component never has to decide for itself whether
 *  to render an overlay. `bodyKey` picks the context-specific body copy
 *  (e.g. 'placeDetail.loginToSave'). `returnTo` is passed in as-is (captured
 *  by the caller when the prompt was opened — see useAuthPrompt.jsx) rather
 *  than read from useLocation() here, since this component can stay mounted
 *  while the app navigates elsewhere underneath it. */
export default function AuthRequiredModal({ open, onClose, bodyKey, returnTo }) {
  const navigate = useNavigate();
  const { t } = useLocale();

  return (
    <Modal open={open} onClose={onClose} variant="center">
      <div className="px-6 pb-6 pt-7 text-center">
        <p className="font-display text-lg font-bold text-ink">{t('auth.requiredTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t(bodyKey)}</p>
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border-[1.5px] border-ink/12 py-3 text-sm font-bold text-ink-soft"
          >
            {t('auth.cancel')}
          </button>
          <button
            type="button"
            onClick={() => { onClose(); navigateToLogin(navigate, returnTo); }}
            className="flex-1 rounded-2xl bg-coral py-3 text-sm font-bold text-white"
          >
            {t('auth.login')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
