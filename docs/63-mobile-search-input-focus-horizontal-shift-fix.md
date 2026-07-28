# 63. 모바일 검색 입력 포커스 시 화면 밀림 원인 조사 및 수정

## 1. 작업 일시

- 작성일시: 2026-07-28 20:40 KST 무렵
- 이번 문서가 다루는 실제 커밋 2건(`66df6c2`, `9158147`)은 모두 2026-07-28 20:12~20:31 KST 사이에 생성·push됐다. 문서 작성 시점 기준 `HEAD`와 `origin/main`은 `9158147`로 동일하다(§9 참고).

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/62-community-post-like-guard-category-badge-and-voice-help-result-card-polish.md`
- 기준 커밋: `9fcae85` (`docs: 62번 작업일지 추가 ...`) — `docs/62`를 도입한 커밋.
- 조사 범위: `9fcae85` 바로 다음 커밋부터 현재 `HEAD`까지 — 실제 커밋 2건(`66df6c2`, `9158147`).
- 조사 시점 저장소 상태:
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`
  - `git rev-parse HEAD` = `git rev-parse @{u}` = `9158147c2181f16887590c96fb495f128bfa4087` — `9158147`까지 push 완료.
  - `git status --short`: 변경 없음(clean). `.claude/worktrees/`는 `9158147`에서 `.gitignore`에 추가돼 더 이상 untracked로 잡히지 않는다(§7, §9 참고).

---

## 3. 문제 발견

실제 Android 휴대전화에서 Map 탭의 검색창을 열거나, Community 글쓰기 화면의 위치 추가 검색창을 열면 검색 input이 포커스되는 순간 앱 본문 전체가 왼쪽으로 밀리고 오른쪽에 `body`의 베이지 배경이 드러났다. 하단 내비게이션은 상대적으로 제자리에 남아 있는 것처럼 보였다.

- PC Chrome 개발자도구의 모바일 모드에서는 재현되지 않았다.
- 실제 Android Chrome과 Samsung Internet에서는 동일하게 재현됐다.
- 이 증상이 정확히 언제부터 생겼는지는 특정하지 못했다.

---

## 4. 관련 UI 구조

- Map 메인 화면의 검색 영역(`HomePage.jsx`)은 실제 `<input>`이 아니라 `SearchOverlay`를 여는 버튼이다. `SearchOverlay`가 열리면 기존 검색 버튼과 같은 위치·크기·간격을 유지한 채 배경색만 바뀐 것처럼 보이도록 설계돼 있다.
- 실제로 사용자가 포커스하는 `<input>`은 다음 두 곳뿐이다.
  - `src/features/explore/components/SearchOverlay.jsx`
  - `src/features/community/components/CommunityPlacePicker.jsx`
- 두 `<input>` 모두 `text-[0.95rem]`, `flex-1`을 쓰는 동일 계열의 flex 검색바 구조이며, 부모 `<div>`에는 `flex min-w-0 flex-1 items-center gap-2.5 pl-1`이 적용돼 있다.
- 두 컴포넌트 모두 열린 뒤 80ms 후 `inputRef.current?.focus()`로 자동 포커스한다.
- Map 메인 검색 버튼과의 시각적 일치를 유지해야 했기 때문에, 조사·수정 전 과정에서 글자 크기·높이·패딩은 임의로 변경하지 않았다.

---

## 5. 최초 원인 추정과 실패한 수정 (`66df6c2`)

공통 레이아웃 `AppLayout.jsx`의 `<main>`이 `overflow-y-auto`만 가지고 있어, CSS 스펙상 overflow-x가 암묵적으로 `auto`로 계산되며 가로 방향으로도 스크롤될 수 있다고 추정했다.

커밋 `66df6c2` (`fix: 모바일 검색 포커스 시 본문 가로 밀림 방지`)에서 `<main>`에 `overflow-x-hidden`을 추가했다.

```diff
-      <main className="no-scrollbar flex-1 overflow-y-auto">
+      <main className="no-scrollbar flex-1 overflow-x-hidden overflow-y-auto">
```

이 커밋은 곧바로 `origin/main`에 push됐다.

**실기기 재검증 결과**: Map 검색과 Community 위치 검색 모두 증상이 그대로였다. 화면이 여전히 왼쪽으로 밀리고 오른쪽에 베이지 배경이 드러났다.

따라서 "공통 `<main>`의 가로 overflow가 직접 원인"이라는 가설은 기각했다. 이미 push된 `66df6c2` 커밋 이력은 취소하거나 force push하지 않았고, 대신 사용자가 로컬에서 `AppLayout.jsx`의 `<main>`을 원래 상태인 아래 class로 직접 되돌렸다.

```
no-scrollbar flex-1 overflow-y-auto
```

