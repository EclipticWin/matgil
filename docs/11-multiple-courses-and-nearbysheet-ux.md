# 11. 다중 추천 코스 및 NearbySheet UX 개선

## 작업 일자

2026-06-18

---

## 이전 작업 요약 (10)

- `loadKakaoMapSdk.js` 신규 — Kakao Maps JS SDK 싱글턴 로더
- `KakaoMap.jsx` 신규 — 번호 마커(CustomOverlay) + 직선 polyline
- `courseBuilder.js` 수정 — 반경 tier 후보 선택으로 위치 이탈 보정
- `HomePage.jsx` 수정 — placeholder 제거, KakaoMap 삽입

---

## 이번 세션 작업 목표

1. 추천 코스를 최대 3개까지 생성하고, 사용자가 선택한 코스 하나만 지도에 표시
2. NearbySheet UX 정리 — collapsed 접기 상태 추가, 카드 클릭 동작 명확화

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/data/courseBuilder.js` | 수정 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. `courseBuilder.js` — 다중 코스 생성

#### 기존 유지

`buildTodayCourse()` 함수는 하위 호환성을 위해 그대로 유지.

#### 신규: `buildRecommendedCourses()`

```js
export function buildRecommendedCourses({ places, selectedLocation, selectedFoodTypes, maxCourses = 3 })
```

**동작 원칙:**

| 항목 | 내용 |
|---|---|
| 최대 코스 수 | `maxCourses` (기본값 3) |
| 후보 선택 | 기존 `selectCandidates()` 동일 — 2km / 4km / 전체 tier |
| stop 중복 제거 | `usedIds Set` — 앞 코스에서 사용한 stop은 뒤 코스에서 제외 |
| accent 색상 | `COURSE_ACCENTS = ['#F8481F', '#5B7CFA', '#2CB67D']` 순환 |
| 코스 ID | `recommended-1`, `recommended-2`, `recommended-3` |

```js
const COURSE_ACCENTS = ['#F8481F', '#5B7CFA', '#2CB67D'];

export function buildRecommendedCourses({ places, selectedLocation, selectedFoodTypes, maxCourses = 3 }) {
  const candidatePool = selectCandidates(validPlaces, selectedLocation);
  const usedIds = new Set();

  for (let i = 0; i < maxCourses; i++) {
    const available = candidatePool.filter((p) => !usedIds.has(p.id));
    if (available.length === 0) break;
    const course = buildOneCourse(available, selectedLocation, foodTypes,
      `recommended-${i + 1}`, COURSE_ACCENTS[i % COURSE_ACCENTS.length]);
    if (!course) break;
    course.stops.forEach((s) => usedIds.add(s.id));
    courses.push(course);
  }
  return courses;
}
```

**후보가 부족할 때:** `available.length === 0`이면 루프 종료 — 1~2개 코스만 반환.

---

### 2. `HomePage.jsx` — activeCourse 상태 관리

```js
// 추천 코스 목록 (useMemo)
const recommendedCourses = useMemo(
  () => buildRecommendedCourses({ places: nearby, selectedLocation, selectedFoodTypes: filters.cat }),
  [nearby, selectedLocation, filters.cat],
);

// 선택 코스 ID 상태
const [activeCourseId, setActiveCourseId] = useState(null);

// 위치/필터 변경 시 첫 번째 코스로 초기화
useEffect(() => {
  setActiveCourseId(null);
}, [selectedLocation, filters.cat]);

// activeCourse 도출 — null이면 첫 번째 코스 fallback
const activeCourse =
  recommendedCourses.find((c) => c.id === activeCourseId) ?? recommendedCourses[0] ?? null;
```

```jsx
{/* 지도: activeCourse 하나만 표시 */}
<KakaoMap selectedLocation={selectedLocation} course={activeCourse} />

{/* 시트: 전체 코스 목록 전달 */}
<NearbySheet
  vh={vh}
  courses={recommendedCourses}
  activeCourse={activeCourse}
  onSelectCourse={(c) => setActiveCourseId(c.id)}
  places={nearby}
  selectedLocation={selectedLocation}
