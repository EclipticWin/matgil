# 음식 카테고리 DB 전환 및 사용자 화면 연동 작업 지시서

## 작성 정보

- 작성 일시: 2026-07-11 16:10 KST
- 대상 프로젝트: 맛길(Matgil)
- 사용 가능 에이전트: Claude Code 또는 Codex
- 작업 성격: DB 설계 문서 작성 + 프론트엔드 구현
- DB 실행 주체: 사용자
- 관리자 화면 구현: 이번 작업에서 제외

---

# 1. 작업 목적

현재 음식 카테고리 목록과 다국어 표시값이 프론트 코드에 하드코딩되어 있다.

현재 구조의 예:

```js
{
  key: 'bbq',
  label: 'Korean BBQ',
  labelKo: '한국식 BBQ',
}
```

또한 다음 정보도 여러 코드에 분산되어 있다.

- 음식 카테고리 key
- 영어·한국어 표시값
- 정렬 순서
- 필터 노출 여부
- 카테고리 아이콘
- 코스 제목 생성 규칙
- TourAPI 신규 음식점 자동 분류 규칙

이번 작업의 핵심 목표는 다음과 같다.

1. 음식 카테고리 본체와 다국어 표시값을 Supabase DB로 이동한다.
2. 기존 `mg_places.matgil_category_keys`와 완전히 호환되게 유지한다.
3. 필터와 장소 상세 화면이 DB 카테고리를 사용하도록 변경한다.
4. DB 장애나 아직 SQL을 실행하지 않은 상태에서도 기존 기능이 깨지지 않도록 임시 fallback을 유지한다.
5. 향후 관리자 CRUD 화면을 붙일 수 있는 DB 구조를 준비한다.
6. 카테고리 key 자체는 변경하지 않고 표시값만 관리할 수 있게 한다.
7. `bbq`의 한국어 표시값을 `한국식 BBQ`가 아니라 `고기 구이`로 변경한다.
8. 코스 제목 중복 로직을 한 곳으로 통합한다.
9. 카테고리 표시값 변경으로 저장 코스가 중복 저장되는 문제를 방지한다.

---

# 2. 현재 확인된 실제 DB 상태

다음 내용은 2026-07-11 Supabase 조회 결과로 확인됐다.

## 기존 테이블 존재 여부

```text
public.mg_food_categories:
없음

public.mg_food_category_translations:
없음
```

따라서 신규 테이블명 충돌은 없다.

## 현재 카테고리 저장 컬럼

```text
public.mg_places.matgil_category_keys
```

실제 타입:

```text
text[]
```

속성:

```text
NOT NULL
DEFAULT '{}'
GIN 인덱스 존재
```

## 현재 장소 및 카테고리 상태

```text
전체 장소:
1,633건

NULL 배열:
0건

빈 배열:
0건

배열 내부 중복:
0건

코드에 정의되지 않은 key:
0건

실제 사용 key:
18개
```

## 현재 실제 key

```text
bbq
noodle
stew
seafood
chicken
street
cafe
rice
pork
chinese
japanese
western
pasta
pizza
burger
indian
southeast_asian
other
```

`all`은 DB 카테고리가 아니라 프론트의 전체 선택용 가상 옵션이다.

## 대표 카테고리 순서

현재 추천 코드는 `matgil_category_keys[0]`을 대표 카테고리처럼 사용한다.

그러므로 배열 순서는 기능적으로 의미가 있다.

이번 작업에서는 배열이나 배열 순서를 변경하지 않는다.

## `other`

- `other` 사용 장소: 612건
- `other`와 다른 key가 함께 저장된 장소: 0건

`other`는 어떤 분류 규칙에도 일치하지 않을 때만 사용하는 fallback key로 유지한다.

## 기존 공용 함수

다음 함수가 DB에 이미 존재한다.

```text
public.set_updated_at()
```

신규 테이블의 `updated_at` 트리거는 이 함수를 재사용한다.

## 기존 locale 구조

`mg_place_texts`는 다음 유니크 제약만 갖는다.

```text
UNIQUE(place_id, locale)
```

`ko`, `en`만 허용하는 CHECK 제약은 없다.

신규 번역 테이블도 locale을 행으로 저장하여 `ja`, `zh`, `fr` 등 새 언어를 컬럼 추가 없이 지원할 수 있게 한다.

---

# 3. 판단 우선순위

