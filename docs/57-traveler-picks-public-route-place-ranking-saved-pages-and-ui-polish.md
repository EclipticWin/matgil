# 57. 여행자픽 공개 동선·가게 랭킹 개편, 저장 목록 마이페이지 이동, 순위·다국어·필터 UX 정리

## 1. 작업 일시

- 작성일시: 2026-07-26 19:26 KST

---

## 2. 작업 배경

`docs/56-live-course-title-locale-fix-course-card-alignment-and-saved-routes-locale-consistency.md`는 커밋 `2dffa27`(라이브 동선 제목 로케일 처리 개편 및 Saved Routes UI/다국어 일관성 확보)로 커밋되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 대규모 기능 개편을 다룬다. `2dffa27` 이후 이 문서 작성 시점까지 어떤 `git add`/`commit`/`push`도 수행되지 않아, 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있다.

기존 하단 내비게이션의 두 번째 탭(`동선`)은 `CoursesPage.jsx` 한 파일 안에서 다음 두 가지를 함께 보여주고 있었다.

- `SavedRoutesTab`: 로그인한 사용자 본인이 저장한 동선
- `SavedPlacesTab`: 로그인한 사용자 본인이 저장한 가게

이 구조에는 세 가지 설계 문제가 있었다.

1. **개인 저장 기능과 공개 탐색 기능이 분리되지 않음** — "동선"이라는 탭 이름은 본인이 저장한 목록을 뜻하는데, 실제로는 가게 저장까지 같은 화면에 있어 이름과 실제 내용이 어긋났다.
2. **다른 사용자의 저장 데이터를 볼 수 있는 통로가 전혀 없었음** — 다른 여행자가 어떤 동선/가게를 많이 저장했는지 보여주는 공개 인기 피드가 앱에 존재하지 않았다.
3. **지도 탭의 앱 추천 동선과 사용자 저장 기반 동선이 구분되지 않음** — Map 탭의 라이브 추천(`courseBuilder.js` 알고리즘 결과)과, 사람들이 실제로 저장한 결과를 다시 보여주는 기능은 성격이 다른데 이를 나눌 화면이 없었다.

이번 세션은 이 문제를 다음 순서로 해결했다 (상세 시간순은 §16 참고).

1. 기존 `동선` 탭을 "다른 여행자가 저장한 동선/가게를 인기순·최신순으로 보여주는 공개 탐색 화면"으로 재정의하고, 개인 저장 목록은 마이페이지 하위로 이동
2. 공개 탐색에 필요한 Supabase RPC 4종을 수동으로 SQL Editor에 생성(§4)
3. 공개 동선/가게 프론트 구현, 순위·메달·다국어 카드 UI를 여러 차례에 걸쳐 다듬음(§8~§9)
4. 라우팅·하단 메뉴 명칭을 `/explore`·`여행자픽`/`Picks`/`旅行者精选`으로 정리(§11)
5. 지도 필터의 음식 종류 최대 3개 선택 안내를 인라인 토스트에서 중앙 모달로 교체(§14)

이 저장소에는 Git worktree가 둘 이상 존재한다(`C:/Workspace/GitWorkspace/matgil`(main), `.claude/worktrees/sprightly-pondering-owl`). 이번 세션의 모든 작업 전에 `git rev-parse --show-toplevel`/`git branch --show-current`/`git worktree list`/`git status --short`로 실제 실행 워크트리(main)를 재확인했고, `.claude/worktrees` 하위 파일은 이번 세션 전체에서 읽기 비교 외에는 전혀 수정하지 않았다.

이번 세션 중에도 이 작업들과 **무관하게** 워킹 디렉터리에 이미 존재하던 일본어("준비 중") 안내 관련 미커밋 변경(`LanguageModal.jsx`, `exploreOptions.js`, `JapaneseComingSoonModal.jsx`, `HomePage.jsx`/`MyPage.jsx`의 관련 일부)이 계속 함께 있었다. docs/56에서 이미 이 변경을 별도로 분리해 기록했고, 이번 세션에서도 이 부분은 전혀 건드리지 않았다.

---

## 3. 사전 조사와 설계 결정

작업을 시작하기 전에 다음을 먼저 확인했다.

- 기존 `route_signature`(`buildRouteSignature()` — 장소 id를 정렬한 뒤 `-`로 join)는 **순서를 무시**하는 동일성 판정이라, `A→B→C`와 `C→B→A`를 같은 동선으로 취급하고 있었다. 이는 "기준 위치만 다르고 장소 순서가 같은 동선"과 "순서 자체가 다른 동선"을 구분하지 못하는 근본적인 한계였다.
- 공개 탐색 화면은 **다른 사용자의 `user_id`/저장 row id를 절대 노출하지 않아야** 하므로, 프론트에서 `mg_saved_courses`/`mg_place_bookmarks`를 직접 `select`하는 방식은 애초에 불가능했고, 집계·익명화를 DB 쪽 RPC로 위임하는 결정을 내렸다.
- 실제 동선 도메인(`CourseCard.jsx`, `CourseDetailPage.jsx`, `SavedCourseDetailPage.jsx`, `courseDisplay.js`, `savedCourseService.js`, `route_signature`, `course_snapshot`, `titleTheme`)의 명칭과 로직은 이번 개편과 별개로 계속 유지하기로 했다 — "공개 탐색 탭"이라는 화면의 이름만 바꾸는 것이지, 앱 전체의 "동선(course)"이라는 개념 자체를 없애거나 이름을 바꾸는 작업이 아니기 때문이다.
- 음식 취향 필터(`preference_keys`, `course_theme_key`)를 기준으로 공개 피드를 필터링하는 기능은 이번 범위에서 제외했다 — 같은 장소 순서의 동선이 서로 다른 취향으로 여러 번 저장될 수 있어, "몇 명이 저장했는가"라는 집계의 의미가 취향별로 쪼개지면 충돌할 수 있다고 판단해 보류했다(§23 후속 과제에 재기재).
- 기존 파일 구조를 최대한 재사용하는 방향으로 설계했다: 새 "공개 카드" 컴포넌트(`PublicCourseCard`/`PublicPlaceCard`)를 별도로 만들되, 장소 경로 그리드(`CourseStopPath`)처럼 진짜 공통인 부분만 추출해 기존 `CourseCard.jsx`가 다시 갈라지지 않게 했다.

---

## 4. 공개 동선·가게 데이터 모델과 Supabase RPC (DB, 수동 적용)

> 이 섹션의 DB 변경은 **이번 세션 중 Supabase SQL Editor에 수동으로 적용**되었다. `git diff`에는 나타나지 않으며(마이그레이션 파일이 이 저장소에 없음), 아래 내용은 이번 대화의 확정된 작업 맥락과 현재 애플리케이션 코드(특히 `savedCourseService.js`의 갱신된 주석, `publicFeedService.js`의 실제 RPC 호출)로 교차 확인한 결과다.

### 4.1 기존 구조 — `route_signature`(순서 무시)

- 기존 유니크 인덱스 `uq_mg_saved_courses_user_route_signature_active`(docs/42)는 `route_signature` 컬럼(정렬된 place id를 `-`로 join, 예: `92-477-980`) 기준으로, 사용자별 활성(soft-delete 안 된) 행에 대해 **장소 집합이 같으면** 순서와 무관하게 중복으로 간주했다.
- `savedCourseService.js`의 `buildRouteSignature(placeIds)`는 이번 세션에서도 계속 호출되고 INSERT에 `route_signature` 컬럼 값으로 그대로 저장되지만(라인 132), 같은 파일의 `checkCourseAlreadySaved()`/`isSameCourse()` 주석은 다음과 같이 명시한다.

  > "Duplicate rule now matches the DB's ordered_route_key trigger (not the older, order-independent route_signature UNIQUE index ... which is still written below for its own existing purpose but no longer used for this check)"

  즉 `route_signature` 컬럼 자체와 그 값 생성 로직은 남아 있지만(레거시 용도로만 유지), **중복 판정의 실제 기준은 이번 세션에서 order-sensitive 정책으로 전환**되었다.

### 4.2 `ordered_route_key` — 순서 기반 동일성 정책으로 전환

확정된 최종 정책은 다음과 같다.

- 장소 **순서가 같아야** 같은 동선으로 판단한다.
- 기준 위치(anchor)는 동일성 판정에서 완전히 제외한다.
- `A→B→C`와 `C→B→A`는 **다른 동선**이다.
- 기준 위치만 다른 두 `A→B→C`는 **같은 동선**이다.

이를 위해 `mg_saved_courses`에 다음이 수동으로 적용되었다(대화 맥락 기준, DB 콘솔 확인 완료).

- `ordered_route_key` 컬럼 추가 — `place_ids` 배열의 **순서를 그대로 보존**한 `10-20-30` 형태 문자열(정렬하지 않음, `route_signature`의 정렬 로직과 다름).
- INSERT/UPDATE 시 `ordered_route_key`를 자동 생성하는 **trigger** 추가 — 애플리케이션 코드(`savedCourseService.js`의 `saveCourse()`)는 이 컬럼을 직접 채우지 않는다. 실제로 INSERT 객체(`saveCourse()` 내부)에는 `ordered_route_key` 필드가 없고, `route_signature`만 JS에서 계산해 넣는다 — 이는 이 컬럼이 DB trigger로만 채워진다는 설계와 일치한다.
- 기존 순서 무시 유니크 인덱스(`uq_mg_saved_courses_user_route_signature_active`) 제거.
- 사용자별 `ordered_route_key` 활성 행 기준 새 유니크 인덱스 추가 — `saveCourse()`의 `DuplicateCourseError`가 여전히 `POSTGRES_UNIQUE_VIOLATION`(`23505`) 코드로 감지되므로, 이 새 인덱스가 실제로 존재해야 기존 "이미 저장된 동선입니다" 에러 처리 흐름이 계속 동작한다.
- 공개 피드 집계(§4.3)가 `ordered_route_key` 기준으로 그룹핑할 수 있도록 별도 인덱스 추가.

애플리케이션(JS) 쪽도 이 정책에 맞춰 정리되었다.

- `checkCourseAlreadySaved({ userId, course })`: `.contains('place_ids', placeIds)`로 후보 행을 순서 무관하게 먼저 좁힌 뒤(Postgres 배열 `@>` 연산이라 순서와 무관), **JS에서 인덱스별로 정확히 같은 순서인지**(`placeIds.every((id, index) => id === savedIds[index])`)를 비교해 최종 판정한다. 저장 전 "이미 저장됨" 안내에 사용된다.
- `isSameCourse(course, savedRow)`: 목록의 "Saved" 배지에 쓰이는 같은 order-sensitive 비교. place id 배열 길이가 다르거나 없으면 제목+스톱 수 폴백을 사용한다.
- `NearbySheet.jsx`의 `handleSave()` 주석은 아직 "DB's active-route UNIQUE index (user_id, route_signature)"라고 옛 설명을 그대로 남기고 있다 — **실제 유니크 위반의 기준 컬럼은 `ordered_route_key`로 바뀌었지만, 이 주석 문구 자체는 갱신되지 않은 상태**임을 이번 조사에서 확인했다(§23 후속 과제에 기재, 동작에는 영향 없음 — `DuplicateCourseError` 캐치 로직 자체는 컬럼명에 의존하지 않는다).

