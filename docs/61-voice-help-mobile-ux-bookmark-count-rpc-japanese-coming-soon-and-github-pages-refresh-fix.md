# 61. 음성 도움 모바일 완료 UX·빈 추천 답변 방지, 가게 저장 수 RPC, 일본어 안내, GitHub Pages 새로고침 대응

## 1. 작업 일시

- 작성일시: 2026-07-27 23:10 KST
- 대상 커밋 5건은 모두 2026-07-27 22:11 ~ 22:50 KST 사이에 순서대로 생성됐다.

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/60-multilingual-voice-help-and-traveler-picks-full-page-details.md`
- 기준 커밋: `be634d8` (`feat: 다국어 음성 도움과 여행자픽 상세 화면 개선`) — `docs/60`을 도입한 커밋.
- 이 문서가 다루는 범위: `be634d8` 바로 다음 커밋부터 현재 `HEAD`까지, 총 5개 커밋.
- 현재 저장소 상태(작성 시점 확인):
  - 경로: `C:/Workspace/GitWorkspace/matgil`
  - 브랜치: `main`
  - `HEAD` = `origin/main` = `b9a50f376c1bc23d6751ce04dbd5a17610a3390d` — 5개 커밋 모두 push 완료.
  - 미커밋 변경: 없음(`.claude/worktrees/` 미추적 디렉터리만 존재하며 항상 조사·문서화 대상에서 제외).

---

## 3. 작업 배경

`docs/60` 이후 서로 다른 네 가지 주제에 대한 작업이 순서대로 진행돼 5개 커밋으로 나뉘어 반영됐다.

1. Phrases 탭 음성 도움(Voice Help)의 모바일 세션 종료 문제, 마이크 두 번째 클릭 UX, Edge Function의 빈 추천 답변(`suggestedReply`) 방지 — 3개 커밋에 걸쳐 진행.
2. 가게 상세 화면의 저장 수 조회를 전용 RPC로 교체하는 리팩터링 — 1개 커밋.
3. 언어 선택 화면에 일본어 "준비 중" 안내 추가 — 1개 커밋.
4. GitHub Pages 배포본에서 SPA 내부 경로를 새로고침·직접 접근할 때 발생하는 404 문제 대응 — 1개 커밋.

네 주제는 서로 다른 화면·파일을 다루며, 각 커밋은 해당 커밋이 완결하는 단위로 나뉘어 있다.

---

## 4. 이번 문서에서 제외한 항목

작성 시점 기준으로 워킹 디렉터리에 미커밋 변경이 없으므로(`.claude/worktrees/` 제외), 제외할 미커밋 항목은 없다.

다음은 이미 `docs/60`에서 다룬 내용이며, 이 문서 범위(`be634d8` 이후 커밋)에서 추가로 수정된 바가 없어 다시 설명하지 않는다.

- 여행자픽(Traveler Picks) 공개 동선·가게 전체 화면 상세(`PublicCourseDetailPage.jsx`, `PublicPlacesTab.jsx` 등)
- 음성 도움 발화 언어(`recognition.lang`) 다국어 선택 최초 도입

---

## 5. 커밋 흐름 요약

`docs/60` 이후 시간순으로 5개 커밋이 이어졌다. 뒤쪽 세 커밋(§9~§11에 대응)은 하나의 Voice Help 개선 흐름이지만 실제로는 서로 다른 시점에 별도 커밋으로 나뉘어 있다.

| 순서 | 커밋 | 주제 |
|---|---|---|
| 1 | `154897d` | 음성 인식 세션이 결과·오류 없이 종료돼도 UI가 listening에 남는 문제 수정 |
| 2 | `bcaa851` | 언어 선택 화면에 일본어 "준비 중" 안내 추가 |
| 3 | `422a83b` | 가게 저장 수 조회를 전용 RPC로 변경 |
| 4 | `435245f` | 음성 인식 두 번째 클릭을 완료 처리로 변경, 추천 답변 빈 값 방지(Edge Function) |
| 5 | `b9a50f3` | GitHub Pages SPA 딥링크 새로고침 404 방지 |

---

## 6. 일본어 준비 중 안내 (`bcaa851`)

언어 선택 모달(`LanguageModal.jsx`)에 일본어 항목을 추가했다. 다만 이 항목은 **실제 서비스 언어로 활성화된 것이 아니다** — `LANGUAGES` 배열(`exploreOptions.js`)에는 여전히 `en`/`ko`/`zh-CN` 세 개만 있고, 일본어는 별도의 `COMING_SOON_LANGUAGES` 배열(`{ code: 'ja', short: '日', name: '日本語' }` 한 항목)로 분리되어 있다.

`LanguageModal`은 `COMING_SOON_LANGUAGES` 항목을 기존 언어 버튼과 같은 스타일로 렌더링하되, 클릭 시 `setLocale`/`onLanguageSelected`/`onClose` 중 어느 것도 호출하지 않고 `onComingSoonSelect(code)`만 호출한다. `HomePage.jsx`/`MyPage.jsx`는 이 콜백을 받아 신규 컴포넌트 `JapaneseComingSoonModal.jsx`를 언어 선택 모달 위에 겹쳐서 띄운다.

`JapaneseComingSoonModal`은 `useLocale()`의 `t()`(dictionary)를 전혀 쓰지 않고, 앱 로케일과 무관하게 항상 고정된 일본어 문구를 보여준다.

```js
const TITLE = '日本語サービス準備中';
const MESSAGE = '日本語サービスは現在準備中です。ご利用いただけるまで、もうしばらくお待ちください。';
const CONFIRM = '確認';
```

기존 `en`/`ko`/`zh-CN` 언어 선택 흐름(`setLocale`, `handleLanguageSelected`, `LocaleInfoNotice`)은 이 커밋에서 전혀 수정되지 않았다 — `dictionary.js`도 이 커밋의 변경 파일 목록에 없다.

---

## 7. 가게 저장 수 전용 RPC 리팩터링 (`422a83b`)

가게 상세 바텀시트(`PlaceDetailSheet.jsx`)의 저장 수(`saveCount`) 조회 방식을 변경했다.

- 기존: `fetchPlaceBookmarkStatsBatch([place.id])`로 단일 가게를 위해 배치 함수를 호출하고 `Map`에서 `.get(place.id) ?? 0`으로 값을 꺼내던 방식.
- 변경 후: `placeBookmarkService.js`에 신규 함수 `fetchPlaceBookmarkCount(placeId)`를 추가하고, `PlaceDetailSheet.jsx`는 이 함수를 직접 호출.

```js
export async function fetchPlaceBookmarkCount(placeId) {
  const numericPlaceId = Number(placeId);
  if (!Number.isFinite(numericPlaceId) || numericPlaceId <= 0) return 0;

  const { data, error } = await supabase.rpc('get_place_bookmark_count', {
    p_place_id: numericPlaceId,
  });

  if (error) throw error;
  return Number(data) || 0;
}
```

`placeId`를 숫자로 변환해 유효하지 않으면(음수·NaN 등) RPC를 호출하지 않고 `0`을 반환하며, RPC 자체가 에러를 반환하면 예외를 던져 호출부(`PlaceDetailSheet.jsx`)의 `.catch()`가 `saveCount`를 `0`으로 안전하게 처리하도록 되어 있다.

기존 배치 함수 `fetchPlaceBookmarkStatsBatch`는 삭제되지 않았다 — 현재도 `TodayCourseDetail.jsx`, `PublicCourseDetailPage.jsx`, `SavedCourseDetailPage.jsx` 세 곳에서 여러 가게의 저장 수를 한 번에 조회하는 용도로 계속 쓰인다(코드 조사로 확인).

이 커밋의 diff 중 일부(import 재정렬, `.catch(() => {})` → `.catch(() => { })` 같은 공백 변경)는 실제 동작과 무관한 포맷 변경이며, 실질적인 기능 변경은 위 저장 수 조회 방식 교체 하나뿐이다.

**외부 확인 사실**(저장소 코드가 아니라 실제 연결된 Supabase 프로젝트에서 사용자가 직접 확인한 내용): Supabase SQL Editor에서 아래 조회 결과로 `public.get_place_bookmark_count` 함수의 존재를 확인했다.

```
[
  {
    "routine_schema": "public",
    "routine_name": "get_place_bookmark_count"
  }
]
```

이 확인은 "이 RPC가 실제 Supabase 프로젝트의 `public` 스키마에 존재한다"는 사실만을 의미하며, 이 RPC의 SQL 정의(함수 본문)는 이 저장소 어디에도 문서화되어 있지 않다 — `docs/sql-*.md` 파일 목록에도 이 RPC를 위한 문서는 없다.

---

## 8. 음성 인식 세션 종료 문제 (`154897d`)

`docs/60`이 다룬 발화 언어 선택 기능과는 별개로, 이후 실사용 중 확인된 문제를 수정한 커밋이다.

**문제**: 일부 모바일 브라우저에서 인식 결과가 아무것도 없을 때(무음, 아주 짧은 발화 등) `onresult`나 `onerror` 없이 `onend`만 발생시키는 경우가 있었다. 이전 코드는 `onend`를 단순 정리 용도로만 취급해 이 경우 `onResult`도 `onError`도 호출하지 않았고, 그 결과 화면 상태(`listening`)가 영원히 전환되지 않는 문제가 있었다.

**수정**: `speechRecognitionService.js`가 모듈 전역의 단일 `activeRecognition` 인스턴스 대신, 세션을 객체(`{ recognition, manuallyAborted, settled }`)로 관리하도록 바뀌었다.

- `settled` 플래그로 `onresult`/`onerror`/`onend`/`onnomatch` 중 정확히 하나만 콜백(`onResult`/`onError`)을 실행하도록 보장.
- `onend`가 발생했는데 아직 `settled`가 아니고 수동 중단(`manuallyAborted`)도 아니면 `settleError('no-speech')`로 정리 — 이번 수정의 핵심.
- `onnomatch`도 같은 "결과 없음"으로 취급.
- `event.resultIndex`부터 transcript를 읽도록 `collectTranscript()` 추가(이전에는 `event.results[0]`만 봤음).
- `recognition.start()`를 `try/catch`로 감싸 동기 예외 시에도 `onError`가 호출되도록 함.
- 새 세션을 시작하기 전 이전 세션을 `stopListening()`으로 먼저 정리해, 이전 세션의 지연된 이벤트가 새 세션의 콜백을 침범하지 못하도록 함(세션 객체가 자신의 콜백을 클로저로 들고 있어 다른 세션의 콜백을 절대 호출하지 않음).

`VoiceHelpPlaceholder.jsx`도 함께 수정되어, `aborted` 오류 코드는 오류 문구 없이 조용히 `idle`로, 그 외 오류 코드는 `voiceDenied`/`voiceError` 문구로 매핑해 다음 클릭에서 바로 재녹음이 가능하도록 했다.

이 시점의 `stopListening()`은 여전히 `recognition.abort()`만 호출했다 — 마이크 두 번째 클릭 UX 자체는 다음 절(§9)에서 별도로 수정됐다.

---

## 9. 마이크 두 번째 클릭 완료 UX (`435245f`)

실제 사용자 테스트로 확인된 문제: 사용자는 말한 뒤 마이크 버튼을 다시 누르면 녹음이 끝나고 분석이 시작될 것으로 기대했지만, 그 시점의 `stopListening()`은 `recognition.abort()`를 호출해 그동안 인식된 내용을 그대로 폐기하고 있었다. 그 결과 버튼을 다시 누르지 않고 발화 종료 후 1~2초 기다렸을 때만 정상적으로 분석되는 것처럼 보였다 — 음성 인식 정확도 자체의 문제가 아니라 버튼 동작이 사용자의 기대와 반대로 구현된 UX 문제였다.

`recognition.stop()`과 `recognition.abort()`는 서로 다른 동작이다.

- `stop()` — 지금까지 인식한 내용을 최종 결과로 확정하도록 요청(정상적인 `onresult`가 뒤따를 수 있음).
- `abort()` — 지금까지 인식한 내용을 폐기하고 `onResult`/`onError`를 발생시키지 않음.

이 커밋에서 `speechRecognitionService.js`의 함수가 역할별로 분리됐다.

- `finishListening()`(신규) — `recognition.stop()`을 호출. 사용자가 "말을 마쳤다"는 의도로 누르는 정상적인 완료 동작에 이것 하나만 쓰인다.
- `cancelListening()`(신규, 기존 `stopListening`을 대체) — `recognition.abort()`를 호출. `startListening()`이 이전 세션을 교체할 때, 그리고 `VoiceHelpPlaceholder`가 unmount될 때의 내부 정리 용도로만 쓰인다.

세션 상태 플래그도 `manuallyAborted`/`settled`에 `finishRequested`가 추가돼 세 가지를 구분한다. `finishRequested`인 세션이 결과 없이 `onend`로 끝나면 기존과 동일하게 `no-speech` 오류로 처리되며, 취소(`manuallyAborted`)로 오인되어 조용히 무시되지 않는다.

`VoiceHelpPlaceholder.jsx`의 상태값에 `finishing`이 추가됐다(`idle | listening | finishing | processing | done | error`). 두 번째 클릭 시 `finishListening()`을 호출하고 상태를 곧바로 `idle`이 아니라 `finishing`으로 바꿔, 결과(`onResult`) 또는 진짜 실패(`onError`)가 올 때까지 기다린다. `finishing` 동안에는 마이크 버튼과 발화 언어 선택 버튼이 모두 비활성화되어 중복 클릭으로 인한 재호출을 막는다. 컴포넌트가 unmount될 때는 `cancelListening()`을 호출해 남은 세션을 취소한다(완료가 아닌 진짜 취소).

두 가지 종료 흐름:

- 자동 종료: `listening` → 브라우저가 스스로 발화 종료 감지 → `onresult` → `processing` → `done`
- 수동 완료: `listening` → 두 번째 클릭 → `finishListening()`(`stop()`) → `finishing` → `onresult` → `processing` → `done`(결과가 없으면 `finishing` → `no-speech` 오류)

---

## 10. 음성 완료 안내 문구 (`435245f`)

같은 커밋에서 `dictionary.js`에 `phrases.speechFinishGuide` 키가 en/ko/zh-CN 세 로케일 모두에 추가됐다.

- ko: `말을 마친 뒤 다시 누르거나 잠시 기다리면 결과를 분석해요.`
- en: `When you're done, tap again or wait a moment to analyze your speech.`
- zh-CN: `说完后再次点击，或稍等片刻即可分析语音。`

