# 04-current-task-supabase-place-integration.md

## 이번 작업 목표

현재 맛길(Matgil) 프로젝트는 Vite + React + JavaScript + Tailwind 기반 프론트 화면이 이미 만들어진 상태다.

이제 목표는 기존 mock/더미 맛집 데이터를 Supabase에 저장된 실제 음식점 데이터로 교체하는 것이다.

이번 작업에서는 TourAPI를 프론트에서 직접 호출하지 않는다.
프론트는 Supabase DB만 조회한다.



---

## 현재 프로젝트 상태

### 프론트 상태

* Claude Design으로 만든 React 프로젝트가 존재한다.
* VSCode에서 프로젝트를 열어둔 상태다.
* 기존 화면 디자인은 최대한 유지한다.
* 기존 더미 데이터 기반 맛집 카드/인기맛집/추천 결과 화면이 있을 수 있다.
* 프론트는 JavaScript 기반 React이다.
* TypeScript를 사용하지 않는다.

### Supabase 상태

Supabase에는 맛길용 `mg_` 테이블이 이미 생성되어 있다.

현재 실제 TourAPI 국문 음식점 데이터 10개 저장이 완료되었다.

저장 확인 결과:

```txt
mg_places              10
mg_place_sources       10
mg_place_texts         10
mg_place_food_details  10
mg_place_images         7
mg_api_fetch_logs       2
```

중복 저장 방지도 확인 완료되었다.

```txt
insertedCount: 0
skippedCount: 10
failedCount: 0
```

즉, Supabase DB에는 실제 음식점 데이터가 정상 저장되어 있다.

---

## 이미 완료된 백엔드/DB 작업

아래 작업은 이미 완료되어 있으므로 다시 만들지 않는다.

```txt
1. Supabase mg_ 테이블 생성 완료
2. Supabase Edge Function Secrets 설정 완료
3. TOUR_KOR_API_SERVICE_KEY 설정 완료
4. ADMIN_SEED_TOKEN 설정 완료
5. mg-tour-seed Edge Function 생성 완료
6. TourAPI areaBasedList2/detailIntro2 호출 성공
7. 음식점 10개 DB 저장 성공
8. 중복 저장 방지 성공
9. RLS 공개 읽기 정책 설정 완료
```

---

## RLS 정책 상태

프론트 공개 조회가 허용된 테이블:

```txt
mg_places
mg_place_texts
mg_place_food_details
mg_place_images
mg_courses
mg_course_places
mg_phrases
```

프론트 공개 조회하지 않는 테이블:

```txt
mg_place_sources
mg_api_fetch_logs
```

프론트에서는 `mg_place_sources`, `mg_api_fetch_logs`를 조회하지 않는다.

---

## 이번 작업에서 해야 할 일

이번 작업의 핵심은 프론트 데이터 연결이다.

해야 할 일:

```txt
1. Supabase 클라이언트 파일 생성
2. 장소 조회 API 함수 생성
3. Supabase에서 음식점 목록 조회
4. 조회 결과를 화면용 place 객체로 정규화
5. 기존 더미 맛집 카드 데이터를 실제 Supabase 데이터로 교체
6. 기존 디자인은 최대한 유지
7. npm run build로 오류 확인
```

---

## 반드시 지킬 기술 조건

프론트는 JavaScript만 사용한다.

금지:

```txt
.ts 파일 생성 금지
.tsx 파일 생성 금지
TypeScript 설정 추가 금지
프론트에서 TourAPI 직접 호출 금지
프론트에서 OpenAI 직접 호출 금지
프론트에서 Solar 직접 호출 금지
프론트에서 TOUR_KOR_API_SERVICE_KEY 사용 금지
프론트에서 ADMIN_SEED_TOKEN 사용 금지
프론트에서 SUPABASE_SERVICE_ROLE_KEY 사용 금지
mg_place_sources 조회 금지
mg_api_fetch_logs 조회 금지
```

허용:

