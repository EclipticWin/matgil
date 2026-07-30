# 65. 장소 저장 수 집계 경로 수정 및 Traveler Picks 비로그인 티저 UX 개선

## 1. 작업 일시

- 작성일시: 2026-07-30 PM 11:43 (KST)
- `git rev-parse HEAD` = `43a55175d4c1df3600a817a019b3ad692e668422` — `docs/64`를 포함해 커밋한 바로 그 커밋이며, 이번 문서가 다루는 변경은 전부 이 커밋 위의 **미커밋 working tree 변경**이다.

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md`
- 기준 커밋: `43a5517` (`fix: 공공데이터 이미지 출처 대응 및 Traveler Picks 무한 스크롤 개선`) — `git log`로 확인한 결과 `docs/63`과 `docs/64`를 포함해 이 커밋에 함께 반영되어 있으며(§16.1의 `git show --stat` 참고), 현재 `HEAD`와 일치한다.
- 조사 범위: `43a5517` 이후 **커밋 없이** working tree에 누적된 모든 변경(`git status --short`, `git diff HEAD` 전체 재확인).
- 조사 시점 저장소 상태:
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`
  - `git rev-parse HEAD` = `43a55175d4c1df3600a817a019b3ad692e668422`
  - `git status --short`: 수정(M) 5개, untracked(??) 4개(이번 작업 대상 3개 + 기존 무관 zip 1개) — §15에 전체 표로 정리.
- **`docs/64`에 적힌 당시 상태(§17: "`HEAD` = `9158147`, 미커밋")는 이 문서 작성 시점 기준 더 이상 유효하지 않다.** 그 사이 사용자가 직접 `docs/64`를 포함한 23개 파일을 커밋·푸시했고(`43a5517`), 이번 조사는 그 커밋 이후 새로 쌓인 변경만을 대상으로 한다.

이번 문서는 대화 중 순차적으로 진행된 세 가지 작업 — (A) 동선 상세 카드의 장소 저장 수 표시 오류 수정, (B) Traveler Picks 비로그인 5개 제한에 대한 안내 UX 추가, (C) 그 안내 UI를 독립 CTA 카드에서 스켈레톤 티저 카드로 재설계하는 3차례의 반복 수정 — 을 실제 코드·diff 기준으로 재구성한다.

---

## 3. 작업 배경과 발견된 문제

대화 맥락과 코드 조사로 확인되는 배경은 다음과 같다.

- **사용자 보고(대화상)**: 동선 상세 화면(가게 상세는 정상)의 각 음식점 카드에서 저장(좋아요) 수가 0 또는 미표시로 나타남 — 최초에는 원인 조사만 지시받았고(수정 금지), 원인 확인 후 별도 승인을 받아 수정했다.
- **사용자 보고(대화상)**: 위 수정 직후 Traveler Picks(Routes/Places)에서 최초 5개 이후 무한 스크롤이 동작하지 않는 "회귀"가 발생했다고 보고됨 → 조사 지시.
- **코드 조사 결과**: 좋아요 수 수정 파일(`placeBookmarkService.js`)과 Traveler Picks 페이지네이션 파일(`PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`) 사이에 import/호출 연결이 전혀 없음을 grep으로 확인 — 두 작업은 코드상 무관함을 먼저 확정했다(§12).
- **사용자 정정(대화상)**: 이후 사용자가 실제 문제를 재정의함 — 무한 스크롤 메커니즘 자체는 로그인 상태에서 정상이며, 문제는 "비로그인 사용자는 5개까지만 보이는데 그 이유와 다음 행동(로그인)을 알려주는 UI가 사라져 오류처럼 보인다"는 UX 문제였다. 이 진술은 사용자가 이번 대화에서 명시적으로 전달한 내용이며, 이 세션 안에서 실제 콘솔 로그 원문이나 화면 캡처가 공유된 기록은 없다 — 즉 "로그인 상태 무한 스크롤 정상"은 **사용자 진술(대화상 확인)**이지, 이 문서 작성자가 직접 재현해 확인한 사실이 아니다.
- 이 정의에 따라 (B) 비로그인 안내 CTA, (C) 그 CTA의 시각 디자인 반복 개선이 이어졌다.

---

## 4. 조사 과정과 원인 분석 개요

