# 15. 영어 기계번역 보강 계획

## 문서 목적

기존 한국어(`locale='ko'`) 음식점 데이터를 LLM 기계번역으로 영어(`locale='en'`)로 보강하는 계획을 정리한다.
이 문서는 구현 전 계획 문서이며, 코드 수정은 포함하지 않는다.

---

## 1. 작업 배경

Matgil은 외국인 서울 여행자를 위한 음식 동선 추천 서비스다. UI는 영어 중심이지만 음식점 텍스트 대부분이 한국어여서 화면 이질감이 크다.

현재 DB 상태:

```txt
mg_place_texts locale='ko' translation_status='source'  약 1633개
mg_place_texts locale='en' translation_status='source'  약 71개
```

영문 TourAPI(`EngService2`)를 통해 공식 영문 데이터 71개를 보강했으나(`docs/17` 참고), `EngService2` 서울 음식점 총 커버리지는 91개 수준이다. 나머지 약 1560개 이상의 한국어 장소에는 영어 텍스트가 없다.

이번 작업은 LLM 기계번역으로 이 공백을 채운다.

---

## 2. 저장 정책

| 원본 | translation_status |
|---|---|
| 영문 TourAPI 직접 수신 | `source` |
| LLM/기계번역 생성 | `machine` |
| 사람이 수동 수정 | `manual` |

한국어 원본은 절대 덮어쓰지 않는다.
공식 영문 source 데이터도 덮어쓰지 않는다.

---

## 3. 절대 지킬 원칙

```txt
ko row 수정 금지
mg_places insert/update 금지
mg_place_sources 수정 금지
TOUR_API_EN source row 수정 금지
기존 en row가 이미 있는 place는 번역 대상에서 제외
프론트에서 OpenAI/Solar 직접 호출 금지
번역은 Supabase Edge Function에서만 수행
처음에는 dryRun=true로 5개 미리보기 확인 후 저장
한 번에 50개 초과 대량 번역 금지
```

---

## 4. 번역 대상 조건

아래 SQL을 만족하는 row만 번역 대상이다.

```sql
-- 번역 대상: 한국어는 있는데 영어가 없는 place
select ko.*
from public.mg_place_texts ko
where ko.locale = 'ko'
  and not exists (
    select 1
    from public.mg_place_texts en
    where en.place_id = ko.place_id
      and en.locale = 'en'
  )
limit :limit;
```

이미 en row가 있으면 `translation_status` 값과 무관하게 제외한다.
`source` en이 있든 `machine` en이 있든 재번역하지 않는다.

---

## 5. 번역 대상 필드

현재 화면에서 외국인이 보는 핵심 필드를 우선 번역한다.

```txt
name
address
description
first_menu
treat_menu
open_time
rest_date
parking
packing
tags
```

---

## 6. 번역 정책

### name — 음식점명

완전히 의역하지 말고, 외국인이 읽을 수 있는 영문/로마자 표기와 원래 한글명을 함께 제공한다.

```txt
남포면옥           → Nampomyeonok (남포면옥)
무교동 북어국집    → Mugyodong Bugeogukjip (무교동 북어국집)
가나돈까스의집     → Gana Donkatsu House (가나돈까스의집)
```

원칙:

```txt
읽기 쉬운 영문/로마자 표기 사용
괄호 안에 원래 한글명 유지
브랜드/상호 의미를 과하게 의역하지 않음
```

### address — 주소

자연스러운 영어 주소 형식으로 번역한다.

```txt
서울특별시 강남구 언주로 608
→ 608 Eonju-ro, Gangnam-gu, Seoul
```

정확한 도로명 변환이 어렵다면 무리하지 말고 읽기 쉬운 형태로 정리한다.

### description — 설명

기존 한국어 설명을 자연스러운 영어 1~2문장으로 번역한다.
한국어 description이 null이면 `name + address` 기반 기본 설명문을 생성한다.

```txt
기본:  "{name} is a restaurant located at {address}."
메뉴 있음: "{name} is a restaurant located at {address}. A signature menu item is {firstMenu}."
```

### menu fields — 음식명

`first_menu`, `treat_menu`는 음식명을 영어로 번역하되, 필요하면 한글 원문을 괄호로 유지한다.