코드와 문서가 충돌하면 다음 순서를 따른다.

1. 현재 실제 코드
2. 2026-07-11 실제 Supabase 조회 결과
3. `docs/28-food-category-db-current-state-and-verification.md`
4. 최신 `docs`
5. 최신 `ai-docs`
6. 과거 계획 또는 mock 코드

레거시 추천 위저드와 mock 데이터는 현재 사용자 Map 추천 기능의 기준으로 사용하지 않는다.

---

# 4. 반드시 먼저 읽을 문서

작업 전 다음 문서를 읽는다.

```text
docs/28-food-category-db-current-state-and-verification.md
docs/2026-07-11-MATGIL-PROJECT-AUDIT.md
docs/2026-07-11-MATGIL-OPEN-ISSUES.md
docs/2026-07-11-PLAN-food-category-management.md
```

파일명이 조금 다르면 `docs`에서 가장 가까운 최신 파일을 찾는다.

기존 문서를 덮어쓰지 않는다.

---

# 5. 반드시 확인할 코드

다음 파일을 직접 읽고 현재 코드 기준으로 작업한다.

```text
src/app/providers.jsx
src/api/placeApi.js
src/pages/HomePage.jsx

src/features/explore/data/exploreOptions.js
src/features/explore/components/FilterSheet.jsx
src/features/explore/components/PlaceDetailSheet.jsx
src/features/explore/components/CategoryIcon.jsx
src/features/explore/data/courseBuilder.js

src/features/courses/utils/courseDisplay.js
src/features/courses/services/savedCourseService.js

src/features/explore/components/NearbySheet.jsx

src/shared/i18n/LocaleProvider.jsx
src/shared/i18n/dictionary.js

supabase/functions/mg-tour-seed/index.ts
```

추가로 다음 문자열의 실제 사용처를 다시 확인한다.

```text
CATEGORIES
matgilCategoryKeys
matgil_category_keys
KO_TITLES
EN_TITLES
courseTitle
한국식 BBQ
```

---

# 6. 이번 작업에서 제외할 코드

다음은 Community 또는 Phrases의 별도 카테고리 체계이므로 수정하지 않는다.

```text
WRITE_CATEGORIES
mg_phrase_categories
PHRASE_CATEGORIES
PhraseCategoryTabs
```

다음은 레거시 또는 mock 계열이므로 이번 DB 카테고리 구조에 연결하지 않는다.

```text
src/features/courses/data/courses.js
src/features/preference/data/preferenceOptions.js
src/features/recommendation/data/mockRecommendations.js
src/features/popular/data/mockPopularPlaces.js
```

Phrases의 다음 문장은 음식 카테고리 데이터가 아니라 일반 영어 설명이므로 변경 대상이 아니다.

```text
Used for cutting meat at Korean BBQ.
```

---

# 7. 절대 금지 사항

이번 작업에서 다음을 하지 않는다.

```text
Supabase SQL 직접 실행
DB 데이터 직접 변경
기존 mg_places.matgil_category_keys 수정
기존 1,633개 장소 재분류
matgil_category_keys 컬럼 삭제
GIN 인덱스 삭제
mg-tour-seed 자동 분류 규칙 변경
mg-tour-seed 재배포
관리자 계정 생성
관리자 역할 모델 구현
관리자 화면 구현
mg_place_food_categories 생성
Community/Phrases 카테고리 수정
패키지 추가
UI 디자인 임의 변경
레거시 전체 정리
git add
git commit
git push
```

SQL은 문서로만 작성하며 실행은 사용자가 한다.

현재 작업 트리의 기존 변경사항을 삭제하거나 덮어쓰지 않는다.

---

# 8. 1차 목표 DB 구조

이번 작업에서는 다음 두 테이블만 신규 설계한다.

```text
public.mg_food_categories
public.mg_food_category_translations
```

## 8.1 `mg_food_categories`

언어와 관계없는 카테고리 본체다.

필수 컬럼:

```text
key text primary key
icon_key text not null
sort_order integer not null
is_active boolean not null
is_filterable boolean not null
created_at timestamptz not null
updated_at timestamptz not null
created_by uuid null
updated_by uuid null
deleted_at timestamptz null
deleted_by uuid null
```

권장 기본값:

```text
icon_key:
'default'

sort_order:
999

is_active:
false

is_filterable:
false

created_at:
now()

updated_at:
now()
```