`VoiceHelpPlaceholder.jsx`에서 마이크 상태 문구 바로 아래, 기존 AI 기능 설명 문구 위에 `text-[0.7rem] text-ink-faint`(가장 작고 옅은 톤)로 한 줄 배치했다. 기존 AI 설명 문구(`phrases.voiceAiDescription`)는 삭제되지 않고 그대로 유지된다.

---

## 11. 빈 `suggestedReply` 발생 원인과 서버 검증 강화 (`435245f`)

실제 테스트에서 확인된 문제: 중국어 `多少？`, 영어 `What is this?` — 둘 다 식당에서 실제로 쓰일 수 있는 문장인데도, 결과 카드의 `originalPhrase`/`meaning`은 정상 표시된 반면 `suggestedReply`가 빈 문자열로 "성공" 처리되어 표시됐다.

**원인**: `mg-voice-help` Edge Function의 프롬프트(`buildPrompt`)에 "입력이 식당 상황과 무관하면 `suggestedReply`를 빈 문자열로 반환하라"는 규칙이 있었고, `normalizeAnalyzeContent()`는 `meaning`/`suggestedReply`/`suggestedReplyMeaning`이 문자열 타입인지만(`typeof === 'string'`) 검사해 빈 문자열도 그대로 통과시켰다. 위 두 발화를 모델이 "식당과 무관한 입력"으로 판단해 규칙대로 빈 문자열을 반환한 것으로 보인다.

