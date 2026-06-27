# 25. Desktop Intro, Saved Courses, Filter 정리 작업일지

## 작성 일시

2026-06-22 KST

---

## 이전 작업 기준

`docs/24-mypage-locale-routing-and-desktop-prep.md`

24번 문서에서 MyPage 실데이터 연결, 언어 설정 영구 저장, 라우팅 안정화, UI 마감, 데스크톱 소개 영역 준비가 완료됐다.  
이번 25번 작업은 그 이후 3개 흐름으로 진행된다.

```
1. PC 전용 소개/QR 영역 구현
2. Saved Courses 기능 전체 구현
3. Saved Courses locale 처리 및 Filter UI 정리
```

---

## 커밋 목록

```
11c72d0  feat: PC 전용 소개/QR 영역 — DesktopIntroPanel 2열 레이아웃
d81ce91  feat: Saved Courses — 코스 저장/목록/상세/지도 연결 구현
b954bed  fix: Saved Courses 버그 3종 수정
a066c54  feat: Saved Courses locale 표시 + Filter 가격대/취향 섹션 제거
```

---

## 1. 작업 개요

| 흐름 | 주요 내용 |
|---|---|
| PC 소개/QR 영역 | DesktopIntroPanel 신규 컴포넌트, App.jsx 2열 레이아웃 |
| Saved Courses 구현 | 저장/목록/상세/Map 연결, courseMetrics 정규화 |
| locale/filter 후속 | courseDisplay.js 신규, 표시 단계 locale 처리, 필터 UI 정리 |

---

## 2. PC 소개/QR 영역 구현

### 구현 목표

PC 화면에서 앱 프레임 왼쪽에 서비스 소개 패널과 QR 코드를 표시한다.  
모바일/태블릿(`lg` 미만)에서는 완전히 숨긴다.

### 파일

```
src/shared/components/DesktopIntroPanel.jsx  — 신규
src/app/App.jsx                              — 2열 레이아웃 적용
src/assets/desktop/matgil-qr.png            — QR 이미지
```

### 레이아웃 구조 (App.jsx)

```jsx
<div className="flex min-h-[100svh] w-full items-stretch justify-center lg:gap-6">
  <DesktopIntroPanel />  {/* lg 이상에서만 보임 */}
  <div className="relative h-[100svh] w-full max-w-app overflow-hidden bg-paper shadow-2xl">
    <AppRouter />
  </div>
</div>
```

- 앱 프레임과 소개 패널 너비를 `w-[22.5rem]` (360px 기준)으로 동일하게 맞춤
- `lg:flex ... hidden` 처리 — DesktopIntroPanel이 자체적으로 `hidden lg:flex` 적용

### DesktopIntroPanel 콘텐츠

```
Matgil                          — 브랜드 + PinIcon (coral)
Seoul Food Routes for Travelers — 헤드라인 (font-display, 2.75rem)
서울을 방문한 외국인 관광객을 위한
맛집 동선 추천 앱               — 한국어 설명

Scan to explore Matgil on mobile
QR을 스캔하고 모바일에서 이용해보세요
                                — QR 카드 옆 설명 문구
```

RouteDecoration: coral → amber → green 3개 dot + 점선 연결 시각 요소로 동선 이미지 표현

---

## 3. Saved Courses DB 준비

### 테이블명

```
public.mg_saved_courses
```

### 테이블 존재 확인

```sql
select
  to_regclass('public.mg_saved_courses') as saved_courses;
```

```json
[{ "saved_courses": "mg_saved_courses" }]
```

### 테이블 목적

로그인 사용자가 Map 탭에서 추천받은 맛집 동선을 저장하고,  
Courses 탭에서 저장한 동선을 다시 확인하기 위한 테이블.  

> **핵심**: 추천 코스를 다시 계산하지 않고, 저장 시점의 코스 데이터를 snapshot으로 저장한다.

