# 59. 저장한 표현·내가 쓴 글 개선, OG 메타데이터, 커뮤니티 가게 위치 연결

## 1. 작업 일시

- 작성일시: 2026-07-26 22:52 KST

---

## 2. 기준 커밋과 작업 범위

- 기준 커밋: `527b001` (`feat: 마이페이지 UI 재개편, 라이브 동선 제목 우선순위 개선, 여행자픽 가게명 색상 통일`) — `docs/58-my-page-redesign-filter-limit-modal-and-live-route-title-refinement.md`가 이 커밋에 포함되어 있다.
- `git log --oneline --all -- docs/58-*.md` 결과 `docs/58`을 포함한 커밋은 `527b001` 하나뿐이다.
- 이 문서 작성 시점 `git log --oneline -1` 역시 여전히 `527b001`이다. 즉 `docs/58` 이후 **새로 생성된 커밋은 하나도 없고**, 이번 문서가 다루는 모든 작업은 전부 워킹 디렉터리에 미커밋 상태로 쌓여 있던 변경이다(§13 SQL 제외).
- 작업 범위 판별은 `git status --short`, `git diff`(파일별), `docs/58` 본문(§3 "이번 문서에서 제외한 항목", §11 "후속 과제")을 대조해 확정했다. `docs/58`이 스스로 "제외" 또는 "별도 검토·커밋 필요"라고 명시한 항목만 이번 범위 후보로 삼았고, 그중에서도 실제로 `docs/58` 시점 이후 새로 생긴 diff인지를 파일 단위로 재확인했다.

---

## 3. 작업 배경

`docs/58`은 마이페이지 재개편·라이브 동선 제목 정책·여행자픽 가게명 색상 통일을 다루면서, 같은 워킹 디렉터리에 섞여 있던 두 갈래의 미완성 작업을 의도적으로 문서 범위에서 제외했다.

1. 저장한 표현(Saved Phrases) 페이지 + 내가 쓴 글 카테고리 표시 — "현재 진행 중"이라 완료로 기록하지 않음.
2. 커뮤니티 글에 가게 위치 추가 — "아직 조사조차 시작하지 않은 기능".

이번 문서는 그 두 작업이 이어지는 세션(들)에서 마무리된 결과와, 그 사이 추가로 확정된 OG/Twitter 메타데이터 작업을 정리한다. 세 작업 모두 `docs/58` 작성 시점 이후 코드가 실제로 바뀐 부분만 다루며, `docs/58`이 이미 완료로 기록한 마이페이지 재개편 본체·라이브 동선 제목 정책·여행자픽 가게명 색상은 반복 설명하지 않는다.

이 저장소에는 Git worktree가 둘 이상 존재한다(`C:/Workspace/GitWorkspace/matgil`(main), `.claude/worktrees/sprightly-pondering-owl`). 이번 문서에 실린 모든 작업 전·후로 `git rev-parse --show-toplevel`/`git branch --show-current`/`git worktree list`/`git status --short`로 실제 실행 워크트리(main)를 재확인했고, `.claude/worktrees` 하위 파일은 읽기 비교 외에는 전혀 수정하지 않았다.

---

## 4. 이번 문서에서 제외한 항목

`git status --short`로 확인한 현재 워킹 디렉터리 변경 중 아래 항목은 이번 문서·이번 커밋 범위에 **포함하지 않는다.**

- **일본어("준비 중") 안내 관련 변경** — `src/features/explore/components/LanguageModal.jsx`, `src/features/explore/data/exploreOptions.js`(`COMING_SOON_LANGUAGES` 추가), `src/features/explore/components/JapaneseComingSoonModal.jsx`(신규), 그리고 `src/pages/HomePage.jsx`의 diff 전체. `docs/58` §11이 이미 "이번 구간과 무관하므로 별도로 검토·커밋 필요"라고 명시한 바로 그 변경이며, 이번 사용자 요청(§2.1~§2.9)에도 전혀 언급되지 않아 범위 밖으로 판단했다. 이 4개 파일은 스테이징하지 않았다.
- **`src/pages/MyPage.jsx`의 일본어 안내 연동 부분만** — 이 파일은 이번 문서가 다루는 "나의 표현" 섹션 추가와, 위 일본어 안내 기능이 **한 파일 안에 함께 섞여** 있다. `JapaneseComingSoonModal` import, `jaComingSoonOpen` state, `LanguageModal`에 넘기는 `onComingSoonSelect` prop, `<JapaneseComingSoonModal .../>` 렌더 — 이 4곳은 위와 같은 이유로 이번 커밋에서 제외했다. 커밋에는 "나의 표현" `MySection` 추가 부분만 반영하고, 일본어 안내 연동 부분은 워킹 디렉터리에 미커밋 상태로 그대로 남겨 두었다(별도 검토 후 커밋 필요 — §20).
- **Phrases 스피커 버튼 크기, Community 하트·댓글 간격** — 사용자 요청 §2.4가 조사를 요청한 항목이라 실제로 확인했다. 결과: `src/features/phrases/components/PhraseCard.jsx`는 `git status`상 무변경이고(스피커 버튼 로직·크기 그대로), `PostCard.jsx`의 좋아요/댓글 footer `gap-3`는 `git show HEAD:...`로 확인한 결과 **`docs/58` 커밋(`527b001`) 시점에 이미 존재하는 값**이었다 — 이번 미커밋 diff에 그 부분에 대한 변경이 전혀 없다. 즉 두 항목 모두 이미 이전에 커밋된 상태이며, 이번 구간에서 새로 바뀐 것이 없어 억지로 문서화하지 않는다.
- **지도 음식 필터 최대 3개 선택 안내 모달** — `docs/57`/`docs/58`에서 이미 문서화됐고 이번 구간에서도 diff가 없다(계속 무변경).

---

## 5. 저장한 표현 페이지 및 마이페이지 연결

### 5.1 문제

`docs/58` 시점에는 사용자가 Phrases 탭에서 저장(북마크)한 표현을 모아 보는 화면이 없었다. 마이페이지의 "나의 여행"(저장한 동선/가게) 옆에 대응하는 "나의 표현" 섹션도 없었다.

### 5.2 변경 후 — 신규 라우트/페이지

