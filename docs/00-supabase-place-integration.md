# 00. Supabase 음식점 데이터 프론트 연결

## 작업 일자

2026-06-17

## 작업 목표

Supabase에 저장된 테스트 음식점 10개를 프론트 화면에 연결한다.
기존 mock/더미 데이터를 실제 DB 데이터로 교체하는 것이 핵심이며,
전체 기능 확장, 데이터 수집, 추천 알고리즘 고도화는 이번 작업 범위에 포함하지 않는다.

---

## 작업 전 상태

- `@supabase/supabase-js` 미설치
- `src/lib/`, `src/api/` 폴더 없음
- `.env` 파일 존재하나 내용 없음 (작업 전 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 직접 입력 완료)
- `PopularPage`, `ResultPage`, `HomePage` 모두 mock 데이터 사용
- `Thumbnail` 컴포넌트: tint 색상 + 아이콘 placeholder만 지원 (실제 이미지 렌더링 불가)

---

## 완료된 작업

### 패키지 설치

```
npm install @supabase/supabase-js
```

### 새로 만든 파일

#### `src/lib/supabase.js`

Supabase 클라이언트 생성 파일.
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 환경변수만 사용한다.

#### `src/api/placeApi.js`

`getPlaces(locale = "ko")` 함수 구현.

- 조회 테이블: `mg_places`, `mg_place_texts`, `mg_place_food_details`, `mg_place_images`
- 조회 조건: `is_active = true`, `id` 오름차순 정렬
- 조회 금지 테이블: `mg_place_sources`, `mg_api_fetch_logs`
- locale fallback: 요청 locale → `ko` → 기본값 순서로 선택
- 이미지 우선순위: `mg_place_images[0].image_url` → `mg_places.default_image_url` → null
- 반환 형식: TourAPI 원본 필드명 대신 정규화된 place 객체

반환 객체 구조:

```js
{
  id, name, address, description, imageUrl,
  latitude, longitude,
  firstMenu, treatMenu, openTime, restDate, parking, packing, tags,
  tel, hasParking, hasPacking, hasOpenTime, hasMenuInfo, hasImage, hasLocation
}
```

### 수정한 파일

#### `src/shared/components/Thumbnail.jsx`

- `src` prop 추가
- `src`가 있으면 실제 이미지 `<img>` 렌더링
- `onError` 시 tint + placeholder 아이콘 fallback으로 자동 전환
- 기존 tint-only 동작은 `src`가 없을 때 그대로 유지

#### `src/pages/PopularPage.jsx`

- `POPULAR_PLACES` mock import 제거
- `getPlaces('ko')` 호출로 교체
- 로딩 상태: "맛집 정보를 불러오는 중입니다."
- 에러 상태: "맛집 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
- 빈 상태: "아직 등록된 맛집 정보가 없습니다."

#### `src/features/popular/components/PopularPlaceCard.jsx`

- 가짜 `rating`, `reviews`, `price` 필드 제거
- `place.imageUrl` → Thumbnail `src` prop으로 전달
- 이미지 없는 식당: tint 색상 + placeholder 아이콘으로 fallback
- `place.firstMenu` 또는 `place.tags[0]`를 부제목으로 표시
- `place.address`를 위치 정보로 표시

#### `src/features/recommendation/services/recommendationService.js`

- `RESTAURANTS` mock import 제거
- `getPlaces('ko')` 호출로 교체
- MVP 추천: 불러온 음식점 앞 3개를 추천 결과로 사용
- 반환 shape (`title`, `area`, `stops`, `stopCount`, `distance`, `duration`) 유지

#### `src/features/recommendation/components/RecommendationCard.jsx`

- 가짜 `rating`, `price` 필드 제거
- `stop.imageUrl` → Thumbnail `src` prop으로 전달
- `stop.firstMenu` 또는 `stop.tags[0]`를 부제목으로 표시
- `stop.address`를 위치 정보로 표시

---

## 교체된 화면

| 화면 | 상태 |
|------|------|
| 인기 맛집 (PopularPage) | Supabase 실제 데이터로 교체 완료 |
| 추천 결과 (ResultPage) | Supabase 실제 데이터로 교체 완료 (MVP: 상위 3개) |

---

## 유지된 화면

| 화면 | 이유 |
|------|------|
| 홈 지도 / NearbySheet | 지도 자체가 placeholder이므로 mock 유지 |
| phrases, community, courses, auth | 이번 작업 범위 외 |

---

## 지켜진 금지 사항

- TypeScript 파일 생성 없음
- 프론트에서 TourAPI, OpenAI, Solar 직접 호출 없음
- `TOUR_KOR_API_SERVICE_KEY`, `ADMIN_SEED_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` 프론트 미사용
- `mg_place_sources`, `mg_api_fetch_logs` 조회 없음
- 없는 별점, 리뷰 수, 가격대 가짜 데이터 생성 없음

---

## 환경변수

프론트에서 사용하는 환경변수는 아래 두 개뿐이다.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## 빌드 검증

```
npm run build
✓ 133 modules transformed.
✓ built in 2.26s
```

에러 없이 빌드 통과.
