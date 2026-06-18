# 14. Voice help 실제 구현, TTS 첫 클릭 무음 수정, 카테고리 접근성 보완

## 작업 일자

2026-06-18

---

## 이전 작업 기준

- 이전 문서: `docs/13-phrases-tts-and-voice-help-fixes.md`
- 이번 작업은 placeholder 상태였던 Voice help를 실제 동작하는 기능으로 연결하고, 이전 세션에서 남아 있던 TTS 첫 클릭 무음 문제를 추가 수정한 기록이다.

---

## 이번 작업 목표

1. Voice help — 음성 입력 → LLM 분석 → 결과 카드 전체 흐름 구현
2. Supabase Edge Function `mg-voice-help` 신규 생성 및 배포
3. TTS 첫 클릭 무음 문제 수정 (신규 증상)
4. Common phrases 카테고리 탭 PC 접근성 보완
5. README 로컬 URL 안내 보완

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `supabase/functions/mg-voice-help/index.ts` | 신규 생성 |
| `src/features/phrases/services/speechRecognitionService.js` | 신규 생성 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | 수정 |
| `src/features/phrases/services/ttsService.js` | 수정 |
| `src/features/phrases/components/PhraseCategoryTabs.jsx` | 수정 |
| `src/index.css` | 수정 (`.category-scroll` 유틸 추가) |
| `ai-docs/11-voice-help-llm-plan.md` | 신규 생성 (구현 계획 문서) |
| `README.md` | 수정 (로컬 URL 안내) |

---

## 핵심 구현 내용

### 1. Voice help 실제 구현

#### 전체 흐름

```
VoiceHelpPlaceholder.jsx
  → speechRecognitionService.js (Web Speech Recognition API)
  → transcript 획득
  → supabase.functions.invoke('mg-voice-help', { transcript, userLanguage: 'en', context: 'Korean restaurant' })
  → Edge Function에서 OpenAI gpt-4o-mini 호출
  → 분석 결과 반환
  → 결과 카드 렌더링
```

#### 상태 기계

```
idle → listening → processing → done
                              → error
listening에서 마이크 재클릭 → idle (cancel)
```

#### 결과 카드

| 필드 | 설명 |
|---|---|
| Original phrase | 음성 인식된 원문 텍스트 |
| Meaning | 한국어 → 영어 의미 설명, 또는 외국어 → 한국어 변환 |
| Suggested reply | 식당에서 바로 쓸 수 있는 짧은 한국어 문장 + romanization |

Suggested reply 한국어 문장은 기존 `speakKorean()`으로 TTS 재생 가능.

#### 미지원 브라우저 처리

`isSpeechRecognitionSupported()` false 시 마이크 버튼 disabled + 짧은 안내 문구 표시 (`Voice input is not supported here.`). 버튼은 숨기지 않음.

---

### 2. Supabase Edge Function — `mg-voice-help`

- 위치: `supabase/functions/mg-voice-help/index.ts`
- 초기 MVP: `OPENAI_API_KEY` secret 사용, `gpt-4o-mini` 모델
- OpenAI API 키는 Edge Function 내부에서만 사용. 프론트 코드, GitHub Actions env에 넣지 않음.
- 기존 `mg-tour-seed`, `chat` 함수는 건드리지 않음.

#### Solar 전환 대비 구조 분리

추후 Solar LLM으로 전환할 때 `analyzeVoiceHelp()` 한 줄만 교체하면 되도록 provider 함수를 분리해 두었다.

```ts
async function analyzeWithOpenAI(input) { /* OPENAI_API_KEY */ }
async function analyzeWithSolar(input)  { /* stub — 추후 구현 */ }
async function analyzeVoiceHelp(input)  { return analyzeWithOpenAI(input); }
```

프론트(`VoiceHelpPlaceholder.jsx`)는 provider 변경에 영향을 받지 않는다.

---

### 3. Voice help 문구 정리

권한 거부 문구와 미지원 브라우저 문구를 PC/모바일 어디서나 어색하지 않게 짧게 수정했다.

| 항목 | 이전 | 이후 |
|---|---|---|
| 권한 거부 | `Microphone access was denied.` | `Voice access denied.` |
| 미지원 브라우저 | `Voice input is not supported in this browser.` | `Voice input is not supported here.` |

---

### 4. TTS 첫 클릭 무음 문제 수정

#### 증상

페이지 새로고침 직후 첫 TTS 클릭 시 `onstart` / `onend` 이벤트는 발화하지만 실제 음성이 나오지 않았다. 두 번째 클릭부터는 정상 재생.

#### 원인

