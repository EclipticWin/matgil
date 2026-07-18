# 45. mg-place-translate-en 검증·fallback 개선 및 실제 실행 기록

## 작업 일시

- 일자: 2026-07-18
- 시각: 23:26 KST

## 작업 배경

`docs/44-saved-course-locale-consistency-and-all-filter-fix.md` 이후 진행된 작업을 정리한다. 크게 두 갈래다.

1. 저장 동선 프런트엔드의 후속 수정(기준 위치 표시, 추천 카드 제목, 영문 주소 표시, 취향 표시)
2. `supabase/functions/mg-place-translate-en`(한국어→영어 기계번역 Edge Function) 검증·안전장치 개선과, 사용자가 실제로 진행한 dryRun/실저장 실행 기록

이 문서는 두 갈래를 모두 다루되, 2번(번역 함수)을 중심으로 상세히 기록한다. 이 세션(AI 작업자)은 **어떤 단계에서도 실제 OpenAI/Solar API 호출, DB 저장(`dryRun=false`), SQL 실행, Edge Function 배포를 수행하지 않았다** — 아래 "실제 실행 여부 구분"에서 각 사실의 출처(AI 세션에서 직접 확인한 것 / 사용자가 실행 후 보고한 것)를 명확히 구분한다.

---

## 1. 저장 동선 프런트엔드 후속 수정 (요약)

`docs/44` 이후 다음 수정이 순서대로 진행됐다(전부 이 세션에서 코드로 확인·`npm run build`/`git diff --check` 검증 완료, 실제 브라우저 테스트는 미실행).

1. **제목용 지역명과 상세용 기준 위치 분리**: `getAnchorLocationPart()` 하나였던 함수를 `getAnchorAreaPart()`(제목 전용, 넓은 지역명)와 `getAnchorDisplayLocation()`(상세 전용, 구체 장소명/주소 우선)로 분리. `savedCourseService.js`의 `buildAnchorFields()`가 search 타입에도 `anchor_area_original`/`anchor_address_original`을 채우도록 보강(기존엔 map/gps만 채웠음).
2. **추천 동선 카드 제목 중복 수정**: `courseBuilder.js`의 `buildRecommendedCourses()`가 카드 2개 이상일 때 `appendCourseSequenceNumber()`로 제목 끝에 순번(1, 2, 3...)을 부여 — 사용자가 선택하지 않은 취향을 추측해 넣지 않고, 실제 추천 전략 정보가 없으므로 결정적 순번만 사용.
3. **영어 화면 한국어 주소 노출 수정**: `containsHangul()` 유틸로 영어 locale에서 한글 포함 문자열을 걸러내고, `seoulDistricts.js`에 `formatKoreanAddressToEnglish()`(표준 로마자 표기법 자모 테이블 기반, 동/로/길/대로 접미사 분리 처리)를 신규 구현해 `55Toegye-ro` 같은 실제 영문 주소를 생성하도록 개선(구 단위 fallback은 최후 수단으로 격하).
4. **취향 줄 "선택 안 함" 표시**: `getSavedCoursePreferenceLine()`이 `preference_keys`가 빈 배열일 때 줄 자체를 숨기지 않고 `선택 안 함`/`None selected`를 표시하도록 수정(`dictionary.js`에 `courseDetail.preferencesNone` 키 추가).

---

## 2. mg-place-translate-en 함수 수정 전체 과정

### 2.1 최초 프롬프트·검증 안전장치 도입

실제 잘못된 Solar 번역 사례(즉석떡볶이 → "Jjeoktteokbokki", 청포도리코타샐러드 → "Cheongpodoricot Salad", 할라피뇨 피자 → "Halapinyo Pizza" 등)를 근거로:

- 프롬프트에 `[장소명]/[메뉴명]/[주소]/[설명]/[운영 정보]/[출력 형식]` 섹션 신설 — 보수적 음차 + 한글 원문 괄호 보존 원칙, 외래어 복원 예시(할라피뇨→Jalapeño, 로제→Rosé, 리코타→Ricotta, 트러플→Truffle) 명시.
- 코드 검증 도입: JSON 스키마 검증(`isTranslatedTextShape`), name 빈 값/한글 원문 미포함 시 실패, 원본 null 필드가 임의로 채워지면 복원(`restoreNullsFromSource`), 메뉴 `/` 개수 검증(`slashItemCount`, 당시엔 증가만 체크).

