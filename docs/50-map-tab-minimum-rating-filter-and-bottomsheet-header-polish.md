# 50. Map 탭 최소 평점 필터 신규 구현 + 바텀시트 헤더/드래그 버그 정리

## 작업 일시

- 작성일시: 2026-07-21 23:34 KST

## 작업 배경

`docs/49-underline-tabs-saved-tab-cta-voice-help-ai-badge-and-mg-place-translate-en-centennial-store.md`(커밋 `bbb2f26` 이후 세션) 이후 여러 세션에 걸쳐 이어진 작업을 이 문서 하나로 정리한다. 핵심은 Map 탭 FilterSheet에 "최소 리뷰 평점" 필터를 신규로 추가하는 것이었고, 그 과정에서 사용자 브라우저 확인을 거쳐 UI 미세 조정과 기존에 잠재해 있던 버그(코스 상세 미동기화, 지도 중심 위치명, 드래그 닫힘 점프) 수정이 이어졌다. 각 세션은 직전 세션의 git diff를 조사한 뒤 최소 수정으로 이어 붙이는 방식으로 진행했으며, 이 문서 작성 시점까지 어떤 세션도 `git add`/`commit`/`push`를 수행하지 않았다 — 모든 변경이 여전히 워킹 디렉터리에 미커밋 상태로 남아 있다.

---

## 1. 최소 평점 필터 — 데이터 계층

### 리뷰 통계 조회 (`src/features/places/services/placeReviewService.js`)

기존 `fetchPlaceReviewStats`/`fetchPlaceReviewStatsBatch`(특정 place_id 목록 대상)는 그대로 두고, Map 탭처럼 "활성 가게 전체"의 통계가 필요한 화면을 위해 `fetchAllPlaceReviewStats()`를 신규 추가했다.

- `mg_place_review_stats`에서 `place_id, rating_avg, rating_count`만 select(불필요한 컬럼 제외)
- `order('place_id')` + `.range(from, to)`로 500~1000행씩 페이지네이션 — 활성 가게 ID를 `.in()` 하나에 몰아넣지 않고, Supabase 기본 반환 제한에도 의존하지 않는다
- 각 행의 `rating_avg`/`rating_count`를 `Number()`로 정규화(Postgres numeric이 문자열로 오는 경우 대비), 값이 유효하지 않으면 그 행 자체를 버림(있으나 마나 한 값을 병합하지 않기 위해)
- 반환값: `Map<place_id, { ratingAvg, ratingCount }>`

### 장소 조회 (`src/api/placeApi.js`)

- 기존 `getPlaces(locale)`는 완전히 그대로 유지 — `PopularPage.jsx`, `recommendationService.js` 등 다른 화면이 통계 조회 비용을 추가로 떠안지 않는다
- `getPlacesWithReviewStats(locale)` 신규 추가 — 내부적으로 `getPlaces(locale)`를 호출한 뒤 `fetchAllPlaceReviewStats()` 결과를 `place_id` 기준으로 병합
- 통계 조회가 실패해도 장소 목록 자체는 정상 반환하고 `{ places, reviewStatsAvailable: false }`로 실패 사실만 알림 — 통계 실패가 장소 조회 실패로 번지지 않는다
- 통계 조회가 성공했지만 0행인 경우(리뷰가 아직 없는 초기 상태)는 `reviewStatsAvailable: true`로 정상 처리 — "조회 실패"와 "결과 0건"을 구분

### 필터 로직 (`src/features/explore/data/exploreOptions.js`)

```js
export const EMPTY_FILTERS = { cat: [], price: [], features: [], minimumRating: 0 };

function matchesRating(place, minimumRating) {
  const min = Number(minimumRating) || 0;
  if (min <= 0) return true;
  const avg = Number(place.ratingAvg);
  const count = Number(place.ratingCount);
  return Number.isFinite(avg) && Number.isFinite(count) && count > 0 && avg >= min;
}
```