- (A)는 `docs/61 §7`에서 `PlaceDetailSheet.jsx`가 이미 `get_place_bookmark_count` RPC로 전환된 이력이 있음을 확인한 뒤, 배치 조회 함수(`fetchPlaceBookmarkStatsBatch`)만 예전 VIEW 직접 조회 경로에 남아있었다는 사실을 코드 대조로 확정했다(§5).
- (B)/(C)는 세 차례의 반복으로 진행되었다 — 최초 구현(독립 CTA 카드) → 스켈레톤 티저 카드 1차 구현(오버레이가 스켈레톤을 완전히 가림) → 레이어 분리·명도 조정 2차 수정(과도한 대비로 CTA와 시각적으로 경쟁) → 최종 부드러움 조정(§10~§11). 이 반복 자체가 "보고만으로 완료 판단하지 않고 최종 코드 값을 확인"해야 하는 근거이며, 이 문서는 각 라운드의 실제 최종 className 값만을 "현재 상태"로 기록한다.

---

## 5. 장소 저장 수 표시 문제 (A)

### 5.1 증상과 초기 가설

- 증상: 동선 상세(실시간 추천 동선, Traveler Picks 공개 동선 상세, 저장 동선 상세) 카드의 저장 수가 0/누락. 가게 상세(`PlaceDetailSheet.jsx`)는 정상.
- 초기 가설(대화상 요청에 포함): 필드명 불일치, ID 타입(string/number) 불일치, 캐시 갱신 누락, RLS 등 다수.

### 5.2 코드 조사로 확정된 원인

`src/features/places/services/placeBookmarkService.js`를 `git diff HEAD`로 대조한 결과, `fetchPlaceBookmarkStatsBatch`가 아래처럼 바뀌었다.

**변경 전(코드 확인, `git diff` 기준)**
```js
export async function fetchPlaceBookmarkStatsBatch(placeIds) {
  const uniqueIds = [...new Set((placeIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('mg_place_bookmark_stats')
    .select('place_id, save_count')
    .in('place_id', uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.place_id, row.save_count]));
}
```

**변경 후(현재 코드, `placeBookmarkService.js:68-73`)**
```js
export async function fetchPlaceBookmarkStatsBatch(placeIds) {
  const uniqueIds = [...new Set((placeIds ?? []).map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (uniqueIds.length === 0) return new Map();
  const counts = await Promise.all(uniqueIds.map((id) => fetchPlaceBookmarkCount(id)));
  return new Map(uniqueIds.map((id, index) => [id, Number(counts[index]) || 0]));
}
```

- `fetchPlaceBookmarkCount(id)`는 같은 파일에 이미 있던 함수로, `supabase.rpc('get_place_bookmark_count', { p_place_id })`를 호출한다(코드 확인, `placeBookmarkService.js:32-42`) — `PlaceDetailSheet.jsx`가 저장 수 조회에 쓰는 것과 **동일한 RPC**다(코드 확인, `PlaceDetailSheet.jsx:31,195`).
- 즉 수정 방향은 "장소별 RPC를 병렬(`Promise.all`) 호출해 배치 결과를 만드는 것"이며, 새 VIEW·RPC·SQL 마이그레이션은 추가되지 않았다(저장소 내 신규 SQL 파일 없음, `git status`에도 없음).
- 코드 주석(§삭제된 이전 버전의 doc comment 및 현재 버전 doc comment)에는 "`mg_place_bookmark_stats` VIEW가 `security_invoker=true`(docs/42 §3)로 생성되어 있어, VIEW를 직접 조회하면 호출자 자신의 RLS 하에서 `count(*)`가 실행되어 실제 전체 저장 수가 아니라 호출자가 볼 수 있는 행만 집계된다"는 설명이 있다. **이 RLS 인과관계 자체는 이번 세션에서 SQL로 재검증하지 않았고, `docs/42`/`docs/61`의 과거 기록에 근거한 추론이다** — 코드 확인 사실은 "조회 경로가 VIEW 직접 조회에서 RPC 병렬 호출로 바뀌었다"는 것이고, "그 이유가 RLS 때문"이라는 설명은 과거 문서에 근거한 정황 추론으로 구분해 기록한다.

### 5.3 호출부 확인 — 4개 화면의 조회 경로

`grep -rn "fetchPlaceBookmarkStatsBatch\|fetchPlaceBookmarkCount\|get_place_bookmark_count"`로 전수 확인한 결과(코드 확인).

