import { useEffect, useRef, useState } from 'react';

// Displayed (already-resisted) pull distance caps here regardless of how far
// the finger actually travels — this is what the content transform and the
// indicator's progress are driven by, never the raw finger delta.
const MAX_DISPLAY_DISTANCE = 68;
// Raw finger px needed to approach MAX_DISPLAY_DISTANCE — see
// computeDisplayDistance()'s ease-out curve below.
const RESISTANCE_RANGE = 160;
// Displayed px of pull needed at release to trigger an actual refresh.
export const PULL_THRESHOLD = 46;
// Where the content/indicator rest while a refresh request is in flight —
// also exported so the indicator can size its own centering "slot" to
// exactly this value instead of a second, independently-guessed number.
export const REFRESHING_REST_DISTANCE = 42;
// Exported for the same reason — the indicator's own return transition
// duration must match this exactly, not an independently-chosen value that
// could quietly drift out of sync with the content's own return animation.
export const RETURN_DURATION_MS = 220;
// However fast the actual fetchPosts() call resolves, the refreshing
// spinner stays up at least this long — otherwise a sub-100ms response (a
// warm cache, an empty result) makes the indicator flash and vanish before
// a user can register it as "refreshing" at all.
const MIN_REFRESH_DISPLAY_MS = 600;
// How close main.scrollTop must be to feedTopScrollRef's recorded baseline
// for a pull to be allowed to arm (or to keep running once armed).
const SCROLL_TOP_TOLERANCE = 4;

const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"], [data-no-pull-refresh]';

