import { supabase } from '../../../lib/supabase.js';

export async function fetchPosts() {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPost({ userId, category, content, authorName }) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .insert({
      user_id: userId,
      category,
      content,
      author_name: authorName,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
