import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { getPlaceById } from '../api/placeApi.js';
import {
  fetchPlaceReviewStats,
  fetchPlaceReviews,
  fetchPlaceRatingDistribution,
  fetchMyPlaceReview,
  deletePlaceReview,
} from '../features/places/services/placeReviewService.js';
import { usePlaceDetailSections } from '../features/places/hooks/usePlaceDetailSections.js';
import ReviewCard from '../features/places/components/ReviewCard.jsx';
import ReviewComposer from '../features/places/components/ReviewComposer.jsx';
import AuthRequiredModal from '../features/places/components/AuthRequiredModal.jsx';
import DeleteReviewConfirmModal from '../features/places/components/DeleteReviewConfirmModal.jsx';
import Button from '../shared/components/Button.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import { BackIcon } from '../shared/components/Icon.jsx';
import { ROUTES } from '../shared/constants/routes.js';

const PAGE_SIZE = 5;
const STARS = [5, 4, 3, 2, 1];

function RatingDistributionBars({ distribution, total }) {
  return (
    <div className="flex-1">
      {STARS.map((star) => {
        const count = distribution[star] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 py-0.5">
            <span className="w-3 shrink-0 text-[0.7rem] font-semibold text-ink-faint">{star}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PlaceReviewsPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { state: routeState } = useLocation();
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const { getLabel, getEmpty } = usePlaceDetailSections();

  const numericPlaceId = Number(placeId);
  const isValidId = Number.isInteger(numericPlaceId) && numericPlaceId > 0;

  const [placeName, setPlaceName] = useState(routeState?.placeName ?? null);
  const [stats, setStats] = useState(null);
  const [distribution, setDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [myReview, setMyReview] = useState(null);
  const [myReviewLoading, setMyReviewLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(!!routeState?.openWrite);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const cursorRef = useRef(null);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);

  const loadFirstPage = useCallback(async () => {
    if (!isValidId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const [statsRow, dist, firstReviews] = await Promise.all([
        fetchPlaceReviewStats(numericPlaceId),
        fetchPlaceRatingDistribution(numericPlaceId),
        fetchPlaceReviews({ placeId: numericPlaceId, cursor: null, limit: PAGE_SIZE }),
      ]);
      setStats(statsRow);
      setDistribution(dist);
      setReviews(firstReviews);
      setHasMore(firstReviews.length === PAGE_SIZE);
      cursorRef.current = firstReviews.length > 0
        ? { createdAt: firstReviews[firstReviews.length - 1].createdAt, id: firstReviews[firstReviews.length - 1].id }
        : null;
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [numericPlaceId, isValidId]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  // 딥링크로 직접 들어온 경우에만 장소명을 별도로 조회한다 (상세 시트에서 넘어온 경우는 router state로 충분).
  useEffect(() => {
    if (!isValidId || placeName) return;
    let cancelled = false;
    getPlaceById(numericPlaceId, locale)
      .then((p) => { if (!cancelled && p) setPlaceName(p.name); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [placeName, numericPlaceId, locale, isValidId]);

  // 로그인 사용자가 이미 이 가게에 활성 리뷰를 갖고 있는지 확인 — 있으면 작성 버튼을
  // 숨긴다. 조회가 끝나기 전에는(myReviewLoading) 버튼도 작성 폼도 먼저 그리지 않는다.
  useEffect(() => {
    if (!isValidId || !user) { setMyReview(null); setMyReviewLoading(false); return; }
    let cancelled = false;
    setMyReviewLoading(true);
    fetchMyPlaceReview({ placeId: numericPlaceId, userId: user.id })
      .then((row) => { if (!cancelled) { setMyReview(row); setMyReviewLoading(false); } })
      .catch(() => { if (!cancelled) setMyReviewLoading(false); });
    return () => { cancelled = true; };
  }, [numericPlaceId, user?.id, isValidId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) return;
    setLoadingMore(true);
    try {
      const next = await fetchPlaceReviews({ placeId: numericPlaceId, cursor: cursorRef.current, limit: PAGE_SIZE });
      setReviews((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
      cursorRef.current = next.length > 0
        ? { createdAt: next[next.length - 1].createdAt, id: next[next.length - 1].id }
        : null;
    } catch {
      // 목록은 그대로 유지 — 사용자가 다시 스크롤하면 재시도된다.
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, numericPlaceId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { root: container, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, reviews.length]);

  function handleBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(ROUTES.home);
  }

  function handleWriteClick() {
    if (!user) { setShowAuthModal(true); return; }
    setShowComposer(true);
  }

  function handleSubmitted(review) {
    // 새 작성이든(맨 위에 없던 id) 방금 만든 자기 리뷰로의 수정 대체든, 목록에서
    // 같은 id를 교체하고 없으면 맨 위에 추가한다.
    setReviews((prev) => {
      const exists = prev.some((r) => r.id === review.id);
      return exists ? prev.map((r) => (r.id === review.id ? review : r)) : [review, ...prev];
    });
    setMyReview(review);
    setShowComposer(false);
    // 방금 낸/고친 리뷰까지 반영된 평균/분포를 다시 조회한다.
    fetchPlaceReviewStats(numericPlaceId).then(setStats).catch(() => {});
    fetchPlaceRatingDistribution(numericPlaceId).then(setDistribution).catch(() => {});
  }

  function handleReviewEdited(updated) {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setMyReview(updated);
    setEditingReviewId(null);
    fetchPlaceReviewStats(numericPlaceId).then(setStats).catch(() => {});
    fetchPlaceRatingDistribution(numericPlaceId).then(setDistribution).catch(() => {});
  }

  async function handleConfirmDeleteReview() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteFailed(false);
    try {
      await deletePlaceReview(deleteTarget.id);
      setReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (myReview?.id === deleteTarget.id) setMyReview(null);
      setDeleteTarget(null);
      fetchPlaceReviewStats(numericPlaceId).then(setStats).catch(() => {});
      fetchPlaceRatingDistribution(numericPlaceId).then(setDistribution).catch(() => {});
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

  if (!isValidId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper-soft px-8 text-center">
        <p className="text-sm font-semibold text-ink-soft">{t('placeDetail.invalidPlace')}</p>
        <button type="button" onClick={handleBack} className="text-sm font-bold text-coral">
          {t('my.back')}
        </button>
      </div>
    );
  }

  const empty = getEmpty('reviews', locale);
  const reviewCount = stats?.rating_count ?? 0;
  const ratingAvg = stats ? Number(stats.rating_avg) : 0;

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      {/* 헤더 — 화면 최상단(safe area만 고려)에서 바로 시작 */}
      <div className="shrink-0 px-5 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink"
        >
          <BackIcon />
        </button>
        <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-faint">
          {getLabel('reviews', locale)}
        </div>
        <h1 className="mt-1 line-clamp-2 font-display text-[1.375rem] font-bold leading-tight tracking-tight text-ink">
          {placeName ?? t('placeDetail.allReviews')}
        </h1>
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-8 w-8 border-ink/10 border-t-ink/30" />
          </div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-ink-faint">{t('placeDetail.reviewsLoadError')}</p>
        ) : (
          <>
            {/* 요약 카드: 평균 별점 + 분포 (0건이면 표시하지 않음) */}
            {reviewCount > 0 && (
              <div className="rounded-3xl bg-white/70 p-5">
                <div className="flex items-end gap-4">
                  <div className="shrink-0 text-center">
                    <div className="font-display text-[2.5rem] font-bold leading-none text-ink">
                      {ratingAvg.toFixed(1)}
                    </div>
                    <div className="mt-1 text-[0.7rem] font-semibold text-ink-faint">/ 5</div>
                  </div>
                  <RatingDistributionBars distribution={distribution} total={reviewCount} />
                </div>
                <p className="mt-2 text-center text-xs text-ink-faint">
                  {t('placeDetail.basedOnReviews', { count: reviewCount })}
                </p>
              </div>
            )}

            {/* 리뷰 작성 진입 — 요약(또는 헤더)과 목록 사이에 자연스럽게 배치.
                본인이 이미 활성 리뷰를 갖고 있으면 별도 "이미 작성했어요" 안내 없이
                작성 버튼 자체를 숨긴다 — 수정은 아래 목록의 자기 리뷰 카드 점 3개
                메뉴에서만 한다. myReview가 있으면 showComposer(딥링크 등으로 true여도)
                로는 어떤 폼도 열지 않는다 — 새 작성 폼도, 자동 수정 폼 전환도 하지 않는다.
                myReview 조회가 끝나기 전에는 아무것도 그리지 않는다. */}
            <div className="mt-4">
              {myReviewLoading ? null : showComposer && !myReview ? (
                <ReviewComposer
                  placeId={numericPlaceId}
                  onSubmitted={handleSubmitted}
                  onCancel={() => setShowComposer(false)}
                />
              ) : myReview ? null : (
                <div className="flex justify-center">
                  <Button variant="primary" onClick={handleWriteClick} className="px-8">
                    {t('placeDetail.writeReview')}
                  </Button>
                </div>
              )}
            </div>

            {/* 리뷰 목록 */}
            <div className="mt-5">
              {reviews.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-ink-soft">{empty.title}</p>
                  {empty.description && <p className="mt-1 text-xs text-ink-faint">{empty.description}</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {reviews.map((review) =>
                    editingReviewId === review.id ? (
                      <ReviewComposer
                        key={review.id}
                        placeId={numericPlaceId}
                        reviewId={review.id}
                        initialRating={review.rating}
                        initialContent={review.content ?? ''}
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
                  {hasMore && <div ref={sentinelRef} className="h-1" />}
                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <Spinner className="h-6 w-6 border-ink/10 border-t-ink/30" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AuthRequiredModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        bodyKey="placeDetail.loginToReview"
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
