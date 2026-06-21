import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon, CommentIcon, PinIcon, PencilIcon, CloseIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';

const AVATAR_GRADIENTS = [
  'from-amber to-coral',
  'from-[#5FB8E8] to-green',
  'from-[#B58BE0] to-coral',
  'from-green to-[#5FB8E8]',
];

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
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const isDbPost = post.userId !== undefined;
  const isOwn = isDbPost && user && user.id === post.userId;
  const canLike = isDbPost && user && !isOwn;

  return (
    <Card className="p-4">
      {/* header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-[1.0625rem] font-bold text-white`}
        >
          {post.author.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
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

      {post.photo && <Thumbnail tint={post.tint} className="mt-3 h-[9.875rem] w-full" />}

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
  );
}