```txt
돈까스              → Donkatsu
냉면 / 갈비탕       → Cold noodles / Galbitang (short rib soup)
고추탕수육          → Chili sweet and sour pork
```

### visit info — 방문 정보

`open_time`, `rest_date`, `parking`, `packing`은 짧고 일관된 영어로 번역한다.

```txt
가능 / 가능합니다   → Available
불가능 / 불가       → Not available
명절               → Holidays
연중무휴            → Open year-round
전화문의            → Call to confirm
매주 일요일         → Every Sunday
```

### tags — 태그 배열

한국어 태그 배열을 영어 배열로 번역한다.

```txt
["음식점","사진 있음","위치 있음","메뉴 정보 있음","주차 가능"]
→ ["restaurant","has photo","has location","has menu info","parking available"]
```

---

## 7. 새 Edge Function 계획

### 함수명

```txt
mg-place-translate-en
```

### 처리 흐름

```txt
POST /mg-place-translate-en
→ ADMIN_SEED_TOKEN 검증 (x-admin-seed-token 헤더)
→ en row 없는 ko place_texts를 limit개 조회
→ 각 row마다 OpenAI로 번역 (JSON 응답 강제)
→ dryRun=true  → 저장하지 않고 결과만 반환
→ dryRun=false → mg_place_texts(locale='en') upsert
→ 결과 반환 (translatedCount / savedCount / failedCount)
```

### 기존 LLM 패턴

`mg-voice-help`에서 OpenAI를 이미 사용 중이다. 같은 패턴을 따른다.

```ts
const apiKey = Deno.env.get("OPENAI_API_KEY");
// model: "gpt-4o-mini"
// response_format: { type: "json_object" }
// temperature: 0.3
```

Solar는 현재 stub 상태이므로 이번 함수도 OpenAI를 우선 사용한다.

---

## 8. 요청 body

```json
{
  "limit": 5,
  "dryRun": true
}
```

제한:

```txt
limit 기본값: 5
limit 최대값: 50
처음에는 반드시 dryRun=true
```

---

## 9. Secrets

필요한 Secrets (모두 이미 설정되어 있음):

```txt
ADMIN_SEED_TOKEN         관리자 토큰 검증
SUPABASE_URL             Supabase 프로젝트 URL
SUPABASE_SERVICE_ROLE_KEY Supabase 서비스롤 키
OPENAI_API_KEY           OpenAI 호출용
```

Edge Function 내부에서 읽는 방식:

```ts
const openaiKey = Deno.env.get("OPENAI_API_KEY");
if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured.");
```

프론트에는 OpenAI 키를 절대 넣지 않는다.

---

## 10. LLM 프롬프트 방향

JSON 응답을 강제한다. 반환 필드:

```json
{
  "name": "Gana Donkatsu House (가나돈까스의집)",
  "address": "608 Eonju-ro, Gangnam-gu, Seoul",
  "description": "Gana Donkatsu House is a restaurant located in Gangnam-gu, Seoul. Its signature menu item is donkatsu.",
  "first_menu": "Donkatsu",
  "treat_menu": "Set donkatsu / Pork cutlet / Fish cutlet",
  "open_time": "10:00–20:30 (last order 20:00)",
  "rest_date": "Every Sunday / Lunar New Year and Chuseok holidays",
  "parking": "Not available",
  "packing": "Available",
  "tags": ["restaurant", "has photo", "has location", "has menu info", "takeout available"]
}
```

번역할 수 없거나 원본이 null인 필드는 `null`로 반환한다.
프롬프트에는 번역 정책(name 괄호 규칙, 방문정보 일관성, tags 영어 배열)을 명시한다.

---

## 11. 저장 방식

`mg_place_texts`에 `place_id + locale='en'`으로 upsert한다.

conflict 키: `place_id + locale`

저장 필드:

```txt
place_id
locale                  = 'en'
name
address
description
first_menu
treat_menu
open_time
rest_date
parking
packing
tags
translation_status      = 'machine'
translation_provider    = 'openai/gpt-4o-mini'  (사용한 모델)
translated_from_locale  = 'ko'
```

공식 en source 데이터와의 충돌을 막기 위해 upsert 전에 이미 en row가 있는지 재확인한다:

```txt
조회 단계에서 en 없는 place만 가져왔더라도,
upsert 실행 직전 en row 존재 여부를 다시 확인해 안전하게 처리한다.
```

