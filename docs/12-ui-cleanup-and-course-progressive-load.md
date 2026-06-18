# 12. UI 정리 및 추천 코스 점진적 로딩

## 작업 일자

2026-06-18

---

## 이전 작업 요약 (11)

- `buildRecommendedCourses()` 신규 — 최대 3개 코스 생성, stop 중복 제거, accent 색상 순환
- `HomePage.jsx` 수정 — `activeCourseId` 상태 관리, `KakaoMap`에 activeCourse 하나만 전달
- `NearbySheet.jsx` 전면 정리 — collapsed 3단계 snap, 드래그 pill 전역화, 코스 카드 클릭 → activeCourse 변경 + 코스 상세 진입
- pull-up handle 추가 — collapsed 상태에서 아이콘만 표시, 직전 snap으로 복귀

---

## 이번 세션 작업 목표

1. `Nearby right now` 전체 식당 목록 제거
2. 추천 코스 부족 시 빈 상태 UI 추가
3. 과하게 컬러풀한 UI 요소 정리
4. 코스 상세의 `Start this course` 버튼 삭제
5. 추천 코스 `3 STOPS` 배지 색상 coral 통일
6. 추천 코스 점진적 로딩 구현 (무한 스크롤)

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/explore/components/TodayCourseDetail.jsx` | 수정 |
| `src/features/courses/components/CourseCard.jsx` | 수정 |
| `src/pages/HomePage.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. `Nearby right now` 전체 식당 목록 제거

`NearbySheet.jsx`에서 다음 요소 전부 삭제:

- `NearbyRow` 컴포넌트
- `TINTS` 상수
- `Nearby right now` 섹션 제목 및 구분선
- 식당 목록 렌더링
- `places` prop (컴포넌트 시그니처 및 `HomePage.jsx` 호출부에서 제거)
- 관련 import: `Card`, `Thumbnail`, `HeartIcon`, `useBookmarks`

헤더의 `{places.length} nearby` 카운트도 함께 제거. 헤더는 타이틀만 유지:

```jsx
<h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
  Eat near {selectedLocation?.label ?? 'here'}
</h2>
```

---

### 2. 추천 코스 빈 상태 UI

추천 코스가 0개일 때 빈 스크롤 영역 대신 안내 메시지 표시:

```jsx
<div className="flex flex-col items-center justify-center px-4 py-12 text-center">
  <p className="text-[0.95rem] font-semibold text-ink-soft">No routes found nearby.</p>
  <p className="mt-1.5 text-[0.82rem] text-ink-faint">
    Try another area or remove some filters.
  </p>
</div>
```

- 1개 / 2개 코스: 있는 만큼 자연스럽게 표시
- 억지로 먼 지역 후보를 끌고 오지 않음
- 2km / 4km tier 정책 유지

---

### 3. UI 컬러 정리

#### 3-1. Collapsed pull-up handle 화살표 색상

```jsx
// Before
<ChevronRightIcon size={15} className="-rotate-90 text-coral" />

// After
<ChevronRightIcon size={15} className="-rotate-90 text-stone-400" />
```

coral 계열 → `text-stone-400` (muted 회색). 배경 흰색 유지.

#### 3-2. 추천 코스 카드 `3 STOPS` 배지 색상

`CourseCard.jsx`에서 `course.accent` 기반 인라인 스타일 제거, Tailwind className으로 분기:

```jsx
// Before
<span
  className="... text-white"
  style={{ background: course.accent }}
>

// After
<span
  className={cn(
    '...',
    isActive ? 'bg-coral text-white' : 'bg-ink/15 text-ink-soft',
  )}
>
```

| 상태 | 배지 배경 | 배지 글씨 |
|---|---|---|
| activeCourse | `bg-coral` (항상 coral — blue/green 없음) | `text-white` |
| inactiveCourse | `bg-ink/15` (warm neutral 회색) | `text-ink-soft` |

activeCourse 구분: `ring-2 ring-coral/55` 카드 테두리 + coral 배지.

---

### 4. `Start this course` 버튼 제거

`TodayCourseDetail.jsx` 하단 CTA 블록 삭제:

```jsx
// 삭제된 코드
<div className="shrink-0 border-t border-ink/5 px-5 pb-5 pt-3">
  <Button full disabled>
    <NavIcon /> Start this course
  </Button>
</div>
```

`Button` import, `NavIcon` import도 함께 제거. 스크롤 본문이 하단 여백까지 자연스럽게 채움.

