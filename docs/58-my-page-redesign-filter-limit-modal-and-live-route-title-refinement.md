# 58. 마이페이지 UI 재개편, 라이브 추천 동선 제목 정책 개선, 여행자픽 가게명 색상 통일

## 1. 작업 일시

- 작성일시: 2026-07-26 21:37 KST

---

## 2. 작업 배경

`docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md`는 커밋 `79e3226`(여행자픽 공개 동선·가게 랭킹, 저장 목록 마이페이지 이동, 순위·필터 UX 정리)으로 커밋되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 작업을 다룬다. `git log --oneline -1`은 여전히 `79e3226`이며, 이 문서 작성 시점까지 `git add`/`commit`/`push`가 전혀 수행되지 않아 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있었다.

docs/57이 다룬 "여행자픽" 공개 탐색 개편과 별개로, 이번 구간은 다음 세 갈래로 진행되었다.

1. **마이페이지 UI 전면 재개편** — docs/57에서 일단 추가만 됐던 작은 통계 카드(`StatCard`, 계정 카드 아래 2줄 그리드) 구조를, 당근마켓 "나의 당근"과 유사한 큰 섹션 카드(제목 + row 목록) 구조로 다시 설계하고, 그 과정에서 간격·색상·자간·숫자 표기·로그아웃 버튼·문의 이메일·회원 탈퇴 경고색을 여러 차례에 걸쳐 다듬었다.
2. **라이브 추천 동선 제목 정책 개선** — 지도 탭에서 음식 필터를 적용해 생성된 추천 동선들이 서로 다른 stop 구성인데도 필터 라벨 하나로 동일한 제목을 갖던 문제, 그리고 그 제목 충돌을 해소하던 fallback이 첫 번째 가게명을 제목 뒤에 붙이던 문제를 함께 고쳤다.
3. **여행자픽 공개 가게 카드의 가게명 색상**을 공개 동선 카드의 제목 색상과 통일했다.

이 저장소에는 Git worktree가 둘 이상 존재한다(`C:/Workspace/GitWorkspace/matgil`(main), `.claude/worktrees/sprightly-pondering-owl`). 이번 구간의 모든 작업 전에 `git rev-parse --show-toplevel`/`git branch --show-current`/`git worktree list`/`git status --short`로 실제 실행 워크트리(main)를 재확인했고, `.claude/worktrees` 하위 파일은 이번 구간 전체에서 읽기 비교 외에는 전혀 수정하지 않았다.

---

## 3. 이번 문서에서 제외한 항목

아래 두 가지는 이 문서가 다루는 범위에 **포함하지 않는다.**

- **저장한 표현(Saved Phrases) 페이지 + 내가 쓴 글 카테고리 표시** — 현재 진행 중인 작업이라 아직 완료로 기록하지 않는다. `src/pages/SavedPhrasesPage.jsx`, `src/features/phrases/components/SavedPhrasesTab.jsx`(신규), `phraseBookmarkService.js`/`phraseService.js`의 배치 조회 함수 추가, `communityConstants.js`의 카테고리 라벨 헬퍼, `MyPostsView.jsx`의 게시글 카드 메타 정보 배치, `MyPage.jsx`의 "나의 표현" 섹션, `dictionary.js`의 `my.phrasesSection`/`savedPhrases.*`, `routes.js`/`router.jsx`의 `mySavedPhrases` 라우트는 전부 이 문서에서 다루지 않는다. 이 작업은 별도 작업일지로 정리될 예정이다.
- **커뮤니티 글에 가게 위치 추가** — 아직 조사조차 시작하지 않은 기능이라 이 문서에 포함할 내용이 없다.
- **지도 음식 필터 최대 3개 선택 안내 모달** — `docs/57` §14에서 이미 상세히 문서화되었고(`FoodTypeLimitModal.jsx`, `FilterSheet.jsx`), `git status`로 확인한 결과 이 구간에서 두 파일 모두 추가 변경이 없다(diff 없음). 중복 기록을 피하기 위해 이 문서에서는 재설명하지 않는다.

