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
  // Public "Traveler Picks" course detail — a full-screen route (registered
  // outside AppLayout, like savedCourseDetail above), keyed by the public
  // feed's own public_route_key rather than a personal mg_saved_courses id.
  // Use publicCourseDetail(key) to build a real URL/navigate target — it
  // encodeURIComponent()s the key. publicCourseDetailPattern is the router
  // registration pattern ONLY: encodeURIComponent(':publicRouteKey') would
  // escape the leading colon (-> '%3ApublicRouteKey'), which react-router
  // would then treat as a literal path segment instead of a param — so the
  // pattern string is kept separate and never built via the key function.
  publicCourseDetail: (publicRouteKey) => `/explore/routes/${encodeURIComponent(publicRouteKey)}`,
  publicCourseDetailPattern: '/explore/routes/:publicRouteKey',
  placeDetail: (placeId) => `/places/${placeId}`,
  placeReviews: (placeId) => `/places/${placeId}/reviews`,
  community: '/community',
  phrases: '/phrases',
  popular: '/popular',
  bookmark: '/bookmark',
  my: '/my',
  mySavedRoutes: '/my/saved-routes',
  mySavedPlaces: '/my/saved-places',
  mySavedPhrases: '/my/saved-phrases',
};