- `src/shared/constants/routes.js`: `mySavedPhrases: '/my/saved-phrases'` 추가(기존 `mySavedRoutes`/`mySavedPlaces`와 같은 패턴).
- `src/app/router.jsx`: `SavedPhrasesPage` import 추가, `AppLayout` 라우트 그룹 안에 `<Route path={ROUTES.mySavedPhrases} element={<SavedPhrasesPage />} />`를 `SavedPlacesPage` 라우트 바로 아래에 추가.
- `src/pages/SavedPhrasesPage.jsx`(신규) — `SavedRoutesPage`/`SavedPlacesPage`와 동일한 뼈대(로그인 안 됐으면 `ROUTES.login`으로 리다이렉트, 뒤로가기 버튼, `PageHeader`)를 따르고, 본문은 `SavedPhrasesTab`에 위임한다.
- `src/features/phrases/components/SavedPhrasesTab.jsx`(신규) — 목록 UI 본체.
- `src/pages/MyPage.jsx` — "나의 여행" `MySection` 바로 아래에 "나의 표현" `MySection`을 추가(§4에서 밝힌 대로 일본어 안내 관련 hunk는 이번 커밋에서 제외):

```jsx
<MySection title={t('my.phrasesSection')}>
  <MyRow
    label={t('savedPhrases.title')}
    onClick={() => navigate(ROUTES.mySavedPhrases)}
  />
</MySection>
```

### 5.3 데이터 흐름 — 배치 조회, N+1 없음

`SavedPhrasesTab`은 기존 `PhraseCard`/`PhraseCategoryTabs`를 그대로 재사용하고(새 카드 컴포넌트를 만들지 않음), 데이터만 다음 두 신규 함수로 가져온다.

- `src/features/phrases/services/phraseBookmarkService.js`에 `fetchMyPhraseBookmarksDetailed(userId)` 추가 — 기존 `fetchMyPhraseBookmarks()`(id만 반환, 순서 없음)와 별개로, `phrase_id`+`created_at`을 `created_at desc`로 정렬해 반환한다. 기존 `fetchMyPhraseBookmarks()`의 반환 형태는 건드리지 않았다(다른 호출부가 전부 `ids.includes(...)` 형태의 멤버십 체크만 하기 때문).
- `src/features/phrases/services/phraseService.js`에 `fetchPhrasesByIds(ids)` 추가 — id 중복 제거 후 `.in('id', uniqueIds)` **한 번**의 쿼리로 문구 행을 가져온다. Postgres가 반환하는 순서가 `ids` 순서와 같다는 보장이 없으므로, 호출부가 자신의 id 목록으로 다시 정렬해야 한다는 점을 함수 주석에 명시했다.
- `SavedPhrasesTab`의 `load()`는 `Promise.all([fetchMyPhraseBookmarksDetailed(user.id), fetchPhraseCategories()])`로 북마크 목록과 카테고리 목록을 병렬로 가져온 뒤, `ids.length > 0`일 때만 `fetchPhrasesByIds(ids)`를 **한 번** 호출하고, `Map`으로 변환해 `ids`(이미 최신 저장순) 기준으로 재정렬한다. **게시글 수만큼 개별 조회가 발생하는 구조가 아니다** — 북마크 개수와 무관하게 쿼리는 항상 최대 3회(북마크 목록 1회, 카테고리 1회, 문구 배치 1회)다.
- 카테고리 필터: 실제로 저장된 표현이 존재하는 카테고리만 필터 pill로 노출한다(`availableCategoryIds`로 필터링) — 저장한 게 하나도 없는 카테고리의 빈 탭을 만들지 않는다.
- 북마크 해제: `PhrasesPage`가 쓰는 토글 방식과 달리, 이 목록에서는 해제 즉시 목록에서 제거한다(낙관적 업데이트 후 실패 시 롤백) — "저장한 표현" 목록에서 해제된 항목이 남아 있을 이유가 없기 때문.
- locale 변경: `load` 콜백이 `[user?.id, locale]`에 의존해, locale이 바뀌면 `normalizePhrase(row, locale, ids)`로 현재 locale 텍스트를 다시 뽑아 재조회한다.

### 5.4 빈 상태

- 로딩 중: `Spinner`.
- 조회 실패: `t('phrases.loadError')`(기존 Phrases 탭이 쓰는 키 재사용).
- 저장한 표현이 하나도 없음: `EmptyState`에 `t('savedPhrases.empty')`/`t('savedPhrases.emptyHint')`.
- 카테고리 필터 결과가 0건: `t('savedPhrases.emptyCategory')`.

### 5.5 설계 이유

- `PhraseCard`/`PhraseCategoryTabs`를 그대로 재사용해 북마크 토글·TTS 재생·현재 locale 텍스트 표시가 Phrases 탭과 완전히 같은 코드 경로를 타도록 했다 — 두 번째 카드 구현을 만들지 않았다.
- `mg_phrases`의 id는 locale에 무관하게 한 행에 ko/en/zh-CN 텍스트를 모두 담고 있어, 한 언어로 저장한 표현이 다른 locale로 바꿔도 그대로 보이고 계속 북마크 상태로 남는다.

### 5.6 수정하지 않은 범위

- `PhraseCard.jsx`, `PhraseCategoryTabs.jsx`, `ttsService.js`, 기존 `fetchMyPhraseBookmarks()`/`fetchPhrasesByCategory()`의 시그니처·반환 형태는 전혀 손대지 않았다.
- Phrases 탭(`PhrasesPage.jsx`) 자체의 북마크 토글 로직도 변경하지 않았다.

### 5.7 실제 검증 결과 / 남은 한계

- `npm run build` 성공(§18).
- 로그인 세션이 없어 이 화면을 브라우저에서 직접 열어 저장 목록·카테고리 필터·빈 상태를 조작해 보지는 못했다(§20 승인된 한계).

---

## 6. 내가 쓴 글 카테고리·메타 UI 개선

### 6.1 문제

마이페이지 "내가 쓴 글" 목록의 각 게시글 카드에 원문 카테고리 값(`general`/`question`/`review`/`tips`/`food`/`routes`)이 그대로 노출되지 않았고, 좋아요 수 옆의 두 번째 숫자(`comment_count`)가 아이콘 없이 `· {count}`로만 표시돼 그 숫자가 무엇을 세는지 UI만으로는 알기 어려웠다.

### 6.2 원인 확인 과정