### 4.3 공개 동선 feed — `get_public_course_feed(p_sort, p_limit, p_offset)`

`src/features/courses/services/publicFeedService.js`의 `fetchPublicCourseFeed({ sort, limit, offset })`이 `supabase.rpc('get_public_course_feed', { p_sort, p_limit, p_offset })`를 호출한다. 대화 맥락과 반환 데이터 사용처(§8)를 근거로 확인되는 이 RPC의 역할은 다음과 같다.

- 다른 사용자의 저장 동선을 **익명화**하여 공개 — `user_id` 미노출, 저장 row(`mg_saved_courses.id`) 미노출.
- `ordered_route_key` 기준으로 같은 순서의 동선을 하나의 "대표 동선"으로 집계.
- `save_count`: 그 `ordered_route_key`를 저장한 **서로 다른 사용자 수** 기준.
- `latest_saved_at`: 가장 최근 저장 시각.
- 대표 동선의 `course_snapshot`(제목/스톱/앵커 등 원본 스냅샷 구조 그대로).
- 호출한 현재 사용자 본인의 저장 여부(`is_saved`)와, 있다면 본인 저장 row id(`my_saved_course_id`) — `togglePublicCourseSave()`가 이 id로 즉시 토글할 수 있게 하기 위함.
- 비활성/soft-delete된 장소가 포함된 동선은 집계에서 제외.
- `p_sort`: `'popular'`(save_count 내림차순) / `'latest'`(최근 저장순).
- 비로그인 요청은 최대 5개(`GUEST_LIMIT`), 로그인 요청은 단일 호출 최대 50개로 서버 측에서도 제한 — 프론트의 `LOGGED_IN_PAGE_SIZE = 10`이 항상 이 상한 아래이므로 위반하지 않는다(§7).
- 매 행에 `total_count`(전체 개수, 같은 값 반복)를 함께 반환해, 프론트가 별도 count 쿼리 없이 `hasMore`를 계산할 수 있게 한다(`PublicRoutesTab.jsx`의 `data[0]?.total_count`).

`row.public_route_key`가 각 대표 동선의 안정적 식별자로 쓰이며(`PublicRoutesTab.jsx`의 `dedupeRows()`가 이 키로 페이지 간 중복을 제거), 하트 토글(§4.5)도 이 키를 인자로 받는다.

### 4.4 공개 가게 feed — `get_public_place_feed(p_sort, p_limit, p_offset)`

`fetchPublicPlaceFeed({ sort, limit, offset })`이 `get_public_place_feed` RPC를 호출한다. 확인된 역할:

- `mg_place_bookmarks` 기준 장소별 저장 수(`save_count`) 집계, 비활성 장소 제외.
- `latest_saved_at`, 현재 사용자의 저장 여부(`is_saved`) 반환.
- `place_id`만 반환 — 실제 장소 텍스트(이름/주소/메뉴)는 이 RPC가 아니라 프론트가 별도로 `getPlacesByIds()`(§6.5)로 현재 locale 기준 조회한다. 즉 이 RPC는 순수하게 "어떤 place_id가 몇 명에게 저장됐는가"만 책임진다.
- 비로그인 최대 5개, 로그인 단일 요청 최대 50개 — 동선 feed와 동일한 제한 정책.

### 4.5 저장 토글 — `toggle_public_course_save(p_public_route_key)`

`togglePublicCourseSave({ publicRouteKey })`가 `toggle_public_course_save` RPC를 호출한다.

- 공개 동선 카드의 하트를 처음 누르면, 그 `public_route_key`가 가리키는 대표 동선을 **현재 로그인 사용자 본인의 개인 저장 동선으로 복사**해서 저장한다. 즉 "좋아요"가 곧 "내 저장 목록에 추가"라는 하나의 동작이다.
- 이미 저장되어 있으면 soft delete(저장 취소).
- 반환값에 갱신된 `save_count`, `is_saved`, `my_saved_course_id`가 포함되어 있어야 하며 — `PublicRoutesTab.jsx`의 `handleToggleHeart()`가 이 값들로 낙관적 업데이트를 서버 확정 값으로 재동기화한다(실패 시 낙관적 변경을 원래 값으로 롤백).
- 인증된 사용자만 호출 가능 — 비로그인 사용자가 하트를 누르면 프론트에서 RPC를 호출하지 않고 `useAuthPrompt`로 로그인 안내를 먼저 띄운다(§6.4).

### 4.6 마이페이지 카운트 — `get_my_saved_counts()`

`fetchMySavedCounts()`가 인자 없이 `get_my_saved_counts` RPC를 호출한다.

- 로그인 사용자 **본인**의 활성(soft-delete 안 된) 저장 동선 수(`saved_course_count`), 저장 가게 수(`saved_place_count`)를 반환.
- `MyPage.jsx`의 저장 동선/저장 가게 StatCard 숫자에 그대로 쓰인다(§12.2).
- 다른 RPC와 달리 완전히 개인화된 조회이므로 `p_*` 인자가 없다.

### 4.7 보안 및 개인정보

- 공개 feed RPC(`get_public_course_feed`/`get_public_place_feed`)는 **SECURITY DEFINER**로 생성되어야 다른 사용자의 저장 데이터를 집계할 수 있다 — 이는 대화 맥락으로 확정된 사실이며, 실제 SQL 정의를 이 문서에 그대로 옮기지 않는다(§9 요구사항에 따름).
- 두 RPC 모두 결과에 `user_id`, 닉네임, 저장 row id(현재 사용자 자신의 것 제외)를 포함하지 않는다 — 프론트 코드(`PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`) 어디에도 다른 사용자를 식별할 수 있는 필드를 렌더링하는 부분이 없음을 확인했다.
- 프론트는 이번 개편 전체에서 `mg_saved_courses`/`mg_place_bookmarks` 테이블을 **다른 사용자 대상으로 직접 select**하지 않는다 — 공개 데이터는 오직 RPC를 통해서만 얻는다. 본인 데이터(`fetchSavedCourses`/`fetchSavedPlaces`)는 기존처럼 `user_id` 필터가 걸린 직접 조회를 그대로 사용(§12).
- 기존 RLS 정책은 변경하지 않았다 — 이번 세션에서 RLS를 수정했다는 근거는 어디에도 없다.
- `toggle_public_course_save`만 인증을 요구하고, 조회용 두 feed RPC는 비로그인도 호출 가능(단 5개 제한)하다는 비대칭 구조를 유지했다.

---

## 5. 공개 feed 프론트 서비스 계층 — `publicFeedService.js`

**파일**: `src/features/courses/services/publicFeedService.js`(신규)

```js
fetchPublicCourseFeed({ sort = 'popular', limit = 10, offset = 0 })   // rpc: get_public_course_feed
fetchPublicPlaceFeed({ sort = 'popular', limit = 10, offset = 0 })    // rpc: get_public_place_feed
togglePublicCourseSave({ publicRouteKey })                            // rpc: toggle_public_course_save
fetchMySavedCounts()                                                  // rpc: get_my_saved_counts
```

- 네 함수 모두 `{ data, error } = await supabase.rpc(...)` 패턴이며, `error`는 삼키지 않고 그대로 `throw` — 로딩/에러 상태는 호출부(`PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`/`MyPage.jsx`)가 각각 `try/catch` + `loadError`/`loadMoreError` state로 처리한다.
- `fetchMySavedCounts()`는 `row?.saved_course_count`/`row?.saved_place_count`를 camelCase(`savedCourseCount`/`savedPlaceCount`)로 정규화해 반환 — RPC의 snake_case 컬럼명을 그대로 노출하지 않는다.
- `togglePublicCourseSave()`는 `Array.isArray(data) ? data[0] : data`로 단일/배열 두 반환 형태를 모두 흡수.
- 이 파일에는 일반 `supabase.from(...)` 직접 select가 전혀 없다 — 전부 `rpc()` 호출로만 구성되어 있음을 확인했다(§4.7의 보안 원칙과 일치).

---

## 6. 공개 여행자픽 페이지 구현

### 6.1 페이지 구조 — `ExplorePage.jsx`

**파일**: `src/pages/ExplorePage.jsx`(신규, 옛 `CoursesPage.jsx`를 대체 — §11.2)

- `tab` state(`'routes'` | `'places'`, 초기값 `'routes'`), `sort` state(`'popular'` | `'latest'`, 초기값 `'popular'`)를 페이지 레벨에서 관리.
- 상단 `PageHeader`에 `t('explore.title')`/`t('explore.subtitle')` — "인기"라는 단어를 페이지 제목/설명에 절대 포함하지 않는다(§10, §15).
- `UnderlineTabs`로 `동선`/`가게`(`explore.tabs.routes`/`explore.tabs.places`) 탭 전환, 그 아래 우측 정렬된 `인기순`/`최신순`(`publicFeed.sortPopular`/`sortLatest`) 세그먼트 컨트롤.
- **두 탭 모두 항상 마운트된 채로 CSS(`hidden`)로만 감춘다** — 탭을 전환해도 이미 불러온 `PublicRoutesTab`/`PublicPlacesTab`의 feed를 다시 fetch하지 않는다(기존 SavedRoutesTab/SavedPlacesTab 탭 전환 패턴과 동일).

### 6.2 공개 동선 목록 — `PublicRoutesTab.jsx`

**파일**: `src/features/courses/components/PublicRoutesTab.jsx`(신규)