/>
```

---

### 3. `NearbySheet.jsx` — UX 전면 정리

#### 3-1. 드래그 스트립 전역화

기존에는 드래그 핸들이 기본 목록 뷰에만 있었다. 이를 시트 최상단에 항상 배치하여 **기본 목록 / 코스 상세 / 식당 상세 어느 화면에서든 접기 가능**.

```
[드래그 pill — 항상 표시]
────────────────────────
[현재 뷰]
  · 기본 목록   (header + 추천 코스 + 식당 목록)
  · 코스 상세   (TodayCourseDetail, flex-1 min-h-0)
  · 식당 상세   (PlaceDetailSheet, flex-1 min-h-0)
```

#### 3-2. Snap 상태 — 3단계

| 상태 | 높이 | 동작 |
|---|---|---|
| `'peek'` | `vh × 0.44` | 기본 상태 |
| `'full'` | `vh × 0.92` | 코스 상세 진입 시 자동 전환 |
| `'collapsed'` | `0` | peek의 35% 이하까지 드래그 시 전환 |

드래그 snap 임계값:

```
cur > (peek + full) / 2   → 'full'
cur > peek × 0.35         → 'peek'
cur ≤ peek × 0.35         → 'collapsed'
```

#### 3-3. Collapse 동작

- `collapsed` 전환 시 `selectedCourse` / `selectedPlace` **유지** (뷰 상태 보존)
- `preCollapseSnap` ref에 직전 snap 저장
- handle 클릭 → `setSnap(preCollapseSnap.current)` → 직전 뷰·높이로 복귀

```
코스 상세 (full) → 드래그 내리기 → collapsed
handle 클릭 → 코스 상세 (full) 복귀  ✓

기본 목록 (peek) → 드래그 내리기 → collapsed
handle 클릭 → 기본 목록 (peek) 복귀  ✓
```

#### 3-4. Pull-up Handle

아이콘만 표시, 텍스트 없음:

```jsx
<button
  onClick={handleExpand}
  className="... h-8 w-14 rounded-t-2xl bg-white shadow-[0_-3px_14px_rgba(34,24,20,0.12)]"
>
  <ChevronRightIcon size={15} className="-rotate-90 text-coral" />
</button>
```

- `collapsed` + `dragH === null` 일 때만 렌더
- `pointer-events-none` 컨테이너 + `pointer-events-auto` 버튼으로 지도 터치 차단 없음

#### 3-5. 추천 코스 카드 UX

| 항목 | 변경 내용 |
|---|---|
| 카드 클릭 | `onSelectCourse(course)` + `openDetail(course)` 동시 실행 |
| 활성 코스 표시 | `ring-2 ring-coral/55` 테두리만 — 텍스트 표지 없음 |
| "View route" 버튼 | 제거 |
| "ON MAP" 텍스트 | 제거 |

---

## 동작 확인

- 기본 목록에서 코스 카드 2~3개 표시
- 카드 탭 → activeCourse 변경 + 지도 마커/선 교체 + 코스 상세 진입
- 코스 상세에서 드래그 내리기 → collapsed (코스 상세 상태 보존)
- handle 탭 → 코스 상세 full 높이로 복귀
- 기본 목록에서 드래그 내리기 → collapsed
- handle 탭 → 기본 목록 peek 높이로 복귀
- 식당 상세에서도 동일한 collapse/복귀 동작 ✓
- 활성 코스 테두리 ring이 코스 카드에 표시
- Nearby right now 목록 그대로 유지
- `npm run build` 통과

---

## 아직 하지 않은 것

- 실제 도보 경로 계산 (Kakao Directions API)
- GPS 현재 위치 기능
- 마커 클릭 시 식당 상세 열기
- 장소 검색 기능
- GitHub Pages 배포 workflow에 `VITE_KAKAO_MAP_JS_KEY` env 주입
- 지역별 음식점 데이터 확장

---

## 다음 작업 후보

- GitHub Pages 배포 workflow 구성 + Secret 주입
- 지역별 데이터 확장 (명동 외 지역 추가)
- 코스 즐겨찾기/저장 기능