신규 카테고리는 관리자 기능이 생겼을 때 곧바로 사용자 필터에 노출되지 않도록 기본값을 비활성 상태로 한다.

기존 18개 seed만 명시적으로 다음 상태로 저장한다.

```text
is_active = true
is_filterable = true
```

규칙:

- `key`는 생성 후 변경하지 않는다.
- key는 영문 소문자, 숫자, underscore만 허용한다.
- 실제 삭제 대신 `is_active=false`, `is_filterable=false`, `deleted_at`을 사용한다.
- `created_by`, `updated_by`, `deleted_by`는 향후 관리자 감사로그 확장을 위한 컬럼이며 초기 seed에서는 null이어도 된다.
- `all`은 저장하지 않는다.
- `other`는 삭제하지 않는다.
- `keywords`는 이번 테이블에 넣지 않는다.
- 추천 점수와 관련된 설정도 이번 테이블에 넣지 않는다.

## 8.2 `mg_food_category_translations`

카테고리의 언어별 표시값을 저장한다.

필수 컬럼:

```text
category_key text not null
locale text not null
label text not null
description text null
created_at timestamptz not null
updated_at timestamptz not null
created_by uuid null
updated_by uuid null
```

키와 제약:

```text
PRIMARY KEY(category_key, locale)

category_key
→ public.mg_food_categories(key)
→ ON DELETE RESTRICT
```

규칙:

- locale별 컬럼을 추가하지 않는다.
- `label_en`, `label_ko`, `label_ja` 구조로 만들지 않는다.
- `locale`은 빈 문자열을 허용하지 않는다.
- `label`은 빈 문자열을 허용하지 않는다.
- 현재는 `en`, `ko`를 seed한다.
- 향후 `ja`, `zh`, 기타 locale을 행 추가만으로 확장할 수 있어야 한다.

## 8.3 `updated_at` 트리거

두 테이블 모두 기존 함수를 재사용한다.

```text
public.set_updated_at()
```

새로운 동일 기능 함수를 중복 생성하지 않는다.

---

# 9. RLS와 권한 정책

아직 관리자 역할 모델이 없으므로 이번에는 읽기 정책만 만든다.

## 공개 조회

다음 역할은 카테고리와 번역을 조회할 수 있다.

```text
anon
authenticated
```

카테고리명은 민감정보가 아니며, 과거 저장 코스의 비활성 key도 label로 해석해야 하므로 DB SELECT 정책에서 `is_active=true`로 제한하지 않는다.

즉, RLS 조회 정책은 전체 row 조회를 허용한다.

필터 노출 여부는 프론트에서 아래 조건으로 판단한다.

```text
is_active = true
is_filterable = true
deleted_at is null
```

## 쓰기 차단

다음 권한은 `anon`, `authenticated`에게 허용하지 않는다.

```text
INSERT
UPDATE
DELETE
```

관리자 쓰기 정책은 관리자 기반이 생기는 후속 작업에서 추가한다.

SQL 문서에는 다음을 명시적으로 포함한다.

```text
grant select
revoke insert
revoke update
revoke delete
```

---

# 10. 초기 seed 데이터

`all`은 제외하고 아래 18개를 저장한다.

| key | label_en | label_ko | icon_key | sort_order |
|---|---|---|---|---:|
| bbq | Korean BBQ | 고기 구이 | bbq | 10 |
| noodle | Noodles | 면 요리 | noodle | 20 |
| stew | Stew & Soup | 찌개·탕 | stew | 30 |
| seafood | Seafood | 해산물 | default | 40 |
| chicken | Chicken | 치킨 | chicken | 50 |
| street | Street Food | 길거리 음식 | street | 60 |
| cafe | Cafe & Dessert | 카페·디저트 | cafe | 70 |
| rice | Rice Meals | 밥·덮밥 | default | 80 |
| pork | Pork Cutlet & Pork | 돼지고기 | default | 90 |
| chinese | Chinese | 중식 | default | 100 |
| japanese | Japanese | 일식 | default | 110 |
| western | Western | 양식 | default | 120 |
| pasta | Pasta | 파스타 | default | 130 |
| pizza | Pizza | 피자 | default | 140 |
| burger | Burger | 버거 | default | 150 |
| indian | Indian | 인도 음식 | default | 160 |
| southeast_asian | Southeast Asian | 동남아 음식 | default | 170 |
| other | Other | 기타 | default | 999 |

