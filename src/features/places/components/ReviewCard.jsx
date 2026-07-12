import { StarIcon, UserIcon } from '../../../shared/components/Icon.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { formatSavedDate } from '../../../shared/utils/formatDate.js';

function RatingStars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} size={11} className={i < rating ? 'text-coral' : 'text-ink/15'} />
      ))}
    </span>
  );
}

/** Reused by both the in-sheet reviews preview and the full reviews page.
 *  The avatar+name block is a plain div for now — no real profile photos or a
 *  user-review-collection page exist yet, but this grouping is where a future
 *  click target would go. user_id may be null for a deleted account; the review
 *  still renders normally since author_name is a snapshot independent of it. */
export default function ReviewCard({ review, locale, t }) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink-faint">
          <UserIcon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-bold text-ink">{review.authorName}</span>
            <RatingStars rating={review.rating} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-ink-faint">
            <span>{formatSavedDate(review.createdAt, locale)}</span>
            {review.editedAt && <span>· {t('placeDetail.edited')}</span>}
          </div>
        </div>
      </div>

      {review.content && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft [text-wrap:pretty]">{review.content}</p>
      )}

      {review.images.length > 0 && (
        <div className="mt-2.5 flex gap-2">
          {review.images.map((url, i) => (
            <Thumbnail key={i} src={url} className="h-16 w-16" />
          ))}
        </div>
      )}
    </div>
  );
}