### 컬럼 구조

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | 저장한 사용자 |
| `locale` | varchar(5) | 저장 시점 언어 (`en` / `ko`) |
| `title` | text | 저장 시점 코스 제목 |
| `subtitle` | text | 부제 (현재 빈 값) |
| `description` | text | 설명 (현재 빈 값) |
| `anchor_label` | text | 저장 시점 위치 레이블 (EN) |
| `total_distance_m` | integer | 총 거리 (미터) |
| `total_duration_min` | integer | 예상 도보 시간 (분) |
| `stop_count` | integer | 코스 장소 수 |
| `place_ids` | bigint[] | 장소 ID 배열 |
| `stops` | jsonb | 장소 상세 배열 (snapshot 포함) |
| `course_snapshot` | jsonb | 저장 시점 전체 코스 객체 |
| `created_at` | timestamptz | 저장 시각 |
| `updated_at` | timestamptz | 수정 시각 |
| `deleted_at` | timestamptz | soft delete 시각 |
| `deleted_by` | uuid | soft delete 실행 사용자 |

### RLS 정책

```
SELECT: user_id = auth.uid()
INSERT: user_id = auth.uid()
UPDATE: user_id = auth.uid()
```

RLS 활성화 확인 쿼리:

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'mg_saved_courses';
```

```json
[{
  "table_name": "mg_saved_courses",
  "rls_enabled": true,
  "rls_forced": false
}]
```

### 중요 메모

- `updated_at` 자동 트리거 없음 → soft delete/update 시 클라이언트에서 `updated_at: new Date().toISOString()`을 직접 세팅
- 삭제는 hard delete가 아닌 soft delete(`deleted_at` / `deleted_by` 세팅) 방식
- `deleted_at IS NULL` 필터로 유효 데이터만 조회

---

## 4. Saved Courses 핵심 기능 구현

### 저장 흐름

```
Map 탭 추천 코스 상세 열기
  → Save course / 코스 저장 버튼 (TodayCourseDetail 하단 sticky)
  → 비로그인: 로그인 페이지 이동
  → 로그인: saveCourse() 호출 → Supabase INSERT
  → 버튼 상태: idle → checking → saving → saved
  → 중복 저장 방지: checkCourseAlreadySaved() 선처리
```

### Courses 탭 전환

- 기존 목업 CourseCard 목록 → 실제 `mg_saved_courses` 조회 목록으로 교체
- 3가지 상태 처리: 비로그인(EmptyState + 로그인 버튼) / 로딩(스피너) / 비어있음(EmptyState) / 목록
- 저장 날짜(`created_at`) 표시
- 항목 삭제: 인라인 확인 버튼(pendingDeleteId state) → softDeleteSavedCourse()

### 저장 데이터 구조 (INSERT 시)

```js
{
  user_id, locale, title, subtitle: '', description: '',
  anchor_label: selectedLocation?.label ?? '',
  total_distance_m, total_duration_min, stop_count,
  place_ids,      // bigint[] — 변환 성공한 stop ID만
  stops,          // jsonb — 원본 stops 배열 (nameKo 포함)
  course_snapshot // jsonb — 코스 전체 + anchor_label + normalizedMetrics
}
```

### place_ids 처리 주의

```
stop.id / stop.place_id / stop.placeId 등을 Number() 변환 시도
Number.isFinite() && > 0 인 경우에만 place_ids에 포함
변환 실패해도 저장 자체는 실패시키지 않음
stops / course_snapshot이 source of truth
```

### 서비스 함수 (`savedCourseService.js`)

| 함수 | 역할 |
|---|---|
| `fetchSavedCourses` | user_id + deleted_at IS NULL 조회 |
| `saveCourse` | INSERT (snapshot 포함) |
| `fetchSavedCourseById` | 상세 페이지용 단건 조회 |
| `softDeleteSavedCourse` | deleted_at / deleted_by / updated_at 업데이트 |
| `checkCourseAlreadySaved` | title 기준 중복 확인 |
| `isSameCourse` | place_ids 또는 title+stop_count 비교 |

---

## 5. 거리/시간 계산 정규화

### 발견된 문제

기존 `course.hr` 값은 실제 거리 기반 시간이 아니라 stop count 기반 고정값이었다.

```js
const ESTIMATED_TIME = { 1: '~30 min', 2: '~1 hr', 3: '~1.5 hr', 4: '~2 hr' };
```

3 stops = 무조건 `~1.5 hr` → 실제 거리와 무관

### 수정 방향

`course.hr` 고정값을 표시에 사용하지 않고, `courseMetrics.js`에서 실제 거리 기반으로 정규화.

### 파일

```
src/features/courses/utils/courseMetrics.js  — 신규
```

### 거리 정규화 우선순위

```
1. course.totalDistanceM (숫자)
2. course.totalDistanceMeters (숫자)
3. course.totalDistanceKm (숫자)
4. course.km 문자열 파싱 ("1.2 km" → 1200)
5. stops의 latitude/longitude 기반 haversine 직선거리 합산
```

### 시간 정규화 우선순위

```
1. course.totalDurationMin (숫자)
2. course.durationMin (숫자)
3. course.walkingDurationMin (숫자)
4. totalDistanceM 기준 도보 추정: Math.ceil((totalDistanceM / 1000) * 15)
   (15분/km 기준)
