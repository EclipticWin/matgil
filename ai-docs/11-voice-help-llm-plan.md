# 11. Voice Help 음성 입력 및 LLM 분석 기능 계획

## 문서 목적

`Phrases` 페이지의 `Voice help` 탭을 실제 음성 입력 기반 보조 기능으로 확장하기 위한 구현 계획을 정리한다.

현재 `Voice help`는 placeholder UI 상태다.

현재 화면 구성:

* 큰 마이크 버튼
* `Tap and speak.`
* `Example result` 카드
* 향후 `Original phrase` / `Meaning` / `Suggested reply` 형태의 실제 분석 결과 표시 예정

이번 기능은 사용자가 식당에서 들은 말이나 직접 하고 싶은 말을 음성으로 입력하면, LLM이 상황을 분석해 의미와 추천 응답을 제공하는 기능이다.

초기 MVP에서는 **OpenAI API**로 먼저 구현한다.
단, 추후 **Solar LLM**으로 교체할 예정이므로, LLM 호출 코드는 provider를 바꾸기 쉽게 분리한다.

LLM API 키는 프론트에 노출하면 안 되므로 반드시 Supabase Edge Function을 통해 호출한다.

---

## 현재 등록된 Supabase Edge Function Secrets

현재 Supabase Edge Function Secrets에는 아래 키들이 등록되어 있다.

* `OPENAI_API_KEY`
* `SOLAR_API_KEY`
* `TOUR_KOR_API_SERVICE_KEY`
* `ADMIN_SEED_TOKEN`

이번 Voice help MVP에서는 `OPENAI_API_KEY`를 먼저 사용한다.

추후 Solar로 전환할 때는 `SOLAR_API_KEY`를 사용한다.

---

## 기능 목표

사용자가 `Voice help` 탭에서 큰 마이크 버튼을 누르고 말하면 다음 흐름으로 동작한다.

1. 브라우저에서 음성 입력을 받는다.
2. 음성을 텍스트로 변환한다.
3. 변환된 원문을 Supabase Edge Function으로 보낸다.
4. Edge Function에서 OpenAI API를 호출한다.
5. LLM 분석 결과를 프론트로 반환한다.
6. `Voice help` 결과 카드에 분석 결과를 표시한다.
7. `Suggested reply`의 한국어 문장은 기존 TTS 버튼으로 읽을 수 있게 한다.

---

## 사용자 시나리오

말하는 사람은 둘 중 하나일 수 있다.

### 1. 한국 식당 직원이 한국어로 말하는 경우

예:

```txt
선불입니다.
```

앱 결과:

```txt
Original phrase
선불입니다.

Meaning
You need to pay before eating.

Suggested reply
알겠어요.
Algeseoyo.
```

### 2. 외국인 관광객이 영어 등 외국어로 말하는 경우

예:

```txt
I want to order this.
```

앱 결과:

```txt
Original phrase
I want to order this.

Meaning
이걸로 주세요.

Suggested reply
이걸로 주세요.
Igeollo juseyo.
```

---

## 결과 카드 구조

현재 `Example result` 카드는 실제 분석 결과 카드로 발전시킨다.

분석 전에는 `Example result` placeholder를 표시할 수 있다.

분석 후에는 라벨을 아래처럼 변경한다.

```txt
Analysis result
```

또는

```txt
Result
```

---

## 결과 카드 필드

### 1. Original phrase

기존 `Korean phrase` 라벨은 부정확하므로 사용하지 않는다.

이유:

* 원문이 한국어일 수도 있음
* 원문이 영어일 수도 있음
* 원문이 다른 외국어일 수도 있음

따라서 라벨은 다음으로 변경한다.

```txt
Original phrase
```

여기에는 음성 인식된 원문 텍스트를 그대로 표시한다.

---

### 2. Meaning

`Meaning` 영역에는 원문의 의미 또는 번역 결과를 표시한다.

규칙:

