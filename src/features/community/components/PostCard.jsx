import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { CommentIcon, PinIcon, PencilIcon, CloseIcon } from '../../../shared/components/Icon.jsx';
import FavoriteHeartIcon from '../../../shared/components/FavoriteHeartIcon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../../../shared/utils/avatarColor.js';
import { ROUTES } from '../../../shared/constants/routes.js';
import { getWriteCategoryLabel } from '../data/communityConstants.js';
import ImageViewerModal from './ImageViewerModal.jsx';

export default function PostCard({
  post,
  index = 0,
  user = null,
  likedByMe = false,
  onEdit,
  onDelete,
  onLike,
  onToggleComments,
}) {
  const { t, locale } = useLocale();
  const [imgIdx, setImgIdx] = useState(0);
  const [errorUrls, setErrorUrls] = useState(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [bodyOverflowing, setBodyOverflowing] = useState(false);
  const bodyRef = useRef(null);
  const gradient = avatarGradient(post.userId || post.author);

  // Whether the collapsed (line-clamp-5) body actually truncates this post's
  // text — measured against the clamped element's own scrollHeight vs
  // clientHeight rather than counting characters/`\n`, since line-wrapping
  // depends on the card's real rendered width and font, not text length.
  // Only needs to run once per post (post.text never changes after mount;
  // toggling bodyExpanded doesn't need a re-measure since the overflow fact
  // itself doesn't change).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setBodyOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [post.text]);
  // normalizeDbPost() (communityService.js) stores the literal, locale-neutral
  // "Traveller" sentinel when a post has no author_name (same convention
  // ReviewCard.jsx uses for "Deleted user") — translated here at render time.
  const authorName = post.author === 'Traveller' ? t('community.travellerFallback') : post.author;
  const isDbPost = post.userId !== undefined;
  const isOwn = isDbPost && user && user.id === post.userId;
  // Liking is only ever blocked for a real reason — no backing DB post to like
  // (mock/fallback post), or it's the viewer's own post. NOT blocked merely for
  // being logged out: a logged-out click still needs to reach onLike(post), since
  // CommunityPage's handleLike is what shows the shared "please log in" prompt —
  // disabling the button here would silently swallow that click instead.
  const likeDisabled = !isDbPost || isOwn;
  const images = (post.imageUrls ?? []).filter((u) => typeof u === 'string' && u.startsWith('http'));
  const safeIdx = Math.min(imgIdx, Math.max(0, images.length - 1));
  // post.kind is normalizeDbPost()'s alias for the raw mg_community_posts.category
  // column (see communityService.js) — same label source PostComposer's own
  // category picker uses (communityConstants.js), so this never shows the raw DB
  // key and never duplicates the category→label mapping. Returns null for a
  // missing/unrecognized category (including mock posts, which have no real
  // category key in WRITE_CATEGORIES) — the category area is hidden in that case
  // rather than guessing a label.
  const categoryLabel = getWriteCategoryLabel(post.kind, locale);

  return (
    <>
      {viewerOpen && images.length > 0 && (
        <ImageViewerModal
          imageUrls={images}
          initialIndex={safeIdx}
          onClose={() => setViewerOpen(false)}
        />
      )}

      <Card className="p-4">
        {/* header */}
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-[1.0625rem] font-bold text-white`}
          >
            {authorName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9rem] font-bold text-ink">{authorName}</p>
            <p className="mt-px text-xs text-ink-faint">
              {post.from ? `${post.from} · ${post.ago}` : post.ago}
            </p>
          </div>
          {isOwn && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit?.(post)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink-soft"
                aria-label={t('community.edit')}
              >
                <PencilIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(post)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink-soft"
                aria-label={t('community.delete')}
              >
                <CloseIcon size={13} />
              </button>
            </div>
          )}
        </div>

        {/* body — collapsed to a 5-line preview by default; a post whose
            text doesn't actually overflow 5 lines (bodyOverflowing stays
            false) never shows the show more/less toggle at all. */}
        <div className="relative">
          <p
            ref={bodyRef}
            className={`whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink [text-wrap:pretty] ${
              bodyExpanded ? '' : 'line-clamp-5'
            }`}
          >
            {post.text}
          </p>
          {/* Faint fade hint that there's more below the 5-line cutoff — not
              shown once expanded, since the full text is on screen then. */}
          {bodyOverflowing && !bodyExpanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent" aria-hidden="true" />
          )}
        </div>
        {bodyOverflowing && (
          <button
            type="button"
            onClick={() => setBodyExpanded((prev) => !prev)}
            className="mt-1 text-[0.8125rem] font-bold text-ink-soft transition-colors active:text-ink"
          >
            {bodyExpanded ? t('community.showLess') : t('community.showMore')}
          </button>
        )}

        {/* images */}
        {images.length > 0 && (
          <div className="mt-3">
            {/* clickable image container — click opens viewer */}
            <div
              className="relative cursor-pointer overflow-hidden rounded-xl"
              onClick={() => setViewerOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setViewerOpen(true)}
              aria-label={t('community.images')}
            >
              {errorUrls.has(images[safeIdx]) ? (
                <div className="flex h-52 w-full items-center justify-center bg-ink/5 text-sm text-ink-faint">
                  {t('community.imageUnavailable')}
                </div>
              ) : (
                <img
                  src={images[safeIdx]}
                  alt=""
                  className="h-52 w-full object-cover"
                  draggable={false}
                  onError={() => setErrorUrls((prev) => new Set(prev).add(images[safeIdx]))}
                />
              )}

              {images.length > 1 && (
                <span className="absolute right-2 top-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[0.65rem] font-bold leading-tight text-white">
                  {safeIdx + 1}/{images.length}
                </span>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex justify-center gap-1.5 pt-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${i + 1}`}
                    onClick={() => setImgIdx(i)}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i === safeIdx ? 'bg-stone-500' : 'bg-stone-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {post.photo && !images.length && (
          <Thumbnail tint={post.tint} className="mt-3 h-[9.875rem] w-full" />
        )}

        {/* post.place is a plain string on mock posts (COMMUNITY_POSTS), or a
            real {id, name, address} place object on DB posts (normalizeDbPost) —
            only the object form is a clickable, navigable link. */}
        {post.place && typeof post.place === 'string' && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-[0.625rem] bg-coral-tint/60 px-2.5 py-1.5 text-[0.78rem] font-bold text-coral-deep">
            <PinIcon size={13} className="text-coral" /> {post.place}
          </div>
        )}
        {post.place && typeof post.place === 'object' && (
          <Link
            to={ROUTES.placeDetail(post.place.id)}
            state={{ place: post.place }}
            className="mt-3 flex items-center gap-2.5 rounded-xl bg-coral-tint/60 px-3 py-2.5"
          >
            <PinIcon size={14} className="shrink-0 text-coral" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.83rem] font-bold text-ink">{post.place.name}</span>
              {post.place.address && (
                <span className="block truncate text-[0.72rem] text-ink-faint">{post.place.address}</span>
              )}
            </span>
          </Link>
        )}

        {/* footer: like + comment group on the left, category on the right.
            Each button's own icon↔count gap stays gap-1.5 (unchanged); the
            gap between the two buttons (count↔comment icon) uses the left
            group's own gap-3. justify-between keeps the left group flush
            left and the category flush right with exactly one flex gap
            between them, regardless of whether the category is present. */}
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-ink/5 pt-3 text-[0.8125rem] font-semibold text-ink-soft">
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              disabled={likeDisabled}
              onClick={() => !likeDisabled && onLike?.(post)}
              className={`inline-flex items-center gap-1.5 transition-colors ${
                likedByMe ? 'text-coral' : !likeDisabled ? 'active:text-coral' : 'cursor-default'
              }`}
              title={isOwn ? t('community.ownPostNoLike') : undefined}
            >
              {/* FontAwesome's heart glyph fills more of its box than CommentIcon's
                  hand-drawn bubble does, so a visually-matched size sits a couple
                  px below CommentIcon's own size rather than at the same number. */}
              <FavoriteHeartIcon active={likedByMe} size={15} className="shrink-0" />
              <span className="leading-none">{post.likes}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleComments?.(post)}
              className="inline-flex items-center gap-1.5"
            >
              <CommentIcon size={17} className="shrink-0" />
              <span className="leading-none">{post.comments}</span>
            </button>
          </div>
          {categoryLabel && (
            <span className="min-w-0 truncate text-right font-normal text-ink-faint">
              {categoryLabel}
            </span>
          )}
        </div>
      </Card>
    </>
  );
}
