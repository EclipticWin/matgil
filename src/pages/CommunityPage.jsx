import { useState } from 'react';
import { COMMUNITY_POSTS, filterPosts } from '../features/community/data/communityPosts.js';
import CommunityTabs from '../features/community/components/CommunityTabs.jsx';
import PostCard from '../features/community/components/PostCard.jsx';
import { PencilIcon } from '../shared/components/Icon.jsx';

/** Community tab (커뮤니티): tips and reviews from travellers eating in Seoul. */
export default function CommunityPage() {
  const [filter, setFilter] = useState('all');
  const posts = filterPosts(COMMUNITY_POSTS, filter);

  return (
    <>
      <div className="pb-[6.5rem] pt-6">
        <div className="px-5">
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-ink">Community</h1>
          <p className="text-sm text-ink-soft [text-wrap:pretty]">
            Tips from travellers eating in Seoul
          </p>
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

      {/* floating compose button, pinned just above the bottom nav */}
      <button
        type="button"
        className="absolute bottom-[5.5rem] right-5 z-30 inline-flex h-12 items-center gap-1.5 rounded-3xl bg-coral px-5 text-[0.9375rem] font-bold text-white shadow-coral"
      >
        <PencilIcon /> Post
      </button>
    </>
  );
}
