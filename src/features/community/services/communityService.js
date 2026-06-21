import { supabase } from '../../../lib/supabase.js';

export async function fetchPosts({ locale, popular = false }) {
  let query = supabase
    .from('mg_community_posts')
    .select('*')
    .eq('is_published', true)
    .eq('locale', locale);

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

export async function createPost({ userId, category, locale, content, authorName }) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .insert({ user_id: userId, category, locale, content, author_name: authorName })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(id, { category, content }) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .update({ category, content, updated_at: new Date().toISOString() })
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
    .is('deleted_at', null)
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
