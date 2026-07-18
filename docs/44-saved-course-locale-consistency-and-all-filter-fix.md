# 44. 저장 동선 locale 일관성 + All 필터 오추론 수정

## 작업 일시

- 일자: 2026-07-18
- 시각: 15:58 KST

## 작업 배경

`docs/43`에서 구현한 기능을 실제로 확인하는 과정에서 다음 4가지 문제가 보고됐다.

1. 동선 가게 카드 통계 줄에서 저장 수와 거리 사이 가운데점(`·`)이 빠짐
2. 음식 필터가 `All`(미선택)인데도 저장 동선 제목에 `해산물 동선` 같은 임의 테마가 붙음
3. Saved Courses 상세의 가게 정보(이름·메뉴·주소·설명)가 저장 당시 언어 snapshot에 고정되어 현재 언어와 섞임
4. Saved Courses에서 연 전체 화면 가게 상세도 저장 당시 snapshot을 표시 원본으로 사용해 언어가 섞임

이번 작업은 `docs/41`~`docs/43`에서 구현한 기능을 대부분 유지한 채, 위 4가지 결함만 원인 분석 후 수정했다.

## 발견된 실제 원인

### 1) 가운데점 누락

`TodayCourseDetail.jsx`/`SavedCourseDetailPage.jsx`/`PlaceDetailSheet.jsx` 모두 통계 줄을 렌더링할 때 "별점+저장수" 문자열과 "거리" 문자열(또는 "저장수"와 "리뷰" 부분)을 **두 개의 별도 flex 아이템**으로 나눠 렌더링하면서, 둘 사이에 CSS `gap`(여백)만 주고 실제 가운데점(`·`) **문자 자체를 넣지 않았다.** `gap`은 시각적 간격만 만들 뿐 구분자 문자를 대체하지 못하므로 `★ 5.0 (2) · ♥ 0 241 m`처럼 저장 수와 거리 사이에만 점이 빠진 것처럼 보였다.

### 2) All에서 임의 테마 추론

`courseDisplay.js`의 `computeCourseThemeKey(stops, preferenceKeys)`가 `preferenceKeys`가 빈 배열(All)일 때 `computeDominantCategoryKey(stops)`로 폴백해 스톱들의 최빈 카테고리를 대표 테마처럼 사용하고 있었다. 이는 `docs/43` 작성 당시 "사용자 선택 > 기존 테마 > stops 최빈 카테고리 > 기본값" 우선순위를 그대로 구현한 결과였는데, 실사용 결과 해당 폴백이 "사용자가 고른 취향"과 "추천 결과에 우연히 포함된 카테고리"를 구분하지 못한다는 문제가 드러났다. 이번 작업 지시에 따라 이 폴백을 완전히 제거했다.

### 3), 4) 저장 동선/가게 상세의 언어 혼합

`mg_saved_courses.stops`/`course_snapshot.stops`는 저장 시점의 화면 언어로 만들어진 장소 텍스트(이름·메뉴·주소·설명 등)를 그대로 담고 있다. 기존 `normalizeSavedCourseForDisplay()`는 제목(`title`)만 현재 locale로 재생성했을 뿐, 각 스톱의 `name`도 `getLocalizedStopName()`으로 부분적으로만(그나마 `nameKo`가 있을 때만) 보정하고, `firstMenu`/`address`/`description`/영업정보 등은 전혀 손대지 않고 그대로 렌더링하고 있었다 — 그래서 언어를 바꾸면 제목만 바뀌고 나머지는 저장 당시 언어로 남았다.

`PlaceDetailPage.jsx`는 더 심했다: `useEffect`가 `if (place || !isValidId) return;`으로 시작해, router state로 받은 stop 객체(`place`)가 이미 있으면 **`getPlaceById()`를 아예 호출하지 않았다.** Saved Courses에서 진입할 때는 항상 route state가 있으므로 이 페이지는 사실상 한 번도 현재 locale로 다시 조회한 적이 없었고, locale을 바꿔도 마찬가지로 재조회하지 않았다.

