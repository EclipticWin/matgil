/** Static fallback for the 4 fixed place-detail sections — used when the DB
 *  tables are unreachable, matching the seed content in
 *  docs/sql-place-detail-bookmark-review-2026-07-12.md. */
const rows = [
  [
    'menu', 10,
    'Menu', '메뉴', '菜单',
    'No menu info yet', '메뉴 정보가 아직 없어요', '暂无菜单信息',
    "We couldn't find menu details for this place yet.", '이 가게의 메뉴 정보를 아직 확인하지 못했어요.', '暂未收录这家店的菜单信息。',
  ],
  [
    'reviews', 20,
    'Reviews', '리뷰', '评价',
    'No reviews yet', '아직 리뷰가 없어요', '暂无评价',
    'Be the first to share your experience.', '첫 리뷰를 남겨보세요.', '快来发布第一条评价吧。',
  ],
  [
    'location', 30,
    'Location', '위치', '位置',
    'Location unavailable', '위치 정보가 없어요', '暂无位置信息',
    "We don't have exact coordinates for this place yet.", '이 가게의 정확한 좌표 정보가 아직 없어요.', '暂未收录这家店的准确坐标信息。',
  ],
  [
    'visit_info', 40,
    'Visit Info', '방문 정보', '店铺信息',
    'No visit info yet', '방문 정보가 아직 없어요', '暂无店铺信息',
    "Hours, rest days, and other details aren't available yet.", '영업시간, 휴무일 등 방문 정보가 아직 준비되지 않았어요.', '营业时间、休息日等店铺信息暂未准备好。',
  ],
];

export const PLACE_DETAIL_SECTION_FALLBACK = rows.map(
  ([key, sortOrder, labelEn, labelKo, labelZh, emptyTitleEn, emptyTitleKo, emptyTitleZh, emptyDescEn, emptyDescKo, emptyDescZh]) => ({
    key,
    sortOrder,
    isActive: true,
    translations: {
      en: { label: labelEn, emptyTitle: emptyTitleEn, emptyDescription: emptyDescEn },
      ko: { label: labelKo, emptyTitle: emptyTitleKo, emptyDescription: emptyDescKo },
      'zh-CN': { label: labelZh, emptyTitle: emptyTitleZh, emptyDescription: emptyDescZh },
    },
  }),
);