---

## 4. 마이페이지 UI 재개편

### 4.1 출발점 — docs/57이 남긴 상태

docs/57 시점의 마이페이지는 계정 정보 카드 아래에 작은 정사각형 카드(`StatCard.jsx`)가 두 줄(내가 쓴 글/좋아요한 글/언어, 저장한 동선/저장한 가게)로 늘어서 있는 구조였다. 이 구간은 그 구조를 다음 최종 형태로 바꿨다.

```
계정 정보 카드
나의 여행        (저장한 동선 / 저장한 가게)
나의 커뮤니티 활동 (내가 쓴 글 / 좋아요한 글)
설정            (언어)
로그아웃
서비스 안내 및 저작권
```

### 4.2 공용 컴포넌트 — `MySection`/`MyRow` (`src/pages/MyPage.jsx`)

`StatCard.jsx`를 사용하던 자리를 `MyPage.jsx` 파일 내부의 두 로컬 컴포넌트로 대체했다.

```jsx
function MySection({ title, children }) {
  return (
    <Card rounded="rounded-2xl" className="mt-3.5 overflow-hidden">
      <p className="px-4 pb-1 pt-4 text-[0.9rem] font-bold uppercase text-ink-soft">
        {title}
      </p>
      <div className="pb-1.5 pt-[0.42rem]">{children}</div>
    </Card>
  );
}

function MyRow({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors active:bg-ink/[0.03]"
    >
      <span className="text-[0.95rem] font-medium text-ink-soft">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ink-soft">
        {value != null && value}
        <ChevronRightIcon size={13} className="shrink-0 text-ink-faint" aria-hidden="true" />
      </span>
    </button>
  );
}
```

- `MySection`은 제목 + row 목록을 하나의 큰 카드로 묶는 순수 표시용 wrapper다. 각 row의 클릭 핸들러는 기존에 `StatCard`가 쓰던 것(`navigate(ROUTES.mySavedRoutes)`, `setView('myPosts')`, `setLangOpen(true)` 등)을 그대로 재사용했다 — 이동 대상·데이터 조회 로직은 전혀 바뀌지 않았다.
- `MyRow`의 `value`는 선택적이다. 값을 아예 넘기지 않으면 우측에 아무 숫자도 렌더링되지 않는다 — 현재 마이페이지의 "저장한 동선"/"저장한 가게"/"내가 쓴 글"/"좋아요한 글" 4개 row는 모두 `value`를 넘기지 않아 카운트 숫자가 화면에 표시되지 않고, "언어" row만 `value={currentLang.short}`를 그대로 전달해 현재 언어값(`한`/`EN`/`中`)을 계속 보여준다. 저장 동선/가게/글/좋아요 개수를 가져오는 `fetchMySavedCounts()`/`fetchMyActivityCounts()` 호출과 그 결과를 담는 `counts`/`savedCounts` state는 **그대로 남아있다** — 화면에만 반영하지 않을 뿐, 데이터 조회 자체를 없애지 않았다.
- 각 row 안에 왼쪽 순번 숫자, row 사이 구분선(`divide-y`/`border-t`/`border-b`) 모두 없다 — `MySection`의 자식 wrapper(`<div className="pb-1.5 pt-[0.42rem]">`)는 row 사이에 아무 구분자도 넣지 않는 단순 padding 컨테이너다.

### 4.3 카드 모서리 — `Card.jsx`의 `rounded` prop

`src/shared/components/Card.jsx`는 이 저장소 전역에서 재사용되는 공용 컴포넌트(`PublicPlaceCard.jsx`, `PostCard.jsx`, `PopularPlaceCard.jsx`, `RecommendationCard.jsx`, `SavedPlaceCard.jsx`, `PhrasesPage.jsx` 등)라, 여기 손을 대면 다른 화면의 카드 모서리까지 전부 바뀔 위험이 있었다. 그래서 기본값을 유지한 채 선택적 `rounded` prop만 추가했다.

