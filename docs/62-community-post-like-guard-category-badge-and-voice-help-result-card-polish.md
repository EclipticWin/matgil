# 62. 커뮤니티 좋아요 로그인 가드·카테고리 표시, Voice Help 안내 문구·결과 카드 정리

## 1. 작업 일시

- 작성일시: 2026-07-28 00:20 KST
- 커밋 `6a2c445`은 2026-07-27 23:58 KST에 생성됐다. 이 문서 작성 시점 기준 `VoiceHelpPlaceholder.jsx`/`dictionary.js`의 나머지 변경은 아직 미커밋 상태였다(§5, §9~§12 참고).

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/61-voice-help-mobile-ux-bookmark-count-rpc-japanese-coming-soon-and-github-pages-refresh-fix.md`
- 기준 커밋: `44ccc20` (`docs: 61번 작업일지 추가 ...`) — `docs/61`을 도입한 커밋.
- 조사 범위: `44ccc20` 바로 다음 커밋부터 현재까지 — 실제 커밋 1건(`6a2c445`)과, 조사 시점 워킹 디렉터리에 남아 있던 미커밋 소스 변경(`VoiceHelpPlaceholder.jsx`, `dictionary.js`) 전부.
- 조사 시점 저장소 상태:
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`
  - `git rev-parse HEAD` = `git rev-parse @{u}` = `6a2c44598f0425b180573af656f5b1c3e99c3dba` — `6a2c445`까지는 push 완료.
  - `git status --short`: `M src/features/phrases/components/VoiceHelpPlaceholder.jsx`, `M src/shared/i18n/dictionary.js`, `?? .claude/worktrees/`(항상 제외) — 이 문서와 함께 커밋 대상.

---

## 3. 작업 배경

`docs/61` 이후 서로 다른 두 화면에 대한 작업이 진행됐다.

1. 커뮤니티 게시글 카드(`PostCard.jsx`) — 비로그인 좋아요 클릭 시 로그인 안내가 뜨지 않던 문제를 고치고, 카드 하단에 게시글 카테고리를 표시 — 1개 커밋(`6a2c445`)으로 반영.
2. Phrases 탭 Voice Help 화면(`VoiceHelpPlaceholder.jsx`) — 안내 문구를 두 줄 이내로 정리하고 반짝이 아이콘을 결과 카드 헤더로 옮기는 작업, 그리고 오류 상태에서 예시 결과 카드가 사라지던 문제를 고치는 작업이 이어졌다 — 두 차례의 수정이 하나의 미커밋 diff로 남아 있었다.

---

## 4. 이번 문서에서 제외한 항목

조사 시점 워킹 디렉터리 변경은 `VoiceHelpPlaceholder.jsx`, `dictionary.js` 두 파일뿐이며, 둘 다 이번 범위(§8~§11)에 포함된다. `.claude/worktrees/` 미추적 디렉터리 외에 제외할 무관한 변경은 없었다.

다음은 이미 `docs/61`에서 다룬 내용이며, 이 문서 범위에서 추가로 수정된 바가 없어 다시 설명하지 않는다.

- Voice Help 세션 종료 문제·마이크 두 번째 클릭 완료 UX·`suggestedReply` 빈 값 방지(`speechRecognitionService.js`, Edge Function)
- 가게 저장 수 전용 RPC, 일본어 "준비 중" 안내, GitHub Pages SPA 새로고침 404 대응

---

## 5. 커밋·미커밋 흐름 요약

| 구분 | 대상 | 주제 |
|---|---|---|
| 커밋(`6a2c445`, push 완료) | `PostCard.jsx` | 비로그인 좋아요 로그인 안내 표시, 게시글 카드 카테고리 표시 |
| 미커밋(이 문서와 함께 커밋 대상) | `VoiceHelpPlaceholder.jsx`, `dictionary.js` | 안내 문구 두 줄 정리, 반짝이 아이콘 결과 카드 헤더 이동, 오류 상태에서 예시 카드 유지 |

---

## 6. 커뮤니티 비로그인 좋아요 로그인 안내 표시 (`6a2c445`)

