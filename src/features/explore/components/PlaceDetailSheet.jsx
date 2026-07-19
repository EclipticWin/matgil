import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackIcon,
  ClockIcon,
  HeartIcon,
  PinIcon,
  SparkleIcon,
  StarIcon,
  WalkIcon,
} from '../../../shared/components/Icon.jsx';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import Spinner from '../../../shared/components/Spinner.jsx';
import { cn } from '../../../shared/utils/classNames.js';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { ROUTES } from '../../../shared/constants/routes.js';
import { useFoodCategories } from '../context/FoodCategoryProvider.jsx';
import { usePlaceDetailSections } from '../../places/hooks/usePlaceDetailSections.js';
import { isPlaceBookmarked, addPlaceBookmark, removePlaceBookmark, fetchPlaceBookmarkStatsBatch } from '../../places/services/placeBookmarkService.js';
import { fetchPlaceReviewStats, fetchPlaceReviews, fetchMyPlaceReview, deletePlaceReview } from '../../places/services/placeReviewService.js';
import PlaceLocationMap from '../../places/components/PlaceLocationMap.jsx';
import ReviewCard from '../../places/components/ReviewCard.jsx';
import ReviewComposer from '../../places/components/ReviewComposer.jsx';
import AuthRequiredModal from '../../places/components/AuthRequiredModal.jsx';
import DeleteReviewConfirmModal from '../../places/components/DeleteReviewConfirmModal.jsx';
import { setLastPlaceView } from '../data/lastPlaceView.js';

// scrollend를 지원하지 않는 브라우저를 위한 디바운스 백업(ms). 실제 스크롤이
// 끝난 뒤에도 억제 상태가 영원히 풀리지 않는 경우(예: 이미 목표 위치라 스크롤
// 이벤트/scrollend가 아예 발생하지 않는 경우)에 대한 안전장치이기도 하다.
const SCROLL_END_FALLBACK_MS = 150;

// 사용자에게 보이면 안 되는 내부 상태성 태그
const HIDDEN_TAGS = new Set([
  '음식점',
  '사진 있음',
  '위치 있음',
  '메뉴 정보 있음',
  '포장 가능',
  '주차 가능',
  '영업시간 있음',
  'restaurant',
  'has photo',
  'has location',
  'has menu info',
  'parking available',
  'takeout available',
  'has open time',
]);

// section_key는 코드 렌더러와 1:1로 연결된 고정 값이라 rename되지 않는다 —
// 아이콘은 이번 1차 구현에서는 key 기반 고정 매핑을 사용한다(DB icon_key는 후속 관리자 작업 대상).
const SECTION_ICONS = {
  menu: SparkleIcon,
  reviews: StarIcon,
  location: PinIcon,
  visit_info: ClockIcon,
};

