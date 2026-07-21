# 49. Courses/Phrases 탭 UI 공용화·저장 탭 CTA 추가, Voice Help AI 안내 배지, mg-place-translate-en 백년가게 처리

- 작성일시: 2026-07-20 02:35:00

---

## 1. 목적

`docs/48-zh-cn-locale-common-utility-voice-help-filter-pill-and-mg-place-translate-zh-hardening.md`(커밋 `bbb2f26`) 이후 커밋되지 않은 상태로 워킹 디렉터리에 남아 있던 변경 사항을 실제 `git diff` 기준으로 정리한다. 아래 두 그룹은 파일 수정 시각이 서로 달라 별도 세션으로 보이며, 확인 가능한 사실만 기록한다.

1. **UI 그룹**(수정 시각 2026-07-20 02:27~02:29, `bbb2f26` 커밋 약 1시간 27분 뒤) — Courses/Phrases 페이지의 1차 탭을 공용 `UnderlineTabs` 컴포넌트로 교체, 저장한 가게/코스가 비어 있을 때 탐색 이동 CTA 버튼 추가, Voice Help 화면에 AI 기능 안내 문구 추가
2. **mg-place-translate-en 그룹**(수정 시각 2026-07-19 12:10, `bbb2f26` 커밋보다 이전 — 어느 문서에도 기록되지 않은 채 워킹 디렉터리에 남아 있던 변경) — "[백년가게]" 접두어 처리 및 주소 숫자 토큰 교정 프롬프트 보강

이 문서가 다루는 범위는 실제 `git diff`로 확인한 코드 변경뿐이며, 실제 Supabase/Solar/OpenAI API 호출, DB 반영, 함수 배포, git add/commit/push는 **문서화 시점까지** 수행하지 않았다.

---

## 2. UI 그룹

### 2.1 공용 `UnderlineTabs` 컴포넌트 신규 도입

- `src/shared/components/UnderlineTabs.jsx`(신규) — `{ tabs, value, onChange, className }`를 받는 텍스트 중심 탭 스위처. 비활성/활성 상태 모두 `border-b-2`를 렌더링하고 색상(`border-coral` vs `border-transparent`)과 폰트 굵기만 토글해, 탭 전환 시 버튼 레이아웃이 흔들리지 않도록 했다.
- `src/pages/CoursesPage.jsx` — 기존에 직접 작성돼 있던 탭 `<div>`+`<button>` 마크업(`cn()` 조건부 클래스 조합)을 제거하고 `UnderlineTabs`로 교체. 더 이상 쓰지 않게 된 `cn` import 제거. `TABS` 배열·탭 전환 로직(`setTab`)은 변경하지 않았다.
- `src/pages/PhrasesPage.jsx` — 1차 탭("자주 쓰는 표현"/"음성 도움")의 기존 알약형 배경 탭(`bg-ink/5` 컨테이너 + `bg-white` 활성 배경)을 `UnderlineTabs`로 교체. 2차 탭("전체"/"인기")은 기존 알약형 UI를 그대로 유지.
- `src/shared/i18n/dictionary.js` — `phrases.title` 아래 `subtitle` 키 신규 추가(en/ko/zh-CN 3개 전부), `PageHeader`에 `subtitle`/`subtitleClassName="[text-wrap:pretty]"`로 전달.
- 인기 표현 모드의 상단 설명 문구 `phrases.popularDescription`("Most saved phrases" 등) 키를 en/ko/zh-CN 딕셔너리에서 삭제하고, 렌더링에서도 해당 `<p>` 제거. 대신 인기 모드에도 일반 모드와 동일하게 `isTTSSupported()` 조건부의 "한국어로 들어보세요" 안내 배지를 표시하도록 추가(기존에는 일반 모드에만 있었음).
- 일반 표현 모드에서 TTS 안내 배지와 `PhraseCategoryTabs`의 렌더링 순서를 맞바꿔, 카테고리 탭이 먼저 오고 TTS 안내가 그 아래로 오도록 수정.
- 여백값 일부를 `mt-4`→`mt-5`로 조정(1차 탭 아래, 카테고리 탭 컨테이너 2곳).

### 2.2 저장한 가게/코스 빈 상태에 탐색 CTA 버튼 추가

- `src/features/courses/components/SavedPlacesTab.jsx` — 빈 상태(`EmptyState`)에 `action` prop으로 `<Button onClick={() => navigate(ROUTES.home)}>{t('savedPlaces.explorePlaces')}</Button>` 추가. `Button` 컴포넌트 import 추가. `EmptyState`는 기존에 이미 `action` prop을 지원하고 있어(`src/shared/components/EmptyState.jsx:4,14`) 별도 컴포넌트 수정은 필요 없었다.
- `src/features/courses/components/SavedRoutesTab.jsx` — 동일한 패턴으로 `action` CTA 버튼 추가(`t('savedCourses.exploreRoutes')`, 클릭 시 `navigate(ROUTES.home)`).
- `src/shared/i18n/dictionary.js` — `savedPlaces.explorePlaces`, `savedCourses.exploreRoutes` 키 신규 추가(en/ko/zh-CN 3개 전부).

### 2.3 Voice Help AI 기능 안내 배지 추가

- `src/shared/components/Icon.jsx` — `AiSparklesIcon` 신규 추가(큰 4방향 별 + 작은 4방향 별 2개 경로로 구성된 SVG, 기존 `SparkleIcon`의 단일 다이아몬드보다 더 별 모양에 가깝게 구분).
- `src/features/phrases/components/VoiceHelpPlaceholder.jsx` — 마이크 버튼/상태 문구와 예시 결과 카드 사이에 `AiSparklesIcon` + `t('phrases.voiceAiDescription')` 안내 줄 추가.
- `src/shared/i18n/dictionary.js` — `phrases.voiceAiDescription` 키 신규 추가(en/ko/zh-CN 3개 전부, 예: ko "내 음성을 한국어로 바꾸고, 한국어 음성을 내 언어로 이해해 보세요.").

