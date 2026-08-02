# 68. 로그인 화면 테스트 계정 기본값 및 가게 리뷰 화면(전체 보기) 개편

- 작성일시: 2026-08-02 오후 5:43 (KST)

---

## 1. 목적

- 직전 작업일지: `docs/67-community-feed-pagination-infinite-scroll-and-pull-to-refresh.md`
- `docs/67`이 포함된 마지막 커밋: `e01fe7c`(`docs: 67번 작업일지 저자 검토 반영(파일 목록·빌드·커밋 결과 섹션 정리)`)
- 조사 시작 시점 로컬 `HEAD`, `origin/main`, `origin/HEAD`가 모두 `e01fe7c`로 정확히 일치했다(Git 확인, `git rev-parse HEAD`/`git rev-parse origin/main`, `git log --oneline --decorate -20`).
- `git log origin/main..HEAD`와 `git log HEAD..origin/main` 모두 빈 결과 — **`docs/67` 이후 이미 커밋·푸시된 중간 커밋은 없다**(Git 확인). 즉 이번 문서가 다루는 변경은 전부 `e01fe7c` 위의 **미커밋 working tree 변경**이며, staged된 내용도 없다(`git diff --cached --name-status` 결과 없음).
- `git status --short` 기준 수정 파일 9개, 신규(untracked) 파일 1개(Git 확인). 서로 관련 없는 두 변경 그룹으로 나뉜다 — 로그인 화면(그룹 1), 가게 리뷰 화면(그룹 2). 두 그룹은 파일이 겹치지 않는다.
- `docs` 디렉터리의 기존 작업일지 중 최대 번호는 67이므로 이번 문서 번호는 68로 정했다(Git/파일 확인).

---

## 2. 로그인 화면 테스트 계정 기본값

### 2.1 배경 또는 기존 상태

- `src/features/auth/components/LoginForm.jsx`의 이메일·비밀번호 입력은 기존에 빈 문자열로 시작했다(코드 확인, `git diff` 기준 이전 값 `useState('')` 2건).

### 2.2 수정 내용

- 수정 파일: `src/features/auth/components/LoginForm.jsx` (코드 확인)
- 이메일 기본값을 `matgiluser@gmail.com`, 비밀번호 기본값을 `test1234$$`로 변경(각각 `useState(...)` 초기값).
- 이메일·비밀번호 입력 필드의 `autoComplete` 속성을 각각 기존 `"email"`/`"current-password"`에서 `"off"`로 변경 — 브라우저 저장 자격 증명 자동완성이 위 기본값을 덮어쓰지 않도록 하기 위한 변경(코드 확인).
- 로그인 처리 로직(`handleLogin`, `useAuth().login`), 소셜 로그인 처리, 에러 메시지 매핑, 비밀번호 `type="password"` 마스킹은 변경되지 않았다(코드 확인, diff에 해당 부분 없음).
- 페이지 진입 시 자동으로 로그인을 시도하는 코드(예: 마운트 시 `login()` 호출, 자동 제출)는 이 diff와 파일 전체(`LoginForm.jsx`) 어디에도 없다(코드 확인) — 값은 입력창에 미리 채워질 뿐, 제출은 로그인 버튼 클릭(`handleLogin`, `onSubmit`)으로만 일어난다.

### 2.3 테스트

- `npm run build` 성공(4번 항목 "전체 검증 요약" 참고).
- 실제 브라우저·모바일 기기에서 입력창에 값이 채워진 채로 표시되는지, 자동완성이 값을 덮어쓰지 않는지는 이 환경에 브라우저 실행 도구가 없어 **직접 확인하지 못했다.**

### 2.4 남은 것

- 없음(코드·빌드 기준으로 확인 가능한 범위 내에서 완료).

---

## 3. 가게 리뷰 화면(전체 보기) 개편

### 3.1 배경 또는 기존 상태

`docs/67` 시점 기준 `src/pages/PlaceReviewsPage.jsx`는 헤더(뒤로가기·REVIEWS 라벨·가게명)만 있었고 공유 버튼과 주소 표시가 없었다. 평점 요약은 평균 별점 숫자와 `/ 5`가 각각 다른 줄에, 5→1점 분포 막대가 그 옆에 있는 단순 카드였고, 배지(평점 기반/저장 수)는 없었다. 정렬 UI는 없었고 항상 `created_at` 내림차순 고정이었다(`fetchPlaceReviews`에 `sort` 매개변수 없음). 작성 버튼은 `Button` 공용 컴포넌트를 그대로 쓴 fit-content 크기였고, "최근 방문 유도" 카드도 없었다(이상 코드 확인, `git diff` 기준 제거된 이전 코드).

