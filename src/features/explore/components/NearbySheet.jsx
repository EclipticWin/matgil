import { useRef, useState } from 'react';
import Card from '../../../shared/components/Card.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import CourseCard from '../../courses/components/CourseCard.jsx';
import TodayCourseDetail from './TodayCourseDetail.jsx';
import PlaceDetailSheet from './PlaceDetailSheet.jsx';
import { useBookmarks } from '../../../shared/hooks/useBookmarks.jsx';
import { HeartIcon, ChevronRightIcon } from '../../../shared/components/Icon.jsx';
import { cn } from '../../../shared/utils/classNames.js';

const TINTS = ['#FFE3D4','#FFEFC9','#E2F1DE','#FBE0E4','#E6E9F7','#FFE0CE','#DDEFEA','#F0E6FF','#E6F0FF','#FFF3E0'];

function NearbyRow({ place, index }) {
  const { toggle, isBookmarked } = useBookmarks();
  const saved = isBookmarked(place.id);
  const tint = TINTS[index % TINTS.length];
  const subtitle = place.firstMenu || place.tags?.[0] || '음식점';
  const distText =
    place.distanceKm != null
      ? place.distanceKm < 1
        ? `${Math.round(place.distanceKm * 1000)} m`
        : `${place.distanceKm.toFixed(1)} km`
      : null;

  return (
    <Card className="flex items-center gap-3 p-3">
      <Thumbnail src={place.imageUrl} tint={tint} className="h-[4.25rem] w-[4.25rem]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-bold text-ink">{place.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">
          {subtitle}{distText ? ` · ${distText}` : ''}
        </p>
        {place.address && (
          <p className="mt-1 truncate text-xs text-ink-faint">{place.address}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={saved ? 'Remove bookmark' : 'Add bookmark'}
        onClick={() => toggle(place)}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-coral transition-colors',
          saved ? 'bg-coral-tint' : 'border-[1.5px] border-ink/10',
        )}
      >
        <HeartIcon active={saved} size={18} />
      </button>
    </Card>
  );
}

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
  places,
  selectedLocation,
}) {
  const peek = vh ? Math.round(vh * 0.44) : 300;
  const full = vh ? Math.round(vh * 0.92) : 560;

  const [snap, setSnap] = useState('peek'); // 'collapsed' | 'peek' | 'full'
  const [dragH, setDragH] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const drag = useRef(null);
  const preCollapseSnap = useRef('peek'); // restored when handle is tapped

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
            <ChevronRightIcon size={15} className="-rotate-90 text-coral" />
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
            {/* Header: title + nearby count */}
            <div className="shrink-0 px-5 pb-1.5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
                  Eat near {selectedLocation?.label ?? 'here'}
                </h2>
                <span className="text-[0.8rem] font-bold text-coral">{places.length} nearby</span>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-5 pt-1">

              {/* ── Recommended courses ── */}
              {courses && courses.length > 0 && (
                <>
                  <div className="mb-2 text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-faint">
                    ★ Today's picks
                  </div>
                  <div className="flex flex-col gap-3">
                    {courses.map((course) => {
                      const isActive = course.id === activeCourse?.id;
                      return (
                        /* Active course gets a coral ring; tapping enters detail */
                        <div
                          key={course.id}
                          className={cn('rounded-3xl', isActive && 'ring-2 ring-coral/55')}
                        >
                          <CourseCard
                            course={course}
                            disableLink
                            onClick={() => {
                              onSelectCourse?.(course);
                              openDetail(course);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Nearby right now ── */}
              <div className={cn('mb-2 flex items-center gap-2.5', courses?.length ? 'mt-5' : 'mt-1')}>
                <span className="text-[0.7rem] font-extrabold uppercase tracking-wide text-ink-faint">
                  Nearby right now
                </span>
                <span className="h-px flex-1 bg-ink/8" />
              </div>

              {places.length === 0 ? (
                <p className="py-8 text-center text-sm font-semibold text-ink-faint">No matches yet</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {places.map((p, i) => (
                    <NearbyRow key={p.id} place={p} index={i} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
