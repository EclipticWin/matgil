# 40. Voice Help — Solar 1차 LLM + OpenAI fallback 전환 구현 로그

## 작업 일자

2026-07-17

## 작업 배경

`Phrases > Voice Help`의 LLM 분석 호출 구조를 OpenAI 단독 호출에서 **Solar(Upstage) 1차 호출 → 실패 시 OpenAI gpt-4o-mini fallback** 구조로 변경했다. 이전 상태와 계획은 `ai-docs/11-voice-help-llm-plan.md`(작성 시점 기록으로만 유효, 분류는 `docs/32` 참조)와 `docs/14-voice-help-implementation-and-tts-improvements.md`(2026-06-18, 상단에 갱신 각주 추가)를 참고.

STT(Web Speech Recognition API)와 TTS(Web Speech Synthesis API)는 이번 작업 대상이 아니며 전혀 변경하지 않았다.

---

## 변경 파일

| 파일 | 변경 |
|---|---|
| `supabase/functions/mg-voice-help/index.ts` | `analyzeWithSolar()` 실제 구현, provider별 오류 분류(`ProviderError`), 공통 JSON 정규화 함수(`normalizeAnalyzeResult`), `analyzeVoiceHelp()`를 Solar 우선/OpenAI fallback 구조로 변경, 입력 길이 제한(500자) 추가 |
| `docs/14-voice-help-implementation-and-tts-improvements.md` | 상단에 "현재 상태 갱신" 각주 추가(본문 내용은 작성 시점 기록으로 보존, 왜곡 없음) |
| `docs/32-AI-DOCS-INVENTORY-AND-STATUS.md` | ai-docs/11 행의 "권장" 칸을 "보존(Solar 전환 전까지)" → "아카이브(전환 완료, 이 문서 참조)"로 갱신 |

다음 파일은 **변경하지 않았다** (요청 범위 및 §12 완료 조건):

- `src/features/phrases/services/speechRecognitionService.js` (STT)
- `src/features/phrases/services/ttsService.js` (TTS)
- `src/features/phrases/components/VoiceHelpPlaceholder.jsx` (UI, 상태 관리, 응답 필드 소비 방식)
- `src/shared/i18n/dictionary.js`
- 다른 Edge Function(`mg-tour-seed`, `mg-tour-en-enrich`, `mg-place-translate-en`, `delete-my-account`)

---

## 호출 흐름

```
Web Speech Recognition (브라우저)
→ transcript
→ supabase.functions.invoke('mg-voice-help')   ← 프론트 코드 변경 없음
→ Edge Function: analyzeVoiceHelp(input)
   1) analyzeWithSolar(input)  ── 최대 1회
      성공 + 파싱/필드 검증 통과 → 즉시 반환, OpenAI 미호출
      실패(아래 "fallback 조건") → 2)로 진행
   2) analyzeWithOpenAI(input) ── 최대 1회 (fallback)
      성공 → 반환
      실패 → 재시도 없이 최종 실패(500, 안전한 메시지)
→ 기존 JSON 응답 계약 그대로 반환
→ VoiceHelpPlaceholder.jsx 결과 카드 렌더링 (변경 없음)
→ 필요 시 speakKorean() TTS 재생 (변경 없음)
```

한 요청당 LLM 호출은 **최대 2회**(Solar 1회 + OpenAI fallback 1회)이며, Solar 처리가 완전히 실패로 확정된 뒤에만 순차적으로 OpenAI를 호출한다(동시 호출 없음, 자동 반복 재시도 없음).

---

## Solar API 규격

프로젝트 내 실제 활성 코드(`supabase/functions/mg-place-translate-en/index.ts:118-150` — 현재 배포된 함수의 Solar fallback 번역에 실사용 중)를 근거로 확정했다(추측 없음).

| 항목 | 값 |
|---|---|
| Endpoint | `https://api.upstage.ai/v1/chat/completions` |
| Method | `POST` |
| Authorization | `Bearer {SOLAR_API_KEY}` |
| Content-Type | `application/json` |
| Model | `solar-pro` |
| Body | `{ model, messages: [{role:"user", content}], temperature: 0.3, response_format: {type:"json_object"} }` (OpenAI 호환 chat completions 형식) |
| 응답 텍스트 경로 | `data.choices[0].message.content` |

OpenAI fallback은 기존과 동일(`gpt-4o-mini`, 동일 endpoint/형식).

Prompt(`buildPrompt`)는 Solar/OpenAI 양쪽에 **동일하게** 재사용한다 — provider별 프롬프트 분기 없음, 서비스 정책·JSON 구조 변경 없음.

---

## Fallback 조건

Solar 처리 중 아래 실패가 발생하면 OpenAI로 fallback한다(`ProviderError.kind`로 분류, 로그에만 기록):