**문제**: 비로그인 상태에서 게시글 카드의 좋아요 버튼을 눌러도 로그인 안내 모달이 뜨지 않았다.

**원인**: `CommunityPage.jsx`의 `handleLike`는 이미 `if (!user) { openAuthPrompt(...); return; }`로 로그인 안내를 정확히 처리하고 있었다. 문제는 `PostCard.jsx`의 좋아요 버튼이 `disabled={!canLike}`(`canLike = isDbPost && user && !isOwn`)로 구현돼 있어, 비로그인 상태에서는 버튼 자체가 `disabled`되어 클릭 이벤트가 `onClick` 핸들러(→ `onLike` → `handleLike`)까지 도달하지 못한 것이었다. 로그인 안내 로직 자체는 이미 존재했지만, 그 로직에 도달하기 전에 버튼이 클릭을 막고 있었다.

**수정**: `disabled` 조건을 로그인 여부와 분리했다.

```js
// 이전
const canLike = isDbPost && user && !isOwn;
// disabled={!canLike}, onClick={() => canLike && onLike?.(post)}

// 이후
const likeDisabled = !isDbPost || isOwn;
// disabled={likeDisabled}, onClick={() => !likeDisabled && onLike?.(post)}
```

좋아요가 실제로 불가능한 두 경우(백엔드 글이 아닌 mock 게시글, 본인 글)만 버튼을 비활성화하고, 그 외에는 비로그인이어도 클릭이 `onLike`까지 도달해 기존 `handleLike`의 로그인 안내가 정상적으로 뜨도록 했다. 새 로그인 모달이나 새 로직을 추가하지 않았다 — 앱 전역에서 이미 쓰이는 `useAuthPrompt()`/`AuthRequiredModal`/`buildReturnTo` 조합을 그대로 재사용했다. 댓글 열람·`CommentBottomSheet.jsx`는 건드리지 않았다.

---

## 7. 커뮤니티 게시글 카드 카테고리 표시 (`6a2c445`)

카드 하단 통계 줄(좋아요·댓글) 오른쪽에 게시글 카테고리를 표시했다.

- 실제 카테고리 값: DB 컬럼 `mg_community_posts.category`가 `normalizeDbPost()`에서 `post.kind`로 별칭 저장된다.
- 라벨 소스: 새 매핑을 만들지 않고 기존 `getWriteCategoryLabel(key, locale)`(`communityConstants.js`)를 그대로 재사용했다 — `MyPostsView.jsx`(마이페이지 "내 게시글")가 이미 쓰던 것과 동일한 함수다. 이 함수는 글쓰기 화면의 `WRITE_CATEGORIES`만 인식하므로, 상단 필터에만 있는 `all`(전체 보기)·`popular`(인기순 정렬)는 애초에 인식 대상이 아니고, `null`/미인식 값은 `null`을 반환한다.
- `PostCard.jsx`: `{categoryLabel && (...)}`로 `null`일 때 카테고리 영역 자체를 렌더링하지 않아 레이아웃이 깨지거나 원시값이 노출되지 않는다.
- 배치: 좋아요·댓글 버튼을 `shrink-0` 왼쪽 그룹으로 묶고, 부모에 `justify-between`을 추가해 카테고리 `<span>`이 오른쪽 끝에 오도록 했다. 카테고리 텍스트는 부모의 폰트 크기를 상속하되 `font-normal`(부모 `font-semibold` 오버라이드)·`text-ink-faint`(숫자에 쓰이는 `text-ink-soft`보다 한 단계 옅은 톤)를 적용했고, 배경·테두리·pill 등 badge UI는 추가하지 않았다. `min-w-0 truncate`로 긴 번역에서도 왼쪽 통계와 겹치지 않게 했다.

---

## 8. Voice Help 안내 문구 두 줄 정리 (미커밋)

마이크 아래 안내 문구가 상태에 따라 계속 쌓이지 않도록 두 파생값(`showStatusLine`, `showFinishGuide`)으로 표시 규칙을 정리했다.

