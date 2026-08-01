# 67. 커뮤니티 게시글 목록 5개 단위 페이지네이션·무한 스크롤 및 당겨서 새로고침 추가

## 1. 작업 일시

- 작성일시: 2026-08-01 PM 10:05 (KST)
- `git rev-parse HEAD` = `cd217f2d1c2df69f7afd7079668798af63257f82`(`fix: 커뮤니티 게시글 목록 줄바꿈 유지 및 본문 5줄 미리보기·더보기 추가`) — 이번 문서가 다루는 변경은 이 커밋 위의 **미커밋 working tree 변경**이다(Git 확인, `git status --short`).

---

## 2. 기준 문서·기준 커밋·조사 범위

- 기준 문서: `docs/66-social-share-open-graph-metadata-and-og-image.md`
- `docs/66`이 포함된 커밋: `c732bf7`(`feat: 소셜 공유용 Open Graph·Twitter 카드 메타데이터 및 대표 이미지 추가`) — Git 확인(`git log --oneline --all -- "docs/66*"`).
- **`docs/66` 이후 중간 커밋 1개 발견(Git 확인)**: `cd217f2`(`fix: 커뮤니티 게시글 목록 줄바꿈 유지 및 본문 5줄 미리보기·더보기 추가`) — `c732bf7` 바로 다음 커밋이자 현재 `HEAD`. `git show cd217f2 --stat` 기준 `src/features/community/components/PostCard.jsx`(47줄 변경)와 `src/shared/i18n/dictionary.js`(6줄 추가) 2개 파일만 포함하며, 이번에 조사할 커뮤니티 후보 항목 중 **줄바꿈 유지·5줄 미리보기·더보기/접기**가 이미 이 커밋으로 커밋·푸시되어 있다.
- `git log origin/main..HEAD`와 `git log HEAD..origin/main`이 모두 빈 결과 — 조사 시작 시점 로컬 `HEAD`와 `origin/main`이 정확히 일치한다(Git 확인).
- 조사 범위: `cd217f2` 이후 **커밋 없이** working tree에 쌓인 모든 변경.
- 조사 시점 저장소 상태(Git 확인):
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`, upstream: `origin/main`
  - `git status --short`: 수정(M) 6개, untracked(??) 2개(신규 파일 2개)
  - `git diff --cached --name-status`: 비어 있음 — staged 파일 없음.
- docs 디렉터리 확인 결과 `docs/66-...md`가 가장 큰 번호이며 `docs/67` 이상은 아직 존재하지 않는다(Git/파일 확인) — 이번 문서 번호는 67.

이번 문서는 `cd217f2` 이후 미커밋 상태로 남아 있던 **게시글 목록의 5개 단위 서버 페이지네이션·무한 스크롤·카테고리 서버 필터·정렬·당겨서 새로고침** 작업을 다룬다. 줄바꿈 유지·5줄 미리보기·더보기/접기는 이미 `cd217f2`로 커밋·푸시된 상태이며, 이번 조사에서는 그 사실만 재확인하고 새 커밋 대상에 포함하지 않는다.

---

## 3. 작업 배경

- **대화상 요청**: 커뮤니티 게시글을 한 번에 전부 불러오지 말고 5개 단위로 조회하고, 스크롤 시 다음 5개를 이어 붙이는 무한 스크롤을 구현할 것.
- **대화상 요청**: 카테고리 필터가 클라이언트에서 이미 불러온 목록을 걸러내는 방식이 아니라, 조회 요청 자체에 카테고리 조건을 실어 서버에서 필터링할 것.
- **대화상 요청**: 목록 최상단에서 아래로 당기면 현재 카테고리·정렬 조건의 첫 페이지를 다시 조회하는 pull-to-refresh를 구현할 것. 이후 대화에서 여러 차례 시행착오가 있었다 — pull 시작 조건(스크롤 위치 판정 방식), 인디케이터 디자인(이중 화살표·빨간 테두리 제거), 최소 표시 시간, 인디케이터 상하 여백, 글쓰기 버튼 상하 여백을 반복적으로 재조정했다(대화상 요청, 코드로 최종 상태만 확인 가능).
- **대화상 요청**: 기존 줄바꿈 보존·5줄 미리보기·더보기/접기 기능은 유지할 것 — 이 항목은 §2에서 확인한 대로 이미 `cd217f2`로 커밋되어 있다.

---

## 4. 게시글 줄바꿈 유지

- **코드 확인, 이미 `cd217f2`로 커밋됨**: `PostCard.jsx`의 본문 `<p>`에 `whitespace-pre-wrap` 클래스 적용(`PostCard.jsx:119`). 작성/수정 쪽(`PostComposer.jsx`, `communityService.js`)은 `content.trim()` 외에 개행을 제거하는 로직이 없어 DB에는 원본 개행이 그대로 저장된다.

---

## 5. 5줄 미리보기와 더보기·접기

- **코드 확인, 이미 `cd217f2`로 커밋됨**: 본문에 `line-clamp-5`를 기본 적용하고, `useLayoutEffect`로 `bodyRef.current.scrollHeight > clientHeight+1`을 측정해 `bodyOverflowing`을 계산한다(`PostCard.jsx:39-43`). 더보기/접기 버튼은 `bodyOverflowing`이 true일 때만 렌더링되어(`PostCard.jsx:131-139`), 5줄을 넘지 않는 짧은 글에는 표시되지 않는다. 클릭 시 `bodyExpanded` 상태를 토글해 `line-clamp-5` 클래스 유무를 전환한다.
- 다국어 키 `community.showMore`/`community.showLess`가 en/ko/zh-CN에 존재(코드 확인).

---

## 6. 5개 단위 페이지네이션과 무한 스크롤

- **코드 확인, 현재 미커밋**: `communityService.js`의 `fetchPosts({ popular, category, limit=5, offset=0 })`가 `.range(offset, offset+limit-1)`로 offset 기반 페이지네이션을 수행한다.
- `CommunityPage.jsx`의 `loadFirstPage()`가 필터 변경·마운트·글 작성/수정/삭제 후 offset 0부터 `PAGE_SIZE=5`개를 다시 조회하고, `handleLoadMore()`가 `offsetRef.current` 기준 다음 5개를 조회해 기존 배열 뒤에 append한다.
- 무한 스크롤은 `IntersectionObserver`(콜백-ref-as-state 패턴의 `sentinelNode`)로 구현되어 있으며, `root: null`(뷰포트 기준)로 AppLayout의 `<main overflow-y-auto>`를 스크롤 컨테이너로 삼는다.
- 중복 요청 방지: `fetchingRef`(동시 요청 차단)와 `refreshingRef`(당겨서 새로고침 중이면 다음 페이지 요청 차단)를 관찰자 콜백과 `handleLoadMore()` 양쪽에서 확인한다.
- 게시글 ID 중복 제거: `handleLoadMore()`에서 `seen = new Set(prev.map(p=>p.id))`로 이미 있는 ID를 제외하고 append한다.
- 카테고리·정렬 변경 시 초기화: `loadFirstPage`가 `[isPopular, category]`에 의존하는 `useCallback`이라 필터가 바뀌면 새로 생성되고, 이를 의존성으로 하는 `useEffect(() => loadFirstPage(), [loadFirstPage])`가 재실행되어 `offset`/`hasMore`/`dbPosts`를 초기화한 뒤 새 조건으로 첫 페이지를 다시 조회한다.

---

## 7. 서버 기반 카테고리 필터

- **코드 확인**: 이전에는 `fetchPosts()`가 카테고리 구분 없이 전체를 조회하고 `filterPosts()`가 클라이언트에서 걸렀다(`cd217f2` 이전 상태, `git diff`로 확인). 현재는 `fetchPosts()`가 `category` 인자를 받아 `if (category) query = query.eq('category', category)`로 서버 쿼리 자체에 조건을 싣는다.
- `CommunityPage.jsx`는 `category = filter==='all'||filter==='popular' ? null : filter`로 계산해, "전체"와 "인기" 탭만 카테고리 조건 없이 전체를 대상으로 하고 나머지 6개 탭(질문/후기/팁/음식/동선/일반)은 서버에서 해당 카테고리로 필터링한다.
- 카테고리 변경 시 해당 카테고리의 첫 5개부터 다시 조회되는 것은 §6에서 확인한 `loadFirstPage` 재실행 메커니즘과 동일하다.

---

## 8. 최신순·인기순 정렬

**코드 확인**(`communityService.js`의 `fetchPosts()` 실제 `.order()` 호출 기준, 사용자가 제시한 후보와 비교):

| 정렬 | 후보로 제시된 기준 | 실제 코드 기준 | 일치 여부 |
|---|---|---|---|
| 최신순(`popular=false`) | created_at 내림차순, 동일 시 id 내림차순 | `.order('created_at', {ascending:false}).order('id', {ascending:false})` | 정확히 일치 |
| 인기순(`popular=true`) | like_count 내림차순, comment_count 내림차순, created_at 오름차순, id 내림차순 | `.order('like_count',{ascending:false}).order('comment_count',{ascending:false}).order('created_at',{ascending:true}).order('id',{ascending:false})` | 정확히 일치 |

- 커뮤니티 화면에는 Traveler Picks의 "인기/최신" 같은 별도 정렬 토글이 없다(코드 확인, `CommunityTabs.jsx`/`COMMUNITY_FILTERS`) — "인기" 자체가 8개 탭(전체/인기/질문/후기/팁/음식/동선/일반) 중 하나이며, 이 탭을 선택하는 것이 곧 "정렬 변경"이다. 별도의 정렬 컨트롤은 존재하지 않는다.
- `id DESC`는 기존 정렬 기준을 대체한 것이 아니라 맨 뒤에 추가된 동률 처리용 보조 기준이다(코드 확인, diff상 기존 `.order()` 호출은 그대로 두고 한 줄만 추가됨).

---

## 9. 중복 제거와 비동기 요청 순서 보호

- 게시글 ID 중복 제거: §6에서 확인한 `seen` Set 기반 필터링.
- 요청 순서 보호: `postsRequestSeqRef`(코드 확인) — `loadFirstPage()`가 실행될 때마다 값을 증가시키고, `handleLoadMore()`/`refreshFirstPage()`의 응답 처리부에서 `postsRequestSeqRef.current !== mySeq`이면 응답을 무시한다. 필터를 빠르게 전환해도 이전 조건의 늦은 응답이 새 조건의 목록을 덮어쓰지 못하도록 하는 구조다.
- 장소 정보 배치 조회에도 별도의 `placesRequestSeqRef`가 동일한 방식으로 적용되어 있다(코드 확인).
- 좋아요·댓글 수는 `loadFirstPage()`(페이지 초기화)를 다시 부르지 않고 `handleLike()`/`handleCommentAdded()`가 이미 로드된 `dbPosts` 배열의 해당 항목만 낙관적으로 갱신한다(코드 확인) — 좋아요/댓글 등록이 무한 스크롤 위치를 페이지 1로 되돌리지 않는다.

---

## 10. 마지막 게시글 안내

- **코드 확인**: `showReachedEnd = dbPosts !== null && dbPosts.length > 0 && !hasMore && !loadingMore && !loadMoreError`일 때만 좌우 구분선과 함께 `community.reachedEnd` 문구(en: "You've seen all posts.", ko: "모든 게시글을 확인했어요.", zh-CN: "已查看全部帖子。")를 표시한다. mock 플레이스홀더(`dbPosts`가 `null`이거나 실제 0건) 상태에서는 표시되지 않는다.

---

## 11. 당겨서 새로고침

**코드 확인**(`src/features/community/hooks/usePullToRefresh.js`, 신규 파일):

- 시작 조건: `main.scrollTop`과 `feedTopScrollRef.current`(현재 필터의 첫 페이지가 로드된 직후 `CommunityPage.jsx`가 0으로 기록)의 차이가 4px(`SCROLL_TOP_TOLERANCE`) 이내일 때만 `canArmPull()`이 통과된다. 목록 중간·하단, 카테고리 탭 가로 스크롤 중, 인터랙티브 요소(`button, a, input, textarea, select, [role="button"], [data-no-pull-refresh]`) 위에서 시작한 터치는 차단된다.
- 새로고침 실행: 임계값(`PULL_THRESHOLD=46px`) 이상 당긴 뒤 놓으면 `refreshFirstPage()`(`CommunityPage.jsx`)가 현재 `isPopular`/`category`를 그대로 사용해 offset 0부터 5개를 재조회한다. 필터 자체는 변경하지 않는다.
- 최소 표시 시간: `MIN_REFRESH_DISPLAY_MS=600`, `runRefresh()`에서 `now()`로 시작 시각을 기록해 `Math.max(0, 600 - 경과시간)`만큼 추가 대기한 뒤에만 `returning`으로 전환한다(코드 확인).
- 반복 새로고침: `refreshTokenRef`로 매 새로고침 시도를 구분하고, 모든 종료 경로(성공/실패/touchcancel/pointercancel/필터변경/모달열림/unmount)가 `resetPullState()` 또는 동등한 초기화 로직을 거쳐 `phase`를 `idle`로 되돌린다(코드 확인).
- 인디케이터 디자인(`src/features/community/components/PullToRefreshIndicator.jsx`, 신규 파일): 흰색 원형 배지(`bg-white`, 그림자) + 내부에 `RotateCwIcon`(단일 화살표, `Icon.jsx`에 신규 추가, 코랄 `text-coral` 고정) 1개. 회전은 배지 안쪽 별도 wrapper에만 적용되어 배지 자체는 회전하지 않는다. 이전에 있었던 코랄 링 accent(빨간 원형 테두리로 보였던 요소)는 현재 코드에 없다(코드 확인, `border-coral`/`border-t-coral` 검색 결과 0건).
- 인디케이터 슬롯 높이는 `pullDistance + 14px`(`FEED_CONTENT_TOP_PADDING_PX`, `CommunityPage.jsx`의 목록 `pt-3.5`와 동일한 값)로 계산되어, 카테고리 탭 하단과 첫 카드 상단 사이에서 인디케이터가 flexbox로 정중앙에 위치하도록 되어 있다(코드 확인, 수식으로 대수적 검증 — 실제 브라우저 측정은 이 환경에서 수행 불가).
- 브라우저 기본 새로고침 방지: `touchmove`를 `{passive:false}`로 직접 등록하고, 아래 방향 pull이 확정된 뒤에만 `preventDefault()`를 호출한다. `matgil-community-scroll` 클래스(`overscroll-behavior-y: contain`)를 `CommunityPage` 마운트 중에만 `<main>`에 추가하고 unmount 시 제거한다(코드 확인, `usePullToRefresh.js`의 effect cleanup).

---

## 12. 새로고침 표시 UI 조정

- **코드 확인, 최종 상태만 기록**: 인디케이터 배지 크기 36px, 내부 회전 wrapper 30px, 화살표 16px. 회전 애니메이션은 `animate-spin-slow`(index.css, 0.9초/1회전, 기존에도 있던 클래스 재사용) 재사용.
- 이 간격·디자인은 대화 도중 여러 차례 재조정되었다(대화상 확인 — 독립 CTA 카드 → 스켈레톤형 → 단일 원형 배지, 링 accent 추가 후 제거, 슬롯 높이 계산 방식 변경 등). **이번 문서는 최종적으로 working tree에 남아 있는 코드 상태만을 사실로 기록하며, 중간 과정의 각 시도가 실제로 사용자 화면에서 의도대로 보였는지는 확인되지 않는다.**
- 글쓰기 버튼 하단 간격: `WRITE_BUTTON_BOTTOM = calc(var(--matgil-bottom-nav-h, 3.5rem) + 0.75rem)`, 목록 하단 padding `FEED_CONTENT_PB = calc(0.75rem*2 + 3rem)`(`CommunityPage.jsx`). `--matgil-bottom-nav-h`는 `AppLayout.jsx`가 `ResizeObserver`로 하단 내비게이션의 실제 렌더 높이를 측정해 `document.documentElement`에 기록하는 CSS 변수다(코드 확인). 두 수식 모두 `safe-area-inset-bottom`을 더하지 않는다 — `BottomNavigation.jsx` 자체가 safe-area를 반영하지 않는 것으로 확인되어(코드 확인), 중복 적용을 피하기 위해 의도적으로 제외했다.
- **실제 화면에서 두 간격이 시각적으로 동일하게 보이는지는 이 환경에 브라우저 실행 도구가 없어 확인하지 못했다** — 수식상 대수적으로는 두 간격이 모두 0.75rem(12px)으로 유도된다(코드 확인, 계산 검증).
