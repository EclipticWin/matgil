import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import { HeartIcon, CommentIcon, PinIcon } from '../../../shared/components/Icon.jsx';

const AVATAR_GRADIENTS = [
  'from-amber to-coral',
  'from-[#5FB8E8] to-green',
  'from-[#B58BE0] to-coral',
  'from-green to-[#5FB8E8]',
];

/** A community post: author, body, optional photo + place chip, like/comment counts. */
export default function PostCard({ post, index = 0 }) {
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-[1.0625rem] font-bold text-white`}
        >
          {post.author.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="text-[0.9rem] font-bold text-ink">{post.author}</p>
          <p className="mt-px text-xs text-ink-faint">
            {post.from} · {post.ago}
          </p>
        </div>
      </div>

      <p className="text-[0.9rem] leading-relaxed text-ink [text-wrap:pretty]">{post.text}</p>

      {post.photo && <Thumbnail tint={post.tint} className="mt-3 h-[9.875rem] w-full" />}

      {post.place && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-[0.625rem] bg-coral-tint px-2.5 py-1.5 text-[0.78rem] font-bold text-coral-deep">
          <PinIcon size={13} className="text-coral" /> {post.place}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-[1.125rem] border-t border-ink/5 pt-3 text-[0.8125rem] font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <HeartIcon size={17} /> {post.likes}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CommentIcon /> {post.comments}
        </span>
      </div>
    </Card>
  );
}