`· {post.comment_count ?? 0}`로 렌더링되는 값의 출처를 `communityService.js`의 `fetchMyPosts()`(`select('*')`)까지 추적한 결과, 이 값은 `mg_community_posts.comment_count`(댓글 수)이며 이 앱에는 조회수/조회(view) 집계 자체가 없다는 것을 확인했다. 그래서 eye 아이콘이 아니라 `CommentIcon`을 적용했다.

### 6.3 변경 후

`src/features/community/data/communityConstants.js`에 헬퍼를 추가했다.

```js
export function getWriteCategoryLabel(key, locale) {
  const cat = WRITE_CATEGORIES.find((c) => c.key === key);
  if (!cat) return null;
  return pickTranslated({ ko: cat.labelKo, en: cat.label, 'zh-CN': cat.labelZh }, locale) ?? cat.label;
}
```

`PostComposer`의 카테고리 선택 pill이 쓰는 것과 동일한 `WRITE_CATEGORIES`/`pickTranslated` 조합을 재사용해, 글을 쓸 때 고른 카테고리와 목록에 표시되는 카테고리 라벨이 항상 같은 문자열이 되도록 했다. 인식할 수 없는 키는 `null`을 반환해, 호출부가 배지를 아예 숨기게 했다(임의로 "General"을 추측해 보여주지 않음).

`src/features/profile/components/MyPostsView.jsx`의 `CompactPostCard`에 `locale` prop을 추가하고, 메타 정보 줄을 다음처럼 바꿨다.

```jsx
<div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-faint">
  <span>{formatRelativeOrAbsolute(post.created_at)}</span>
  <span className="inline-flex items-center gap-1">
    <FavoriteHeartIcon active size={11} className="shrink-0" />
    <span className="leading-none">{post.like_count ?? 0}</span>
  </span>
  <span className="inline-flex items-center gap-1">
    <span aria-hidden="true">·</span>
    <CommentIcon size={11} className="shrink-0" aria-hidden="true" />
    <span className="leading-none">{post.comment_count ?? 0}</span>
  </span>
  {categoryLabel && <span>· {categoryLabel}</span>}
</div>
```

최종 배치: 작성일 → 좋아요(하트+숫자) → 댓글(중간점 + `CommentIcon` + 숫자) → 카테고리(중간점 + 라벨, 있을 때만). 넷 다 동일한 `text-ink-faint` 회색이며, 카테고리는 항상 메타 그룹의 맨 끝에 온다. `flex-wrap`+`gap-x-2.5 gap-y-1`로 좁은 화면에서 항목이 넘치면 다음 줄로 자연스럽게 줄바꿈된다.

### 6.4 설계 이유

- 조회수 아이콘을 새로 만들지 않고 이미 앱 전역에서 쓰는 `CommentIcon`을 재사용해, 실제 의미(댓글 수)와 아이콘이 어긋나지 않게 했다.
- 카테고리 배지를 좋아요/댓글과 분리된 별도 UI(예: 색이 있는 pill)로 만들지 않고 같은 회색 텍스트 그룹에 포함시켜, 목록이 카드마다 색이 튀지 않고 차분하게 통일되도록 했다.

### 6.5 수정하지 않은 범위

- `post.category` 자체를 가져오는 방식(`fetchMyPosts()`의 `select('*')`)은 그대로다 — 이 화면을 위한 별도 카테고리 조회를 추가하지 않았다(게시글 행에 이미 있는 값 재사용).
- 좋아요 수·좋아요 아이콘 자체의 로직은 변경하지 않았다.

### 6.6 실제 검증 결과 / 남은 한계

- `npm run build` 성공.
- 로그인 세션이 없어 "내가 쓴 글" 화면을 실제로 열어 카테고리 배지·메타 줄바꿈을 직접 확인하지는 못했다(§20).

---

## 7. 기타 UI 미세 조정

`docs/58` 이후 마이페이지 자체에 추가로 발생한 diff는 위 §6("나의 표현" 섹션 추가) 외에는 없다 — `git diff -- src/pages/MyPage.jsx`로 확인한 나머지 변경분은 전부 §4에서 밝힌 일본어 안내 연동이며 이번 범위에서 제외했다.

사용자 요청 §2.3이 나열한 후보(카드 모서리·색상·chevron·숫자 미표시 정책, 로그아웃 버튼, 문의 이메일 등)는 전부 `docs/58`에서 이미 완료로 기록된 항목이고, 이번 구간 diff에는 그 항목들에 대한 추가 변경이 없다. 반복 기록하지 않는다.

---

## 8. OG/Twitter 메타데이터

### 8.1 문제

`index.html`에 Open Graph/Twitter Card 메타 태그가 전혀 없어, 카카오톡/트위터/디스코드 등에 링크를 공유했을 때 제목·설명이 없는 밋밋한 미리보기만 노출됐다.

### 8.2 변경 후

`index.html`의 `<title>` 바로 아래에 다음을 추가했다.

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://EclipticWin.github.io/matgil/" />
<meta property="og:title" content="맛길 | 서울 여행자를 위한 맛집 동선 추천" />
<meta property="og:description" content="서울의 로컬 맛집을 더 쉽게 찾고, 취향과 현재 위치에 맞는 맛집 동선을 추천받아 보세요." />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="맛길 | 서울 여행자를 위한 맛집 동선 추천" />
<meta name="twitter:description" content="서울의 로컬 맛집을 더 쉽게 찾고, 취향과 현재 위치에 맞는 맛집 동선을 추천받아 보세요." />
```

- `og:url`은 이 저장소의 GitHub Pages 배포 주소(`https://EclipticWin.github.io/matgil/`)이며, Vite `base`가 `/matgil/`로 설정된 배포 경로와 일치한다.
- `og:image`는 추가하지 않았다 — 1200×630 규격의 실제 공유용 이미지 파일이 아직 없기 때문이다. 이미지가 없는 상태에서 `og:image`를 비워 두거나 임의 스크린샷을 지정하는 대신, `twitter:card`를 이미지 없이도 동작하는 `summary`(작은 카드)로 지정했다.
- `dist/` 산출물은 직접 수정하지 않았다 — `index.html` 소스만 바꿨고, `npm run build`가 그 결과를 다시 만들어낸다(§18).

### 8.3 설계 이유