| 화면 | 파일 | 호출 함수 | 최종 경로 |
|---|---|---|---|
| 가게 상세 | `PlaceDetailSheet.jsx` | `fetchPlaceBookmarkCount(place.id)` (단건) | `get_place_bookmark_count` RPC (변경 없음, 원래부터 RPC 경로) |
| Map 실시간 추천 동선 상세 | `TodayCourseDetail.jsx` | `fetchPlaceBookmarkStatsBatch(...)` | RPC 병렬 호출로 전환됨(신규) |
| Traveler Picks 공개 동선 상세 | `PublicCourseDetailPage.jsx` | `fetchPlaceBookmarkStatsBatch(...)` | RPC 병렬 호출로 전환됨(신규) |
| 저장 동선 상세 | `SavedCourseDetailPage.jsx` | `fetchPlaceBookmarkStatsBatch(...)` | RPC 병렬 호출로 전환됨(신규) |

- 이 3개 호출부 파일(`TodayCourseDetail.jsx`, `PublicCourseDetailPage.jsx`, `SavedCourseDetailPage.jsx`) 자체는 `git status --short`에 나타나지 않는다 — **호출 시그니처(`fetchPlaceBookmarkStatsBatch(stopIdsKey.split(',').map(Number))`)가 이미 숫자 배열을 넘기고 있어 ID 타입 불일치가 없었고, 그래서 이 3개 파일은 수정하지 않았다**(사전에 확인했던 초기 가설 중 "ID 타입 불일치"는 기각됨).

### 5.4 검증과 남은 한계

- `npm run build` 성공(§16).
- **한계**: 실제 Supabase 프로젝트에서 이 RPC가 진짜 RLS를 우회해 전체 저장 수를 반환하는지는 이 세션에서 SQL/DB로 재검증하지 않았다 — `docs/61 §7`에서 `PlaceDetailSheet.jsx`가 이미 이 RPC로 정상 동작한다고 기록된 과거 사실에 근거해 "동일 RPC를 배치로도 쓰면 같은 결과를 얻는다"고 추론한 것이며, 이번 대화 안에서 사용자가 실제 화면에서 저장 수가 올바르게 뜨는지 확인했다는 보고는 확인되지 않았다.

---

## 6. Traveler Picks 비로그인 5개 제한 UX (B)

### 6.1 유지된 정책과 새로 추가된 안내

- 비로그인 사용자는 최초 5개(`PUBLIC_FEED_PAGE_SIZE`)까지만 노출되는 기존 정책 자체는 변경하지 않았다 — `handleLoadMore` 내부의 `if (!user) return;` 한 줄만 남아 있고(코드 확인, `PublicRoutesTab.jsx:190`, `PublicPlacesTab.jsx:121`), 로그인 사용자의 오프셋/페이지/`hasMore`/dedup 로직은 `git diff`상 관찰 결과와 동일하게 유지되었다.
- 새로 추가된 것은 "5위 카드 다음에 로그인 유도 UI를 보여줄지" 판단하는 렌더 분기뿐이다. Routes/Places 두 파일 모두 다음과 같이 동일한 패턴을 쓴다(코드 확인).

```jsx
{hasMore && (user ? (
  <div ref={setSentinelNode} className="mt-1 flex justify-center py-1">
    {loadingMore && <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" />}
  </div>
) : (
  <PublicRouteTeaserCard sort={sort} onSignInClick={handleGuestCtaClick} />
  /* Places 탭은 PublicPlaceTeaserCard */
))}
```

- `hasMore = rows.length < Math.min(totalCount, MAX_PUBLIC_FEED_ITEMS)`는 기존 계산식 그대로다(코드 확인, `PublicRoutesTab.jsx:228-229`, `PublicPlacesTab.jsx:162-163`) — 비로그인 사용자는 `handleLoadMore`가 즉시 반환되어 `rows.length`가 항상 초기 페이지 크기(5)에 고정되므로, "총 개수 ≤ 5면 `hasMore`가 애초에 false → 티저 미표시", "총 개수 ≥ 6이면 표시"라는 조건은 기존 계산식만으로 자연히 성립한다(코드 확인, 별도의 "정확히 5개일 때만" 조건 분기를 추가하지 않았다).

### 6.2 dictionary 신규 키

`git diff`로 확인한 `src/shared/i18n/dictionary.js`의 `publicFeed.*` 추가분 — en/ko/zh-CN 세 블록 모두 동일한 3개 키가 대칭으로 존재한다(코드 확인).

| 키 | en | ko | zh-CN |
|---|---|---|---|
| `seeMoreTitle` | See more Traveler Picks | 더 많은 Traveler Picks 보기 | 查看更多 Traveler Picks |
| `seeMoreDescription` | Sign in to continue exploring the remaining rankings. | 로그인하면 나머지 순위를 계속 확인할 수 있어요. | 登录后可以继续查看剩余排名。 |
| `signInToSeeMore` | Sign in to see more | 로그인하고 더 보기 | 登录查看更多 |

