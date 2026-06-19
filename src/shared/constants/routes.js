/** Central route table — import these instead of hard-coding path strings. */
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  home: '/',
  area: '/area',
  preference: '/preference',
  loading: '/loading',
  result: '/result',
  courses: '/courses',
  courseDetail: (id) => `/courses/${id}`,
  community: '/community',
  phrases: '/phrases',
  popular: '/popular',
  bookmark: '/bookmark',
  my: '/my',
};
