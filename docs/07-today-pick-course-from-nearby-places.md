# 07. TODAY'S PICK — nearby places 기반 코스 카드 전환

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (06)

- Food Type 필터 복수 선택 전환 (최대 3개, toast 안내)
- 위치 프리셋 10개 추가 — 기본값 Seoul City Hall
- `sortPlacesByDistance` 로 거리순 정렬 + `distanceKm` 주입
- LocationSheet (bottom sheet 위치 선택 UI) 추가
- NearbySheet 제목 및 카드 거리 표시 동적화

---

## 이번 세션 작업 목표

Map 탭 Bottom Sheet의 `TODAY'S PICK` 카드를 하드코딩(`COURSES[0]`, Myeongdong Night Eats)에서 실제 nearby places 기반 코스 카드로 전환한다.

---

## 작업 전 상태

- `NearbySheet`가 `COURSES[0]`를 고정으로 받아 `CourseCard`에 전달
- `CourseCard` 상단 이미지 영역은 `tint` placeholder만 사용 (imageUrl 미사용)
- 카드 클릭 시 `/courses/today-pick` 라우트로 이동 → 매칭 없어 mock Courses 탭으로 fallback
- Courses 탭 데이터는 여전히 mock (`Myeongdong Night Eats` 등)

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/data/courseBuilder.js` | 신규 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/courses/components/CourseCard.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. `courseBuilder.js` — 신규

nearby places를 입력으로 받아 TODAY'S PICK 코스 1개를 생성한다.

```js
buildTodayCourse({ places, selectedLocation, selectedFoodTypes })
```

**후보 구성:**

```js
const COURSE_CANDIDATE_LIMIT = 20;
const DEFAULT_STOP_COUNT = 3;

candidates = places
  .filter(p => p.latitude != null && p.longitude != null)
  .slice(0, 20)
```

**Fallback:**

| candidates 수 | 결과 |
|---|---|
| 0 | `null` 반환 → TODAY'S PICK 섹션 숨김 |
| 1 | 1 stop 코스 |
| 2 | 2 stops 코스 |
| 3+ | 3 stops 조합 중 최고점 선택 |

**점수 계산:**

```
courseScore =
  clusterScore      (최대 35 — stop 간 이동거리 짧을수록 높음)
  + diversityScore  (최대 20/10 — Food Type 선택 여부에 따라 기준 다름)
  + cafeBonus       (최대 15 — cafe 포함 시)
  + dataQualityScore (최대 20 — imageUrl, firstMenu, 좌표, 카테고리 품질)
  + startAccessScore (최대 10 — 첫 stop의 selectedLocation 접근성)
  - weakOtherPenalty (Food Type 미선택 + other-only stop 시 장소당 -2)
```

- **랜덤 없음, LLM 없음, Kakao Map 없음**
- 동일 입력 → 항상 동일 결과 (Tie-break 4단계 고정)
- Food Type은 점수 가산이 아니라 후보군 필터 (`applyFilters`에서 이미 처리됨)
- `diversityScore` 기준만 Food Type 선택 여부에 따라 분기

**코스 제목 rule-based 생성:**

| 조건 | 제목 |
|---|---|
| cafe + 일반 음식점 포함 | `{location} Cafe & Bites` |
| street 중심 | `{location} Street Food Tour` |
| bbq 중심 | `{location} Korean BBQ Route` |
| noodle 중심 | `{location} Noodle Walk` |
| 그 외 | `{location} Food Walk` |

**CourseCard 호환 반환:**

```js
{
  id: 'today-pick',
  title,
  stops: stops.map((stop, i) => ({ ...stop, tint: TINTS[i % TINTS.length] })),
  km: `${dist.toFixed(1)} km`,
  hr: estimatedTime,   // ~30 min / ~1 hr / ~1.5 hr
  accent: '#F8481F',
  score,
  totalDistanceKm,
  stopCount,
}
```

---

### 2. `HomePage.jsx` — 수정

- `COURSES` import 제거
- `buildTodayCourse` import 추가
- `nearby`, `todayCourse` 모두 `useMemo`로 처리

```js
const nearby = useMemo(
  () => sortPlacesByDistance(applyFilters(places, filters), selectedLocation),
  [places, filters, selectedLocation],
);

const todayCourse = useMemo(
  () => buildTodayCourse({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat }),
  [nearby, selectedLocation, filters.cat],
);
```

- `NearbySheet`에 `course={todayCourse}` 전달

---

### 3. `NearbySheet.jsx` — 수정

- `course` null 시 TODAY'S PICK 섹션 전체 숨김
- "Nearby right now" 구분선 상단 여백 동적 처리 (`course ? mt-5 : mt-1`)
- `<CourseCard course={course} disableLink />` 로 클릭 이동 방지

---

### 4. `CourseCard.jsx` — 수정

- 내부 UI를 `CourseCardInner`로 분리
- `Thumbnail`에 `src={stop.imageUrl}` 추가
  - imageUrl 있으면 실제 이미지 표시
  - 없거나 로딩 실패 시 기존 tint placeholder fallback (`Thumbnail` 자체 `onError` 처리)
- `disableLink = false` prop 추가
  - `true`이면 `<Link>` 대신 `<div>` 렌더링
  - Courses 탭 기존 사용처는 `disableLink` 기본값 `false` → 영향 없음

---

## 동작 확인

- 위치 변경(예: Seoul City Hall → Hongdae) 시 TODAY'S PICK 제목, 거리, 이미지 변경
- Food Type 선택 시 필터된 후보 안에서 코스 구성 변경
- TODAY'S PICK 클릭 시 Courses 탭으로 이동하지 않음

---

## 아직 하지 않은 것

- 여러 코스 추천 (현재 1개 고정)
- TODAY'S PICK 상세 sheet/page
- Kakao Map 마커 / polyline
- 실제 도보 경로 계산
- LLM 추천 이유 생성
- 검색창 실제 검색 기능
- price / features 실제 Supabase 데이터 기반 필터 고도화
- 지역별 음식점 데이터 확장 (현재 명동 일대 100개 집중)
- Courses 탭 mock 데이터 → 실제 데이터 전환

---

## 다음 작업 후보

- TODAY'S PICK 상세 sheet 또는 page 연결
- 추천 코스 2~3개 확장
- Kakao Map 마커 / polyline 연결
- 지역 데이터 확장 (TourAPI 추가 수집)
