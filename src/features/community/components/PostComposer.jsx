import { useState } from 'react';
import { cn } from '../../../shared/utils/classNames.js';
import Button from '../../../shared/components/Button.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const WRITE_CATEGORIES = [
  { key: 'question', label: 'Question', labelKo: '질문' },
  { key: 'review',   label: 'Review',   labelKo: '후기' },
  { key: 'tips',     label: 'Tips',     labelKo: '팁' },
  { key: 'food',     label: 'Food',     labelKo: '음식' },
  { key: 'routes',   label: 'Routes',   labelKo: '동선' },
  { key: 'general',  label: 'General',  labelKo: '일반' },
];

export default function PostComposer({ onSubmit, onClose }) {
  const { locale, t } = useLocale();
  const [category, setCategory] = useState('general');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canSubmit = content.trim().length >= 5 && !busy;

  const handlePost = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ category, content: content.trim() });
    } catch (err) {
      setError(err.message || 'Failed to post. Please try again.');
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
          <h2 className="font-display text-xl font-bold text-ink">{t('community.newPost')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink-soft"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="category-scroll mb-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
          <div className="flex min-w-max gap-2">
            {WRITE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={cn(
                  'h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[0.8125rem] font-bold transition-colors',
                  category === cat.key ? 'bg-coral text-white' : 'bg-white text-ink-soft shadow-soft',
                )}
              >
                {locale === 'ko' ? (cat.labelKo ?? cat.label) : cat.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          autoFocus
          placeholder={t('community.composePlaceholder')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full resize-none rounded-2xl border-[1.5px] border-ink/10 bg-white p-4 text-[0.95rem] text-ink outline-none placeholder:text-ink-faint focus:border-coral"
        />

        {error && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t('community.cancel')}
          </Button>
          <Button className="flex-1" disabled={!canSubmit} onClick={handlePost}>
            {busy ? t('community.posting') : t('community.post')}
          </Button>
        </div>
      </div>
    </div>
  );
}
