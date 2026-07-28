import { useNavigate } from 'react-router-dom';
import Card from '../shared/components/Card.jsx';
import { BackIcon } from '../shared/components/Icon.jsx';
import { PUBLIC_DATA_SOURCES, KOGL_INFO_URL } from '../shared/constants/publicDataSources.js';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

/** One government data-source listing — officialName stays Korean in every
 *  locale (see publicDataSources.js doc comment); only the field labels
 *  around it (provider/department/dates/license scope) are translated. */
function SourceCard({ source, t }) {
  return (
    <Card rounded="rounded-2xl" className="p-4">
      <p className="text-[0.95rem] font-bold leading-snug text-ink">{source.officialName}</p>
      <div className="mt-3 space-y-1.5 text-xs text-ink-soft">
        <p><span className="font-semibold text-ink-faint">{t('dataSources.fieldProvider')}: </span>{source.provider}</p>
        <p><span className="font-semibold text-ink-faint">{t('dataSources.fieldDepartment')}: </span>{source.department}</p>
        <p><span className="font-semibold text-ink-faint">{t('dataSources.fieldRegistered')}: </span>{source.registeredDate}</p>
        <p><span className="font-semibold text-ink-faint">{t('dataSources.fieldUpdated')}: </span>{source.updatedDate}</p>
        <p><span className="font-semibold text-ink-faint">{t('dataSources.fieldLicenseScope')}: </span>{source.licenseScope}</p>
      </div>
      <a
        href={source.portalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-bold text-coral underline underline-offset-2"
      >
        {t('dataSources.viewSource')}
      </a>
    </Card>
  );
}

/** Public data & image source disclosure — no login required (see ROUTES.dataSources
 *  in router.jsx). Reached from LoginPage's footer link, MyPage's Settings section,
 *  and the PublicDataAttribution link placed near public-data restaurant images. */
export default function DataSourcesPage() {
  const navigate = useNavigate();
  const { t } = useLocale();

  return (
    <div className="flex h-full flex-col bg-paper-soft">
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="shrink-0 px-5 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/8 text-ink"
          >
            <BackIcon />
          </button>
          <h1 className="font-display text-[1.375rem] font-bold tracking-tight text-ink">
            {t('dataSources.pageTitle')}
          </h1>
        </div>

        <div className="flex flex-col gap-3 px-5 pb-10">
          <Card rounded="rounded-2xl" className="p-4">
            <p className="text-sm leading-relaxed text-ink-soft">{t('dataSources.intro')}</p>
          </Card>

          <div>
            <p className="mb-2 text-[0.78rem] font-extrabold uppercase tracking-wide text-ink-faint">
              {t('dataSources.usedDataTitle')}
            </p>
            <div className="flex flex-col gap-3">
              {PUBLIC_DATA_SOURCES.map((source) => (
                <SourceCard key={source.id} source={source} t={t} />
              ))}
            </div>
          </div>

          <Card rounded="rounded-2xl" className="p-4">
            <p className="mb-1.5 text-[0.85rem] font-bold text-ink">{t('dataSources.processingTitle')}</p>
            <p className="text-sm leading-relaxed text-ink-soft">{t('dataSources.processingBody')}</p>
          </Card>

          <Card rounded="rounded-2xl" className="p-4">
            <p className="mb-1.5 text-[0.85rem] font-bold text-ink">{t('dataSources.imageTitle')}</p>
            <p className="text-sm leading-relaxed text-ink-soft">{t('dataSources.imageBody')}</p>
            <a
              href={KOGL_INFO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-bold text-coral underline underline-offset-2"
            >
              {t('dataSources.koglLinkLabel')}
            </a>
          </Card>

          <Card rounded="rounded-2xl" className="p-4">
            <p className="mb-1.5 text-[0.85rem] font-bold text-ink">{t('dataSources.attributionTitle')}</p>
            <p className="text-sm leading-relaxed text-ink-soft">{t('dataSources.attributionBody')}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