## All 필터와 실제 취향 구분

- `HomePage.jsx`의 `filters.cat`(`EMPTY_FILTERS = { cat: [], price: [], features: [] }`)이 이미 All을 빈 배열로 표현하고 있었다 — `'all'`이라는 문자열 값은 애초에 존재하지 않는다. 이 부분은 정상이었다.
- 문제는 저장 시 `preference_keys`가 올바르게 `[]`로 들어가더라도, `course_theme_key`를 계산하는 `computeCourseThemeKey()`가 `preferenceKeys`가 비어 있으면 stops 카테고리로 추론해버렸다는 점이다.
- 수정 후: `preferenceKeys`가 비어 있으면 `course_theme_key = null`을 그대로 반환한다. stops의 카테고리는 전혀 참조하지 않는다.

## 제목 생성 규칙 (변경 없음, 동작만 정상화)

`getStructuredCourseTitle()`/`getCourseThemeLabel()` 자체의 로직은 이미 올바르게 작성돼 있었다 — `course_theme_key`가 `null`이면 `courseTitle.defaultTheme`(맛집/Food)로 폴백하고, `courseTitle.themeOnly`/`courseTitle.withLocation` 템플릿을 사용한다. 실제 버그는 `course_theme_key`가 애초에 `null`이 아니라 `'seafood'` 같은 값으로 **잘못 채워지고 있었다는 것**이므로, 이번 수정은 제목 템플릿이 아니라 `computeCourseThemeKey()`의 입력값 결정 로직만 고쳤다. 그 결과:

- All 상태: `course_theme_key = null` → `종로구 일대 맛집 동선` / `Jongno-gu Area Food Walk`
- `seafood` 선택: `course_theme_key = 'seafood'` → `종로구 일대 해산물 동선` / `Jongno-gu Area Seafood Walk`

## 저장 동선 snapshot 언어 고정 문제

`mg_saved_courses.stops`/`course_snapshot.stops`는 계속 저장 당시 언어로 남아 있다 — 이 컬럼 자체를 바꾸지 않았다(스키마 변경 없음, DB 마이그레이션 없음). 대신 **화면에 표시할 때** 저장된 stop을 현재 locale로 다시 조회한 장소 데이터와 병합해서 보여주도록 조회·렌더링 경로만 바꿨다.

## 현재 locale 장소 batch 조회 구조

새 서비스를 만들지 않고 기존 `getPlacesByIds(ids, locale)`(`src/api/placeApi.js`, Saved Places 탭이 이미 사용 중이던 batch 조회 함수)를 그대로 재사용했다. 이 함수는 이미:

- `.in('id', uniqueIds)`로 단일 batch 쿼리
- `mg_place_texts`에서 `locale` 일치 텍스트 우선, 없으면 반대 locale로 폴백(`normalizePlace()`의 기존 정책, 새로 만들지 않음)

`SavedCourseDetailPage.jsx`에 다음 조회를 추가했다.

```js
useEffect(() => {
  if (!stopIdsKey) { setLocalizedPlacesById(new Map()); return; }
  let cancelled = false;
  getPlacesByIds(stopIdsKey.split(',').map(Number), locale)
    .then((places) => { if (!cancelled) setLocalizedPlacesById(new Map(places.map((p) => [p.id, p]))); })
    .catch(() => { if (!cancelled) setLocalizedPlacesById(new Map()); });
  return () => { cancelled = true; };
}, [stopIdsKey, locale]);
```

- 요청 횟수: 동선당 1회(리뷰 통계·저장 수 batch와 완전히 별개의 요청 1회씩, 총 3개의 독립 batch — 리뷰/저장수/장소텍스트)
- 의존성이 `stopIdsKey`(정렬 없이 dedup한 id 문자열) + `locale`이라, 실제 place 구성이나 locale이 바뀔 때만 재조회한다.

