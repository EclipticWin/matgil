# 03. Food Type 필터 — matgil_category_keys 기반으로 전환

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (02)

- PageShell / PageHeader 공유 컴포넌트 도입으로 탭 페이지 리팩토링 완료

---

## 이번 세션에서 한 것

### 1단계: 키워드 기반 필터 임시 적용 (부분 실패)

`exploreOptions.js`의 `applyFilters`에서 `r.cat === f.cat` 조건이
Supabase place 객체(`r.cat` 필드 없음)에 동작하지 않는 것이 원인으로 확인되었다.

임시 수정으로 `CATEGORY_KEYWORDS` 맵과 `matchesCat` 함수를 추가하여
`name`, `firstMenu`, `treatMenu`, `tags` 문자열 기반 키워드 매칭으로 교체했다.

**문제 발생:**
- `treatMenu`/`tags` 필드에 예상 외 키워드가 포함되어 false positive 다수 발생
- 예: Korean BBQ 선택 시 `가양칼국수버섯매운탕` 표시됨
- 예: Street Food 선택 시 `가산물갈비&백년불고기` 표시됨

**결론:** 텍스트 키워드 기반 분류는 근본적으로 신뢰할 수 없다.

---

### 2단계: 구조 분석 및 DB 기반 분류 방향 결정

코드 분석 결과:

- `mg_places` 테이블에 `food_category_code_1/2/3` 컬럼이 이미 존재함 (`lclsSystm1/2/3` 저장용)
- Edge Function(`mg-tour-seed`)도 이 값을 저장하도록 설계되어 있음
- 그러나 TourAPI `lclsSystm` 실제 코드값을 앱 카테고리로 매핑하는 코드가 없음
- `getPlaces()`가 이 필드를 반환하지 않아 프론트에서 사용 불가능한 상태였음

**결정:** `lclsSystm` 코드 매핑 방식 대신, 앱 내부 카테고리 키 배열(`matgil_category_keys text[]`)을 `mg_places`에 직접 저장하는 방식 채택.

---

### 3단계: DB 컬럼 추가 및 기존 데이터 업데이트 (사용자 직접 완료)

사용자가 Supabase SQL Editor에서 직접:

- `mg_places.matgil_category_keys text[]` 컬럼 추가 완료
- 기존 테스트 데이터 10개에 `matgil_category_keys` 수동 업데이트 완료

---

### 4단계: 코드 수정 계획 수립 (미실행 — 다음 세션에서 진행)

세션 종료 전 수정 계획까지 확정했으나 **실제 파일 수정은 하지 않음**.

---

## 현재 `exploreOptions.js` 상태 (임시 키워드 방식 적용 중)

`src/features/explore/data/exploreOptions.js`에 현재 아래 코드가 남아 있다.
이는 임시 코드이며 다음 세션에서 교체 대상이다.

```js
const CATEGORY_KEYWORDS = {
  bbq:     ['불고기', '갈비', '고기', 'bbq', '바비큐', '구이'],
  street:  ['분식', '떡볶이', '순대', '튀김', '어묵', '길거리'],
  noodle:  ['칼국수', '냉면', '면', '국수', '라면', '우동', '짜장', '짬뽕'],
  cafe:    ['카페', '커피', '디저트', '케이크', '빵'],
  stew:    ['찌개', '탕', '국', '해장', '순두부', '된장'],
  chicken: ['치킨', '닭', '후라이드', '양념'],
};

function matchesCat(place, cat) {
  if (cat === 'all') return true;
  const keywords = CATEGORY_KEYWORDS[cat] ?? [];
  const haystack = [place.name, place.firstMenu, place.treatMenu, ...(place.tags ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}
```

---

## 다음 세션 작업 계획

### 전제 조건 (이미 완료)

- `mg_places.matgil_category_keys text[]` 컬럼: Supabase에 추가 완료
- 기존 데이터 10개 `matgil_category_keys` 값: 사용자가 직접 업데이트 완료

---

### 작업 1: `supabase/functions/mg-tour-seed/index.ts` 신규 생성

**현재 상태:** 로컬에 파일이 존재하지 않음. 명세는 `ai-docs/SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE.md`에만 있음.

**해야 할 것:**
- 가이드 문서 §9~§17 명세 기준으로 Edge Function 전체 코드 작성
- 아래 분류 함수를 포함할 것:

```ts
function classifyMatgilCategories(title: string, firstMenu: string | null): string[]
```

- `title` + `firstMenu`만 기준 (treatMenu, tags 제외)
- 카테고리 키별 키워드 룰 배열로 매칭
- 매칭 없으면 `['other']` 반환
- 한 식당이 복수 key 가질 수 있음