이 로컬 원복은 이후 §6의 성공 수정과 함께 새 교정 커밋(`9158147`)에 포함됐다.

---

## 6. 실제 원인과 성공한 수정 (`9158147`)

두 실제 input의 부모 flex 영역(`div`)에는 `min-w-0`가 있었지만, `<input>` 자체에는 없었다.

문제가 된 구조:

```jsx
<div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
  <input className="flex-1 bg-transparent text-[0.95rem] font-medium text-ink placeholder:text-ink-faint outline-none" />
</div>
```

부모가 줄어들 수 있어도 `<input>` 자체의 기본 고유 최소 너비(intrinsic minimum width)는 그대로 남아 있을 수 있다. 실제 모바일 브라우저가 포커스된 caret를 화면 안에 보이도록 조정하는 과정에서, 이 남아 있는 고유 최소 너비 때문에 앱 프레임이 가로 방향으로 이동한 것으로 판단했다. 이는 코드 구조와 수정 전후 실기기 결과를 근거로 한 원인 판단이며, 브라우저 내부 동작을 직접 계측해 확인한 것은 아니다. PC 개발자도구 모바일 모드에서 재현되지 않았던 것도, 실제 모바일 키보드·포커스 시 브라우저의 viewport 보정이 개발자도구 에뮬레이션에서는 동일하게 발생하지 않기 때문으로 정리한다.

**수정**: `SearchOverlay.jsx`와 `CommunityPlacePicker.jsx`의 `<input>`에 동일하게 `min-w-0 w-0`만 추가했다.

```diff
-              className="flex-1 bg-transparent text-[0.95rem] font-medium text-ink placeholder:text-ink-faint outline-none"
+              className="min-w-0 w-0 flex-1 bg-transparent text-[0.95rem] font-medium text-ink placeholder:text-ink-faint outline-none"
```

각 class의 역할:
- `min-w-0`: input이 자신의 기본 고유 최소 너비보다 작아질 수 있게 해, flex 부모가 줄어드는 만큼 input도 함께 줄어들 수 있도록 한다.
- `w-0 flex-1`: 초기 너비를 0으로 두고, flex 행에서 아이콘·버튼을 제외하고 실제로 남은 공간만 `flex-1`로 배분받게 한다.

함께 반영된 교정:
- `AppLayout.jsx`의 실패한 `overflow-x-hidden` 수정 제거(§5) — `<main>`을 기존 `no-scrollbar flex-1 overflow-y-auto`로 복원.

이 세 파일 수정은 커밋 `9158147` (`fix: 모바일 검색 입력 포커스 시 화면 밀림 수정`) 하나로 함께 반영됐다. 같은 커밋에 `.gitignore`(`.claude/worktrees/` 추가) 변경도 포함됐다 — §7, §9 참고.

---

## 7. 변경하지 않은 항목과 UI 영향

다음은 이번 조사·수정 전체 과정에서 변경하지 않았다.

- `text-[0.95rem]`
- 검색창 높이 `h-[3.25rem]`
- padding, gap, radius
- Pin/Close/Filter 아이콘과 버튼 크기
- placeholder 문구와 스타일
- 80ms 자동 포커스
- 검색 결과 병합·Kakao 검색·내부 장소 검색 로직
- `SearchOverlay`의 열림/닫힘 애니메이션
- `index.html`의 viewport meta
- `max-w-app`
- `body`, `html`, `#root`의 overflow
- Map 메인의 검색 버튼

따라서 사용자에게 보이는 검색창의 글자 크기·높이·간격은 그대로 유지됐고, Map 메인 검색 버튼을 누를 때 `SearchOverlay`가 배경색만 바뀐 것처럼 자연스럽게 이어지는 기존 UX도 유지됐다.

이번 커밋(`9158147`)에는 이번 화면 밀림 수정과 별개로, `.claude/worktrees/`(에이전트 세션별 임시 워크트리, 커밋 대상이 아님)가 실수로 이전 커밋에 딸려 들어갔던 것을 막기 위해 `.gitignore`에 `.claude/worktrees/` 항목을 추가하는 변경도 함께 포함됐다. `.claude/worktrees/**` 자체는 이번 조사·수정 대상이 아니다.

---

## 8. 실기기 검증 결과

`9158147` commit·push 후 GitHub Pages 배포 화면에서 실제 Android 휴대전화로 직접 확인했다.

- Map 검색창 포커스 시 화면 밀림 해소.
- Community 위치 추가 검색창 포커스 시 화면 밀림 해소.
- 기존 검색창 UI와의 시각적 연결(높이·간격·배경 전환)이 그대로 유지됨.

PC 개발자도구 결과만으로 검증한 것이 아니라, 실제 배포 페이지와 실기기(Android Chrome, Samsung Internet)에서 해소를 확인했다.

