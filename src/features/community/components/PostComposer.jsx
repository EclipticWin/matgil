import { useState, useEffect, useRef } from 'react';
import { cn } from '../../../shared/utils/classNames.js';
import Button from '../../../shared/components/Button.jsx';
import { CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { uploadPostImages } from '../services/communityService.js';

const WRITE_CATEGORIES = [
  { key: 'general',  label: 'General',  labelKo: '일반' },
  { key: 'question', label: 'Question', labelKo: '질문' },
  { key: 'review',   label: 'Review',   labelKo: '후기' },
  { key: 'tips',     label: 'Tips',     labelKo: '팁' },
  { key: 'food',     label: 'Food',     labelKo: '음식' },
  { key: 'routes',   label: 'Routes',   labelKo: '동선' },
];

export default function PostComposer({
  onSubmit,
  onClose,
  isEditing = false,
  initialContent = '',
  initialCategory = 'general',
  initialImageUrls = [],
  userId,
}) {
  const { locale, t } = useLocale();
  const [category, setCategory] = useState(initialCategory);
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [existingUrls, setExistingUrls] = useState(initialImageUrls ?? []);
  const [newFiles, setNewFiles] = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setContent(initialContent);
    setCategory(initialCategory || 'general');
    setError('');
    setBusy(false);
    setExistingUrls(initialImageUrls ?? []);
    setNewFiles([]);
    setNewPreviews([]);
  }, [initialContent, initialCategory]);

  useEffect(() => {
    const urls = newPreviews;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const totalCount = existingUrls.length + newFiles.length;
  const canSubmit = content.trim().length >= 2 && !busy;

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;

    const oversized = selected.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) { setError(t('community.imageTooLarge')); return; }

    const available = 3 - totalCount;
    if (selected.length > available) { setError(t('community.tooManyImages')); return; }

    setError('');
    const previews = selected.map((f) => URL.createObjectURL(f));
    setNewFiles((prev) => [...prev, ...selected]);
    setNewPreviews((prev) => [...prev, ...previews]);
  };

  const removeExisting = (idx) => {
    setExistingUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNew = (idx) => {
    URL.revokeObjectURL(newPreviews[idx]);
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setNewPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      let uploadedUrls = [];
      if (newFiles.length > 0 && userId) {
        uploadedUrls = await uploadPostImages(newFiles, userId);
      }
      const imageUrls = [...existingUrls, ...uploadedUrls];
      await onSubmit({ category, content: content.trim(), imageUrls });
    } catch (err) {
      const msg = err?.message || '';
      if (msg === 'tooMany' || msg.includes('many')) setError(t('community.tooManyImages'));
      else if (msg === 'tooLarge' || msg.includes('large')) setError(t('community.imageTooLarge'));
      else setError(t('community.uploadFailed'));
      setBusy(false);
    }
  };

  const title = isEditing ? t('community.editPost') : t('community.newPost');
  const submitLabel = isEditing
    ? (busy ? t('community.saving') : t('community.save'))
    : (busy ? t('community.posting') : t('community.post'));

  const hasImages = totalCount > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="animate-rise max-h-[92vh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
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

        {/* image section: thumbnails + add button */}
        {hasImages ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {/* existing image thumbnails */}
            {existingUrls.map((url, i) => (
              <div key={`ex-${i}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
                <button
                  type="button"
                  onClick={() => removeExisting(i)}
                  aria-label={t('community.removeImage')}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
            {/* new image thumbnails */}
            {newFiles.map((_, i) => (
              <div key={`new-${i}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <img src={newPreviews[i]} alt="" className="h-full w-full object-cover" draggable={false} />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  aria-label={t('community.removeImage')}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            ))}
            {/* add more button — thumbnail sized, dashed border */}
            {totalCount < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t('community.addPhotos')}
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-ink/20 text-ink/30"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          /* no images yet: text style add button */
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 flex items-center gap-1.5 text-[0.82rem] font-semibold text-ink-soft"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {t('community.addPhotos')}
            <span className="text-[0.72rem] font-normal text-ink-faint">
              {t('community.upTo3Images')}
            </span>
          </button>
        )}

        {/* always-present hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
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
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