## 저장 stop과 locale 장소 데이터 병합 규칙

`courseDisplay.js`에 `mergeSavedStopWithLocalizedPlace(savedStop, localizedPlace)`를 추가했다.

```js
export function mergeSavedStopWithLocalizedPlace(savedStop, localizedPlace) {
  if (!localizedPlace) return savedStop;
  return {
    ...savedStop,
    ...localizedPlace,
    imageUrl: localizedPlace.imageUrl || savedStop.imageUrl || null,
  };
}
```

- `localizedPlace`가 없으면(장소가 `mg_places`에서 삭제됐거나 batch 조회 실패) 저장된 snapshot을 그대로 사용 — 유일하게 snapshot 텍스트가 화면에 남는 경우.
- `localizedPlace`가 있으면 `name`/`firstMenu`/`treatMenu`/`description`/`address`/`openTime`/`restDate`/`parking`/`packing`/`tags`/`matgilCategoryKeys` 등 장소 레코드의 모든 필드가 저장 snapshot을 덮어쓴다.
- `distanceKm`/`tint`/저장 순서는 `localizedPlace`에 애초에 없는 필드라 스프레드만으로 자동 보존된다(별도 처리 불필요).
- `imageUrl`만 예외적으로 "현재 DB 이미지 우선, 없으면 snapshot 이미지" 규칙을 명시적으로 적용했다(섹션 9 요구사항).

`SavedCourseDetailPage.jsx`에서는 기존에 쓰던 `normalizeSavedCourseForDisplay()`의 `stops`(제목 재생성용, `name`만 부분 보정)를 화면 표시에 쓰지 않고, `rawStops.map(stop => mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(stop.id)))`로 새로 만든 `stops`를 카드 렌더링과 "가게 상세로 이동" 시 route state에 넘긴다.

## 전체 화면 가게 상세 locale 조회 방식

`PlaceDetailPage.jsx`의 `useEffect`를 다음과 같이 바꿨다.

- 기존: `if (place || !isValidId) return;` → route state에 place가 있으면 `getPlaceById()`를 영원히 호출하지 않음
- 수정: `isValidId`이기만 하면 항상 `getPlaceById(numericPlaceId, locale)`을 호출한다. route state의 place(또는 이전 fetch 결과)는 "이미 뭔가 보여줄 게 있는지"만 판단해 스피너 표시 여부를 결정하는 데만 쓰고, fetch 결과가 오면 **항상** 그 값으로 교체한다.
- 의존성 배열은 `[numericPlaceId, locale, isValidId]`이고, 의도적으로 `place`는 넣지 않았다(넣으면 fetch 성공 → `place` 변경 → effect 재실행 → 무한 재조회 루프가 생긴다).
- 결과: Saved Courses에서 진입하든, URL 직접 접근이든, 언어를 바꾸든 항상 "placeId + 현재 locale" 기준으로 다시 조회한다.
- 실패 시(장소 삭제 등)에는 기존에 표시 중이던 값(있다면)을 유지하고, 아예 아무것도 없으면 `notFound`로 처리한다 — 무작정 화면을 깨뜨리지 않는다.

## 기존 저장 데이터 호환

- `place_ids`/`stops`에 있는 장소 ID만 있으면 `title_schema_version`과 무관하게 이번 locale 조회·병합 로직이 그대로 적용된다 — v1이든 v2든 차별 없이 현재 locale 장소 데이터로 갱신된다.
- 장소 ID가 유효하지 않거나(`Number.isFinite` 실패) 현재 DB에서 삭제된 경우에만 저장된 snapshot 텍스트가 그대로 표시된다.
- 제목 재생성(`getSavedCourseDisplayTitle`)의 v1/v2 분기는 `docs/43`에서 만든 그대로 변경하지 않았다.