- `rows`(누적된 feed 행), `offset`, `totalCount`, `loading`/`loadError`/`loadingMore`/`loadMoreError`, `busyKeys`(하트 토글 진행 중인 `public_route_key` 집합) state로 구성.
- 최초 로드: `fetchPublicCourseFeed({ sort, limit, offset: 0 })`, `limit`은 로그인 시 `LOGGED_IN_PAGE_SIZE = 10`, 비로그인 시 `GUEST_LIMIT = 5`.
- `dedupeRows()`: `public_route_key` 기준 중복 제거 — 더 보기로 누적되는 과정에서 같은 대표 동선이 겹쳐 들어오는 경우를 걸러낸다.
- `rank`는 `sort === 'popular' ? index + 1 : null`로 계산 — **rows 배열의 실제 인덱스**를 그대로 쓰므로, RPC가 반환한 순서를 프론트에서 재정렬하지 않으며, 더 보기로 누적된 이후에도(offset 반영) 인덱스가 항상 전역 순위와 일치한다. `sort === 'latest'`일 때는 순위 자체를 만들지 않는다(§8, §10).
- 각 row의 `anchorLabel`은 `getPublicCourseAnchorDisplay(row, locale, { t })`(`courseDisplay.js`)로 계산 — 공개 카드 전용 "기준 위치" fallback 우선순위(§8.2)를 사용한다.
- 하트 클릭(`handleToggleHeart`): 비로그인이면 `useAuthPrompt`로 로그인 안내(`publicFeed.loginToSaveRoute`) + `buildReturnTo(location)`으로 현재 위치 복귀 경로 저장. 로그인 상태면 `is_saved`/`save_count`를 즉시 낙관적으로 뒤집고, `togglePublicCourseSave()` 결과로 재동기화, 실패 시 원복. `busyKeys`로 같은 카드 중복 클릭 방지.
- 더 보기: 비로그인이면 로그인 안내(`publicFeed.loginToLoadMoreRoutes`), 로그인 상태면 §7의 150개 상한 로직에 따라 `fetchPublicCourseFeed`를 재호출.

### 6.3 공개 가게 목록 — `PublicPlacesTab.jsx`

**파일**: `src/features/courses/components/PublicPlacesTab.jsx`(신규)

- `places`(병합된 장소 배열), `statsById`(리뷰 통계 Map), `offset`/`totalCount`/로딩·에러 state 구성.
- `mergeFeedRows(rows)`: feed 행의 `place_id` 목록을 모아 `getPlacesByIds(placeIds, locale)`와 `fetchPlaceReviewStatsBatch(placeIds)`를 **`Promise.all`로 동시에 각 1회**만 호출한 뒤, RPC가 반환한 원래 순서(`rows.map(...)`)를 그대로 유지하며 장소 레코드·리뷰 통계·`save_count`/`is_saved`/거리(`distanceKm`, 서울시청 기준 — 현재 화면에서는 표시하지 않음, §9.1)를 병합한다.
- `rank`는 렌더링 시점에 `sort === 'popular' ? index + 1 : null`로 계산(routes와 동일한 정책).
- 카드 클릭(`handleOpen`): 단일 스톱짜리 임시 `course` 객체(`{ title, stops: [place], accent }`)를 만들어 `navigate(ROUTES.home, { state: { savedCourse } })`로 이동 — Map 탭의 `NearbySheet`가 이 상태를 받아 해당 장소의 상세 시트를 바로 연다(§9.1의 카드 클릭 상세 이동은 이 경로).
- 이번 세션 중 **목록 카드의 직접 하트 버튼과 `handleToggleHeart`/`busyIds` state 자체를 완전히 제거**했다 — 현재 `PublicPlacesTab.jsx`에는 `addPlaceBookmark`/`removePlaceBookmark` import가 전혀 없다(§9.1).

### 6.4 비로그인 / 로그인 동작 차이

| 항목 | 비로그인 | 로그인 |
|---|---|---|
| 최초 노출 개수 | 최대 5(`GUEST_LIMIT`, RPC도 서버에서 5로 제한) | 최대 10(`LOGGED_IN_PAGE_SIZE`) |
| 더 보기 클릭 | `useAuthPrompt`로 로그인 안내, `buildReturnTo(location)`으로 복귀 경로 저장 | 다음 페이지 요청(§7의 150개 상한 적용) |
| 하트 클릭(동선) | 로그인 안내(`publicFeed.loginToSaveRoute`) | `togglePublicCourseSave` 호출 |
| 로그인 후 복귀 | `navigateToLogin`이 저장해둔 `returnTo`로 복귀 — 현재는 `/explore`(§11) | — |

`buildReturnTo(location)`(`src/shared/utils/authRedirect.js`)은 `location.pathname + search + hash`를 그대로 문자열화하므로, 사용자가 실제로 `/explore`에 있을 때 로그인 프롬프트를 열면 별도 코드 수정 없이 자동으로 `/explore`가 `returnTo`로 저장된다 — 라우트 이름을 `/explore`로 바꾼 것(§11) 외에 `authRedirect.js` 자체는 이번 세션에서 수정하지 않았다.

### 6.5 locale batch 조회와 N+1 방지

- **동선**: `PublicRoutesTab.jsx`가 화면에 있는 모든 row의 모든 스톱 id를 `useMemo`로 한 번에 모아(`allStopIdsKey`) `[allStopIdsKey, locale]`을 의존성으로 하는 단일 `useEffect`에서 `getPlacesByIds(ids, locale)`를 **정확히 1회** 호출한다. 결과를 `Map`으로 변환해 `mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(id))`(`courseDisplay.js`, docs/56에서 도입된 기존 헬퍼 재사용)로 병합 — 동선별/스톱별 반복 조회가 없다.
- **가게**: `PublicPlacesTab.jsx`의 `mergeFeedRows()`가 페이지당 `getPlacesByIds` 1회 + `fetchPlaceReviewStatsBatch` 1회로 끝난다.
- 두 탭 모두 `locale`이 effect/`useCallback`의 의존성에 포함되어 있어, 언어 전환 시 자동으로 재조회되고, `cancelled` 플래그로 stale response(느리게 도착한 이전 locale 응답)를 무시한다 — 새 코드를 추가하지 않고 기존 취소 패턴을 그대로 재사용했다.
- 코스 제목은 `getSavedCourseDisplayTitle(row, locale, { getCategoryLabel, t, localizedStops })`로 현재 locale 기준 재생성(§4.8, docs/56).

---

## 7. 최대 150개 노출 제한

**신규 파일**: `src/features/courses/constants/publicFeed.js`

```js
export const MAX_PUBLIC_FEED_ITEMS = 150;
```

- 동선과 가게 탭이 **이 상수를 공유**하지만, 각 탭은 독립적으로 최대 150개까지만 누적한다(합쳐서 150이 아님).
- `PublicRoutesTab.jsx`/`PublicPlacesTab.jsx` 모두 동일한 패턴:
  - `effectiveTotal = Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS)`, `hasMore = rows.length < effectiveTotal` — RPC의 `total_count`가 150을 넘어도 UI상 유효 total은 150으로 취급.
  - 더 보기 클릭 시 `remaining = MAX_PUBLIC_FEED_ITEMS - rows.length`를 먼저 계산해 `remaining <= 0`이면 요청 자체를 보내지 않고 조용히 반환.
  - 서버 요청 `limit`은 `Math.min(LOGGED_IN_PAGE_SIZE, remaining)` — 예를 들어 145개가 쌓인 상태라면 다음 요청은 `limit=5`만 보낸다. 기존 페이지 크기(`LOGGED_IN_PAGE_SIZE = 10`)나 `offset += data.length` 누적 방식 자체는 변경하지 않았다.
  - 응답 병합 후 `.slice(0, MAX_PUBLIC_FEED_ITEMS)`로 한 번 더 잘라, 중복 제거 과정에서 혹시 150개를 넘기더라도 실제 표시 목록이 150개를 초과하지 않도록 이중으로 방어.
- 순위(`rank`)는 이 배열의 인덱스 기반이므로, 배열 자체가 150개를 넘지 않으면 151위가 화면에 나타나는 경우가 구조적으로 없다.
- 서버 쪽 단일 요청 상한(로그인 시 최대 50, §4.3/§4.4)은 그대로 두었고, 프론트가 항상 그보다 작은 `LOGGED_IN_PAGE_SIZE`(10) 이하로만 요청하므로 이번 변경으로 RPC의 단일 요청 제한을 위반하는 경우는 없다.
- 정렬(`sort`)이 바뀌면 `PublicRoutesTab`/`PublicPlacesTab`의 최초 로드 `useEffect`가 `sort`를 의존성으로 이미 갖고 있어 `rows`/`offset`/`totalCount`가 자동으로 초기화된다 — 인기순/최신순이 각각 독립적으로 새로 150개까지 누적된다.
- 비로그인 5개 제한은 이 150개 상한과 무관하게 그대로 우선 적용된다(§6.4) — DB/RPC는 수정하지 않았다.

---

## 8. 공개 동선 카드 UI — `PublicCourseCard.jsx` (여러 차례 반복 수정)

**파일**: `src/features/courses/components/PublicCourseCard.jsx`(신규), `src/features/courses/components/CourseStopPath.jsx`(신규, 장소 경로 그리드를 `CourseCard.jsx`와 공유하기 위해 추출)

이 카드는 이번 세션 중 최소 4차례에 걸쳐 요구사항이 추가되며 반복 수정되었다. 최종 상태를 기준으로 정리한다.

### 8.1 카드 구조 — 2개 영역

카드는 `overflow-hidden rounded-3xl bg-white shadow-[...]` 하나의 바깥 박스 안에, **색이 있을 수 있는 상단 정보 영역**(`<button onClick={onViewDetail}>`)과 **항상 흰색인 하단 경로+액션 영역**(`<div>`)의 2개 구조로 되어 있다 — 순위 배경이 카드 전체가 아니라 상단 정보 영역에만, 그것도 그 영역의 맨 아래 border까지 정확히 적용되도록 구조 자체를 분리했다.

상단 정보 영역 내부 순서: 순위(+메달) → 동선 제목 → **divider** → 기준 위치 → `[N곳] 식당 N · 카페 N` → 정보 영역 자체의 하단 border. 하단 영역: 장소 경로(`CourseStopPath`, 1→2→3 그리드) → divider → `저장 N` / `동선 상세 보기 >`.

### 8.2 기준 위치 표시와 fallback 우선순위

`getPublicCourseAnchorDisplay(row, locale, { t })`(`courseDisplay.js`)가 공개 카드 전용 "기준 위치" 값을 계산한다. 우선순위:

1. `row.anchor_address_original`(영어 화면은 `formatKoreanAddressToEnglish()`로 구조적 로마자 변환 시도)
2. `row.course_snapshot?.anchor_address`
3. `row.anchor_name_original`
4. 현재 locale 기준 프리셋/구·동 라벨(`getLocalizedDistrict`)
5. `row.anchor_label`/`row.course_snapshot?.anchor_label`(단, "선택한 지역"류 의미 없는 라벨은 제외)
6. 위 전부 없으면 `null` — 이 경우 기준 위치 줄 자체를 렌더링하지 않는다.

값이 있을 때는 `기준 위치 : {값}`(ko) / `Starting point: {값}`(en) / `起点：{값}`(zh-CN) 형태로, 라벨·구분자 모두 dictionary(`publicFeed.anchorLocationLabel`/`anchorLocationSeparator`)에서 온다 — locale별 콜론 앞뒤 간격이 자연스럽게 처리된다.