- `config` — `SOLAR_API_KEY` 미설정
- `network` — fetch 자체 실패
- `timeout` — 10초(`PROVIDER_TIMEOUT_MS`) 초과, `AbortController`로 중단
- `auth` — HTTP 401/403
- `rate_limit` — HTTP 429
- `server` — HTTP 5xx
- `http_error` — 기타 비정상 HTTP 상태
- `empty_response` — 200 응답이지만 텍스트 없음
- `parse_error` — JSON 파싱 실패(마크다운 코드펜스·설명문 포함 케이스는 `extractJsonText()`가 먼저 제거를 시도한 뒤에도 실패한 경우)
- `invalid_shape` — 필수 필드(`originalPhrase`/`detectedLanguage`/`meaning`/`suggestedReplyKo`/`suggestedReplyRomanization`) 누락 또는 타입 불일치

**Fallback하지 않는 경우**(요청 자체가 잘못된 경우, Solar/OpenAI 호출 이전에 즉시 4xx 반환): `transcript` 누락/빈 문자열(400), `transcript` 500자 초과(400, 이번에 추가), JSON 파싱 불가 body(400), POST가 아닌 메서드(405), OPTIONS preflight(CORS 응답, LLM 호출 없음).

두 provider 모두 실패하면 재시도 없이 500과 안전한 메시지(`"Voice help analysis is temporarily unavailable. Please try again."`)만 반환한다 — 원본 provider 오류 문구·상태 코드·키 값은 클라이언트에 노출하지 않는다(이전 코드는 `OpenAI error: {status} {rawText}`를 그대로 클라이언트에 노출하고 있었음 — 이번 변경으로 이 노출도 함께 제거됨, §9 요구사항).

---

## 공통 정규화

- `extractJsonText()` — 마크다운 ` ```json ... ``` ` 코드펜스 제거, 설명문에 둘러싸인 경우 첫 `{`~마지막 `}` 구간 추출
- `normalizeAnalyzeResult()` — `JSON.parse` → 필수 문자열 필드 5종 존재/타입 검증 → 기존 응답 DTO(`AnalyzeResult`, `note`는 없으면 빈 문자열)로 변환
- Solar/OpenAI 모두 동일한 이 함수를 통과하므로 프론트 응답 계약은 provider와 무관하게 항상 동일하다. 응답에 provider/metadata 필드를 새로 추가하지 않았다(기존 계약에 없던 필드이므로 §9 지침에 따름) — provider 선택 정보는 서버 로그(`logProviderOutcome`)에서만 확인 가능.

---

## 환경변수 / Secret

- `SOLAR_API_KEY` — 이미 프로젝트에 등록된 이름(`ai-docs/11`, `ai-docs/SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE.md`, `mg-place-translate-en`에서 실사용 확인) 그대로 사용. 새 이름을 만들지 않았다.
- `OPENAI_API_KEY` — 기존 그대로 유지(제거하지 않음).
- 둘 다 Edge Function Secret로만 사용, `VITE_` 환경변수나 프론트 코드에 넣지 않았다.
- 두 키 모두 없으면: Solar가 `config` 실패 → OpenAI 시도도 `config` 실패 → 최종 500 안전 메시지(둘 다 없을 때 별도의 특수 문구를 만들지 않고 동일한 안전 문구로 처리 — 이유: 클라이언트에 provider별 설정 상태를 노출하지 않기 위함).

**이번 세션에서 `npx supabase secrets set`, `npx supabase functions deploy`를 실행하지 않았다.** 아래 "사용자 후속 작업" 참조.

---

## 보안 처리

- 클라이언트가 body로 provider/model을 지정할 수 없다(서버 코드가 `body.provider`/`body.model`을 읽지 않음 — 그런 필드 자체가 없음).
- API endpoint는 서버 코드에 고정 문자열로만 존재, 사용자 입력으로 받지 않음.
- 빈 문자열 거부(기존 유지), 입력 길이 500자 제한(신규 추가).
- **JWT/인증 정책은 이번에 변경하지 않았다** — `mg-voice-help`는 여전히 함수 자체 인증이 없고, 실제 `verify_jwt` 설정은 `supabase/config.toml`이 버전관리되지 않아 코드로 확인 불가(기존에 알려진 미확인 상태, `docs/2026-07-11-MATGIL-OPEN-ISSUES.md` ISSUE-01/08). 이 문서의 요청 범위에서도 "임의 변경하지 않음"으로 명시되어 있어 그대로 두었다.
- CORS 정책 변경 없음.
- 로그에는 provider명, 성공/실패, 실패 분류(`kind`), HTTP 상태 코드만 남긴다. API Key, JWT, 전체 transcript, provider 원본 응답 본문은 로그에 남기지 않는다.

---