**대응**: 이는 프론트엔드에서 임의의 문장을 채워 넣는 방식이 아니라, Edge Function 쪽의 프롬프트 규칙과 응답 유효성 검증을 강화하는 방식으로 해결했다.

- 프롬프트 규칙 변경: 식당과 무관한 입력이어도 `suggestedReply`를 비워두지 말고, 대상 언어로 짧은 안내(식당에서 쓸 표현을 다시 말해달라는 취지)를 채우도록 변경.
- `normalizeAnalyzeContent()`가 `meaning`/`suggestedReply`/`suggestedReplyMeaning` 세 필드를 `trim()` 후 비어 있으면 `invalid_shape` 에러로 처리하도록 강화(기존에는 타입 검사만 있었음).

```ts
for (const field of REQUIRED_STRING_FIELDS) {
    const value = record[field];
    if (typeof value !== "string" || !value.trim()) {
        throw new ProviderError(provider, "invalid_shape", `${provider} response has an empty/invalid field: ${field}`);
    }
}
```

`suggestedReplyPronunciation`은 이번에도 필수 검증에 포함하지 않았다 — 한국어 응답일 때만 필수라는 조건을 추가로 검사하게 하면, 정상적인 응답도 그 조건 하나 때문에 불필요하게 fallback을 타게 될 위험이 있다고 판단해 기존처럼 선택 필드(비어 있으면 빈 문자열)로 남겨뒀다.