```txt
VITE_SUPABASE_URL 사용 가능
VITE_SUPABASE_ANON_KEY 사용 가능
@supabase/supabase-js 사용 가능
Supabase DB select 조회 가능
```

---

## 환경변수 원칙

프론트 `.env` 또는 배포 환경에 필요한 값은 아래 두 개뿐이다.

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

아래 값들은 프론트에 절대 넣지 않는다.

```txt
TOUR_KOR_API_SERVICE_KEY
ADMIN_SEED_TOKEN
SOLAR_API_KEY
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 필요한 파일

아래 파일을 새로 만들거나, 이미 있다면 기존 구조에 맞춰 수정한다.

```txt
src/lib/supabase.js
src/api/placeApi.js
```

폴더가 없다면 생성한다.

---

## src/lib/supabase.js 요구사항

Supabase 클라이언트를 생성한다.

```js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

`@supabase/supabase-js`가 설치되어 있지 않으면 설치한다.

```bash
npm install @supabase/supabase-js
```

---

## src/api/placeApi.js 요구사항

`getPlaces(locale = "ko")` 함수를 만든다.

조회 대상 테이블:

```txt
mg_places
mg_place_texts
mg_place_food_details
mg_place_images
```

조회하지 말아야 할 테이블:

```txt
mg_place_sources
mg_api_fetch_logs
```

기본 조회 조건:

```txt
mg_places.is_active = true
정렬은 id 오름차순
```

조회 후 화면용 객체로 변환한다.

---

## getPlaces 반환 객체 구조

프론트 컴포넌트는 TourAPI 원본 필드명을 직접 사용하지 않는다.

나쁜 예:

```js
place.title
place.addr1
place.firstimage
place.contentid
```

좋은 예:

```js
place.name
place.address
place.imageUrl
place.firstMenu
place.openTime
```

`getPlaces()`는 아래 형태로 데이터를 반환한다.

```js
{
  id,
  name,
  address,
  description,
  imageUrl,
  latitude,
  longitude,

  firstMenu,
  treatMenu,
  openTime,
  restDate,
  parking,
  packing,
  tags,

  tel,
  hasParking,
  hasPacking,
  hasOpenTime,
  hasMenuInfo,
  hasImage,
  hasLocation
}
```

---

## locale fallback 규칙

현재 DB에는 `locale = "ko"` 데이터만 있다.

따라서 `getPlaces(locale)`는 아래 순서로 텍스트를 선택한다.

```txt
1. 요청한 locale 데이터가 있으면 사용
2. 없으면 ko 데이터 사용
3. ko도 없으면 기본값 사용
```

예:

```js
const text =
  place.mg_place_texts.find((item) => item.locale === locale) ||
  place.mg_place_texts.find((item) => item.locale === "ko");
```

---

## 이미지 처리 규칙

`mg_place_images`는 10개 중 7개만 있다.
이미지가 없는 식당도 있으므로 화면이 깨지면 안 된다.

이미지 우선순위:

```txt
1. mg_place_images 첫 번째 image_url
2. mg_places.default_image_url
3. 없으면 기본 placeholder UI
```

이미지 파일을 다운로드하거나 Supabase Storage에 저장하지 않는다.
현재는 URL만 사용한다.

---

## 화면 연결 규칙

기존 디자인은 최대한 유지한다.

교체 대상:

```txt
기존 mock 맛집 카드 데이터
기존 인기맛집 mock 데이터
기존 추천 결과 mock 식당명
```

우선순위:

```txt
1. 인기맛집 화면 또는 맛집 목록 카드에 Supabase 음식점 10개 표시
2. 홈/추천 결과 화면에서 일부 Supabase 음식점 사용
3. 추천 로직은 아직 단순하게 places.slice()로 처리해도 됨
```

처음부터 복잡한 추천 알고리즘을 만들지 않는다.

MVP 임시 추천 방식:

```js
const restaurants = places.slice(0, 2);
const cafe = places.find((place) =>
  place.tags?.some((tag) => String(tag).includes("카페"))
);

const coursePlaces = cafe
  ? [...restaurants, cafe]
  : places.slice(0, 3);
```