---

### 5. 추천 코스 점진적 로딩 (무한 스크롤)

#### 데이터 확장

`HomePage.jsx`에서 `maxCourses: 9`로 확장:

```js
const recommendedCourses = useMemo(
  () => buildRecommendedCourses({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat, maxCourses: 9 }),
  [nearby, selectedLocation, filters.cat],
);
```

`COURSE_CANDIDATE_LIMIT = 20` 기준으로 실제 생성 가능 코스 수는 3~7개 수준. `buildRecommendedCourses`는 후보 소진 시 자동 종료.

#### NearbySheet.jsx — 점진적 표시 구조

```js
const INITIAL_VISIBLE = 3;  // 초기 표시 수
const LOAD_BATCH = 3;       // 추가 로드 단위
```

상태:

```js
const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
const [loadingMore, setLoadingMore] = useState(false);
const scrollContainerRef = useRef(null);  // overflow-y-auto 컨테이너
const sentinelRef = useRef(null);         // 하단 감시 div
```

위치/필터 변경 시 초기화:

```js
useEffect(() => {
  setVisibleCount(INITIAL_VISIBLE);
  setLoadingMore(false);
}, [courses]);
```

IntersectionObserver — root를 scrollContainer로 지정:

```js
useEffect(() => {
  const sentinel = sentinelRef.current;
  const container = scrollContainerRef.current;
  const total = courses?.length ?? 0;
  if (!sentinel || !container || visibleCount >= total || loadingMore) return;

  const obs = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      setLoadingMore(true);
      setTimeout(() => {
        setVisibleCount((prev) => Math.min(prev + LOAD_BATCH, total));
        setLoadingMore(false);
      }, 400);
    },
    { root: container, threshold: 0.1 },
  );
  obs.observe(sentinel);
  return () => obs.disconnect();
}, [courses, loadingMore, visibleCount]);
```

렌더:

```jsx
{/* 센티널 — hasMore일 때만 렌더, 뷰포트 진입 시 load-more 트리거 */}
{hasMore && <div ref={sentinelRef} className="h-1" />}

{/* 스피너 — 로딩 중에만 표시 */}
{loadingMore && (
  <div className="flex justify-center py-4">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/10 border-t-ink/30" />
  </div>
)}
```

스피너: Tailwind `animate-spin`, 20×20px, `border-ink/10` 트랙 + `border-t-ink/30` 회전부 — muted 스타일.

#### 동작 흐름

| 상태 | 동작 |
|---|---|
| 초기 | 3개 표시, sentinel 하단 배치 |
| 스크롤 하단 도달 | sentinel intersect → 400ms 후 3개 추가 표시 |
| 모든 코스 표시됨 | sentinel 제거, 스피너 없음, observer 해제 |
| 위치/필터 변경 | `visibleCount` 3으로 초기화 |

DB pagination 불필요 — places는 이미 전체 메모리 로드.

---

## 동작 확인

- 추천 코스 목록에 Nearby right now 식당 목록 없음 ✓
- 추천 코스 0개 시 빈 상태 안내 표시 ✓
- 추천 코스 1~2개 시 있는 수만큼 자연스럽게 표시 ✓
- collapsed handle 화살표 → 회색 ✓
- activeCourse 배지 → 항상 coral ✓
- inactiveCourse 배지 → neutral 회색 ✓
- Start this course 버튼 없음 ✓
- 코스 상세 → 식당 상세 → 뒤로가기 흐름 유지 ✓
- peek/full/collapsed snap 및 handle 복귀 유지 ✓
- 지도에 activeCourse 하나만 표시 ✓
- 스크롤 하단 도달 시 추가 코스 점진적 표시 ✓
- 더 없으면 sentinel/spinner 사라짐 ✓
- `npm run build` 통과 ✓

---

## 아직 하지 않은 것

- 실제 도보 경로 계산 (Kakao Directions API)
- GPS 현재 위치 기능
- 마커 클릭 시 식당 상세 열기
- 장소 검색 기능
- GitHub Pages 배포 workflow에 `VITE_KAKAO_MAP_JS_KEY` env 주입
- 지역별 음식점 데이터 확장 (명동 외)

---

## 다음 작업 후보

- GitHub Pages 배포 workflow 구성 + Secret 주입
- 지역별 데이터 확장 (명동 외 지역 추가)
- 코스 즐겨찾기/저장 기능
- 검색 기능 구현