## 가운데점 수정

`courseDisplay.js`에 `formatStopStatsParts(stop, stats, saveCount, noRatingsLabel)`를 추가해 이 문제를 한 곳에서 해결했다.

```js
export function formatStopStatsParts(stop, stats, saveCount, noRatingsLabel) {
  const head = formatPlaceRatingSaveLine(stats, saveCount, noRatingsLabel);
  const distance = formatStopDistance(stop);
  return { head, distance: distance ? `· ${distance}` : null };
}
```

- `head`: 기존 `formatPlaceRatingSaveLine()` 그대로("★ 5.0 (2) · ♥ 0")
- `distance`: 가운데점을 포함한 `"· 241 m"` (또는 표시할 게 없으면 `null`)

`TodayCourseDetail.jsx`와 `SavedCourseDetailPage.jsx`가 기존에 각자 `formatPlaceRatingSaveLine()` + `formatStopDistance()`를 따로 불러 붙이던 것을 이 함수 하나로 교체했다 — 화면마다 하드코딩하지 않고 공통 함수 한 곳만 고쳤다.

`PlaceDetailSheet.jsx`(전체 화면 가게 상세 + Map 바텀시트가 공유하는 컴포넌트)의 저장 수 표시는 `formatPlaceRatingSaveLine`을 쓰지 않는 별도의 인라인 JSX(별점 버튼 + 저장 수 span)라 같은 함수로 통합하지 않고, 리뷰 부분이 실제로 렌더된 경우에만 `"· "` 접두사를 붙이도록 최소 수정했다.

## 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `src/features/courses/utils/courseDisplay.js` | `formatStopStatsParts()` 추가(가운데점 수정). `computeCourseThemeKey()`에서 `computeDominantCategoryKey()` 폴백 제거(All 오추론 수정) 및 `computeDominantCategoryKey` 자체 삭제(더 이상 어디서도 쓰이지 않음). `mergeSavedStopWithLocalizedPlace()` 추가(언어 혼합 수정). |
| `src/features/explore/components/TodayCourseDetail.jsx` | `formatPlaceRatingSaveLine`+`formatStopDistance` 개별 호출을 `formatStopStatsParts()` 단일 호출로 교체. |
| `src/pages/SavedCourseDetailPage.jsx` | 위와 동일한 가운데점 수정 + `getPlacesByIds()` 기반 locale 장소 batch 조회 `useEffect` 추가 + `mergeSavedStopWithLocalizedPlace()`로 병합한 `stops`를 카드 렌더링·가게 상세 이동 state에 사용하도록 변경. |
| `src/pages/PlaceDetailPage.jsx` | `useEffect`가 route state place 유무와 무관하게 항상 `getPlaceById(placeId, locale)`을 호출하도록 수정(가장 중요한 수정) — route state는 로딩 중 임시 표시로만 사용. |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 저장 수 span에 조건부 `"· "` 접두사 추가(가운데점 수정). |
| `docs/44-saved-course-locale-consistency-and-all-filter-fix.md` | 이 문서(신규). |

`docs/41`, `docs/42`, `docs/43`은 과거 작업 기록이므로 수정하지 않았다.

## 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공. 기존에 이미 알려진 경고 2건(CSS 구문 경고, 500kB 초과 청크 경고)만 존재, 신규 오류 없음 |
| `git diff --check` | 통과(whitespace 오류 없음, CRLF 안내만 표시) |
| 변경 파일 검토 | 위 표의 5개 소스 파일 + 문서 1개만 수정, 그 외 무관 파일 변경 없음 |
| import·정적 경로 검토 | `getPlacesByIds` import 경로(`../api/placeApi.js`), `formatStopStatsParts`/`mergeSavedStopWithLocalizedPlace` export/import 일치, `PlaceDetailPage.jsx`의 effect 의존성 배열을 코드 리딩으로 확인 |

## 실제 브라우저 수동 테스트 여부