### 8.3 제목 한 줄 말줄임과 divider

- 동선 제목(`<h3>`)은 처음엔 `line-clamp-2`(2줄 허용)였다가, 이후 요청으로 `truncate`(한 줄+말줄임)로 변경했고 `title={course.title}` 속성으로 전체 제목을 접근 가능하게 남겼다.
- 제목 바로 아래에 `border-t`를 추가해 "제목 → border → 기준 위치"로 이어지도록 했다 — 색상 카드에서는 `border-black/10`(반투명, 배경색 위에서 자연스럽게 보임), 일반 카드에서는 `border-ink/5`(앱 전역에서 재사용되는 가장 연한 divider 토큰). 이 border는 정보 영역 맨 아래 border(§8.1)와는 **별개**이며 겹치지 않는다.

### 8.4 순위 표시 범위 — 1줄 → 전체 정보 영역

최초 구현에서는 카드 맨 위 "1위 인기 동선" 한 줄만 금·은·동 배경이었으나, 이후 요청으로 **순위 문구부터 `[N곳] 식당 N · 카페 N`까지 상단 정보 영역 전체**가 하나의 색상 블록이 되도록 확장했다(`rankStyle.wrap`을 상단 `<button>` 자체의 배경으로). 순위 문구도 "1위 인기 동선"에서 "인기 동선"을 떼어내 순수 순위만(`1위`/`#1`/`第1名`)으로 정리했다.

### 8.5 전체 순위 표시(4위 이하 포함)

처음에는 1~3위에만 순위/메달이 표시되고 4위 이하는 아무 표시가 없었으나, 이후 요청으로 **인기순의 모든 순위**(`rank != null`)에 대해 순위 문구를 표시하도록 확장했다. 1~3위는 메달+색상 배경, 4위 이하는 메달 없이 `text-ink-soft` 색상의 순위 문구만 카드 상단 중앙에 표시하고 배경은 일반 흰색을 유지한다. 최신순(`sort === 'latest'`)에서는 `rank`가 항상 `null`이므로 순위 문구 자체가 렌더링되지 않는다 — "최신순에서 목록 순서를 1위처럼 표시"하는 문제가 구조적으로 발생하지 않는다.

### 8.6 순위별 색상 팔레트와 메달 이미지

색상/메달 상수는 두 카드(동선·가게)가 공유하도록 신규 파일 `src/features/courses/utils/rankDisplay.js`로 추출했다.

```js
export const RANK_BAND_STYLES = {
  1: { wrap: 'bg-[#FBE9C6]', text: 'text-[#7A5A12]' }, // 금
  2: { wrap: 'bg-[#E7E9ED]', text: 'text-[#4B5563]' }, // 은
  3: { wrap: 'bg-[#EAD2BC]', text: 'text-[#7A4A26]' }, // 동
};
export const RANK_MEDAL_SRC = {
  1: `${import.meta.env.BASE_URL}images/rank/medal-gold.png`,
  2: `${import.meta.env.BASE_URL}images/rank/medal-silver.png`,
  3: `${import.meta.env.BASE_URL}images/rank/medal-bronze.png`,
};
```

메달 경로는 `import.meta.env.BASE_URL`을 붙여서 만든다 — `vite.config.js`가 프로덕션 빌드에서 `base: '/matgil/'`을 쓰므로, `/images/rank/...` 같은 절대경로 리터럴을 그대로 쓰면 배포 환경(GitHub Pages 서브패스)에서 404가 난다. 실제 `dist/images/rank/`에 3개 PNG가 정상 복사되는 것을 빌드 결과로 확인했다(§21). 메달 이미지는 `alt=""`/`aria-hidden="true"`인 순수 장식 이미지이며, 순위 자체는 텍스트로 스크린리더에 계속 읽힌다.

### 8.7 하단 저장 표시 색상 중립화(최종 수정)

가장 마지막 요청으로, 카드 하단 좌측의 하트+`저장 N`을 우측 `동선 상세 보기`와 **동일한 시각적 강도**로 맞췄다. `isSaved` 여부와 무관하게 `text-ink-soft`(hover/active 시 `text-ink`) + `font-bold`로 통일 — 기존의 `isSaved ? 'text-coral' : 'text-ink-faint'` 분기를 제거했다. `FavoriteHeartIcon`은 FontAwesome 아이콘을 `currentColor`로 그리므로, 부모 버튼의 텍스트 색상만 바꾸면 하트 아이콘 색도 함께 바뀐다(아이콘 자체에 별도 색 클래스가 없음을 코드로 확인). 하트 클릭 기능, 낙관적 저장 수 증감, `busy` 중복 클릭 방지, 비로그인 안내는 전혀 변경하지 않았다.

---

## 9. 공개 가게 카드 UI — `PublicPlaceCard.jsx` (여러 차례 반복 수정)

**파일**: `src/features/courses/components/PublicPlaceCard.jsx`(신규)

### 9.1 최초 구현 — 거리 제거, 주소 추가, 직접 하트 제거

- 기존에 표시되던 `241 m`류 거리는 **서울시청(`DEFAULT_LOCATION`) 기준 `calcDistanceKm()`**로 계산된, 사용자가 실제로 선택한 기준 위치와 무관한 값이었다. 이를 카드에서 완전히 제거하고, 대신 `getPlacesByIds(placeIds, locale)`로 받아온 **현재 locale의 `place.address`**를 표시했다(스냅샷 주소가 아님). 인기 가게는 특정 기준 위치를 저장하지 않으므로 "기준 위치"라는 표현 자체를 쓰지 않는다.
- 카드 오른쪽의 직접 저장 하트 버튼, 그 클릭 이벤트, 카드별 `busy` state를 전부 제거했다 — `PublicPlacesTab.jsx`에는 더 이상 `addPlaceBookmark`/`removePlaceBookmark`/`handleToggleHeart`/`busyIds`가 없다. 카드 전체가 `role="button"`인 단일 클릭 영역이 되어, 클릭 시 항상 가게 상세로 이동한다. 저장/해제는 가게 상세 페이지의 기존 하트로만 가능(§13). 중첩 button 문제도 하트 버튼 자체가 없어져 원천적으로 해소됐다.
- 저장 수(`publicFeed.saveCount`)는 통계 텍스트로만 유지, RPC의 `save_count` 사용.

### 9.2 순위 UI를 동선 카드와 통일 — 상단 별도 영역으로 재구성

최초에는 순위+메달이 카드 본문 좌측 상단에 작게 붙어 있었으나, 이후 요청으로 **동선 카드와 동일한 구조**로 바꿨다: 카드 최상단에 `flex items-center justify-center`로 가운데 정렬된 별도 순위 섹션(메달 + 순위 문구)을 만들고, 그 아래 `border-b`로 구분한 뒤 흰색 본문(썸네일 + 이름/대표메뉴/주소/통계)이 이어지도록 재구성했다. `rankDisplay.js`의 `RANK_BAND_STYLES`/`RANK_MEDAL_SRC`를 동선 카드와 **그대로 공유**한다(§8.6) — 같은 상수를 복사하지 않고 import.

### 9.3 4위 이하 배경 제거, border 완화(최종 수정)

- 순위 UI를 상단 섹션으로 옮긴 직후에는 4위 이하에도 `bg-ink/5`(연한 회색) 배경을 넣었으나, 마지막 요청으로 **4위 이하는 배경을 완전히 제거**하고 카드 기본 흰색과 동일하게 만들었다(순위 텍스트는 `text-ink`로 유지, 순위 문구·섹션 자체는 계속 표시).
- 순위 섹션과 본문 사이 border도 `border-black/10`(1~3위)/`border-ink/5`(4위 이하)로 나뉘어 있던 것을 **모든 순위(1~3위, 4위 이하 공통)에 `border-ink/5`** 하나로 통일해 전반적으로 더 연하게 만들었다 — 앱 전역에서 이미 쓰이는 가장 연한 divider 토큰을 그대로 재사용.
- 최신순에서는 `rank`가 `null`이라 순위 섹션 자체가 렌더링되지 않는다(동선 카드와 동일한 정책).

### 9.4 통계 행 — 순서·색상·굵기 정리(여러 차례 수정)

- **순서**: 저장 수를 별점보다 먼저 표시하도록 정리(`저장 2 · ★ 4.0 (1)`) — en `2 saved · ★ 4.0 (1)`, zh-CN `2人收藏 · ★ 4.0（1）`. 리뷰가 없으면 `저장 1 · 아직 리뷰가 없어요`.
- **색상(1차)**: 저장 수·별 아이콘·평균 별점을 코랄로 강조했다.
- **색상(최종)**: 마지막 요청으로 코랄을 완전히 제거하고, 저장 수·separator(`·`)·별 아이콘·평균 별점·리뷰 수 괄호·리뷰 없음 문구 **전체를 부모 컨테이너 한 곳에서 `text-ink/75 font-medium`으로 통일**했다(자식 span들의 개별 색상/굵기 클래스를 모두 제거하고 상속받게 함) — 저장 수만 빨갛거나 별점만 빨간 상태가 남지 않도록, 한 곳에만 스타일을 지정하는 방식으로 재구성했다.

---

## 10. 메달 이미지와 Flaticon 저작자 표시

- 사용자가 Flaticon에서 **Magnific** 제작 메달 PNG 3개를 다운로드해 `public/images/rank/`에 직접 저장했다: `medal-gold.png`(27,155 bytes), `medal-silver.png`(30,068 bytes), `medal-bronze.png`(31,521 bytes) — 파일명이 이번 세션이 애초에 예상한 이름과 정확히 일치해 별도 매핑 조정 없이 그대로 참조했다. 이미지 파일 자체는 이동/복사/재압축/수정하지 않았다.
- 표시 위치: 공개 동선 1~3위(§8.6), 공개 가게 1~3위(§9.2).
- 저작자 표기는 **마이페이지 푸터에 한 번만** 추가했다(카드마다 반복하지 않음) — `MyPage.jsx`의 `footerAddress`와 `footerCopy` 사이:

  ```jsx
  <a
    href="https://www.flaticon.com/kr/free-icons/"
    title={t('my.medalAttribution')}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[0.65rem] text-ink-faint underline underline-offset-2"
  >
    {t('my.medalAttribution')}
  </a>
  ```

  - ko: `메달 아이콘 제작자: Magnific - Flaticon`
  - en: `Medal icons created by Magnific - Flaticon`
  - zh-CN: `奖牌图标作者：Magnific - Flaticon`
  - `target="_blank"` + `rel="noopener noreferrer"`, 링크 전체 텍스트가 클릭 영역, URL을 별도 평문으로 노출하지 않음.

---

## 11. 라우팅과 하단 메뉴 명칭 개편

### 11.1 `/explore` 라우트와 `/courses` redirect