- `minimumRating`이 0이면 리뷰 유무와 무관하게 전체 통과, 1 이상이면 `ratingCount > 0 && ratingAvg >= min`인 가게만 통과(5는 `avg >= 5`로 동일 처리, 정확히 5.0인 가게만 남음)
- `applyFilters()`에 `matchesRating`을 AND 조건으로 추가 — 기존 `matchesCat`/가격/특징 조건은 그대로 두고 조건 하나만 얹었다
- `filterCount()`에도 `minimumRating > 0`을 반영(화면에 숫자로 노출하지는 않지만 Reset 여부 판단 등 내부 로직에서 계속 사용)

---

## 2. 최소 평점 필터 — UI (`src/features/explore/components/FilterSheet.jsx`)

### 별 + 슬라이더 구조

FOOD TYPE 칩 아래 `RATING` 섹션을 신규 추가했다. 최종 수치:

| 항목 | 값 |
|---|---|
| 별 아이콘 | `StarIcon`, 36px, 5개 |
| 별 간격 | `gap-2`(8px), `justify-center`(가운데 정렬, 좌우로 안 퍼짐) |
| 별+슬라이더 wrapper | `max-w-[13.5rem]` |
| 활성 별 | `text-coral` |
| 비활성 별 | `text-ink/15` |
| 슬라이더 트랙 두께 | 4px(WebKit/Firefox 동일) |
| 진행 구간 색상 | `rgba(38,26,17,0.48)`(ink 계열) |
| 미진행 구간 색상 | `rgba(168,153,138,0.18)`(ink-faint 계열) |
| thumb | 18×18px, `#a8998a`, WebKit `margin-top: -7px`로 트랙 중앙 정렬 |
| 섹션 제목 | `filter.rating` 키 — ko "최소 별점" / en "Minimum rating" / zh-CN "最低评分" |

coral은 활성 별에만 사용하고 슬라이더 트랙/thumb에는 전혀 쓰지 않았다. 트랙 스타일은 `src/index.css`의 `.matgil-rating-slider` 전용 클래스로 스코프해 다른 range input에 영향이 없다.

### 연속 드래그 + 정수 임계값 분리

슬라이더가 `step=1`이면 thumb가 6개 지점으로 뚝뚝 끊겨 움직이는 문제가 있어, 다음과 같이 두 값을 분리했다.

- `sliderPosition`(0~5 실수, `step=0.01`) — 실제 드래그되는 연속 위치, 컴포넌트 내부 state
- `minimumRating`(0~5 정수) — 부모(`FilterSheet`)에 전달되는 실제 필터값, `value`/`onChange` 외부 계약은 변경 없음

```js
function integerRatingFromPosition(position) {
  const clamped = Math.min(5, Math.max(0, position));
  return Math.min(5, Math.floor(clamped + RATING_POSITION_EPSILON));
}
```

`[n, n+1)` 구간은 전부 n으로 처리(floor 기반, 0.5에서 미리 채워지지 않음), 정수 경계를 실제로 지날 때만 `onChange(integer)`를 호출한다. 드래그 중에는 `isDraggingRef`로 가드해 자신이 방금 emit한 정수가 부모를 거쳐 `value` prop으로 되돌아와도 `sliderPosition`을 되돌리지 않는다(안 그러면 경계를 넘을 때마다 thumb가 정수 tick으로 튀는 문제가 생김).

### 별 클릭 + 키보드

- 별 각각을 `<button type="button" aria-label=... onClick={() => commitPosition(n)}>`로 구현 — 클릭한 별의 개수만큼 즉시 `sliderPosition`을 정수 n으로 이동시키고 thumb도 함께 이동한다(드래그와 완전히 같은 `commitPosition()` 경로를 타므로 둘이 어긋날 수 없음)
- 키보드 `ArrowLeft/Right/Up/Down`은 `step=0.01`의 native 동작을 가로채 정수 1점 단위로 이동하도록 재구현, `Home`/`End`는 native 기본 동작(0/5로 즉시 이동)을 그대로 사용
- `aria-valuetext`는 연속 위치가 아니라 실제 적용될 정수(`displayRating`) 기준 문구(`filter.minimumRatingValue`/`filter.noMinimumRating`)를 사용

