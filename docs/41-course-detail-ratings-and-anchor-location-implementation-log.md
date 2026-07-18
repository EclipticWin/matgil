# 41. 동선 상세 별점 표시 + Saved Courses 기준 위치 표시 구현 로그

## 작업 일자

2026-07-18

## 작업 배경

이전 조사(별점 조회 구조, 두 동선 상세 화면의 컴포넌트 구조, `selectedLocation`/`anchor_label` 저장 구조)를 근거로 아래 두 기능을 구현했다.

1. Map 동선 상세(`TodayCourseDetail.jsx`)와 Saved Courses 상세(`SavedCourseDetailPage.jsx`) 각 가게 카드의 3번째 줄에 평균 별점 표시
2. Saved Courses 상세 화면 제목 아래에 저장 당시 기준 위치(주소 또는 의미 있는 라벨) 표시

두 화면은 기존에도 별도 구현이었고, 이번 작업에서도 공통 `StopCard`/`CourseDetail` 컴포넌트로의 리팩터링은 하지 않았다 — 저수준 포맷 유틸(`courseDisplay.js`)만 공유한다(기존과 동일한 방식).

---

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `src/features/courses/utils/courseDisplay.js` | `formatStopRatingLine(stop, stats, noRatingsLabel)` 추가(3번째 줄 "★ 4.6 · 244 m" / "{noRatingsLabel} · 244 m" 생성), `getSavedCourseAnchorDisplay(savedRow)` 추가(기준 위치 표시값 우선순위 처리) |
| `src/features/explore/components/TodayCourseDetail.jsx` | stop id 배열로 `fetchPlaceReviewStatsBatch()` 1회 호출하는 `useEffect` 추가, 3번째 줄을 `formatStopRatingLine()` 결과로 교체(기준 위치 표시는 추가하지 않음) |
| `src/pages/SavedCourseDetailPage.jsx` | 동일한 배치 조회 `useEffect` 추가, 3번째 줄을 `formatStopRatingLine()`으로 교체, 제목(`<h1>`) 아래에 `getSavedCourseAnchorDisplay()` 결과를 보조 텍스트로 표시 |
| `src/features/courses/services/savedCourseService.js` | `saveCourse()`의 `course_snapshot`에 `anchor_address`/`anchor_lat`/`anchor_lng`/`anchor_source`를 `selectedLocation`에서 추출해 추가(신규 저장부터만 적용). 최상위 `anchor_label` 컬럼과 DB 스키마는 변경하지 않음 |
| `src/shared/i18n/dictionary.js` | `courseDetail.noRatings` 신규 키 추가(EN: `No ratings`, KO: `평점 없음`). 기존 `placeDetail.noReviewsYet`("아직 리뷰가 없어요"/"No reviews yet")은 재사용하지 않음(다른 문구, 다른 목적) |

`src/features/places/services/placeReviewService.js`는 **수정하지 않았다** — 기존 `fetchPlaceReviewStatsBatch(placeIds)`가 요구사항을 그대로 충족하므로 중복 구현하지 않았다.

---

## 별점 표시 구현

### 조회

두 화면 모두 동일한 패턴:

```js
const rawStops = /* course.stops 또는 savedCourse의 stops */;
const stopIdsKey = [...new Set(rawStops.map((s) => s.id).filter((id) => id != null))].join(',');

useEffect(() => {
  if (!stopIdsKey) { setReviewStatsById(new Map()); return; }
  let cancelled = false;
  fetchPlaceReviewStatsBatch(stopIdsKey.split(',').map(Number))
    .then((statsMap) => { if (!cancelled) setReviewStatsById(statsMap); })
    .catch(() => { if (!cancelled) setReviewStatsById(new Map()); });
  return () => { cancelled = true; };
}, [stopIdsKey]);
```