### 3.2 수정 내용

**수정/신규 파일**(코드 확인)
- `src/pages/PlaceReviewsPage.jsx` — 수정(전면 재구성)
- `src/features/places/components/RatingStatsCard.jsx` — 신규
- `src/features/explore/components/PlaceDetailSheet.jsx` — 수정
- `src/features/places/components/ReviewCard.jsx` — 수정(1줄)
- `src/features/places/components/ReviewComposer.jsx` — 수정(안내 문구 1단락 추가)
- `src/features/places/services/placeReviewService.js` — 수정(`fetchPlaceReviews`에 `sort` 매개변수)
- `src/shared/components/Icon.jsx` — 수정(`PlusIcon` 추가)
- `src/shared/utils/shareUtils.js` — 수정(`buildPlaceReviewsShareUrl`, `shareOrCopyLink` 추가)
- `src/shared/i18n/dictionary.js` — 수정(ko/en/zh-CN 키 추가)

**헤더 — 주소·공유**
- `PlaceReviewsPage.jsx` 헤더에 가게 주소(`placeAddress`, 한 줄로 말줄임)와 공유 버튼을 추가했다. 주소는 `PlaceDetailSheet.jsx`가 리뷰 화면으로 이동할 때 라우터 state로 `placeAddress: place.address`를 함께 넘기거나(코드 확인), 딥링크로 직접 들어온 경우 `getPlaceById()`로 다시 조회해 채운다.
- 공유는 `shareUtils.js`의 신규 `buildPlaceReviewsShareUrl(placeId)`(`/places/:placeId/reviews`, `import.meta.env.BASE_URL` 반영)와 신규 `shareOrCopyLink({url, title, text})`(Web Share API 우선, 실패/미지원 시 클립보드 복사)를 사용한다. `PlaceDetailSheet.jsx`의 기존 공유 버튼도 같은 `shareOrCopyLink()`를 쓰도록 바뀌어, 두 화면이 동일한 공유 로직을 공유한다(코드 확인).

**평점 통계 카드 — `RatingStatsCard.jsx`(신규 컴포넌트)**
- 좌(약 35%, `flex-[35]`)·우(약 65%, `flex-[65]`) 2열 구조: 왼쪽은 평균 평점과 `/ 5`가 한 줄, 그 아래 별 채움 행, 그 아래 "리뷰 N개 기준" 문구. 오른쪽은 5→1점 막대(각 줄에 점수·막대·해당 점수 리뷰 개수).
- 별 채움은 빈 별 5개(연한 `text-ink/15`) 위에 코랄 별 5개 레이어를 겹치고, 코랄 레이어에 `overflow-hidden` + `width: (rating/5*100)%`를 적용하는 방식이다(코드 확인, `StarRatingRow` 함수). `Math.round`/`Math.floor` 없이 비율을 그대로 폭에 반영한다.
- 카드 하단에 평점 기반 배지(최대 1개, `computeRatingBadgeKey()`가 계산)와 저장 수 배지가 별도의 가로 행으로 표시된다. 각 배지는 `whitespace-nowrap`.
- `computeRatingBadgeKey({distribution, reviewCount})`: `reviewCount <= 1`이면 `badgeNotEnoughReviews`, 전체가 5점이면 `badgeAllFiveStars`, 4점 이상 비율이 0.8 이상이면 `badgeMostlyPositive`, 그 외에는 배지 없음(코드 확인). 부정적으로 읽힐 수 있는 배지는 코드에 존재하지 않는다.
- 카드 자체는 `reviewCount`가 0 이하이면 `null`을 반환해 렌더링되지 않는다(코드 확인).
- 카드에 `border border-solid border-ink/15`가 있다(코드 확인).
- 이 카드는 리뷰 목록만 있는 상태와 리뷰 작성 폼이 열린 상태 모두에서 동일한 위치(폼 토글 블록보다 앞)에 동일한 props로 한 번만 렌더링된다(코드 확인, `PlaceReviewsPage.jsx`에서 `<RatingStatsCard .../>` 호출이 1곳).

