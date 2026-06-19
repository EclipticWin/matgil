import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import {
  BackIcon,
  PinIcon,
  WalkIcon,
  ClockIcon,
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
export default function TodayCourseDetail({ course, selectedLocation, onBack, onSelectPlace }) {
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

        <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-ink-faint">
          Route stops
        </div>

        {/*
          왼쪽 배지 컬럼: connector만 통과, 카드 배경 없음
          오른쪽 카드: 연한 bg-white/45 + rounded-2xl
          connector: badge 34px, card 80px(py-3×2+h-14), space-y-3 12px
          badge center = (80-34)/2+17 = 40px → top-10 / bottom-10
          connector left=17px < card start=54px(badge34+gap-5 20) → 카드에 가리지 않음
        */}
        <div className="relative space-y-3">
          <div
            className="absolute bottom-10 left-[1.0625rem] top-10 w-[2.5px]"
            style={{
              background:
                'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
            }}
          />

          {course.stops.map((stop, i) => {
            const subtitle = stop.firstMenu || 'Restaurant';
            const dist = distLabel(stop);

            return (
              <button
                key={stop.id ?? i}
                type="button"
                onClick={() => onSelectPlace?.(stop)}
                className="relative flex w-full items-center gap-5 text-left"
              >
                {/* 왼쪽: 번호 배지 — 카드 배경/border 없음 */}
                <div className="z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.9375rem] font-bold text-white shadow-coral">
                  {i + 1}
                </div>

                {/* 오른쪽: 연한 카드 영역 */}
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ink/5 bg-white/45 px-3 py-3 shadow-[0_0.25rem_1rem_rgba(34,24,20,0.04)]">
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
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