**분류 키워드 룰:**

| key | 키워드 |
|---|---|
| `bbq` | 불고기, 갈비, 구이, bbq, 바비큐, 연탄, 직화 |
| `noodle` | 칼국수, 국수, 냉면, 라면, 우동, 짜장, 짬뽕, 쌀국수, 면 |
| `stew` | 찌개, 매운탕, 해장국, 순두부, 된장, 부대찌개, 감자탕, 탕 |
| `seafood` | 해물, 생선, 회, 조개, 낙지, 문어, 꽃게, 아귀, 대게 |
| `chicken` | 치킨, 닭갈비, 삼계탕, 닭볶음, 닭강정 |
| `street` | 분식, 떡볶이, 순대, 튀김, 어묵, 김밥 |
| `cafe` | 카페, 커피, 디저트, 케이크, 베이커리, 빵, 와플 |
| `rice` | 비빔밥, 덮밥, 볶음밥, 솥밥, 오므라이스 |
| `pork` | 삼겹살, 항정살, 목살, 돼지, 족발, 보쌈 |
| `chinese` | 중식, 중국, 짜장, 짬뽕, 탕수육, 마라, 훠궈 |
| `japanese` | 일식, 일본, 초밥, 스시, 라멘, 돈카츠, 오마카세, 사시미 |
| `western` | 양식, 스테이크, 함박, 그릴 |
| `pasta` | 파스타, 스파게티, 리조또, 까르보나라 |
| `pizza` | 피자 |
| `burger` | 버거, 햄버거, 수제버거 |
| `indian` | 인도, 카레, 난, 탄두리 |
| `southeast_asian` | 태국, 베트남, 동남아, 팟타이, 월남쌈 |

- `mg_places` INSERT 시 `matgil_category_keys` 컬럼에 분류 결과 저장
- 저장 흐름: 가이드 §12 순서 그대로 (중복 체크 → mg_places → mg_place_sources → mg_place_texts → mg_place_food_details → mg_place_images → mg_api_fetch_logs)

---

### 작업 2: `src/api/placeApi.js` 수정

**변경 내용:**

1. SELECT 쿼리에 `matgil_category_keys` 추가:

```js
// 변경 전
.select(`id, latitude, longitude, default_image_url, mg_place_texts(...), ...`)

// 변경 후
.select(`id, latitude, longitude, default_image_url, matgil_category_keys, mg_place_texts(...), ...`)
```

2. `normalizePlace` 반환 객체에 추가:

```js
matgilCategoryKeys: row.matgil_category_keys ?? [],
```

---

### 작업 3: `src/features/explore/data/exploreOptions.js` 수정

**변경 내용:**

1. `CATEGORY_KEYWORDS` 전체 제거

2. `matchesCat` 단순화:

```js
// 변경 후
function matchesCat(place, cat) {
  if (cat === 'all') return true;
  return (place.matgilCategoryKeys ?? []).includes(cat);
}
```

3. `applyFilters`의 나머지 조건(price, features)은 그대로 유지

---

### 작업 순서 권장

```
작업 2 → 작업 3 → 작업 1
```

작업 2, 3은 프론트 단에서 즉시 테스트 가능하다.
작업 1(Edge Function)은 신규 데이터 수집 시 필요하며, 기존 10개 데이터는 이미 업데이트되어 있으므로 프론트 동작에는 영향 없다.

---

## 주의사항 (다음 세션에서도 유지)

- DB 마이그레이션 실행하지 마 (컬럼은 이미 추가되어 있음)
- Supabase deploy 하지 마
- FilterSheet UI 구조 바꾸지 마
- NearbySheet 구조 바꾸지 마
- HomePage 구조 바꾸지 마
- `/popular` 관련 파일 건드리지 마
- price/features 필터 수정하지 마
- 다중 선택 UI로 바꾸지 마

---

## 앱 카테고리 key 전체 목록

```
bbq, noodle, stew, seafood, chicken, street, cafe, rice,
pork, chinese, japanese, western, pasta, pizza, burger,
indian, southeast_asian, other
```

FilterSheet에 현재 노출된 카테고리 (`CATEGORIES` 배열):

```
all, bbq, street, noodle, cafe, stew, chicken
```

나머지 key(rice, pork, chinese, japanese, western, pasta, pizza, burger, indian, southeast_asian, other)는
DB와 Edge Function에서 저장하지만 현재 FilterSheet UI에는 노출하지 않는다.
추후 UI 확장 시 `exploreOptions.js`의 `CATEGORIES` 배열에 추가하면 된다.
