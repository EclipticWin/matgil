import { useBookmarks } from '../shared/hooks/useBookmarks.jsx';
import PopularPlaceCard from '../features/popular/components/PopularPlaceCard.jsx';
import EmptyState from '../shared/components/EmptyState.jsx';
import { HeartIcon } from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** Bookmark tab: places the user has saved. */
export default function BookmarkPage() {
  const { items } = useBookmarks();
  const { t } = useLocale();

  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-ink">{t('bookmark.title')}</h1>

      {items.length === 0 ? (
        <EmptyState
          className="mt-20"
          icon={<HeartIcon size={26} />}
          title={t('bookmark.empty')}
          description={t('bookmark.emptyHint')}
        />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {items.map((place, i) => (
            <PopularPlaceCard key={place.id} place={place} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