course.hr 문자열은 의도적으로 무시
```

### 적용 화면

```
- Map 탭 추천 코스 카드 (CourseCard)
- Map 탭 추천 코스 상세 (TodayCourseDetail)
- Courses 탭 저장 코스 목록 (CoursesPage)
- 저장 코스 상세 (SavedCourseDetailPage)
```

### 주요 export

```js
normalizeCourseMetrics(course)      // → { totalDistanceM, totalDurationMin, ... }
formatCourseDistance(totalDistanceM) // → "1.4 km" / "800 m"
formatCourseDuration(min, locale)    // → "~21 min" / "~21분"
getDisplayMetrics(course, locale)    // → { displayDistance, displayDuration, ... }
```

---

## 6. 저장 코스 상세 및 지도 연결

### SavedCourseDetailPage

- 라우트: `/saved-courses/:id` (AppLayout 밖, 풀스크린)
- Supabase에서 해당 `id` + `user_id` 기준 단건 조회
- 조회 실패/권한 없음 → `/courses`로 redirect

### 헤더 디자인

초기에 `snapshot.accent`(저장 시점 accent 색, 파란/초록일 수 있음) 기반 그라디언트 적용했다가  
버그 수정에서 **solid coral(`bg-coral`)** 배경으로 교체.  
저장 코스는 항상 coral 헤더로 고정.

### 지도 연결 (View route on map)

```
저장 코스 상세 → [View route on map / 지도에서 동선 보기] 클릭
  → navigate('/', { state: { savedCourse: { ...rawSnapshot, anchor_label } } })
  → HomePage: routeState.savedCourse → setSavedCourseForMap
  → NearbySheet: initialCourse prop → localizeSnapshotForDisplay → openDetail
  → 저장 코스 상세가 Map 탭 바텀시트에 표시됨
