/** Shared cap for the Explore tab's public feeds (routes and places, each
 *  counted independently — see PublicRoutesTab/PublicPlacesTab) — a signed-in
 *  user can accumulate "load more" pages up to this many rows before the
 *  button disappears, regardless of how much further total_count says the
 *  feed actually goes. The guest 5-item limit (already enforced server-side
 *  too) is unaffected — this cap only ever matters once a user is past that. */
export const MAX_PUBLIC_FEED_ITEMS = 150;