- **요청 횟수**: 동선당 1회(`fetchPlaceReviewStatsBatch`), 정류지 수와 무관 — `stops.map(stop => fetchPlaceReviewStats(stop.id))` 패턴을 사용하지 않았다.
- **N+1 방지**: dependency가 `stopIdsKey`(정류지 id를 정렬 없이 dedup한 문자열)라는 원시값이라, `course`/`savedCourse` 객체가 새 참조로 리렌더되어도 실제 id 구성이 같으면 재조회하지 않는다. 정류지 id 배열이나 객체 자체를 의존성에 넣지 않았다.
- **요청 실패 시**: `.catch()`가 빈 `Map`으로 대체하므로 화면 전체가 깨지지 않고, 모든 가게가 "평점 없음"/"No ratings"로 표시된다(§12 요구사항).
- **StrictMode 이중 실행**: 새 전역 캐시나 라이브러리를 추가하지 않았다(요청대로) — 기존 프로젝트의 다른 `useEffect` fetch들과 동일하게 dev에서 StrictMode로 인한 이중 호출 가능성을 그대로 안고 있다(prod 빌드에는 영향 없음, 기존 알려진 패턴).

### 표시 — `formatStopRatingLine()`

```js
function hasUsableRating(stats) {
  return !!stats && Number(stats.rating_count) > 0 && stats.rating_avg != null;
}

export function formatStopRatingLine(stop, stats, noRatingsLabel) {
  const ratingPart = hasUsableRating(stats) ? `★ ${Number(stats.rating_avg).toFixed(1)}` : noRatingsLabel;
  const distance = formatStopDistance(stop);
  return distance ? `${ratingPart} · ${distance}` : ratingPart;
}
```

- 리뷰 0개(=`stats`가 Map에 없음/undefined) → `noRatingsLabel`(`t('courseDetail.noRatings')`) 사용.
- 평균 별점 표시는 `Number(rating_avg).toFixed(1)`로 소수점 한 자리 통일 — 기존 `PlaceDetailSheet.jsx`/`SavedPlaceCard.jsx`의 동일 관행을 그대로 따름(정수처럼 보이는 값도 `5.0`으로 표시).
- 거리(`formatStopDistance`)가 없는 극단적 케이스에도 별점/라벨 부분만 단독으로 표시되도록 방어.

---

## 기준 위치 표시 구현 — `getSavedCourseAnchorDisplay()`

```js
export function getSavedCourseAnchorDisplay(savedRow) {
  const snapshot = savedRow?.course_snapshot ?? {};
  const address = snapshot?.anchor_address;
  if (typeof address === 'string' && address.trim()) return address.trim();
  if (isMeaningfulAnchorLabel(savedRow?.anchor_label)) return savedRow.anchor_label.trim();
  if (isMeaningfulAnchorLabel(snapshot?.anchor_label)) return snapshot.anchor_label.trim();
  return null;
}
```

우선순위(§9 요구사항 그대로): `course_snapshot.anchor_address` → 최상위 `anchor_label` → `course_snapshot.anchor_label` → 표시 안 함.

**의미 없는 라벨 판정**: 새 상수를 만들지 않고, 이미 이 파일에 있던 `ANCHOR_LABEL_KO = { 'Selected area': '선택한 지역', 'Current location': '현재 위치' }`의 키(EN)와 값(KO) 4개 문자열을 그대로 "의미 없는 라벨" 집합으로 재사용했다. `Seoul City Hall`, `Dongdaemun`, `서울시청`, `동대문` 등은 이 집합에 없으므로 그대로 표시된다.

`SavedCourseDetailPage.jsx`에서 제목(`<h1>`) 바로 아래에 별도 라벨 없이 보조 텍스트 한 줄로 추가:

```jsx
{anchorDisplay && (
  <p className="mt-1 truncate text-[0.8125rem] font-medium text-white/75">{anchorDisplay}</p>
)}
```

기존 kicker(`opacity-90`)보다 더 옅은 `text-white/75`, `font-medium`(굵지 않음)으로 과하게 강조되지 않도록 했다. **`TodayCourseDetail.jsx`에는 이 표시를 추가하지 않았다**(§8 요구사항 — Map에서 막 생성된 동선은 사용자가 이미 그 위치에서 보고 있으므로 불필요).

---

## 기준 위치 저장 구조 (`savedCourseService.js`)

```js
const courseSnapshot = {
  ...course,
  anchor_label: selectedLocation?.label ?? '',       // 기존 그대로
  anchor_address: selectedLocation?.address ?? null,  // 신규
  anchor_lat: selectedLocation?.lat ?? null,           // 신규
  anchor_lng: selectedLocation?.lng ?? null,           // 신규
  anchor_source: selectedLocation?.source ?? null,     // 신규
  normalizedMetrics: { ... },
};
```