---

## 7. 로그인 직접 이동과 복귀 상태 (B)

### 7.1 공통 모달을 거치지 않는 이유와 방식

- 다른 로그인 필요 동작(예: 동선 하트 저장 `handleToggleHeart`)은 기존대로 `useAuthPrompt()`의 `openAuthPrompt({ messageKey, returnTo })` → 공용 `AuthRequiredModal`을 그대로 사용한다(코드 확인, `PublicRoutesTab.jsx:264-266`는 수정되지 않음).
- 티저 카드의 로그인 버튼만 `navigateToLogin(navigate, returnTo)`을 직접 호출해 모달 없이 로그인 화면으로 이동한다(코드 확인, `authRedirect.js`의 기존 함수를 그대로 재사용 — 새 인증 로직/새 로그인 화면 없음).

```js
// PublicRoutesTab.jsx / PublicPlacesTab.jsx 공통 패턴
function handleGuestCtaClick() {
  navigateToLogin(navigate, `${ROUTES.explore}?tab=routes&sort=${sort}`);
  // Places 탭은 `tab=places`
}
```

### 7.2 탭·정렬 복귀 경로

- `returnTo`는 `authRedirect.js`의 `isSafeInternalPath`가 요구하는 "`/`로 시작하는 내부 경로 문자열" 조건만 만족하면 되므로, 쿼리스트링을 포함한 `/explore?tab=routes&sort=popular` 형태를 그대로 태워 보낼 수 있다(코드 확인 — `authRedirect.js` 자체는 이번 세션에서 수정하지 않음, 기존 검증 로직 그대로 사용).
- `LoginPage.jsx`는 `location.state?.returnTo`만 읽어 `resolveAfterLoginPath(returnTo)`로 이동하므로(코드 확인, 이 파일도 미수정) 이 경로는 기존 로그인 파이프라인을 그대로 통과한다.
- `ExplorePage.jsx`가 `tab`/`sort` 초기 상태를 결정하는 부분에 쿼리스트링 폴백이 추가되었다(코드 확인, `git diff`).

```jsx
// 변경 전
const [tab, setTab] = useState(location.state?.tab ?? 'routes');
const [sort, setSort] = useState(location.state?.sort ?? 'popular');

// 변경 후
const searchParams = new URLSearchParams(location.search);
const [tab, setTab] = useState(location.state?.tab ?? searchParams.get('tab') ?? 'routes');
const [sort, setSort] = useState(location.state?.sort ?? searchParams.get('sort') ?? 'popular');
```

- 즉 우선순위는 "`PublicCourseDetailPage`의 뒤로가기가 넘기는 router state" → "이번에 추가된 쿼리스트링" → "기본값(routes/popular)" 순이며, 기존 state 기반 복귀 경로는 변경되지 않았다.
- **한계**: 로그인 완료 후 실제로 `/explore?tab=...&sort=...`로 돌아와 해당 탭·정렬이 복원되고 로그인 사용자 무한 스크롤이 재개되는지는 코드 흐름상 정합적임을 확인했을 뿐, 이 세션 안에서 사용자가 실기기로 로그인까지 완료해 확인했다는 보고는 없다.

---

## 8. 동선 티저 카드 구현 (C)

`src/features/courses/components/PublicRouteTeaserCard.jsx`(신규, untracked) 현재 코드 전문 기준(코드 확인).

- 최상위: `PublicCourseCard.jsx`의 실제 외곽 className을 그대로 복사했다 — `rounded-3xl bg-white shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]`(코드 대조 확인).
- 레이어 A(스켈레톤, `relative z-0 opacity-65 blur-[2px]`, `aria-hidden="true"`): `PublicCourseCard`의 정보 영역과 동일 구조 —
  - 순위 자리(조건부, `sort==='popular'`일 때만) → 제목 막대 → 구분선 → 기준 위치 막대 → 정류장 배지+요약 막대
  - 구분선 → `CourseStopPath`와 동일한 `1fr auto 1fr auto 1fr` 그리드로 3개 stop(원형 배지·이름 막대·카테고리 막대)과 그 사이 화살표 자리 2개
  - 구분선 → 저장 수 막대 / View course 막대
  - 모든 막대 색상은 `bg-ink/[0.13]`, 구분선은 `border-ink/5`(코드 확인).
- 레이어 B+C: 공용 `PublicFeedTeaserOverlay`를 그대로 사용(§10).
- `onSignInClick`/`sort`/`className` 외 어떤 데이터 prop도 받지 않는다(§13).

---

## 9. 가게 티저 카드 구현 (C)

