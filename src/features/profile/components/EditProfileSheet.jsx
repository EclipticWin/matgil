import { useState } from 'react';
import Button from '../../../shared/components/Button.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

export default function EditProfileSheet({ currentName, onSave, onClose }) {
  const { t } = useLocale();
  const [name, setName] = useState(currentName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const canSave = trimmed.length >= 2 && trimmed.length <= 30 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await onSave(trimmed);
    } catch {
      setError(t('my.profileUpdateFailed'));
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="animate-rise rounded-t-3xl bg-paper px-5 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
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

        <label className="mb-1.5 block text-sm font-semibold text-ink-soft">
          {t('my.displayName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoFocus
          className="w-full rounded-2xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
          placeholder={t('my.displayName')}
        />
        <p className="mt-1 text-right text-xs text-ink-faint">{trimmed.length}/30</p>

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
      </div>
    </div>
  );
}
