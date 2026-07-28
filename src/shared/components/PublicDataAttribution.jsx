import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';
import { useLocale } from '../i18n/LocaleProvider.jsx';
import { cn } from '../utils/classNames.js';

/** Small, quiet link to /data-sources (DataSourcesPage) — placed near public-data
 *  restaurant images so the source/license disclosure they're subject to is
 *  reachable without repeating a long attribution line next to every image.
 *  Deliberately link-styled (underline, ink-faint), never a coral/pill button —
 *  this is a disclosure pointer, not a call to action.
 *  Always right-aligned within whatever width its caller gives it (`block
 *  w-full text-right`) — every current placement sits directly below a
 *  public-data image or image list at that same content width, so this one
 *  change aligns the link everywhere without per-caller wrapper markup. */
export default function PublicDataAttribution({ className }) {
  const { t } = useLocale();
  return (
    <Link
      to={ROUTES.dataSources}
      className={cn('block w-full text-right text-[0.68rem] text-ink-faint underline underline-offset-2', className)}
    >
      {t('dataSources.imageSourceLink')}
    </Link>
  );
}