Seed SQL은 재실행해도 중복 오류가 나지 않도록 `ON CONFLICT`를 고려한다.

단, 기존 데이터를 의도치 않게 덮어쓰지 않도록 어떤 컬럼을 update할지 명시한다.

---

# 11. SQL 문서 생성

다음 문서를 새로 만든다.

```text
docs/sql-food-categories-2026-07-11.md
```

문서 제목은 한글로 한다.

```text
음식 카테고리 DB 전환 SQL
```

반드시 포함할 것:

1. 작성 일시
2. 작업 목적
3. 실행 전 확인 SQL
4. DDL
5. RLS
6. grant/revoke
7. 기존 `set_updated_at()` 트리거 적용
8. 18개 카테고리 seed
9. EN/KO 번역 36행 seed
10. 실행 후 검증 SQL
11. 기존 `mg_places.matgil_category_keys`와 key 비교 SQL
12. `bbq / ko / 고기 구이` 확인 SQL
13. RLS 정책 확인 SQL
14. rollback SQL
15. 사용자가 직접 실행해야 한다는 안내
16. 실행 순서
17. 실행 중 오류가 발생했을 때 중단 기준

SQL을 자동 실행하지 않는다.

가능하면 DDL과 seed는 transaction 단위로 안전하게 작성한다.

검증 기준:

```text
mg_food_categories:
18행

mg_food_category_translations:
36행

locale=en:
18행

locale=ko:
18행

mg_places에서 사용 중이지만 category 테이블에 없는 key:
0행

bbq의 ko label:
고기 구이
```

---

# 12. 프론트 데이터 계층

## 12.1 신규 API 파일

다음 파일을 만든다.

```text
src/api/foodCategoryApi.js
```

역할:

- `mg_food_categories` 전체 조회
- `mg_food_category_translations` 전체 조회
- 두 결과를 카테고리별 구조로 정규화
- DB 에러를 상위 호출자에게 전달
- 무음 catch 금지

예상 정규화 shape:

```js
{
  key: 'bbq',
  iconKey: 'bbq',
  sortOrder: 10,
  isActive: true,
  isFilterable: true,
  deletedAt: null,
  translations: {
    en: {
      label: 'Korean BBQ',
      description: null,
    },
    ko: {
      label: '고기 구이',
      description: null,
    },
  },
}
```

카테고리 수가 적으므로 초기에는 카테고리와 번역 전체를 한 번에 조회해도 된다.

locale 변경 때마다 DB를 다시 조회하지 않는다.

## 12.2 정적 fallback

다음 파일을 만든다.

```text
src/features/explore/data/foodCategoryFallback.js
```

현재 18개 카테고리의 key·EN/KO label·iconKey·sortOrder를 보관한다.

이 fallback은 DB의 단일 소스를 대체하는 것이 아니라 다음 상황을 위한 임시 복구 수단이다.

```text
사용자가 아직 SQL을 실행하지 않은 상태
Supabase 일시 장애
신규 테이블 조회 실패
```

`all`은 fallback 데이터에도 넣지 않는다.

`bbq`의 한국어 fallback도 반드시 다음 값을 사용한다.

```text
고기 구이
```

fallback 사용 여부와 에러 상태를 숨기지 않는다.

## 12.3 Context/Provider

다음과 같은 역할의 Context를 만든다.

권장 경로:

```text
src/features/explore/context/FoodCategoryProvider.jsx
```

Provider는 `LocaleProvider` 내부에 위치해야 한다.

권장 Provider 순서:

```jsx
<LocaleProvider>
  <FoodCategoryProvider>
    <AuthProvider>
      ...
    </AuthProvider>
  </FoodCategoryProvider>
</LocaleProvider>
```

현재 providers 구조를 확인한 뒤 기존 Provider 순서를 불필요하게 변경하지 않는다.

Context가 제공할 값:

```text
allCategories
filterCategories
categoryMap
getCategoryLabel
getCategoryIconKey
loading
error
source
reload
```

`source` 값 예:

```text
db
fallback
```

## 12.4 필터 목록

`filterCategories` 조건:

```text
isActive === true
isFilterable === true
deletedAt == null
```

정렬:

```text
sortOrder 오름차순
동일한 경우 key 오름차순
```

## 12.5 label fallback

`getCategoryLabel(key, locale)`의 우선순위:

