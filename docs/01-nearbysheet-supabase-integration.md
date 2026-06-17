# 01. Map 화면 NearbySheet Supabase 연결

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (00)

- `@supabase/supabase-js` 설치
- `src/lib/supabase.js` 생성 (Supabase 클라이언트)
- `src/api/placeApi.js` 생성 (`getPlaces("ko")` — mg_places 4개 테이블 조인, 정규화된 place 객체 반환)
- `Thumbnail.jsx`에 `src` prop 추가 (실제 이미지 + onError fallback)
- `/popular` (숨은 화면)과 ResultPage 추천 결과에 Supabase 데이터 연결
- 이후 `/popular`는 숨은 화면으로 확인, 이번 작업 대상에서 제외

---

## 이번 작업 목표

실제 사용자가 앱을 열면 가장 먼저 보는 화면인 Map(`/`)의 `Eat near here` 시트 내 `NEARBY RIGHT NOW` 목록에 Supabase 음식점 10개를 연결한다.

---

## 수정한 파일

### `src/pages/HomePage.jsx`

- `RESTAURANTS` mock import 제거
- `getPlaces` import 추가
- `useEffect` 추가: 마운트 시 `getPlaces('ko')` 호출, `places` 상태로 저장
- `applyFilters(RESTAURANTS, filters)` → `applyFilters(places, filters)` 로 교체
- 기존 필터 모달 Show results 흐름(필터 적용 → NearbySheet 목록 갱신) 구조 유지

### `src/features/explore/components/NearbySheet.jsx`

- `StarIcon` import 제거
- `TINTS` 배열 추가 (index 기반 fallback 색상)
- `NearbyRow` 컴포넌트 수정:
  - `place.imageUrl` → Thumbnail `src` prop으로 전달 (이미지 없으면 tint fallback)
  - `place.firstMenu || place.tags?.[0] || '음식점'` 을 부제목으로 표시
  - `place.address` 를 위치 정보로 표시
  - 가짜 `rating`, `reviews`, `price` 제거
- 목록 렌더링에 `index` 전달 추가

---

## 유지된 구조

- 필터 모달 Show results → `applyFilters(places, filters)` → NearbySheet 목록 갱신 흐름 유지
- 기본 필터(EMPTY_FILTERS) 상태에서는 Supabase 음식점 10개 전체 표시
- Food Type 필터 적용 시 동작은 다음 작업에서 별도 처리 예정

---

## 건드리지 않은 것

`/popular`, `PopularPage`, `PopularPlaceCard`, 라우터, 하단 네비게이션, Courses, Phrases, Community, auth 관련 파일 전체

---

## 빌드 검증

```
npm run build
✓ 132 modules transformed.
✓ built in 2.50s
```

---

## 로컬 확인 방법

```
npm run dev
```

`http://localhost:5173` 접속 → Map 탭 하단 시트를 위로 끌어올리면 `NEARBY RIGHT NOW` 목록에 Supabase 음식점 표시.
