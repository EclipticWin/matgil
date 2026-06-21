import { useState, useEffect, useCallback } from 'react';
import { CloseIcon, HeartIcon } from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import {
  fetchComments,
  createComment,
  deleteComment,
  fetchLikedCommentIds,
  likeComment,
  unlikeComment,
} from '../services/communityService.js';

const AVATAR_GRADIENTS = [
  'from-[#5FB8E8] to-green',
  'from-amber to-coral',
  'from-[#B58BE0] to-coral',
  'from-green to-[#5FB8E8]',
];

function stableIdx(str, len) {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

export default function CommentBottomSheet({ post, user, onClose, onCommentAdded, onLoginClick }) {
  const { locale, t } = useLocale();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, authorName } | null
  const [submitting, setSubmitting] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchComments(post.id);
      setComments(rows);
      if (user && rows.length > 0) {
        const liked = await fetchLikedCommentIds(user.id, rows.map((r) => r.id));
        setLikedCommentIds(liked);
      } else {
        setLikedCommentIds(new Set());
      }
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [post.id, user]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    const trimmed = newText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await createComment({
        postId: post.id,
        userId: user.id,
        authorName: user.name,
        content: trimmed,
        parentCommentId: replyTo?.id ?? null,
      });
      setNewText('');
      setReplyTo(null);
      await loadComments();
      onCommentAdded?.();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment) => {
    if (!window.confirm(t('community.confirmDeleteComment'))) return;
    try {
      await deleteComment(comment.id, user.id);
      await loadComments();
      onCommentAdded?.();
    } catch {
      // silent
    }
  };

  const handleLikeComment = async (comment) => {
    if (!user) { onLoginClick?.(); return; }
    if (comment.user_id === user.id) return; // 내 댓글 좋아요 불가
    const alreadyLiked = likedCommentIds.has(String(comment.id));
    setLikedCommentIds((prev) => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(String(comment.id)) : next.add(String(comment.id));
      return next;
    });
    try {
      if (alreadyLiked) {
        await unlikeComment(comment.id, user.id);
      } else {
        await likeComment(comment.id, user.id);
      }
      await loadComments();
    } catch {
      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        alreadyLiked ? next.add(String(comment.id)) : next.delete(String(comment.id));
        return next;
      });
    }
  };

  // Build 1-depth thread
  // fetchComments only returns non-deleted comments.
  // Replies whose parent was deleted will appear in repliesMap but not in roots.
  const roots = comments.filter((c) => !c.parent_comment_id);
  const rootIds = new Set(roots.map((r) => String(r.id)));
  const repliesMap = {};
  comments.forEach((c) => {
    if (c.parent_comment_id) {
      const key = String(c.parent_comment_id);
      if (!repliesMap[key]) repliesMap[key] = [];
      repliesMap[key].push(c);
    }
  });
  // Parent IDs that have replies but whose parent comment is deleted (not in roots)
  const orphanedParentIds = Object.keys(repliesMap).filter((pid) => !rootIds.has(pid));

  const replyPlaceholder = replyTo
    ? locale === 'ko'
      ? `${replyTo.authorName}님에게 답글 쓰기…`
      : `Reply to ${replyTo.authorName}…`
    : t('community.commentPlaceholder');

  const renderComment = (comment, isReply) => {
    const liked = likedCommentIds.has(String(comment.id));
    const isOwn = user && user.id === comment.user_id;
    const canLike = !!user && !isOwn;
    const gradient = AVATAR_GRADIENTS[stableIdx(
      String(comment.user_id || '') || comment.author_name || '',
      AVATAR_GRADIENTS.length,
    )];

    return (
      <div key={comment.id} className={`flex items-start gap-2.5${isReply ? ' ml-9' : ''}`}>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[0.75rem] font-bold text-white`}
        >
          {(comment.author_name || 'T').charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[0.82rem] font-bold text-ink">
              {comment.author_name || 'Traveller'}
            </span>
            <span className="text-[0.72rem] text-ink-faint">{timeAgo(comment.created_at)}</span>
            {isOwn && (
              <button
                type="button"
                onClick={() => handleDeleteComment(comment)}
                className="text-[0.72rem] text-ink-faint"
              >
                {t('community.delete')}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[0.85rem] leading-snug text-ink [text-wrap:pretty]">
            {comment.content}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              disabled={!canLike}
              onClick={() => canLike && handleLikeComment(comment)}
              title={isOwn ? t('community.ownCommentNoLike') : undefined}
              className={`inline-flex items-center gap-1 text-[0.75rem] font-semibold transition-colors ${
                liked ? 'text-coral' : canLike ? 'text-ink-soft' : 'cursor-default text-ink/30'
              }`}
            >
              <HeartIcon size={13} active={liked} />
              {comment.like_count ?? 0}
            </button>
            {!isReply && user && (
              <button
                type="button"
                onClick={() =>
                  setReplyTo({ id: comment.id, authorName: comment.author_name || 'Traveller' })
                }
                className="text-[0.75rem] font-semibold text-ink-soft"
              >
                {t('community.reply')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDeletedPlaceholder = (replies) => (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10">
          <span className="text-[0.75rem] text-ink-faint">–</span>
        </div>
        <p className="text-[0.82rem] italic text-ink-faint">{t('community.deletedComment')}</p>
      </div>
      {replies.map((reply) => (
        <div key={reply.id} className="mt-2">
          {renderComment(reply, true)}
        </div>
      ))}
    </div>
  );

  const hasAnyComments = roots.length > 0 || orphanedParentIds.length > 0;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="animate-rise flex max-h-[82vh] flex-col rounded-t-3xl bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <h2 className="font-display text-lg font-bold text-ink">
            {t('community.comments')}
            {comments.length > 0 && (
              <span className="ml-1.5 text-sm font-normal text-ink-soft">({comments.length})</span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink-soft"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* scrollable comment list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-faint">…</p>
          ) : !hasAnyComments ? (
            <p className="py-8 text-center text-sm text-ink-faint">
              {t('community.beFirstToComment')}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {roots.map((root) => (
                <div key={root.id}>
                  {renderComment(root, false)}
                  {repliesMap[String(root.id)]?.map((reply) => (
                    <div key={reply.id} className="mt-2">
                      {renderComment(reply, true)}
                    </div>
                  ))}
                </div>
              ))}
              {orphanedParentIds.map((pid) =>
                renderDeletedPlaceholder(repliesMap[pid])
              )}
            </div>
          )}
        </div>

        {/* reply indicator */}
        {replyTo && (
          <div className="flex items-center gap-2 border-t border-ink/8 bg-ink/[0.025] px-5 py-2">
            <span className="flex-1 truncate text-xs text-ink-soft">
              {locale === 'ko'
                ? `${replyTo.authorName}님에게 답글`
                : `Reply to ${replyTo.authorName}`}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 text-xs font-semibold text-coral"
            >
              {t('community.cancelReply')}
            </button>
          </div>
        )}

        {/* input area — pb-4 to match pt-3, avoids excess white space */}
        <div className="flex-none border-t border-ink/8 px-5 pb-4 pt-3">
          {user ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder={replyPlaceholder}
                className="flex-1 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-[0.875rem] text-ink outline-none placeholder:text-ink-faint focus:border-coral"
              />
              <button
                type="button"
                disabled={!newText.trim() || submitting}
                onClick={handleSubmit}
                className="shrink-0 rounded-xl bg-coral px-3.5 py-2.5 text-[0.8rem] font-bold text-white disabled:opacity-40"
              >
                {t('community.submitComment')}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-soft">{t('community.loginToComment')}</p>
              <button
                type="button"
                onClick={onLoginClick}
                className="rounded-xl bg-coral px-4 py-2 text-sm font-bold text-white"
              >
                {t('community.login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
