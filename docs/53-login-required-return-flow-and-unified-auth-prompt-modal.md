# 53. 로그인 필요 기능 복귀 흐름 도입 및 공용 중앙 로그인 모달 통일

## 1. 작업 일시

- 작성일시: 2026-07-25 17:17 KST

---

## 2. 작업 배경

`docs/52-place-detail-share-feature-and-heart-icon-request.md`는 커밋 `a385e74`(가게 상세 공유 기능 구현)에 문서와 함께 포함되어 커밋되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 다음 다섯 단계의 작업을 다룬다. 이 문서 작성 시점까지 `a385e74` 이후로는 어떤 `git add`/`commit`/`push`도 수행되지 않아, 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있다.

1. 로그인 필요 기능(좋아요·저장·리뷰 등)을 눌렀을 때의 로그인 이동/복귀 흐름 조사 및 `returnTo` 정책 최초 도입
2. 앱 전체 로그인 안내 UI 통일을 위한 **조사·계획 전용**(코드 미수정) 단계
3. 공용 `AuthPromptProvider`/`useAuthPrompt` 도입과 앱 전체 로그인 안내 UI를 공용 중앙 모달로 통일
4. 위 3번 작업 직후 발견된 "앱 전체 버튼 클릭 불가" 회귀의 원인 조사 및 수정
5. `returnTo`가 모달이 열린 시점의 위치를 안정적으로 보존하도록 하는 마무리 안정화 + OAuth stale 데이터 정리

---

## 3. 조사에 사용한 명령(전부 읽기 전용)

```
git log --oneline
git status --porcelain
git diff --stat HEAD
git diff HEAD -- <file>
git diff --check
npm run build
grep -rn "AuthRequiredModal|authModal|loginPrompt|loginBanner|goToLoginWithReturn|openAuthPrompt|restoreView" src
```

---

## 4. 1단계 — 로그인 필요 기능 복귀 흐름 최초 도입

### 4.1 문제

비로그인 상태에서 좋아요/저장 등 로그인 필요 기능을 누르면 로그인 안내 → 로그인 화면 → 로그인 성공 후 **항상 마이페이지로 강제 이동**했다. 좋아요를 누른 원래 화면(예: `/places/460`)으로 돌아오지 않는 것이 문제였다.

### 4.2 조사 결과

- `LoginPage.jsx`가 `LoginForm`에 `onDone={() => navigate(ROUTES.my, { replace: true })}`를 하드코딩 — returnTo 개념 자체가 없었음.
- 로그인 필요 진입점이 `AuthRequiredModal.jsx`(가게 상세 북마크/리뷰), `NearbySheet.jsx`(동선 저장), `CommunityPage.jsx`(글쓰기), `CoursesPage.jsx`(저장 코스/장소 탭) 4곳으로 흩어져 있었고 전부 `navigate(ROUTES.login)`만 호출.
- OAuth(Google/Facebook) 로그인이 실제로 존재함을 `LoginForm.jsx`에서 확인 — `react-router`의 `location.state`는 OAuth 전체 페이지 왕복에서 소실되므로 별도 브릿지가 필요함을 확인.

### 4.3 구현