`src/features/courses/components/PublicPlaceTeaserCard.jsx`(신규, untracked) 현재 코드 전문 기준(코드 확인).

- 공유 `Card` 컴포넌트를 `as="div"`로 그대로 사용 — className으로 `rounded`/배경/그림자를 덮어쓰지 않아 실제 `PublicPlaceCard.jsx`와 동일한 `rounded-3xl bg-white shadow-soft`를 그대로 물려받는다(코드 확인).
- 레이어 A(`relative z-0 opacity-65 blur-[2px]`, `aria-hidden="true"`): `PublicPlaceCard.jsx`의 실제 구조와 동일 순서 —
  - 순위 헤더 막대(조건부, popular 정렬일 때만, `border-b` 구분선 포함)
  - 썸네일 자리(`aspect-[4/3] w-[4.5rem]`, 실제 `Thumbnail`과 동일 치수)
  - 가게명 2줄 막대 → 메뉴 막대 → 주소 막대 → 저장수·평점 막대
  - 색상은 동선 티저와 동일하게 `bg-ink/[0.13]`.
- 레이어 B+C: 공용 `PublicFeedTeaserOverlay` 재사용.

---

## 10. 스켈레톤이 보이지 않았던 시행착오와 원인

이 절은 "고쳤다"는 각 라운드 보고를 그대로 신뢰하지 않고, 실제로 적용된 className 값의 변천을 순서대로 기록한다.

### 10.1 1차 구현 — 독립 CTA 카드 (오늘 세션 최초 형태)

- 별도의 흰 `Card` 안에 제목·설명·버튼만 있는 독립 CTA. 실제 순위 카드와 무관한 배너 형태 — 사용자가 "실제 다음 순위 카드처럼 보이지 않는다"고 지적해 §11의 3레이어 스켈레톤 구조로 교체 지시.

### 10.2 2차 구현 — 3레이어 도입, 그러나 스켈레톤이 실질적으로 보이지 않음

- 최초 3레이어 구현 시 블러 레이어가 `bg-paper-soft/55 backdrop-blur-lg`, 스켈레톤 블록이 `bg-ink/10`이었다.
- **사용자 화면 확인(대화상 보고)**: "스켈레톤 구조가 화면에 전혀 보이지 않는다", "동선 티저가 5위 카드보다 높이와 배경색이 다르다", "가게 티저도 독립 CTA처럼 보인다."
- 코드 검토로 재구성한 원인: `bg-ink/10`은 흰 배경 위에서 10% 알파의 매우 옅은 회색이라 그 자체로도 잘 보이지 않는데, 그 위에 `bg-paper-soft/55`(거의 절반 불투명) + 강한 `backdrop-blur-lg`가 겹치면서 사실상 균일한 단색 패널처럼 보였다. `docs`에는 남아있지 않지만 이 세션 안에서 실제로 관찰된 결과이므로, **보고서(이전 라운드의 "완료" 주장)보다 이 실제 렌더 결과를 우선해 기록한다.**

### 10.3 3차 구현 — 레이어 분리, 명도·투명도 1차 조정

- 블러 레이어 B/CTA 레이어 C를 별도의 `absolute inset-0` 형제 요소로 분리(`z-[1]`/`z-[2]`).
- 블러 배경을 `bg-paper-soft/55 backdrop-blur-lg` → `bg-white/25 backdrop-blur-[2px]`로, 스켈레톤 색상을 `bg-ink/10` → `bg-ink/20`으로, 스켈레톤 래퍼에 `opacity-80 blur-[1.5px]` 직접 적용을 추가.
- **사용자 화면 확인(대화상 보고)**: 구조·색상 문제는 해소되었으나 "스켈레톤 명암이 너무 진하다", "스켈레톤 막대와 CTA 문구·버튼이 시각적으로 경쟁한다"는 새 문제가 지적됨 — 특히 3개 stop 영역과 썸네일 블록이 CTA보다 먼저 눈에 들어옴.

### 10.4 4차(현재) 구현 — 부드러움 조정

§11에 최종 값을 기록한다.

---

## 11. 최종 시각 조정

`git diff`로 확인 가능한, 현재 working tree에 실제로 남아 있는 최종 값이다(코드 확인, 각 파일에서 직접 인용).