**파일**: `src/shared/constants/routes.js`, `src/app/router.jsx`

- `ROUTES.explore = '/explore'` 신규 추가. `ROUTES.courses = '/courses'`는 **삭제하지 않고** 남겨두되, 주석으로 "이제 이 상수는 `/courses`→`/explore` redirect 라우트 등록용으로만 쓰이고, 다른 어떤 코드도 `ROUTES.courses`로 실제 이동해서는 안 된다"고 명시했다.
- `router.jsx`에 정적 경로 redirect를 추가했다: `<Route path={ROUTES.courses} element={<Navigate to={ROUTES.explore} replace />} />`. 이 라우트는 `<Route path={ROUTES.courseDetail(':id')} .../>`(개별 동선 상세, `/courses/:id`)보다 **더 구체적인 동적 라우트가 이미 앞서 등록**되어 있어 React Router v6의 랭크드 매칭상 충돌하지 않는다 — `/courses/123` 접근은 여전히 `CourseDetailPage`로, 정확히 `/courses`만 `/explore`로 리다이렉트된다.
- 실제 공개 목록(구 `CoursesPage`)의 새 라우트 등록: `<Route path={ROUTES.explore} element={<ExplorePage />} />`(`AppLayout` 하위, 하단 내비게이션 포함).
- `ROUTES.courseDetail`(`/courses/:id`)과 `ROUTES.savedCourseDetail`(`/saved-courses/:id`)은 이번 개편에서 **전혀 건드리지 않았다**.

`ROUTES.courses`를 실제로 참조하던 다른 코드도 전부 `ROUTES.explore`로 정리했다(전체 grep 기준): `CourseDetailPage.jsx`(코스 없음 시 리다이렉트, 뒤로가기), `PlaceDetailPage.jsx`(뒤로가기 히스토리 없을 때 폴백, notFound 리다이렉트), `SavedCourseDetailPage.jsx`(비로그인/코스 없음 리다이렉트, 삭제 성공 후 이동, 뒤로가기). 이 중 `CourseDetailPage.jsx`(정적 데모 큐레이션 코스)와 `SavedCourseDetailPage.jsx`(개인 저장 코스 상세)는 원래도 "공개 목록 페이지로 돌아간다"는 동일한 목적지를 가리키고 있었으므로, 목적지 자체는 바꾸지 않고 상수 이름만 `ROUTES.explore`로 1:1 치환했다 — 이 두 화면의 "뒤로가기가 이상적으로는 저장 목록으로 가야 하지 않는가"라는 UX 문제는 이번 세션의 요청 범위 밖이라 손대지 않았다.

### 11.2 페이지 컴포넌트 — `CoursesPage.jsx` → `ExplorePage.jsx`

전체 프로젝트 검색 결과 `CoursesPage`를 실제로 import하는 곳이 `router.jsx` 단 한 곳임을 먼저 확인한 뒤, 안전하다고 판단해 파일명·컴포넌트명을 변경했다: `src/pages/CoursesPage.jsx` 삭제, `src/pages/ExplorePage.jsx`(컴포넌트명 `ExplorePage`) 신규 작성, `router.jsx`의 import·JSX를 함께 갱신 — git 상 중복 파일이 남지 않았음을 `git status --short`(`D src/pages/CoursesPage.jsx`, `?? src/pages/ExplorePage.jsx`)로 확인했다. `MyPage.jsx`/`authRedirect.js`/`SavedRoutesTab.jsx`의 산문 주석 속 "CoursesPage" 언급 몇 곳은 기능에 영향이 없는 과거 서술이라 이번 세션에서는 손대지 않았다.

### 11.3 하단 메뉴 라벨 변경 이력

**파일**: `src/features/navigation/components/BottomNavigation.jsx`, `src/shared/i18n/dictionary.js`

하단 메뉴 두 번째 탭의 `to`/`labelKey`는 `{ to: ROUTES.courses, labelKey: 'nav.courses' }`에서 `{ to: ROUTES.explore, labelKey: 'nav.explore' }`로 바뀌었고, 그 값(`nav.explore`)은 이번 세션 중 **두 번** 바뀌었다.

1. 1차: ko `둘러보기` / en `Explore` / zh-CN `发现`
2. 최종(2차): ko `여행자픽` / en `Picks` / zh-CN `旅行者精选`

`RouteIcon`은 두 차례 모두 전혀 바꾸지 않았다 — 아이콘 컴포넌트(`Icon.jsx`)도 수정하지 않았고, 활성 시 코랄, 비활성 시 `text-ink-faint`인 기존 스타일도 그대로다. 다른 하단 메뉴(`지도`/`표현`/`커뮤니티`/`내 정보`) 라벨과 아이콘도 이번 세션에서 전혀 바꾸지 않았다. **하단 마지막 메뉴(`내 정보`)를 `마이페이지`/`My Page`/`我的页面`로 바꾸는 작업은 이번 세션에서 실행하지 않았다** — 현재도 `nav.you`(`내 정보`/`You`/`我的`) 그대로다(§23 후속 과제).

페이지 제목(`explore.title`: `여행자 추천`/`Traveler Picks`/`旅行者推荐`)과 내부 탭(`explore.tabs.routes`/`.places`: `동선`/`가게`, `Routes`/`Places`, `路线`/`店铺`)은 하단 메뉴 라벨이 두 번 바뀌는 동안 **한 번도 바뀌지 않았다** — "인기"라는 단어를 페이지 제목/탭에 넣지 않는다는 정책(§6.1)과 별개로, 하단 메뉴명 변경은 오직 `nav.explore` 값 하나만의 문제였다.

### 11.4 Course 도메인 명칭을 유지한 설계 의도

`courses`라는 문자열이 들어간 모든 식별자를 기계적으로 `explore`로 바꾸지 않았다. 실제 동선 도메인을 가리키는 다음 이름들은 의도적으로 그대로 유지했다: `CourseCard.jsx`, `CourseDetailPage.jsx`, `SavedCourseDetailPage.jsx`, `courseDisplay.js`, `savedCourseService.js`, `PublicRoutesTab.jsx`(공개 탭이지만 "동선 목록"이라는 내부 개념은 유지), `route_signature`/`ordered_route_key`(§4), `course_snapshot`, `titleTheme`. 반대로 "공개 탐색 탭 자체"를 가리키던 이름만 `explore` 의미로 바꿨다: `ROUTES.explore`, `/explore`, `nav.explore`, `ExplorePage`. dictionary의 `courses` 네임스페이스도 전부 걷어내지 않고, 실제로 공개 탭에서만 쓰이던 `courses.title`/`.subtitle`/`.tabRoutes`/`.tabPlaces` 4개 키만 제거하고 `courses.curatedRoute`/`.startCourse`(정적 큐레이션 코스 상세 `CourseDetailPage.jsx`가 계속 사용)는 그대로 남겨뒀다 — 두 세트가 같은 `courses` 객체 안에 있었기 때문에, 실제 사용처를 grep으로 먼저 확인한 뒤에만 제거했다.

---

## 12. 개인 저장 목록의 마이페이지 이동

### 12.1 새 route — `/my/saved-routes`, `/my/saved-places`

**파일**: `src/pages/SavedRoutesPage.jsx`(신규), `src/pages/SavedPlacesPage.jsx`(신규), `src/shared/constants/routes.js`(`mySavedRoutes`/`mySavedPlaces` 추가), `router.jsx`(두 라우트를 `AppLayout` 하위에 등록 — 하단 내비게이션이 계속 보임)

두 페이지는 거의 동일한 얇은 wrapper다: `useAuth()`로 비로그인이면 `/login`으로 리다이렉트, 자체 뒤로가기 버튼(`navigate(ROUTES.my)`)과 `PageHeader`, 그 아래 **기존** `SavedRoutesTab`/`SavedPlacesTab`을 그대로 렌더링한다. 두 탭 컴포넌트 자체의 내부 로직(§ below)은 이번 세션에서 전혀 수정하지 않았다 — 단지 `CoursesPage.jsx` 내부의 탭이 아니라 각자의 독립된 라우트에서 렌더링되도록 호출 위치만 옮겼다.

- `SavedRoutesTab.jsx`: docs/56에서 이미 정리된 `useSavedCourses()` 훅(`fetchSavedCourses`/`softDeleteSavedCourse`, `user_id` 필터가 걸린 본인 데이터 직접 조회) + 전체 스톱 id batch `getPlacesByIds` locale 조회를 그대로 재사용.
- `SavedPlacesTab.jsx`: `fetchSavedPlaces({ userId, locale })`(`mg_place_bookmarks` 본인 조회 + `getPlacesByIds` batch) + `fetchPlaceReviewStatsBatch` 그대로 재사용.

브라우저 뒤로가기 / 직접 URL 접근 / 새로고침이 모두 "탭 상태"가 아니라 "실제 라우트"이므로 일반 페이지처럼 동작한다는 것이 이 이동의 핵심 이점이다(각 페이지 파일의 자체 doc comment에 그대로 명시되어 있음).

### 12.2 마이페이지 저장 카드 — `get_my_saved_counts`

**파일**: `src/pages/MyPage.jsx`

기존 "내가 쓴 글"/"좋아요한 글"/"언어" 3개 `StatCard` 행 **아래**에, 새 행을 하나 추가했다.

```jsx
<div className="mt-2 flex gap-2">
  <StatCard value={savedCounts?.savedCourseCount ?? null} label={t('savedCourses.title')} onClick={() => navigate(ROUTES.mySavedRoutes)} />
  <StatCard value={savedCounts?.savedPlaceCount ?? null} label={t('savedPlaces.title')} onClick={() => navigate(ROUTES.mySavedPlaces)} />
</div>
```

- `loadSavedCounts()`가 `fetchMySavedCounts()`(§4.6, §5)를 호출해 `savedCounts` state를 채우고, 실패하면 `{ savedCourseCount: 0, savedPlaceCount: 0 }`로 폴백한다.
- `loadCounts()`(`fetchMyActivityCounts`, 커뮤니티 글/좋아요 수)와 `loadSavedCounts()`는 **완전히 독립된** `useCallback`/`useEffect` 쌍이다 — 코드 주석에 명시된 대로 "하나가 실패해도 다른 하나의 이미 로드된 숫자를 0으로 지워서는 안 된다"는 원칙에 따라 분리했다.
- 클릭 시 각각 `ROUTES.mySavedRoutes`/`ROUTES.mySavedPlaces`로 `navigate` — 인앱 뷰 전환이 아니라 실제 라우트 이동이다(§12.1).
- `StatCard`(`src/features/profile/components/StatCard.jsx`)는 라벨/값/클릭만 받는 순수 프레젠테이션 컴포넌트로, 이번 세션에서 **간격(gap)이나 border-radius 관련 수정은 하지 않았다** — 현재도 기존 `rounded-3xl`(`Card` 컴포넌트 기반) 그대로다(§23).
- `MyPage.jsx`의 doc comment에도 "Saved lists — moved here from the now-public Courses tab"이라는 문구가 그대로 남아 있어, 이 이동 자체가 실제로 반영된 코드임을 재확인했다.