- **신규** `src/shared/utils/authRedirect.js` — `isSafeInternalPath`(오픈 리다이렉트 차단: `/`로 시작, `//`·`/\` 차단, URL 스킴 차단), `buildReturnTo(location)`(pathname+search+hash), `goToLoginWithReturn(navigate, location)`, `resolveAfterLoginPath(returnTo)`(안전하면 그 경로, 아니면 기존 기본값 `ROUTES.my` 유지), `storeOAuthReturnTo`/`consumeOAuthReturnTo`(OAuth 왕복용 sessionStorage 브릿지, 읽는 즉시 삭제).
- `LoginPage.jsx` — `location.state?.returnTo` 사용, `onDone`에서 `navigate(resolveAfterLoginPath(returnTo), {replace:true})`.
- `LoginForm.jsx` — `returnTo` prop 수신, OAuth 시작 직전 `storeOAuthReturnTo(returnTo)` 호출.
- `router.jsx`(`AppRouter`) — `user`가 유효해지는 시점에 `consumeOAuthReturnTo()`로 1회 소비 후 `navigate(returnTo, {replace:true})`.
- `AuthRequiredModal.jsx`, `NearbySheet.jsx`, `CommunityPage.jsx`, `CoursesPage.jsx` — 4개 진입점 모두 `goToLoginWithReturn(navigate, location)`로 통일.
- `MyPage.jsx`는 수정하지 않음 — returnTo가 없을 때 기본값이 이미 `/my`라 마이페이지 로그인 흐름이 자연히 그대로 유지됨을 확인.

---

## 5. 2단계 — 로그인 안내 UI 통일 조사·계획(코드 미수정)

사용자가 "코드를 수정하지 말고 조사와 구현 계획만 작성"을 명시적으로 요청한 단계. 이 세션에서는 `Read`/`Grep`/`Glob`만 사용했고 `Edit`/`Write`는 호출하지 않았다.

### 5.1 발견한 문제

| # | 화면/기능 | 당시 안내 방식 |
|---|---|---|
| 1 | 가게 상세 좋아요/리뷰 | 중앙 모달이지만 `PlaceDetailSheet` 내부에 렌더링돼 backdrop이 바텀시트 영역만 덮음 |
| 2 | 동선 저장 | 안내 없이 즉시 로그인 화면 이동 |
| 3 | Phrases 표현 좋아요 | 페이지 내부 인라인 경고 배너 |
| 4 | Community 글쓰기 | 자체 하단 로그인 안내 바텀시트(`Modal.jsx` 미사용, 직접 마크업) |
| 5 | Community 게시글 좋아요 | **완전 무반응**(`if (!user) return;`) |
| 6 | CoursesPage | 페이지 전체 게이트 + 인라인 로그인 버튼(성격이 달라 통일 대상에서 제외) |
| 7 | MyPage | 로그인 페이지로 즉시 이동(통일 대상에서 제외) |

### 5.2 backdrop이 일부만 덮이던 원인(코드 근거)

`Modal.jsx`의 오버레이가 `absolute inset-0`(Portal 아님)이라, containing block(가장 가까운 `position` 조상)이 `PlaceDetailSheet`의 루트 div였다. Map 탭에서는 이 루트가 `NearbySheet`의 draggable 시트(`overflow-hidden`, `height: currentHeight`) 안에 중첩돼 있어, backdrop이 지도·하단내비게이션까지 덮지 못하고 시트 내부로 잘렸다.

### 5.3 최종 추천안(채택됨)

`AuthPromptProvider`(Context) + 앱 폰 프레임 최상위(형제 위치, Portal 없이)에 단일 모달 렌더러 — §6에서 실제 구현.

---

## 6. 3단계 — 공용 AuthPromptProvider 도입 및 UI 통일 구현

### 6.1 신규 파일 — `src/features/auth/hooks/useAuthPrompt.jsx`

```js
export function AuthPromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null); // null | { messageKey }
  const openAuthPrompt = useCallback(({ messageKey }) => setPrompt({ messageKey }), []);
  const closeAuthPrompt = useCallback(() => setPrompt(null), []);
  ...
}
```

place/course 객체나 "로그인 후 실행할 액션" 정보는 저장하지 않음 — `messageKey`(dictionary 키) 하나만 보관해, 로그인 후 좋아요/저장/글쓰기 자동 실행이 구조적으로 불가능하도록 설계.

### 6.2 `providers.jsx`

기존 Provider 합성 체인(`LocaleProvider > FoodCategoryProvider > AuthProvider > ... > BookmarkProvider`)에 `AuthPromptProvider`를 `AuthProvider` 안쪽에 추가.

### 6.3 `AuthRequiredModal.jsx` — 전역 단일 모달로 전환

기존에는 `{open, onClose, bodyKey}` props를 받아 페이지마다 인스턴스를 렌더링했으나, `useAuthPrompt()`로 직접 `prompt`를 읽어 `open={!!prompt}`를 내부에서 결정하도록 변경(당시 버전 — §7에서 이 설계가 회귀를 낳아 다시 되돌림).

### 6.4 `App.jsx`

앱 폰 프레임(`<div className="relative h-[100svh] ... max-w-app overflow-hidden">`) 내부, `<AppRouter/>`의 형제 위치에 `<AuthRequiredModal/>`을 마운트 — `AppLayout`/`HomePage`/`NearbySheet`/`PlaceDetailSheet` 서브트리 전부의 바깥. Portal은 사용하지 않음(이미 렌더 트리 최상단이라 JSX 형제 배치만으로 충분).

### 6.5 각 진입점 교체

- `PlaceDetailSheet.jsx`, `PlaceReviewsPage.jsx` — 로컬 `authModal`/`showAuthModal` state와 자체 `<AuthRequiredModal>` 렌더링 제거, `openAuthPrompt({messageKey: 'placeDetail.loginToSave' | 'placeDetail.loginToReview'})`로 교체.
- `NearbySheet.jsx` — `goToLoginWithReturn` 대신 `openAuthPrompt({messageKey: 'savedCourses.loginToSave'})`(기존 dictionary 키 재사용, 새 키 추가 없음).
- `PhrasesPage.jsx` — `loginBanner` state·`setTimeout`·인라인 배너 JSX 전부 제거, `openAuthPrompt({messageKey: 'phrases.loginToBookmark'})`.
- `CommunityPage.jsx` — `loginPrompt` state와 자체 하단 시트 마크업(`bg-black/30` backdrop 포함) 전부 제거. 글쓰기·댓글-로그인·**게시글 좋아요**(기존 완전 무반응이었던 `handleLike`) 3곳 모두 `openAuthPrompt({messageKey: 'community.joinPrompt'})`로 통일.

dictionary.js는 이 단계에서 전혀 수정하지 않음 — 필요한 문구가 이미 `placeDetail.loginToSave/loginToReview`, `savedCourses.loginToSave`, `phrases.loginToBookmark`, `community.joinPrompt`로 전부 존재했기 때문.

---

## 7. 4단계 — "앱 전체 버튼 클릭 불가" 회귀 조사 및 수정

### 7.1 증상

3단계 배포 직후 실제 모바일에서 가게 상세 하트, Phrases 하트, Community 포스트/좋아요를 포함한 **앱의 거의 모든 버튼**이 클릭되지 않는 회귀가 보고됨.

### 7.2 원인(코드 근거로 확정)

`App.jsx`에 추가했던 `<div className="relative z-50"><AuthRequiredModal /></div>`가 두 문제를 동시에 갖고 있었다.

1. **조건 없이 항상 마운트**: `prompt`가 `null`이어도 이 wrapper와 `AuthRequiredModal`(그 안의 `Modal`)이 항상 App 최상위에 존재 — "닫힘"이 DOM 부재가 아니라 `Modal.jsx` 내부 `mounted`/`closing` state 판단에만 의존.
2. **wrapper에 크기 지정 없음**: `relative z-50`만 있고 `absolute inset-0`/`h-full`/`w-full`이 전혀 없어, `Modal.jsx`의 `absolute inset-0` 오버레이가 크기가 불명확한 containing block을 기준으로 계산되는 CSS 스펙상 모호한 상황이 되고, 이 경우 브라우저마다 계산 결과가 달라 실제 모바일에서 backdrop(`<button className="modal-back absolute inset-0 ... bg-ink/40">`, `pointer-events` 기본값 `auto`)이 예측 불가능하게 앱 전체 크기로 렌더되며 모든 클릭을 가로챈 것으로 판단됨.

### 7.3 수정

- `App.jsx`에 `AuthPromptRenderer()` 로컬 컴포넌트 추가 — `if (!prompt) return null;`을 최상단에서 실행해 **prompt가 없으면 wrapper/backdrop/모달 카드 전부 DOM에 존재하지 않음**(opacity-0/visibility-hidden/pointer-events-none 방식은 전혀 사용하지 않음). `prompt`가 있을 때만 `<div className="absolute inset-0 z-50">`(명시적 크기 지정)로 렌더링.
- `AuthRequiredModal.jsx`를 다시 순수 prop 기반(`{open, onClose, bodyKey}`) 컴포넌트로 되돌림 — context는 `App.jsx`의 `AuthPromptRenderer`가 대신 소비.
- `Modal.jsx` 자체는 이번에도 전혀 수정하지 않음 — 문제는 그것을 감싼 `App.jsx`의 wrapper 구조였음.
- **알려진 부작용**: `AuthPromptRenderer`가 `prompt=null`이 되는 즉시 `AuthRequiredModal` 전체를 unmount하므로, `Modal.jsx`의 기존 260ms 페이드아웃 애니메이션이 재생될 시간이 없어 모달이 즉시 사라짐(전환 효과 없음). "DOM 자체가 없어야 한다"는 안전성을 우선한 의도된 트레이드오프로 판단.

---

## 8. 5단계 — returnTo 캡처 시점 안정화 및 OAuth stale 데이터 정리

### 8.1 발견한 문제

- **(A)** 4단계까지의 `AuthRequiredModal`은 로그인 버튼 클릭 시 `useLocation()`으로 "그 시점의" 현재 위치를 다시 계산했다. 모달이 App 최상위에 항상 마운트되는 구조이므로, 하트를 눌러 모달이 열린 뒤 사용자가 다른 화면으로 이동했다가 로그인 버튼을 누르면 모달이 열렸던 원래 화면이 아니라 그 사이 이동한 화면이 returnTo로 잡힐 수 있었다.
- **(B)** `LoginForm.handleSocialLogin`이 `storeOAuthReturnTo`로 저장한 뒤 `signInWithOAuth` 호출이 동기적으로 실패해도 저장된 값을 지우지 않아, 이후 다른 방식(이메일)으로 로그인하면 그 stale 값이 `AppRouter`에 의해 잘못 소비될 수 있었다.

### 8.2 수정

- **`authRedirect.js`**: `goToLoginWithReturn`을 `navigateToLogin(navigate, returnTo)`(이미 계산된 returnTo 문자열을 받는 공유 primitive)과 얇은 래퍼로 리팩터. `clearOAuthReturnTo()` 신규 추가(OAuth 호출이 실패하면 방금 저장한 sessionStorage 값을 되돌림).
- **`useAuthPrompt.jsx`**: `prompt` 구조를 `{messageKey, returnTo}`로 확장 — `returnTo`는 `openAuthPrompt()` **호출 시점**(=하트/포스트/저장 버튼을 누른 순간)에 호출부가 캡처해 넘김.
- **`App.jsx`**: `AuthPromptRenderer`가 `prompt.returnTo`를 `AuthRequiredModal`에 그대로 전달.
- **`AuthRequiredModal.jsx`**: `useLocation()` 제거, `returnTo` prop을 그대로 `navigateToLogin(navigate, returnTo)`에 사용 — 모달이 열려 있는 동안 다른 곳으로 이동해도 원래 캡처된 값이 섞이지 않음.
- **`PlaceDetailSheet.jsx`/`PlaceReviewsPage.jsx`/`NearbySheet.jsx`/`PhrasesPage.jsx`/`CommunityPage.jsx`** — 5개 파일 모두 `useLocation()`을 (재)추가하고, `openAuthPrompt({messageKey, returnTo: buildReturnTo(location)})` 형태로 호출 시점에 캡처하도록 통일.
- **`LoginForm.jsx`**: OAuth 호출 실패(catch 블록)에서 `clearOAuthReturnTo()` 호출.
- Map 탭 내부(NearbySheet)에서 캡처되는 `location`은 Map 탭 자체의 URL(`/`)이므로, 그 안에서 열린 가게/동선 상세는 로그인 후 `/`로만 복귀하고 상세가 재오픈되지 않는 것을 이번 범위의 의도된 동작으로 유지(`restoreView`, placeId/courseId 세션 저장 등은 추가하지 않음 — 코드베이스 전체 `grep restoreView` 결과 없음으로 재확인).

### 8.3 알려진 잔여 한계

OAuth를 시작해 sessionStorage에 저장까지는 됐지만 사용자가 실제 로그인을 완료하지 않고(예: 제공자 페이지에서 뒤로가기) 앱으로 돌아온 뒤, 같은 브라우저 탭 세션 안에서 한참 뒤 완전히 무관하게 새로고침(이미 로그인된 세션 복원)만 해도 `AppRouter`의 소비 효과가 그 stale 값을 잘못 소비할 수 있는 여지가 이론상 남아 있다. `user`가 "방금 로그인 완료"와 "새로고침으로 세션 복원"을 구분할 수 없는 `AuthProvider`(`useAuth.jsx`) 설계의 근본적 한계이며, 완전히 없애려면 Supabase `onAuthStateChange`의 이벤트 타입 자체를 노출해야 해 이번 범위를 벗어난다고 판단, 손대지 않고 후속 과제로 남김.

---

## 9. 변경 파일 종합

| 파일 | 구분 | 비고 |
|---|---|---|
| `src/shared/utils/authRedirect.js` | new / uncommitted | `isSafeInternalPath`, `buildReturnTo`, `navigateToLogin`, `goToLoginWithReturn`, `resolveAfterLoginPath`, `storeOAuthReturnTo`, `consumeOAuthReturnTo`, `clearOAuthReturnTo`, `DEFAULT_AFTER_LOGIN_PATH` |
| `src/features/auth/hooks/useAuthPrompt.jsx` | new / uncommitted | `AuthPromptProvider`, `useAuthPrompt` — `{messageKey, returnTo}` 최소 상태 |
| `src/app/App.jsx` | uncommitted | `AuthPromptRenderer`(조건부 마운트) 추가, 이전 항상-마운트 wrapper 제거 |
| `src/app/providers.jsx` | uncommitted | `AuthPromptProvider` 추가 |
| `src/app/router.jsx` | uncommitted | OAuth `consumeOAuthReturnTo()` 소비 효과(1단계) |
| `src/features/auth/components/LoginForm.jsx` | uncommitted | `returnTo` prop, `storeOAuthReturnTo`/`clearOAuthReturnTo` |
| `src/pages/LoginPage.jsx` | uncommitted | `resolveAfterLoginPath` 기반 이동 |
| `src/features/places/components/AuthRequiredModal.jsx` | uncommitted | 순수 prop 기반(`open/onClose/bodyKey/returnTo`)으로 최종 정착 |
| `src/features/explore/components/PlaceDetailSheet.jsx` | uncommitted | 로컬 모달 state 제거, `openAuthPrompt` 사용 |
| `src/pages/PlaceReviewsPage.jsx` | uncommitted | 동일 |
| `src/features/explore/components/NearbySheet.jsx` | uncommitted | 동선 저장 안내 추가(기존엔 안내 없이 즉시 이동) |
| `src/pages/PhrasesPage.jsx` | uncommitted | 인라인 배너 제거 |
| `src/pages/CommunityPage.jsx` | uncommitted | 자체 로그인 바텀시트 제거, 좋아요 무반응 수정 |
| `src/pages/CoursesPage.jsx` | uncommitted | `goToLoginWithReturn` 유지(페이지 전체 게이트, 통일 대상 아님) |

`dictionary.js`, `Modal.jsx`, `shareUtils.js`, `HomePage.jsx`, DB/Supabase 스키마는 이 다섯 단계 전체에서 전혀 수정하지 않았다.

---

## 10. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공, 208 modules. 기존 CSS 압축 경고 1건·청크 크기 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 통과(CRLF 안내만 존재) |
| `restoreView` 잔존 코드 | `grep restoreView src` 결과 없음 — 조사·계획 단계(§5)에서 문서로만 남고 실제 코드에는 들어가지 않았음을 확인 |
| `HomePage.jsx` diff | 없음 — 상세 복원 관련 변경 없음 확인 |

### 미검증(승인된 한계)

이 환경에는 브라우저 자동화 도구가 없어, 아래는 코드 경로 추적으로만 확인했고 실제 브라우저·모바일 동작은 확인하지 못했다.

- 가게 상세/Phrases/Community/동선 저장에서 중앙 모달 backdrop이 실제로 앱 전체(지도·하단내비 포함)를 덮는지
- 모달 닫힘 상태에서 모든 버튼이 실제로 클릭되는지(§7 회귀 수정의 실기기 재현 확인)
- 이메일/OAuth 로그인 각각의 실제 returnTo 복귀 결과

---

## 11. git 상태 (이 문서 커밋 직전 기준)

- current branch: `main`
- HEAD(커밋 전): `a385e74`(docs/52와 함께 커밋된 공유 기능)
- 이 문서 작성 시점까지 `git add`/`commit`/`push` 없음 — §9의 모든 변경이 워킹 디렉터리에 미커밋 상태로 남아 있었음
- 이 문서 작성 직후, 사용자 지시에 따라 위 변경 전체와 이 문서를 함께 커밋 후 push 진행 예정

---

## 12. 후속 과제

- §7의 회귀가 실제로 해소되었는지, §6의 backdrop 전체 적용이 실제 기기에서 확인되었는지 실기기 테스트
- §8.3의 OAuth 중단 후 stale sessionStorage 잔존 가능성 — 완전한 해결에는 `useAuth.jsx`가 Supabase 인증 이벤트 타입(`SIGNED_IN` vs `INITIAL_SESSION`)을 구분해 노출하는 구조 변경이 필요
- Map 탭 내부에서 열린 가게/동선 상세를 로그인 후 재오픈하는 기능(`restoreView`)은 이번 범위에서 의도적으로 제외 — 별도 작업으로 남음(특히 추천 동선은 `courseId`가 세션마다 재계산되는 합성 값이라 placeId만큼 단순하지 않음, 이전 조사에서 이미 확인)