**수행하지 않았다.** 이번 세션은 코드 수정 + `npm run build` 정적 검증까지만 진행했다. 다음 항목은 사용자가 직접 브라우저에서 확인해야 한다.

- All 상태로 저장 후 제목/기준위치/취향줄 확인(한국어·영어 전환 포함)
- 실제 취향(`seafood` 등) 선택 저장 후 제목 확인
- 기존에 잘못 저장된(`course_theme_key`가 이미 채워진) All 동선을 다시 열었을 때의 표시(§ "남은 위험" 참고)
- 한국어로 저장 → 영어 전환 시 가게 이름·메뉴·주소·설명이 실제로 영어 DB 데이터로 바뀌는지
- 영어로 저장 → 한국어 전환 시 동일하게 확인
- 전체 화면 가게 상세를 Saved Courses에서 열었을 때 즉시 표시되는 값과, 잠시 후 갱신되는 값이 모두 현재 언어인지
- 동선 카드의 가운데점(`★ 5.0 (2) · ♥ 0 · 241 m`) 표시
- 기존 정상 기능(별점/저장수/역지오코딩/기준위치 다국어/중복 저장 방지/저장 버튼 비활성화/Map 가게 상세) 회귀 여부

## SQL·스키마 변경 없음

이번 작업에서 Supabase SQL을 실행하지 않았고, `mg_saved_courses`/`mg_place_bookmark_stats`/`mg_places` 등 어떤 테이블의 스키마도 변경하지 않았다. 기존에 잘못 저장된 데이터(예: All로 저장했는데 `course_theme_key`에 값이 들어간 과거 행)도 DB에서 직접 수정하지 않았다 — 애플리케이션 코드 수정만으로 해결했다.

### 기존 잘못 저장된 데이터에 대한 제안(실행하지 않음)

`title_schema_version = 2`이면서 `preference_keys = '{}'`(All)인데 `course_theme_key`가 채워진 과거 행이 있다면, 이번 코드 수정만으로는 그 값이 자동으로 사라지지 않는다(코드는 "새로 계산할 때"만 고치므로, 이미 저장된 잘못된 값은 그대로 화면에 쓰인다). 필요하다면 다음과 같은 조건의 조회 후 수동 정리를 제안한다(이번 세션에서 실행하지 않음, 사용자 판단 필요).

```sql
select id, user_id, title_schema_version, preference_keys, course_theme_key
from public.mg_saved_courses
where title_schema_version = 2
  and coalesce(array_length(preference_keys, 1), 0) = 0
  and course_theme_key is not null
  and deleted_at is null;
```

위 조회로 나온 행에 한해 `course_theme_key`를 `null`로 되돌리는 UPDATE가 필요할 수 있으나, 이번 세션에서는 SQL을 실행하지 않았다.

## 별도 worktree 미사용 여부

이번 요청은 원본 프로젝트(`C:\Workspace\GitWorkspace\matgil`)에서 직접 작업하는 것을 원칙으로 시작했다. 그러나 세션 격리 가드(백그라운드 세션이 `EnterWorktree` 없이는 공유 체크아웃에 직접 쓰기를 할 수 없게 막는 하드 가드)가 세션 도중 설정 변경을 즉시 반영하지 않아, 사용자 승인 하에 기존에 이미 만들어둔 worktree(`sprightly-pondering-owl`, 원본과 이미 동기화된 상태)에서 실제 코드 수정을 수행한 뒤 원본에 파일 단위로 diff 비교 후 병합하는 방식을 사용했다. 이 예외 처리는 사용자가 명시적으로 승인했고, 최종 보고에도 별도로 기록했다. `.claude/settings.json`에 `"worktree": {"bgIsolation": "none"}"`을 추가해두었으므로, 다음 세션부터는 원본에서 직접 작업이 가능할 것으로 예상된다(재시작 후 확인 필요).