```

`anchor_label`을 snapshot에 반드시 포함시켜 NearbySheet에서 locale 재생성에 활용.

### 버그 수정 (b954bed)

#### 버그 1: 헤더 색상
- `snapshot.accent`가 파랑/초록일 수 있어 그라디언트가 coral이 아닌 색으로 표시
- 수정: `bg-coral` 고정으로 교체

#### 버그 2: 핫플레이스 변경 후 stale course 잔류
- NearbySheet의 `selectedCourse` state가 `selectedLocation` 변경 시 초기화되지 않아
  이전 코스 detail이 남아있는 문제
- 수정: `useEffect([selectedLocation])` 추가 → `selectedCourse` / `selectedPlace` / `saveState` 초기화

#### 버그 3: Map 탭 코스 카드에 저장 여부 배지 없음
- `savedRows` state 추가 + 로그인 시 `fetchSavedCourses` 한 번 조회
- `isSameCourse` 비교로 이미 저장된 코스에 coral Saved 배지 오버레이

---

## 7. 저장 상태 표시

### 코스 상세 저장 버튼 (TodayCourseDetail)

```
idle     → [BookmarkIcon] Save course / 코스 저장
checking → [스피너] Saving... / 저장 중...  (DB 중복 확인 중)
saving   → [스피너] Saving... / 저장 중...
saved    → [CheckIcon]  Saved / 저장됨       (비활성, stone 배경)
failed   → Save course (3초 후 idle 복귀)
```

### Map 탭 코스 목록 카드 배지

- NearbySheet에서 로그인 시 `savedRows`를 한 번만 fetch
- 코스마다 `isSameCourse` 비교 → 이미 저장된 코스 카드 우상단에 coral Saved 배지 표시
- 저장 성공 시 `setSavedRows(prev => [savedRow, ...prev])` 로컬 즉시 반영 (re-fetch 없음)

### 비교 로직 (`isSameCourse`)

```
1차: place_ids 배열 순서 일치 (bigint → Number() 변환 비교)
2차 fallback: title 문자열 + stop_count 일치
```

---

## 8. locale 표시 문제 수정

### 문제

영문 상태에서 저장한 코스를 한국어 모드에서 열면 title / stop 이름 / 동선 라벨이 영어로 그대로 표시됐다.

### 원인

`course_snapshot`에 저장 당시 locale의 title이 포함되어 있고, 화면에서 `savedCourse.title`을 그대로 렌더링했기 때문.

### 수정 원칙

**DB 데이터 수정 없음.** 화면 표시 단계에서 현재 locale 기준으로 title / stop 이름을 재구성한다.

### 신규 파일

```
src/features/courses/utils/courseDisplay.js
```

### 주요 함수

| 함수 | 설명 |
|---|---|
| `getLocalizedLocationLabel(anchorLabel, locale)` | anchor_label → 현재 locale 지명 변환 |
| `getLocalizedCourseTitle(stops, anchorLabel, locale)` | stops 카테고리 분석 + locale 기반 제목 재생성 |
| `getLocalizedStopName(stop, locale)` | `stop.nameKo` / `stop.name` locale 우선 반환 |
| `localizeSnapshotForDisplay(snapshot, locale)` | router state snapshot → 현재 locale 재적용 |
| `normalizeSavedCourseForDisplay(savedRow, locale)` | DB row 전체 → 현재 locale 재적용 |

### 코스 제목 재생성 규칙

stops의 `matgilCategoryKeys` 분석으로 타입 감지:

```
카페 + 일반 식당 → cafeAndBites
street 최다  → streetFood
bbq 최다     → bbq
noodle 최다  → noodle
기타         → default
```

locale별 템플릿:

```js
// EN
cafeAndBites: '{loc} Cafe & Bites'
streetFood:   '{loc} Street Food Tour'
bbq:          '{loc} Korean BBQ Route'
noodle:       '{loc} Noodle Walk'
default:      '{loc} Food Walk'

// KO
cafeAndBites: '{loc} 카페 & 맛집'
streetFood:   '{loc} 길거리 음식 탐방'
bbq:          '{loc} 한국식 BBQ 동선'
noodle:       '{loc} 면 요리 동선'
default:      '{loc} 맛집 동선'
```

### anchor_label → 지명 한국어 변환

`PRESET_LOCATIONS` lookup으로 EN label → KO label 변환:

```
Seoul City Hall → 서울시청
Myeongdong      → 명동
Hongdae         → 홍대
Gangnam         → 강남
Jongno          → 종로
...
Selected area   → 선택한 지역
Current location → 현재 위치
```

### stop 이름 locale 처리

```js
// placeApi.js가 항상 nameKo를 별도 저장함
locale === 'ko': stop.nameKo ?? stop.name
locale === 'en': stop.name ?? stop.nameKo
```

### 적용 범위

| 화면 | 처리 함수 |
|---|---|
| Courses 탭 목록 카드 | `getLocalizedCourseTitle` |
| 저장 코스 상세 | `normalizeSavedCourseForDisplay` |
| Map 탭 (View route on map 후) | `localizeSnapshotForDisplay` (NearbySheet) |

### anchor_label 향후 저장 개선

`saveCourse` 시 `courseSnapshot`에 `anchor_label`을 함께 저장하도록 수정.  
기존 데이터는 `savedRow.anchor_label`(DB 컬럼)에서 fallback으로 읽어 처리.

---

## 9. Filter UI 정리

### 제거한 섹션

```
가격대 / Price range
  ₩ / ₩₩ / ₩₩₩

이런 분께 / Good for
  영어 메뉴 / English menu
  할랄 옵션 / Halal options
  채식 친화 / Vegetarian friendly
  심야 영업 / Late night
