/** Community posts from travellers eating in Seoul, plus the sub-tab filters. */
export const COMMUNITY_POSTS = [
  {
    id: 'p1',
    kind: 'review',
    author: 'Mia',
    from: 'United States',
    ago: '2h',
    text: 'The kalguksu at Myeongdong Gyoza was the best ₩9,000 I spent in Seoul. Go before noon to skip the line!',
    place: 'Myeongdong Gyoza',
    likes: 48,
    comments: 6,
    photo: true,
    tint: '#FFE3D4',
  },
  {
    id: 'p2',
    kind: 'general',
    author: 'Kenji',
    from: 'Japan',
    ago: '5h',
    text: 'Pro tip: at most BBQ places the staff will grill the meat for you if you look a little lost. Just smile and point!',
    place: 'Gogi House BBQ',
    likes: 122,
    comments: 19,
    photo: false,
    tint: '#FFEFC9',
  },
  {
    id: 'p3',
    kind: 'review',
    author: 'Lena',
    from: 'Germany',
    ago: '1d',
    text: 'Did the Gwangjang market course tonight — bindaetteok and makgeolli is the perfect combo, and way cheaper than I expected.',
    place: 'Gwangjang Bites',
    likes: 87,
    comments: 11,
    photo: true,
    tint: '#E6E9F7',
  },
  {
    id: 'p4',
    kind: 'question',
    author: 'Sofia',
    from: 'Spain',
    ago: '2d',
    text: 'Any veg-friendly spots near Hongdae? Struggling to find good options after 9pm. Recommendations welcome!',
    place: null,
    likes: 14,
    comments: 23,
    photo: false,
    tint: '#E2F1DE',
  },
];

export const COMMUNITY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'popular', label: 'Popular' },
  { key: 'question', label: 'Questions' },
  { key: 'review', label: 'Reviews' },
  { key: 'tips', label: 'Tips' },
  { key: 'food', label: 'Food' },
  { key: 'routes', label: 'Routes' },
  { key: 'general', label: 'General' },
];

/** Apply a sub-tab filter to the posts. */
export function filterPosts(posts, key) {
  if (key === 'popular') return [...posts].sort((a, b) => b.likes - a.likes);
  if (key === 'all') return posts;
  return posts.filter((p) => p.kind === key);
}