- **idle 메인 문구**: 기존 dictionary 키 `phrases.tapSpeak`를 그대로 사용 — 값 자체는 변경하지 않았다(en `Tap and speak.` / ko `누르고 말해보세요.` / zh-CN `点击后开始说话。`).
- **`phrases.speechFinishGuide`(보조 문구)만 아래처럼 짧게 변경**했다.

| locale | 이전 | 이후 |
|---|---|---|
| en | `When you're done, tap again or wait a moment to analyze your speech.` | `Tap again when you're done.` |
| ko | `말을 마친 뒤 다시 누르거나 잠시 기다리면 결과를 분석해요.` | `말을 마치면 다시 눌러주세요.` |
| zh-CN | `说完后再次点击，或稍等片刻即可分析语音。` | `说完后请再次点击。` |

- **상태별 표시 규칙**:
  - `idle`/`listening`: 메인 문구 + `speechFinishGuide` 모두 표시(2줄).
  - `finishing`/`processing`: 메인 문구(둘 다 기존 `phrases.analyzing` 재사용) 1줄만, 보조 문구는 숨김.
  - `done`: 메인 문구·보조 문구 모두 숨김 — 결과 카드가 화면의 초점이 되고, 더 이상 보고할 실시간 상태가 없기 때문이다.
  - `error`: 기존 오류 문구(`errorMsg` — `voiceDenied`/`voiceError`/`voiceFailed`)만 표시, 보조 문구는 숨김.
  - 음성 인식 미지원 브라우저(`!speechSupported`): `phrases.voiceUnsupported`만 표시, 보조 문구는 숨김.
  - 어떤 상태에서도 안내 문구가 두 줄을 넘지 않는다.

`speechRecognitionService.js`, Edge Function, `finishListening()`/`cancelListening()` 등 음성 인식 로직·상태 전이·마이크 버튼 동작은 전혀 수정하지 않았다.

---

## 9. 반짝이 아이콘 결과 카드 헤더 이동 (미커밋)

마이크 아래 별도 줄로 있던 긴 기능 설명 블록(반짝이 아이콘 `AiSparklesIcon` + `phrases.voiceAiDescription` 문구)을 화면에서 제거하고, 아이콘만 결과 카드 헤더 왼쪽으로 옮겼다.

```jsx
<div className="mb-3 flex items-center gap-1.5">
  <AiSparklesIcon size={27} className="shrink-0 text-coral" aria-hidden="true" />
  <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
    {isDone ? t('phrases.analysisResult') : t('phrases.exampleResult')}
  </p>
</div>
```

- 아이콘 크기: 기존 `size={34}` → `size={27}`(약 80%, 34×0.8=27.2를 자연스러운 정수로 반올림). 아이콘 자체와 `text-coral` 색상은 그대로 유지했다.
- `aria-hidden="true"`를 추가해 장식용임을 명시했고, 클릭 요소로 만들지 않았으며 배경·원형 컨테이너·badge·border는 추가하지 않았다.
- `phrases.voiceAiDescription` dictionary 키는 다른 화면에서 쓰이지 않는 것을 확인했지만, 삭제가 필수는 아니라는 지시에 따라 그대로 남겨뒀다 — 코드에서만 참조를 제거했다.
- 아이콘은 `isDone` 삼항 분기 바깥, 카드 헤더 div의 고정된 위치에 있어 예시(idle) 카드와 실제 결과(done) 카드 모두에서 항상 같은 위치에 나타난다. 카드 본문(`originalPhrase`/`meaning`/`suggestedReply`/`suggestedReplyPronunciation`/`suggestedReplyMeaning`/한국어 TTS 버튼/구분선/카드 배경·border·radius·padding·shadow)은 수정하지 않았다.

---

## 10. 세로 간격 정리 (미커밋)

별도의 여백 값을 새로 조정하지는 않았다. 대신 `done` 상태에서 상태 문구·보조 문구 블록 자체가 렌더링되지 않게 되면서(§8), 결과 카드(기존 `mt-8`)가 자연스럽게 마이크 버튼 바로 아래로 올라오는 효과를 얻었다. 마이크 버튼 크기, 언어 선택 영역, 카드 자체의 여백, 하단 패딩(`pb-8`)은 그대로 유지했다.