---

## 9. 커밋 흐름

| 커밋 | 메시지 | 수정 파일 | 결과·의미 | push |
|---|---|---|---|---|
| `66df6c2` | fix: 모바일 검색 포커스 시 본문 가로 밀림 방지 | `src/shared/components/AppLayout.jsx` | `<main>`에 `overflow-x-hidden` 추가 — 실기기 재검증 결과 증상 미해소로 가설 기각(§5) | 완료 |
| `9158147` | fix: 모바일 검색 입력 포커스 시 화면 밀림 수정 | `.gitignore`, `src/shared/components/AppLayout.jsx`, `src/features/explore/components/SearchOverlay.jsx`, `src/features/community/components/CommunityPlacePicker.jsx` | `AppLayout.jsx` 원복 + 두 input에 `min-w-0 w-0` 추가로 실제 해소 확인(§6, §8) | 완료 |

`9fcae85`~`HEAD` 사이에는 이 두 커밋 외 다른 커밋이 없다 — 제외한 무관한 커밋은 없다.

---

## 10. 변경 파일 종합

| 파일 | 관련 절 | 커밋 |
|---|---|---|
| `src/shared/components/AppLayout.jsx` | §5, §6 | `66df6c2`(실패 수정), `9158147`(원복) |
| `src/features/explore/components/SearchOverlay.jsx` | §6 | `9158147` |
| `src/features/community/components/CommunityPlacePicker.jsx` | §6 | `9158147` |
| `.gitignore` | §7 | `9158147` |
| `docs/63-mobile-search-input-focus-horizontal-shift-fix.md`(이 문서) | 전체 | 신규 파일, 다음 작업 커밋에 포함 예정(§12) |

---

## 11. 빌드·검사

`9158147` 작업 시점에 다음이 확인됐다.

- `npm run build` 성공. 기존에도 있던 CSS 압축 경고("`-: T.Z;`" 관련 1건, 이번 변경과 무관) 외 신규 오류 없음.
- `git diff --check`, `git diff --cached --check` 모두 통과(공백/충돌마커 문제 없음 — 표시된 경고는 LF→CRLF 개행 정규화 알림뿐).
- 커밋 대상 파일이 지시한 4개 파일(`.gitignore`, `AppLayout.jsx`, `SearchOverlay.jsx`, `CommunityPlacePicker.jsx`)과 정확히 일치함을 `git diff --cached --name-status`로 확인.

`66df6c2` 작업 시점의 개별 빌드 로그는 별도로 남아 있지 않으나, 해당 커밋이 정상적으로 push되고 실기기 테스트로 이어졌다는 점에서 빌드 실패 상태로 push되지 않았음은 확인된다.

이 문서 작성 단계에서는 코드 수정이 없으므로 `npm run build`를 다시 실행하지 않았다.

---

## 12. 현재 상태 및 후속

- 화면 밀림 문제 수정은 `9158147`로 이미 commit·push 및 실제 배포 페이지·실기기 확인까지 끝난 상태다.
- 이번 작업은 이 작업일지(`docs/63`) 신규 작성만 수행했다 — 코드 파일은 수정하지 않았고, 기존 문서(`docs/62` 등)도 수정하지 않았다.
- 이 문서 자체는 이번에 commit·push하지 않는다. 다음 작업을 commit할 때 함께 포함할 예정이다.
- 문서 작성 시점 워킹 디렉터리에는 이 문서(`docs/63-...md`) 외의 미커밋 변경이 없었다(`git status --short` 확인, §2 참고).

---

## 13. 승인된 한계와 후속 과제

- `min-w-0 w-0` 추가로 인한 이론적 영향: 매우 좁은 화면에서 긴 검색어를 입력하면 placeholder나 입력값이 기존보다 일찍 잘려 보일 수 있으나, 이는 input이 실제 남은 공간 안에서만 동작하도록 하는 정상적인 flex 제약의 결과다. 입력값 자체는 스크롤·caret 이동으로 계속 사용할 수 있으며 검색 기능(디바운스, Kakao 검색, 내부 장소 검색, 결과 병합)에는 영향이 없다.
- 이번 수정은 데이터·상태·검색 요청 로직을 건드리지 않았고, 레이아웃의 실제 표시 크기(높이·padding·gap·버튼 크기)를 변경하지 않았으며, 문제가 된 두 input에만 국소 적용됐다. 전역 CSS나 앱 프레임 구조도 변경하지 않았고, `AppLayout`의 실패한 수정도 원상 복구됐다. §8에서 실기기 두 화면 모두 정상 확인됐으므로 현재까지 확인된 회귀는 없다.
- iOS Safari(Android 외 플랫폼)에서의 재검증은 아직 수행되지 않았다.
