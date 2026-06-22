import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CourseCard from '../../courses/components/CourseCard.jsx';
import TodayCourseDetail from './TodayCourseDetail.jsx';
import PlaceDetailSheet from './PlaceDetailSheet.jsx';
import { CheckIcon, ChevronRightIcon, CloseIcon, LocateIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { saveCourse, checkCourseAlreadySaved, fetchSavedCourses, isSameCourse } from '../../courses/services/savedCourseService.js';
import { normalizeCourseMetrics } from '../../courses/utils/courseMetrics.js';
import { ROUTES } from '../../../shared/constants/routes.js';

const INITIAL_VISIBLE = 3;
const LOAD_BATCH = 3;
const DRAG_THRESHOLD = 7;
const FULL_TOP_OFFSET_PX = 12;

function findScrollParent(startEl, boundary) {
  let node = startEl;
  while (node && node !== boundary) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

const GPS_STATUSES = new Set(['denied', 'error', 'unsupported']);

export default function NearbySheet({
  vh,
  courses,
  activeCourse,
  onSelectCourse,
  selectedLocation,
  isLoading = false,
  gpsStatus = 'idle',
  onGpsClick,
  onGpsStatusChange,
  initialCourse = null,
}) {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();

  const peek = vh ? Math.round(vh * 0.44) : 300;
  const full = vh ? vh - FULL_TOP_OFFSET_PX : 560;

  const [snap, setSnap] = useState('peek');
  const [dragH, setDragH] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const preCollapseSnap = useRef('peek');

  const sheetRef = useRef(null);
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);

  // 'idle' | 'checking' | 'saving' | 'saved' | 'failed'
  const [saveState, setSaveState] = useState('idle');
  const [savedRows, setSavedRows] = useState([]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    setLoadingMore(false);
  }, [courses]);

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

  // Auto-open saved course when arriving from SavedCourseDetailPage
  useEffect(() => {
    if (!initialCourse) return;
    openDetail(initialCourse);
  }, [initialCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close detail when selected location changes (prevents stale course display on hot place switch)
  useEffect(() => {
    setSelectedCourse(null);
    setSelectedPlace(null);
    setSaveState('idle');
  }, [selectedLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch saved courses for badge display on course list
  useEffect(() => {
    if (!user) { setSavedRows([]); return; }
    let cancelled = false;
    fetchSavedCourses({ userId: user.id })
      .then((rows) => { if (!cancelled) setSavedRows(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if currently selected course is already saved
  useEffect(() => {
    if (!selectedCourse) { setSaveState('idle'); return; }
    if (!user) { setSaveState('idle'); return; }

    setSaveState('checking');
    checkCourseAlreadySaved({ userId: user.id, title: selectedCourse.title })
      .then((already) => setSaveState(already ? 'saved' : 'idle'))
      .catch(() => setSaveState('idle'));
  }, [selectedCourse?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentHeight = dragH != null ? dragH : snap === 'full' ? full : snap === 'peek' ? peek : 0;
  const isSheetFull = currentHeight > (peek + full) / 2;
  const isDragging = gestureRef.current?.isDragging ?? false;
  const locationLabel = (locale === 'ko' ? selectedLocation?.labelKo : null) || (selectedLocation?.label ?? 'here');
  const gpsModal = GPS_STATUSES.has(gpsStatus)
    ? { title: t(`gps.${gpsStatus}.title`), body: t(`gps.${gpsStatus}.body`) }
    : null;

  function handleSheetPointerDown(e) {
    suppressClickRef.current = false;
    const scrollEl = findScrollParent(e.target, sheetRef.current);
    gestureRef.current = {
      startY: e.clientY,
      startH: currentHeight,
      isDragging: false,
      scrollEl,
      scrollTopAtStart: scrollEl ? scrollEl.scrollTop : 0,
      pointerId: e.pointerId,
    };
  }

  function handleSheetPointerMove(e) {
    const g = gestureRef.current;
    if (!g) return;

    const dy = g.startY - e.clientY;

    if (!g.isDragging) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;

      const isNearFull = g.startH > (peek + full) / 2;

      if (isNearFull && g.scrollEl) {
        if (dy > 0) { gestureRef.current = null; return; }
        if (g.scrollTopAtStart > 0) { gestureRef.current = null; return; }
      }

      g.isDragging = true;
      suppressClickRef.current = true;
      sheetRef.current?.setPointerCapture(g.pointerId);
    }

    if (g.isDragging) {
      const next = Math.max(0, Math.min(full, g.startH + dy));
      setDragH(next);
    }
  }

  function handleSheetPointerUpCancel() {
    const g = gestureRef.current;
    if (!g) return;

    if (g.isDragging) {
      const cur = dragH ?? g.startH;
      if (cur > (peek + full) / 2) {
        setSnap('full');
      } else if (cur > peek * 0.35) {
        setSnap('peek');
      } else {
        preCollapseSnap.current = snap;
        setSnap('collapsed');
      }
      setDragH(null);
    }

    gestureRef.current = null;
  }

  function handleSheetClickCapture(e) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

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
    setSaveState('idle');
  };

  const openPlace = (place) => setSelectedPlace(place);
  const closePlace = () => setSelectedPlace(null);

  async function handleSave() {
    if (saveState === 'saving' || saveState === 'saved' || saveState === 'checking') return;
    if (!user) {
      navigate(ROUTES.login);
      return;
    }
    setSaveState('saving');
    try {
      const metrics = normalizeCourseMetrics(selectedCourse);
      const savedRow = await saveCourse({
        userId: user.id,
        locale,
        course: selectedCourse,
        selectedLocation,
        metrics,
      });
      setSaveState('saved');
      setSavedRows((prev) => [savedRow, ...prev]);
    } catch {
      setSaveState('failed');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  return (
    <>
      {/* GPS error modal */}
      {gpsModal && (
        <>
          <div className="absolute inset-0 z-40 bg-black/40" onClick={() => onGpsStatusChange?.('idle')} />
          <div className="absolute inset-x-6 top-1/2 z-40 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-card">
            <button
              type="button"
              aria-label="Close"
              onClick={() => onGpsStatusChange?.('idle')}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
            >
              <CloseIcon size={16} />
            </button>
            <div className="pr-6">
              <p className="text-[0.95rem] font-semibold leading-snug text-ink">{gpsModal.title}</p>
              {gpsModal.body && (
                <p className="mt-2 text-[0.82rem] leading-relaxed text-ink-soft">{gpsModal.body}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* GPS floating button */}
      <div
        className={cn(
          'absolute right-4 z-30',
          isSheetFull ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
        style={{
          bottom: currentHeight + 12,
          transition: isDragging
            ? 'none'
            : 'bottom 0.35s cubic-bezier(0.2,0.8,0.2,1), opacity 0.35s cubic-bezier(0.2,0.8,0.2,1)',
        }}
      >
        <button
          type="button"
          aria-label="Use current location"
          disabled={gpsStatus === 'loading'}
          onClick={onGpsClick}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card transition-colors',
            gpsStatus === 'active'
              ? 'text-blue-500'
              : gpsStatus === 'loading'
              ? 'text-ink/20'
              : 'text-ink-soft',
          )}
        >
          {gpsStatus === 'loading' ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/10 border-t-ink/35" />
          ) : (
            <LocateIcon size={20} />
          )}
        </button>
      </div>

      {/* Pull-up handle */}
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

      {/* Main draggable sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-30 flex select-none flex-col overflow-hidden rounded-t-[1.625rem] bg-paper-soft shadow-card"
        style={{
          height: currentHeight,
          transition: isDragging ? 'none' : 'height 0.35s cubic-bezier(0.2,0.8,0.2,1)',
        }}
        onPointerDownCapture={handleSheetPointerDown}
        onPointerMoveCapture={handleSheetPointerMove}
        onPointerUpCapture={handleSheetPointerUpCancel}
        onPointerCancelCapture={handleSheetPointerUpCancel}
        onClickCapture={handleSheetClickCapture}
      >
        <div className="flex shrink-0 cursor-grab justify-center touch-none pb-1.5 pt-2.5">
          <div className="h-[5px] w-10 rounded-full bg-ink/15" />
        </div>

        {selectedCourse ? (
          selectedPlace ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <PlaceDetailSheet
                place={selectedPlace}
                selectedLocation={selectedLocation}
                onBack={closePlace}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden">
              <TodayCourseDetail
                course={selectedCourse}
                selectedLocation={selectedLocation}
                onBack={closeDetail}
                onSelectPlace={openPlace}
                onSave={handleSave}
                saveState={saveState}
              />
            </div>
          )
        ) : (
          <>
            <div className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-0.5">
              <h2 className="select-none font-display text-[1.15rem] font-bold tracking-tight text-ink">
                {t('nearby.header', { location: locationLabel })}
              </h2>
            </div>

            <div
              ref={scrollContainerRef}
              className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5 pt-1"
            >
              {courses && courses.length > 0 ? (
                (() => {
                  const visibleCourses = courses.slice(0, visibleCount);
                  const hasMore = visibleCount < courses.length;
                  return (
                    <>
                      <div className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-faint">
                        {t('nearby.todayPicks')}
                      </div>
                      <div className="flex flex-col gap-3">
                        {visibleCourses.map((course) => {
                          const isActive = course.id === activeCourse?.id;
                          const alreadySaved = savedRows.some((row) => isSameCourse(course, row));
                          return (
                            <div
                              key={course.id}
                              className={cn('relative rounded-3xl', isActive && 'ring-2 ring-coral/55')}
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
                              {alreadySaved && (
                                <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[0.6rem] font-bold text-white shadow-sm">
                                  <CheckIcon size={9} />
                                  {t('savedCourses.saved')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {hasMore && <div ref={sentinelRef} className="h-1" />}

                      {loadingMore && (
                        <div className="flex justify-center py-4">
                          <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
                        </div>
                      )}
                    </>
                  );
                })()
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
                  <p className="text-[0.85rem] text-ink-faint">{t('nearby.loading')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <p className="text-[0.95rem] font-semibold text-ink-soft">{t('nearby.empty')}</p>
                  <p className="mt-1.5 text-[0.82rem] text-ink-faint">
                    {t('nearby.emptyHint')}
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