Chrome은 `speechSynthesis.getVoices()`를 비동기로 로딩한다. 페이지 로드 직후 첫 호출 시 빈 배열을 반환하므로 `getKoreanVoice()`가 `null` 반환 → `lang=ko-KR`만 설정 → 브라우저 기본값으로 Microsoft Heami가 선택됐다. 이 voice는 이벤트는 발화하지만 실제 오디오를 출력하지 않는다.

docs/13에서 voice 우선순위(`Google 한국어 ko-KR` 최우선)는 이미 수정되어 있었으나, voice 목록 자체가 첫 호출에 비어 있어 해당 로직이 무의미했다.

#### 해결 — `ttsService.js` 수정

1. **모듈 로드 시 pre-warm**: `ttsService.js`가 import될 때 `voiceschanged` 이벤트를 등록해 voice 목록이 로딩되는 즉시 `Google 한국어 ko-KR`을 모듈 변수에 캐싱.

2. **첫 클릭 시 queueing**: `speakKorean()` 호출 시점에 voices가 아직 비어 있으면 `voiceschanged` 이벤트를 한 번 더 구독해, 로딩 완료 후 즉시 speak 실행.

3. **delay 조건 수정**: 기존 `setTimeout 50ms`는 실제로 `cancel()`을 호출한 경우(`wasSpeaking === true`)에만 적용하도록 변경. 아무것도 재생 중이지 않을 때는 즉시 재생.

#### 결과

- 첫 클릭부터 `Google 한국어 ko-KR` voice 선택 확인
- `ttsService.js`의 voice 우선순위 로직 그대로 유지
- Voice help Suggested reply TTS에도 동일하게 적용

---

### 5. Common phrases 카테고리 탭 PC 접근성 보완

#### 문제

모바일/터치 환경에서는 가로 스와이프로 카테고리 이동이 정상 동작하나, PC 브라우저에서는 스크롤바가 숨겨져 있어 마우스로 오른쪽 카테고리에 접근하기 어려웠다.

#### 시도한 방법 — flex-wrap chip layout (취소)

카테고리 버튼을 줄바꿈 가능하게 바꿨으나 UI가 너저분해 취소했다.

#### 최종 해결 — CSS media query로 환경별 scrollbar 분기

`index.css`에 `.category-scroll` 유틸 클래스를 추가:

- 기본 (모바일/터치): scrollbar 숨김 — 기존 `.no-scrollbar`와 동일
- `@media (hover: hover) and (pointer: fine)` (PC/마우스): scrollbar 표시, height 3px thin style

`PhraseCategoryTabs.jsx`에서 `no-scrollbar` → `category-scroll`로 교체. 한 줄 가로 스크롤 구조(`flex min-w-max`) 변경 없음.

---

### 6. README 로컬 URL 안내 보완

`vite.config.js`의 `base: '/matgil/'` 설정 때문에 로컬 개발 시에도 Vite가 출력하는 URL 뒤에 `/matgil/` prefix가 필요하다. 포트 번호는 환경에 따라 달라질 수 있으므로 고정값으로 표기하지 않고, 터미널 출력 URL 기준으로 안내하도록 README Run 섹션에 note를 추가했다.

`/` 또는 `/phrases`처럼 prefix 없이 접근하면 Vite base URL 경고가 뜰 수 있으나 배포 오류는 아니다.

---

## 현재 안정 상태

- Voice help 전체 흐름 (음성 입력 → LLM 분석 → 결과 카드 → TTS) 정상 동작 확인
- Common phrases TTS 첫 클릭부터 정상 재생 확인
- 카테고리 탭 모바일 터치 스와이프 + PC 스크롤바 접근 가능

### 주의 — 아래 파일은 특별한 이유 없이 건드리지 말 것

| 파일 | 이유 |
|---|---|
| `src/features/phrases/services/ttsService.js` | voice pre-warm + 첫 클릭 무음 수정 포함 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | 상태 기계 + Edge Function 호출 안정 |
| `src/features/phrases/services/speechRecognitionService.js` | Web Speech API 래퍼 안정 |
| `supabase/functions/mg-voice-help/index.ts` | OpenAI 연결 + Solar 전환 구조 포함 |

---

## 아직 하지 않은 것

- Solar LLM으로 provider 전환
- 음성 인식 언어 설정 (현재 `userLanguage: 'en'` 고정)
- Voice help 결과 히스토리
- Common phrases 카테고리 마우스 휠 가로 스크롤 (Shift + 휠로 대체 가능)
- 표현 즐겨찾기
- 표현 데이터 DB 저장