```jsx
export default function Card({ as: Tag = 'div', className, rounded = 'rounded-3xl', children, ...props }) {
  return (
    <Tag className={cn(rounded, 'bg-white shadow-soft', className)} {...props}>
      {children}
    </Tag>
  );
}
```

`rounded` prop을 넘기지 않는 기존 호출부는 전부 예전과 똑같은 `rounded-3xl`을 그대로 받는다. 마이페이지의 계정 정보 카드와 `MySection`만 `rounded="rounded-2xl"`을 명시적으로 넘겨, 기존보다 한 단계 덜 둥근 모서리를 사용한다. `git status`로 다른 `<Card>` 사용처(`PublicPlaceCard.jsx` 등)를 확인한 결과 `rounded` prop을 넘기는 곳은 마이페이지 두 곳뿐이다.

### 4.4 세로 간격 — 여러 차례의 조정

카드 내부 세로 간격은 한 번에 확정되지 않고, 같은 세션 안에서 여러 차례 다시 다듬어졌다. 최종적으로 `MySection`의 자식 wrapper에 남은 주석이 그 과정을 그대로 설명한다.

> "Title→first-row gap = title's own pb-1 (4px) + this pt + the first row's own py-2 top (8px). Was 22px (pt-2.5, 10px); pt-[0.42rem] (~6.7px) brings the total to ~18.7px, ~85% of that 22px, without touching the row-to-row gap (each row's own py-2, unaffected) or the trailing space below the last row (pb-1.5 below, unaffected)."

정리하면 최종 간격 구조는 다음과 같다.

- **카드 제목 → 첫 번째 row**: 제목 자체의 `pb-1`(4px) + wrapper의 `pt-[0.42rem]`(약 6.7px) + row 자신의 `py-2` 상단(8px) = 약 18.7px.
- **row ↔ row**: 각 row의 `py-2` 하단(8px) + 다음 row의 `py-2` 상단(8px) = 16px.
- **카드 하단(마지막 row 아래)**: 마지막 row의 `py-2` 하단(8px) + wrapper의 `pb-1.5`(6px) = 14px.
- 세 섹션 카드(`나의 여행`/`나의 커뮤니티 활동`/`설정`) 모두 같은 `MySection`/`MyRow` 컴포넌트를 쓰므로 간격이 완전히 동일하다.
- 카드와 카드 사이 외부 간격은 `MySection` 자체의 `mt-3.5`로, 로그아웃 버튼도 같은 `mt-3.5`를 사용해 카드 간 리듬과 통일했다.

### 4.5 글자 색상 — 제목과 row 이름을 같은 회색으로 통일

`MySection`의 제목(`text-ink-soft`)과 `MyRow`의 항목명(`text-ink-soft`)이 정확히 같은 색상 클래스를 쓴다. `MyRow`의 주석에 그 이유가 남아 있다.

> "Same light gray as the title (text-ink-soft) — this used to be the count number's own color, now reused for both the section title and every row label so nothing in this card reads as heavier/darker than that."

즉 우측 숫자에만 쓰이던 연한 회색(`text-ink-soft`)을 카드 제목과 항목명 전체에 재사용해, 카드 안의 모든 텍스트가 하나의 색 위계로 보이도록 만들었다 — 완전한 검정(`text-black`/`#000000`)은 어디에도 쓰지 않았다. 우측 chevron은 `text-ink-faint`(더 옅은 보조색)를 그대로 유지해 항목명보다 한 단계 더 약하게 남았다.

### 4.6 로그아웃 버튼 — 저강조 스타일로 변경

```
이전: className="mt-6 w-full rounded-2xl border border-coral/70 bg-coral/10 py-3 text-sm font-bold text-coral shadow-[0_2px_6px_rgba(248,72,31,0.10)] active:opacity-75"
이후: className="mt-3.5 w-full rounded-2xl border-[1.5px] border-ink/12 bg-white py-3 text-sm font-bold text-ink-soft active:bg-ink/[0.03]"
```