### 12.3 기존 저장 탭 컴포넌트는 그대로

`SavedRoutesTab.jsx`/`SavedPlacesTab.jsx`는 docs/56에서 이미 완성된 로직(현재 locale batch 조회, N+1 방지, 삭제 확인, `actionMode` 카드 구조)을 그대로 갖고 있고, 이번 세션에서는 **호출 위치만** `CoursesPage.jsx` 내부 탭에서 `SavedRoutesPage.jsx`/`SavedPlacesPage.jsx`라는 독립 페이지로 옮겼을 뿐, 두 파일 자체의 내부 코드는 diff가 없다.

---

## 13. 가게 상세 페이지 헤더 — "가게 상세 정보" 문구

**파일**: `src/features/explore/components/PlaceDetailSheet.jsx`, `src/pages/PlaceDetailPage.jsx`

`PlaceDetailSheet.jsx`는 Map 탭의 바텀시트(`NearbySheet.jsx`)와 전체 페이지(`PlaceDetailPage.jsx`) 양쪽에서 공유되는 컴포넌트다. 뒤로가기 버튼 옆에 페이지 성격을 알려주는 라벨을 추가하되, **지도 바텀시트 쪽 동작을 바꾸지 않기 위해** 다음처럼 처리했다.

- `PlaceDetailSheet`에 `headerLabel = null`이라는 새 선택적 prop을 추가하고, 값이 있을 때만 뒤로가기 버튼 옆에 `<span className="text-sm font-bold text-ink-soft">{headerLabel}</span>`을 렌더링하도록 뒤로가기 버튼을 `flex items-center gap-2` wrapper로 한 번 감쌌다.
- `PlaceDetailPage.jsx`(전체 페이지)만 `headerLabel={t('placeDetail.pageHeaderLabel')}`을 실제로 전달한다.
- `NearbySheet.jsx`(지도 탭 바텀시트) 호출부는 이 prop을 넘기지 않으므로 `headerLabel`이 `null`인 채 그대로 유지되고, 렌더링 결과가 이전과 동일하다 — 지도 탭 쪽 회귀가 없음을 코드로 확인했다.
- dictionary `placeDetail.pageHeaderLabel`: ko `가게 상세 정보` / en `Place details` / zh-CN `店铺详情`.

---

## 14. 지도 음식 필터 — 최대 3개 선택 안내를 중앙 모달로 교체

### 14.1 기존 인라인 토스트의 문제

**파일**: `src/features/explore/components/FilterSheet.jsx`

기존에는 음식 종류를 이미 3개 선택한 상태에서 네 번째를 클릭하면, 필터 제목 아래에 `role="status"` 박스(`filter.catLimit` 문구)가 나타났다가 `setTimeout(() => setCatLimitHit(false), 2000)`으로 2초 뒤 자동으로 사라지는 방식이었다. 레이아웃이 순간적으로 흔들리고, 표시 시간이 짧아 사용자가 놓치기 쉬웠다.

### 14.2 `FoodTypeLimitModal.jsx` — 공용 `Modal` 셸 재사용

**신규 파일**: `src/features/explore/components/FoodTypeLimitModal.jsx`

새 컴포넌트를 만드는 대신, 이미 `AuthRequiredModal.jsx`/`JapaneseComingSoonModal.jsx`가 쓰고 있는 공용 `src/features/explore/components/Modal.jsx`(`variant="center"`, `dismissOnBackdrop`)와 `src/shared/hooks/useEscapeToClose.js`를 그대로 재사용했다 — 새 오버레이 패턴을 만들지 않았다.

```jsx
<Modal open={open} onClose={onClose} variant="center" dismissOnBackdrop>
  <div role="dialog" aria-modal="true" aria-labelledby="cat-limit-title" aria-describedby="cat-limit-desc" ...>
    <p id="cat-limit-title">{t('filter.catLimitTitle')}</p>
    <p id="cat-limit-desc">{t('filter.catLimit')}</p>
    <button ref={confirmRef} onClick={onClose}>{t('filter.catLimitConfirm')}</button>
  </div>
</Modal>
```

- `Modal`의 `variant="center"` + `dismissOnBackdrop`이 이미 "카드 바깥 클릭 시 닫힘, 카드 내부 클릭은 유지"를 구현하고 있어(`e.target === e.currentTarget`일 때만 `onClose` 호출) 별도 로직을 추가하지 않았다.
- `useEscapeToClose(open, onClose)`가 Escape 키 처리와 리스너 정리를 이미 담당하고 있어 그대로 호출만 했다.
- **자동 닫힘 타이머는 전혀 없다** — overlay 클릭/확인 버튼/Escape 중 하나가 있어야만 닫힌다.
- 열릴 때 확인 버튼에 `useEffect(() => { if (open) confirmRef.current?.focus(); }, [open])`로 focus, 닫힐 때는 `FilterSheet.jsx`가 `limitTriggerRef.current?.focus()`로 방금 클릭했던 음식 종류 pill 버튼에 focus를 되돌린다.
- `Modal`이 렌더링되는 위치가 `HomePage.jsx`의 `AppLayout`(전체를 감싸는 `relative` 컨테이너) 안이라, `absolute inset-0`가 하단 내비게이션을 포함한 전체 화면을 덮는다 — 이는 `AuthRequiredModal` 등 기존 center 모달이 이미 검증해 온 것과 같은 포지셔닝 구조를 그대로 재사용한 결과다.

### 14.3 `FilterSheet.jsx` 쪽 변경

- `catLimitHit` state, `limitTimerRef`, `showLimitToast()`/`clearLimitToast()`, 필터 제목 아래 `role="status"` 박스를 전부 제거했다.
- 대신 `limitModalOpen` state와, 방금 클릭한 pill 버튼을 기억하는 `limitTriggerRef`를 추가했다. pill의 `onClick(e)`에서 `e.currentTarget`을 **핸들러 최상단에서 로컬 변수로 즉시 캡처**한 뒤(React 합성 이벤트의 `currentTarget`이 이후 `null`이 될 수 있어, `setDraft` 업데이터 콜백 안에서 직접 `e.currentTarget`을 읽지 않도록 함) 이미 3개가 선택된 상태에서 새 항목을 클릭한 경우에만 `limitTriggerRef.current = target; setLimitModalOpen(true)`를 호출한다.
- 이미 선택된 항목을 다시 눌러 해제하는 동작, `전체` 버튼, 초기화 버튼은 그대로 동작 — 해제/전체/초기화 경로에는 모달을 열지 않는다.
- 최대 선택 개수(3개) 자체, 필터 결과 계산, 검색/추천 로직은 전혀 건드리지 않았다.

### 14.4 다국어

기존 `filter.catLimit`(`음식 종류는 최대 3개까지 선택할 수 있어요.` / `You can select up to 3 food types.` / `最多可选择3种美食类型。`)을 모달 설명 문구로 **그대로 재사용**하고, 제목/확인 버튼만 새로 추가했다.

| 키 | ko | en | zh-CN |
|---|---|---|---|
| `filter.catLimitTitle` | 선택할 수 없어요 | Selection limit | 已达到选择上限 |
| `filter.catLimit`(기존 재사용) | 음식 종류는 최대 3개까지 선택할 수 있어요. | You can select up to 3 food types. | 最多可选择3种美食类型。 |
| `filter.catLimitConfirm` | 확인 | OK | 确认 |

---

## 15. 다국어(ko/en/zh-CN) 정리 종합

이번 세션에서 새로 추가되거나 값이 바뀐 dictionary 키 전체:

| 영역 | 키 | ko | en | zh-CN |
|---|---|---|---|---|
| 하단 메뉴 | `nav.explore` | 여행자픽 | Picks | 旅行者精选 |
| 페이지 제목 | `explore.title` | 여행자 추천 | Traveler Picks | 旅行者推荐 |
| 페이지 설명 | `explore.subtitle` | 다른 여행자들이 저장한 동선과 가게를 둘러보세요. | Explore routes and places saved by other travelers. | 浏览其他旅行者收藏的路线和店铺。 |
| 내부 탭 | `explore.tabs.routes` / `.places` | 동선 / 가게 | Routes / Places | 路线 / 店铺 |
| 정렬(기존 유지) | `publicFeed.sortPopular` / `.sortLatest` | 인기순 / 최신순 | Popular / Latest | 人气 / 最新 |
| 순위 문구(기존 유지) | `publicFeed.rankLabel` | `{rank}위` | `#{rank}` | `第{rank}名` |
| 기준 위치 | `publicFeed.anchorLocationLabel`/`.anchorLocationSeparator` | 기준 위치 : | Starting point: | 起点： |
| 빈 상태(중립화) | `publicFeed.emptyRoutes`/`.emptyPlaces` | 아직 공유된 동선이 없습니다. / 아직 공유된 가게가 없습니다. | No shared routes yet. / No shared places yet. | 暂无共享路线。 / 暂无共享店铺。 |
| 가게 상세 헤더 | `placeDetail.pageHeaderLabel` | 가게 상세 정보 | Place details | 店铺详情 |
| 필터 제한 모달 | `filter.catLimitTitle`/`.catLimitConfirm` | 선택할 수 없어요 / 확인 | Selection limit / OK | 已达到选择上限 / 确认 |
| 메달 저작자 | `my.medalAttribution` | 메달 아이콘 제작자: Magnific - Flaticon | Medal icons created by Magnific - Flaticon | 奖牌图标作者：Magnific - Flaticon |

영문 `#N`(예: `#1`)과 중문 `第N名`(예: `第1名`)은 각 언어에서 이미 자연스럽고 널리 쓰이는 순위 표기라고 판단해 **의도적으로 그대로 유지**했다 — `1st`/`2nd`/`3rd` 같은 서수 표기나 `1位` 같은 변형으로 바꾸지 않았다. 영어/중국어 어디에도 한국어 원문이 그대로 노출되는 fallback은 없다(각 키가 3개 locale 모두에 독립적으로 값을 갖고 있음을 확인).

제외 — 다음은 아직 실행하지 않았으므로 다국어 완료 목록에 포함하지 않는다: 하단 마지막 메뉴를 `마이페이지`/`My Page`/`我的页面`로 바꾸는 작업(§23).

---

## 16. 작업 순서 복원(시간순)