- DB 컬럼을 추가하지 않았다 — `mg_saved_courses.course_snapshot`(jsonb)에만 새 키를 추가했다. **SQL을 실행하지 않았고 스키마를 변경하지 않았다.**
- 최상위 `anchor_label` 컬럼(insert 대상)은 변경하지 않았다 — 기존과 동일하게 `selectedLocation?.label`만 저장.
- 필드명은 지도 서비스에 종속되지 않는 이름(`anchor_address`/`anchor_lat`/`anchor_lng`/`anchor_source`)을 사용했다 — `kakao_*` 같은 이름을 쓰지 않았다. `selectedLocation`이 이미 `saveCourse()`까지 전달되고 있었으므로 새로운 전달 경로를 만들지 않고, 기존 파라미터에서 필요한 필드만 추출했다.
- `selectedLocation.source`는 실제 값이 `'search'`/`'gps'`/`'map'`(프리셋은 `source` 필드 자체가 없어 `undefined` → `null`)이며, 기존 의미를 그대로 저장했다(새 의미를 부여하지 않음).
- 좌표(`anchor_lat`/`anchor_lng`)는 이번 작업에서 **보존 목적으로만** 저장했다 — 거리 재계산, 지도 중심 자동 이동, 역지오코딩 등 어떤 기능에도 연결하지 않았다(§11 요구사항).

### DB 컬럼을 추가하지 않은 이유

`course_snapshot`이 이미 jsonb이고, 이번에 필요한 값(주소/좌표/출처)은 검색·필터링 대상이 아니라 "이 화면에서만 읽는 보조 표시값"이라 컬럼 분리가 필요하지 않았다. 최상위 `anchor_label`이 컬럼으로 분리되어 있는 것은 코스 제목 재생성(`getLocalizedCourseTitle`)이라는 기존 로직이 그 값에 직접 의존하기 때문으로 보이며, 새 필드들은 그런 의존이 없다.

### 기존 데이터 마이그레이션을 하지 않은 이유

기존 저장 로우의 원본 `selectedLocation`(정확한 주소·좌표)은 저장 시점에 버려졌고 어디에도 남아있지 않다 — `anchor_label` 문자열만으로 주소나 좌표를 역산·추정할 수 없다. 따라서 기존 로우는 새 필드가 애초에 존재할 수 없고, 이는 정상 상태다.

---

## 기존 저장 데이터 호환

`getSavedCourseAnchorDisplay()`는 `snapshot?.anchor_address`, `savedRow?.anchor_label`, `snapshot?.anchor_label` 전부 optional chaining으로 접근하므로 신규 필드가 없는 기존 로우도 오류 없이 3번째(`course_snapshot.anchor_label`) 우선순위 단계까지 안전하게 통과한다.

| 기존 저장 anchor_label | 표시 결과 |
|---|---|
| `Seoul City Hall` | 그대로 표시 |
| `Dongdaemun` | 그대로 표시 |
| `선택한 지역` | 숨김(의미 없는 라벨) |
| `Selected area` | 숨김(의미 없는 라벨) |
| 빈 문자열 `''` | 숨김 |
| `null`/`undefined` | 숨김 |

`formatStopRatingLine()`도 `stats`가 `undefined`(배치 조회 Map에 해당 place_id가 없는 경우 — 기존 데이터든 신규 데이터든 리뷰가 없으면 항상 이 상태)일 때 안전하게 "평점 없음"/"No ratings"로 처리하므로, 리뷰 기능과 무관하게 기존 저장 코스도 동일하게 동작한다.

---

## Map 상세와 Saved Courses 상세의 차이

| | Map(`TodayCourseDetail.jsx`) | Saved Courses(`SavedCourseDetailPage.jsx`) |
|---|---|---|
| 형태 | bottom sheet(라우팅 없음) | 독립 page(`/saved-courses/:id`) |
| 별점 표시 | 추가함 | 추가함 |
| 기준 위치 표시 | **추가하지 않음** | 추가함 |
| 공통 요소 | `formatStopDistance`, `formatStopRatingLine`(신규), `Thumbnail`, 아이콘 | 동일 |

두 파일의 stop 카드 렌더 블록은 여전히 각자 인라인 JSX로 남아 있다(공통 컴포넌트로 합치지 않음) — 요청대로 저수준 포맷 유틸만 공유했다.

