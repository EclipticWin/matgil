import { useState, useEffect, useCallback } from 'react';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { fetchComments, createComment, deleteComment } from '../services/communityService.js';

const AVATAR_GRADIENTS = [
  'from-[#5FB8E8] to-green',
  'from-amber to-coral',
  'from-[#B58BE0] to-coral',
  'from-green to-[#5FB8E8]',
];

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

export default function PostCommentSection({ post, user, onLoginClick, onCommentAdded }) {
  const { t } = useLocale();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchComments(post.id);
      setComments(rows);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [post.id]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    const trimmed = newText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await createComment({ postId: post.id, userId: user.id, authorName: user.name, content: trimmed });
      setNewText('');
      await load();
      onCommentAdded?.();
    } catch {
      // silent — load will show current state
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('community.confirmDeleteComment'))) return;
    try {
      await deleteComment(id, user?.id);
      await load();
      onCommentAdded?.();
    } catch {
      // silent
    }
  };

  return (
    <div className="mx-5 -mt-1 rounded-b-2xl border border-t-0 border-ink/8 bg-white px-4 pb-4 pt-3">
      {/* comment list */}
      {loading ? (
        <p className="py-2 text-center text-xs text-ink-faint">…</p>
      ) : comments.length === 0 ? (
        <p className="py-2 text-center text-xs text-ink-faint">{t('community.noComments')}</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2.5">
          {comments.map((c, i) => (
            <li key={c.id} className="flex items-start gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} text-[0.7rem] font-bold text-white`}
              >
                {(c.author_name || t('community.travellerFallback')).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[0.8rem] font-bold text-ink">{c.author_name || t('community.travellerFallback')}</span>
                  <span className="text-[0.7rem] text-ink-faint">{timeAgo(c.created_at)}</span>
                  {user && user.id === c.user_id && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-[0.7rem] text-ink-faint underline-offset-2 hover:text-red-400"
                    >
                      {t('community.delete')}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[0.82rem] leading-snug text-ink [text-wrap:pretty]">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* input or login prompt */}
      {user ? (
        <div className="flex items-center gap-2 border-t border-ink/8 pt-3">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder={t('community.commentPlaceholder')}
            className="flex-1 rounded-xl border border-ink/10 bg-paper px-3 py-2 text-[0.85rem] text-ink outline-none placeholder:text-ink-faint focus:border-coral"
          />
          <button
            type="button"
            disabled={!newText.trim() || submitting}
            onClick={handleSubmit}
            className="shrink-0 rounded-xl bg-coral px-3 py-2 text-[0.8rem] font-bold text-white disabled:opacity-40"
          >
            {t('community.submitComment')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-ink/8 pt-3">
          <p className="text-[0.8rem] text-ink-soft">{t('community.loginToComment')}</p>
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded-xl bg-coral px-3 py-1.5 text-[0.8rem] font-bold text-white"
          >
            {t('community.login')}
          </button>
        </div>
      )}
    </div>
  );
}