이미지 없이 `summary_large_image`를 쓰면 대부분의 클라이언트가 큰 이미지 영역을 빈 채로 렌더링하거나 아예 카드를 생략하므로, 이미지 유무에 맞는 카드 타입(`summary`)을 선택했다.

### 8.4 수정하지 않은 범위

- `<title>`, 폰트 `<link>`, `viewport` 등 기존 `<head>`의 다른 태그는 그대로다.
- `favicon`/`manifest` 관련 태그는 이번 변경에 포함되지 않았다.

### 8.5 후속 과제

1200×630 공유 이미지를 준비하면 `og:image`를 추가하고 `twitter:card`를 `summary_large_image`로 올릴 수 있다.

### 8.6 실제 검증 결과

`npm run build`로 `dist/index.html`에 태그가 그대로 반영되는 것을 확인했다(정적 HTML이라 별도 SSR 처리 없이 그대로 복사된다). 카카오톡/트위터 등 실제 소셜 크롤러가 이 메타 태그를 어떻게 렌더링하는지는 배포 후에나 확인 가능해 이번 세션에서는 확인하지 못했다(§20).

---

## 9. 커뮤니티 가게 위치 연결

### 9.1 문제

커뮤니티 게시글은 텍스트/사진만 첨부할 수 있었고, 글에서 언급한 가게를 맛길 내부 DB의 실제 가게 상세 페이지와 연결할 방법이 없었다.

### 9.2 요구사항 대조표

| 요구 | 실제 구현 | 근거 |
|---|---|---|
| 1. textarea border 완화 | `border-[1.5px] border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-200` → `border border-stone-200/70 focus:border-stone-300 focus:ring-1 focus:ring-stone-200/60` | `PostComposer.jsx` |
| 2~3. 사진 추가 위 "위치 추가" + 전용 picker 신규 구현 | `PostComposer.jsx`에 위치 섹션 추가, `CommunityPlacePicker.jsx` 신규 작성 | §10 |
| 4~9. 내부 DB만, `getPlaces`/`searchInternalPlaces` 재사용, Kakao/preset/동선 미사용 | `CommunityPlacePicker.jsx`가 `getPlaces(locale)` + `searchInternalPlaces(query, places)`만 호출. `searchPlacesByKeyword`(Kakao), preset, 동선 선택 코드 없음 | §10 |
| 10~11. 한 글에 가게 한 곳, 선택 사항 | `selectedPlace` 단일 state, `placeId: selectedPlace?.id ?? null`로 항상 optional | `PostComposer.jsx` |
| 12. 모든 카테고리에서 선택 가능 | 위치 섹션이 카테고리 pill 아래, 카테고리 조건 분기 없이 항상 렌더링 | `PostComposer.jsx` |
| 13~17. 새 글/수정/변경/삭제/사진+위치 동시 첨부 | §11 | `PostComposer.jsx`, `CommunityPage.jsx` |
| 18~19. 카드에 가게명·주소, 클릭 시 상세 이동 | `PostCard.jsx`의 `<Link to={ROUTES.placeDetail(post.place.id)}>` | §11 |
| 20. locale 변경 시 이름·주소 갱신 | `CommunityPage.jsx`의 batch 조회 effect가 `[dbPosts, locale]`에 의존 | §12 |
| 21. 장소 조회 실패 시 게시글은 유지 | `normalizeDbPost()`가 `placeId`는 항상 보존, `place`만 null | §12 |
| 22. mock 문자열 vs DB 객체 호환 | `PostCard.jsx`가 `typeof post.place`로 분기 | §11 |
| 23. picker의 loading/error/empty | `CommunityPlacePicker.jsx`의 `status` state | §10 |
| 24. 모바일 bottom sheet·키보드 대응 | 기존 `SearchOverlay.jsx`와 동일한 `absolute inset-0`/포커스 패턴 재사용 | §10 |
| 25. 긴 이름·주소 truncate | `truncate` 클래스(카드·picker·selected chip 전부) | `PostCard.jsx`, `PostComposer.jsx`, `CommunityPlacePicker.jsx` |

### 9.3 textarea border

```
이전: border-[1.5px] border-stone-200 bg-white ... focus:border-stone-400 focus:ring-1 focus:ring-stone-200
이후: border border-stone-200/70 bg-white ... focus:border-stone-300 focus:ring-1 focus:ring-stone-200/60
```

굵기를 `1.5px`→기본(1px)으로, 색을 불투명 `stone-200`/`stone-400`에서 각각 70%/`ring-stone-200/60` 투명도로 낮춰 평상시·포커스 시 테두리를 전체적으로 옅게 만들었다.

### 9.4 수정하지 않은 범위

- `SearchOverlay.jsx`, Kakao 검색(`kakaoPlaceSearchService.js`), preset(`PRESET_LOCATIONS`) 관련 코드는 전혀 수정하지 않았다.
- 기존 이미지 업로드(`uploadPostImages`), 좋아요·댓글·삭제 로직은 변경하지 않았다.
- 커뮤니티 카테고리 목록(`WRITE_CATEGORIES`) 자체는 바꾸지 않았다.

---

## 10. 커뮤니티 전용 내부 가게 검색 설계

### 10.1 왜 `SearchOverlay.jsx`를 재사용하지 않았는가

`SearchOverlay.jsx`(`buildMergedSearchResults()`)는 preset 핫플레이스, Kakao 외부 장소, 내부 DB 가게를 한 목록에 섞어 보여주고, Kakao 결과에는 내부 `id`가 없을 수 있다. 커뮤니티 게시글은 반드시 `mg_places.id`가 있는 내부 가게 하나만 연결해야 하므로, 이 병합 로직을 그대로 쓰면 연결 불가능한 결과가 섞여 나온다. 그래서 `SearchOverlay.jsx`를 전혀 건드리지 않고 `src/features/community/components/CommunityPlacePicker.jsx`를 새로 작성했다.

### 10.2 데이터 소스

```jsx
useEffect(() => {
  if (!open || hasFetchedRef.current) return;
  hasFetchedRef.current = true;
  setStatus('loading');
  getPlaces(locale)
    .then((data) => { setPlaces(data); setStatus('ready'); })
    .catch(() => setStatus('error'));
}, [open, locale]);
```

