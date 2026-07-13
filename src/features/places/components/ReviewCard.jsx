import { useEffect, useRef, useState } from 'react';
import { StarIcon, UserIcon, MoreIcon } from '../../../shared/components/Icon.jsx';
import { formatSavedDate } from '../../../shared/utils/formatDate.js';
import ImageViewerModal from '../../community/components/ImageViewerModal.jsx';

const GRID_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

/** Photo grid for one review — 1 photo is shown wide, 2/3 photos as equal columns.
 *  A photo that fails to load is hidden entirely rather than showing a broken-image
 *  icon; the grid re-flows around whatever remains. Tapping a photo opens it in the
 *  shared full-screen viewer (reused from the community feature). */
function ReviewPhotoGrid({ images }) {
  const [brokenKeys, setBrokenKeys] = useState(() => new Set());
  const [viewerIndex, setViewerIndex] = useState(null);

  const visible = images.filter((img, i) => !brokenKeys.has(img.id ?? i));
  if (visible.length === 0) return null;

  return (
    <>
      <div className={`mt-2.5 grid gap-1.5 ${GRID_COLS[visible.length] ?? 'grid-cols-3'}`}>
        {visible.map((img, i) => (
          <button
            key={img.id ?? i}
            type="button"
            onClick={() => setViewerIndex(i)}
            className={`overflow-hidden rounded-2xl bg-ink/5 ${visible.length === 1 ? 'aspect-[16/10]' : 'aspect-square'}`}
          >
            <img
              src={img.url}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setBrokenKeys((prev) => new Set(prev).add(img.id ?? i))}
            />
          </button>
        ))}
      </div>
      {viewerIndex != null && (
        <ImageViewerModal
          imageUrls={visible.map((img) => img.url)}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}

// Lets an open menu tell every other ReviewCard instance to close itself —
// avoids lifting "which card's menu is open" state up to the list-rendering
// parent just for this one piece of UI coordination.
const CLOSE_MENUS_EVENT = 'matgil:review-card-close-menus';

/** Integer 1–5 badge (never "5.0") — a repeated 5-star row is too heavy for a
 *  single review's own score; the average/distribution at the top of the page
 *  is where stars still make sense. */
function RatingBadge({ rating }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-coral-tint px-2 py-0.5 text-[0.75rem] font-bold text-coral">
      <StarIcon size={9} />
      {rating}
    </span>
  );
}

/** Reused by both the in-sheet reviews preview and the full reviews page.
 *  The avatar+name block is a plain div for now — no real profile photos or a
 *  user-review-collection page exist yet, but this grouping is where a future
 *  click target would go. user_id may be null for a deleted account; the review
 *  still renders normally since author_name is a snapshot independent of it.
 *
 *  isOwn/onEdit/onDelete are optional — pass them only when the caller has
 *  already determined the current user owns this review. Callers only need to
 *  handle "open the composer in edit mode" / "show a delete-confirm modal" —
 *  this component owns the menu's own open/closed state and outside-click/Esc/
 *  other-card-closes-me behavior internally. */
export default function ReviewCard({ review, locale, t, isOwn = false, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const cardTokenRef = useRef({});

  // Close this card's menu if a different card just opened its own.
  useEffect(() => {
    function handleCloseOthers(e) {
      if (e.detail !== cardTokenRef.current) setMenuOpen(false);
    }
    window.addEventListener(CLOSE_MENUS_EVENT, handleCloseOthers);
    return () => window.removeEventListener(CLOSE_MENUS_EVENT, handleCloseOthers);
  }, []);

  // Outside click / Esc closes the menu while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  function handleMenuToggle() {
    if (!menuOpen) {
      window.dispatchEvent(new CustomEvent(CLOSE_MENUS_EVENT, { detail: cardTokenRef.current }));
    }
    setMenuOpen((prev) => !prev);
  }

  return (
    <div className="rounded-2xl border border-ink/5 bg-white/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink-faint">
          <UserIcon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-bold text-ink">
              {/* Server always stores the literal, locale-neutral "Deleted user" sentinel
                  for an anonymized review (see delete-my-account Edge Function) — display
                  the localized label instead of the raw sentinel string. */}
              {review.authorName === 'Deleted user' ? t('placeDetail.deletedUserAuthor') : review.authorName}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <RatingBadge rating={review.rating} />
              {isOwn && (
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={handleMenuToggle}
                    aria-label="More options"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint"
                  >
                    <MoreIcon size={15} />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-7 z-10 w-28 overflow-hidden rounded-xl border border-ink/8 bg-white shadow-card">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onEdit?.(review); }}
                        className="block w-full px-3.5 py-2.5 text-left text-sm font-semibold text-ink-soft"
                      >
                        {t('community.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onDelete?.(review); }}
                        className="block w-full px-3.5 py-2.5 text-left text-sm font-semibold text-red-600"
                      >
                        {t('community.delete')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-ink-faint">
            <span>{formatSavedDate(review.createdAt, locale)}</span>
            {review.editedAt && <span>· {t('placeDetail.edited')}</span>}
          </div>
        </div>
      </div>

      {review.images.length > 0 && <ReviewPhotoGrid images={review.images} />}

      {review.content && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-soft [text-wrap:pretty]">{review.content}</p>
      )}
    </div>
  );
}
