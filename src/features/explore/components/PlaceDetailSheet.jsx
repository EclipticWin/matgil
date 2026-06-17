import {
  BackIcon,
  ClockIcon,
  PinIcon,
  SparkleIcon,
  WalkIcon,
} from '../../../shared/components/Icon.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';

// 사용자에게 보이면 안 되는 내부 상태성 태그
const HIDDEN_TAGS = new Set([
  '음식점',
  '사진 있음',
  '위치 있음',
  '메뉴 정보 있음',
  '포장 가능',
  '주차 가능',
  '영업시간 있음',
]);

function distLabel(place, selectedLocation) {
  if (place.distanceKm == null) return null;
  const raw =
    place.distanceKm < 1
      ? `${Math.round(place.distanceKm * 1000)} m`
      : `${place.distanceKm.toFixed(1)} km`;
  return selectedLocation?.label ? `${raw} from ${selectedLocation.label}` : raw;
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="w-[4.75rem] shrink-0 text-[0.72rem] font-bold text-ink-faint">
        {label}
      </span>
      <span className="flex-1 text-sm leading-relaxed text-ink-soft">{value}</span>
    </div>
  );
}

export default function PlaceDetailSheet({ place, selectedLocation, onBack }) {
  const subtitle =
    place.firstMenu ||
    place.tags?.find((t) => !HIDDEN_TAGS.has(t)) ||
    place.matgilCategoryKeys?.[0] ||
    null;

  const dist = distLabel(place, selectedLocation);

  const parkingText = place.parking || (place.hasParking === true ? '가능' : null);
  const packingText = place.packing || (place.hasPacking === true ? '가능' : null);

  const hasVisitInfo = !!(
    place.openTime ||
    place.restDate ||
    place.tel ||
    parkingText ||
    packingText
  );

  const chips = [
    ...(place.matgilCategoryKeys ?? []),
    ...(place.tags ?? []).filter((t) => !HIDDEN_TAGS.has(t)),
  ].filter(Boolean);
  const uniqueChips = [...new Set(chips)];

  return (
    <div className="flex h-full flex-col">
      {/* 헤더: 뒤로가기 버튼 */}
      <div className="shrink-0 px-5 pb-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink"
        >
          <BackIcon />
        </button>
      </div>

      {/* 스크롤 본문 */}
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {/* 식당명 */}
        <div className="px-5 pb-3">
          <h2 className="font-display text-[1.375rem] font-bold leading-tight tracking-tight text-ink">
            {place.name}
          </h2>
        </div>

        {/* 히어로 이미지 */}
        <div className="px-5 pb-4">
          <Thumbnail
            src={place.imageUrl}
            tint={place.tint ?? '#FFE3D4'}
            className="h-44 w-full"
          />
        </div>

        {/* subtitle / 거리 / 주소 / 설명 */}
        <div className="px-5 pb-4">
          <div className="flex flex-col space-y-1.5">
            {subtitle && (
              <p className="text-sm text-ink-soft pb-2">{subtitle}</p>
            )}
            {dist != null && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <WalkIcon size={13} /> {dist}
              </span>
            )}
            {place.address && (
              <span className="inline-flex items-start gap-1.5 text-xs text-ink-faint">
                <PinIcon size={13} className="mt-0.5 shrink-0" />
                {place.address}
              </span>
            )}
          </div>

          {place.description && (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft [text-wrap:pretty]">
              {place.description}
            </p>
          )}
        </div>

        {/* 메뉴 섹션 */}
        {(place.firstMenu || place.treatMenu) && (
          <div className="border-t border-ink/5 px-5 py-4">
            <h3 className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold tracking-wide text-ink-soft">
              <SparkleIcon size={13} /> MENU
            </h3>
            <div className="flex flex-col gap-2">
              <InfoRow label="Main" value={place.firstMenu} />
              <InfoRow label="Serves" value={place.treatMenu} />
            </div>
          </div>
        )}

        {/* Visit Info 섹션 */}
        {hasVisitInfo && (
          <div className="border-t border-ink/5 px-5 py-4">
            <h3 className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold tracking-wide text-ink-soft">
              <ClockIcon size={13} /> VISIT INFO
            </h3>
            <div className="flex flex-col gap-2">
              <InfoRow label="Hours" value={place.openTime} />
              <InfoRow label="Rest day" value={place.restDate} />
              <InfoRow label="Phone" value={place.tel} />
              <InfoRow label="Parking" value={parkingText} />
              <InfoRow label="Takeout" value={packingText} />
            </div>
          </div>
        )}

        {/* 카테고리 태그 섹션 */}
        {uniqueChips.length > 0 && (
          <div className="border-t border-ink/5 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {uniqueChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-xl bg-ink/5 px-3 py-1 text-xs font-semibold text-ink-soft"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>
    </div>
  );
}