- `getPlaces(locale)`(`src/api/placeApi.js`, 기존 함수 그대로) — `mg_places.is_active = true`만 조회.
- `searchInternalPlaces(query, places)`(`src/features/explore/services/placeSearchService.js`, 기존 함수 그대로) — 최소 2자 이상, 이름 exact/prefix/contains 순위, 최대 5건, 좌표가 있는 place만.
- `searchPlacesByKeyword()`(Kakao), preset 검색, 동선 선택 코드는 이 파일 어디에도 없다.
- `hasFetchedRef`로 picker가 **처음 열릴 때 한 번만** `getPlaces()`를 호출하고, 같은 `PostComposer` 인스턴스가 떠 있는 동안 picker를 여러 번 열고 닫아도 재조회하지 않는다(picker 컴포넌트 자체가 `open` prop으로 표시만 토글되고 언마운트되지 않기 때문).

### 10.3 상태 처리

- `status === 'loading'` → `t('community.loadingPlaces')`
- `status === 'error'` → `t('community.placesLoadFailed')`
- 쿼리가 비어 있음 → `t('community.searchPlaceGuide')`(안내 배너)
- 쿼리 2자 이상인데 결과 0건 → `t('community.noPlacesFound')`
- 결과 있음 → `PinIcon` + 현재 locale 가게명(`place.name`) + 주소(`place.address`, `truncate`)

### 10.4 모바일 대응

`SearchOverlay.jsx`와 동일하게 `absolute inset-0`(앱 전체를 감싸는 `relative` 컨테이너 기준, `App.jsx`)과 `search-overlay-in`/`search-overlay-out` 애니메이션 클래스, 입력창 자동 포커스 패턴을 그대로 재사용했다 — 새 CSS를 추가하지 않았다. `PostComposer`의 오버레이(`z-50`)보다 높은 `z-[60]`을 써서 picker가 열리면 하단 내비게이션을 포함한 화면 전체를 완전히 덮는다.

### 10.5 수정하지 않은 범위

`placeSearchService.js`, `placeApi.js`의 기존 함수 시그니처·로직은 전혀 바꾸지 않았다 — 새 파일에서 있는 그대로 호출만 했다.

---

## 11. 생성·수정·삭제 및 상세 이동

### 11.1 `PostComposer` — 위치 선택 상태

```jsx
const [selectedPlace, setSelectedPlace] = useState(() => resolveInitialPlace(initialPlace, initialPlaceId));
const [pickerOpen, setPickerOpen] = useState(false);
```

`resolveInitialPlace`는 `initialPlace`(배치 조회로 채워진 `{id, name, address}` 객체)가 있으면 그대로 쓰고, 없고 `initialPlaceId`만 있으면 `{id, name: null, address: null}` 스텁을 만든다 — 배치 조회가 실패했더라도 `place_id` 자체는 잃지 않기 위해서다. 위치를 선택/변경/해제하지 않고 저장하면 `selectedPlace`는 초기값 그대로 남아 있으므로, 결과적으로 기존 `place_id`가 그대로 유지된다.

초기화 `useEffect`(편집 대상이 바뀔 때 재실행)에도 `setSelectedPlace(resolveInitialPlace(initialPlace, initialPlaceId))`를 추가하고 의존성 배열에 `initialPlace`/`initialPlaceId`를 넣었다.

`onSubmit` 호출부:

```jsx
await onSubmit({ category, content: content.trim(), imageUrls, placeId: selectedPlace?.id ?? null });
```

사진 업로드(`uploadedUrls`)와 위치(`placeId`)는 서로 독립적인 값이라 사진 유무와 무관하게 항상 함께 전달된다 — 사진 없이 위치만 첨부하는 것도, 사진과 위치를 동시에 첨부하는 것도 같은 코드 경로다.

### 11.2 선택 UI

```jsx
{selectedPlace ? (
  <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-coral-tint/40 px-3.5 py-3">
    <button onClick={() => setPickerOpen(true)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
      {/* PinIcon + 가게명 + 주소 + "위치 변경" 텍스트 */}
    </button>
    <button onClick={() => setSelectedPlace(null)} aria-label={t('community.removePlace')}>
      {/* X 아이콘 */}
    </button>
  </div>
) : (
  <button onClick={() => setPickerOpen(true)}>{/* PinIcon + "위치 추가" */}</button>
)}
```

버튼을 두 개의 형제 `<button>`으로 분리했다(중첩 `<button>`은 유효하지 않은 HTML이라 영역 클릭=picker 재오픈, X 버튼=해제를 각각 별도 요소로 구현). 해제를 누르면 `selectedPlace`가 `null`이 되고, 저장 시 `placeId`도 `null`로 전달돼 연결이 끊긴다.

### 11.3 서비스 — `createPost`/`updatePost`

```js
export async function createPost({ userId, category, locale, content, authorName, imageUrls = [], placeId = null }) {
  ...
  .insert({ user_id: userId, category, locale, content, author_name: authorName, image_urls: imageUrls, place_id: placeId })
  ...
}

export async function updatePost(id, { category, content, imageUrls, placeId }) {
  const updates = { category, content, updated_at: new Date().toISOString() };
  if (imageUrls !== undefined) updates.image_urls = imageUrls;
  if (placeId !== undefined) updates.place_id = placeId;
  ...
}
```

`updatePost`는 기존 `imageUrls`와 동일한 "값이 `undefined`가 아닐 때만 갱신" 패턴을 `placeId`에도 적용했다. `PostComposer`는 위치를 건드리지 않아도 항상 확정된 값(id 또는 `null`)을 보내므로, 실질적으로 매 저장마다 `place_id`가 갱신되지만 그 값 자체가 원래 값과 같게 유지된다.

### 11.4 게시글 카드 — 표시와 상세 이동

```jsx
{post.place && typeof post.place === 'string' && (
  <div className="... bg-coral-tint/60 ...">
    <PinIcon size={13} className="text-coral" /> {post.place}
  </div>
)}
{post.place && typeof post.place === 'object' && (
  <Link to={ROUTES.placeDetail(post.place.id)} state={{ place: post.place }} className="... bg-coral-tint/60 ...">
    <PinIcon size={14} className="shrink-0 text-coral" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[0.83rem] font-bold text-ink">{post.place.name}</span>
      {post.place.address && <span className="block truncate text-[0.72rem] text-ink-faint">{post.place.address}</span>}
    </span>
  </Link>
)}
```

