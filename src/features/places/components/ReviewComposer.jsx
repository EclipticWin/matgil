import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { StarIcon, CloseIcon } from '../../../shared/components/Icon.jsx';
import Button from '../../../shared/components/Button.jsx';
import {
  createPlaceReview,
  updatePlaceReview,
  uploadReviewImages,
  deleteReviewImage,
  validateReviewImageFile,
  REVIEW_IMAGE_MAX_COUNT,
} from '../services/placeReviewService.js';

const MAX_LENGTH = 1000;

/** Review composer — handles both creating a new review and editing the
 *  caller's own existing one. Pass `reviewId` (+ `initialRating`/`initialContent`/
 *  `initialImages`) to switch into edit mode; omit it to create.
 *
 *  Layout is split into four clearly separate regions (rating / extra-info slot /
 *  content / actions) so future optional fields — price range, wait time, crowd
 *  level, service notes — can be added as their own block between the rating and
 *  content regions without restructuring this component.
 *
 *  Photo flow: the review row is saved first (rating/content), then any newly
 *  selected files are uploaded to Storage + inserted into mg_place_review_images
 *  using the review's id. Existing photos are deleted immediately (Storage then
 *  DB row) when the user removes them, independent of the Save button. */
export default function ReviewComposer({
  placeId,
  reviewId = null,
  initialRating = 0,
  initialContent = '',
  initialImages = [],
  onSubmitted,
  onCancel,
}) {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const isEdit = reviewId != null;
  const [rating, setRating] = useState(initialRating);
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  // 'rating' | 'duplicate' | 'updateFailed' | 'generic' | 'invalidType' | 'tooLarge' | 'tooMany' | 'photoDeleteFailed' | null
  const [error, setError] = useState(null);

  const [existingImages, setExistingImages] = useState(initialImages);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [newItems, setNewItems] = useState([]); // { file, previewUrl }
  const fileInputRef = useRef(null);
  const newItemsRef = useRef(newItems);
  newItemsRef.current = newItems;

  // Revoke every pending object URL when the composer unmounts (edit cancelled,
  // submitted, or the parent swaps it out).
  useEffect(() => () => {
    newItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const photoCount = existingImages.length + newItems.length;
  const busy = submitting || uploadingPhotos;

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;

    const available = REVIEW_IMAGE_MAX_COUNT - photoCount;
    if (available <= 0) { setError('tooMany'); return; }
    if (selected.length > available) { setError('tooMany'); return; }

    for (const file of selected) {
      const invalid = validateReviewImageFile(file);
      if (invalid) { setError(invalid); return; }
    }

    setError(null);
    const items = selected.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setNewItems((prev) => [...prev, ...items]);
  }

  function removeNewItem(idx) {
    setNewItems((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function removeExistingImage(image) {
    if (deletingImageId != null || busy) return;
    setDeletingImageId(image.id);
    setError(null);
    try {
      await deleteReviewImage(image);
      setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch {
      setError('photoDeleteFailed');
    } finally {
      setDeletingImageId(null);
    }
  }

  async function handleSubmit() {
    if (rating === 0) { setError('rating'); return; }
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = isEdit
        ? await updatePlaceReview({ reviewId, rating, content: content.trim() })
        : await createPlaceReview({ placeId, rating, content: content.trim(), uiLocale: locale });

      let photosFailed = false;
      if (newItems.length > 0 && user) {
        setUploadingPhotos(true);
        const { uploaded, allSucceeded } = await uploadReviewImages({
          userId: user.id,
          reviewId: review.id,
          files: newItems.map((item) => item.file),
          startSortOrder: existingImages.length,
        });
        setUploadingPhotos(false);
        photosFailed = !allSucceeded;
        newItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        review.images = [...existingImages, ...uploaded];
      } else {
        review.images = existingImages;
      }

      onSubmitted(review, { photosFailed });
    } catch (err) {
      setUploadingPhotos(false);
      if (err?.code === '23505') setError('duplicate');
      else setError(isEdit ? 'updateFailed' : 'generic');
    } finally {
      setSubmitting(false);
    }
  }

  const errorKey = error === 'rating' ? 'ratingRequired'
    : error === 'duplicate' ? 'duplicateReview'
    : error === 'updateFailed' ? 'reviewUpdateFailed'
    : error === 'invalidType' ? 'unsupportedImageFormat'
    : error === 'tooLarge' ? 'photoTooLarge'
    : error === 'tooMany' ? 'tooManyPhotos'
    : error === 'photoDeleteFailed' ? 'photoDeleteFailed'
    : 'reviewSubmitError';

  const submitLabel = uploadingPhotos
    ? t('placeDetail.uploadingPhotos')
    : submitting
      ? t('placeDetail.submitting')
      : t(isEdit ? 'placeDetail.saveChanges' : 'placeDetail.submitReview');

  return (
    <div className="rounded-2xl border border-ink/8 bg-white/70 p-4">
      {/* ── 별점 영역 (필수) ── */}
      <div className="flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => { setRating(n); setError(null); }}
            aria-label={`${n} star`}
            className="p-0.5"
          >
            <StarIcon size={26} className={n <= rating ? 'text-coral' : 'text-ink/15'} />
          </button>
        ))}
      </div>

      {/* ── 향후 정보성 선택 항목 자리 (가격대·웨이팅·혼잡도·서비스 등) ──
          이번 작업에서는 구현하지 않는다. 필요해질 때 별점과 텍스트 영역 사이에
          독립된 블록으로 추가한다. */}

      {/* ── 텍스트 영역 (선택, 최대 1,000자) ── */}
      <div className="mt-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          maxLength={MAX_LENGTH}
          rows={4}
          placeholder={t('placeDetail.reviewPlaceholder')}
          className="w-full resize-none rounded-xl border border-ink/10 bg-white px-3.5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-stone-400"
        />
        <div className="mt-1 text-right text-[0.7rem] text-ink-faint">{content.length}/{MAX_LENGTH}</div>
      </div>

      {/* ── 사진 영역 (선택, 최대 3장) ── */}
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          {existingImages.map((img) => (
            <div key={img.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink/5">
              <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
              <button
                type="button"
                onClick={() => removeExistingImage(img)}
                disabled={busy || deletingImageId === img.id}
                aria-label={t('placeDetail.removeReviewPhoto')}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-50"
              >
                <CloseIcon size={11} />
              </button>
            </div>
          ))}
          {newItems.map((item, i) => (
            <div key={item.previewUrl} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink/5">
              <img src={item.previewUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              <button
                type="button"
                onClick={() => removeNewItem(i)}
                disabled={busy}
                aria-label={t('placeDetail.removeReviewPhoto')}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-50"
              >
                <CloseIcon size={11} />
              </button>
            </div>
          ))}
          {photoCount < REVIEW_IMAGE_MAX_COUNT && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label={t('placeDetail.addReviewPhotos')}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-ink/15 text-ink/30 disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[0.7rem] text-ink-faint">{t('placeDetail.upTo3Photos')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {error && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
          {t(`placeDetail.${errorKey}`)}
        </p>
      )}

      {/* ── 액션 버튼 영역 ── */}
      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-[3.25rem] flex-1 rounded-2xl border-[1.5px] border-ink/12 text-sm font-bold text-ink-soft"
        >
          {t('auth.cancel')}
        </button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