---

## 12. Solar → OpenAI fallback 영향

`normalizeAnalyzeContent()`가 던지는 `invalid_shape` 에러는 `analyzeVoiceHelp()`의 Solar 호출 실패 처리에서 에러 종류(kind)를 구분하지 않고 무조건 OpenAI로 재시도하는 기존 구조에 그대로 올라탄다. 별도의 분기 추가 없이 다음이 성립한다.

- Solar가 빈 값(또는 공백만 있는 값)을 반환 → `invalid_shape` → OpenAI로 자동 재시도.
- OpenAI도 같은 필드를 비워서 반환 → 다시 `invalid_shape` → 최종적으로 사용자에게 오류로 처리(`phrases.voiceFailed`).

즉 "완전한 응답 하나"만 성공으로 인정되고, 어느 한쪽이라도 불완전하면 다른 provider로 넘어가거나 최종 실패로 처리된다.

---

## 13. Supabase Edge Function 재배포

이번 커밋(`435245f`)의 `supabase/functions/mg-voice-help/index.ts` 변경 사항을 실제 서비스에 반영하기 위해, 사용자가 아래 명령으로 Edge Function을 직접 재배포했다.

```
npx supabase functions deploy mg-voice-help
```

```
WARNING: Docker is not running
Uploading asset (mg-voice-help): supabase/functions/mg-voice-help/index.ts
Deployed Functions on project ...: mg-voice-help
```