코랄 테두리·배경·그림자·코랄 글자색을 전부 제거하고, 회원 탈퇴 화면(`DeleteAccountView.jsx`)의 "취소"/"뒤로가기" 버튼이 이미 쓰던 중립 스타일(`border-[1.5px] border-ink/12`, `text-ink-soft`)을 그대로 재사용했다. 로그아웃은 되돌릴 수 있는 일상적인 동작이라 강조할 필요가 없다는 판단이며, 코드 주석에도 "logout is a routine, reversible action (unlike account deletion)"이라고 명시했다. 위치(설정 카드 바로 아래, 서비스 안내 영역 위)와 버튼 높이(`py-3`)는 그대로다.

### 4.7 회원 탈퇴 경고 문구 — 코랄 계열로 완화

`src/features/profile/components/DeleteAccountView.jsx`의 "회원 탈퇴는 취소할 수 없습니다..." 경고 문단만 대상으로, 순수 빨강 계열을 앱이 이미 쓰던 코랄 토큰으로 바꿨다.

```
이전: className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-[0.8rem] leading-relaxed text-red-600"
이후: className="mt-4 rounded-xl bg-coral-tint px-3.5 py-3 text-[0.8rem] leading-relaxed text-coral-deep"
```

`bg-coral-tint`/`text-coral-deep`은 새로 만든 색이 아니라 `PostCard.jsx`/`PhrasesPage.jsx` 등에서 이미 반복적으로 쓰이던 기존 디자인 토큰이다. 경고 문구 자체(`t('my.deleteWarning')`)는 바꾸지 않아 경고의 의미는 그대로 유지된다. 이 화면의 다른 요소 — 실제 삭제 확인 버튼(`bg-red-600`), 삭제 실패 에러 메시지(`bg-red-50 text-red-600`) — 는 "돌이킬 수 없는 파괴적 동작"을 나타내는 용도로 판단해 의도적으로 손대지 않았다.

### 4.8 문의 이메일 변경

`my.footerContact` 값(ko/en/zh-CN 3개 locale 전부)의 이메일 주소를 바꿨다.

- 이전: `hello@matgil.app`
- 이후: `213999957+EclipticWin@users.noreply.github.com`

프로젝트 전체 검색으로 `hello@matgil.app`이 이 3개 `footerContact` 키 외에 다른 곳(로그인 예시, 테스트 데이터 등)에서 쓰이지 않음을 먼저 확인한 뒤 교체했다. 이메일 주소가 길어져 모바일 폭에서 카드 밖으로 튀어나가지 않도록, 해당 문단에 `break-all`을 추가했다(`<p className="mt-2 break-all text-xs leading-relaxed text-stone-400">`). `mailto:` 링크는 이 화면에 원래 없었고(순수 텍스트 표시), 이번에도 추가하지 않았다.

### 4.9 마이페이지 상단 제목과 하단 내비게이션 명칭

두 개의 서로 다른 dictionary 키가 각각 바뀌었다.

| 키 | 용도 | 이전(ko/en/zh-CN) | 이후(ko/en/zh-CN) |
|---|---|---|---|
| `my.title` | 마이페이지 상단 `PageHeader` 제목 | 내 여행 / Your trip / 我的旅程 | 마이페이지 / My Page / 我的页面 |
| `nav.you` | 하단 내비게이션 마지막 탭 라벨 | 내 정보 / You / 我的 | 마이페이지 / My Page / 我的页面 |

두 키 모두 값만 바꿨고 새 키를 만들지 않았다 — `nav.you`는 `BottomNavigation.jsx`가 참조하는 유일한 키임을 먼저 확인했고, 라우트(`ROUTES.my`)·아이콘(`UserIcon`)·활성/비활성 색상은 전혀 건드리지 않았다. `my.editProfile`("내 정보 수정")과 새로 만든 `my.travelSection`/`my.communitySection`/`my.settingsSection`("나의 여행"/"나의 커뮤니티 활동"/"설정") 등 다른 `my.*` 키는 이 변경과 무관하게 그대로다.

