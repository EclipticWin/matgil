import { useState } from 'react';
import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon, CommentIcon, PinIcon, PencilIcon, CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../../../shared/utils/avatarColor.js';
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
  const { t } = useLocale();
  const [imgIdx, setImgIdx] = useState(0);
  const [errorUrls, setErrorUrls] = useState(new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const gradient = avatarGradient(post.userId || post.author);
  const isDbPost = post.userId !== undefined;
  const isOwn = isDbPost && user && user.id === post.userId;
  const canLike = isDbPost && user && !isOwn;
  const images = (post.imageUrls ?? []).filter((u) => typeof u === 'string' && u.startsWith('http'));
  const safeIdx = Math.min(imgIdx, Math.max(0, images.length - 1));

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
            {post.author.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.9rem] font-bold text-ink">{post.author}</p>
            <p className="mt-px text-xs text-ink-faint">
              {post.from} · {post.ago}
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

        {/* body */}
        <p className="text-[0.9rem] leading-relaxed text-ink [text-wrap:pretty]">{post.text}</p>

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

        {post.place && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-[0.625rem] bg-coral-tint px-2.5 py-1.5 text-[0.78rem] font-bold text-coral-deep">
            <PinIcon size={13} className="text-coral" /> {post.place}
          </div>
        )}

        {/* footer: like + comment */}
        <div className="mt-3.5 flex items-center gap-[1.125rem] border-t border-ink/5 pt-3 text-[0.8125rem] font-semibold text-ink-soft">
          <button
            type="button"
            disabled={!canLike}
            onClick={() => canLike && onLike?.(post)}
            className={`inline-flex items-center gap-1.5 transition-colors ${
              likedByMe ? 'text-coral' : canLike ? 'active:text-coral' : 'cursor-default'
            }`}
            title={isOwn ? t('community.ownPostNoLike') : undefined}
          >
            <HeartIcon size={17} active={likedByMe} />
            {post.likes}
          </button>
          <button
            type="button"
            onClick={() => onToggleComments?.(post)}
            className="inline-flex items-center gap-1.5"
          >
            <CommentIcon size={17} />
            {post.comments}
          </button>
        </div>
      </Card>
    </>
  );
}