Docker가 실행 중이지 않다는 경고가 있었지만 배포 자체는 성공했다. 이 배포는 저장소 커밋과 별개로 사용자가 직접 실행한 외부 작업이며, 이 문서에서는 `mg-voice-help` 함수가 재배포됐다는 사실만 기록한다.

---

## 14. GitHub Pages SPA 새로고침 404 원인

이 문제는 이번 범위 이전부터(서비스 초기부터) 존재했던 것으로 확인됐다. 별도의 읽기 전용 조사에서 다음이 확인됐다.

- `BrowserRouter`(basename `import.meta.env.BASE_URL` 기반)를 통한 앱 내부 이동은 정상 동작.
- `https://eclipticwin.github.io/matgil/phrases`처럼 내부 경로를 새로고침하거나 주소창에 직접 입력하면 GitHub Pages의 기본 404 페이지가 반환됨(실제 라이브 URL로 확인).
- GitHub Pages는 순수 정적 파일 서버로, `/matgil/phrases`에 매칭되는 실제 파일이 없으면 React 번들이 로드되기도 전에 서버 자체가 404를 반환한다 — React Router의 wildcard route(`<Route path="*">`)는 React가 이미 실행된 뒤에만 동작하므로 이 상황을 처리할 수 없다.
- 로컬 Vite dev server에서는 재현되지 않는다 — dev 서버 자체가 SPA history fallback을 기본 제공해, 매칭되는 정적 파일이 없는 모든 경로 요청을 자동으로 `index.html`로 재작성해 응답하기 때문이다.
- 과거에 `vite.config.js`/`src/app/App.jsx`(`base`/`basename` 계산)를 수정한 이력(`docs/24`)이 있었지만, 이는 로컬 dev 서버가 `base`를 빌드용 값으로 잘못 고정해서 생기던 dev 전용 흰 화면 문제를 고친 것이었을 뿐, GitHub Pages의 정적 호스팅 404 문제와는 무관했다. 저장소에는 `404.html`이나 경로 복원 스크립트가 이번 대응 전까지 한 번도 존재한 적이 없었다.

