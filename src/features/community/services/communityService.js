import { supabase } from '../../../lib/supabase.js';
import { formatRelativeOrAbsolute } from '../../../shared/utils/formatTime.js';
import { POST_TINTS } from '../data/communityConstants.js';

export async function fetchPosts({ locale, popular = false } = {}) {
  let query = supabase
    .from('mg_community_posts')
    .select('*')
    .eq('is_published', true);

  if (locale) query = query.eq('locale', locale);

  if (popular) {
    query = query
      .order('like_count', { ascending: false })
      .order('comment_count', { ascending: false })
      .order('created_at', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function imageExt(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/heic') return 'heic';
  return 'png';
}

export async function uploadPostImages(files, userId) {
  if (!files || files.length === 0) return [];
  if (files.length > 3) throw new Error('tooMany');
  const urls = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) throw new Error('invalidType');
    if (file.size > 5 * 1024 * 1024) throw new Error('tooLarge');
    // Path: userId/YYYYMMDDHHmmss-uuid.ext — no original filename, no device/locale info
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const uuid = (crypto?.randomUUID?.()) ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = imageExt(file.type);
    const path = `${userId}/${ts}-${uuid}.${ext}`;
    const { error } = await supabase.storage
      .from('community-post-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('community-post-images')
      .getPublicUrl(path);
    const publicUrl = urlData?.publicUrl;
    if (typeof publicUrl !== 'string' || !publicUrl.startsWith('http')) {
      throw new Error('Could not get public URL after upload');
    }
    urls.push(encodeURI(publicUrl));
  }
  return urls;
}

/** Sanitize image_urls from DB — returns only valid, encodable public URL strings. */
export function normalizeCommunityImageUrls(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
    .filter((v) => !v.startsWith('blob:'))
    .map((v) => {
      if (v.startsWith('http')) return encodeURI(v);
      // Looks like a storage path — reconstruct public URL
      const cleanPath = v.replace(/^community-post-images\//, '');
      const { data } = supabase.storage
        .from('community-post-images')
        .getPublicUrl(cleanPath);
      return data?.publicUrl ? encodeURI(data.publicUrl) : null;
    })
    .filter(Boolean);
}

export async function createPost({ userId, category, locale, content, authorName, imageUrls = [] }) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .insert({ user_id: userId, category, locale, content, author_name: authorName, image_urls: imageUrls })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(id, { category, content, imageUrls }) {
  const updates = { category, content, updated_at: new Date().toISOString() };
  if (imageUrls !== undefined) updates.image_urls = imageUrls;
  const { data, error } = await supabase
    .from('mg_community_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(id, userId) {
  const { error } = await supabase
    .from('mg_community_posts')
    .update({
      is_published: false,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchLikedPostIds(userId) {
  const { data, error } = await supabase
    .from('mg_community_post_likes')
    .select('post_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => String(r.post_id)));
}

export async function likePost(postId, userId) {
  const { error } = await supabase
    .from('mg_community_post_likes')
    .insert({ post_id: Number(postId), user_id: userId });
  if (error) throw error;
}

export async function unlikePost(postId, userId) {
  const { error } = await supabase
    .from('mg_community_post_likes')
    .delete()
    .eq('post_id', Number(postId))
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('mg_community_comments')
    .select('*')
    .eq('post_id', Number(postId))
    .or('deleted_at.is.null,parent_comment_id.is.null')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createComment({ postId, userId, authorName, content, parentCommentId = null }) {
  const { data, error } = await supabase
    .from('mg_community_comments')
    .insert({
      post_id: Number(postId),
      user_id: userId,
      author_name: authorName,
      content,
      parent_comment_id: parentCommentId ? Number(parentCommentId) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id, userId) {
  const { error } = await supabase
    .from('mg_community_comments')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchLikedCommentIds(userId, commentIds) {
  if (!commentIds || commentIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('mg_community_comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);
  if (error) throw error;
  return new Set(data.map((r) => String(r.comment_id)));
}

export async function likeComment(commentId, userId) {
  const { error } = await supabase
    .from('mg_community_comment_likes')
    .insert({ comment_id: Number(commentId), user_id: userId });
  if (error) throw error;
}

export async function unlikeComment(commentId, userId) {
  const { error } = await supabase
    .from('mg_community_comment_likes')
    .delete()
    .eq('comment_id', Number(commentId))
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchMyActivityCounts(userId) {
  const [postsResult, likedPostsResult, likedCommentsResult] = await Promise.all([
    supabase
      .from('mg_community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_published', true)
      .is('deleted_at', null),
    supabase
      .from('mg_community_post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('mg_community_comment_likes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);
  if (postsResult.error) throw postsResult.error;
  if (likedPostsResult.error) throw likedPostsResult.error;
  if (likedCommentsResult.error) throw likedCommentsResult.error;
  return {
    myPosts: postsResult.count ?? 0,
    likedPosts: likedPostsResult.count ?? 0,
    likedComments: likedCommentsResult.count ?? 0,
  };
}

export async function fetchMyLikedPosts(userId) {
  const { data: likeRows, error: likeError } = await supabase
    .from('mg_community_post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (likeError) throw likeError;
  if (!likeRows || likeRows.length === 0) return [];

  const postIds = likeRows.map((r) => r.post_id);
  const { data, error } = await supabase
    .from('mg_community_posts')
    .select('*')
    .in('id', postIds)
    .eq('is_published', true)
    .is('deleted_at', null);
  if (error) throw error;

  // Re-sort to match most-recently-liked order
  const orderMap = new Map(postIds.map((id, i) => [id, i]));
  return (data || []).sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
}

export async function fetchMyLikedComments(userId) {
  const { data: likeRows, error: likeError } = await supabase
    .from('mg_community_comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (likeError) throw likeError;
  if (!likeRows || likeRows.length === 0) return [];

  const commentIds = likeRows.map((r) => r.comment_id);
  const { data, error } = await supabase
    .from('mg_community_comments')
    .select('*, mg_community_posts(content, category)')
    .in('id', commentIds)
    .is('deleted_at', null);
  if (error) throw error;

  // Re-sort to match most-recently-liked order
  const orderMap = new Map(commentIds.map((id, i) => [id, i]));
  return (data || []).sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
}

export async function fetchMyPosts(userId) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function softDeletePosts(ids, userId) {
  const { error } = await supabase
    .from('mg_community_posts')
    .update({
      is_published: false,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .in('id', ids.map(Number))
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Converts a raw DB post row into the normalized shape used by PostCard.
 * @param {object} p - raw row from mg_community_posts
 * @param {number} i - index (used for tint cycling)
 */
export function normalizeDbPost(p, i) {
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