---

## 5. 라이브 추천 동선 제목 정책 개선

### 5.1 문제 — 같은 필터, 같은 제목

지도 탭에서 음식 필터를 적용해 여러 추천 동선을 생성하면, 실제 stop 구성이 서로 다른데도 다음처럼 완전히 같은 제목이 나오는 문제가 있었다.

```
Seoul City Hall Cafe & Dessert & Chinese Route
Seoul City Hall Cafe & Dessert & Chinese Route
Seoul City Hall Cafe & Dessert & Chinese Route
```

### 5.2 원인 — `getLiveRecommendedCourseTitle`의 우선순위

**파일**: `src/features/courses/utils/courseDisplay.js`

기존 로직은 `selectedFoodTypes`(사용자가 고른 필터 값)가 있으면 그것을 최우선으로 제목 주제(themeLabels)로 삼았고, 실제 stop의 `firstMenu`/`treatMenu`/카테고리 기반 후보(`buildThemeCandidatesFromStops()`)는 필터가 전혀 없을 때만 대체 사용됐다. 그 결과 같은 필터로 만들어진 모든 동선이 필터 라벨이라는 동일한 문자열을 제목에 쓰게 되어, 실제로는 서로 다른 가게로 구성된 동선들이 겉보기엔 구분되지 않았다.

### 5.3 수정 — 우선순위 반전

우선순위를 다음처럼 뒤집었다(§9 요구사항이 요구한 최종 정책과 동일).

1. **stop 기반 후보 최우선** — `buildThemeCandidatesFromStops(stops, locale, getCategoryLabel)`을 항상 먼저 호출한다. 이 함수 자체(그리고 그 안에서 쓰는 `getStopThemeCandidate`/`normalizeMenuCandidate`)는 **전혀 수정하지 않았다** — 스톱마다 최대 1개 후보(firstMenu → treatMenu → 카테고리 순)만 뽑아 모으는 기존 로직이 이미 "서로 다른 stop에서 후보를 우선 활용"하고 "한 가게의 firstMenu와 treatMenu만으로 제목 두 자리를 다 채우지 않는" 조건을 만족하고 있었기 때문이다.
2. **`selectedFoodTypes`는 stop 후보가 하나도 없을 때만 fallback** — `themeLabels.length === 0`일 때만 기존 필터 기반 로직(최대 2개, 중복 제거, `getCategoryLabel`로 현재 locale 라벨화)이 실행된다.
3. **그마저도 없으면** 기존과 동일한 "맛집"/"Food"/"美食" 기본값.

```js
const built = buildThemeCandidatesFromStops(stops, locale, getCategoryLabel);
let themeLabels = built.labels;
let candidateLabels = built.candidateLabels;
let source = built.source;
let categoryKeys = built.categoryKeys;

if (themeLabels.length === 0) {
  // ...selectedFoodTypes 기반 fallback (기존 로직 그대로, 실행 순서만 뒤로 이동)
}
```

`titleTheme`의 필드 구조(`source`/`categoryKeys`/`labelsByLocale`/`themeLabels`/`candidateLabels`)는 값이 채워지는 순서만 바뀌었을 뿐 그대로다 — `course_snapshot`에 저장되는 JSON 구조, `title_schema_version` 레거시 처리, `preference_keys`/`course_theme_key`의 의미는 전혀 손대지 않았다.

### 5.4 제목 충돌 해소 — 가게명 suffix 제거

**함수**: `resolveLiveCourseTitleCollisions` (같은 파일)

우선순위 반전과 별개로, 같은 화면에 표시되는 동선들의 제목이 우연히 겹칠 때 기존에는 다음 fallback이 있었다.

