import { useEffect, useState } from 'react';
import Thumbnail from '../../../shared/components/Thumbnail.jsx';
import {
  BackIcon,
  PinIcon,
  WalkIcon,
  ClockIcon,
  ChevronRightIcon,
  BookmarkIcon,
  CheckIcon,
} from '../../../shared/components/Icon.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { pickTranslated } from '../../../shared/i18n/localeFallback.js';
import { getDisplayMetrics } from '../../courses/utils/courseMetrics.js';
import { formatStopStatsParts } from '../../courses/utils/courseDisplay.js';
import { fetchPlaceReviewStatsBatch } from '../../places/services/placeReviewService.js';
import { fetchPlaceBookmarkStatsBatch } from '../../places/services/placeBookmarkService.js';
import Spinner from '../../../shared/components/Spinner.jsx';

/** Map Bottom Sheet 내부 코스 상세 콘텐츠.
 *  onSave: () => void — save button callback (omit to hide button)
 *  saveState: 'idle' | 'checking' | 'saving' | 'saved' | 'failed' | 'duplicate' */
export default function TodayCourseDetail({ course, selectedLocation, onBack, onSelectPlace, onSave, saveState = 'idle' }) {
  const { locale, t } = useLocale();
  const stopCount = course.stopCount ?? course.stops.length;
  const locationLabel = pickTranslated(
    { ko: selectedLocation?.labelKo, en: selectedLocation?.label, 'zh-CN': selectedLocation?.labelZh },
    locale,
  ) ?? 'here';
  const blurb = t('courseDetail.blurb', { location: locationLabel });

  const { displayDistance, displayDuration } = getDisplayMetrics(course, locale);

  // Review stats for every stop, fetched in one batched request (no per-stop N+1).
  // Depends on the stop id set, not the stops array reference, so re-fetching only
  // happens when the actual set of places changes.
  const stopIdsKey = [...new Set((course.stops ?? []).map((s) => s.id).filter((id) => id != null))].join(',');
  const [reviewStatsById, setReviewStatsById] = useState(new Map());

  useEffect(() => {
    if (!stopIdsKey) {
      setReviewStatsById(new Map());
      return;
    }
    let cancelled = false;
    fetchPlaceReviewStatsBatch(stopIdsKey.split(',').map(Number))
      .then((statsMap) => { if (!cancelled) setReviewStatsById(statsMap); })
      .catch(() => { if (!cancelled) setReviewStatsById(new Map()); });
    return () => { cancelled = true; };
  }, [stopIdsKey]);

  // Save counts (mg_place_bookmark_stats), same batching discipline as review stats
  // above — one request for the whole course, independent of the review-stats query
  // since they're two separate views (docs/42 §6).
  const [saveCountById, setSaveCountById] = useState(new Map());

  useEffect(() => {
    if (!stopIdsKey) {
      setSaveCountById(new Map());
      return;
    }
    let cancelled = false;
    fetchPlaceBookmarkStatsBatch(stopIdsKey.split(',').map(Number))
      .then((countMap) => { if (!cancelled) setSaveCountById(countMap); })
      .catch(() => { if (!cancelled) setSaveCountById(new Map()); });
    return () => { cancelled = true; };
  }, [stopIdsKey]);

  const isBusy = saveState === 'checking' || saveState === 'saving';
  const isSaved = saveState === 'saved';

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
          {t('courseDetail.label')}
        </div>
        <h2 className="mt-1.5 font-display text-[1.5rem] font-bold leading-[1.1] tracking-tight text-ink">
          {course.title}
        </h2>
        <div className="mt-2.5 flex items-center gap-4 text-[0.8rem] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <PinIcon size={13} /> {t('courseDetail.stops', { n: stopCount })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WalkIcon /> {displayDistance}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> {displayDuration}
          </span>
        </div>
      </div>

      {/* 스크롤 본문 */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">{blurb}</p>

        <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-ink-faint">
          {t('courseDetail.routeStops')}
        </div>

        <div className="relative space-y-3">
          <div
            className="absolute bottom-10 left-[1.0625rem] top-10 w-[2.5px]"
            style={{
              background:
                'repeating-linear-gradient(180deg, rgba(248,72,31,0.45) 0 5px, transparent 5px 12px)',
            }}
          />

          {course.stops.map((stop, i) => {
            const subtitle = stop.firstMenu || t('courseDetail.restaurantFallback');
            const { head: statsHead, distance } = formatStopStatsParts(
              stop,
              reviewStatsById.get(stop.id),
              saveCountById.get(stop.id),
              t('courseDetail.noRatings'),
            );

            return (
              <button
                key={stop.id ?? i}
                type="button"
                onClick={() => onSelectPlace?.(stop)}
                className="relative flex w-full items-center gap-5 text-left"
              >
                <div className="z-[1] flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-coral font-display text-[0.9375rem] font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)]">
                  {i + 1}
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-ink/5 bg-white/45 px-3 py-3 shadow-[0_0.25rem_1rem_rgba(34,24,20,0.04)]">
                  <Thumbnail
                    src={stop.imageUrl}
                    tint={stop.tint}
                    className="h-14 w-14 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-bold text-ink">{stop.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">{subtitle}</p>
                    {/* flex-wrap (not truncate) — distance only drops to its own line
                        when the row is too narrow to fit alongside the rating/save
                        count, so no part of the stats is ever cut off (docs/42 §4). */}
                    <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-ink-faint">
                      <span className="whitespace-nowrap">{statsHead}</span>
                      {distance && <span className="whitespace-nowrap">{distance}</span>}
                    </div>
                  </div>

                  <ChevronRightIcon size={14} className="shrink-0 text-ink-faint" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save 버튼 — onSave가 있을 때만 표시 */}
      {onSave && (
        <div className="shrink-0 border-t border-ink/5 bg-paper-soft px-5 pb-5 pt-3">
          <button
            type="button"
            disabled={isBusy || isSaved}
            onClick={onSave}
            className={[
              'inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-bold transition-colors disabled:cursor-default',
              isSaved
                ? 'bg-stone-100 text-stone-500'
                : saveState === 'failed' || saveState === 'duplicate'
                ? 'bg-stone-100 text-stone-400'
                : 'bg-coral text-white shadow-[0_2px_6px_rgba(248,72,31,0.16)] active:bg-coral-deep disabled:bg-coral/40 disabled:shadow-none',
            ].join(' ')}
          >
            {isBusy ? (
              <Spinner className="h-5 w-5 border-white/30 border-t-white" />
            ) : isSaved ? (
              <CheckIcon size={18} />
            ) : (
              <BookmarkIcon size={18} />
            )}
            {isBusy
              ? t('savedCourses.saving')
              : isSaved
              ? t('savedCourses.saved')
              : saveState === 'duplicate'
              ? t('savedCourses.duplicateError')
              : saveState === 'failed'
              ? t('savedCourses.saveFailed')
              : t('savedCourses.save')}
          </button>
        </div>
      )}
    </div>
  );
}