| 원문 언어          | Meaning 표시        |
| -------------- | ----------------- |
| 한국어            | 현재 설정된 외국어로 의미 설명 |
| 외국어            | 한국어로 자연스럽게 변환     |
| 한국어 + 앱 언어 한국어 | 한국어로 쉽게 풀어 설명     |

현재 MVP 기준으로 앱 기본 외국어는 영어로 본다.

즉 MVP에서는 아래처럼 동작한다.

* 한국어 입력 → 영어로 meaning 제공
* 영어 입력 → 한국어 meaning / suggested reply 제공

---

### 3. Suggested reply

`Suggested reply` 영역은 유지한다.

목표:

* 식당 상황에서 바로 답할 수 있는 짧은 추천 응답 제공
* 한국어 문장과 romanization을 함께 제공
* 추천 응답 한국어 문장은 TTS로 재생 가능해야 함

예:

```txt
Suggested reply
알겠어요.
Algeseoyo.
```

또는:

```txt
Suggested reply
이걸로 주세요.
Igeollo juseyo.
```

---

## Suggested reply TTS

`Suggested reply` 영역에는 TTS 버튼을 추가한다.

요구사항:

* 추천 응답 한국어 문장을 읽어주는 버튼
* 기존 `speakKorean()` 사용
* 기존 `ttsService.js` 재사용
* Google 한국어 voice 우선 선택 로직 유지
* 외부 TTS API 사용 금지
* 외부 패키지 설치 금지
* 기존 `SpeakerIcon` 사용
* 이모지 사용 금지

예상 동작:

```js
speakKorean(result.suggestedReplyKo)
```

---

## LLM 연결 구조

OpenAI API 키와 Solar API 키는 프론트에 절대 노출하면 안 된다.

따라서 프론트에서 OpenAI 또는 Solar API를 직접 호출하지 않는다.

반드시 Supabase Edge Function을 통해 호출한다.

권장 구조:

```txt
VoiceHelpPlaceholder.jsx
→ Speech Recognition으로 transcript 획득
→ supabase.functions.invoke('mg-voice-help', { body })
→ Edge Function에서 OpenAI 호출
→ 분석 결과 반환
→ 프론트 결과 카드 업데이트
```

추후 Solar 전환 시에는 Edge Function 내부의 provider 함수만 교체한다.

---

## Edge Function

새 Edge Function이 필요하다.

이름 후보:

```txt
mg-voice-help
```

### 초기 MVP provider

초기 MVP에서는 OpenAI를 사용한다.

Edge Function 내부에서 사용할 secret:

```ts
Deno.env.get('OPENAI_API_KEY')
```

### 추후 Solar provider

추후 Solar로 전환할 때 사용할 secret:

```ts
Deno.env.get('SOLAR_API_KEY')
```

이번 구현에서 Solar를 실제 호출하지 않는다.
다만 Solar로 교체하기 쉽도록 LLM 호출 함수를 분리한다.

권장 구조:

```ts
async function analyzeWithOpenAI(input) {
  // OPENAI_API_KEY 사용
}

async function analyzeWithSolar(input) {
  // 추후 SOLAR_API_KEY 사용
}

async function analyzeVoiceHelp(input) {
  return analyzeWithOpenAI(input);
  // 추후 return analyzeWithSolar(input)로 교체 가능하게 유지
}
```

---

## Edge Function 요청 body 예시

```js
{
  transcript: "선불입니다.",
  userLanguage: "en",
  context: "Korean restaurant"
}
```

MVP에서는 `userLanguage`를 `"en"`으로 고정한다.

---

## Edge Function 응답 body 예시

```js
{
  originalPhrase: "선불입니다.",
  detectedLanguage: "ko",
  meaning: "You need to pay before eating.",
  suggestedReplyKo: "알겠어요.",
  suggestedReplyRomanization: "Algeseoyo.",
  note: "This is commonly used when payment is required before ordering or eating."
}
```

