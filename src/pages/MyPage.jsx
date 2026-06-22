import { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Card from '../shared/components/Card.jsx';
import Button from '../shared/components/Button.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { avatarGradient } from '../shared/utils/avatarColor.js';
import { formatRelativeOrAbsolute } from '../shared/utils/formatTime.js';
import PostCard from '../features/community/components/PostCard.jsx';
import EditProfileSheet from '../features/profile/components/EditProfileSheet.jsx';
import {
  fetchMyActivityCounts,
  fetchMyLikedPosts,
  fetchMyLikedComments,
  normalizeCommunityImageUrls,
} from '../features/community/services/communityService.js';

const POST_TINTS = ['#FFE3D4', '#FFEFC9', '#E6E9F7', '#E2F1DE'];

function normalizeDbPost(p, i) {
  return {
    id: String(p.id),
    userId: String(p.user_id),
    kind: p.category,
    author: p.author_name || 'Traveller',
    from: p.country || '',
    ago: formatRelativeOrAbsolute(p.created_at),
    text: p.content,
    place: null,
    likes: p.like_count ?? 0,
    comments: p.comment_count ?? 0,
    photo: false,
    tint: POST_TINTS[i % POST_TINTS.length],
    imageUrls: normalizeCommunityImageUrls(p.image_urls),
  };
}

function Stat({ value, label, onClick }) {
  return (
    <Card
      as={onClick ? 'button' : 'div'}
      onClick={onClick}
      className="flex-1 px-2 py-3.5 text-center"
    >
      <div className="font-display text-2xl font-bold text-coral">
        {value === null ? '–' : value}
      </div>
      <div className="mt-0.5 text-[0.7rem] font-semibold leading-tight text-ink-soft">{label}</div>
    </Card>
  );
}

function LikedCommentCard({ comment }) {
  const gradient = avatarGradient(comment.user_id || comment.author_name);
  const post = comment.mg_community_posts;
  return (
    <Card className="p-4">
      {post?.content && (
        <p className="mb-2.5 line-clamp-2 rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink-faint">
          {post.content}
        </p>
      )}
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-sm font-bold text-white`}
        >
          {(comment.author_name || 'T').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] leading-relaxed text-ink">{comment.content}</p>
          <p className="mt-1 text-xs text-ink-faint">
            {comment.author_name} · {formatRelativeOrAbsolute(comment.created_at)}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function MyPage() {
  const { user, logout, loading, updateDisplayName } = useAuth();
  const navigate = useNavigate();
  const { t } = useLocale();

  const [counts, setCounts] = useState(null);
  const [activeTab, setActiveTab] = useState('likedPosts');
  const [likedPosts, setLikedPosts] = useState(null);
  const [likedComments, setLikedComments] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchMyActivityCounts(user.id)
      .then(setCounts)
      .catch(() => setCounts({ myPosts: 0, likedPosts: 0, likedComments: 0 }));
  }, [user]);

  useEffect(() => {
    if (!user || activeTab !== 'likedPosts' || likedPosts !== null) return;
    fetchMyLikedPosts(user.id)
      .then((rows) => setLikedPosts(rows.map((p, i) => normalizeDbPost(p, i))))
      .catch(() => setLikedPosts([]));
  }, [user, activeTab, likedPosts]);

  useEffect(() => {
    if (!user || activeTab !== 'likedComments' || likedComments !== null) return;
    fetchMyLikedComments(user.id)
      .then(setLikedComments)
      .catch(() => setLikedComments([]));
  }, [user, activeTab, likedComments]);

  const handleSaveProfile = useCallback(async (displayName) => {
    await updateDisplayName(displayName);
    setEditingProfile(false);
    setToast(t('my.profileUpdated'));
    setTimeout(() => setToast(''), 3000);
  }, [updateDisplayName, t]);

  if (loading) return null;
  if (!user) return <Navigate to={ROUTES.login} replace />;

  const TABS = [
    { key: 'likedPosts', label: t('my.likedPosts') },
    { key: 'likedComments', label: t('my.likedComments') },
  ];

  return (
    <PageShell>
      <PageHeader title={t('my.title')} titleClassName="mb-5" />

      {/* Profile card */}
      <Card className="flex items-center gap-3.5 p-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(user.id)} font-display text-2xl font-bold text-white`}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.05rem] font-bold text-ink">{user.name}</p>
          <p className="truncate text-sm text-ink-soft">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingProfile(true)}
          className="shrink-0 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink-soft active:bg-ink/10"
        >
          {t('my.editProfile')}
        </button>
      </Card>

      {/* Profile update toast — inline */}
      {toast && (
        <p className="mt-2 text-center text-xs font-semibold text-green-600">{toast}</p>
      )}

      {/* Activity stats */}
      <div className="mt-3.5 flex gap-2.5">
        <Stat value={counts?.myPosts ?? null} label={t('my.myPosts')} />
        <Stat
          value={counts?.likedPosts ?? null}
          label={t('my.likedPosts')}
          onClick={() => setActiveTab('likedPosts')}
        />
        <Stat
          value={counts?.likedComments ?? null}
          label={t('my.likedComments')}
          onClick={() => setActiveTab('likedComments')}
        />
      </div>

      {/* Activity tabs */}
      <div className="mt-5">
        <div className="flex border-b border-ink/10">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[0.8125rem] font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-coral text-coral'
                  : 'text-ink-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          {activeTab === 'likedPosts' && (
            likedPosts === null
              ? <p className="py-10 text-center text-sm text-ink-faint">…</p>
              : likedPosts.length === 0
                ? <p className="py-10 text-center text-sm text-ink-faint">{t('my.noLikedPosts')}</p>
                : likedPosts.map((post) => (
                    <PostCard key={post.id} post={post} user={user} />
                  ))
          )}
          {activeTab === 'likedComments' && (
            likedComments === null
              ? <p className="py-10 text-center text-sm text-ink-faint">…</p>
              : likedComments.length === 0
                ? <p className="py-10 text-center text-sm text-ink-faint">{t('my.noLikedComments')}</p>
                : likedComments.map((c) => (
                    <LikedCommentCard key={c.id} comment={c} />
                  ))
          )}
        </div>
      </div>

      <Button variant="secondary" full className="mt-6" onClick={logout}>
        {t('my.logout')}
      </Button>

      {/* Edit profile sheet */}
      {editingProfile && (
        <EditProfileSheet
          currentName={user.name}
          onSave={handleSaveProfile}
          onClose={() => setEditingProfile(false)}
        />
      )}
    </PageShell>
  );
}
