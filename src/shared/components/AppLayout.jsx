import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavigation from '../../features/navigation/components/BottomNavigation.jsx';
import TopBar from './TopBar.jsx';

/**
 * Layout for the bottom-tab pages: a fixed brand bar, a scrollable content
 * area, and a fixed bottom navigation. Full-screen wizard pages skip this.
 *
 * `scrollContainerRef` (this `<main>` itself, the real scroll container
 * every tab page shares) is handed down via Outlet context so a page that
 * needs direct access to it — CommunityPage's custom pull-to-refresh, which
 * has to read live scrollTop and attach native (non-passive) touch
 * listeners — doesn't need its own separate scrollable wrapper. Pages that
 * never call useOutletContext() (every other tab) are completely unaffected
 * — this is purely additive.
 *
 * `--matgil-bottom-nav-h` is this device's *actual* rendered nav height,
 * measured live (font metrics/line-height vary enough across platforms —
 * Samsung Internet, Chrome Android, iOS Safari — that hard-coding a guessed
 * px value here produced visibly uneven spacing above vs. below anything
 * anchored to "just above the nav"). Written to `documentElement` so any
 * page can read it without its own ResizeObserver; only CommunityPage's
 * floating write-button spacing consumes it today (see its own comment),
 * and writing a CSS variable has no visual effect on its own, so every
 * other tab is completely unaffected. */
export default function AppLayout() {
  const scrollContainerRef = useRef(null);
  const navWrapperRef = useRef(null);

  useEffect(() => {
    const el = navWrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const setNavHeightVar = () => {
      document.documentElement.style.setProperty('--matgil-bottom-nav-h', `${el.offsetHeight}px`);
    };
    setNavHeightVar();
    const observer = new ResizeObserver(setNavHeightVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-paper">
      <TopBar />
      <main ref={scrollContainerRef} className="no-scrollbar flex-1 overflow-y-auto">
        <Outlet context={{ scrollContainerRef }} />
      </main>
      <div ref={navWrapperRef}>
        <BottomNavigation />
      </div>
    </div>
  );
}