**정렬 — `fetchPlaceReviews` + `SortDropdown`**
- `placeReviewService.js`의 `fetchPlaceReviews`에 `sort`('latest' 기본값 | 'oldest') 매개변수가 추가됐다. `sort==='oldest'`이면 `created_at`/`id` 오름차순으로 정렬하고, 커서 비교 연산자도 `lt`→`gt`로 바뀐다(코드 확인). 정렬 변경 시 `PlaceReviewsPage.jsx`의 `sort` state가 바뀌면서 `loadFirstPage`(useCallback, `sort`가 deps에 포함)가 다시 실행되어 서버에서 첫 페이지부터 새로 조회한다 — 이미 불러온 페이지를 클라이언트에서 재정렬하지 않는다(코드 확인).
- `PlaceReviewsPage.jsx` 안에 정의된 `SortDropdown` 컴포넌트: "Newest ⌄" 형태로 현재 선택된 정렬 1개만 표시하고, 클릭하면 Newest/Oldest 2개 항목의 드롭다운이 열린다(외부 클릭·Esc로 닫힘, `ReviewCard.jsx`의 기존 메뉴 열고닫기 패턴과 동일한 구조). 화살표는 `ChevronRightIcon`을 `rotate-90`(시계 방향)으로 돌려 아래를 향하게 했다(코드 확인). 트리거·메뉴 모두 코랄 색을 쓰지 않는다.

**"All reviews" 행**
- "All reviews" 라벨(`text-ink-soft`)과 리뷰 수 숫자(`text-ink-faint`)를 별도의 `<span>`으로 렌더링하고 `flex gap-2`로 간격을 준다(문자열 결합이나 공백 문자를 쓰지 않음, 코드 확인). 괄호 없이 숫자만 표시한다.

**리뷰 작성 버튼 + 최근 방문 유도 카드**
- 작성 버튼: `w-full`, 높이 `h-12`, 코랄 배경, 흰 글자, `PencilIcon` 포함, 그림자 없음(코드 확인). 문구는 신규 키 `placeDetail.writeReviewFull`.
- 표시 조건은 기존 로직 그대로다: `!myReviewLoading && !myReview`일 때만 노출(코드 확인) — 로그인 사용자가 해당 가게에 이미 활성 리뷰를 갖고 있으면(=`fetchMyPlaceReview` 결과가 있으면) 버튼을 그리지 않는다. 이 "사용자당 가게당 리뷰 1개" 제한 자체는 이번 변경으로 새로 만든 것이 아니라 기존 `fetchMyPlaceReview` 조회 결과를 그대로 재사용한다(코드 확인). 비로그인 사용자는 클릭 시 기존 `openAuthPrompt({messageKey:'placeDetail.loginToReview', ...})` 흐름으로 이어진다(코드 확인, 변경 없음).
- "Been here recently?" 카드(`RecentVisitPromptCard`): 코랄 톤 원형 배경 안의 `PlusIcon`(37px 원, 17px 아이콘), 제목, 설명으로 구성되고, 카드 전체가 버튼이며 클릭 시 작성 버튼과 동일한 `handleWriteClick`을 호출한다(코드 확인). `border border-dashed border-ink/15`(일반 CSS 점선)이며, `reviewCount > 0`이고 작성 버튼이 표시 가능한 조건일 때만 렌더링된다 — 리뷰 0개인 빈 상태에서는 표시되지 않는다(코드 확인).
- 최종 렌더링 순서(코드 확인, `PlaceReviewsPage.jsx` JSX 순서): 헤더(뒤로가기/공유·REVIEWS 라벨·가게명·주소) → 평점 통계 카드 → "All reviews" + 정렬 행 → 작성 버튼(또는 열려 있으면 `ReviewComposer`) → 최근 방문 유도 카드(조건부) → 리뷰 카드 목록.

**리뷰 카드·작성 폼**
- `ReviewCard.jsx`의 별점 배지가 정수(`{rating}`)에서 소수점 한 자리(`{Number(rating).toFixed(1)}`)로 바뀌었다. 그 외 사용자 아이콘, 닉네임, 작성일, 본문, 카드 테두리/여백, 본인 리뷰 수정·삭제 메뉴는 diff에 변경이 없다(코드 확인).
- `ReviewComposer.jsx`에 다국어 안내 문구 한 단락이 추가됐다(`placeDetail.reviewUsageNotice`, 사진 안내 아래·에러 메시지/버튼 위, `text-ink-faint` 보조 문구 톤). 별점 선택·본문·사진 3장 제한·글자 수·취소/등록 버튼 등 나머지 구조는 diff에 변경이 없다(코드 확인).
- 다국어 키 추가(ko/en/zh-CN 3개 로케일 모두, `dictionary.js` 확인): `reviewUsageNotice`, `sortLatest`, `sortOldest`, `badgeNotEnoughReviews`, `badgeAllFiveStars`, `badgeMostlyPositive`, `savedByCount`, `recentVisitPromptTitle`, `recentVisitPromptBody`, `writeReviewFull`.