| 요소 | 파일 | 최종 className |
|---|---|---|
| 스켈레톤 블록 색상 | `PublicRouteTeaserCard.jsx`, `PublicPlaceTeaserCard.jsx` (모든 막대) | `bg-ink/[0.13]` |
| 스켈레톤 래퍼(레이어 A) | 위와 동일 | `relative z-0 opacity-65 blur-[2px]` |
| 블러 스크림(레이어 B) | `PublicFeedTeaserOverlay.jsx` | `absolute inset-0 z-[1] bg-white/32 backdrop-blur-[4px]` |
| CTA 레이어(레이어 C) | `PublicFeedTeaserOverlay.jsx` | `absolute inset-0 z-[2]` (별도 배경 없음, 투명) |
| CTA 제목 | 위와 동일 | `font-display text-[0.85rem] font-bold text-ink drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]` |
| 구분선(변경 없음) | 두 티저 카드 공통 | `border-ink/5` |

- `bg-paper-soft`는 티저 시각 레이어 3개 파일 전체에서 실제 class 사용으로는 0건이다(코드 확인, grep 결과).
- `[DEBUG routes]`/`[DEBUG places]`/`TEMP DEBUG` 문자열은 `src/` 전체에서 0건이다(§16.2).
- 기존 독립 CTA 컴포넌트(`PublicFeedGuestCta.jsx`)는 삭제되었고, 프로젝트 전체에서 그 이름에 대한 잔여 참조가 0건임을 grep으로 확인했다(§16.2).

**한계**: 이 4차 조정이 실제 화면에서 "스켈레톤은 존재하지만 읽을 수 없고, CTA가 먼저 보인다"는 목표를 충족하는지는 이 문서 작성 시점 기준 사용자의 실기기 재확인 보고가 없다 — 코드상 값(불투명도·블러 반경)이 이전 라운드보다 완화된 방향인 것은 확인되나, 최종 시각 결과는 §18의 후속 확인 항목으로 남긴다.

---

## 12. 페이지네이션과 좋아요 수정의 연관성 판정

- **판정: 무관(코드 확인)**. `placeBookmarkService.js`를 import하거나 그 안의 함수를 호출하는 코드가 `PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`에 전혀 없음을 grep으로 확인했다 — 두 파일은 `fetchPublicCourseFeed`/`fetchPublicPlaceFeed`(전혀 다른 서비스 파일)만 호출한다.
- 원인 확인을 위해 이 세션 중 `[DEBUG routes]`/`[DEBUG places]` 접두사가 붙은 임시 `console.log`가 두 파일의 `handleLoadMore`와 observer 콜백 여러 지점에 추가되었던 사실이 있다 — 현재 코드에는 이 로그가 **전혀 남아 있지 않다**(코드 확인, `src/` 전체 grep 결과 0건, §16.2). 브라우저 콘솔 출력을 직접 확인한 결과가 이 대화에 텍스트로 공유된 기록은 없으며, 로그를 제거하게 된 근거는 "사용자가 실제 문제를 UX 문제로 재정의했다"는 후속 진술(대화상)이다.
- 페이지네이션 로직 자체(오프셋 증가, `hasMore` 계산, dedup, `MAX_PUBLIC_FEED_ITEMS` 캡, popular/latest 정렬)는 `git diff`상 변경되지 않았다 — 유일한 변경은 `handleLoadMore` 최상단의 `if (!user) { openAuthPrompt(...); return; }`가 `if (!user) return;`으로 단순화된 것과, `catch (err)`의 미사용 `err` 바인딩을 이번 정리에서 `catch`로 제거한 것뿐이다(§16.2).

---

## 13. 실제 6위 이후 데이터 보호

- `PublicRouteTeaserCard`/`PublicPlaceTeaserCard`/`PublicFeedTeaserOverlay` 세 컴포넌트의 props 시그니처를 코드로 확인했다 — 각각 `{ sort, onSignInClick, className }`, `{ sort, onSignInClick, className }`, `{ onSignInClick }`뿐이며, `row`/`place`/실제 목록 데이터를 받는 매개변수가 없다.
- 호출부(`PublicRoutesTab.jsx:420`, `PublicPlacesTab.jsx:266`)도 `sort`와 `handleGuestCtaClick`만 넘긴다 — 6위 이후 데이터를 조회하는 추가 API 호출도 `git diff`에 없다(두 파일의 데이터 fetch는 `fetchPublicCourseFeed`/`fetchPublicPlaceFeed` 호출 한 번뿐이며 offset/limit 계산은 §12에서 확인한 대로 변경되지 않았다).
- alt·aria-label·hidden text 등에도 실제 데이터가 들어갈 자리가 구조적으로 없다(스켈레톤은 고정 `<div>`/`<span>` 블록이며 텍스트 콘텐츠를 렌더링하지 않는다) — 코드 확인.

---

