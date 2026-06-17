import { cn } from '../../../shared/utils/classNames.js';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import Button from '../../../shared/components/Button.jsx';
import {
  BackIcon,
  PinIcon,
  WalkIcon,
  ClockIcon,
  NavIcon,
  ChevronRightIcon,
} from '../../../shared/components/Icon.jsx';

function distLabel(stop) {
  if (stop.distanceKm != null) {
    return stop.distanceKm < 1
      ? `${Math.round(stop.distanceKm * 1000)} m`
      : `${stop.distanceKm.toFixed(1)} km`;
  }
  return stop.address ?? null;
}

/** Map Bottom Sheet 내부 코스 상세 콘텐츠.
 *  todayCourse.stops 기반이므로 mock CourseDetailPage와 별개로 유지한다. */
export default function TodayCourseDetail({ course, selectedLocation, onBack }) {
  const stopCount = course.stopCount ?? course.stops.length;
  const blurb = `A short food walk near ${selectedLocation?.label ?? 'here'}.`;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="shrink-0 px-5 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink"
        >
          <BackIcon />
        </button>

        <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider text-coral">
          ★ Today's pick
        </div>
        <h2 className="mt-1.5 font-display text-[1.5rem] font-bold leading-[1.1] tracking-tight text-ink">
          {course.title}
        </h2>
        <div className="mt-2.5 flex items-center gap-4 text-[0.8rem] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon size={13} /> {stopCount} stops
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WalkIcon /> {course.km}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> {course.hr}
          </span>
        </div>
      </div>

      {/* 스크롤 본문 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">{blurb}</p>

        <div className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-wide text-ink-faint">
          Route stops
        </div>

        {/*
          stops 목록 구조:
          - 왼쪽: 번호 배지 컬럼 — border 없음, connector만 통과
          - 오른쪽: 콘텐츠 래퍼 — border-b는 여기에만 (마지막 stop 제외)

          connector top-12/bottom-12: py-5(20px) 기준 배지 중심 = 20+(56-34)/2+17 = 48px
        */}
        <div className="relative">
          <div
            className="absolute bottom-12 left-[1.0625rem] top-12 w-[2.5px]"
            style={{
              background:
                'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
            }}
          />

          {course.stops.map((stop, i) => {
            const isLast = i === course.stops.length - 1;
            const subtitle = stop.firstMenu || stop.tags?.[0] || '음식점';
            const dist = distLabel(stop);

            return (
              <div key={stop.id ?? i} className="relative flex items-center gap-4 py-5">
                {/* 왼쪽: 번호 배지 — border 없음 */}
                <div className="z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.9375rem] font-bold text-white shadow-coral">
                  {i + 1}
                </div>

                {/* 오른쪽: 콘텐츠 래퍼 — border는 여기에만 */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumbnail
                    src={stop.imageUrl}
                    tint={stop.tint}
                    className="h-14 w-14 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
                    {dist && (
                      <p className="mt-0.5 truncate text-xs text-ink-faint">{dist}</p>
                    )}
                  </div>

                  <ChevronRightIcon size={14} className="shrink-0 text-ink-faint" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="shrink-0 border-t border-ink/5 px-5 pb-5 pt-3">
        <Button full disabled>
          <NavIcon /> Start this course
        </Button>
      </div>
    </div>
  );
}
