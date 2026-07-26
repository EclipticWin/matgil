/** Central route table — import these instead of hard-coding path strings. */
export const ROUTES = {
  login: '/login',
  signup: '/signup',
  home: '/',
  area: '/area',
  preference: '/preference',
  loading: '/loading',
  result: '/result',
  // Public "explore" tab (routes/places saved by other travelers) — /courses is
  // kept only as the old URL that redirects here (see router.jsx); no code
  // should navigate to ROUTES.courses anymore, use ROUTES.explore instead.
  explore: '/explore',
  courses: '/courses',
  courseDetail: (id) => `/courses/${id}`,
  savedCourseDetail: (id) => `/saved-courses/${id}`,
  placeDetail: (placeId) => `/places/${placeId}`,
  placeReviews: (placeId) => `/places/${placeId}/reviews`,
  community: '/community',
  phrases: '/phrases',
  popular: '/popular',
  bookmark: '/bookmark',
  my: '/my',
  mySavedRoutes: '/my/saved-routes',
  mySavedPlaces: '/my/saved-places',
};