### 통계 실패 시 disabled 처리

`ratingFilterAvailable={false}`(리뷰 통계 조회 실패)일 때: `RatingFilter`가 `disabled` 상태로 렌더(별 전부 회색, 슬라이더 `disabled`, 전체 wrapper `opacity-40`), `filter.ratingUnavailable` 안내 문구 표시, FilterSheet를 여는 순간 `draft.minimumRating`을 0으로 정규화해(기존에 적용돼 있던 값이 있어도) 통계 없는 상태에서 결과 보기를 눌러도 평점 조건이 재적용되지 않도록 방어했다.

### 하단 버튼 — 초기화 / 결과 보기 2등분

기존에는 상단 헤더 오른쪽에 "초기화" 텍스트 버튼이 있었으나, 하단 고정 영역으로 옮기고 "결과 보기"와 1:1 너비로 나란히 배치했다.

```jsx
<div className="shrink-0 border-t border-ink/5 px-5 py-3.5">
  <div className="flex gap-3">
    <button className="h-[3.25rem] flex-1 rounded-[0.9375rem] border border-ink/10 bg-white text-base font-bold text-ink/80 transition-colors duration-100 active:bg-ink/[0.03]">
      초기화
    </button>
    <button className="h-[3.25rem] flex-1 rounded-[0.9375rem] bg-coral text-base font-bold text-white shadow-[0_2px_6px_rgba(248,72,31,0.18)] transition-colors duration-100 active:bg-[#E83D19]">
      결과 보기
    </button>
  </div>
</div>
```

- 초기화: 흰 배경 + `border-ink/10`(옅은 회색 테두리) + `text-ink/80`(살짝 옅은 진한 글씨), 누르는 동안만 `active:bg-ink/[0.03]`
- 결과 보기: 기존 coral 배경/흰 글씨 유지, 누르는 동안만 `active:bg-[#E83D19]`(살짝 진한 coral)
- 두 버튼 모두 `active:scale-[0.98]`을 한 차례 넣었다가 "버튼/글자 크기가 같이 줄어든다"는 피드백을 받고 즉시 제거 — 최종적으로는 `transition-colors duration-100`만 남아 색상만 바뀌고 크기는 전혀 변하지 않는다
- 하단 영역 상하 padding: `pt-3 pb-7`(위아래 다른 값, 눈에 띄게 불균형) → `py-7`(상하 동일, 균형은 맞지만 전체적으로 큼) → 최종 `py-3.5`(상하 동일, 절반 축소)
- Reset의 동작 자체(`setDraft(EMPTY_FILTERS)`, Show results를 눌러야 실제 반영)는 위치만 옮겼을 뿐 로직은 전혀 바꾸지 않았다

### FOOD TYPE ↔ RATING 섹션 간격

공용 `SectionLabel`의 기본 `mt-5`를 그대로 두고(다른 섹션에 영향 없음), RATING에만 `className="mt-8"` → 이후 "아직 좁다"는 피드백으로 `mt-10`으로 재조정했다. `SectionLabel`은 `className` prop을 값 자체를 **교체**하는 방식으로 받도록 바꿔(추가 아님) 두 utility 클래스가 같은 속성을 두고 우선순위 다툼을 하지 않게 했다.

### 숫자 배지 제거

FOOD TYPE 선택 개수가 노출되던 3곳을 모두 제거했다.

- `HomePage.jsx` 검색바 필터 아이콘의 숫자 배지
- `SearchOverlay.jsx` 필터 아이콘의 숫자 배지(죽은 `filterCount` prop도 함께 제거)
- FilterSheet `Show results · 2` 형태의 숫자 suffix

내부 `filterCount()` 계산 자체는 Reset 버튼 강조색 판단 등에 계속 쓰이므로 남겨뒀다(화면에 숫자로 노출만 안 함).

---

## 3. HomePage 연결 (`src/pages/HomePage.jsx`)

