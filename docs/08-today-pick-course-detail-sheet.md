# 08. TODAY'S PICK — 코스 상세 Bottom Sheet

## 작업 일자

2026-06-17 ~ 2026-06-18

---

## 이전 작업 요약 (07)

- `buildTodayCourse()` 신규 — nearby places 기반 TODAY'S PICK 코스 1개 생성
- `CourseCard`에 `disableLink` prop 추가 → Map 탭에서 Courses 탭 이동 방지
- `NearbySheet`가 `todayCourse`를 받아 `CourseCard disableLink`로 렌더링
- `CourseCard`의 stop 썸네일에 `stop.imageUrl` 실제 이미지 표시 (tint placeholder fallback)
- 도보 10분 우선 거리 pool 선택 로직 적용 (ideal ≤1.0km / preferred ≤1.5km / fallback)

---

## 이번 세션 작업 목표

Map 탭 `TODAY'S PICK` 카드를 클릭했을 때 Courses 탭이나 라우트로 이동하지 않고,
**Map 화면 Bottom Sheet 내부에서 실제 `todayCourse.stops`를 보여주는 상세 화면으로 전환**한다.

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/components/TodayCourseDetail.jsx` | 신규 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/courses/components/CourseCard.jsx` | 수정 |
| `ai-docs/07-course-detail-sheet-plan.md` | 신규 (기획 문서) |

`src/pages/HomePage.jsx` — 변경 없음

---

## 핵심 구현 내용

### 1. `CourseCard.jsx` — `onClick` prop 추가

`disableLink=true` + `onClick` 있음 → `<button type="button">` 렌더링 (접근성 고려)

```js
// disableLink=true + onClick 있음 → button
// disableLink=true + onClick 없음 → plain div (기존 동작 유지)
// disableLink=false → Link (Courses 탭 기존 동작 유지)
export default function CourseCard({ course, disableLink = false, onClick }) {
```

`onKeyDown`으로 Enter / Space 키도 처리.
기존 `rounded-3xl shadow-card` 카드 스타일 유지.

---

### 2. `NearbySheet.jsx` — 상태 전환 + z-index

**추가 상태:**

```js
const [selectedCourse, setSelectedCourse] = useState(null);
// null → 기본 목록 상태
// not null → 상세 상태
```

**openDetail / closeDetail:**

```js
const openDetail = (c) => {
  setSelectedCourse(c);
  setSnap('full');   // 상세 진입 시 sheet 자동 full 전환
  setDragH(null);
};
const closeDetail = () => setSelectedCourse(null);
```

**렌더 분기:**

```jsx
{selectedCourse ? (
  <TodayCourseDetail course={selectedCourse} selectedLocation={selectedLocation} onBack={closeDetail} />
) : (
  /* 기본 목록 상태 (드래그 핸들 + CourseCard + NearbyRow 목록) */
)}
```

**CourseCard에 onClick 전달:**

```jsx
<CourseCard course={course} disableLink onClick={() => openDetail(course)} />
```

**z-index 통일:**

```jsx
className="absolute inset-x-0 bottom-0 z-30 flex flex-col ..."
```

- 기본/상세 모두 `z-30` 고정
- floating controls (검색/위치/언어): `z-20` → 기본 목록 상태에서도 Bottom Sheet가 위에 표시됨
- Modal (FilterSheet / LocationSheet / LanguageModal): `z-40` → 여전히 위에 표시됨

---

### 3. `TodayCourseDetail.jsx` — 신규

Map Bottom Sheet 내부 전용 상세 콘텐츠 컴포넌트.
Courses 탭 mock `CourseDetailPage.jsx`와 완전 분리.

**props:** `course`, `selectedLocation`, `onBack`

**화면 구성:**

