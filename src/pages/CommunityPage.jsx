import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { COMMUNITY_POSTS, filterPosts } from '../features/community/data/communityPosts.js';
import { fetchPosts, createPost } from '../features/community/services/communityService.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import PostComposer from '../features/community/components/PostComposer.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { ROUTES } from '../shared/constants/routes.js';

const POST_TINTS = ['#FFE3D4', '#FFEFC9', '#E6E9F7', '#E2F1DE'];

function normalizeDbPost(p, i) {
  const diff = Date.now() - new Date(p.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  const ago =
    mins < 60
      ? `${Math.max(1, mins)}m`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h`
        : `${Math.floor(mins / 1440)}d`;
  return {
    id: String(p.id),
    kind: p.category,
    author: p.author_name || 'Traveller',
    from: p.country || '',
    ago,
    text: p.content,
    place: null,
    likes: p.like_count ?? 0,
    comments: p.comment_count ?? 0,
    photo: false,
    tint: POST_TINTS[i % POST_TINTS.length],
  };
}

/** Community tab: post list + compose flow. Falls back to mock data until DB table is created. */
export default function CommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [dbPosts, setDbPosts] = useState(null);
  const [composing, setComposing] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const rows = await fetchPosts();
      setDbPosts(rows);
    } catch {
      setDbPosts([]);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const sourcePosts =
    dbPosts && dbPosts.length > 0 ? dbPosts.map(normalizeDbPost) : COMMUNITY_POSTS;
  const posts = filterPosts(sourcePosts, filter);

  const handlePostButtonClick = () => {
    if (!user) {
      setLoginPrompt(true);
      return;
    }
    setComposing(true);
  };

  const handleSubmit = async ({ category, content }) => {
    await createPost({ userId: user.id, category, content, authorName: user.name });
    setComposing(false);
    loadPosts();
  };

  return (
    <>
      <div className="pb-[6.5rem] pt-6">
        <div className="px-5">
          <PageHeader
            title="Community"
            subtitle="Tips from travellers eating in Seoul"
            subtitleClassName="[text-wrap:pretty]"
          />
        </div>

        <CommunityTabs value={filter} onChange={setFilter} />

        <div className="flex flex-col gap-3.5 px-5 pt-3.5">
          {posts.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-ink-faint">
              No matches yet
            </div>
          ) : (
            posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
          )}
        </div>
      </div>

      {/* floating compose button */}
      <button
        type="button"
        onClick={handlePostButtonClick}
        className="absolute bottom-[5.5rem] right-5 z-30 inline-flex h-12 items-center gap-1.5 rounded-3xl bg-coral px-5 text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.22)]"
      >
        <PencilIcon /> Post
      </button>

      {/* login prompt sheet */}
      {loginPrompt && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end bg-black/30"
          onClick={() => setLoginPrompt(false)}
        >
          <div
            className="animate-rise rounded-t-3xl bg-paper px-5 pb-8 pt-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-center font-display text-lg font-bold text-ink">
              Log in to post
            </p>
            <p className="mb-5 text-center text-sm text-ink-soft">
              Join the community to share tips and ask questions.
            </p>
            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-2xl border-[1.5px] border-coral py-3.5 font-bold text-coral"
                onClick={() => setLoginPrompt(false)}
              >
                Later
              </button>
              <button
                className="flex-1 rounded-2xl bg-coral py-3.5 font-bold text-white"
                onClick={() => { setLoginPrompt(false); navigate(ROUTES.login); }}
              >
                Log in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* post composer sheet */}
      {composing && (
        <PostComposer onSubmit={handleSubmit} onClose={() => setComposing(false)} />
      )}
    </>
  );
}