```js
const stopName = getLocalizedStopName(course.stops?.[0], locale);
if (stopName) {
  const auxTitle = `${course.title} — ${stopName}`;
  ...
}
```

이 블록을 완전히 제거했다. 최종 충돌 해소 정책은 다음 2단계뿐이다.

1. 이 동선 자신의 미사용 테마 후보(`titleTheme.candidateLabels` — 2개 캡을 넘겨 남은 stop 후보)로 두 번째 주제를 교체 시도.
2. 그래도 겹치면(교체 가능한 후보가 없으면) **동일한 제목을 그대로 허용** — 가게명, 숫자 접미사, 임의 형용사 어느 것도 붙이지 않는다.

```js
finalTitles.add(course.title);
return course;
```

이 정책 덕분에 이제 제목은 항상 `동선`/`Route`/`路线`로 끝나며, `... Route — Gwanghwamun Gukbap`처럼 가게명이 뒤에 붙는 경우가 구조적으로 나타나지 않는다. `appendCourseSequenceNumber()`(숫자 접미사 함수)는 docs/56 때부터 이미 어디서도 호출되지 않는 죽은 함수였고, 이번에도 호출부를 추가하지 않았다.

### 5.5 변경하지 않은 것

`courseBuilder.js`의 추천 점수 계산 8종(`calcClusterScore`/`calcDiversityScore`/`calcCafeBonus`/`calcDataQualityScore`/`calcStartAccessScore`/`calcWeakOtherPenalty`/`calcScore`), `combinations`/`selectCandidates`, `usedIds`/`maxCourses`, course id, stop 조합·순서·거리·시간·식당/카페 수, 필터 적용 결과 — 이번 구간에서 이 파일 자체를 전혀 수정하지 않았다(`git status`상 `courseBuilder.js`는 변경 목록에 없음). 제목 문자열을 만드는 `courseDisplay.js`만 수정했다.

---

## 6. 여행자픽 공개 가게 카드 — 가게명 색상 통일

**파일**: `src/features/courses/components/PublicPlaceCard.jsx`

공개 가게 카드의 가게명이 공개 동선 카드의 제목보다 눈에 띄게 진하게(거의 완전한 검정에 가깝게) 보인다는 문제를 고쳤다.

```
이전: <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink">{place.name}</p>
이후: <p className="line-clamp-2 text-[0.95rem] font-bold leading-snug text-ink/90">{place.name}</p>
```

`PublicCourseCard.jsx`의 동선 제목(`<h3>`)이 순위 배경이 없는 기본 상태(4위 이하·최신순)에서 쓰는 색상이 정확히 `text-ink/90`이다 — 새 색을 고르지 않고 그 클래스를 그대로 재사용했다. `font-size`(`text-[0.95rem]`)와 `font-weight`(`font-bold`)는 그대로이며, 인기순 1~3위/4위 이하, 인기순/최신순 어느 경우에도 이 `<p>` 자체는 조건부 스타일이 없어(순위 색상 영역은 별도 상단 블록에만 적용되고 가게명은 항상 흰색 본문 안에 있음) 모든 경우에 동일하게 적용된다. 가게 상세 페이지 제목, 저장한 가게 카드, 지도 장소 카드는 이 파일과 무관해 전혀 손대지 않았다.

---

## 7. 이번 구간 검증 결과

각 하위 작업이 끝날 때마다 다음을 반복 실행했다.