---

## DB / SQL / 배포 여부

- Supabase SQL을 실행하지 않았다.
- `mg_saved_courses`에 컬럼을 추가하지 않았다(스키마 변경 없음).
- 기존 데이터를 마이그레이션하거나 갱신하지 않았다.
- Edge Function을 배포하지 않았다(이번 작업은 프론트 코드만 변경).
- Supabase secret을 변경하지 않았다.

---

## 검증

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공. 기존에 알려진 warning 2건(CSS 구문 경고, 500kB chunk 경고)만 존재, 신규 오류/경고 없음 |
| `git diff --check` | 통과(실제 whitespace 오류 없음, CRLF 안내만 표시) |
| 변경 파일 목록 | 5개 파일만 수정(`courseDisplay.js`, `TodayCourseDetail.jsx`, `SavedCourseDetailPage.jsx`, `savedCourseService.js`, `dictionary.js`) — 그 외 unstaged/untracked 변경 없음 |
| 정적 코드 경로 검토 | 두 화면의 `useEffect` 배치 조회, `formatStopRatingLine`/`getSavedCourseAnchorDisplay`의 null-safe 분기를 코드 리딩으로 확인 |

실제 Supabase 데이터(리뷰가 있는 장소, 신규/기존 저장 코스)로 브라우저에서 직접 확인하지는 못했다 — 아래 수동 테스트 항목 참조.

---

## 수동 테스트 항목 (미실행, 사용자 확인 필요)

**Map 동선 상세**
- 리뷰 있는 가게 → `★ 4.6 · 244 m` 표시
- 리뷰 없는 가게 → KO `평점 없음 · 244 m`, EN `No ratings · 244 m`
- 동선당 리뷰 통계 요청이 1회인지 (Network 탭 확인)
- 기준 위치 텍스트가 표시되지 않는지

**Saved Courses 상세**
- 리뷰 있는 가게에 별점 표시
- 리뷰 없는 가게에 No ratings/평점 없음 표시
- 신규 저장 코스에서 주소 표시(검색으로 저장한 경우)
- 주소 없는 신규 저장 코스에서 의미 있는 label 표시(프리셋으로 저장한 경우)
- 기존 `Seoul City Hall`, `Dongdaemun` 라벨이 계속 표시되는지
- 기존 `선택한 지역`, `Selected area` 라벨이 숨겨지는지
- 기존(신규 필드 없는) 저장 코스가 오류 없이 열리는지
- 저장된 거리 값이 기존과 동일하게 표시되는지(재계산되지 않는지)

**저장**
- 검색 결과 위치로 저장 시 `course_snapshot`에 `anchor_address`/`anchor_lat`/`anchor_lng`/`anchor_source`(`'search'`)가 채워지는지
- GPS 위치로 저장 시 `anchor_address`는 `null`, 좌표는 채워지는지, 상세 화면에서 "현재 위치" 라벨이 숨겨지는지
- Find here(지도 중심)로 저장 시 `anchor_address`는 `null` 가능, 좌표는 채워지는지, "선택한 지역" 라벨이 숨겨지는지
- 프리셋 위치로 저장 시 `anchor_address`는 `null`, 좌표는 채워지는지, 의미 있는 라벨(예: `Seoul City Hall`)이 표시되는지

---

## 남은 위험 / 미확인 사항

- 실제 브라우저 동작(리뷰 통계 표시, 기준 위치 표시, Network 탭 요청 수)을 직접 확인하지 못했다 — 위 수동 테스트 목록 참조.
- 프리셋으로 저장된 EN 라벨(예: `Seoul City Hall`)이 KO 화면에서도 번역 없이 그대로 표시된다 — 코스 제목 생성에 쓰이는 `getLocalizedLocationLabel()`과 달리 기준 위치 표시에는 로케일 번역을 적용하지 않았다(범위 밖으로 판단, 필요 시 후속 작업).
- 검색으로 저장된 `selectedLocation.label`이 Kakao 장소명이라 저장 locale과 무관하게 한국어일 수 있다는 기존 특성은 그대로 남아 있다(이번 작업으로 변경되지 않음).
- `mg_place_review_stats` view의 실제 운영 grant/RLS 상태는 이전 조사에서 문서와 코드로만 확인했고 이번에도 SQL로 재확인하지 않았다.