1. 기존 `동선` 탭(개인 저장 동선+가게)을 공개 인기 탐색 화면으로 재정의하는 요구 정의, 관련 파일·DB 스키마 조사
2. 공개 동선 동일성 정책을 순서 무시(`route_signature`)에서 순서 기반(`ordered_route_key`)으로 확정
3. Supabase SQL Editor에서 `get_public_course_feed`/`get_public_place_feed`/`get_my_saved_counts`/`toggle_public_course_save` RPC 4종과 `ordered_route_key` 컬럼·trigger·인덱스 수동 생성
4. `publicFeedService.js`, `PublicRoutesTab.jsx`, `PublicPlacesTab.jsx`, `PublicCourseCard.jsx`, `PublicPlaceCard.jsx`, `CourseStopPath.jsx`로 공개 동선·가게 프론트 1차 구현(주소/기준 위치/장소 경로/하트 포함)
5. 기존 `SavedRoutesTab`/`SavedPlacesTab`을 `CoursesPage.jsx`에서 분리해 `SavedRoutesPage.jsx`/`SavedPlacesPage.jsx`(신규 route `/my/saved-routes`, `/my/saved-places`)로 이동, `MyPage.jsx`에 `get_my_saved_counts` 기반 저장 동선/가게 StatCard 추가
6. 공개 동선 카드 1차 UI 개편(순위 1줄 배경, 기준 위치 라벨, N곳/식당/카페 한 줄 배치)
7. 상단 금·은·동 배경 범위를 "순위 한 줄"에서 "상단 정보 영역 전체(제목~N곳/식당/카페~하단 border)"로 재수정
8. 메달 PNG 3종(`public/images/rank/`) 추가 및 두 카드에 반영, Flaticon(Magnific) 저작자 표시를 마이페이지 푸터에 추가
9. 공개 가게 카드에 순위·메달·주소·상세 헤더 문구 개편, 목록 직접 하트 제거
10. 공개 탐색 탭 route를 `/explore`로 분리(`/courses`는 redirect), 페이지 컴포넌트를 `CoursesPage`→`ExplorePage`로 개명, 페이지 제목 `여행자 추천`/`Traveler Picks`/`旅行者推荐` 확정
11. 하단 메뉴명을 `둘러보기`/`Explore`/`发现`로 1차 확정
12. 인기 가게 카드 순위 UI를 동선 카드와 동일한 "상단 별도 섹션" 구조로 통일
13. 하단 메뉴명을 `여행자픽`/`Picks`/`旅行者精选`로 최종 재확정(2차 변경), 인기 가게 4위 이하 배경 제거·border 완화, 공개 목록 최대 150개 제한(`MAX_PUBLIC_FEED_ITEMS`) 도입
14. 공개 동선 카드 하단 저장 표시·공개 가게 통계 행의 코랄 색상을 중립 회색 계열로 최종 정리
15. 지도 음식 필터의 인라인 자동 소멸 경고를 `FoodTypeLimitModal`(중앙 모달)로 교체

다음 항목은 이번 세션에서 실행되지 않았으므로 위 순서에 포함하지 않았다: 마이페이지 카드 세로 간격 통일, 카드 `border-radius` 축소, 두 번째 통계 줄과 로그아웃 버튼 사이 간격 조정, 하단 마지막 메뉴를 `마이페이지`로 바꾸는 작업(§23).

---

## 17. 변경 파일 종합

| 파일 | 신규/수정 | 주요 책임 |
|---|---|---|
| `src/shared/constants/routes.js` | 수정 | `explore`/`mySavedRoutes`/`mySavedPlaces` 라우트 상수 추가, `courses`는 redirect 전용으로 격하 |
| `src/app/router.jsx` | 수정 | `/explore` 라우트 등록, `/courses`→`/explore` redirect, `ExplorePage`/`SavedRoutesPage`/`SavedPlacesPage` import |
| `src/features/navigation/components/BottomNavigation.jsx` | 수정 | 두 번째 탭 `to`/`labelKey`를 `ROUTES.explore`/`nav.explore`로 교체(RouteIcon 유지) |
| `src/pages/ExplorePage.jsx` | 신규 (구 `CoursesPage.jsx` 대체) | 공개 탐색 페이지: 탭(동선/가게)·정렬(인기순/최신순) 상태 관리 |
| `src/pages/CoursesPage.jsx` | 삭제 | `ExplorePage.jsx`로 대체 |
| `src/features/courses/components/PublicRoutesTab.jsx` | 신규 | 공개 동선 feed 조회·페이징·150개 제한·locale batch·하트 토글 |
| `src/features/courses/components/PublicPlacesTab.jsx` | 신규 | 공개 가게 feed 조회·페이징·150개 제한·locale/리뷰 batch |
| `src/features/courses/components/PublicCourseCard.jsx` | 신규 | 공개 동선 카드(순위·메달·기준 위치·경로·저장/상세) |
| `src/features/courses/components/PublicPlaceCard.jsx` | 신규 | 공개 가게 카드(순위·메달·주소·통계) |
| `src/features/courses/components/CourseStopPath.jsx` | 신규 | `PublicCourseCard`/`CourseCard`가 공유하는 1→2→3 장소 경로 그리드 |
| `src/features/courses/services/publicFeedService.js` | 신규 | `get_public_course_feed`/`get_public_place_feed`/`toggle_public_course_save`/`get_my_saved_counts` RPC 래퍼 |
| `src/features/courses/constants/publicFeed.js` | 신규 | `MAX_PUBLIC_FEED_ITEMS = 150` 공유 상수 |
| `src/features/courses/utils/rankDisplay.js` | 신규 | 순위 색상 팔레트(`RANK_BAND_STYLES`)·메달 경로(`RANK_MEDAL_SRC`) 공유 |
| `src/features/courses/services/savedCourseService.js` | 수정 | 중복 판정을 order-sensitive(`ordered_route_key` 정책)로 정리하는 주석·비교 로직 갱신 |
| `src/pages/SavedRoutesPage.jsx` | 신규 | `/my/saved-routes` — 기존 `SavedRoutesTab` wrapper |
| `src/pages/SavedPlacesPage.jsx` | 신규 | `/my/saved-places` — 기존 `SavedPlacesTab` wrapper |
| `src/pages/MyPage.jsx` | 수정 | 저장 동선/가게 StatCard 2개 추가(`get_my_saved_counts`), Flaticon 저작자 링크 추가 |
| `src/pages/PlaceDetailPage.jsx` | 수정 | `PlaceDetailSheet`에 `headerLabel` 전달, `ROUTES.courses`→`ROUTES.explore` |
| `src/pages/CourseDetailPage.jsx` | 수정 | `ROUTES.courses`→`ROUTES.explore`(뒤로가기/notFound) |
| `src/pages/SavedCourseDetailPage.jsx` | 수정 | `ROUTES.courses`→`ROUTES.explore`(뒤로가기/notFound/삭제 후 이동) |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 수정 | 옵트인 `headerLabel` prop 추가(Map 바텀시트 호출부는 영향 없음) |
| `src/features/explore/components/FilterSheet.jsx` | 수정 | 인라인 `catLimit` 토스트 제거, `FoodTypeLimitModal` 연결 |
| `src/features/explore/components/FoodTypeLimitModal.jsx` | 신규 | 음식 종류 최대 3개 선택 시 중앙 안내 모달 |
| `src/shared/i18n/dictionary.js` | 수정 | `nav.explore`, `explore.*`, `filter.catLimitTitle`/`.catLimitConfirm`, `placeDetail.pageHeaderLabel`, `my.medalAttribution`, `publicFeed.emptyRoutes`/`.emptyPlaces` 등 |
| `public/images/rank/medal-gold.png`·`medal-silver.png`·`medal-bronze.png` | 신규(사용자 제공) | 1~3위 메달 이미지 |
| `docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md` | 신규 | 이 문서 |

`src/features/courses/components/SavedRoutesTab.jsx`/`SavedPlacesTab.jsx`, `src/features/courses/hooks/useSavedCourses.jsx`, `src/features/places/services/placeBookmarkService.js`/`placeReviewService.js`, `src/api/placeApi.js`, `src/features/profile/components/StatCard.jsx`, `src/features/community/services/communityService.js`, `package.json` — 이번 세션에서 **전혀 수정하지 않았다**(내부 로직 재사용/호출만 확인). `LanguageModal.jsx`/`exploreOptions.js`/`JapaneseComingSoonModal.jsx`(일본어 안내 관련, 이번 세션과 무관한 기존 미커밋 변경)도 이번 세션에서 건드리지 않았다.

---

## 18. DB 변경 종합(Supabase, 수동 적용 — git diff에 나타나지 않음)

| 항목 | 목적 | 보안 모드 | 호출 주체 | 반환/변경 정보 | 기존 구조와의 차이 |
|---|---|---|---|---|---|
| `mg_saved_courses.ordered_route_key` 컬럼 | 순서를 보존한 동일성 키(`10-20-30`) | — | 프론트가 직접 쓰지 않음(trigger가 생성) | — | 기존 `route_signature`(정렬, 순서 무시)와 달리 순서를 그대로 보존 |
| insert/update trigger | `place_ids`로부터 `ordered_route_key` 자동 생성 | — | DB 내부 | — | 신규 |
| 순서 무시 유니크 인덱스 제거 | `uq_mg_saved_courses_user_route_signature_active` 제거 | — | — | — | A→B→C와 C→B→A를 더 이상 같은 동선으로 막지 않음 |
| 사용자별 `ordered_route_key` 활성 행 유니크 인덱스 | 순서 기반 중복 저장 방지 | — | `saveCourse()`의 INSERT가 위반 시 `23505` | `DuplicateCourseError` | 신규(순서 기반) |
| 공개 집계용 인덱스 | `ordered_route_key` 기준 그룹핑 성능 | — | `get_public_course_feed` | — | 신규 |
| `get_public_course_feed(p_sort, p_limit, p_offset)` | 공개 동선 랭킹/최신 피드 | SECURITY DEFINER | 비로그인 포함 누구나(limit 5/50 차등) | 익명화된 대표 동선 + `save_count`/`is_saved`/`my_saved_course_id`/`total_count` | 신규 — 기존에는 다른 사용자 저장 동선을 볼 방법 자체가 없었음 |
| `get_public_place_feed(p_sort, p_limit, p_offset)` | 공개 가게 랭킹/최신 피드 | SECURITY DEFINER | 비로그인 포함 누구나(limit 5/50 차등) | `place_id`, `save_count`, `latest_saved_at`, `is_saved`, `total_count` | 신규 |
| `get_my_saved_counts()` | 마이페이지 저장 동선/가게 개수 | 본인 데이터 | 로그인 사용자 | `saved_course_count`, `saved_place_count` | 신규 |
| `toggle_public_course_save(p_public_route_key)` | 공개 동선 하트 = 개인 저장 토글 | 인증 필요 | 로그인 사용자 | `is_saved`, `save_count`, `my_saved_course_id` | 신규 — "좋아요"와 "내 저장 목록 추가"를 하나의 원자적 동작으로 통합 |