- `getPlaces(locale)` → `getPlacesWithReviewStats(locale)` 호출로 교체, `reviewStatsAvailable` state 추가
- `effectiveFilters = reviewStatsAvailable ? filters : { ...filters, minimumRating: 0 }` — 통계 실패 시 이미 적용돼 있던 `minimumRating`을 무시하고 FOOD TYPE 등 나머지 조건은 그대로 유지(전체 후보가 사라지는 오동작 방지)
- `nearby` useMemo가 `filters` 대신 `effectiveFilters`로 `applyFilters()` 호출하도록 변경
- 추천 코스 초기화 effect 의존성에 `filters.minimumRating` 추가 — 평점 조건이 바뀌면 `activeCourseId`/`savedCourseForMap`도 초기화
- `FilterSheet`에 `ratingFilterAvailable`, `NearbySheet`에 `minimumRating={filters.minimumRating}` prop 추가

---

## 4. 추천 코스 제목 번호 매김 로직 수정 (`src/features/explore/data/courseBuilder.js`)

기존에는 추천 코스가 2개 이상이면 제목이 서로 달라도 무조건 꼬리 번호(`... Cafe & Bites 1`, `... Noodle Walk 2`, `... Food Walk 3`)를 붙였다. 이를 "완전히 동일한 제목이 2개 이상 겹칠 때만, 그 그룹 안에서만" 번호를 붙이도록 교체했다.

```js
const titleCounts = new Map();
for (const course of courses) titleCounts.set(course.title, (titleCounts.get(course.title) ?? 0) + 1);

const seenPerTitle = new Map();
for (const course of courses) {
  if ((titleCounts.get(course.title) ?? 0) <= 1) continue;
  const sequenceNumber = (seenPerTitle.get(course.title) ?? 0) + 1;
  seenPerTitle.set(course.title, sequenceNumber);
  course.title = appendCourseSequenceNumber(course.title, sequenceNumber);
}
```

이미 로컬라이즈된 문자열(`course.title`) 기준 그룹핑이라 en/ko/zh-CN 모두 별도 분기 없이 동일하게 동작한다. `appendCourseSequenceNumber()`/`getLocalizedCourseTitle()` 자체는 손대지 않았다.

---

## 5. 지도 중심 위치명 표시 수정

### 문제

핫플레이스 preset은 `Eat near Gyeongbokgung`처럼 정상 표시되지만, 지도를 이동해 `Find routes here`로 잡은 위치는 reverse geocode가 성공해도 계속 `Eat near Selected area`로만 보였다.

### 원인 1 — 코스 제목

`courseBuilder.js`의 `buildOneCourse()`가 `getLocalizedCourseTitle(stops, selectedLocation.label, locale)`처럼 `selectedLocation.label`을 그대로 넘기고 있었는데, `label`은 `handleFindHere()`가 최초 1회 `"Selected area"`로 세팅한 뒤 reverse geocode가 끝나도 절대 갱신되지 않는 필드였다(`augmentWithReverseGeocode()`는 `address`/`area`/`placeName`만 갱신).

**수정**: `courseDisplay.js`에 `getLocationDisplayName(selectedLocation, locale)`을 신규 추가 — `source === 'map'`이고 `area`(또는 `address`에서 `extractDistrictKo()`로 안전 추출한 구 단위)가 있으면 `"{구} 일대"`/`"{구} Area"`/`"{구}一带"`를 반환하고, 그 외에는 기존 `selectedLocation.label`을 그대로 반환한다. `courseBuilder.js`는 `getLocalizedCourseTitle(stops, selectedLocation.label, locale)` → `getLocalizedCourseTitle(stops, getLocationDisplayName(selectedLocation, locale), locale)` 한 줄만 바꿨다.

### 원인 2 — `Eat near ...` 헤더

`getLocationDisplayName()`을 코스 제목에 연결한 뒤에도 `NearbySheet.jsx`의 "Eat near ..." 헤더는 여전히 `Selected area`였다 — 이 헤더의 `locationLabel`은 `selectedLocation.label/labelKo/labelZh`를 **직접** 읽는 완전히 별개의 계산식이라, 코스 제목 수정과 무관하게 그대로 남아 있었다.