---

## 15. 404 redirect 및 경로 복원 구현 (`b9a50f3`)

`BrowserRouter`, `basename` 계산, `vite.config.js`, `src/app/router.jsx`, `src/shared/constants/routes.js`, GitHub Actions 배포 워크플로는 모두 그대로 유지했다 — 이미 올바르게 동작하고 있었고, 문제의 원인은 라우터가 아니라 정적 호스팅 계층이었기 때문이다. `HashRouter`로도 전환하지 않았다 — 기존 공유 URL(`og:url`, 카카오톡 공유 등 실제 경로 기반 딥링크)을 `#/phrases` 같은 형태로 바꾸면 크롤러·미리보기가 해시 뒤 경로를 제대로 읽지 못해 기존 공유 기능에 회귀가 생길 수 있다고 판단했기 때문이다.

대신 널리 쓰이는 `spa-github-pages`(rafgraph 방식) 표준 패턴을 프로젝트 base `/matgil/`에 맞게 적용했다. 신규 `public/404.html`이 GitHub Pages에서 매칭되는 파일이 없을 때 반환되며, 원래 경로를 다음과 같이 쿼리스트링에 접어 넣어 실제 존재하는 파일인 `/matgil/`(index.html)로 리다이렉트한다.

```js
var pathSegmentsToKeep = 1; // /matgil/ 이 project base이므로 그대로 보존
// 예: /matgil/phrases  ->  /matgil/?/phrases
```

`index.html`의 `<head>`(폰트 `<link>` 다음, Vite 모듈 스크립트 이전)에 추가된 복원 스크립트가 `location.search`가 `/`로 시작할 때만(즉 위 리다이렉트를 거쳐온 경우에만) 동작해 `window.history.replaceState()`로 주소를 원래 경로로 되돌린다 — 페이지를 다시 로드하지 않으며, React 앱 번들이 실행되기 전에 실행된다. 쿼리스트링에 포함된 실제 `&`는 `~and~`로 치환해 접어 넣은 경로 구분자용 `&`와 섞이지 않게 했고, 해시(`#...`)는 브라우저가 애초에 서버로 전송하지 않는 부분이라는 특성을 이용해 redirect·복원 양쪽 URL 끝에 그대로 이어붙이는 방식으로 보존했다.

redirect 대상은 항상 리터럴하게 실제 존재하는 `/matgil/`이므로, `/matgil/404.html`이나 다른 미존재 경로로 다시 보내는 무한 루프 구조가 될 수 없다.

---

## 16. 라우팅·공유 URL·동적 route 영향

`src/app/router.jsx`/`src/shared/constants/routes.js`는 이번 작업에서 읽기만 하고 수정하지 않았다. 등록된 모든 라우트(로그인/회원가입, `home`/`explore`/`community`/`popular`/`phrases`/`bookmark`/`my` 및 그 하위, `courseDetail(':id')`, `savedCourseDetail(':id')`, `publicCourseDetailPattern`, `placeDetail(':placeId')`, `placeReviews(':placeId')` 등 동적 세그먼트 포함)가 이번 404 대응의 적용 대상이다 — redirect·복원 스크립트는 경로 문자열 자체를 다루므로 라우트 이름이나 동적 세그먼트 존재 여부와 무관하게 동일하게 동작한다.

쿼리스트링, 해시, `&`가 포함된 쿼리, 한글/중국어 등 인코딩된 동적 세그먼트(`encodeURIComponent`로 인코딩된 `publicRouteKey` 등)를 포함한 다양한 경로 형태에 대해, 실제 브라우저 없이 redirect·복원 스크립트의 URL 연산 로직만 코드로 그대로 재현해 원래 경로로 정확히 복원되는지 확인했다(§19 참고).