```text
1. 요청 locale 번역
2. en 번역
3. ko 번역
4. raw key
```

알 수 없는 key는 화면을 깨뜨리지 않고 raw key를 반환한다.

비활성·소프트 삭제된 카테고리도 과거 저장 코스와 기존 장소에서 label로 해석할 수 있어야 한다.

---

# 13. 기존 프론트 연결

## 13.1 `exploreOptions.js`

다음은 유지한다.

```text
EMPTY_FILTERS
filterCount
applyFilters
matchesCat
```

다음 export는 제거하거나 fallback 파일로 이동한다.

```text
CATEGORIES
```

`applyFilters`의 category key 비교 로직은 변경하지 않는다.

```js
place.matgilCategoryKeys.includes(categoryKey)
```

기존 `matgilCategoryKeys` shape를 그대로 유지한다.

## 13.2 `FilterSheet.jsx`

정적 `CATEGORIES` import를 제거한다.

`FoodCategoryProvider`에서 필터 카테고리를 읽는다.

`all`은 DB에서 가져오지 않고 UI에서 가상 옵션으로 앞에 추가한다.

dictionary에 다음 key를 추가한다.

```text
filter.all
```

값:

```text
en:
All

ko:
전체
```

표시 조건:

- `all`은 선택된 카테고리가 없을 때 활성
- 기존 최대 3개 선택 제한 유지
- 기존 필터 적용 방식 유지
- UI 디자인과 동작을 임의로 바꾸지 않음

## 13.3 `PlaceDetailSheet.jsx`

정적 `CATEGORIES` import와 로컬 `categoryLabel()` 함수를 제거한다.

Context의 `getCategoryLabel()`을 사용한다.

다음 두 위치 모두 적용한다.

```text
대표 카테고리 subtitle
카테고리 chip
```

일반 tag 문자열은 카테고리 DB에 없으므로 raw 문자열을 유지한다.

## 13.4 `CategoryIcon.jsx`

DB의 `iconKey`를 사용할 수 있게 수정한다.

다음 아이콘 registry는 유지한다.

```text
bbq
street
noodle
cafe
stew
chicken
```

그 외 아이콘은 `default`로 fallback한다.

`all` 가상 옵션은 기존 전체 아이콘을 사용할 수 있다.

관리자가 향후 임의 SVG나 파일 경로를 저장하는 구조로 만들지 않는다.

---

# 14. 코스 제목 로직 통합

현재 다음 파일에 동일한 제목 판정과 템플릿이 중복되어 있다.

```text
src/features/explore/data/courseBuilder.js
src/features/courses/utils/courseDisplay.js
```

한 파일을 단일 소스로 정한다.

권장:

```text
courseDisplay.js
```

또는 별도 공용 파일:

```text
src/features/courses/utils/courseTitle.js
```

반드시 다음을 만족한다.

- `courseBuilder.js`의 `KO_TITLES`, `EN_TITLES`, `makeTitle()` 중복 제거
- 저장 코스와 신규 추천 코스가 같은 제목 함수를 사용
- `street`, `bbq`, `noodle`, `cafe`, `other` 판정 동작 유지
- 추천 점수 로직은 변경하지 않음
- `bbq`의 한국어 제목은 다음처럼 변경

```text
{location} 고기 구이 동선
```

영어 제목은 유지한다.

```text
{location} Korean BBQ Route
```

이번 1차 작업에서는 코스 제목 템플릿을 DB로 이동하지 않는다.

이유:

- 카테고리 label과 추천 코스 제목은 동일한 개념이 아님
- `Cafe & Bites`는 복합 조건으로 생성됨
- `Food Walk`는 특정 카테고리에 속하지 않음
- 이번 작업의 핵심은 카테고리 metadata와 다국어 label DB화임

`dictionary.js`의 `courseTitle.*`가 실제 미사용 상태라면, 중복을 남기지 않도록 제거한다.

사용 중이라면 한 곳만 단일 소스로 남긴다.

---

# 15. 저장 코스 중복 판정 수정

현재 다음 문제가 있다.

```text
저장 여부 확인:
title 문자열 기준

목록의 저장됨 배지:
place_ids 기준
```

카테고리 한국어 label이나 코스 제목이 바뀌면 같은 코스를 중복 저장할 수 있다.

다음 파일을 수정한다.

```text
src/features/courses/services/savedCourseService.js
src/features/explore/components/NearbySheet.jsx
```