**수정**: `locationLabel`을 `getLocalizedLocationLabel(getLocationDisplayName(selectedLocation, locale), locale)`로 교체 — 코스 제목이 쓰는 것과 동일한 함수 조합을 재사용했다. `getLocalizedLocationLabel()`이 프리셋(영문 라벨로 매칭 후 재번역)·GPS(`ANCHOR_LABEL_TRANSLATIONS`의 "Current location" 리터럴 인식)·검색(라벨 그대로 통과) 케이스를 기존과 동일하게 처리하므로 회귀가 없다.

### 주소 파싱

`area`가 비어 있을 때만 기존 `seoulDistricts.js`의 `extractDistrictKo(address)`(`구` 접미사 정규식, 기존 재사용)로 폴백 — 새 중국어 행정구역 매핑이나 새 파서는 추가하지 않았다. `translateSeoulDistrict`/`translateSeoulDistrictZh`도 기존 것을 그대로 재사용한다.

---

## 6. NearbySheet 코스 상세 미동기화 버그 수정 (`src/features/explore/components/NearbySheet.jsx`)

### 문제 1 — 필터 적용 후에도 기존 상세가 남음

FilterSheet에서 Reset 후 결과 보기를 눌러도, 이미 열려 있던 코스 상세 화면이 그대로 남아 있었다. 기존에는 `selectedLocation`이 바뀔 때만 상세를 닫는 effect가 있었는데, 필터 변경은 `selectedLocation`을 건드리지 않으므로 이 effect가 전혀 반응하지 않았다.

**수정**: 이 effect를 `[selectedLocation, selectedFoodTypes, minimumRating]`(새로 받은 prop) 전체를 감시하도록 통합하고, `courses` prop 변경까지 함께 살펴 두 가지 경우를 구분했다.

- `selectedLocation`/`selectedFoodTypes`/`minimumRating` 중 하나라도 실제로 바뀜(=위치 변경 또는 Show Results로 필터가 실제 적용된 순간) → 상세를 닫고 목록으로 복귀
- 그중 아무것도 안 바뀌고 `courses`만 바뀜(=locale 전환으로 장소 텍스트만 재생성된 경우) → 아래 문제 2로 이어짐

FilterSheet의 draft 조작(별 드래그 등) 중에는 `filters`가 커밋되지 않으므로 이 effect가 전혀 반응하지 않는다 — Show Results를 눌렀을 때만 반영된다.

### 문제 2 — locale 변경 시 코스 상세가 이전 언어로 남음

`en`에서 코스 상세에 진입한 뒤 `ko`로 바꾸면 지도 라벨은 바뀌지만 상세 내부 가게 목록은 계속 영어로 남아 있었다 — `selectedCourse`가 클릭 시점의 course 객체를 그대로 들고 있고, `courses`/`activeCourse` prop이 새로 계산돼도 다시 연결하지 않았기 때문이다.

**수정**: `isLiveCourseDetail` state를 추가해, 코스 카드를 직접 클릭해 연 상세(`openDetail(course, { live: true })`)만 "실시간 추천 코스"로 표시하고(저장 코스를 불러온 경우는 계속 `false`), 위 통합 effect에서 위치/필터가 그대로인 채 `courses`만 바뀌면 `isLiveCourseDetail`이 true일 때 같은 `id`의 최신 course 객체로 `selectedCourse`를 교체한다. 동일 id가 새 결과에 없으면 새 첫 코스로, 후보 자체가 없으면 목록으로 안전하게 복귀시킨다. 저장 코스(`initialCourse`/`initialPlaceId`)로 연 상세는 `isLiveCourseDetail`이 계속 `false`라 이 재동기화 대상에서 제외된다 — 저장 코스의 id가 과거 저장 시점의 `recommended-N` 문자열과 우연히 겹칠 수 있기 때문에, 별개 흐름으로 안전하게 분리했다.

---

## 7. Modal 드래그 닫힘 점프 버그 수정 (`src/features/explore/components/Modal.jsx`)

