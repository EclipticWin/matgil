import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import PublicRoutesTab from '../features/courses/components/PublicRoutesTab.jsx';
import PublicPlacesTab from '../features/courses/components/PublicPlacesTab.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import UnderlineTabs from '../shared/components/UnderlineTabs.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { cn } from '../shared/utils/classNames.js';

const TABS = [
  { key: 'routes', labelKey: 'explore.tabs.routes' },
  { key: 'places', labelKey: 'explore.tabs.places' },
];

const SORTS = [
  { key: 'popular', labelKey: 'publicFeed.sortPopular' },
  { key: 'latest', labelKey: 'publicFeed.sortLatest' },
];

/** Small popular/latest segmented control — shared by both tabs below (one
 *  `sort` state lifted to this page), not a new package/select element. */
function SortControl({ value, onChange, t }) {
  return (
    <div role="group" aria-label={t('publicFeed.sortLabel')} className="inline-flex rounded-full bg-ink/6 p-0.5 text-[0.72rem] font-bold">
      {SORTS.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={value === s.key}
          onClick={() => onChange(s.key)}
          className={cn(
            'rounded-full px-3 py-1.5 transition-colors',
            value === s.key ? 'bg-white text-coral shadow-soft' : 'text-ink-soft',
          )}
        >
          {t(s.labelKey)}
        </button>
      ))}
    </div>
  );
}

/** Bottom nav's "Picks" tab (ROUTES.explore, /explore — route/component names
 *  unchanged even though the nav label itself has since moved past "Explore")
 *  — the app's public "routes/places saved by other travelers" feed (no login
 *  required to view), with its own popular/latest
 *  sort. "인기"/"popular" only ever appears in the sort control, never in the
 *  page title or the two internal tab labels, so switching to latest never
 *  leaves a mismatched "Popular ..." title on screen (see dictionary's
 *  `explore.*` keys — deliberately separate from `courses.*`, which is still
 *  used by the unrelated curated-course detail page).
 *  The user's own saved lists live on MyPage's "저장한 동선"/"저장한 가게"
 *  StatCards (see SavedRoutesPage/SavedPlacesPage) — those components
 *  (SavedRoutesTab/SavedPlacesTab) are unrelated to this page. */
export default function ExplorePage() {
  const { t } = useLocale();
  const location = useLocation();
  // Restores the tab/sort PublicCourseDetailPage's back button hands back via
  // router state (see its handleBack()) — undefined for every other way this
  // page is reached (bottom nav, direct URL), so those keep the plain
  // defaults below. `?tab=&sort=` query params are a second restoration path:
  // the guest "sign in to see more" CTA (PublicRoutesTab/PublicPlacesTab's
  // handleGuestCtaClick) encodes them into its `returnTo`, since useAuthPrompt
  // only ever carries a plain path string, not router state, across the
  // login round trip (see authRedirect.js). Only read once at mount; not
  // re-synced on later state changes, same as every other lazy-initial-state
  // usage in this codebase.
  const searchParams = new URLSearchParams(location.search);
  const [tab, setTab] = useState(location.state?.tab ?? searchParams.get('tab') ?? 'routes');
  const [sort, setSort] = useState(location.state?.sort ?? searchParams.get('sort') ?? 'popular');

  return (
    <PageShell>
      <PageHeader
        title={t('explore.title')}
        subtitle={t('explore.subtitle')}
        subtitleClassName="mt-1"
      />

      <UnderlineTabs
        tabs={TABS.map((item) => ({ id: item.key, label: t(item.labelKey) }))}
        value={tab}
        onChange={setTab}
        className="mt-4"
      />

      <div className="mt-3 flex justify-end">
        <SortControl value={sort} onChange={setSort} t={t} />
      </div>

      {/* Both tabs stay mounted (hidden via CSS) so switching back and forth
          never re-triggers their feed fetch — same pattern the old saved-list
          tabs used here. `active` tells the hidden one to stop its infinite-scroll
          IntersectionObserver rather than keep requesting pages in the background. */}
      <div className={tab === 'routes' ? 'mt-4' : 'hidden'}>
        <PublicRoutesTab sort={sort} active={tab === 'routes'} />
      </div>
      <div className={tab === 'places' ? 'mt-4' : 'hidden'}>
        <PublicPlacesTab sort={sort} active={tab === 'places'} />
      </div>
    </PageShell>
  );
}