### 2.2 검증 실패 시 fallback/재시도 부재 수정

기존 `translateText()`는 provider 호출 자체가 실패할 때만 Solar로 넘어가고, **검증 실패는 곧바로 throw**되는 버그가 있었다. 다음과 같이 재작성:

- OpenAI 키가 있으면: ① OpenAI 신규 프롬프트 → ② 실패(호출 또는 검증) 시 Solar 신규 프롬프트 → ③ Solar 결과도 검증 실패면 Solar로 **1회 교정 재시도**(직전 오답 JSON + 검증 실패 사유 + "처음부터 다시 창작 금지" 규칙 포함한 교정 프롬프트). 건당 최대 3회 호출.
- OpenAI 키가 없으면(현재 운영 환경): Solar 신규 → 검증 실패 시 Solar 교정 재시도. 건당 최대 2회 호출.
- 네트워크 실패는 교정 재시도 대상이 아님(고칠 대상이 없으므로) — 다음 provider로만 넘어감.

### 2.3 메뉴 배열 구조 변경 및 개수 검증

기존엔 `treat_menu`를 통짜 문자열로 모델에 맡겨 `/` 개수를 문자열 기준으로만 셌는데, 모델이 `등`을 `, etc.`로 바꾸며 별도 `/` 항목을 만들어 "번역 결과가 원본보다 많다"는 오탐이 발생했다(예: 요리하는남자 원본 4개 → Solar 결과 7개로 오판).

수정: 서버가 `first_menu`/`treat_menu`를 `/` 기준으로 미리 배열(`first_menu_items`/`treat_menu_items`)로 쪼개 프롬프트 input에 전달하고, 모델도 **배열**로 응답하도록 스키마 변경(`RawModelOutput`). 검증은 `translatedItems.length !== originalItems.length`로 **정확히 일치**해야 통과(증가·감소 모두 차단). 검증 통과 후 `" / "`로 다시 join해 기존 DB 컬럼/응답 문자열 구조는 그대로 유지.

### 2.4 숫자·주소·요일·시간·null 검증 강화

- **주소 숫자**: `hasExactlySameNumberTokens()` — 원본과 번역의 숫자 멀티셋이 **정확히 일치**해야 함(순서 무관, 개수까지 동일 — 누락·변경·추가 전부 차단). 행운돈까스 사례(마조로1길 2 1층 → 건물번호 2 누락, 층수 소실)가 계기.
- **주소 공백 정규화**: `normalizeAddressSpacing()` — `55Toegye-ro` → `55 Toegye-ro`처럼 숫자+영문 붙음을 교정하되 `217ga-gil`, `1F`/`2F`는 그대로 유지. 정규식을 예외 배열(`ga-gil`, `F`) 기반으로 재구성해 명확화.
- **요일**: `preservesDaysAndTimes()` — 원본 한국어 요일(월~일)을 영문 변환한 **집합**과 번역문에서 실제 발견되는 영문 요일 **집합**이 정확히 같아야 함(요일이 바뀌거나, 엉뚱한 요일이 추가돼도 실패).
- **시간**: `HH:MM` 패턴 토큰이 원본에 있으면 번역문에 그대로 포함돼야 함.
- **non-null → null 차단**: `MUST_NOT_BECOME_NULL_KEYS`(address/open_time/rest_date/parking/packing) + 메뉴 전용 `validateMenuItemsField` — 원본이 non-null인데 번역이 null이면 무조건 실패(우정낙지 first_menu=낙지볶음이 null로 나온 사례가 계기).

### 2.5 `buildOutputSchemaExample()` 유효 JSON 수정

프롬프트 마지막에 보여주는 출력 예시가 `row`의 실제 null 여부를 반영하는 동적 예시로 개선됐으나, 배열 필드 예시를 `[...]`(유효하지 않은 JSON)로 썼던 실수가 있었다. `["..."]`로 수정해 예시 자체가 `JSON.parse()` 가능하도록 교정(이 세션에서 실제 `JSON.parse()`로 검증 완료).