### 2.4 테스트

- `npm run build` 성공(기존에 알려진 CSS 압축 경고 1건 외 신규 오류 없음)
- `git diff --check` 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음)
- 브라우저에서 직접 렌더링해 탭 전환/CTA 클릭/AI 안내 배지 표시를 확인하지는 않았다 — 이번 세션은 코드 diff 확인과 빌드 통과만 검증했다.

### 2.5 남은 것

- `savedPlaces.explorePlaces`/`savedCourses.exploreRoutes` 두 CTA 버튼 모두 `navigate(ROUTES.home)`으로만 이동한다 — 음식 필터가 열린 상태로 보내는 등의 세부 동작은 없다.
- 이 그룹의 변경은 아직 커밋되지 않았다.

---

## 3. mg-place-translate-en 그룹 — "[백년가게]" 접두어 처리 및 주소 숫자 교정 보강

### 3.1 배경

`supabase/functions/mg-place-translate-en/index.ts`는 마지막으로 커밋 `e0f2d4e`(2026-07-18)에서 수정된 이후, 이번에 확인한 diff가 커밋되지 않은 채 워킹 디렉터리에 남아 있었다. 이 diff는 어떤 기존 문서(docs/45~48)에도 기록돼 있지 않다.

### 3.2 수정 내용

**"[백년가게]" 접두어 번역 규칙 추가**
- 프롬프트에 규칙 추가: 한글 상호명이 "[백년가게]"(30년 이상 운영 업체에 부여되는 정부 인증 배지)로 시작하면 삭제하지 말고, 번역된 이름 맨 앞에 "Centennial Store: "를 붙이되, 괄호 안 원문 한글에는 접두어를 포함한 전체 원문을 그대로 유지하도록 지시(예시: `[백년가게] 삼거리 먼지막 순대국` → `"Centennial Store: Samgeori Meonjimak Sundaeguk ([백년가게] 삼거리 먼지막 순대국)"`).
- `validateTranslation()`의 상호명 검증 로직 수정 — 기존에는 `row.name`이 번역된 이름 문자열에 그대로 포함되는지만 확인했는데, "[백년가게]" 접두어가 붙은 원문은 번역문의 괄호 안에 그대로 들어가므로 이 자체는 문제없지만, 비교 로직을 `normalizeForNameComparison()`(NFKC 정규화 + 공백 제거) 기반으로 바꿔 폭 변형·공백 차이로 인한 오탐을 방지했다. `CENTENNIAL_STORE_PREFIX` 상수를 두어 비교 시에는 접두어를 뗀 본문만 확인하되(접두어 자체가 상호명의 일부가 아니므로), 실제 출력 데이터에서 접두어를 제거하는 로직은 없다 — 프롬프트가 요구하는 대로 출력에는 항상 접두어 포함 원문이 그대로 남는다.

**주소 숫자 토큰 교정 프롬프트 보강**
- `extractPriorAddress()` 신규 함수 — 검증 실패 후 재시도할 때 이전 모델 출력(`priorRaw`, 아직 형태 검증 전)에서 `address` 필드만 안전하게 추출(형태가 예상과 다르면 예외 대신 `null` 반환).
- `buildCorrectivePrompt()`에 "Address accuracy" 섹션 추가 — 원본 한글 주소 전체, 기존 `extractNumberTokens()`(기존 함수, 신규 아님)로 뽑은 필수 숫자 토큰 목록, 이전에 모델이 생성한 주소를 함께 제시하고 "나열된 모든 숫자 토큰이 정확히 같은 횟수로 등장해야 한다"는 지시를 추가 — 이전에는 주소 관련 재시도 시 이런 숫자 대조 근거 없이 일반 규칙만 반복 전달했다.

### 3.3 테스트

- `npm run build` 성공(TypeScript 컴파일 오류 없음)
- `git diff --check` 통과
- 실제 Solar/OpenAI 호출로 "[백년가게]" 접두어가 있는 실제 데이터에 대해 프롬프트가 의도대로 동작하는지, 주소 숫자 교정 프롬프트가 실제 재시도 성공률을 높이는지는 확인하지 않았다.

### 3.4 남은 것

- 이 diff는 `bbb2f26` 커밋보다 이전에 만들어진 것으로 보이며 지금까지 어떤 문서에도 기록되지 않고 커밋도 되지 않은 상태였다 — 이번 문서에서 처음으로 기록한다.
- `mg-place-translate-en` 함수는 아직 배포하지 않았다.

---

## 4. 전체 검증 요약

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공(기존에 알려진 CSS 압축 경고 1건 외 신규 오류 없음) |
| `git diff --check` | 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| 실제 Supabase/Solar/OpenAI API 호출 | 수행하지 않음 |
| 브라우저 UI 직접 확인 | 수행하지 않음 |
| DB 반영, 함수 배포 | 수행하지 않음 |
| git add/commit/push | 이 문서 작성 전까지 수행하지 않음 |

---

## 5. 사용자가 직접 해야 할 일

1. UI 그룹(§2)을 실제 브라우저에서 열어 탭 전환·CTA 버튼 동작·Voice Help AI 안내 배지 노출을 눈으로 확인
2. `mg-place-translate-en` 함수 배포 후, "[백년가게]" 접두어가 붙은 실제 상호명과 주소 숫자 교정이 필요한 실제 실패 사례로 재검증
3. 이 문서가 다루는 두 그룹 모두 아직 커밋되지 않았다 — 필요 시 별도 커밋으로 분리할지 하나로 묶을지 결정 필요