`note`는 응답에 포함되어도 되지만 MVP UI에는 표시하지 않는다.

---

## OpenAI 프롬프트 방향

Edge Function 내부에서 OpenAI에게 요청할 내용은 다음 방향을 따른다.

LLM 역할:

* 사용자의 음성 인식 텍스트가 한국어인지 외국어인지 판단
* 한국 식당 상황에 맞게 의미를 설명
* 사용자가 바로 쓸 수 있는 짧은 한국어 응답 추천
* romanization 제공
* 너무 긴 설명 금지
* 결과는 JSON 형태로 반환

응답 JSON 구조:

```js
{
  "originalPhrase": string,
  "detectedLanguage": string,
  "meaning": string,
  "suggestedReplyKo": string,
  "suggestedReplyRomanization": string,
  "note": string
}
```

### 중요한 출력 규칙

* 반드시 JSON만 반환하도록 요청한다.
* 마크다운 설명을 붙이지 않게 한다.
* `suggestedReplyKo`는 짧고 자연스러운 한국어 문장으로 제공한다.
* `suggestedReplyRomanization`은 외국인이 읽기 쉬운 로마자 표기로 제공한다.
* 한국어 입력이면 `meaning`은 영어로 설명한다.
* 영어 입력이면 `meaning`은 자연스러운 한국어 표현으로 제공한다.
* 식당 상황과 관련 없는 입력이면 정중하게 재시도하도록 안내하는 결과를 반환한다.

---

## Solar 전환 방향

초기 구현은 OpenAI로 진행한다.

추후 Solar로 전환할 때는 아래만 교체할 수 있게 한다.

* `analyzeWithOpenAI()` → `analyzeWithSolar()`
* secret: `OPENAI_API_KEY` → `SOLAR_API_KEY`
* API endpoint / request body 형식
* 응답 parsing 방식

프론트의 `VoiceHelpPlaceholder.jsx`는 provider 변경에 영향을 받지 않아야 한다.

---

## 음성 인식

MVP에서는 브라우저 Web Speech Recognition API를 우선 검토한다.

확인할 API:

```js
window.SpeechRecognition || window.webkitSpeechRecognition
```

권장 분리 파일:

```txt
src/features/phrases/services/speechRecognitionService.js
```

역할:

* 브라우저 Speech Recognition 지원 여부 확인
* 녹음 시작
* transcript 획득
* 에러 처리
* 권한 거부 처리
* 미지원 브라우저 처리

---

## Voice help 상태 관리

`VoiceHelpPlaceholder.jsx` 또는 새 컴포넌트에서 다음 상태를 관리한다.

| 상태         | 의미       | 화면                                      |
| ---------- | -------- | --------------------------------------- |
| idle       | 대기 상태    | 큰 마이크 버튼, Tap and speak, placeholder 카드 |
| listening  | 음성 인식 중  | Listening...                            |
| processing | LLM 분석 중 | Analyzing...                            |
| done       | 분석 완료    | Analysis result 카드                      |
| error      | 실패       | 짧은 에러 문구                                |

상태 예시:

```js
const [status, setStatus] = useState('idle');
// idle | listening | processing | done | error
```

---

## UI 방향

### Idle 상태

* 큰 원형 마이크 버튼 유지
* `Tap and speak.`
* 하단에는 placeholder 카드 표시 가능

### Listening 상태

* 마이크 버튼 상태 변경
* 짧은 문구:

```txt
Listening...
```

### Processing 상태

* 분석 중 표시

```txt
Analyzing...
```

### Done 상태

* 결과 카드에 실제 분석 결과 표시
* 카드 라벨은 `Analysis result`

### Error 상태

* 짧은 에러 문구 표시

```txt
Could not understand. Please try again.
```

---

## Speech Recognition 미지원 브라우저 처리

미지원 브라우저에서는 마이크 버튼을 비활성화하고 짧은 안내 문구를 보여준다.

문구 예시:

```txt
Voice input is not supported in this browser.
```