function distRaw(place) {
  if (place.distanceKm == null) return null;
  return place.distanceKm < 1
    ? `${Math.round(place.distanceKm * 1000)} m`
    : `${place.distanceKm.toFixed(1)} km`;
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

function SectionEmptyState({ empty }) {
  if (!empty?.title) return null;
  return (
    <div className="py-2 text-center">
      <p className="text-sm font-semibold text-ink-soft">{empty.title}</p>
      {empty.description && <p className="mt-1 text-xs text-ink-faint">{empty.description}</p>}
    </div>
  );
}

function SectionHeader({ Icon, label }) {
  return (
    <h3 className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold tracking-wide text-ink-soft">
      <Icon size={13} /> {label}
    </h3>
  );
}

export default function PlaceDetailSheet({ place, selectedLocation, onBack }) {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { categoryMap, getCategoryLabel } = useFoodCategories();
  const { activeSections, getLabel, getEmpty } = usePlaceDetailSections();

  const scrollRef = useRef(null);
  const tabBarRef = useRef(null);
  const sectionRefs = useRef(new Map());
  // 탭 클릭으로 시작한 스크롤이 진행되는 동안 true. 이 사이에는 자동 scroll-spy가
  // activeTab을 절대 건드리지 않는다 — 스크롤이 실제로 끝났다고 판단될 때(scrollend
  // 또는 디바운스 백업)만 false로 되돌리고, 그 순간에도 activeTab을 다시 계산하지
  // 않는다(클릭한 탭을 그대로 유지). 이후 사용자가 직접 스크롤을 시작해야만 자동
  // scroll-spy가 다시 activeTab을 바꾼다.
  const suppressScrollSpyRef = useRef(false);
  const scrollEndFallbackTimeoutRef = useRef(null);
  const [activeTab, setActiveTab] = useState(null);

  // ── 개별 가게 북마크 ──
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | 'bookmark' | 'review'

  // ── 가게 저장 수 (mg_place_bookmark_stats — 저장한 사용자 수만, 목록/ID는 노출하지 않음) ──
  const [saveCount, setSaveCount] = useState(0);
  const [saveCountLoading, setSaveCountLoading] = useState(true);

  // ── Reviews 미리보기 (통계 + 최신 2개) ──
  const [reviewStats, setReviewStats] = useState(null);
  const [reviewStatsLoading, setReviewStatsLoading] = useState(true);
  const [latestReviews, setLatestReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [photoWarning, setPhotoWarning] = useState(false);

  // 사진 일부 업로드 실패 안내 배너 — 잠시 보여준 뒤 자동으로 닫는다.
  useEffect(() => {
    if (!photoWarning) return;
    const timer = setTimeout(() => setPhotoWarning(false), 5000);
    return () => clearTimeout(timer);
  }, [photoWarning]);

  // 로그인 사용자가 이 가게에 이미 가진 활성 리뷰. null이 아니면 "Write a review"
  // 버튼을 숨긴다 — DB가 1인 1활성 리뷰만 허용하므로, 조회가 끝나기 전에는(로딩 중)
  // 버튼을 먼저 그리지 않는다.
  const [myReview, setMyReview] = useState(null);
  const [myReviewLoading, setMyReviewLoading] = useState(true);

  // 장소가 바뀌면 스크롤 위치와 활성 탭을 첫 섹션으로 되돌린다. activeSections도
  // 의존성에 포함해, DB 로드가 fallback을 대체하는 시점에도 첫 탭이 올바르게 잡힌다.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setActiveTab(activeSections[0]?.key ?? null);
    suppressScrollSpyRef.current = false;
    if (scrollEndFallbackTimeoutRef.current) window.clearTimeout(scrollEndFallbackTimeoutRef.current);
  }, [place.id, activeSections]);

  useEffect(() => {
    if (!user) { setIsBookmarked(false); return; }
    let cancelled = false;
    isPlaceBookmarked({ placeId: place.id, userId: user.id })
      .then((val) => { if (!cancelled) setIsBookmarked(val); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [place.id, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setSaveCountLoading(true);
    fetchPlaceBookmarkStatsBatch([place.id])
      .then((countMap) => { if (!cancelled) { setSaveCount(countMap.get(place.id) ?? 0); setSaveCountLoading(false); } })
      .catch(() => { if (!cancelled) { setSaveCount(0); setSaveCountLoading(false); } });
    return () => { cancelled = true; };
  }, [place.id]);

  useEffect(() => {
    let cancelled = false;
    setReviewStatsLoading(true);
    setReviewsLoading(true);
    setReviewsError(false);

    Promise.allSettled([
      fetchPlaceReviewStats(place.id),
      fetchPlaceReviews({ placeId: place.id, limit: 2 }),
    ]).then(([statsResult, reviewsResult]) => {
      if (cancelled) return;
      setReviewStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
      setLatestReviews(reviewsResult.status === 'fulfilled' ? reviewsResult.value : []);
      setReviewsError(reviewsResult.status === 'rejected');
      setReviewStatsLoading(false);
      setReviewsLoading(false);
    });

    return () => { cancelled = true; };
  }, [place.id]);

  useEffect(() => {
    if (!user) { setMyReview(null); setMyReviewLoading(false); return; }
    let cancelled = false;
    setMyReviewLoading(true);
    fetchMyPlaceReview({ placeId: place.id, userId: user.id })
      .then((row) => { if (!cancelled) { setMyReview(row); setMyReviewLoading(false); } })
      .catch(() => { if (!cancelled) setMyReviewLoading(false); });
    return () => { cancelled = true; };
  }, [place.id, user?.id]);

  function setSectionRef(key, el) {
    if (el) sectionRefs.current.set(key, el);
    else sectionRefs.current.delete(key);
  }

  // 실제 스크롤 컨테이너(scrollRef) 기준으로 활성 섹션을 계산한다: sticky 탭 바
  // 바로 아래 기준선을 최근에 지나온(= 기준선보다 위에 있으면서 그중 가장 아래쪽)
  // 섹션을 활성으로 삼는다. 이 함수는 자동 scroll-spy(자유 스크롤)에서만 호출되고
  // 클릭 처리 중/직후에는 호출되지 않으므로, 바닥 도달 여부로 마지막 섹션을 강제하는
  // 별도 보정은 두지 않는다 — 그 보정이 클릭 결과와 계속 충돌해 왔기 때문이다.
  function computeActiveSectionKey() {
    const container = scrollRef.current;
    if (!container || activeSections.length === 0) return null;

    const barH = tabBarRef.current?.offsetHeight ?? 0;
    const threshold = barH + 4;
    const containerTop = container.getBoundingClientRect().top;

    let bestKey = null;
    let bestTop = -Infinity;
    sectionRefs.current.forEach((el, key) => {
      if (!el) return;
      const relTop = el.getBoundingClientRect().top - containerTop;
      if (relTop <= threshold && relTop > bestTop) {
        bestTop = relTop;
        bestKey = key;
      }
    });

    // 아직 첫 섹션에도 도달하지 않은 경우(맨 위로 스크롤) 첫 섹션을 기본값으로 삼는다.
    return bestKey ?? activeSections[0]?.key ?? null;
  }

  function armScrollEndFallback() {
    if (scrollEndFallbackTimeoutRef.current) window.clearTimeout(scrollEndFallbackTimeoutRef.current);
    scrollEndFallbackTimeoutRef.current = window.setTimeout(() => {
      suppressScrollSpyRef.current = false;
    }, SCROLL_END_FALLBACK_MS);
  }

  // 탭 바만 가로 스크롤되고, 세로 스크롤에 따라 활성 탭이 갱신되도록 스크롤-스파이를 건다.
  // 클릭으로 시작된 스크롤이 진행되는 동안(suppressScrollSpyRef)에는 activeTab을
  // 절대 바꾸지 않는다 — scrollend(지원 시) 또는 디바운스 백업으로 억제가 풀리는
  // 순간에도 재계산하지 않고 클릭한 탭을 그대로 둔다. 이후 사용자가 실제로 스크롤을
  // 이어가면(= 억제가 이미 풀린 상태에서 들어오는 scroll 이벤트) 그때부터 자동
  // scroll-spy가 다시 activeTab을 갱신한다.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || activeSections.length === 0) return;

    function handleScroll() {
      if (suppressScrollSpyRef.current) {
        armScrollEndFallback(); // 스크롤이 계속되는 한 종료 감지를 뒤로 미룬다
        return;
      }
      const key = computeActiveSectionKey();
      if (key) setActiveTab(key);
    }

    function handleScrollEnd() {
      if (scrollEndFallbackTimeoutRef.current) window.clearTimeout(scrollEndFallbackTimeoutRef.current);
      suppressScrollSpyRef.current = false;
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('scrollend', handleScrollEnd, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [activeSections]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabClick(key) {
    const el = sectionRefs.current.get(key);
    const container = scrollRef.current;
    if (!el || !container) return;

    // 클릭 즉시 활성 탭을 바꾼다 — 스크롤 계산을 기다리지 않고, 스크롤이 끝날 때까지
    // 자동 scroll-spy를 완전히 억제한다.
    suppressScrollSpyRef.current = true;
    setActiveTab(key);

    const barH = tabBarRef.current?.offsetHeight ?? 0;
    // getBoundingClientRect (not offsetTop) so this stays correct regardless of
    // which ancestor happens to be positioned (e.g. NearbySheet's sheet root).
    const elTop = el.getBoundingClientRect().top;
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = container.scrollTop + (elTop - containerTop) - barH;

    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

    // scrollend가 발생하면 handleScrollEnd가 곧바로 억제를 풀어준다. 이미 목표
    // 위치라 스크롤(그리고 scrollend)이 아예 발생하지 않는 경우를 위한 백업으로,
    // 디바운스 타이머도 함께 걸어 둔다.
    armScrollEndFallback();
  }

  async function handleBookmarkClick() {
    if (!user) {
      setAuthModal('bookmark');
      return;
    }
    if (bookmarkBusy) return;

    const next = !isBookmarked;
    setIsBookmarked(next); // 낙관적 업데이트
    setSaveCount((prev) => Math.max(0, prev + (next ? 1 : -1))); // 저장 수도 함께 낙관적 반영
    setBookmarkBusy(true);
    try {
      if (next) await addPlaceBookmark({ placeId: place.id, userId: user.id });
      else await removePlaceBookmark({ placeId: place.id, userId: user.id });
    } catch {
      setIsBookmarked(!next); // 실패 시 원복
      setSaveCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
    } finally {
      setBookmarkBusy(false);
    }
  }

  function handleWriteReviewClick() {
    if (!user) {
      setAuthModal('review');
      return;
    }
    setLastPlaceView({ placeId: place.id, selectedLocation });
    navigate(ROUTES.placeReviews(place.id), { state: { placeName: place.name, openWrite: true } });
  }

  function handleViewReviewsClick() {
    setLastPlaceView({ placeId: place.id, selectedLocation });
    navigate(ROUTES.placeReviews(place.id), { state: { placeName: place.name } });
  }

  function handleReviewEdited(updated, meta) {
    setLatestReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setMyReview(updated);
    setEditingReviewId(null);
    if (meta?.photosFailed) setPhotoWarning(true);
    fetchPlaceReviewStats(place.id).then(setReviewStats).catch(() => {});
  }

  async function handleConfirmDeleteReview() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteFailed(false);
    try {
      await deletePlaceReview(deleteTarget.id);
      setLatestReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setMyReview((prev) => (prev?.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      fetchPlaceReviewStats(place.id).then(setReviewStats).catch(() => {});
    } catch {
      setDeleteFailed(true); // 모달은 열어둔 채로 두어 사용자가 다시 시도할 수 있게 한다.
    } finally {
      setDeleteBusy(false);
    }
  }

  function handleCancelDeleteReview() {
    setDeleteTarget(null);
    setDeleteFailed(false);
  }

  const rawCategory = place.matgilCategoryKeys?.[0] ?? null;
  const subtitle =
    place.firstMenu ||
    place.tags?.find((tag) => !HIDDEN_TAGS.has(tag)) ||
    (rawCategory ? getCategoryLabel(rawCategory, locale) : null);

  const raw = distRaw(place);
  const locationLabel = locale === 'ko'
    ? (selectedLocation?.labelKo || selectedLocation?.label)
    : locale === 'zh-CN'
      ? (selectedLocation?.labelZh || selectedLocation?.label)
      : selectedLocation?.label;
  const dist = raw && locationLabel
    ? t('placeDetail.distFrom', { dist: raw, location: locationLabel })
    : raw;

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
    ...(place.tags ?? []).filter((tag) => !HIDDEN_TAGS.has(tag)),
  ].filter(Boolean);
  const uniqueChips = [...new Set(chips)];

  const reviewCount = reviewStats?.rating_count ?? 0;

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
      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto">
        {/* 식당명 + 저장 하트 */}
        <div className="px-5 pb-1.5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 font-display text-[1.375rem] font-bold leading-tight tracking-tight text-ink">
              {place.name}
            </h2>
            <button
              type="button"
              onClick={handleBookmarkClick}
              disabled={bookmarkBusy}
              aria-label={isBookmarked ? 'Remove from saved places' : 'Save this place'}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                isBookmarked ? 'text-coral' : 'text-ink-faint',
              )}
            >
              <HeartIcon active={isBookmarked} size={20} />
            </button>
          </div>

          {/* 평균 별점 + 리뷰 수 + 저장 수 */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.82rem] font-semibold text-ink-soft">
            {!reviewStatsLoading && (
              <button
                type="button"
                onClick={() => handleTabClick('reviews')}
                className="inline-flex items-center gap-1.5"
              >
                {reviewCount > 0 ? (
                  <>
                    <StarIcon size={11} className="text-coral" />
                    {Number(reviewStats.rating_avg).toFixed(1)} ·{' '}
                    {t(reviewCount === 1 ? 'placeDetail.reviewCountOne' : 'placeDetail.reviewCountOther', { count: reviewCount })}
                  </>
                ) : (
                  getEmpty('reviews', locale).title
                )}
              </button>
            )}
            {/* 저장 수 — 저장한 사용자 수만(개인정보 비노출), 0도 표시.
                "· " 접두사는 리뷰 부분이 실제로 렌더된 경우에만 붙인다(docs/44 —
                이전에는 flex gap만 있고 가운데점 문자 자체가 없었다). */}
            {!saveCountLoading && (
              <span className="inline-flex items-center gap-1">
                {!reviewStatsLoading && '· '}♥ {saveCount}
              </span>
            )}
          </div>
        </div>

        {/* 히어로 이미지 */}
        <div className="px-5 pb-4 pt-2.5">
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

        {/* 섹션 탭 바 — 가로 스크롤, sticky */}
        {activeSections.length > 0 && (
          <div ref={tabBarRef} className="sticky top-0 z-10 border-y border-ink/5 bg-paper-soft px-5">
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {activeSections.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => handleTabClick(section.key)}
                  className={cn(
                    'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-[0.82rem] font-bold transition-colors',
                    activeTab === section.key ? 'border-coral text-coral' : 'border-transparent text-ink-faint',
                  )}
                >
                  {getLabel(section.key, locale)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 섹션 콘텐츠 — DB 순서대로 세로 연속 배치, 활성 섹션은 데이터 유무와 무관하게 항상 렌더 */}
        {activeSections.map((section) => {
          const Icon = SECTION_ICONS[section.key];
          if (!Icon) return null; // 코드가 아직 모르는 section_key는 안전하게 건너뛴다.

          const label = getLabel(section.key, locale);
          const empty = getEmpty(section.key, locale);
          const wrapperProps = {
            key: section.key,
            ref: (el) => setSectionRef(section.key, el),
            'data-section-key': section.key,
            className: 'border-t border-ink/5 px-5 py-4',
          };

          if (section.key === 'menu') {
            return (
              <div {...wrapperProps}>
                <SectionHeader Icon={Icon} label={label} />
                {place.firstMenu || place.treatMenu ? (
                  <div className="flex flex-col gap-2">
                    <InfoRow label={t('placeDetail.main')} value={place.firstMenu} />
                    <InfoRow label={t('placeDetail.serves')} value={place.treatMenu} />
                  </div>
                ) : (
                  <SectionEmptyState empty={empty} />
                )}
              </div>
            );
          }

          if (section.key === 'reviews') {
            return (
              <div {...wrapperProps}>
                <SectionHeader Icon={Icon} label={label} />
                {photoWarning && (
                  <div className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                    {t('placeDetail.reviewSavedPhotosFailed')}
                  </div>
                )}
                {reviewsLoading ? (
                  <div className="flex justify-center py-6">
                    <Spinner className="h-6 w-6 border-ink/10 border-t-ink/30" />
                  </div>
                ) : reviewsError ? (
                  <p className="text-sm text-ink-faint">{t('placeDetail.reviewsLoadError')}</p>
                ) : latestReviews.length === 0 ? (
                  <div>
                    <SectionEmptyState empty={empty} />
                    <div className="mt-2 flex items-center justify-center gap-3">
                      {!myReviewLoading && !myReview && (
                        <button
                          type="button"
                          onClick={handleWriteReviewClick}
                          className="rounded-full bg-coral px-4 py-1.5 text-[0.8rem] font-bold text-white"
                        >
                          {t('placeDetail.writeReview')}
                        </button>
                      )}
                      <button type="button" onClick={handleViewReviewsClick} className="text-[0.8rem] font-bold text-coral">
                        {t('placeDetail.viewReviews')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {latestReviews.map((review) =>
                      editingReviewId === review.id ? (
                        <ReviewComposer
                          key={review.id}
                          placeId={place.id}
                          reviewId={review.id}
                          initialRating={review.rating}
                          initialContent={review.content ?? ''}
                          initialImages={review.images}
                          onSubmitted={handleReviewEdited}
                          onCancel={() => setEditingReviewId(null)}
                        />
                      ) : (
                        <ReviewCard
                          key={review.id}
                          review={review}
                          locale={locale}
                          t={t}
                          isOwn={!!user && review.userId === user.id}
                          onEdit={(r) => setEditingReviewId(r.id)}
                          onDelete={(r) => setDeleteTarget(r)}
                        />
                      ),
                    )}
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <button type="button" onClick={handleViewReviewsClick} className="text-[0.8rem] font-bold text-coral">
                        {t('placeDetail.viewAllReviews', { count: reviewCount })}
                      </button>
                      {!myReviewLoading && !myReview && (
                        <button
                          type="button"
                          onClick={handleWriteReviewClick}
                          className="shrink-0 rounded-full bg-coral px-4 py-1.5 text-[0.8rem] font-bold text-white"
                        >
                          {t('placeDetail.writeReview')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (section.key === 'location') {
            return (
              <div {...wrapperProps}>
                <SectionHeader Icon={Icon} label={label} />
                {place.latitude != null && place.longitude != null ? (
                  <PlaceLocationMap
                    latitude={place.latitude}
                    longitude={place.longitude}
                    className="h-40 w-full rounded-2xl"
                  />
                ) : (
                  <SectionEmptyState empty={empty} />
                )}
              </div>
            );
          }

          if (section.key === 'visit_info') {
            return (
              <div {...wrapperProps}>
                <SectionHeader Icon={Icon} label={label} />
                {hasVisitInfo ? (
                  <div className="flex flex-col gap-2">
                    <InfoRow label={t('placeDetail.hours')} value={place.openTime} />
                    <InfoRow label={t('placeDetail.restDay')} value={place.restDate} />
                    <InfoRow label={t('placeDetail.phone')} value={place.tel} />
                    <InfoRow label={t('placeDetail.parking')} value={parkingText} />
                    <InfoRow label={t('placeDetail.takeout')} value={packingText} />
                  </div>
                ) : (
                  <SectionEmptyState empty={empty} />
                )}
              </div>
            );
          }

          return null;
        })}

        {/* 카테고리 태그 섹션 */}
        {uniqueChips.length > 0 && (
          <div className="border-t border-ink/5 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {uniqueChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-xl bg-ink/5 px-3 py-1 text-xs font-semibold text-ink-soft"
                >
                  {categoryMap.has(chip) ? getCategoryLabel(chip, locale) : chip}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-5" />
      </div>

      <AuthRequiredModal
        open={authModal != null}
        onClose={() => setAuthModal(null)}
        bodyKey={authModal === 'review' ? 'placeDetail.loginToReview' : 'placeDetail.loginToSave'}
      />

      <DeleteReviewConfirmModal
        open={deleteTarget != null}
        onCancel={handleCancelDeleteReview}
        onConfirm={handleConfirmDeleteReview}
        busy={deleteBusy}
        failed={deleteFailed}
      />
    </div>
  );
}
