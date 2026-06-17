# 04. Food Type 필터 — 프론트 연결 완료

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (03)

- `mg_places.matgil_category_keys text[]` 컬럼 Supabase에 추가 완료 (사용자 직접)
- 기존 테스트 데이터 10개에 `matgil_category_keys` 값 수동 업데이트 완료 (사용자 직접)
- 코드 수정 계획 수립까지 완료했으나 실제 파일 수정은 미실행 상태로 세션 종료

---

## 이번 세션에서 한 것

### 작업 범위 결정

03 세션에서 계획했던 Edge Function(`supabase/functions/mg-tour-seed/index.ts`) 신규 생성은 이번 작업에서 제외.

- 로컬에 해당 파일이 없으며, 기존에 Supabase에 배포된 버전이 동작 중
- 신규 생성 시 기존 수집 로직을 깨뜨릴 위험 있음
- 이번 작업 범위: **프론트 연결 2개 파일만** 수정

---

### 작업 1: `src/api/placeApi.js` 수정

**변경 내용:**

1. `.select()` 쿼리에 `matgil_category_keys` 추가:

```js
// 변경 전
id,
latitude,
longitude,
default_image_url,
mg_place_texts(...)

// 변경 후
id,
latitude,
longitude,
default_image_url,
matgil_category_keys,
mg_place_texts(...)
```

2. `normalizePlace` 반환 객체에 추가:

```js
matgilCategoryKeys: row.matgil_category_keys ?? [],
```

---

### 작업 2: `src/features/explore/data/exploreOptions.js` 수정

**변경 내용:**

1. `CATEGORY_KEYWORDS` 객체 전체 제거 (키워드 기반 임시 코드)

2. `matchesCat` 함수를 DB 배열 직접 비교 방식으로 교체:

```js
// 변경 전 (키워드 매칭)
const CATEGORY_KEYWORDS = { bbq: ['불고기', '갈비', ...], ... };
function matchesCat(place, cat) {
  if (cat === 'all') return true;
  const keywords = CATEGORY_KEYWORDS[cat] ?? [];
  const haystack = [place.name, place.firstMenu, ...].join(' ').toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

// 변경 후 (DB 배열 기반)
function matchesCat(place, cat) {
  if (cat === 'all') return true;
  return (place.matgilCategoryKeys ?? []).includes(cat);
}
```

3. `CATEGORIES` 배열을 DB `matgil_category_keys` 전체 key 기준으로 확장:

```js
// 변경 전 (6개)
{ key: 'all' }, { key: 'bbq' }, { key: 'street' },
{ key: 'noodle' }, { key: 'cafe' }, { key: 'stew' }, { key: 'chicken' }

// 변경 후 (19개)
all, bbq, noodle, stew, seafood, chicken, street, cafe,
rice, pork, chinese, japanese, western, pasta, pizza,
burger, indian, southeast_asian, other
```

---

## 동작 확인

- Street Food 선택 시 불고기집이 노출되던 false positive 문제 해소 확인
- `matgilCategoryKeys` 기반 필터링 정상 동작 확인

---

## 수정하지 않은 것 (의도적 제외)

- `supabase/functions/mg-tour-seed/index.ts` — 신규 생성 없음
- DB 마이그레이션 없음 (컬럼은 이미 존재)
- Supabase deploy 없음
- FilterSheet UI 구조 변경 없음
- HomePage / NearbySheet 구조 변경 없음
- `/popular` 관련 파일 변경 없음
- price / features 필터 변경 없음
- 다중 선택 UI 변경 없음

---

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| `mg_places.matgil_category_keys` 컬럼 | Supabase에 존재, 데이터 10개 입력 완료 |
| `getPlaces()` 반환값 | `matgilCategoryKeys` 포함 |
| Food Type 필터 | DB 배열 기반으로 동작 |
| FilterSheet 카테고리 목록 | 19개 (DB key 전체 반영) |
| Edge Function 로컬 파일 | 없음 (배포본만 존재) |

---

## 다음 세션 참고

- 신규 식당 데이터 수집 시 `matgil_category_keys` 값을 Edge Function에서 자동 분류하여 저장해야 함
- 현재 10개 수동 입력 데이터 외 신규 수집분은 이 값이 비어 있을 수 있음
- Edge Function 수정은 로컬 파일 없이 Supabase 대시보드에서 직접 편집하거나, 로컬 파일을 새로 생성하는 방식으로 접근 필요