## 자동 검증

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공. 기존에 알려진 warning 2건(CSS 구문 경고 1건, 500kB chunk 경고)만 존재, 신규 오류/경고 없음 |
| `git diff --check` | 통과(실제 whitespace 오류 없음, CRLF 관련 안내만 표시) |
| `git status` — 관련 없는 파일 변경 여부 | 이번에 수정한 파일은 위 "변경 파일" 표 3건뿐, 그 외 unstaged/untracked 변경 없음 |
| Deno 타입 체크(`deno check`) | **실행 못 함** — 이 환경에 Deno CLI 미설치. 코드 리뷰로 타입 정합성(캐치 블록 `unknown` 캐스팅, `Record<string, unknown>` 인덱싱, try/catch 이후 변수 할당 등)을 직접 확인했으나, 실제 Deno 런타임에서의 타입 체크·구문 오류 여부는 배포 전 최종 확인이 필요함 |

실제 `SOLAR_API_KEY`/`OPENAI_API_KEY` 값이 없는 환경이라 외부 API를 강제로 호출하지는 않았다. 코드 경로별 로직 트레이스(아래 "수동 테스트 항목" 1~15)는 코드 리딩으로 확인했으나 실제 API 응답으로 검증한 것은 아니다.

---

## 수동 테스트 항목 (배포 후 사용자 확인 필요)

1. Solar 정상 응답 → 정상 JSON 파싱 → 결과 카드 표시
2. Solar 마크다운 JSON 코드펜스 응답 → 정상 파싱
3. Solar 빈 응답 → OpenAI fallback 성공
4. Solar 잘못된 JSON → OpenAI fallback 성공
5. Solar timeout(10초) → OpenAI fallback 성공
6. Solar 401/403 → OpenAI fallback 성공
7. Solar 429 → OpenAI fallback 성공
8. Solar 5xx → OpenAI fallback 성공
9. Solar 필수 필드 누락 → OpenAI fallback 성공
10. Solar 실패 + OpenAI 실패 → 500 안전 메시지, 프론트 에러 상태(`errorMsg`) 표시 확인
11. Solar 성공 시 OpenAI 미호출 — Supabase 함수 로그에서 `provider=openai` 라인이 없는지 확인
12. `SOLAR_API_KEY` 미등록 상태에서 OpenAI fallback 동작
13. `OPENAI_API_KEY` 미등록 + Solar 실패 시 최종 실패 응답
14. 영어/한국어 transcript 각각 정상 분석
15. 주문/알레르기/결제 관련 발화 시나리오
16. 기존 결과 카드 UI/필드 호환(Original phrase / Meaning / Suggested reply) 회귀 없음
17. STT(마이크 버튼, listening 상태) 회귀 없음
18. TTS(Suggested reply 스피커 버튼) 회귀 없음
19. Supabase Edge Function 로그에서 API Key·전체 transcript가 노출되지 않는지 확인

---

## 사용자가 직접 실행할 명령 (직접 실행하지 않음)

`SOLAR_API_KEY`가 이미 등록되어 있는지는 아래로 먼저 확인 가능(값은 출력되지 않고 이름만 나옴):

```bash
npx supabase secrets list
```

등록되어 있지 않다면:

```bash
npx supabase secrets set SOLAR_API_KEY=...
```

기존 `OPENAI_API_KEY`가 이미 등록되어 있다면 다시 등록할 필요 없음(위 `secrets list`로 확인).

Secret 확인/등록 후 함수 배포:

```bash
npx supabase functions deploy mg-voice-help
```

`--no-verify-jwt` 플래그는 이번 요청 범위에서 임의로 제안하지 않는다 — 현재 `verify_jwt` 실제 설정이 코드로 확인되지 않는 상태(`docs/2026-07-11-MATGIL-OPEN-ISSUES.md` ISSUE-08)이므로, 배포 전 Supabase Dashboard에서 현재 설정을 먼저 확인하는 것을 권장한다.

---

## 남은 위험 / 확인 사항

- `mg-voice-help`는 여전히 함수 자체 인증이 없다(ISSUE-01, 이번 작업 범위 아님). 입력 길이 제한(500자)을 추가해 프롬프트 인젝션/과다 비용 리스크를 다소 줄였으나, 무인증 대량 호출로 인한 Solar+OpenAI 이중 비용 노출 가능성은 그대로 남아 있다.
- Deno 런타임 타입 체크를 이 환경에서 실행하지 못했다 — 배포 전 `npx supabase functions deploy`가 실패하면(타입 오류 등) 로그를 확인해야 한다.
- Solar(Upstage) API의 정확한 rate limit 수치, timeout 권장값은 Upstage 공식 문서에서 별도로 확인된 것이 아니라 프로젝트 관행(10초)으로 설정한 값이다 — 운영 중 실제 응답 지연 패턴을 보고 조정이 필요할 수 있다.
- `SOLAR_API_KEY`/`OPENAI_API_KEY`의 실제 등록 여부와 유효성(만료·크레딧 소진 등)은 이 세션에서 확인할 수 없었다.

---

## git / Supabase 작업 미실행 확인

- `git add` / `git commit` / `git push`를 실행하지 않았다.
- Supabase SQL을 실행하지 않았다(이번 작업은 DB 변경이 없음).
- `npx supabase secrets set`, `npx supabase functions deploy`를 실행하지 않았다.
