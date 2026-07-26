import { cn } from '../../../shared/utils/classNames.js';
import { useFoodCategories } from '../../explore/context/FoodCategoryProvider.jsx';
import { useLocale } from '../../../shared/i18n/LocaleProvider.jsx';
import { PinIcon, ChevronRightIcon } from '../../../shared/components/Icon.jsx';
import FavoriteHeartIcon from '../../../shared/components/FavoriteHeartIcon.jsx';
import CourseStopPath from './CourseStopPath.jsx';
import { RANK_BAND_STYLES, RANK_MEDAL_SRC } from '../utils/rankDisplay.js';

/** Explore tab's public "routes" feed card — a dedicated component
 *  rather than another branch inside CourseCard, since this screen's info
 *  layout genuinely differs from every other CourseCard use (no distance/
 *  time, an anchor-address line instead, the stops badge moved inline with
 *  restaurant/cafe counts, an optional gold/silver/bronze rank region) — see
 *  CourseCard's own doc comment, which deliberately stops branching at
 *  `actionMode`/`isSaved`/`savedDateLabel` rather than growing further.
 *  Shares CourseStopPath (the 1→2→3 grid) with CourseCard so both stay
 *  identical instead of drifting apart as separate copies.
 *
 *  Two structural regions, not one: the top "info" button (rank line, title,
 *  anchor line, stops/restaurant/cafe line — colored for rank 1-3, plain
 *  white otherwise) is a full-bleed background block with its own bottom
 *  border, so the color visibly covers everything down to that border; the
 *  route path + save/view-detail row below always stay plain white,
 *  completely unaffected by rank.
 *
 *  `rank`: 1-based popular-sort position, or null for latest sort (see
 *  PublicRoutesTab for how this is computed — only meaningful when
 *  sort==='popular'). Shown as plain text for every rank; the
 *  gold/silver/bronze region + medal only render for 1/2/3.
 *  `anchorLabel`: pre-resolved current-locale "기준 위치" value (see
 *  getPublicCourseAnchorDisplay in courseDisplay.js), or null to render no
 *  line at all — the label/separator around it come from the dictionary so
 *  ko/en/zh-CN each get their own correct punctuation.
 *  `onToggleHeart`/`onViewDetail` are two independent actions: the whole card
 *  (this component's own outer element — `role="button"`/`tabIndex={0}`,
 *  same pattern PublicPlaceCard already uses) calls `onViewDetail` on
 *  click/Enter/Space, while the heart is a real nested `<button>` that calls
 *  `e.stopPropagation()` before `onToggleHeart` so a heart tap can never also
 *  fire the card's own navigation. The "동선 상세 보기" row is decorative text
 *  now (not its own button) — it used to duplicate `onViewDetail` on its own
 *  `<button>`, which after this change would have double-fired (once from
 *  itself, once from bubbling up to the card's own onClick). */