- mock 게시글(`COMMUNITY_POSTS`)의 `post.place`는 문자열이라 기존과 동일한(색만 `bg-coral-tint`→`bg-coral-tint/60`로 옅게 조정) 비클릭 pill로 남는다 — 회귀 없음.
- DB 게시글의 `post.place`는 `{id, name, address}` 객체이며, `react-router-dom`의 `Link`로 `ROUTES.placeDetail(post.place.id)`에 `state={{ place: post.place }}`를 함께 넘긴다. 이 `Link` + `state` 조합은 `SavedCourseDetailPage.jsx`가 이미 쓰던 관례를 그대로 따른 것이다.
- 이 링크는 좋아요/댓글 버튼과 완전히 분리된 DOM 요소라 서로의 클릭에 영향을 주지 않는다.

### 11.5 수정하지 않은 범위

이미지 업로드, 좋아요/댓글/삭제 API, 카테고리 목록, `SearchOverlay.jsx` — 전혀 손대지 않았다.

### 11.6 실제 검증 결과

`npm run build` 성공. 로그인 세션이 없어 이 세션 자체에서 브라우저로 직접 조작해 보지는 못했으나(§20), 사용자가 별도로 수행한 실기기 검증 결과를 §14에 기록한다.

---

## 12. batch 조회·locale·N+1 방지

### 12.1 `normalizeDbPost()` — `place`/`placeId` 분리 보존

```js
export function normalizeDbPost(p, i, placeById = new Map()) {
  const placeId = p.place_id ?? null;
  return {
    ...
    placeId,
    place: placeId != null ? (placeById.get(placeId) ?? null) : null,
    ...
  };
}
```

`place_id`가 있으면 항상 `placeId`에 보존하고, `place`(표시용 객체)는 `placeById` 맵에 해당 id가 있을 때만 채운다. 배치 조회가 실패해 `placeById`가 비어 있어도 `placeId` 자체는 사라지지 않는다 — 그 결과 목록에서는 장소 영역만 숨겨지고, 그 글을 수정할 때도 `place_id`가 유실되지 않는다(§9.2 요구 21).

### 12.2 `CommunityPage.jsx` — 한 번의 batch 조회

```js
useEffect(() => {
  if (!dbPosts) return;
  const placeIds = [...new Set(dbPosts.map((p) => p.place_id).filter((id) => id != null))];
  const mySeq = (placesRequestSeqRef.current += 1);
  if (placeIds.length === 0) { setPlacesById(new Map()); return; }
  getPlacesByIds(placeIds, locale)
    .then((places) => {
      if (placesRequestSeqRef.current !== mySeq) return;
      setPlacesById(new Map(places.map((place) => [place.id, place])));
    })
    .catch(() => {
      if (placesRequestSeqRef.current !== mySeq) return;
      setPlacesById(new Map());
    });
}, [dbPosts, locale]);
```

**N+1이 없는 근거**: `dbPosts`(현재 페이지에 로드된 게시글 전체)에서 `place_id`를 한 번에 모으고 중복 제거한 뒤, `getPlacesByIds(placeIds, locale)` 단 **한 번**의 Supabase 쿼리(`.in('id', uniqueIds)`)로 필요한 모든 가게를 가져온다. 게시글 개수가 몇 개든(0개~수십 개) 이 쿼리 횟수는 항상 1회이고, `normalizeDbPost()`나 `PostCard.jsx` 어디에도 게시글 하나당 별도로 `getPlaceById()`를 호출하는 코드가 없다.

- `placesRequestSeqRef`로 stale 응답을 무시한다 — locale이 빠르게 연속으로 바뀌거나 게시글 목록이 다시 로드되는 동안 먼저 보낸 요청이 나중에 도착해도 최신 상태를 덮어쓰지 않는다.
- effect가 `[dbPosts, locale]`에 의존하므로 locale이 바뀌면 자동으로 재조회되어 이름·주소가 그 locale로 갱신된다.
- 실패 시 `placesById`만 빈 `Map`으로 리셋하고 `dbPosts`는 그대로 둔다 — 게시글 자체는 계속 보이고 장소 영역만 사라진다.

`sourcePosts`는 `useMemo(() => ..., [dbPosts, placesById])`로 계산해 `dbPosts.map((p, i) => normalizeDbPost(p, i, placesById))`를 수행한다.

### 12.3 submit 경로

- `handleSubmit({ ..., placeId = null })` → `createPost({ ..., placeId })`.
- `handleEditSubmit({ ..., placeId })` → `updatePost(editingPost.id, { ..., placeId })`.
- 편집 시작(`handleEdit`) → `<PostComposer initialPlaceId={editingPost.placeId} initialPlace={editingPost.place} .../>`.

---

## 13. DB 스키마 및 SQL

### 13.1 마이그레이션 파일 여부

이 저장소에는 이번 변경에 대응하는 SQL 마이그레이션 파일이 추가되지 않았다. 아래 SQL은 **사용자가 Supabase SQL Editor에서 직접 실행한(또는 실행할) 수동 DDL**이며, 이 저장소의 git diff에는 흔적이 남지 않는다.

### 13.2 최종 스키마

- `mg_community_posts.place_id bigint NULL`
- `mg_places.id bigint`(기존)
- FK: `mg_community_posts.place_id → mg_places.id`, `ON UPDATE CASCADE`, `ON DELETE SET NULL`
- `place_id IS NOT NULL` 조건의 partial index

### 13.3 실행 SQL

```sql
ALTER TABLE public.mg_community_posts
ADD COLUMN place_id bigint NULL;

ALTER TABLE public.mg_community_posts
ADD CONSTRAINT fk_mg_community_posts_place
FOREIGN KEY (place_id)
REFERENCES public.mg_places(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

CREATE INDEX idx_mg_community_posts_place_id
ON public.mg_community_posts(place_id)
WHERE place_id IS NOT NULL;
```

### 13.4 영향 범위

- 기존 게시글은 컬럼 추가 시 전부 `place_id = NULL`로 채워지므로, 이전에 작성된 글에는 영향이 없다.
- `mg_places` 행(가게)이 삭제되면 `ON DELETE SET NULL`에 의해 그 가게를 참조하던 게시글의 `place_id`만 `NULL`로 바뀌고 게시글 자체(본문·이미지·좋아요·댓글)는 그대로 유지된다 — `normalizeDbPost()`가 `place_id`가 null이면 `place`도 null로 처리하므로 코드 쪽에서 추가 예외 처리가 필요 없다.