**저장 수 배지**
- `PlaceReviewsPage.jsx`가 기존 `fetchPlaceBookmarkCount(placeId)`(`placeBookmarkService.js`, `get_place_bookmark_count` RPC 호출 — `PlaceDetailSheet.jsx`가 쓰는 것과 같은 함수)를 호출해 `saveCount` state를 채우고, `RatingStatsCard`에 전달한다(코드 확인). 새 테이블·집계 컬럼·RPC는 추가되지 않았다. 저장 수가 0이면 배지 자체가 표시되지 않는다(코드 확인, `saveCount > 0` 조건).

**가게 상세 화면(`PlaceDetailSheet.jsx`)**
- 공유 로직이 `shareOrCopyLink()`를 쓰도록 리팩터링됐다(위 참고). 리뷰 섹션의 `SectionHeader`가 `action` prop(선택적 우측 버튼)을 받도록 바뀌었고, 리뷰가 1개 이상이면서 본인이 아직 안 쓴 경우 제목 오른쪽에 소형 "리뷰 작성하기" 버튼이 표시된다(코드 확인). 목록 하단(“모두 보기” 링크 옆)에 있던 기존 작성 버튼은 제거돼, 같은 화면에 작성 버튼이 두 번 나오지 않는다. 리뷰가 0개인 빈 상태의 큰 CTA는 그대로 있다. 리뷰 목록·수정·삭제·좋아요 등 나머지 로직은 diff에 변경이 없다(코드 확인).

### 3.3 테스트

- `npm run build` 성공(4번 항목 참고).
- 실제 브라우저·모바일 기기에서의 렌더링(별 채움 비율, 배지 줄바꿈, 드롭다운 동작, 카드 여백 등)은 이 환경에 브라우저 실행 도구가 없어 **직접 확인하지 못했다.**
- Supabase 쪽 `mg_place_reviews`/`mg_place_review_stats`/`get_place_bookmark_count` RPC의 실제 동작(DB 조회 결과, RLS)은 이번 세션에서 별도로 조회하지 않았다 — `docs/sql-place-detail-bookmark-review-2026-07-12.md`에 기록된 기존 스키마·정책을 코드가 그대로 호출하고 있음만 코드 확인했다.

### 3.4 남은 것

- 위 "테스트" 항목의 실기기/브라우저 확인, Supabase 실데이터 확인이 남아 있다.

---

## 4. 전체 검증 요약

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공 (exit 0, 234 modules transformed) |
| CSS 압축 경고 | 1건(`Expected identifier but found "-"`, `-: T.Z;`) — `docs/64`~`docs/66`에 동일 문구로 기록된 기존 경고와 위치·문구 일치, 이번 변경과 무관 |
| `git diff --check` | 통과(exit 0). 출력은 여러 파일의 "LF will be replaced by CRLF" 경고뿐, 공백/충돌 오류 없음 |
| 충돌 마커(`<<<<<<<`/`=======`/`>>>>>>>`) | `src` 전체 검색 결과 0건 |
| `package.json` 테스트 스크립트 | 없음(`dev`/`build`/`preview`만 존재) — 테스트 실행 안 함 |
| 실제 브라우저·모바일 확인 | 하지 않음(환경에 브라우저 실행 도구 없음) |
| Supabase DB·RLS·RPC 실데이터 확인 | 하지 않음(기존 스키마 문서와 코드 호출부만 코드 확인) |
| 커밋·푸시 | 이 문서 작성 시점 기준 아직 미실행 — 아래 5번 이후 진행 |

---

## 5. 사용자가 직접 확인해야 하는 남은 항목

- 로그인 화면에서 기본값이 실제로 입력창에 채워져 보이는지, 브라우저 자동완성이 값을 덮어쓰지 않는지 실기기에서 확인.
- 가게 리뷰 화면(리뷰 0개/1개/여러 개, 평균 4.5 등 소수점 평점, 정렬 드롭다운, 공유 버튼, Been here recently 카드)을 실제 모바일 폭에서 확인.
- 저장 수 배지·평점 배지가 실제 Supabase 데이터로 의도한 문구와 조건으로 나타나는지 확인.