이 표의 각 항목은 이번 대화에서 사용자가 확정 사실로 제공한 작업 맥락과, 현재 애플리케이션 코드(§4의 실제 RPC 호출부·주석)로 교차 확인된 내용이다. 실제 SQL 정의문 전체는 이 문서에 옮기지 않았다.

---

## 19. 성능 및 N+1 검증

**공개 동선 한 페이지**:
- `get_public_course_feed` RPC 1회
- 화면에 있는 모든 row의 전체 stop id를 모은 `getPlacesByIds` batch 1회(`PublicRoutesTab.jsx`의 단일 `useEffect`)
- 코스별/스톱별 반복 조회 없음

**공개 가게 한 페이지**:
- `get_public_place_feed` RPC 1회
- `getPlacesByIds` batch 1회 + `fetchPlaceReviewStatsBatch` batch 1회(`Promise.all`로 동시 실행)
- 장소별 반복 조회 없음

**마이페이지**:
- `fetchMyActivityCounts(user.id)`(커뮤니티 글/좋아요)와 `get_my_saved_counts()`가 서로 독립된 `useCallback`/`useEffect`로 각각 1회씩 호출 — 한쪽 실패가 다른 쪽 숫자에 영향을 주지 않는다.

**저장 목록(`/my/saved-routes`, `/my/saved-places`)**:
- 기존 `SavedRoutesTab`의 전체 스톱 id batch `getPlacesByIds`(단일 useEffect), `SavedPlacesTab`의 `fetchSavedPlaces` + `fetchPlaceReviewStatsBatch` 패턴을 그대로 유지 — 이번 세션에서 이 두 파일의 조회 방식 자체는 수정하지 않았다.

**150개 제한(§7)**:
- 더 보기는 항상 페이지 단위(`LOGGED_IN_PAGE_SIZE = 10`, 마지막 페이지만 `Math.min(10, remaining)`)로 요청되며, 단일 RPC 호출이 서버 상한(50)을 넘긴 적이 없다(실제 요청 limit이 항상 10 이하이므로 구조적으로 불가능).
- 누적 최대 150개, `effectiveTotal = Math.min(total_count, 150)` 기준 `hasMore` 계산.

---

## 20. 보안 및 개인정보

- 공개 목록(`get_public_course_feed`/`get_public_place_feed`) 어디에도 다른 사용자의 `user_id`, 닉네임, 저장 row id가 포함되지 않는다 — 프론트 렌더링 코드(`PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`/`PublicCourseCard.jsx`/`PublicPlaceCard.jsx`)에도 그런 필드를 표시하는 부분이 없다.
- 두 조회 RPC는 SECURITY DEFINER로 동작해야 다른 사용자 행을 안전하게 집계할 수 있다 — 대신 반환 컬럼 자체를 최소화(집계값·현재 사용자 본인 여부만)해서 정보 노출을 막는다.
- 기존 RLS 정책은 이번 세션에서 수정하지 않았다.
- 프론트는 공개 데이터를 얻을 때 `mg_saved_courses`/`mg_place_bookmarks`를 직접 select하지 않고 항상 RPC를 거친다. 본인 데이터(저장 목록/마이페이지)는 기존처럼 `user_id` 필터가 걸린 직접 조회를 그대로 사용한다 — 이 구분은 이번 세션 내내 유지됐다.
- 공개 동선 하트(`toggle_public_course_save`)는 인증된 사용자만 호출 가능 — 비로그인은 프론트 단계에서 RPC 호출 자체를 막고 로그인 안내로 대체한다.
- 비로그인 최대 5개 제한은 프론트(`GUEST_LIMIT`)와 RPC(서버 측 강제) **양쪽에** 걸려 있다 — 프론트 로직만으로는 우회할 수 없는 이중 방어.
- 가게 저장(`mg_place_bookmarks`)은 기존처럼 `(place_id, user_id)` 기준 개인별 PK/유니크 구조를 그대로 사용 — 이번 세션에서 이 테이블의 구조는 변경하지 않았다.

---

## 21. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build`(최종) | 성공, 222 modules transformed, 기존 CSS 압축 경고 1건(`Expected identifier but found "-"`, 신규 오류 아님) 외 없음 |
| `git diff --check`(최종) | 통과 — CRLF 안내만 존재, 실제 whitespace 오류 없음 |
| DB/SQL 추가 수정 여부(이 문서 작성 세션 자체) | 없음 — §4/§18의 DB 변경은 이 문서 작성 이전 세션 중 수동 적용된 기존 사실이며, 이 문서 작성 과정에서 추가로 SQL을 실행하지 않았다 |
| `package.json` 수정 여부 | 없음(`git diff --stat package.json` 결과 없음) |
| 다른 worktree(`sprightly-pondering-owl`) 수정 여부 | 없음 — 매 단계 `git worktree list`로 확인, 읽기 비교 외 접근 없음 |
| N+1 여부 | §19 기준 없음(공개 동선/가게/마이페이지/저장 목록 모두 페이지당 고정 횟수의 batch 조회) |
| `dist/images/rank/` 메달 3종 정상 복사 | 예(빌드 결과로 확인) |
| `medal-gold.png`/`medal-silver.png`/`medal-bronze.png` dev 서버 200 응답 | 예(`curl` 확인) |
| 브라우저 직접 검증 | **부분 미검증** — 이 환경에는 브라우저 자동화 도구가 없어(패키지 설치 금지), dev 서버(`http://localhost:5173/`)에 대한 `curl` 기반 라우트/이미지 200 확인만 수행했다. 여행자픽 1~4위/최신순 실제 렌더링 색상, 필터 제한 모달의 실제 overlay/Escape 동작, ko/en/zh-CN 실제 화면 폭, 150개 더 보기의 실제 클릭 흐름은 **실기기·브라우저로 확인하지 못했다** |

브라우저 상 실제 확인이 필요하다고 사용자가 이전에 언급한 항목(예: 화면 캡처로 확인한 사항)은 **코드 기준으로는 반영을 확인**했으나, 이 문서 작성 시점 기준 실제 브라우저 조작을 통한 재확인은 별도로 수행하지 않았다 — "성공"이 아니라 "코드상 반영 확인, 실기기 미검증"으로 구분해 적는다.

---

## 22. git 상태(이 문서 작성 시점 기준)

- current branch: `main`
- 실제 실행 워크트리: `C:/Workspace/GitWorkspace/matgil`(다른 worktree `sprightly-pondering-owl`은 이번 세션 전체에서 한 번도 수정하지 않음, `git worktree list`로 재확인)
- HEAD: `2dffa27`(`feat: 라이브 동선 제목 로케일 처리 개편 및 Saved Routes UI/다국어 일관성 확보`, docs/56과 함께 커밋된 상태)
- 이 문서 작성 시점까지 `2dffa27` 이후 `git add`/`commit`/`push` 없음 — 아래 전 작업이 워킹 디렉터리에 미커밋 상태
- 변경 파일: 수정(M) 16개, 삭제(D) 1개(`src/pages/CoursesPage.jsx`), 신규(untracked) 다수 — `git status --short` 기준 M 16 / D 1 / `??` 항목 15줄(디렉터리 표기 `.claude/worktrees/`, `public/`, `src/features/courses/constants/` 3개 포함, 실제 개별 신규 파일은 §17 표 참고)
- `.claude/worktrees/`가 untracked로 잡히는 것은 이 저장소의 기존 worktree 구성 방식이며, 이번 세션에서 그 하위 파일을 생성/수정한 적은 없다
- 워킹 디렉터리에는 이번 작업과 **무관한** 기존 미커밋 변경(일본어 "준비 중" 안내 관련 `LanguageModal.jsx`/`exploreOptions.js`/`JapaneseComingSoonModal.jsx` + `HomePage.jsx`/`MyPage.jsx`의 관련 일부)이 docs/56 때와 마찬가지로 계속 함께 있다 — 이번 세션에서도 전혀 건드리지 않았다
- 이 문서 작성을 포함해 이번 세션 전체에서 `git add`/`commit`/`push`를 수행하지 않았다(사용자가 별도로 요청하지 않는 한 수행하지 않는다는 지침을 따름)

---

## 23. 후속 과제

**§21의 미검증 항목**
- 여행자픽 동선/가게 카드의 1~4위·최신순 실제 렌더링 색상 확인
- 필터 제한 모달의 실제 overlay 클릭/Escape/포커스 복귀 동작 확인
- ko/en/zh-CN 실제 화면 폭에서의 줄바꿈·말줄임 확인
- 150개 상한의 마지막 페이지 offset/dedupe 실제 동작(대량 데이터 환경) 확인
- 실제 다중 사용자 환경에서 `save_count` 증가/감소가 기대대로 집계되는지 확인
- 로그인/비로그인 상태에서 5개·150개 더 보기 경계값 실기기 확인
- OAuth 로그인 후 `/explore` 복귀 실기기 확인
- 메달 이미지의 실제 배포(base path) 환경 404 여부 확인

**설계상 보류한 항목**
- 음식 취향 필터별 공개 동선 조회/정렬 — 같은 장소 순서의 동선이 서로 다른 취향 필터로 저장될 수 있어, "몇 명이 저장했는가"라는 집계 의미가 취향별로 나뉘면 충돌할 수 있다고 판단해 이번 범위에서 제외했다(§3)
- `NearbySheet.jsx`의 `route_signature` 관련 주석이 아직 옛 설명(§4.2)을 그대로 남기고 있는 부분 정리
- 이 작업일지 이후 `git add`/`commit`/`push` 여부 결정(사용자 별도 지시 필요)

**아직 실행하지 않은 마이페이지 UI 작업 — 완료 목록에 포함하지 않고 여기에만 기재**
- 마이페이지 계정 카드와 통계 카드(활동/언어, 저장 동선/가게) 줄 사이 간격 통일
- 첫 번째 통계 줄과 두 번째 통계 줄 사이 간격 통일
- 두 번째 통계 줄과 로그아웃 버튼 사이 간격 통일
- 마이페이지 카드(`StatCard`/`Card`)의 `border-radius`를 현재보다 한 단계 덜 둥글게 조정
- 하단 마지막 메뉴(현재 `nav.you`: 내 정보/You/我的) 라벨을 ko `마이페이지` / en `My Page` / zh-CN `我的页面`로 변경

위 5개 항목은 이번 세션에서 코드·dictionary 어디에도 반영되지 않았음을 §12.2, §11.3에서 각각 확인했다 — 실행 전 상태 그대로이며, 다음 세션에서 착수해야 할 후속 작업이다.