### 증상

바텀시트를 드래그해 닫힘 임계값을 넘긴 채 손을 놓으면, 시트가 잠깐 열린 위치로 튀어 올랐다가 다시 아래로 사라졌다.

### 원인

드래그-닫힘 분기(`onTouchEnd`/`handlePointerUpCancel`)가 `onClose()`를 호출하기 **직전**에 `el.style.transform = ''`로 인라인 transform(드래그 offset)을 지우고 있었다. `index.css`의 닫힘 keyframe(`matgil-mdown`)은 `0%`을 명시하지 않아 "애니메이션 시작 직전의 현재 값"을 암묵적 시작점으로 삼는데, 그 값을 미리 지워버리니 시작점이 드래그 위치가 아니라 `translateY(0)`(열린 위치)이 되어 시트가 순간적으로 위로 복귀했다가 다시 keyframe이 아래로 재생됐다.

### 수정

두 핸들러에서 `el.style.transition = ''; el.style.transform = '';` 두 줄을 각각 제거했다. 인라인 transform을 그대로 남겨두면 `.modal-out` 클래스가 붙는 순간 `matgil-mdown`의 암묵적 0%가 드래그된 현재 위치를 그대로 이어받아 자연스럽게 화면 아래로 계속 이동한다. `Modal.jsx`는 `LocationSheet` 등 다른 `draggableClose` 시트도 공유하므로 이 수정 하나로 전부 동일하게 해결됐다. 임계값 미만일 때의 "원위치 복귀" 분기(`transition: 'transform 0.25s ease'` + `translateY(0)`)는 원래도 정상이라 손대지 않았다.

---

## 8. 두 바텀시트 헤더 UI 정렬 (`src/features/explore/components/NearbySheet.jsx`)

FilterSheet(손잡이 `mb-3`=12px + `Filters` 제목 `text-[1.375rem] font-bold tracking-tight`)를 기준으로 NearbySheet 목록 상태 헤더만 맞췄다.

| 항목 | 이전 | 이후 |
|---|---|---|
| 손잡이 → `Eat near ...` 제목 간격 | 8px(손잡이 wrapper `pb-1.5` 6px + 제목 wrapper `pt-0.5` 2px) | **12px**(제목 wrapper `pt-1.5`로 변경, FilterSheet와 동일) |
| 제목 크기 | `text-[1.15rem]` | **`text-[1.375rem]`**(FilterSheet `Filters`와 동일) |
| 제목 → `TODAY'S PICKS` 간격 | 12px(제목 wrapper `pb-2` 8px + 스크롤 컨테이너 `pt-1` 4px) | **18px**(제목 wrapper만 `pb-3.5`로 변경, 이전의 1.5배) |

`TODAY'S PICKS` → 첫 카드 간격(`mb-2`)과 스크롤 컨테이너의 `pt-1`(로딩/빈 결과 상태도 공유)은 그대로 둬서 로딩·빈 결과 문구 위치나 카드 목록 자체는 영향을 받지 않는다. 코스 상세 화면(`TodayCourseDetail`/`PlaceDetailSheet`)은 이 목록-상태 헤더와 무관한 별개 컴포넌트라 변경하지 않았다.

---

## 9. 다국어 (`src/shared/i18n/dictionary.js`)

en/ko/zh-CN 각 `filter: {}` 블록에 추가한 키:

| 키 | en | ko | zh-CN |
|---|---|---|---|
| `filter.rating` | Minimum rating | 최소 별점 | 最低评分 |
| `filter.noMinimumRating` | No minimum rating | 최소 별점 없음 | 不限最低评分 |
| `filter.minimumRatingValue` | `{rating} stars and up` | `별점 {rating}점 이상` | `{rating}分以上` |
| `filter.ratingUnavailable` | Rating information is temporarily unavailable. | 별점 정보를 현재 불러올 수 없습니다. | 暂时无法加载评分信息。 |

