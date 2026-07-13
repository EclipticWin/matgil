import { useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useNicknameAvailability } from '../../auth/hooks/useNicknameAvailability.js';
import DeleteAccountView from './DeleteAccountView.jsx';

export default function EditProfileSheet({ currentName, onSave, onClose }) {
  const { t } = useLocale();
  const [view, setView] = useState('edit'); // 'edit' | 'delete'
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [name, setName] = useState(currentName || '');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const nameValid = trimmed.length >= 2 && trimmed.length <= 20;
  const nicknameStatus = useNicknameAvailability(name, { excludeCurrent: currentName || '' });
  const pwEmpty = newPw === '' && confirmPw === '';
  const pwTooShort = newPw.length > 0 && newPw.length < 6;
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const pwValid = newPw.length >= 6 && newPw === confirmPw;
  const canSave = nameValid && nicknameStatus !== 'taken' && (pwEmpty || pwValid) && !busy;

  let pwError = '';
  if (pwTooShort) pwError = t('my.passwordTooShort');
  else if (pwMismatch) pwError = t('my.passwordMismatch');

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ displayName: trimmed, newPassword: pwEmpty ? '' : newPw });
    } catch (err) {
      setError(err?.code === '23505' ? t('signup.nicknameTaken') : t('my.profileUpdateFailed'));
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30"
      onClick={() => { if (!deleteBusy) onClose(); }}
    >
      <div
        className="animate-rise rounded-t-3xl bg-paper px-5 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        {view === 'delete' ? (
          <DeleteAccountView onBack={() => setView('edit')} onBusyChange={setDeleteBusy} />
        ) : (
        <>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{t('my.editProfile')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink-soft"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Nickname */}
        <label className="mb-1.5 block text-sm font-semibold text-ink-soft">
          {t('my.displayName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          className="w-full rounded-2xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
          placeholder={t('my.displayName')}
        />
        <div className="mt-1 flex items-center justify-between px-0.5">
          <p className="text-xs text-ink-faint">
            {nicknameStatus === 'taken'
              ? <span className="text-red-600">{t('signup.nicknameTaken')}</span>
              : nicknameStatus === 'checking'
                ? t('signup.nicknameChecking')
                : ''}
          </p>
          <p className="text-xs text-ink-faint">{trimmed.length}/20</p>
        </div>

        {/* Divider */}
        <div className="my-4 border-t border-stone-100" />

        {/* Password */}
        <label className="mb-1.5 block text-sm font-semibold text-ink-soft">
          {t('my.newPassword')}
        </label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="w-full rounded-2xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
          placeholder="6자 이상"
        />

        <label className="mb-1.5 mt-2.5 block text-sm font-semibold text-ink-soft">
          {t('my.confirmPassword')}
        </label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          className="w-full rounded-2xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
          placeholder={t('my.confirmPassword')}
        />

        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => setView('delete')}
            className="text-xs font-semibold text-ink-faint"
          >
            {t('my.deleteLearnMore')}
          </button>
        </div>

        {pwError && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {pwError}
          </p>
        )}

        {error && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('my.cancel')}
          </Button>
          <Button className="flex-1" disabled={!canSave} onClick={handleSave}>
            {busy ? t('my.saving') : t('my.save')}
          </Button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
