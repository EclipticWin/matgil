import { supabase } from '../lib/supabase.js';

/** Fetches the single active notice for a given locale/noticeKey from
 *  `public.mg_locale_notices` — DB is the sole source of truth for both
 *  whether a notice shows and what it says (see RLS: anon/authenticated only
 *  ever see is_enabled=true rows). Returns null when no active row exists;
 *  throws on a genuine Supabase error so the caller can fail closed instead
 *  of silently falling back to any hardcoded copy. */
export async function getActiveLocaleNotice(locale, noticeKey = 'search_data_notice') {
  const { data, error } = await supabase
    .from('mg_locale_notices')
    .select('locale, notice_key, title, message, dismiss_on_backdrop')
    .eq('locale', locale)
    .eq('notice_key', noticeKey)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.title || !data.message) return null;

  return {
    locale: data.locale,
    noticeKey: data.notice_key,
    title: data.title,
    message: data.message,
    dismissOnBackdrop: data.dismiss_on_backdrop ?? false,
  };
}