| 항목 | 결과 |
|---|---|
| `npm run build`(매 단계) | 전부 성공. 마이페이지 재개편 중 `StatCard.jsx` 삭제로 모듈 수가 일시적으로 줄었고(223→221), 이후 저장 표현 기능(이 문서 범위 밖) 작업에서 다시 늘었다. 기존 CSS 압축 경고 1건(`Expected identifier but found "-"`) 외 신규 오류 없음 |
| `git diff --check`(매 단계) | 전부 통과 — CRLF 안내만 존재, 실제 whitespace 오류 없음 |
| DB/SQL/RPC diff | 없음 — 이번 구간 전체에서 Supabase 관련 코드를 전혀 수정하지 않았다 |
| 다른 화면 회귀 확인 | `Card` 컴포넌트의 다른 사용처(`PublicPlaceCard.jsx`/`PostCard.jsx`/`PopularPlaceCard.jsx`/`RecommendationCard.jsx`/`SavedPlaceCard.jsx`/`PhrasesPage.jsx`)가 `rounded` prop을 넘기지 않아 기존 `rounded-3xl` 그대로임을 매번 확인. `tracking-wide` 등 다른 화면의 기존 클래스도 무관하게 유지 |
| 다른 worktree(`sprightly-pondering-owl`) | 매 단계 확인, 이번 구간에서 한 번도 수정하지 않음 |
| 패키지 설치 여부 | 없음(`package.json` 무변경) |

### 미검증(승인된 한계)

이 환경에는 브라우저 자동화 도구가 없어(패키지 설치 금지), 아래는 코드/빌드 기준으로만 확인했고 실제 렌더링·조작은 확인하지 못했다.

- 마이페이지 세 카드의 실제 간격 체감(제목↔첫 row가 row↔row보다 좁아 보이는지)과 색상 통일감
- 로그아웃 버튼이 실제 화면에서 과하게 눈에 띄지 않는지
- 회원 탈퇴 경고 문구의 실제 색감(코랄 톤이 의도한 만큼 부드러운지)
- 지도 필터 적용 후 실제로 생성되는 여러 추천 동선의 제목이 실제 stop 구성 차이에 따라 달라지는지(같은 필터, 다른 stop 조합 시나리오)
- 여행자픽 가게 카드 가게명의 실제 색상 체감이 동선 카드 제목과 정말 같아 보이는지
- ko/en/zh-CN 각 언어에서의 실제 레이아웃 줄바꿈

---

## 8. 변경 파일 종합 (이 문서 범위)

| 파일 | 비고 |
|---|---|
| `src/pages/MyPage.jsx` | `StatCard` 사용을 `MySection`/`MyRow` 두 로컬 컴포넌트로 전면 교체, 세로 간격 여러 차례 조정, 로그아웃 버튼 저강조 스타일, 문의 이메일 문단에 `break-all` 추가 |
| `src/shared/components/Card.jsx` | 선택적 `rounded` prop 추가(기본값 `rounded-3xl` 유지로 다른 화면 무영향) |
| `src/features/profile/components/StatCard.jsx` | 삭제 — 마이페이지 재개편 이후 더 이상 어디서도 사용되지 않음을 확인한 뒤 제거 |
| `src/features/profile/components/DeleteAccountView.jsx` | 회원 탈퇴 경고 문단만 `bg-red-50`/`text-red-600` → `bg-coral-tint`/`text-coral-deep` |
| `src/features/courses/utils/courseDisplay.js` | `getLiveRecommendedCourseTitle`의 stop-vs-필터 우선순위 반전, `resolveLiveCourseTitleCollisions`의 가게명 suffix fallback 제거 |
| `src/features/courses/components/PublicPlaceCard.jsx` | 가게명 색상 `text-ink` → `text-ink/90`(공개 동선 제목과 통일) |
| `src/shared/i18n/dictionary.js` | `nav.you`, `my.title` 값 변경(ko/en/zh-CN), `my.footerContact` 이메일 변경(ko/en/zh-CN), `my.travelSection`/`my.communitySection`/`my.settingsSection` 신규 키 추가(ko/en/zh-CN) |

`docs/57` 및 그 이전에 이미 완성된 여행자픽 공개 동선·가게 목록, 순위·메달 UI, 150개 제한, 필터 최대 3개 모달, Flaticon 저작자 표시 관련 파일(`PublicRoutesTab.jsx`, `PublicCourseCard.jsx`, `publicFeedService.js`, `FilterSheet.jsx`, `FoodTypeLimitModal.jsx` 등)은 이 구간에서 다시 수정하지 않았다 — `git status`로 확인한 결과 이 문서 작성 시점 기준 위 목록에 없는 파일은 전부 무변경이다.

