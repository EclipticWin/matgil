/** Single source of truth for the three government tourism-data APIs Matgil's
 *  restaurant data (and, for some rows, restaurant image URLs) is built from —
 *  see docs/64 for the data/image-attribution page these feed (DataSourcesPage.jsx).
 *
 *  `officialName` is the exact listing title on the Public Data Portal and must
 *  stay in Korean in every locale — it is not translated, abbreviated (never
 *  "TourAPI"), or paraphrased anywhere it is displayed. `provider`/`department`/
 *  `licenseScope` are likewise the portal's own Korean field values, kept as-is
 *  across locales rather than invented per-language equivalents. Only the field
 *  *labels* around these values (e.g. "제공기관"/"Provider") are translated, via
 *  the `dataSources.*` dictionary keys.
 *
 *  All three sources are always shown together, in every locale — no code may
 *  pick just one based on the current locale, since individual image URLs
 *  cannot currently be traced back to which specific service provided them. */
export const PUBLIC_DATA_SOURCES = [
  {
    id: 'kto-ko',
    officialName: '한국관광공사_국문 관광정보 서비스_GW',
    portalUrl: 'https://www.data.go.kr/data/15101578/openapi.do',
    provider: '한국관광공사',
    department: '디지털인프라팀',
    registeredDate: '2022-06-24',
    updatedDate: '2026-02-26',
    licenseScope: '이용허락범위 제한 없음',
  },
  {
    id: 'kto-en',
    officialName: '한국관광공사_영문 관광정보서비스_GW',
    portalUrl: 'https://www.data.go.kr/data/15101753/openapi.do',
    provider: '한국관광공사',
    department: '디지털인프라팀',
    registeredDate: '2022-06-29',
    updatedDate: '2026-02-26',
    licenseScope: '이용허락범위 제한 없음',
  },
  {
    id: 'kto-zh',
    officialName: '한국관광공사_중문 간체 관광정보서비스_GW',
    portalUrl: 'https://www.data.go.kr/data/15101764/openapi.do',
    provider: '한국관광공사',
    department: '디지털인프라팀',
    registeredDate: '2022-06-29',
    updatedDate: '2026-02-26',
    licenseScope: '이용허락범위 제한 없음',
  },
];

/** Official KOGL (공공누리) license-terms page — linked from the image
 *  attribution section instead of restating license details in full. */
export const KOGL_INFO_URL = 'https://www.kogl.or.kr/info/license.do';
