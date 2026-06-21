import { supabase } from '../../../lib/supabase.js';

export async function fetchPosts(locale) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .select('*')
    .eq('is_published', true)
    .eq('locale', locale)
    .order('created_at', { ascending: false });
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

export async function deletePost(id) {
  const { error } = await supabase
    .from('mg_community_posts')
    .delete()
    .eq('id', id);
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
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createComment({ postId, userId, authorName, content }) {
  const { data, error } = await supabase
    .from('mg_community_comments')
    .insert({ post_id: Number(postId), user_id: userId, author_name: authorName, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await supabase
    .from('mg_community_comments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