## 변경 목표

```text
checkCourseAlreadySaved
title 비교 제거
place_ids 비교로 통일
```

비교 방식:

1. 코스 stops에서 place ID 배열 추출
2. 사용자의 삭제되지 않은 저장 코스 `place_ids` 조회
3. 길이가 같고 순서가 모두 같은 경우 동일 코스로 판단

코스 경로는 순서가 의미 있으므로 기본적으로 순서까지 같아야 동일 코스로 판단한다.

기존 데이터 중 `place_ids`가 없거나 비정상인 경우에만 기존 title + stop_count fallback을 검토한다.

일반적인 정상 데이터에서는 title을 중복 판정 기준으로 사용하지 않는다.

`NearbySheet`의 호출부도 새로운 함수 인자에 맞게 수정한다.

---

# 16. 변경하지 않을 핵심 로직

다음은 이번 작업에서 변경하지 않는다.

```text
mg-tour-seed의 RULES
classifyMatgilCategories()
mg_places.matgil_category_keys
카테고리 배열 순서
calcDiversityScore()
calcCafeBonus()
calcWeakOtherPenalty()
street/bbq/noodle 대표 카테고리 판정
other fallback 정책
기존 저장 코스 snapshot
```

새 카테고리를 DB에 추가하더라도 자동 분류 규칙에는 즉시 반영되지 않는다.

새 카테고리가 분류되지 않은 상태에서 빈 필터가 노출되는 것을 막기 위해 신규 카테고리 기본값은 다음과 같이 한다.

```text
is_active = false
is_filterable = false
```

자동 분류 규칙 DB화와 기존 장소 재분류는 2차 작업이다.

---

# 17. 작업 순서

## 단계 1. 현재 상태 재확인

- `git status` 확인
- 기존 미커밋 변경 보호
- 관련 파일 사용처 재검색
- 기존 빌드가 가능한지 확인
- 관련 없는 파일 수정 금지

## 단계 2. SQL 문서 작성

다음 문서를 먼저 작성한다.

```text
docs/sql-food-categories-2026-07-11.md
```

SQL은 실행하지 않는다.

## 단계 3. 데이터 계층 구현

다음을 구현한다.

```text
foodCategoryApi.js
foodCategoryFallback.js
FoodCategoryProvider.jsx
```

## 단계 4. 앱 Provider 연결

`FoodCategoryProvider`를 `LocaleProvider` 내부에 연결한다.

## 단계 5. 필터 연결

`FilterSheet`를 DB 카테고리 기반으로 변경한다.

## 단계 6. 장소 상세 연결

`PlaceDetailSheet`의 카테고리 label 변환을 Context 기반으로 변경한다.

## 단계 7. 아이콘 fallback 정리

DB `icon_key`를 사용하고 알 수 없는 값은 기본 아이콘으로 처리한다.

## 단계 8. 코스 제목 단일화

신규 추천 코스와 저장 코스가 같은 제목 생성 함수를 사용하게 한다.

`한국식 BBQ`를 `고기 구이`로 변경한다.

## 단계 9. 저장 코스 중복 판정 수정

title 기준을 place_ids 기준으로 변경한다.

## 단계 10. 검증

- import 오류 확인
- 미사용 코드 확인
- `npm run build`
- 전체 검색
- 변경 파일 검토

## 단계 11. 결과 문서 작성

다음 작업일지를 생성한다.

```text
docs/29-food-category-db-integration-result.md
```

문서 제목은 한글로 한다.

```text
음식 카테고리 DB 전환 프론트 구현 결과
```

---

# 18. 테스트 시나리오

## DB 적용 전

신규 SQL을 실행하지 않은 상태에서:

- 앱이 빌드되어야 함
- fallback 카테고리로 필터가 정상 표시되어야 함
- KO에서 `고기 구이`가 표시되어야 함
- 기존 추천 코스가 생성되어야 함
- 장소 상세의 카테고리 chip이 정상 표시되어야 함

## DB 적용 후

- 18개 category 조회
- EN/KO 전환 시 DB label 변경
- 필터 순서가 sort_order대로 표시
- `all`이 첫 번째에 표시
- `all`은 DB row가 아님
- `bbq` KO label이 `고기 구이`
- EN label은 `Korean BBQ`
- 비활성 category는 필터에 표시되지 않음
- 비활성 category key가 장소에 남아 있어도 장소 상세에서 label 해석 가능
- 알 수 없는 iconKey는 기본 아이콘 표시
- 알 수 없는 category key는 raw key 표시