### 2.6 upsert → insert 전환 (기존 en 행 보호)

기존 `.upsert(data, { onConflict: "place_id,locale" })`는 조회-저장 사이 경쟁 상태에서 기존 en 행(특히 `translation_status='source'` 공식 데이터)을 UPDATE할 위험을 완전히 배제할 수 없었다.

수정: `.insert(...)`로 전환 — INSERT는 구조적으로 기존 행을 UPDATE할 수 없으므로(성공 시 새 행 생성, 충돌 시 실패만) 어떤 경쟁 상태에서도 기존 en 행을 덮어쓸 수 없다. 충돌(Postgres `23505`) 시 `skipped`/`en row already exists`로 기록하고 전체 실패로 처리하지 않음. 저장 직전 재조회는 유지, `(place_id, locale)` UNIQUE 제약은 최종 방어선으로 유지.

### 2.7 토큰 사용량 집계 보완

기존엔 `translateText()`가 검증 실패 시 throw하며 usage를 버렸다. `translateText()`가 더 이상 throw하지 않고 `{ ok, translated?, provider?, error?, attemptUsages[] }`를 반환하도록 재설계 — 검증에 실패한 시도라도 **실제 API 호출이 성공했다면** 그 토큰 사용량을 `attemptUsages`에 담아 호출부가 항상 `usageByProvider`에 합산한다(네트워크 자체 실패는 usage 데이터가 없으므로 집계에서 제외).

### 2.8 en place_id 조회 페이지네이션 (PostgREST 1000행 제한)

**증상**: 실제 DB의 영문 누락 앞 20건은 `place_id 1059`부터 시작하는데, 함수가 이미 en 행이 있는 `1011~1030`을 다시 번역한 뒤 전부 `skipped` 처리했다.

**원인**: Step 1의 en place_id 조회가 `.select("place_id").eq("locale","en")`만 사용하고 명시적 `.range()`/`.limit()`이 없어, **PostgREST 기본 반환 행 제한(1000행)**에 걸려 en 행 1052건 중 뒷부분이 잘렸다. 불완전한 제외 목록 때문에 이미 번역된 place_id가 다시 번역 대상으로 잡혀 불필요한 API 호출과 토큰이 낭비됐다(1011~1030이 다시 잡혀 skipped 처리된 것이 이 버그의 직접적 증거).

**수정**: `.range(from, to)`로 1000건 단위 페이지네이션 루프를 돌며 전부 수집하고, `Set`으로 중복 제거 후 배열로 변환해 기존 `not-in` 제외 목록에 사용. `place_id` 오름차순 정렬(`.order()`)과 `limit` 최대 50 정책은 그대로 유지. 이 세션에서 1052건(1000+52 페이지)을 모의 데이터로 재현해 정상 수집을 확인했다(실제 DB 접근 없이 순수 로직만 검증).

---

## 3. 실제 실행 기록 (사용자 보고)

아래는 **사용자가 실제로 dryRun/실저장을 실행하며 확인·보고한 내용**이다. 이 세션은 이 실행들을 직접 수행하지 않았으며, 아래 수치·사례는 사용자의 보고를 그대로 옮긴 것이다.

### 3.1 사용한 PowerShell 명령 (대표형, 반복 실행 로그는 생략)

```powershell
Remove-Variable result -ErrorAction SilentlyContinue
$body = @{
    dryRun = $false
    limit  = 20
} | ConvertTo-Json
$result = Invoke-RestMethod `
    -Method Post `
    -Uri $url `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body
$result | ConvertTo-Json -Depth 10
```

`limit`을 20 → 10으로 낮춰 반복 실행하는 방식으로 진행됐으며, 이후에도 10건 단위와 20건 단위를 상황에 따라 함께 사용했다(고정된 단일 값이 아님).

### 3.2 확인용 SQL (대표형)

```sql
-- 현재 영문 누락 데이터 확인
select ko.place_id, ko.name
from public.mg_place_texts ko
where ko.locale = 'ko'
  and not exists (
      select 1
      from public.mg_place_texts en
      where en.place_id = ko.place_id
        and en.locale = 'en'
  )