---

## 17. 사용자 브라우저 확인 결과

**Voice Help**:
- 기존보다 어느 정도 개선된 것으로 확인됨. 두 번째 클릭 UX도 이전보다 나아졌다는 평가.
- 다만 사용자가 완전히 만족하는 수준은 아니며, 추가 미세 조정은 이번 범위에서 진행하지 않고 넘어가기로 함.
- 실제 발화 테스트는 수행했으나, 모든 브라우저·언어·반복 시나리오를 전부 검증한 것은 아니다.
- 빈 `suggestedReply` 방지 기능은 Edge Function 재배포 후 확인을 시도한 상태다.
- 이 항목들은 현재 대화에서 확인된 사용자 언급을 근거로 하며, 별도의 로그나 스크린샷 근거가 추가로 있는 것은 아니므로 **부분 확인** 상태로 기록한다.

**GitHub Pages 404**:
- 코드 수정·빌드·커밋·push는 완료됨.
- 배포 직후 `/phrases`에서 반복 새로고침했을 때 즉시 404가 재현되지는 않았다.
- 다만 기존 문제 자체가 브라우저를 한동안 사용하지 않다가 다시 접속했을 때 간헐적으로 발견된 적이 있어, 현재 시점에 **완전히 해결됐다고 확정하지 않는다.** 자연스러운 실사용·직접 링크·외부 앱을 통한 진입을 더 관찰할 필요가 있다.

**가게 저장 수**: `public.get_place_bookmark_count`가 실제 Supabase 프로젝트에 존재함을 사용자가 SQL Editor로 직접 확인했다(§7). 코드 빌드는 성공했으나, 이 문서 작성 시점 기준으로 실제 화면에서 저장 수가 새 RPC를 통해 정상 표시되는지에 대한 별도의 사용자 확인 보고는 없었다.

**일본어 안내**: 빌드 성공은 확인됐으나, 실제 화면에서 일본어 항목을 선택해 안내 모달이 뜨는지에 대한 사용자의 직접 확인 보고는 이 범위에서 별도로 없었다.

---

## 18. 변경 파일 종합

같은 파일이 여러 커밋에서 수정된 경우 아래 표에는 한 번만 정리했다(각 파일의 역할은 위 해당 절에서 설명).

| 파일 | 관련 절 | 관련 커밋 |
|---|---|---|
| `src/features/phrases/services/speechRecognitionService.js` | §8, §9 | `154897d`, `435245f` |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | §8, §9, §10 | `154897d`, `435245f` |
| `src/shared/i18n/dictionary.js` | §10 | `435245f` |
| `supabase/functions/mg-voice-help/index.ts` | §11, §12 | `435245f` |
| `src/features/explore/components/JapaneseComingSoonModal.jsx`(신규) | §6 | `bcaa851` |
| `src/features/explore/components/LanguageModal.jsx` | §6 | `bcaa851` |
| `src/features/explore/data/exploreOptions.js` | §6 | `bcaa851` |
| `src/pages/HomePage.jsx` | §6 | `bcaa851` |
| `src/pages/MyPage.jsx` | §6 | `bcaa851` |
| `src/features/explore/components/PlaceDetailSheet.jsx` | §7 | `422a83b` |
| `src/features/places/services/placeBookmarkService.js` | §7 | `422a83b` |
| `index.html` | §15 | `b9a50f3` |
| `public/404.html`(신규) | §15 | `b9a50f3` |

---

## 19. 빌드·정적 검사 결과

각 커밋 전 단계에서 `npm run build`(성공, 기존에도 있던 CSS 압축 경고 1건 외 신규 오류 없음)와 `git diff --check`(관련 파일 대상, 통과)를 실행했다.

GitHub Pages 대응(§15)에 대해서는 추가로 다음 두 가지를 별도로 검증했다.