```txt
[헤더 shrink-0]
  뒤로가기 버튼 (bg-ink/8, rounded-full)
  ★ TODAY'S PICK 라벨 (text-coral)
  course.title
  stops / km / hr

[스크롤 본문 flex-1 overflow-y-auto]
  blurb 문장 (rule-based: "A short food walk near {label}.")
  Route stops 라벨
  stops 목록 (numbered badge + dotted connector + 카드)

[하단 CTA shrink-0]
  Start this course 버튼 (disabled — 기능 미구현)
```

**stop 필드 어댑테이션** (mock `CourseDetailPage`의 `cuisine`/`rating`과 다름):

```js
subtitle = stop.firstMenu || stop.tags?.[0] || '음식점'
dist     = stop.distanceKm → "XXX m" / "X.X km" || stop.address
thumbnail = stop.imageUrl (tint fallback)
```

**Route Stops 레이아웃:**

```txt
왼쪽 컬럼: 번호 배지 (bg-coral, shadow-coral) + 세로 dotted connector
오른쪽 카드: bg-white/45, rounded-2xl, border border-ink/5, px-3 py-3
            Thumbnail + name/subtitle/dist + ChevronRightIcon
```

connector는 왼쪽 컬럼(0~34px)과 badge-card 사이(34~54px)에만 위치.
카드는 54px부터 시작 → connector가 카드 배경에 가리지 않음.

**connector 위치 계산:**

| 구성 요소 | 값 |
|---|---|
| 카드 `py-3` | 12px × 2 |
| 카드 콘텐츠 높이 | `h-14` = 56px (thumbnail 최대) |
| 카드 총 높이 | 80px |
| `space-y-3` 행 간격 | 12px |
| badge 중심 | (80−34)/2 + 17 = 40px |
| connector | `top-10` / `bottom-10` (40px) |

---

## UI 조정 과정

### z-index 수정

- 초기: 기본 목록 `z-10`, 상세 `z-30` 조건부
- 변경: 항상 `z-30` — 기본 목록에서도 floating controls(`z-20`)를 가림

### Route Stops border 시행착오

1. **1차**: outer row 전체에 `border-b` → 번호 배지 왼쪽까지 선이 침범 → 제거
2. **2차**: 오른쪽 콘텐츠 wrapper에만 `border-b` 이동 → 여전히 어색해 보임 → 전면 제거
3. **최종**: border 없이 연한 카드 배경(`bg-white/45 border border-ink/5`)으로 구분

### dotted connector top/bottom 계산 변경

| 상태 | 계산 | 값 |
|---|---|---|
| `py-3` (중간 시도) | 12+(56−34)/2+17 = 40px | `top-10 bottom-10` |
| `py-4` (중간 시도) | 16+(56−34)/2+17 = 44px | `top-11 bottom-11` |
| `py-5` (중간 시도) | 20+(56−34)/2+17 = 48px | `top-12 bottom-12` |
| **최종 (카드 구조)** | (80−34)/2+17 = 40px | **`top-10 bottom-10`** |

---

## 동작 확인

- TODAY'S PICK 카드 클릭 → Bottom Sheet가 full 높이로 확장되며 상세 화면 전환
- 뒤로가기 버튼 → 기본 목록 상태 복귀
- 상세 화면에서 실제 `todayCourse.stops` 표시
- 상세 진입 시 floating controls(검색창/위치/언어 버튼)보다 Bottom Sheet가 위에 표시
- FilterSheet / LocationSheet / LanguageModal은 `z-40`으로 여전히 정상 동작
- Courses 탭 mock CourseCard → Link 이동 유지 (영향 없음)

---

## 아직 하지 않은 것

- place detail sheet (개별 음식점 상세 화면)
- Start this course 실제 기능
- Kakao Map 마커 / polyline
- 실제 도보 경로 계산
- LLM 추천 이유 생성
- 여러 추천 코스 생성
- Courses 탭 mock 데이터 → 실제 데이터 전환
- 검색창 실제 검색 기능

---

## 다음 작업 후보

- 각 stop 카드 클릭 시 place detail sheet 열기
- 추천 코스 2~3개 확장
- Kakao Map 마커 / polyline 연결
- 지역 데이터 확장 (TourAPI 추가 수집)