export default function PublicCourseCard({
  course,
  rank = null,
  anchorLabel = null,
  saveCount = 0,
  isSaved = false,
  busy = false,
  onToggleHeart,
  onViewDetail,
}) {
  const { locale, t } = useLocale();
  const { getCategoryLabel } = useFoodCategories();
  const stops = course.stops ?? [];

  // Same 'cafe' membership check CourseCard/courseBuilder's calcCafeBonus()
  // already use, computed from the actual stops on screen (not the RPC's own
  // stop_count, which this card never reads for this purpose).
  const cafeCount = stops.filter((s) => (s.matgilCategoryKeys ?? []).includes('cafe')).length;
  const restaurantCount = Math.max(0, stops.length - cafeCount);

  const rankStyle = rank != null && rank >= 1 && rank <= 3 ? RANK_BAND_STYLES[rank] : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewDetail}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetail(); } }}
      className="overflow-hidden rounded-3xl bg-white text-left shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]"
    >
      {/* Info region — rank/title/anchor/stops-counts, colored end-to-end for
          rank 1-3 (including its own bottom border) or plain white otherwise.
          A separate element from the white route-path region below it, not a
          shared padded box, so the color never bleeds past this border.
          Plain div now (not its own button) — the whole card above already
          handles the click/keyboard activation. */}
      <div
        className={cn(
          'w-full border-b border-ink/5 px-[0.9375rem] py-[0.9375rem]',
          rankStyle ? rankStyle.wrap : 'bg-white',
        )}
      >
        {rank != null && (
          <div className={cn('flex items-center justify-center gap-1', rankStyle ? rankStyle.text : 'text-ink-soft')}>
            {rankStyle && (
              <img
                src={RANK_MEDAL_SRC[rank]}
                alt=""
                aria-hidden="true"
                className="h-5 w-5 shrink-0 object-contain"
              />
            )}
            <span className="font-display text-sm font-extrabold">
              {t('publicFeed.rankLabel', { rank })}
            </span>
          </div>
        )}

        <h3
          title={course.title}
          className={cn(
            'truncate font-display text-[1.1875rem] font-bold leading-snug tracking-tight',
            rank != null && 'mt-2',
            rankStyle ? rankStyle.text : 'text-ink/90',
          )}
        >
          {course.title}
        </h3>

        {/* Divider between the title and the anchor/stops-counts block below
            it — a second, separate border from this region's own bottom
            border (see the outer <button>'s border-b), never doubled up at
            the same edge. Translucent so it reads naturally against both the
            white default background and the gold/silver/bronze rank tints. */}
        <div className={cn('mt-2 border-t', rankStyle ? 'border-black/10' : 'border-ink/5')} />

        {anchorLabel && (
          <p className={cn('mt-2 flex items-center gap-1 text-[0.78rem]', rankStyle ? rankStyle.text : 'text-ink-faint')}>
            <PinIcon size={11} className="shrink-0" />
            <span className={cn('shrink-0 font-semibold', rankStyle ? rankStyle.text : 'text-ink-soft')}>
              {t('publicFeed.anchorLocationLabel')}{t('publicFeed.anchorLocationSeparator')}
            </span>
            <span className="truncate">{anchorLabel}</span>
          </p>
        )}

        {/* Stops badge + restaurant/cafe counts, one line — replaces the
            top-right "N곳" badge this card used to have. */}
        <div
          className={cn(
            'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] font-semibold',
            rankStyle ? rankStyle.text : 'text-ink-soft',
          )}
        >
          <span
            className={cn(
              'inline-block shrink-0 rounded-md px-2 py-[0.1875rem] font-display text-[0.625rem] font-extrabold uppercase tracking-wide',
              rankStyle ? cn('bg-black/10', rankStyle.text) : 'bg-ink/10 text-ink-soft',
            )}
          >
            {t('courseDetail.stops', { n: stops.length })}
          </span>
          <span>
            {t('courseCard.restaurantCount', { n: restaurantCount })} · {t('courseCard.cafeCount', { n: cafeCount })}
          </span>
        </div>
      </div>

      {/* Route path + save/view-detail row — always plain white, never
          touched by the rank color above. */}
      <div className="bg-white px-[0.9375rem] pb-[0.9375rem]">
        <CourseStopPath stops={stops} locale={locale} getCategoryLabel={getCategoryLabel} t={t} />

        <div className="mt-3.5 border-t border-ink/5" />

        <div className="mt-3 flex min-h-[1.125rem] items-center justify-between gap-2">
          {/* Neutral stat, not a coral "saved" indicator — same color/weight
              as the "동선 상세 보기" button beside it (see courseCard.viewDetails
              below) regardless of isSaved, so this row reads as one plain
              stats-and-link pair instead of one side visually outshouting the
              other. The heart still toggles save/unsave; only its color no
              longer encodes saved state. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleHeart(); }}
            // Enter/Space on this focused button fires its own click (stopped
            // above), but the KEYDOWN itself still bubbles to the card's own
            // onKeyDown regardless of that stopPropagation (click and keydown
            // are separate dispatches) — stopped here too, or Enter/Space on
            // the heart would ALSO trigger the card's onViewDetail.
            onKeyDown={(e) => e.stopPropagation()}
            disabled={busy}
            aria-label={isSaved ? t('savedCourses.saved') : t('publicFeed.saveCourseAria')}
            className="inline-flex items-center gap-1 text-[0.72rem] font-bold text-ink-soft transition-colors hover:text-ink active:text-ink disabled:opacity-50"
          >
            <FavoriteHeartIcon active={isSaved} size={14} />
            {t('publicFeed.saveCount', { n: saveCount })}
          </button>

          {/* Decorative hint, not its own interactive element — the whole
              card already navigates to the same place on click/Enter/Space
              (see the outer div), so a second nested button here would just
              double-fire onViewDetail (once from itself, once from bubbling
              up to the card). */}
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[0.75rem] font-bold text-ink-soft">
            {t('courseCard.viewDetails')}
            <ChevronRightIcon size={11} aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