- **redirect·복원 URL 왕복 검증**: 실제 브라우저 없이 `public/404.html`·`index.html` 스크립트의 URL 연산 로직을 그대로 옮겨 Node로 재현한 뒤, `/phrases`·`/explore`·`/places/:id`·`/places/:id/reviews`·공개 동선 상세·저장 동선 상세·쿼리스트링·해시·쿼리+해시·`&`가 포함된 쿼리·한글/중국어 인코딩 경로 등 18개 경로 형태 전부가 원래 경로로 정확히 복원됨을 확인했다(전부 PASS).
- **로컬 정적 서버 검증**: `dist/`를 `matgil/` 하위 폴더로 복사해 Python `http.server`(Vite dev server가 아닌 순수 정적 서버)로 서빙한 뒤, `/matgil/` → 200, `/matgil/phrases`·`/matgil/places/123` → 실제 404(Vite dev server와 달리 history fallback 없음)임을 재확인했다. 다만 Python `http.server`는 GitHub Pages처럼 404 상황에서 `404.html`을 자동으로 대신 서빙하는 기능이 없으므로, "GitHub Pages가 실제로 `404.html`을 반환하고 그 안의 스크립트가 실행되는" 전체 흐름 자체는 이 로컬 테스트로 재현하지 못했다 — 로컬 테스트의 구조적 한계다.
- `dist/404.html`이 `public/404.html`과 완전히 동일하게 생성됨, `dist/index.html`에 복원 스크립트가 포함되고 `og:url`/`og:title`/`og:description`/twitter 메타·`<title>`·폰트·asset 경로(`/matgil/assets/...`)가 그대로 유지됨을 직접 확인했다.

---

## 20. git 커밋·push 정보

| 커밋 | 메시지 | 포함 파일 | push 여부 |
|---|---|---|---|
| `154897d` | 음성 인식 세션이 결과/오류 없이 종료돼도 UI가 listening에 남지 않도록 수정 | `speechRecognitionService.js`, `VoiceHelpPlaceholder.jsx` | 완료 |
| `bcaa851` | 언어 선택 화면에 일본어 "준비 중" 안내 추가 | `JapaneseComingSoonModal.jsx`(신규), `LanguageModal.jsx`, `exploreOptions.js`, `HomePage.jsx`, `MyPage.jsx` | 완료 |
| `422a83b` | 가게 저장 수 조회를 전용 RPC로 변경 | `PlaceDetailSheet.jsx`, `placeBookmarkService.js` | 완료 |
| `435245f` | 음성 인식 두 번째 클릭을 완료 처리로 변경하고 추천 답변 빈 값 방지 | `VoiceHelpPlaceholder.jsx`, `speechRecognitionService.js`, `dictionary.js`, `mg-voice-help/index.ts` | 완료 |
| `b9a50f3` | GitHub Pages SPA 딥링크 새로고침 404 방지 | `index.html`, `public/404.html`(신규) | 완료 |

작성 시점 `git rev-parse HEAD`와 `git rev-parse @{u}`가 모두 `b9a50f376c1bc23d6751ce04dbd5a17610a3390d`로 일치해, 위 5개 커밋 모두 `origin/main`에 반영되어 있음을 확인했다.

---

## 21. 승인된 한계와 후속 과제

- Voice Help 두 번째 클릭 UX·빈 `suggestedReply` 방지는 사용자가 "이전보다 나아졌다"고 확인했으나 완전히 만족하는 수준은 아니며, 추가 미세 조정은 이번 범위에서 진행하지 않기로 했다.
- GitHub Pages 404 대응은 코드·빌드·검증까지는 완료했지만, 간헐적으로 나타나던 문제였다는 점을 고려해 **"완전히 해결됨"이라고 확정하지 않는다.** 장기적인 실사용·직접 링크·외부 앱 진입 관찰이 필요하다.
- 가게 저장 수 RPC와 일본어 안내는 빌드 성공까지만 이 문서의 근거이며, 실제 화면에서의 별도 사용자 확인 보고는 이 범위에 포함되지 않는다.
- `get_place_bookmark_count` RPC의 SQL 정의는 여전히 저장소에 문서화되어 있지 않다(§7) — 필요 시 `docs/sql-*.md` 형태로 별도 문서화가 후속 과제로 남아 있다.