```

### 제거 이유

해당 필터 옵션들이 실제 `applyFilters` 로직에 연결은 되어 있지만 DB 데이터에 가격/특성 정보가 충분히 채워지지 않아 동작하지 않는 상태.  
사용자가 선택해도 결과가 변하지 않으므로 UI에서 제거해 혼선을 방지.

### 유지한 것

```
- 음식 카테고리 (전체 + 18개 카테고리, 최대 3개 선택)
- 초기화 / Reset 버튼
- 결과 보기 / Show results 버튼
- 카테고리 최대 3개 제한 토스트
```

### 적용 범위

`FilterSheet.jsx` 단일 컴포넌트가 아래 모든 경로에서 공유되므로 일괄 적용됨:

```
- 메인 Map 화면 필터 버튼
- SearchOverlay 필터 버튼
- 모바일 화면 / PC 앱 프레임 내부
- 한국어 / 영어 모드 모두
```

### 구현 방식

- `FilterSheet.jsx`에서 PRICES / FEATURES import 제거
- Price / Good for 섹션 렌더링 삭제
- `EMPTY_FILTERS` 구조(`price: [], features: []`)는 그대로 유지
- `applyFilters`에서 price / features 필터링 로직도 그대로 유지 (향후 재활성화 대비)

---

## 10. 수정/생성 파일

### 신규 생성

```
src/shared/components/DesktopIntroPanel.jsx
src/assets/desktop/matgil-qr.png

src/features/courses/utils/courseMetrics.js
src/features/courses/utils/courseDisplay.js
src/features/courses/services/savedCourseService.js
src/features/courses/hooks/useSavedCourses.jsx
src/pages/SavedCourseDetailPage.jsx
```

### 수정

```
src/app/App.jsx                                        — DesktopIntroPanel 2열 레이아웃
src/app/router.jsx                                     — /saved-courses/:id 라우트 추가
src/shared/constants/routes.js                         — savedCourseDetail(id) 추가
src/shared/i18n/dictionary.js                          — savedCourses 네임스페이스 EN/KO 추가
src/shared/components/Icon.jsx                         — TrashIcon 추가

src/features/courses/components/CourseCard.jsx         — getDisplayMetrics 적용
src/pages/CoursesPage.jsx                              — 실제 저장 코스 목록으로 전환 + locale 제목
src/pages/HomePage.jsx                                 — savedCourseForMap state + router state 처리

src/features/explore/components/TodayCourseDetail.jsx  — onSave / saveState props 추가
src/features/explore/components/NearbySheet.jsx        — 저장 기능, 배지, locale 처리, 위치 초기화
src/features/explore/components/FilterSheet.jsx        — 가격대 / 이런 분께 섹션 제거
```

---

## 11. 테스트 및 빌드 결과

```
npm run build: ✓ built in ~3–4s
신규 오류 없음 (기존 CSS 경고 / chunk 500kB 경고는 이번 작업 이전부터 존재)

- 코스 저장 / 목록 / 상세 / View route on map 흐름 동작 확인
- Saved / 저장됨 상태 버튼 표시 확인
- 저장 배지 (Saved 오버레이) Map 탭 코스 카드 표시 확인
- 영문 저장 코스를 한국어 모드에서 열 때 한국어 제목/stop명으로 표시 확인
- 필터에서 가격대 / 이런 분께 섹션 제거 확인 (EN/KO 모두)
- 핫플레이스 전환 시 stale course 잔류 버그 해결 확인
```

---

## 12. 남은 주의사항

- **저장 코스는 snapshot 기반** — 저장 당시 데이터 구조에 영향을 받는다. 장소 정보가 DB에서 수정되더라도 저장 코스에는 반영되지 않는다.
- **locale 처리는 표시 단계** — `course_snapshot` 자체를 locale별로 다시 저장하지 않는다. 표시 시 `courseDisplay.js` 헬퍼로 재구성한다.
- **도보 시간은 추정값** — 실제 길찾기 API가 아니라 직선거리/저장 거리 기반 (15분/km) 추정이다. 향후 Kakao Directions API 연동 시 `total_duration_min` 계산 기준을 개선할 수 있다.
- **nameKo 필드 의존** — stop locale 처리가 `placeApi.js`가 저장하는 `nameKo` 필드에 의존한다. 데이터가 없는 장소는 EN name으로 fallback된다.
- **Filter 재활성화** — 가격대 / 취향 필터는 DB 데이터 보강 후 `FilterSheet.jsx`에 섹션을 다시 추가하면 된다. `exploreOptions.js`의 `PRICES` / `FEATURES` 정의와 `applyFilters` 로직은 삭제하지 않고 유지한다.
- **updated_at 자동화** — 현재 soft delete 시 클라이언트에서 `updated_at` 직접 세팅. 향후 DB 트리거를 추가하면 이 처리를 제거할 수 있다.
