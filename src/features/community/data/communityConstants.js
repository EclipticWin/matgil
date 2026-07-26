import { pickTranslated } from '../../../shared/i18n/localeFallback.js';

/** Background tint colors cycled across community post cards. */
export const POST_TINTS = ['#FFE3D4', '#FFEFC9', '#E6E9F7', '#E2F1DE'];

/** Category options shown in the PostComposer write form. */
export const WRITE_CATEGORIES = [
  { key: 'general',  label: 'General',  labelKo: '일반', labelZh: '综合' },
  { key: 'question', label: 'Question', labelKo: '질문', labelZh: '提问' },
  { key: 'review',   label: 'Review',   labelKo: '후기', labelZh: '点评' },
  { key: 'tips',     label: 'Tips',     labelKo: '팁',   labelZh: '贴士' },
  { key: 'food',     label: 'Food',     labelKo: '음식', labelZh: '美食' },
  { key: 'routes',   label: 'Routes',   labelKo: '동선', labelZh: '路线' },
];

/** Current-locale label for a post's raw `category` key (mg_community_posts.category),
 *  same source/translation rule PostComposer's own category picker already uses —
 *  never a new mapping, so a post always shows the same category text it was written
 *  under. Returns null for a missing/unrecognized key (caller should hide the badge
 *  rather than guess a category). */
export function getWriteCategoryLabel(key, locale) {
  const cat = WRITE_CATEGORIES.find((c) => c.key === key);
  if (!cat) return null;
  return pickTranslated({ ko: cat.labelKo, en: cat.label, 'zh-CN': cat.labelZh }, locale) ?? cat.label;
}