## 14. 변경하지 않은 기능과 제외 범위

- Supabase RPC(`fetchPublicCourseFeed`/`fetchPublicPlaceFeed`, `get_place_bookmark_count`) 자체의 SQL·정책 — 이번 세션에서 SQL을 실행하지 않았다.
- 로그인 사용자의 무한 스크롤 로직(observer, offset, `hasMore`, dedup) — §12에서 확인한 대로 미변경.
- `AuthRequiredModal`/`useAuthPrompt` 자체 — 다른 로그인 필요 동작(하트 저장 등)은 여전히 이 공용 모달을 거친다(§7.1).
- Traveler Picks 카드 자체 디자인(`PublicCourseCard.jsx`, `PublicPlaceCard.jsx`) — 이번 세션 `git status`에 이 두 파일은 나타나지 않는다(미수정).
- `docs/64 §18`에서 이미 지적된 두 가지 기존 이슈는 이번 세션에서도 고치지 않았고 여전히 남아 있다(코드 확인, 재검증 결과 동일):
  - `publicFeed.loadMore`(en/ko/zh-CN) dictionary 키는 더 이상 어떤 JSX에서도 참조되지 않는 미사용 키로 남아 있다(grep 결과 `t('publicFeed.loadMore')` 호출 0건).
  - `PublicPlacesTab.jsx`의 `mergeFeedRows` 내부 `setStatsById(stats)`는 매 페이지 로드마다 리뷰 통계 Map을 새 페이지 것으로만 교체한다(이전 페이지의 통계가 사라질 가능성) — 이 문서 작성 시점에도 동일한 형태로 남아 있음을 재확인했다(`PublicPlacesTab.jsx:47-71`). 이번 작업 범위 밖으로 판단해 손대지 않았다.

---

## 15. 변경 파일 종합

`git status --short`와 `git diff HEAD`로 실제 확인된 파일만 정리한다.

| 파일 | 신규/수정 | 담당 기능 | 관련 절 |
|---|---|---|---|
| `src/features/places/services/placeBookmarkService.js` | 수정 | 배치 저장 수 조회를 RPC 병렬 호출로 전환 | §5 |
| `src/features/courses/components/PublicRoutesTab.jsx` | 수정 | 비로그인 티저 분기, 로그인 직접 이동, 디버그 로그·미사용 `err` 정리 | §6, §7, §12 |
| `src/features/courses/components/PublicPlacesTab.jsx` | 수정 | 위와 동일(Places), 미사용 `useAuthPrompt`/`useLocation` 제거 | §6, §7, §12 |
| `src/pages/ExplorePage.jsx` | 수정 | 로그인 복귀용 `tab`/`sort` 쿼리스트링 폴백 추가 | §7.2 |
| `src/shared/i18n/dictionary.js` | 수정 | `publicFeed.seeMoreTitle`/`seeMoreDescription`/`signInToSeeMore` en/ko/zh-CN 3키 추가 | §6.2 |
| `src/features/courses/components/PublicFeedTeaserOverlay.jsx` | 신규(untracked) | 티저 카드 공용 블러+CTA 레이어(B+C) | §10, §11 |
| `src/features/courses/components/PublicRouteTeaserCard.jsx` | 신규(untracked) | 동선 티저 카드(레이어 A + B/C 조합) | §8 |
| `src/features/courses/components/PublicPlaceTeaserCard.jsx` | 신규(untracked) | 가게 티저 카드(레이어 A + B/C 조합) | §9 |

총 5개 수정 + 3개 신규 = 8개 코드 파일 + 이 작업일지 1개(신규).

### 삭제된 파일

| 파일 | 상태 |
|---|---|
| `src/features/courses/components/PublicFeedGuestCta.jsx` | 1차 독립 CTA 구현에서 만들어졌다가 §10.1의 지적 이후 삭제됨 — 현재 저장소에 없고, 잔여 import도 0건(grep 확인). `git status`에는 애초에 커밋된 적이 없어 삭제 이력 자체가 나타나지 않는다(생성과 삭제가 모두 미커밋 상태에서 일어남). |

### 참고 — 이번 작업과 무관해 건드리지 않은 기존 파일