## 추천 코스

- 기존 필터 결과 변화 없음
- cafe 보너스 유지
- other 감점 유지
- bbq 대표 코스 KO 제목에 `고기 구이 동선` 표시
- EN에서는 `Korean BBQ Route` 유지
- 신규 추천 코스와 저장 코스 제목이 일치

## 저장 코스

- 기존에 저장한 동일 코스를 제목 변경 후 다시 저장하지 못해야 함
- 제목이 같아도 place_ids가 다른 코스는 저장 가능해야 함
- 동일한 place_ids와 동일한 순서면 저장됨 판정
- 기존 저장 코스 상세와 지도 보기 정상

---

# 19. 완료 기준

다음을 모두 만족해야 한다.

```text
신규 SQL 문서 생성
SQL 자동 실행 없음
카테고리 DB API 구현
FoodCategoryProvider 구현
DB 실패 fallback 구현
필터 카테고리 DB 연결
장소 상세 카테고리 DB 연결
all은 UI 가상 옵션 유지
bbq KO label은 고기 구이
기존 18개 key 유지
matgil_category_keys 무변경
mg-tour-seed 무변경
카테고리 제목 중복 로직 제거
저장 코스 중복 판정 place_ids 기준 통일
npm run build 성공
관련 없는 기능 회귀 없음
작업일지 생성
git commit/push 없음
```

---

# 20. 검증 명령

PowerShell에서도 실행 가능한 방식으로 검증한다.

```powershell
npm run build
```

```powershell
rg -n "한국식 BBQ" src
```

활성 코드에서는 결과가 없어야 한다.

레거시 mock 또는 과거 문서의 영어 `Korean BBQ`는 변경 대상이 아니다.

```powershell
rg -n "CATEGORIES" src/features/explore src/pages src/api
```

정적 운영 카테고리 목록을 직접 소비하는 활성 컴포넌트가 남아 있지 않아야 한다.

```powershell
rg -n "KO_TITLES|EN_TITLES|makeTitle" src/features/explore src/features/courses
```

동일한 코스 제목 구현이 두 군데 남아 있지 않아야 한다.

```powershell
rg -n "checkCourseAlreadySaved" src
```

호출부와 함수가 place_ids 기준으로 맞게 변경됐는지 확인한다.

---

# 21. 작업 결과 보고 형식

완료 후 다음 형식으로 보고한다.

## 1. 변경한 파일

파일별 역할과 실제 변경 내용을 설명한다.

## 2. 새로 만든 파일

다음을 포함한다.

```text
SQL 문서
API
fallback
Context/Provider
작업일지
```

## 3. DB 작업

- SQL은 작성만 했는지
- 실행하지 않았는지
- 사용자가 실행할 정확한 문서 위치

## 4. 기존 기능 보존

다음을 각각 확인한다.

```text
필터
추천 코스
장소 상세
저장 코스
언어 전환
기존 snapshot
```

## 5. 검증 결과

```text
npm run build 결과
검색 결과
남은 경고
수동 테스트 필요 항목
```

## 6. 사용자가 직접 해야 할 일

다음 순서로 명시한다.

```text
1. SQL 문서 검토
2. Supabase SQL Editor에서 사용자가 직접 실행
3. 실행 후 검증 SQL 확인
4. 로컬 화면 EN/KO 테스트
5. 배포 전 최종 회귀 확인
```

## 7. 미수행 확인

```text
DB 직접 실행 안 함
mg-tour-seed 수정 안 함
관리자 기능 구현 안 함
git commit 안 함
git push 안 함
```

---

# 22. 에이전트 진행 원칙

- 추가 정보가 없어도 현재 자료로 작업 가능하다.
- 불필요한 확인 질문 없이 조사 후 계속 진행한다.
- 현재 코드와 실제 DB 조회 결과가 충돌하는 중대한 문제가 발견된 경우에만 중단하고 질문한다.
- 단순한 코드 스타일 선택은 기존 프로젝트 스타일을 따른다.
- 계획만 작성하고 멈추지 말고, SQL 문서 작성과 코드 구현, 빌드 검증, 작업일지 작성까지 진행한다.
- 사용자의 기존 작업을 삭제하거나 덮어쓰지 않는다.