카페가 없으면 음식점 3개를 보여줘도 된다.
지금 목표는 추천 알고리즘 완성이 아니라 실제 DB 데이터 연결이다.

---

## 화면에 표시할 수 있는 필드

카드에 우선 표시할 필드:

```txt
name
address
imageUrl
firstMenu
treatMenu
openTime
parking
packing
tags
```

없는 값은 숨기거나 “정보 없음”으로 처리한다.

가짜 데이터는 만들지 않는다.

금지:

```txt
없는 별점 만들기 금지
없는 리뷰 수 만들기 금지
없는 가격대 만들기 금지
없는 할랄/채식/영어메뉴 여부를 true/false로 단정 금지
```

`is_halal_friendly`, `is_vegetarian_friendly`, `has_english_menu`는 현재 대부분 null이다.
화면에서 확정 정보처럼 보여주지 않는다.

---

## 로딩/에러 처리

Supabase 조회 중에는 로딩 상태를 보여준다.

```txt
맛집 정보를 불러오는 중입니다.
```

조회 실패 시 에러 상태를 보여준다.

```txt
맛집 정보를 불러오지 못했습니다.
잠시 후 다시 시도해 주세요.
```

데이터가 없으면 빈 상태를 보여준다.

```txt
아직 등록된 맛집 정보가 없습니다.
```

---

## 추천 결과 화면 임시 연결 방식

현재 추천 알고리즘은 완성하지 않는다.

임시 방식:

```txt
Supabase에서 불러온 음식점 중 앞에서 3개를 추천 결과로 사용한다.
첫 2개는 맛집, 3번째는 카페/후보 장소처럼 표시한다.
카페 분류가 명확하지 않으면 '추천 장소'로 표시한다.
```

기존 문구 중 아래 문구는 유지 가능하다.

```txt
첫 번째 추천 식당 기준 도보 10분 이내 장소를 우선 추천하고, 부족할 경우 15분 이내까지 확장합니다.
```

다만 실제 거리 계산을 아직 하지 않는다면 작은 안내를 추가한다.

```txt
현재 MVP에서는 저장된 장소 데이터를 기반으로 추천 결과를 구성합니다.
```

---

## 자주 쓰는 표현 화면

이번 작업에서 `자주 쓰는 표현` 화면은 필수로 DB 연결하지 않아도 된다.

기존 mock phrases가 정상 작동한다면 그대로 둔다.

나중에 `mg_phrases`에 연결할 수 있지만, 지금 우선순위는 맛집 데이터 연결이다.

---

## 완료 기준

이번 작업은 아래 조건을 만족하면 완료로 본다.

```txt
1. npm install이 필요한 패키지를 설치했다.
2. src/lib/supabase.js가 생성되었다.
3. src/api/placeApi.js가 생성되었다.
4. getPlaces()가 Supabase에서 음식점 데이터를 조회한다.
5. 브라우저 콘솔 또는 화면에서 음식점 10개를 확인할 수 있다.
6. 기존 더미 맛집 카드 중 최소 1개 화면이 실제 Supabase 데이터로 교체되었다.
7. 이미지가 없는 식당도 화면이 깨지지 않는다.
8. 로딩/에러/빈 상태가 처리된다.
9. 프론트에서 TourAPI나 비밀키를 직접 사용하지 않는다.
10. npm run build가 통과한다.
```

---

## AI에게 작업 요청할 때 주의할 점

AI는 기존 코드를 먼저 읽고 현재 구조를 파악한 뒤 작업해야 한다.

바로 전체 구조를 갈아엎지 않는다.

```txt
기존 디자인과 레이아웃을 최대한 유지한다.
기존 라우팅 구조를 유지한다.
기존 컴포넌트를 가능한 재사용한다.
필요한 파일만 추가하거나 수정한다.
프론트 전체를 새로 만들지 않는다.
```
