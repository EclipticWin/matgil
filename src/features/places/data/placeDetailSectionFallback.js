/** Static fallback for the 4 fixed place-detail sections — used when the DB
 *  tables are unreachable, matching the seed content in
 *  docs/sql-place-detail-bookmark-review-2026-07-12.md. */
const rows = [
  [
    'menu', 10,
    'Menu', '메뉴',
    'No menu info yet', '메뉴 정보가 아직 없어요',
    "We couldn't find menu details for this place yet.", '이 가게의 메뉴 정보를 아직 확인하지 못했어요.',
  ],
  [
    'reviews', 20,
    'Reviews', '리뷰',
    'No reviews yet', '아직 리뷰가 없어요',
    'Be the first to share your experience.', '첫 리뷰를 남겨보세요.',
  ],
  [
    'location', 30,
    'Location', '위치',
    'Location unavailable', '위치 정보가 없어요',
    "We don't have exact coordinates for this place yet.", '이 가게의 정확한 좌표 정보가 아직 없어요.',
  ],
  [
    'visit_info', 40,
    'Visit Info', '방문 정보',
    'No visit info yet', '방문 정보가 아직 없어요',
    "Hours, rest days, and other details aren't available yet.", '영업시간, 휴무일 등 방문 정보가 아직 준비되지 않았어요.',
  ],
];

export const PLACE_DETAIL_SECTION_FALLBACK = rows.map(
  ([key, sortOrder, labelEn, labelKo, emptyTitleEn, emptyTitleKo, emptyDescEn, emptyDescKo]) => ({
    key,
    sortOrder,
    isActive: true,
    translations: {
      en: { label: labelEn, emptyTitle: emptyTitleEn, emptyDescription: emptyDescEn },
      ko: { label: labelKo, emptyTitle: emptyTitleKo, emptyDescription: emptyDescKo },
    },
  }),
);