지도 중심 위치명("종로구 일대"/"Jongno-gu Area"/"钟路区一带")은 `courseDisplay.js` 내부에 이미 존재하던 `courseTitle.areaSuffix`와 같은 패턴을 인라인 재사용했다(이 모듈은 `t()`/React 컨텍스트가 없어 다른 헬퍼들도 같은 방식으로 하드코딩 폴백을 둔다 — 새 dictionary 키를 추가하지 않았다).

---

## 10. 변경 파일 종합

| 파일 | 주요 변경 |
|---|---|
| `src/features/places/services/placeReviewService.js` | `fetchAllPlaceReviewStats()` 신규(페이지네이션) |
| `src/api/placeApi.js` | `getPlacesWithReviewStats()` 신규, `getPlaces()`는 원본 유지 |
| `src/features/explore/data/exploreOptions.js` | `minimumRating` 필드, `matchesRating()`, `applyFilters()`/`filterCount()` 반영 |
| `src/features/explore/components/FilterSheet.jsx` | RatingFilter(별+슬라이더+클릭+키보드), 섹션 제목/간격, 하단 2버튼, 숫자 배지 제거 |
| `src/index.css` | `.matgil-rating-slider` 전용 트랙/thumb 스타일 |
| `src/pages/HomePage.jsx` | `getPlacesWithReviewStats` 연결, `effectiveFilters`, 관련 prop 전달, 숫자 배지 제거 |
| `src/features/explore/components/SearchOverlay.jsx` | 숫자 배지·죽은 prop 제거 |
| `src/features/explore/data/courseBuilder.js` | 제목 중복 그룹에만 번호 부여, `getLocationDisplayName()` 연결 |
| `src/features/courses/utils/courseDisplay.js` | `getLocationDisplayName()` 신규(주소 폴백 포함) |
| `src/features/explore/components/NearbySheet.jsx` | 필터 적용 시 상세 닫힘, locale 변경 시 실시간 코스 재동기화, `Eat near ...` 위치명 수정, 헤더 간격/제목 크기 |
| `src/features/explore/components/Modal.jsx` | 드래그 닫힘 점프 버그 수정 |
| `src/shared/i18n/dictionary.js` | 평점 관련 4개 키 en/ko/zh-CN 추가 |

---

## 11. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 매 세션 성공. 기존에 알려진 CSS 압축 경고 1건 + 500KB 초과 청크 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 매 세션 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| 미사용 import/state/prop | 매 세션 확인 — `filterCount`(HomePage), `pickTranslated`(NearbySheet) 등 더 이상 안 쓰는 import 제거 확인 |
| 변경 범위 | 매 세션 `git status`로 이번 요청과 무관한 파일이 변경되지 않았는지 재확인 |

## 12. 실제 브라우저 수동 테스트 여부

**부분적으로 수행함.** 사용자가 실제 브라우저에서 확인한 뒤 다음 피드백을 줘서 반영했다: 별/간격 크기 조정(120% 확대), 슬라이더 진행색 대비 복원, thumb 중앙 정렬 어긋남, 버튼 active 색상 톤(초기화 유지/결과 보기 원복), 버튼 눌림 시 크기 변화 제거, 지도 중심 위치명이 여전히 `Selected area`로 보이는 문제. 이 문서 작성 시점 기준으로 아직 사용자 확인을 받지 못한 항목:

- en/ko/zh-CN 전체 화면에서 이번 문서의 모든 변경 사항 최종 육안 확인
- 실제 리뷰 데이터가 쌓인 상태에서의 평점 필터 결과
- 다양한 실제 기기(iOS Safari, Android Chrome)에서의 드래그 닫힘 애니메이션과 슬라이더 터치 조작

## 13. DB·배포·git 작업 여부

- Supabase SQL 실행: 없음
- 스키마 변경(테이블/뷰/트리거): 없음
- Edge Function 배포: 없음
- 원격 배포: 없음
- `git add`/`commit`/`push`: 이 문서 작성 시점까지 어떤 세션에서도 수행하지 않음 — 모든 변경이 워킹 디렉터리에 미커밋 상태로 남아 있다