### 13.5 이 세션에서 확인하지 못한 것

이번 세션에서는 DB에 직접 접속하거나 SQL을 실행하지 않았다(요청 원칙에 따름). 위 SQL이 실제로 프로덕션 Supabase에 적용됐는지, `mg_community_posts`의 현재 컬럼 목록에 `place_id`가 포함돼 있는지는 코드로 직접 조회하지 않았고, §14에 기록한 사용자 본인의 검증 결과에 근거한다.

---

## 14. 실제 브라우저/DB 검증

### 14.1 이번 세션에서 직접 수행한 검증

- `npm run build` 성공, `git diff --check` 통과(§18~19).
- `docs/58` 시점부터 코드 리뷰 수준으로 각 diff의 재사용 관계(`SearchOverlay.jsx`/`placeSearchService.js`/`placeApi.js` 미변경, mock `place` 문자열과 DB `place` 객체 분기 등)를 대조 확인했다.

### 14.2 사용자가 English 모드에서 별도로 수행한 검증(보고 기반)

아래는 이 문서 작성 요청에서 사용자가 알려온, 사용자 본인이 브라우저와 Supabase에서 직접 확인한 결과다. 이 세션은 로그인 자격 증명이 없어 아래 흐름을 스스로 재현·재검증하지는 못했고, 사용자가 보고한 내용을 그대로 기록한다.

확인된 흐름:
- 커뮤니티 새 글 작성 화면 진입 → `Add place` 버튼 노출 확인
- `ol` 검색 → 내부 DB 가게 검색 결과 표시 확인
- `Ollot (오롯이)` 선택 → 선택 후 가게명·주소 표시, `Change place`와 제거 버튼 노출 확인
- 질문(Question) 카테고리 선택 + 본문 작성, 사진 없이 위치만 첨부해 등록
- 등록 후 게시글 카드에 가게명·주소가 표시됨을 확인
- 수정(Edit Post) 화면 재진입 시 기존 위치가 복원됨, 위치 변경·삭제 UI가 표시됨을 확인

DB 확인 결과(사용자 보고):
- 신규 게시글 `id: 15`, `place_id: 967`, `content: "is the food delicious in this restaurant? Doesn't anyone know?"`
- 기존 게시글 `id 14` 이하의 `place_id`는 `NULL`로 유지됨

화면에서 가게 주소가 길어 잘려 보인 것(`truncate`)은 §9.2/§11.4에서 의도한 UI(`truncate` 클래스)이며 오류가 아니다.

개인정보·로그인 자격 증명은 이 문서에 기록하지 않았다.

### 14.3 미확인(승인된 한계)

- 이 세션 자체에서 로그인 세션으로 실제 등록/수정/삭제 플로우를 재현하지 못했다.
- `mg_community_posts` 테이블의 실제 컬럼 목록(`place_id` 존재 여부)을 이 세션에서 직접 SQL로 조회하지 않았다.

---

## 15. 다국어 변경

`src/shared/i18n/dictionary.js`에 ko/en/zh-CN 3개 locale 전부, 같은 순서로 아래 키를 추가했다(전부 `community`/`my`/신규 `savedPhrases` 네임스페이스).

| 네임스페이스 | 키 | ko | en | zh-CN |
|---|---|---|---|---|
| `community` | `addPlace` | 위치 추가 | Add place | 添加地点 |
| `community` | `changePlace` | 위치 변경 | Change place | 更换地点 |
| `community` | `removePlace` | 위치 삭제 | Remove place | 删除地点 |
| `community` | `searchPlacePlaceholder` | 가게 이름을 검색해 주세요 | Search by place name | 请输入店铺名称 |
| `community` | `searchPlaceGuide` | 맛길에 등록된 가게만 선택할 수 있어요. | Only places registered in Matgil can be selected. | 只能选择已收录在Matgil中的店铺。 |
| `community` | `noPlacesFound` | 검색 결과가 없습니다. | No places found. | 没有找到店铺。 |
| `community` | `placesLoadFailed` | 가게를 불러오지 못했습니다. | Could not load places. | 店铺加载失败。 |
| `community` | `placeInfoUnavailable` | 가게 정보를 불러오지 못했습니다 | Place info unavailable | 店铺信息不可用 |
| `community` | `loadingPlaces` | 불러오는 중… | Loading… | 加载中… |
| `my` | `phrasesSection` | 나의 표현 | My Phrases | 我的表达 |
| `savedPhrases`(신규) | `title` | 저장한 표현 | Saved phrases | 已收藏的表达 |
| `savedPhrases` | `subtitle` | 내가 저장한 표현 목록 | Phrases you have bookmarked | 您收藏的表达列表 |
| `savedPhrases` | `empty` | 아직 저장한 표현이 없어요. | No saved phrases yet. | 还没有收藏的表达。 |
| `savedPhrases` | `emptyHint` | 표현 탭에서 자주 쓰고 싶은 표현을 저장해 보세요. | Save useful phrases from the Phrases tab. | 请在表达页面收藏常用表达。 |
| `savedPhrases` | `emptyCategory` | 이 카테고리에 저장한 표현이 없어요. | No saved phrases in this category. | 该分类下暂无收藏的表达。 |

세 locale 모두 같은 순서·같은 키 집합으로 추가해 기존 dictionary 관례(§docs/58 §4.9 등)를 따랐다. `getWriteCategoryLabel()`(§6)은 새 키를 만들지 않고 기존 `WRITE_CATEGORIES`의 `label`/`labelKo`/`labelZh`를 재사용한다.

---

## 16. 변경 파일 종합

### 16.1 이번 커밋에 포함한 파일