버튼을 숨기지는 말고 disabled 상태로 보여준다.

---

## 수정/생성 파일 후보

실제 구현 전 현재 구조를 확인한 뒤 확정한다.

예상 파일:

| 파일                                                          | 작업                                |
| ----------------------------------------------------------- | --------------------------------- |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx`  | 상태 관리 및 결과 카드 렌더링                 |
| `src/features/phrases/services/speechRecognitionService.js` | 신규 가능성, Web Speech Recognition 래퍼 |
| `src/features/phrases/services/ttsService.js`               | 기존 TTS 재사용, 가능하면 수정 금지            |
| `src/shared/components/Icon.jsx`                            | 기존 `MicIcon`, `SpeakerIcon` 재사용   |
| `src/lib/supabase.js` 또는 Supabase client 파일                 | functions.invoke 사용 확인            |
| `supabase/functions/mg-voice-help/index.ts`                 | 신규 Edge Function                  |
| Supabase Edge Function import/config 파일                     | 기존 구조 확인 후 필요 시 수정                |

---

## 절대 하지 말 것

* OpenAI API 키를 프론트 코드에 넣지 말 것
* Solar API 키를 프론트 코드에 넣지 말 것
* OpenAI 또는 Solar API를 브라우저에서 직접 호출하지 말 것
* API 키를 GitHub Actions env에 넣지 말 것
* 외부 TTS API 사용 금지
* 외부 패키지 설치 금지
* Map 탭 수정 금지
* Courses 탭 수정 금지
* Community 탭 수정 금지
* Common phrases 데이터 수정 금지
* 기존 TTS 재생 로직 망가뜨리지 말 것
* `ttsService.js`의 Google 한국어 voice 우선 선택 로직을 깨지 말 것
* 이모지 사용 금지
* 표현 데이터 DB 저장 금지
* 검색 기능 구현 금지

---

## 구현 전 확인 필요 항목

구현 계획을 세우기 전에 아래 정보가 필요하면 먼저 질문한다.

예:

* 현재 Supabase client 파일 위치
* 기존 Edge Function 이름과 구조
* 기존 LLM 호출 함수 존재 여부
* 기본 응답 언어
* 현재 앱 언어 설정 구조
* 음성 인식 지원 범위
* Voice help 결과 카드에 꼭 들어가야 하는 필드
* 이번 구현을 MVP로 줄여야 하는 범위

현재 결정된 항목:

| 항목               | 결정                     |
| ---------------- | ---------------------- |
| 초기 LLM provider  | OpenAI                 |
| 추후 provider      | Solar                  |
| OpenAI secret    | `OPENAI_API_KEY`       |
| Solar secret     | `SOLAR_API_KEY`        |
| MVP userLanguage | `en`                   |
| note UI 표시       | 표시하지 않음                |
| 미지원 브라우저 처리      | 버튼 disabled + 짧은 안내 문구 |

확실하지 않은 상태로 추측해서 구현하지 않는다.

필요한 정보는 `구현 전 확인 필요` 항목으로 따로 정리해서 질문한다.

---

## 구현 계획에서 먼저 보고할 것

아직 구현하지 말고, 계획 단계에서 아래를 먼저 보고한다.

1. 현재 `VoiceHelpPlaceholder` 구조
2. 현재 Supabase client / functions invoke 방식
3. 기존 Solar/OpenAI 또는 LLM Edge Function 존재 여부
4. 새 Edge Function이 필요한지
5. OpenAI 기반 초기 구현 구조
6. Solar로 나중에 교체하기 쉬운 구조
7. 사용할 Edge Function secret 이름
8. 음성 인식은 어떤 방식으로 붙일지
9. Voice help 상태 관리 방식
10. 결과 카드 데이터 구조
11. Suggested reply TTS 버튼 구현 방식
12. 수정/생성 파일 후보
13. 구현 단계
14. 주의할 점
15. 구현 전 확인이 필요한 정보
