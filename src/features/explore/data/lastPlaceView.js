// Module-level, session-scoped store (resets on a real page reload — intentionally
// not persisted) used to restore the Map tab's view — which location was selected
// and which place's detail sheet was open — after a round trip to the full
// /places/:id/reviews page. Read once and cleared by HomePage on mount.
let pending = null;

export function setLastPlaceView(view) {
  pending = view;
}

export function consumeLastPlaceView() {
  const value = pending;
  pending = null;
  return value;
}
