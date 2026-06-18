import { useEffect, useRef, useState } from 'react';
import CourseCard from '../../courses/components/CourseCard.jsx';
import TodayCourseDetail from './TodayCourseDetail.jsx';
import PlaceDetailSheet from './PlaceDetailSheet.jsx';
import { ChevronRightIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

const INITIAL_VISIBLE = 3;
const LOAD_BATCH = 3;

/**
 * Draggable "Eat near here" sheet.
 *
 * Snap states: 'collapsed' | 'peek' | 'full'
 *
 * The drag pill strip sits at the very top of the sheet regardless of which
 * view is active, so the user can collapse from base list, course detail,
 * or place detail. Collapsing preserves the current view — the handle button
 * restores to whatever snap was active before collapsing.
 */
export default function NearbySheet({
  vh,
  courses,
  activeCourse,
  onSelectCourse,
  selectedLocation,
  isLoading = false,
}) {
  const peek = vh ? Math.round(vh * 0.44) : 300;
  const full = vh ? Math.round(vh * 0.92) : 560;

  const [snap, setSnap] = useState('peek'); // 'collapsed' | 'peek' | 'full'
  const [dragH, setDragH] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const drag = useRef(null);
  const preCollapseSnap = useRef('peek'); // restored when handle is tapped

  // ── Load-more state ──────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Reset visible count when the course list changes (location / filter change).
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    setLoadingMore(false);
  }, [courses]);

  // Observe sentinel element to trigger progressive reveal.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    const total = courses?.length ?? 0;
    if (!sentinel || !container || visibleCount >= total || loadingMore) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoadingMore(true);
        setTimeout(() => {
          setVisibleCount((prev) => Math.min(prev + LOAD_BATCH, total));
          setLoadingMore(false);
        }, 400);
      },
      { root: container, threshold: 0.1 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [courses, loadingMore, visibleCount]);

  const height = dragH != null ? dragH : snap === 'full' ? full : snap === 'peek' ? peek : 0;

  const onDown = (e) => {
    drag.current = { y: e.clientY, h: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const next = drag.current.h + (drag.current.y - e.clientY);
    setDragH(Math.max(0, Math.min(full, next)));
  };
  const onUp = () => {
    if (!drag.current) return;
    const cur = dragH != null ? dragH : height;
    if (cur > (peek + full) / 2) {
      setSnap('full');
    } else if (cur > peek * 0.35) {
      setSnap('peek');
    } else {
      preCollapseSnap.current = snap; // save so handle can restore it
      setSnap('collapsed');
      // selectedCourse / selectedPlace intentionally preserved
    }
    setDragH(null);
    drag.current = null;
  };

  // Restore the snap that was active just before collapsing.
  const handleExpand = () => setSnap(preCollapseSnap.current || 'peek');

  const openDetail = (c) => {
    setSelectedCourse(c);
    setSelectedPlace(null);
    setSnap('full');
    setDragH(null);
  };

  const closeDetail = () => {
    setSelectedCourse(null);
    setSelectedPlace(null);
  };

  const openPlace = (place) => setSelectedPlace(place);
  const closePlace = () => setSelectedPlace(null);

  return (
    <>
      {/* ── Pull-up handle ────────────────────────────────────────────────────
          Icon-only tab sitting at the very bottom when the sheet is collapsed.
          Tapping it restores the sheet to the pre-collapse snap & view. */}
      {snap === 'collapsed' && dragH === null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
          <button
            type="button"
            aria-label="Show nearby"
            onClick={handleExpand}
            className="pointer-events-auto flex h-8 w-14 items-center justify-center rounded-t-2xl bg-white shadow-[0_-3px_14px_rgba(34,24,20,0.12)]"
          >
            <ChevronRightIcon size={15} className="-rotate-90 text-stone-400" />
          </button>
        </div>
      )}

      {/* ── Main draggable sheet ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[1.625rem] bg-paper-soft shadow-card"
        style={{ height, transition: drag.current ? 'none' : 'height 0.35s cubic-bezier(0.2,0.8,0.2,1)' }}
      >
        {/* ── Universal drag pill ───────────────────────────────────────────
            Always at the top so dragging works from any inner view. */}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="flex shrink-0 justify-center cursor-grab touch-none pb-1.5 pt-2.5"
        >
          <div className="h-[5px] w-10 rounded-full bg-ink/15" />
        </div>

        {/* ── View content ─────────────────────────────────────────────────── */}
        {selectedCourse ? (
          selectedPlace ? (
            /* ── 식당 상세 ── */
            <div className="min-h-0 flex-1 overflow-hidden">
              <PlaceDetailSheet
                place={selectedPlace}
                selectedLocation={selectedLocation}
                onBack={closePlace}
              />
            </div>
          ) : (
            /* ── 코스 상세 ── */
            <div className="min-h-0 flex-1 overflow-hidden">
              <TodayCourseDetail
                course={selectedCourse}
                selectedLocation={selectedLocation}
                onBack={closeDetail}
                onSelectPlace={openPlace}
              />
            </div>
          )
        ) : (
          /* ── 기본 목록 ── */
          <>
            {/* Header */}
            <div className="shrink-0 px-5 pb-1.5">
              <h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
                Eat near {selectedLocation?.label ?? 'here'}
              </h2>
            </div>

            {/* Scrollable body */}
            <div ref={scrollContainerRef} className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5 pt-1">

              {/* ── Recommended courses ── */}
              {courses && courses.length > 0 ? (() => {
                const visibleCourses = courses.slice(0, visibleCount);
                const hasMore = visibleCount < courses.length;
                return (
                  <>
                    <div className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-faint">
                      ★ Today's picks
                    </div>
                    <div className="flex flex-col gap-3">
                      {visibleCourses.map((course) => {
                        const isActive = course.id === activeCourse?.id;
                        return (
                          <div
                            key={course.id}
                            className={cn('rounded-3xl', isActive && 'ring-2 ring-coral/55')}
                          >
                            <CourseCard
                              course={course}
                              disableLink
                              isActive={isActive}
                              onClick={() => {
                                onSelectCourse?.(course);
                                openDetail(course);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Sentinel: entering scroll viewport triggers load-more */}
                    {hasMore && <div ref={sentinelRef} className="h-1" />}

                    {/* Muted spinner while revealing next batch */}
                    {loadingMore && (
                      <div className="flex justify-center py-4">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
                      </div>
                    )}
                  </>
                );
              })() : isLoading ? (
                /* places 로딩 중 */
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
                  <p className="text-[0.85rem] text-ink-faint">Finding routes nearby…</p>
                </div>
              ) : (
                /* 로딩 완료 후 실제 빈 결과 */
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <p className="text-[0.95rem] font-semibold text-ink-soft">No routes found nearby.</p>
                  <p className="mt-1.5 text-[0.82rem] text-ink-faint">
                    Try another area or remove some filters.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
