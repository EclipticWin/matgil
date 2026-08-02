import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import { useAuthPrompt } from '../features/auth/hooks/useAuthPrompt.jsx';
import { getPlaceById } from '../api/placeApi.js';
import {
  fetchPlaceReviewStats,
  fetchPlaceReviews,
  fetchPlaceRatingDistribution,
  fetchMyPlaceReview,
  deletePlaceReview,
} from '../features/places/services/placeReviewService.js';
import { fetchPlaceBookmarkCount } from '../features/places/services/placeBookmarkService.js';
import { usePlaceDetailSections } from '../features/places/hooks/usePlaceDetailSections.js';
import ReviewCard from '../features/places/components/ReviewCard.jsx';
import ReviewComposer from '../features/places/components/ReviewComposer.jsx';
import DeleteReviewConfirmModal from '../features/places/components/DeleteReviewConfirmModal.jsx';
import RatingStatsCard, { computeRatingBadgeKey } from '../features/places/components/RatingStatsCard.jsx';
import Spinner from '../shared/components/Spinner.jsx';
import { BackIcon, CheckIcon, ChevronRightIcon, PencilIcon, PlusIcon, ShareIcon } from '../shared/components/Icon.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { buildReturnTo } from '../shared/utils/authRedirect.js';
import { buildPlaceReviewsShareUrl, shareOrCopyLink } from '../shared/utils/shareUtils.js';

const PAGE_SIZE = 5;
const SORT_OPTIONS = ['latest', 'oldest'];

/** Guides the user toward the write-review entry point directly above it — never
 *  rendered once that entry point no longer applies (already reviewed, composer
 *  already open, or no reviews yet — see the render conditions at the call site),
 *  so its click target can safely reuse the exact same handler as the button. */
function RecentVisitPromptCard({ onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center rounded-2xl border border-dashed border-ink/15 bg-white/50 px-5 py-6 text-center"
    >
      {/* 85% of the original h-11/w-11 (44px) circle and size=20 icon, both
          rounded to the nearest px: 44 * 0.85 = 37.4 -> 37px, 20 * 0.85 = 17px. */}
      <span className="flex h-[37px] w-[37px] shrink-0 items-center justify-center rounded-full bg-coral-tint text-coral">
        <PlusIcon size={17} />
      </span>
      <p className="mt-3 text-sm font-bold text-ink">{t('placeDetail.recentVisitPromptTitle')}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-faint">{t('placeDetail.recentVisitPromptBody')}</p>
    </button>
  );
}

/** Single-line "Newest ⌄" trigger + a small dropdown menu (open/closed local
 *  state) — replaces a side-by-side Newest/Oldest tab pair so only ONE sort
 *  name is ever visible at once. Mirrors ReviewCard's own outside-click/Esc
 *  menu pattern; unlike that one there's only ever one instance of this on the
 *  page, so no cross-instance "close others" event is needed. Neutral ink
 *  tones only — never coral — per the "don't compete with the actual coral
 *  accents (stars/bars/CTA)" requirement. */