| 파일 | 구분 | 비고 |
|---|---|---|
| `src/pages/SavedPhrasesPage.jsx` | 신규 | 저장한 표현 전용 라우트 페이지 |
| `src/features/phrases/components/SavedPhrasesTab.jsx` | 신규 | 저장한 표현 목록 UI |
| `src/features/phrases/services/phraseBookmarkService.js` | 수정 | `fetchMyPhraseBookmarksDetailed()` 추가 |
| `src/features/phrases/services/phraseService.js` | 수정 | `fetchPhrasesByIds()` 추가 |
| `src/features/community/data/communityConstants.js` | 수정 | `getWriteCategoryLabel()` 추가 |
| `src/features/profile/components/MyPostsView.jsx` | 수정 | 카테고리 배지 + 댓글 아이콘 메타 정리 |
| `src/shared/constants/routes.js` | 수정 | `mySavedPhrases` 라우트 추가 |
| `src/app/router.jsx` | 수정 | `SavedPhrasesPage` 라우트 등록 |
| `src/pages/MyPage.jsx` | 부분 수정(§4) | "나의 표현" `MySection` 추가분만 포함, 일본어 안내 연동분은 제외 |
| `index.html` | 수정 | OG/Twitter 메타 태그 추가 |
| `src/features/community/components/CommunityPlacePicker.jsx` | 신규 | 커뮤니티 전용 내부 가게 검색 picker |
| `src/features/community/components/PostComposer.jsx` | 수정 | textarea border 완화, 위치 선택 UI/상태 |
| `src/features/community/components/PostCard.jsx` | 수정 | 가게명·주소 표시 + 상세 이동 링크 |
| `src/features/community/services/communityService.js` | 수정 | `createPost`/`updatePost`/`normalizeDbPost`의 `place_id` 처리 |
| `src/pages/CommunityPage.jsx` | 수정 | `getPlacesByIds` batch 조회, submit/edit 경로에 `placeId` 연결 |
| `src/shared/i18n/dictionary.js` | 수정 | §15의 모든 키(ko/en/zh-CN) |
| `docs/59-....md`(이 문서) | 신규 | 작업일지 |

### 16.2 삭제 파일

없음.

### 16.3 이번 커밋에서 제외한 파일(§4 참고)

| 파일 | 사유 |
|---|---|
| `src/features/explore/components/LanguageModal.jsx` | 일본어 "준비 중" 안내 전용 diff, 이번 요청 범위 밖 |
| `src/features/explore/data/exploreOptions.js` | 위와 동일(`COMING_SOON_LANGUAGES`) |
| `src/features/explore/components/JapaneseComingSoonModal.jsx`(신규) | 위와 동일 |
| `src/pages/HomePage.jsx` | diff 전체가 일본어 안내 연동뿐 |
| `src/pages/MyPage.jsx`의 일부 hunk | 같은 파일 안에 "나의 표현"(포함)과 일본어 안내 연동(제외)이 섞여 있어, 후자만 워킹 디렉터리에 미커밋 상태로 남김 |
| `.claude/worktrees/` | 다른 worktree 산출물, 항상 제외 |

---

## 17. 성능·보안·회귀 영향

- **성능**: 커뮤니티 목록의 장소 조회는 게시글 수와 무관하게 항상 1회(§12), 저장한 표현 목록도 북마크 개수와 무관하게 항상 최대 3회(§5.3) — 게시글/북마크가 늘어나도 쿼리 수가 늘어나지 않는다.
- **보안**: 이번 변경 중 어디에도 service role key, anon key, 비밀번호, 테스트 계정 정보를 코드나 문서에 남기지 않았다. `place_id` FK는 `ON DELETE SET NULL`이라 가게 삭제 시 게시글이 고아 참조를 갖지 않는다.
- **회귀**:
  - `PostCard.jsx`의 `typeof post.place === 'string'` 분기 덕분에 mock 게시글(`COMMUNITY_POSTS`)의 기존 렌더링은 그대로 유지된다.
  - `normalizeDbPost()`/`createPost()`/`updatePost()`의 새 파라미터(`placeId`, `placeById`)는 전부 기본값(`null`/`new Map()`)이 있어, 이 함수들을 호출하는 다른 코드(예: `MyPostsView.jsx`는 `normalizeDbPost`를 쓰지 않음)에 영향이 없다.
  - `Card.jsx`, `WRITE_CATEGORIES`, 좋아요/댓글/삭제 API는 이번 구간에서 전혀 수정하지 않았다.

---

## 18. 빌드 및 검사 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공. 기존에 있던 CSS 압축 경고 1건(`Expected identifier but found "-"`, `communityService.js`의 타임스탬프 정규식 `/[-:T.Z]/g`에서 비롯된 것으로 이번 변경 이전부터 존재) 외 신규 오류 없음 |
| `git diff --check` | 통과 — 전 파일에 CRLF 안내(`LF will be replaced by CRLF`)만 있고 trailing whitespace 등 실제 오류 없음. line-ending을 이유로 파일을 강제 재포맷하지 않았다 |

---

## 19. git 상태 및 커밋 정보

이 섹션은 실제 커밋·푸시 수행 후 최종 보고에 채워 넣는다(문서 작성 직후 별도 절차로 진행).

---

## 20. 승인된 한계와 후속 과제

### 20.1 승인된 한계(이번 세션에서 확인하지 못함)

- 저장한 표현 화면·내가 쓴 글 카테고리 배지·커뮤니티 위치 연결 UI를 이 세션에서 로그인 세션으로 직접 조작해 확인하지 못했다(테스트 계정 자격 증명이 없고, 프로덕션 DB에 새 계정을 만드는 것은 범위 밖으로 판단).
- `mg_community_posts.place_id` 컬럼이 실제로 존재하는지, §13 SQL이 실제로 적용됐는지를 이 세션에서 직접 SQL로 조회하지 않았다 — §14.2에 기록한 사용자 보고에 근거한다.
- OG/Twitter 메타 태그가 실제 소셜 크롤러(카카오톡/트위터 등)에서 어떻게 렌더링되는지는 배포 후 확인이 필요하다.

### 20.2 후속 과제

- 일본어("준비 중") 안내 관련 미커밋 변경(`LanguageModal.jsx`/`exploreOptions.js`/`JapaneseComingSoonModal.jsx`/`HomePage.jsx`/`MyPage.jsx` 일부) — 이번 구간과 무관하므로 별도로 검토·커밋 필요(`docs/58` §11에서도 동일하게 지적된 항목, 아직 해소되지 않음).
- 1200×630 공유 이미지를 준비해 `og:image`/`twitter:card: summary_large_image` 적용.
- 실기기·실제 로그인 세션으로 §20.1의 미확인 항목 전체 재검증.