order by ko.place_id
limit 20;

-- 영문 데이터 개수 확인
select
    count(*) as en_count,
    count(*) filter (where translation_status = 'machine') as machine_count,
    count(*) filter (where translation_status = 'source') as source_count
from public.mg_place_texts
where locale = 'en';
```

### 3.3 `limit=50` 실행 중 HTTP 546 오류

`limit=50`으로 실행하는 도중 HTTP 546 오류가 발생했다. **정확한 원인은 확인되지 않았으나**, 대량 처리 중 Edge Function 실행 제한(타임아웃 등) 가능성이 의심되어, 이후 **10건·20건 단위로 나눠 반복 실행**하는 방식으로 전환했다.

546 오류가 발생하기 전까지 en_count가 1052 → 1099로 증가해 47건이 정상 저장된 것이 확인됐다(§2.6의 insert-only 저장 방식 덕분에, 오류 발생 시점까지의 저장분이 기존 en 행을 덮어쓰지 않고 안전하게 유지됨).

### 3.4 실패 후 재시도로 저장된 사례

10건·20건 단위 재실행 과정에서, 특정 행이 한 번 실패한 뒤 **다음 실행에서 다시 대상으로 잡혀 정상 저장**된 사례가 확인됐다.

- **place_id 1114 (인더매스 마장)**: 첫 저장 실행에서 **주소 숫자 불일치 검증 실패**(§2.4 `hasExactlySameNumberTokens`) → 다음 실행의 첫 대상으로 다시 잡혀 정상 저장됨.
- **place_id 1135 (일일주(日日酒))**: 다음 저장 실행에서 **원문 한글 이름 미보존 검증 실패**(name에 한글 원문이 포함되지 않음) → 그다음 실행의 첫 대상으로 다시 잡혀 정상 저장됨.
- **place_id 1247 (진옥화할매원조닭한마리)**: 저장 실행에서 **주소 숫자 불일치 검증 실패** → 다음 실행에서 다시 대상으로 잡혀 정상 저장됨.

세 사례 모두 "검증 실패 → 저장하지 않고 failed 처리 → 다음 배치 실행에서 재시도되어 결국 정상값으로 저장"이라는 안전장치가 의도대로 작동한 사례로 볼 수 있다.

### 3.5 en_count / machine_count / source_count 변화

| 구분 | 시작값 | 문서 중간 확인값 |
|---|---:|---:|
| en_count | 1052 | 1137 |
| machine_count | 981 | 1066 |
| source_count | 71 | 71 |

"문서 중간 확인값"은 이 문서 작성 시점 이전에 사용자가 보고한 마지막 확인 수치이며, 문서 작성 직전 시점의 최신 SQL 재확인 결과는 아니다(최신 값이 별도로 확인되면 갱신 필요). 시작값 대비 기계번역(`machine`) 행이 85건 증가했고, 공식 source 행(71건)은 전혀 변동이 없다 — §2.6에서 `.insert()`로 전환한 저장 방식이 기존 공식 데이터를 건드리지 않았음을 실제 운영 데이터로도 뒷받침한다.

---

## 4. 번역 품질 한계와 Solar 유지 결정

- Solar(업스테이지, 국산 LLM)는 OpenAI 대비 고유명사·외래어 메뉴명 음차에서 부정확한 결과를 종종 낸다(초기 발견 사례: 즉석떡볶이, 청포도리코타샐러드, 로프치니 등). 이런 사례들은 프롬프트 보강(외래어 복원 예시, 보수적 음차 원칙)과 코드 검증(이름 원문 보존 확인, 숫자·요일·메뉴 개수 정확 일치)으로 상당 부분 걸러지도록 했다.
- 다만 검증을 통과하지 못한 건은 실패 처리되어 저장되지 않고, 이후 재실행에서 재시도된다(§3.4가 실제 사례). 즉 Solar의 번역 품질 자체가 완벽해진 것이 아니라, **잘못된 결과가 DB에 들어가지 않도록 하는 안전장치**가 강화된 것이다.
- 현재는 OpenAI API 키가 설정되어 있지 않은 운영 환경이라(§2.2) 실제로는 Solar 단독 + 교정 재시도 흐름만 동작한다. 국산 LLM(Solar) 사용을 유지하기로 한 것은 이 세션의 결정이 아니라 기존 운영 방침을 그대로 따른 것이며, 이번 작업은 그 위에 안전장치만 추가했다.

---

## 5. 실제 실행 여부 구분 (중요)

| 구분 | 수행 여부 |
|---|---|
| 코드 수정(`index.ts`, 프런트엔드 파일) | 이 세션에서 직접 수행 |
| `esbuild` 문법 검사, 순수 함수/모의(mock) 테스트 | 이 세션에서 직접 수행(실제 API·DB 접근 없음) |
| `npm run build`, `git diff --check` | 이 세션에서 직접 수행 |
| 실제 OpenAI/Solar API 호출 | **이 세션에서는 수행하지 않음** — §3의 실행은 전부 사용자가 별도로 수행 |
| `dryRun=false` 실저장, SQL 실행, Edge Function 배포 | **이 세션에서는 수행하지 않음** — 사용자가 직접 수행하고 결과를 보고 |
| §3의 수치·사례(546 오류, 1114/1135, count 변화, PowerShell/SQL 명령) | 사용자 보고를 그대로 기록 — 이 세션이 직접 확인한 사실 아님 |

---

## 6. 수정 파일 (코드, 이 세션 기준)

- `supabase/functions/mg-place-translate-en/index.ts` (여러 차례에 걸쳐 프롬프트/검증/fallback/저장 로직 수정)
- `src/features/courses/utils/courseDisplay.js` (기준 위치 분리, 한글 감지, 취향 표시)
- `src/features/explore/data/courseBuilder.js` (추천 카드 제목 순번)
- `src/features/explore/data/seoulDistricts.js` (영문 주소 변환기)
- `src/features/courses/services/savedCourseService.js` (search 타입 anchor 필드 보강)
- `src/shared/i18n/dictionary.js` (`preferencesNone` 키)

이번 문서 작성 자체는 위 파일을 다시 수정하지 않았다.

## 7. 검증 결과 (이 세션 기준)

- `npm run build`: 매 수정마다 성공(기존에 알려진 CSS 경고 2건만, 신규 오류 없음)
- `git diff --check`: 매 수정마다 통과(오류 없음)
- 순수 함수/모의 네트워크 테스트: 숫자 멀티셋 일치, 요일 집합 일치, 메뉴 배열 길이 일치, non-null→null 차단, provider fallback/교정 재시도 attempt 횟수, en place_id 페이지네이션(1000+52, 중복 제거) 등 다수 테스트 전부 통과
- 브라우저 수동 테스트, 실제 API 호출 기반 검증은 이 세션에서 수행하지 않음

## 8. 남은 위험 / 미확인 사항

- HTTP 546 오류의 정확한 원인은 여전히 미확인 — Edge Function 실행 제한(타임아웃/메모리 등)으로 추정되나 확정되지 않았다.
- 나머지 미번역 place_id(en_count 1137, 문서 중간 확인값 기준으로 계속 남아있는 건들)에 대한 전체 처리가 끝나지 않았다.
- 실제 모델 출력 품질(특히 새로 추가된 배열 기반 메뉴 스키마·교정 재시도 프롬프트)에 대한 장기적 정확도는 더 많은 실행 데이터가 쌓여야 판단 가능하다.
- 저장 동선 프런트엔드 수정(§1)은 브라우저 수동 테스트가 아직 이뤄지지 않았다.

## 9. 다음 작업

- 남은 미번역 건들(최초 확인 당시 영문 누락 581건에서 시작해 현재 진행 중)을 10건·20건 단위로 계속 실행해 en_count를 늘려나간다.
- 546 오류가 재발하는지, 재발 시 정확한 원인(응답 본문/헤더)을 확보한다.
- 최초 확인 당시 영문 누락 581건 처리가 모두 끝나면 전체 진행 현황을 다시 점검한다.
- 저장 동선 프런트엔드 수정 전체에 대한 브라우저 수동 테스트를 진행한다.