function SortDropdown({ sort, onChange, t }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const sortLabel = (key) => (key === 'oldest' ? t('placeDetail.sortOldest') : t('placeDetail.sortLatest'));

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[0.8rem] font-semibold text-ink-soft"
      >
        {sortLabel(sort)}
        {/* ChevronRightIcon points right; rotate 90deg CLOCKWISE (not -90, which
            points it up) so it always reads as a downward "open menu" chevron,
            open or closed. */}
        <ChevronRightIcon size={11} className="rotate-90 text-ink-faint" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-xl border border-ink/8 bg-white shadow-card">
          {SORT_OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => { onChange(key); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-semibold ${sort === key ? 'bg-ink/5 text-ink' : 'text-ink-soft'}`}
            >
              {sortLabel(key)}
              {sort === key && <CheckIcon size={13} className="text-ink-soft" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaceReviewsPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state: routeState } = location;
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const { openAuthPrompt } = useAuthPrompt();
  const { getLabel, getEmpty } = usePlaceDetailSections();

  const numericPlaceId = Number(placeId);
  const isValidId = Number.isInteger(numericPlaceId) && numericPlaceId > 0;

  const [placeName, setPlaceName] = useState(routeState?.placeName ?? null);
  const [placeAddress, setPlaceAddress] = useState(routeState?.placeAddress ?? null);
  const [stats, setStats] = useState(null);
  const [distribution, setDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [sort, setSort] = useState('latest'); // 'latest' | 'oldest'
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [myReview, setMyReview] = useState(null);
  const [myReviewLoading, setMyReviewLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(!!routeState?.openWrite);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [photoWarning, setPhotoWarning] = useState(false);

  // 가게 저장 수 — 기존 get_place_bookmark_count RPC(placeBookmarkService.js)를
  // 그대로 재사용한다. 새 테이블·집계 컬럼·RPC는 추가하지 않았다.
  const [saveCount, setSaveCount] = useState(0);

  // 공유 — PlaceDetailSheet과 동일한 아이콘·로직(shareOrCopyLink)을 재사용하되,
  // URL만 이 화면 자신의 리뷰 전체 보기 주소로 바꾼다.
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState('');

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
        fetchPlaceReviews({ placeId: numericPlaceId, cursor: null, limit: PAGE_SIZE, sort }),
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
  }, [numericPlaceId, isValidId, sort]);

  // sort가 바뀌면(서버 재조회) loadFirstPage 자체가 새로 만들어져 이 effect가 다시
  // 실행된다 — 이미 불러온 일부 페이지만 클라이언트에서 뒤집는 방식은 쓰지 않는다.
  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  // 사진 일부 업로드 실패 안내 배너 — 잠시 보여준 뒤 자동으로 닫는다.
  useEffect(() => {
    if (!photoWarning) return;
    const timer = setTimeout(() => setPhotoWarning(false), 5000);
    return () => clearTimeout(timer);
  }, [photoWarning]);

  // 공유 링크 복사 결과 토스트 — 잠시 보여준 뒤 자동으로 닫는다.
  useEffect(() => {
    if (!shareToast) return;
    const timer = setTimeout(() => setShareToast(''), 3000);
    return () => clearTimeout(timer);
  }, [shareToast]);

  // 딥링크로 직접 들어온 경우에만 장소명·주소를 별도로 조회한다 (상세 시트에서
  // 넘어온 경우는 router state의 placeName/placeAddress로 충분).
  useEffect(() => {
    if (!isValidId || placeName) return;
    let cancelled = false;
    getPlaceById(numericPlaceId, locale)
      .then((p) => { if (!cancelled && p) { setPlaceName(p.name); setPlaceAddress(p.address); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [placeName, numericPlaceId, locale, isValidId]);

  // 저장 수 — 로그인 여부와 무관한 공개 집계이므로 placeId가 유효하면 항상 조회한다.
  useEffect(() => {
    if (!isValidId) { setSaveCount(0); return; }
    let cancelled = false;
    fetchPlaceBookmarkCount(numericPlaceId)
      .then((count) => { if (!cancelled) setSaveCount(count); })
      .catch(() => { if (!cancelled) setSaveCount(0); });
    return () => { cancelled = true; };
  }, [numericPlaceId, isValidId]);

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
      const next = await fetchPlaceReviews({ placeId: numericPlaceId, cursor: cursorRef.current, limit: PAGE_SIZE, sort });
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
  }, [loadingMore, hasMore, numericPlaceId, sort]);

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

  function handleSortChange(next) {
    if (next === sort) return;
    setSort(next);
  }

  // shareOrCopyLink() reaches navigator.share() with no `await` before it (see
  // PlaceDetailSheet's own handleShareClick, which this mirrors), so this still
  // satisfies browsers that require Web Share to start synchronously within the
  // click gesture.
  async function handleShareClick() {
    if (sharing || !isValidId) return;
    setSharing(true);
    const shareUrl = buildPlaceReviewsShareUrl(numericPlaceId);
    const name = placeName ?? t('placeDetail.allReviews');
    const result = await shareOrCopyLink({
      url: shareUrl,
      title: name,
      text: t('placeDetail.shareText', { name }),
    });
    if (result === 'copied') setShareToast(t('placeDetail.shareCopied'));
    else if (result === 'copyFailed') setShareToast(t('placeDetail.shareCopyFailed'));
    setSharing(false);
  }

  function handleWriteClick() {
    if (!user) { openAuthPrompt({ messageKey: 'placeDetail.loginToReview', returnTo: buildReturnTo(location) }); return; }
    setShowComposer(true);
  }

  function handleSubmitted(review, meta) {
    // 새 작성이든(맨 위에 없던 id) 방금 만든 자기 리뷰로의 수정 대체든, 목록에서
    // 같은 id를 교체하고 없으면 맨 위에 추가한다.
    setReviews((prev) => {
      const exists = prev.some((r) => r.id === review.id);
      return exists ? prev.map((r) => (r.id === review.id ? review : r)) : [review, ...prev];
    });
    setMyReview(review);
    setShowComposer(false);
    if (meta?.photosFailed) setPhotoWarning(true);
    // 방금 낸/고친 리뷰까지 반영된 평균/분포를 다시 조회한다.
    fetchPlaceReviewStats(numericPlaceId).then(setStats).catch(() => {});
    fetchPlaceRatingDistribution(numericPlaceId).then(setDistribution).catch(() => {});
  }

  function handleReviewEdited(updated, meta) {
    setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setMyReview(updated);
    setEditingReviewId(null);
    if (meta?.photosFailed) setPhotoWarning(true);
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
  const badgeKey = computeRatingBadgeKey({ distribution, reviewCount });
  // 아직 리뷰를 쓸 수 있는(비로그인 포함) 상태에서, 폼이 열리기 전에만 — 폼이
  // 열린 뒤에는 작성 버튼도 유도 카드도 더 보여줄 필요가 없다.
  const canOfferWrite = !myReviewLoading && !myReview && !showComposer;

  return (
    <div className="relative flex h-full flex-col bg-paper-soft">
      {/* 헤더 — 화면 최상단(safe area만 고려)에서 바로 시작. 가게 상세 화면과 같은
          배경(bg-paper-soft)을 그대로 써서 상세 → 리뷰 전체 보기 이동이 하나의
          흐름처럼 이어지게 한다. */}
      <div className="shrink-0 px-5 pb-[23px]" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink"
          >
            <BackIcon />
          </button>
          <button
            type="button"
            onClick={handleShareClick}
            disabled={sharing}
            aria-label={t('placeDetail.share')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink-faint"
          >
            <ShareIcon size={17} />
          </button>
        </div>
        <div className="font-display text-[0.6875rem] font-extrabold uppercase tracking-wider text-ink-faint">
          {getLabel('reviews', locale)}
        </div>
        <h1 className="mt-1 line-clamp-2 font-display text-[1.375rem] font-bold leading-tight tracking-tight text-ink">
          {placeName ?? t('placeDetail.allReviews')}
        </h1>
        {placeAddress && (
          <p className="mt-1 line-clamp-1 text-xs text-ink-faint">{placeAddress}</p>
        )}
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
            {photoWarning && (
              <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                {t('placeDetail.reviewSavedPhotosFailed')}
              </div>
            )}

            {/* 평점 통계 카드 — 목록만 보이는 상태와 작성 폼이 펼쳐진 상태 모두 이
                자리에서 같은 컴포넌트·같은 데이터로 그려진다(구조상 폼 토글과
                무관한 위치). 리뷰가 없으면 내부에서 스스로 아무것도 그리지
                않는다 — 억지 0.0/빈 막대 없음. */}
            <RatingStatsCard
              ratingAvg={ratingAvg}
              reviewCount={reviewCount}
              distribution={distribution}
              badgeKey={badgeKey}
              saveCount={saveCount}
              t={t}
            />

            {/* 모든 리뷰 헤더 행 + 정렬 드롭다운 — 리뷰가 있을 때만 의미가 있다.
                제목·정렬 모두 코랄이 아닌 중성 브라운/베이지 톤만 사용한다. */}
            {reviewCount > 0 && (
              <div className="mt-[30px] flex items-center justify-between gap-3">
                {/* Title and count are separate sibling elements spaced by a
                    real flex `gap` (not a literal space character) so the gap
                    itself is the single source of truth for their spacing. */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink-soft">{t('placeDetail.allReviews')}</span>
                  <span className="text-sm font-semibold text-ink-faint">{reviewCount}</span>
                </div>
                <SortDropdown sort={sort} onChange={handleSortChange} t={t} />
              </div>
            )}

            {/* 리뷰 작성 진입 — 본인이 이미 활성 리뷰를 갖고 있으면 별도 "이미
                작성했어요" 안내 없이 작성 버튼 자체를 숨긴다 — 수정은 아래 목록의
                자기 리뷰 카드 점 3개 메뉴에서만 한다. myReview가 있으면
                showComposer(딥링크 등으로 true여도)로는 어떤 폼도 열지 않는다.
                myReview 조회가 끝나기 전에는 아무것도 그리지 않는다. 버튼은
                내용에 맞는 fit-content가 아니라 콘텐츠 영역 전체 너비(w-full),
                화면 하단에 고정하지 않고 이 자리 그대로 흐른다. */}
            <div className={reviewCount > 0 ? 'mt-4' : 'mt-5'}>
              {myReviewLoading ? null : showComposer && !myReview ? (
                <ReviewComposer
                  placeId={numericPlaceId}
                  onSubmitted={handleSubmitted}
                  onCancel={() => setShowComposer(false)}
                />
              ) : myReview ? null : (
                <button
                  type="button"
                  onClick={handleWriteClick}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-[0.95rem] font-bold text-white"
                >
                  <PencilIcon size={16} />
                  {t('placeDetail.writeReviewFull')}
                </button>
              )}
            </div>

            {/* 최근 방문 유도 카드 — 다른 사람 리뷰가 이미 있는(=리뷰가 0개가
                아닌) 화면에서만, 작성 버튼을 아직 제안할 수 있는 동안만 보여준다.
                빈 상태(0개)에서는 작성 버튼 + 기존 빈 상태 안내만으로 충분해
                여기서는 표시하지 않는다(중복 방지). 작성 버튼과 같은 좌우 폭. */}
            {reviewCount > 0 && canOfferWrite && (
              <div className="mt-3">
                <RecentVisitPromptCard onClick={handleWriteClick} t={t} />
              </div>
            )}

            {/* 리뷰 목록 */}
            <div className="mt-4">
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

      <DeleteReviewConfirmModal
        open={deleteTarget != null}
        onCancel={handleCancelDeleteReview}
        onConfirm={handleConfirmDeleteReview}
        busy={deleteBusy}
        failed={deleteFailed}
      />

      {/* 공유 링크 복사 결과 토스트 — PlaceDetailSheet과 동일한 오버레이 패턴 */}
      {shareToast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-5">
          <div className="rounded-full bg-ink/85 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {shareToast}
          </div>
        </div>
      )}
    </div>
  );
}
