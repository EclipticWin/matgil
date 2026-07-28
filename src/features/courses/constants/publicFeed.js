/** Shared cap for the Explore tab's public feeds (routes and places, each
 *  counted independently — see PublicRoutesTab/PublicPlacesTab) — a signed-in
 *  user can accumulate infinite-scroll pages up to this many rows before the
 *  feed stops requesting further pages, regardless of how much further
 *  total_count says the feed actually goes. The guest 5-item limit (already
 *  enforced server-side too) is unaffected — this cap only ever matters once
 *  a user is past that. */
export const MAX_PUBLIC_FEED_ITEMS = 150;

/** Single page size for both the Routes and Places public feeds — used for
 *  the initial request (offset 0) and every subsequent infinite-scroll page,
 *  for both guest and logged-in requests. The two feed RPCs (get_public_course_feed
 *  / get_public_place_feed) already cap guest requests at 5 and logged-in
 *  requests at 50 server-side, and 5 <= both, so this single value never
 *  conflicts with either cap. */
export const PUBLIC_FEED_PAGE_SIZE = 5;