// Ease-out curve tuned so real-finger travel maps to display distance close
// to the "20px→~17px, 60px→~42px, 120px→~64px" feel requested: at t = raw/
// RESISTANCE_RANGE (clamped to 1), display = MAX * (1 - (1-t)^2).
function computeDisplayDistance(rawDelta) {
  const t = Math.min(Math.max(rawDelta, 0) / RESISTANCE_RANGE, 1);
  return MAX_DISPLAY_DISTANCE * (1 - (1 - t) ** 2);
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Custom pull-to-refresh, scoped entirely to whatever DOM node
 *  `scrollContainerRef` points at — for CommunityPage that's the shared
 *  AppLayout `<main>` it receives via Outlet context (see AppLayout.jsx),
 *  not a container CommunityPage owns itself. Everything this hook touches
 *  on that node — a marker class (`matgil-community-scroll`, see index.css
 *  for the `overscroll-behavior-y: contain` it adds) and the native touch/
 *  pointer listeners themselves — is added on mount and removed on unmount,
 *  so no other tab page sharing that same `<main>` is ever affected, and
 *  nothing outlives a navigation away from Community.
 *
 *  Pull-start gating is a single, cheap scrollTop comparison — `feedTopScrollRef`
 *  (owned by the caller — CommunityPage records `main.scrollTop` into it
 *  right after each first-page load/filter change) is the one source of
 *  truth for "what scrollTop counts as the feed's own top"; arming AND
 *  every touchmove/pointermove tick both just check
 *  `Math.abs(container.scrollTop - feedTopScrollRef.current) <= tolerance`.
 *
 *  Deliberately built on native `addEventListener` with `{ passive: false }`
 *  for touchmove, NOT JSX `onTouchMove` — React binds its synthetic touch
 *  handlers passively by default, so `preventDefault()` inside one neither
 *  stops the page from scrolling nor stops Samsung Internet's own native
 *  pull-to-refresh; only a manually-attached non-passive listener can, and
 *  only once a downward pull is unambiguously confirmed (never for a plain
 *  scroll or the category tabs' own horizontal drag).
 *
 *  Mouse/pointer support (`pointerType === 'mouse'` only) uses
 *  `setPointerCapture`/`releasePointerCapture` so a mouse-button-still-down
 *  drag keeps delivering pointermove/pointerup to this element even if the
 *  cursor leaves it mid-drag — what lets this be exercised with a plain
 *  mouse drag in Chrome DevTools' device toolbar or on a desktop trackpad.
 *
 *  The 'refreshing' phase is held for at least MIN_REFRESH_DISPLAY_MS
 *  regardless of how fast `onRefresh()` itself resolves — see runRefresh()
 *  — so the spinner never flashes and vanishes on a fast/empty response.
 *  `refreshTokenRef` guards that pending minimum-display timer (and the
 *  fetch it's waiting on) the same way `postsRequestSeqRef` guards
 *  CommunityPage's own fetch responses: bumped whenever `disabled`/`resetOn`
 *  forces an early reset, so a refresh already in flight when the filter
 *  changes can never apply its late "stop refreshing" transition on top of
 *  the new, already-idle state. Every exit path — success, failure,
 *  touchcancel, pointercancel, disabled, resetOn, unmount — funnels through
 *  resetPullState()/clearPendingTimers(), so no gesture ref, pointer
 *  capture, or pending timer can ever survive into the next attempt and
 *  silently block it. */
export function usePullToRefresh({ scrollContainerRef, feedTopScrollRef, onRefresh, disabled, resetOn }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | pulling | ready | refreshing | returning

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const phaseRef = useRef('idle');
  phaseRef.current = phase;

  // Every piece of a gesture in one place — reset* below always clears the
  // whole object (or nulls it) rather than field-by-field, so nothing here
  // can outlive one pull attempt.
  const gestureRef = useRef(null); // { inputType, pointerId, startX, startY, confirmed, distance } | null
  const reducedMotionRef = useRef(false);
  const returnTimeoutRef = useRef(null);
  const minDisplayTimeoutRef = useRef(null);
  const capturedElRef = useRef(null); // element a pointer capture is currently held on, or null
  // Bumped at the start of every runRefresh() — any in-flight refresh whose
  // token no longer matches the current one (because disabled/resetOn reset
  // things in the meantime) skips its own final state update entirely.
  const refreshTokenRef = useRef(0);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }, []);

  // Refs only (no closures over `container`/etc.) so every effect below —
  // not just the one that owns the DOM listeners — can call this directly.
  function clearPendingTimers() {
    if (minDisplayTimeoutRef.current) { window.clearTimeout(minDisplayTimeoutRef.current); minDisplayTimeoutRef.current = null; }
    if (returnTimeoutRef.current) { window.clearTimeout(returnTimeoutRef.current); returnTimeoutRef.current = null; }
  }

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return undefined;

    container.classList.add('matgil-community-scroll');

    function releasePointerCaptureIfAny() {
      const g = gestureRef.current;
      if (capturedElRef.current && g?.pointerId != null) {
        try { capturedElRef.current.releasePointerCapture(g.pointerId); } catch { /* already released */ }
      }
      capturedElRef.current = null;
    }

    // The single reset path every exit route (success, failure, cancel,
    // disabled, resetOn, unmount) funnels through — see this hook's own doc
    // comment for why that matters.
    function resetPullState() {
      refreshTokenRef.current += 1; // invalidate any in-flight runRefresh()
      releasePointerCaptureIfAny();
      gestureRef.current = null;
      clearPendingTimers();
      setPullDistance(0);
      setPhase('idle');
    }

    function isFromInteractiveElement(target) {
      return !!(target && typeof target.closest === 'function' && target.closest(INTERACTIVE_SELECTOR));
    }

    function isAtFeedTop() {
      const baseline = feedTopScrollRef?.current ?? 0;
      return Math.abs(container.scrollTop - baseline) <= SCROLL_TOP_TOLERANCE;
    }

    function canArmPull(target) {
      if (disabledRef.current) return false;
      if (phaseRef.current !== 'idle') return false;
      if (isFromInteractiveElement(target)) return false;
      if (!isAtFeedTop()) return false;
      return true;
    }

    function updateFromDelta(dx, dy) {
      const g = gestureRef.current;
      if (!g.confirmed) {
        // Dead zone + horizontal-dominance check — never decided until the
        // move is unambiguously more vertical than horizontal, so a
        // category-tab horizontal drag (or plain jitter) is left alone.
        if (dy <= 4 || Math.abs(dy) <= Math.abs(dx)) return true; // still undecided, let default behavior proceed
        if (dy <= 0) return false; // moving up — not a pull, abandon
        g.confirmed = true;
      }
      if (dy <= 0) return false;
      if (!isAtFeedTop()) return false; // re-verified every tick, not just at arm time
      const display = computeDisplayDistance(dy);
      g.distance = display;
      setPullDistance(display);
      setPhase(display >= PULL_THRESHOLD ? 'ready' : 'pulling');
      return true;
    }

    function scheduleReturn() {
      setPhase('returning');
      setPullDistance(0);
      returnTimeoutRef.current = window.setTimeout(() => {
        returnTimeoutRef.current = null;
        setPhase('idle');
      }, reducedMotionRef.current ? 0 : RETURN_DURATION_MS);
    }

    // Holds 'refreshing' for at least MIN_REFRESH_DISPLAY_MS regardless of
    // how fast onRefresh() itself resolves (or throws — a failed refresh
    // still gets the same minimum display before returning, per spec: the
    // existing list is simply left untouched, same as always). `myToken`
    // is captured once here and checked before EVERY subsequent state
    // change, so a resetPullState() that runs while this is still pending
    // (filter changed, modal opened, unmount) makes every later step here a
    // no-op instead of clobbering the newer, already-reset state.
    function runRefresh() {
      const myToken = (refreshTokenRef.current += 1);
      setPhase('refreshing');
      setPullDistance(REFRESHING_REST_DISTANCE);
      const startedAt = now();
      Promise.resolve()
        .then(() => onRefreshRef.current?.())
        .catch(() => {})
        .then(() => {
          if (refreshTokenRef.current !== myToken) return null;
          const remaining = Math.max(0, MIN_REFRESH_DISPLAY_MS - (now() - startedAt));
          return new Promise((resolve) => {
            minDisplayTimeoutRef.current = window.setTimeout(() => {
              minDisplayTimeoutRef.current = null;
              resolve();
            }, remaining);
          });
        })
        .then(() => {
          if (refreshTokenRef.current !== myToken) return;
          scheduleReturn();
        });
    }

    function endGesture() {
      const g = gestureRef.current;
      const pulledDistance = g?.distance ?? 0;
      releasePointerCaptureIfAny();
      gestureRef.current = null;
      if (!g || !g.confirmed) { setPullDistance(0); setPhase('idle'); return; }
      if (pulledDistance >= PULL_THRESHOLD) {
        runRefresh();
      } else {
        scheduleReturn();
      }
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1 || !canArmPull(e.target)) { gestureRef.current = null; return; }
      const touch = e.touches[0];
      gestureRef.current = { inputType: 'touch', startX: touch.clientX, startY: touch.clientY, confirmed: false, distance: 0 };
    }

    function onTouchMove(e) {
      const g = gestureRef.current;
      if (!g || g.inputType !== 'touch') return;
      if (e.touches.length !== 1 || disabledRef.current) { resetPullState(); return; }
      const touch = e.touches[0];
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      const ok = updateFromDelta(dx, dy);
      if (!ok) { resetPullState(); return; }
      if (g.confirmed) e.preventDefault(); // only once this is unambiguously a downward pull
    }

    function onTouchEnd() { endGesture(); }
    function onTouchCancel() { resetPullState(); }

    function onPointerDown(e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (!canArmPull(e.target)) { gestureRef.current = null; return; }
      gestureRef.current = { inputType: 'mouse', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, confirmed: false, distance: 0 };
      try { container.setPointerCapture(e.pointerId); capturedElRef.current = container; } catch { /* capture not supported/available */ }
    }

    function onPointerMove(e) {
      const g = gestureRef.current;
      if (!g || g.inputType !== 'mouse' || e.pointerType !== 'mouse' || e.pointerId !== g.pointerId) return;
      if (disabledRef.current) { resetPullState(); return; }
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      const ok = updateFromDelta(dx, dy);
      if (!ok) resetPullState();
    }

    function onPointerUp(e) {
      if (e.pointerType !== 'mouse' || e.pointerId !== gestureRef.current?.pointerId) return;
      endGesture();
    }
    function onPointerCancel(e) {
      if (e.pointerType !== 'mouse' || e.pointerId !== gestureRef.current?.pointerId) return;
      resetPullState();
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchCancel, { passive: true });
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerCancel);

    return () => {
      resetPullState();
      container.classList.remove('matgil-community-scroll');
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [scrollContainerRef, feedTopScrollRef]);

  // Filter changed — abandon whatever gesture/visual state exists right
  // now, including invalidating (via the token bump) and clearing any
  // pending minimum-display/return timers from a refresh still in flight
  // for the OLD filter. The actual scrollTop baseline reset lives in
  // CommunityPage (it owns feedTopScrollRef).
  useEffect(() => {
    refreshTokenRef.current += 1;
    clearPendingTimers();
    setPullDistance(0);
    setPhase('idle');
  }, [resetOn]);

  // A modal/sheet just opened or a load-more just started — cancel a pull
  // still mid-drag (pulling/ready) immediately, rather than waiting for the
  // next touchmove tick. Deliberately left alone while phase is 'refreshing':
  // bumping the token/clearing timers here would strand phase there forever,
  // since runRefresh()'s own pending steps are what's responsible for ever
  // moving it to 'returning'/'idle' — that in-flight refresh is left to
  // finish and transition itself, same as it would if disabled had stayed
  // false the whole time.
  useEffect(() => {
    if (!disabled || phaseRef.current === 'refreshing') return;
    refreshTokenRef.current += 1;
    clearPendingTimers();
    setPullDistance(0);
    setPhase('idle');
  }, [disabled]);

  return { pullDistance, phase };
}
