import { useState } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { StarIcon } from '../../../shared/components/Icon.jsx';
import Button from '../../../shared/components/Button.jsx';
import { createPlaceReview } from '../services/placeReviewService.js';

const MAX_LENGTH = 1000;

/** Minimal 1st-cut review composer: rating (required) + optional content, up to
 *  1000 chars. No edit/delete/photos yet — those are later steps.
 *
 *  Layout is split into four clearly separate regions (rating / extra-info slot /
 *  content / actions) so future optional fields — price range, wait time, crowd
 *  level, service notes — can be added as their own block between the rating and
 *  content regions without restructuring this component. */
export default function ReviewComposer({ placeId, onSubmitted, onCancel }) {
  const { locale, t } = useLocale();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null); // 'rating' | 'duplicate' | 'generic' | null

  async function handleSubmit() {
    if (rating === 0) { setError('rating'); return; }
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await createPlaceReview({
        placeId,
        rating,
        content: content.trim(),
        uiLocale: locale,
      });
      onSubmitted(review);
    } catch (err) {
      setError(err?.code === '23505' ? 'duplicate' : 'generic');
    } finally {
      setSubmitting(false);
    }
  }

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

        {error && (
          <p className="mt-1 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {t(`placeDetail.${error === 'rating' ? 'ratingRequired' : error === 'duplicate' ? 'duplicateReview' : 'reviewSubmitError'}`)}
          </p>
        )}
      </div>

      {/* ── 액션 버튼 영역 ── */}
      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-[3.25rem] flex-1 rounded-2xl border-[1.5px] border-ink/12 text-sm font-bold text-ink-soft"
        >
          {t('auth.cancel')}
        </button>
        <Button variant="primary" className="flex-1" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('placeDetail.submitting') : t('placeDetail.submitReview')}
        </Button>
      </div>
    </div>
  );
}