---

## 11. 오류 상태에서 예시 결과 카드 유지 (미커밋)

**문제**: 마이크 권한이 거부되거나(`Voice access denied.`) 다른 오류가 발생하면 하단의 `EXAMPLE RESULT` 카드 전체가 사라졌다.

**원인**: 카드 렌더링 조건 `const showCard = status === 'idle' || isDone;`에 `'error'` 상태가 아예 포함돼 있지 않았다.

**수정**:

```js
const showCard = status === 'idle' || status === 'error' || isDone;
```

카드 내용은 `const display = isDone ? result : (EXAMPLES[...] ?? ...)`로 이미 분기돼 있어 별도 수정이 필요 없었다 — `isDone`이 `true`인 경우(오직 `status === 'done'`)에만 실제 분석 결과를 쓰고, 그 외(`idle`/`error` 포함)에는 항상 정적 예시를 쓴다. 따라서 `error` 상태에서 실제 결과로 오인 표시될 가능성이 없고, 카드 헤더(`EXAMPLE RESULT` 텍스트·반짝이 아이콘)도 그대로 유지된다. `listening`/`finishing`/`processing`은 기존처럼 카드를 표시하지 않는다. 이 수정은 마이크 권한 거부뿐 아니라 `no-speech`/`network`/`audio-capture`/`start-failed` 등 `status`가 `'error'`로 귀결되는 모든 오류 코드에 동일하게 적용된다 — 오류 코드별로 분기하지 않고 `status === 'error'` 조건 하나로 처리되기 때문이다.

---

## 12. 변경 파일 종합

| 파일 | 관련 절 | 커밋 상태 |
|---|---|---|
| `src/features/community/components/PostCard.jsx` | §6, §7 | 커밋됨(`6a2c445`, push 완료) |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | §8, §9, §10, §11 | 이 문서와 함께 커밋 대상 |
| `src/shared/i18n/dictionary.js` | §8 | 이 문서와 함께 커밋 대상 |

---

## 13. 빌드·정적 검사 결과

각 수정 단계마다 `npm run build`(성공, 기존에도 있던 CSS 압축 경고 1건 외 신규 오류 없음)와 `git diff --check`(관련 파일 대상, 통과)를 실행했다. `dictionary.js`의 `speechFinishGuide` 값이 en/ko/zh-CN 세 로케일 모두에 반영됐음을 직접 확인했고, `PostCard.jsx`가 `getWriteCategoryLabel`을 재사용해 `WRITE_CATEGORIES`에 없는 `all`/`popular`/`null` 값을 개별 카테고리로 표시하지 않음을 코드로 확인했다.

**실제 브라우저 확인은 수행하지 못했다.** 이 환경에는 실제 브라우저 구동 도구(Playwright 등)가 준비돼 있지 않아 좋아요 클릭→로그인 모달→복귀 흐름, 카드 하단 카테고리 표시, Voice Help의 상태별 문구·아이콘 배치·오류 상태에서의 카드 유지 여부를 눈으로 직접 확인하지 못했다. 빌드 성공과 코드 정적 검토까지만 각 작업 시점의 근거로 남아 있다.

---

## 14. 승인된 한계와 후속 과제

- 이번 문서의 모든 변경은 빌드 성공과 정적 코드 검토까지만 검증됐고, 실제 브라우저에서의 시각적·기능적 확인은 아직 수행되지 않았다 — §13에 기록한 대로 완료로 단정하지 않는다.
- 커뮤니티 게시글의 실제 `category` 컬럼 값 분포(예: `null`인 기존 게시글이 실제로 존재하는지)는 Supabase에 직접 접속해 조회하지 않았다.
- Voice Help의 반짝이 아이콘 크기(80%)와 카드 헤더 정렬이 실제 모바일 화면에서 자연스러운 비율로 보이는지는 실기기 확인이 필요하다.