| 파일/항목 | 이번 작업과의 관계 |
|---|---|
| `docs/작업일지 전문(숫자 클수록 최신).zip` | 사용자가 별도로 보관 중인 기존 미추적 zip — 이번 작업과 무관, 커밋 대상에서 제외 |
| `TodayCourseDetail.jsx`, `PublicCourseDetailPage.jsx`, `SavedCourseDetailPage.jsx` | `fetchPlaceBookmarkStatsBatch` 호출부지만 ID 타입 불일치가 없어 미수정(§5.3) |
| `PublicCourseCard.jsx`, `PublicPlaceCard.jsx` | 티저 카드가 구조를 참고한 실제 카드 — 정의 자체는 미수정 |
| `AuthRequiredModal.jsx`, `useAuthPrompt.jsx`, `authRedirect.js`, `LoginPage.jsx` | 로그인 복귀 파이프라인 근거로 참조했으나 파일 자체는 미수정 |

---

## 16. 빌드·검사

### 16.1 기준 커밋 확인

```
$ git log --oneline --decorate -3
43a5517 (HEAD -> main, origin/main, origin/HEAD) fix: 공공데이터 이미지 출처 대응 및 Traveler Picks 무한 스크롤 개선
9158147 fix: 모바일 검색 입력 포커스 시 화면 밀림 수정
66df6c2 fix: 모바일 검색 포커스 시 본문 가로 밀림 방지
```

`docs/63`, `docs/64` 모두 `43a5517`에 포함되어 있음을 `git show 43a5517 --stat`으로 확인했다(§2).

### 16.2 이번 문서 작성 전 정리한 잔여 코드

- `[DEBUG routes]`, `[DEBUG places]`, `TEMP DEBUG`: `src/` 전체 grep 결과 0건.
- 충돌 마커(`<<<<<<<`/`=======`/`>>>>>>>`): `src/`, `docs/` 전체 grep 결과 0건.
- `PublicFeedGuestCta` 잔여 참조: 0건.
- 미사용 변수: `PublicRoutesTab.jsx`/`PublicPlacesTab.jsx`의 `handleLoadMore` catch절에 있던 미사용 `catch (err)` 바인딩을 이번 문서 작성 직전에 `catch`로 정리했다(기능 변경 없음, 두 파일 모두 적용).
- 이 외 미사용 import·미사용 변수는 두 파일 및 3개 신규 컴포넌트를 직접 읽어 확인한 결과 발견되지 않았다.

### 16.3 빌드·정적 검사 결과

- `npm run build`: 성공(231 modules transformed). 산출물: `dist/assets/index-*.css`(42.52 kB), `dist/assets/index-*.js`(807.44 kB).
  - CSS 압축 경고 1건(`Expected identifier but found "-"`, `-: T.Z;`)은 이전 여러 라운드 빌드 로그에서도 동일하게 관찰되어 이번 변경과 무관한 기존 경고로 판단한다.
- `git diff --check`: 통과(exit 0). 출력은 5개 수정 파일의 "LF will be replaced by CRLF" 경고뿐이며 공백·충돌 마커 오류는 없다.
- `package.json`의 `scripts`에는 `dev`/`build`/`preview`만 존재하고 별도 `test`/`lint` 스크립트가 없음을 확인했다 — 존재하지 않는 테스트 명령을 새로 만들지 않았다(요청 §7 반영).

---

## 17. 현재 상태

- 브랜치: `main`, 조사 시점 `HEAD`: `43a55175d4c1df3600a817a019b3ad692e668422`(기준 커밋과 동일).
- §15의 5개 수정 + 3개 신규 코드 파일과 이 문서(`docs/65-...md`)는 이 문서 작성 시점까지 모두 **미커밋 working tree 상태**였다(이후 §9 지시에 따라 커밋·푸시 진행, 결과는 최종 보고에 기재).

---

## 18. 승인된 한계와 후속 과제

- §5.4: 배치 조회가 실제 Supabase 환경에서 RLS를 우회해 정확한 전체 저장 수를 반환하는지는 SQL로 재검증하지 않았다.
- §7.2, §11: 로그인 복귀 후 탭·정렬 상태, 그리고 4차 시각 조정(스켈레톤 명도·블러 강도)이 실제 브라우저·실기기에서 사용자가 의도한 결과로 보이는지는 이 문서 작성 시점 기준 확인되지 않았다.
- §14: `publicFeed.loadMore` 미사용 키, `PublicPlacesTab.jsx`의 `statsById` 페이지 교체 이슈는 `docs/64`에 이어 이번에도 범위 밖으로 남겨졌다 — 다음 세션에서 정리 여부를 별도로 판단해야 한다.
- 스켈레톤 명도·오버레이 투명도는 이번 세션 안에서도 세 차례 조정되었을 만큼 "적정 값"에 대한 합의가 아직 실기기 확인으로 완전히 종료되지 않았다 — 추가 조정 요청이 다시 들어올 가능성을 염두에 두어야 한다.