---

## 12. 응답 형식

**dryRun=true (미리보기):**

```json
{
  "message": "English machine translation preview complete",
  "dryRun": true,
  "requestedCount": 5,
  "translatedCount": 5,
  "savedCount": 0,
  "failedCount": 0,
  "results": [
    {
      "placeId": "uuid...",
      "koName": "가나돈까스의집",
      "enName": "Gana Donkatsu House (가나돈까스의집)",
      "status": "preview",
      "error": null
    }
  ]
}
```

**dryRun=false (실제 저장):**

```json
{
  "message": "English machine translation enrichment complete",
  "dryRun": false,
  "requestedCount": 5,
  "translatedCount": 5,
  "savedCount": 5,
  "failedCount": 0,
  "results": [
    {
      "placeId": "uuid...",
      "koName": "가나돈까스의집",
      "enName": "Gana Donkatsu House (가나돈까스의집)",
      "status": "saved",
      "error": null
    }
  ]
}
```

각 result 필드:

```txt
placeId     매칭된 place_id
koName      한국어 원본 name
enName      번역된 영어 name
status      preview | saved | failed
error       실패 시 오류 메시지, 성공 시 null
```

OpenAI 키는 어떤 경우에도 응답에 포함하지 않는다.

---

## 13. 테스트 순서

처음부터 대량 번역하지 않는다. 반드시 아래 순서를 따른다.

```txt
1. dryRun=true,  limit=5  → 번역 결과 미리보기 확인
2. 결과 품질 검토 (name 괄호, 주소 형식, 태그 영어 등)
3. dryRun=false, limit=5  → 실제 저장 (5개)
4. SQL로 en/machine 5개 생성 확인
5. dryRun=false, limit=20 → 20개 추가 저장
6. SQL로 확인
7. 이후 50개 단위 검토하며 확장
```

---

## 14. 확인 SQL

### 전체 locale / translation_status 분포

```sql
select locale, translation_status, count(*)
from public.mg_place_texts
group by locale, translation_status
order by locale, translation_status;
```

### 번역 대상 (en 없는 ko place) 수 확인

```sql
select count(*) as ko_without_en_count
from public.mg_place_texts ko
where ko.locale = 'ko'
  and not exists (
    select 1
    from public.mg_place_texts en
    where en.place_id = ko.place_id
      and en.locale = 'en'
  );
```

### 기계번역 결과 확인

```sql
select
  place_id,
  locale,
  name,
  address,
  first_menu,
  translation_status,
  translation_provider,
  translated_from_locale
from public.mg_place_texts
where locale = 'en'
  and translation_status = 'machine'
order by place_id
limit 20;
```

---

## 15. 수정/생성 예상 파일

| 파일 | 유형 |
|---|---|
| `supabase/functions/mg-place-translate-en/index.ts` | 신규 |

아래 파일은 수정하지 않는다:

```txt
mg-tour-seed/index.ts
mg-tour-en-enrich/index.ts
mg-voice-help/index.ts
프론트 소스 전체
DB 마이그레이션 파일
README
docs 폴더
```

---

## 16. 이번 단계에서 하지 않을 것

```txt
프론트 언어 전환 로직 구현
en 없을 때 ko fallback 표시 구현
대량 번역 (한 번에 50개 초과)
ko 데이터 수정
기존 source en 데이터 수정
mg_places 수정
영문 TourAPI 재수집
중국어/일본어 번역
Solar LLM 연결
번역 품질 수동 검수 UI
```

이번 작업은 Edge Function에서의 기계번역 보강만 담당한다.

---

## 17. 구현 시 주의사항

**DB 안전장치:**

```txt
번역 전: en row 없는 ko만 조회 → 공식 source en과 충돌 없음
번역 후 upsert 전: en row 재확인 → 동시 실행 이중 저장 방지
upsert conflict 키: place_id + locale → row 중복 없음
```

**OpenAI 오류 처리:**

```txt
rate limit / timeout → failedCount 증가, 해당 place skip
JSON parse 실패 → failedCount 증가, 해당 place skip
```

**번역 품질:**

```txt
첫 실행은 반드시 dryRun으로 결과 품질 육안 확인
name 괄호 규칙, 주소 형식, tags 배열 영어 여부 검토
```