이 문서가 다루지 않는 저장한 표현/게시글 카테고리 관련 신규·수정 파일(`SavedPhrasesPage.jsx`, `SavedPhrasesTab.jsx`, `phraseBookmarkService.js`, `phraseService.js`, `communityConstants.js`, `MyPostsView.jsx`, `routes.js`의 `mySavedPhrases`, `router.jsx`의 관련 import/Route, `dictionary.js`의 `my.phrasesSection`/`savedPhrases.*`)와, 이번 세션과 무관한 기존 미커밋 변경(일본어 "준비 중" 안내 관련 `LanguageModal.jsx`/`exploreOptions.js`/`JapaneseComingSoonModal.jsx`/`HomePage.jsx` 일부)은 §3에서 밝힌 대로 이 표에서 제외했다.

---

## 9. 성능·N+1·DB 확인

- 마이페이지 재개편은 순수 UI 계층 변경이다 — `fetchMyActivityCounts`/`fetchMySavedCounts` 호출 횟수, 호출 위치, 의존성 배열(`useCallback`/`useEffect`)을 전혀 건드리지 않았다. 화면에 숫자를 그리지 않을 뿐, 데이터 조회는 기존과 동일하게 페이지당 각각 1회씩 이루어진다.
- 라이브 추천 동선 제목 로직 변경은 이미 함수 인자로 들어와 있는 `stops`/`selectedFoodTypes`/`getCategoryLabel`만 사용하며, 새로운 Supabase 호출이나 추가 조회를 만들지 않았다. `buildThemeCandidatesFromStops()`가 매 스톱을 순회하는 것은 기존과 동일한 순수 JS 연산(추천이 이미 메모리에 들고 있는 stops 배열에 대한 순회)이고, 네트워크 요청이 아니다.
- `PublicPlaceCard.jsx`의 색상 변경은 클래스명 하나만 바뀐 것으로 데이터 조회 경로에 영향이 없다.
- DB/SQL/RPC/RLS는 이 구간에서 전혀 수정하지 않았다.

---

## 10. git 상태 (이 문서 작성 시점 기준)

- current branch: `main`
- 실제 실행 워크트리: `C:/Workspace/GitWorkspace/matgil`(다른 worktree `sprightly-pondering-owl`은 이번 구간 전체에서 한 번도 수정하지 않음, `git worktree list`로 재확인)
- HEAD: `79e3226`(`feat: 여행자픽 공개 동선·가게 랭킹, 저장 목록 마이페이지 이동, 순위·필터 UX 정리`, docs/57과 함께 커밋된 상태) — 이 문서 작성 시점까지 그 이후 `git add`/`commit`/`push` 없음
- 워킹 디렉터리에는 이 문서가 다루는 §4~§6의 완료 작업, §3에서 제외한 저장한 표현/게시글 카테고리 진행 중 작업, 그리고 이번 세션과 무관한 기존 미커밋 변경(일본어 안내 관련)이 함께 섞여 있다
- 이 문서 작성 자체를 포함해 이번 구간 전체에서 아직 `git add`/`commit`/`push`를 수행하지 않았다(문서 작성 직후 별도로 진행)

---

## 11. 후속 과제

- §7의 미검증 항목 전체에 대한 실기기 확인
- 저장한 표현 페이지 및 내가 쓴 글 카테고리 표시 작업 완료 후 별도 작업일지 작성(이번 문서 범위에서 의도적으로 제외)
- 커뮤니티 글에 가게 위치를 추가하는 기능 — 아직 조사·설계 전
- 일본어("준비 중") 안내 관련 미커밋 변경(`HomePage.jsx` 일부 포함) — 이번 구간과 무관하므로 별도로 검토·커밋 필요
