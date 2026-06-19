# 18. 영어 기계번역 보강, 프론트 영어 우선 표시, 검색 오버레이 영문화

## 작업 일자

2026-06-18 ~ 2026-06-19

---

## 이전 작업 기준

- 이전 문서: `docs/17-tourapi-en-enrich-gps-location-map-ux.md`
- `docs/17`에서 TourAPI 영문 API로 71개 공식 en 텍스트를 보강하고, GPS 현재 위치 추천, Map 드래그 위치로 추천, UI 레이아웃 조정을 완료했다.
- 이번 세션에서는 공식 영문 데이터가 없는 나머지 1,500여 개 장소를 LLM 기계번역으로 보강하는 Edge Function을 신규 구현하고, 프론트를 영어 우선 표시로 전환했다. 이후 검색 오버레이에서 Kakao 결과를 DB 영어 텍스트와 매칭해 표시하는 개선도 추가했다.

---

## 이번 작업 목표

1. LLM 기계번역으로 한국어 장소 데이터를 영어로 보강하는 Edge Function 구현
2. 프론트를 `getPlaces('en')` 영어 우선 표시로 전환
3. 영어 태그가 UI에 불필요하게 노출되지 않도록 HIDDEN_TAGS 보완
4. 검색 오버레이 — DB 매칭 결과는 영어 name/address 표시, 미매칭 Kakao 결과는 Seoul·구 약식 주소 표시

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `ai-docs/15-machine-translation-enrichment-plan.md` | 신규 |
| `supabase/functions/mg-place-translate-en/index.ts` | 신규 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 수정 |
| `src/features/explore/components/TodayCourseDetail.jsx` | 수정 |
| `src/features/explore/components/SearchOverlay.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. LLM 기계번역 보강 Edge Function

계획 문서: `ai-docs/15-machine-translation-enrichment-plan.md`

새 Edge Function `mg-place-translate-en`을 구현했다. 기존 `mg-tour-seed`, `mg-tour-en-enrich`는 수정하지 않는다.

**처리 흐름:**

```txt
POST /mg-place-translate-en
→ ADMIN_SEED_TOKEN 검증 (x-admin-seed-token 헤더)
→ mg_place_texts에서 locale='en' row가 없는 place_id 목록 수집
→ locale='ko' row를 limit개 조회 (en 없는 것만)
→ 각 row마다 translateText() 호출
    - OpenAI gpt-4o-mini 우선 시도
    - OpenAI 실패 시 Solar solar-pro fallback
→ dryRun=true  → DB 저장 없이 번역 결과 preview 반환
→ dryRun=false → 안전 재확인 후 mg_place_texts(locale='en') upsert
→ 결과 반환 (translatedCount / savedCount / failedCount / usage)
```

**번역 대상 필드:**

```txt
name, address, description, first_menu, treat_menu,
open_time, rest_date, parking, packing, tags
```

**번역 정책 요점:**

| 필드 | 정책 |
|---|---|
| name | 로마자 표기 + 원래 한글명 괄호 유지. 예: 남포면옥 → `Nampomyeonok (남포면옥)` |
| address | 자연스러운 영어 주소 형식. 예: 서울 강남구 언주로 608 → `608 Eonju-ro, Gangnam-gu, Seoul` |
| description | 한국어 번역 또는 name+address 기반 기본 설명 생성 |
| first_menu / treat_menu | 광범위하게 통용되지 않는 음식명은 로마자 + 한글 괄호 유지. 오역 방지 명시: `난자완스 → Nanjawanse (난자완스)` (egg waffle 금지) |
| open_time / rest_date | 짧고 일관된 표현. 연중무휴 → `Open year-round`, 전화문의 → `Call to confirm` |
| parking / packing | 가능 → `Available`, 불가 → `Not available` |
| tags | 배열 전체 영어 번역. 음식점 → `restaurant`, 포장 가능 → `takeout available` |

**LLM provider 구성:**

```txt
1순위: OpenAI gpt-4o-mini (OPENAI_API_KEY)
2순위: Solar solar-pro fallback (SOLAR_API_KEY)
OpenAI 실패(429 포함 모든 오류) 시 자동 fallback
```

**Token usage 집계:**

각 번역 호출 후 `data.usage.prompt_tokens / completion_tokens / total_tokens`를 읽어 provider별로 누산한다. API 응답에 usage 없으면 0으로 처리(실패 방지).

최종 응답에 포함되는 usage 구조:

```json
{
  "usage": {
    "totalPromptTokens": 1234,
    "totalCompletionTokens": 567,
    "totalTokens": 1801,
    "byProvider": {
      "openai": { "promptTokens": 1234, "completionTokens": 567, "totalTokens": 1801 },
      "solar":  { "promptTokens": 0,    "completionTokens": 0,   "totalTokens": 0 }
    }
  }
}
```

**dryRun 동작:**

| 파라미터 | 기본값 | 동작 |
|---|---|---|
| `dryRun` | `true` | DB 저장 없이 `status: "preview"` + 전체 `translated` 객체 반환 |
| `dryRun: false` | - | 안전 재확인(en row 유무 재조회) 후 upsert, `status: "saved"` |

**안전 제약:**

```txt
ko row 수정 금지
mg_places / mg_place_sources 수정 금지
translation_status='source'인 en row 덮어쓰기 금지
(안전 재확인: upsert 직전 en row 재조회로 동시 저장 충돌 방지)
upsert conflict 키: place_id + locale
limit 범위: 1~50 (기본 5)
```

**upsert 저장 필드:**

```txt
place_id, locale='en',
name, address, description, first_menu, treat_menu,
open_time, rest_date, parking, packing, tags,
translation_status='machine'
```

**result 항목 구조:**

```json
{
  "placeId": 123,
  "koName": "가나돈까스의집",
  "enName": "Gana Donkatsu House (가나돈까스의집)",
  "provider": "openai",
  "status": "saved",
  "error": null
}
```

`provider`는 번역 실패 시 `null`.

**보안:**

```txt
OPENAI_API_KEY / SOLAR_API_KEY → Deno.env.get()으로만 사용
키 값은 console.log, 응답 JSON, VITE_ 환경변수에 절대 포함하지 않음
```

---

### 2. 프론트 영어 우선 표시 전환

기존 `getPlaces('ko')` 호출을 `getPlaces('en')`으로 변경했다. `placeApi.js`의 `normalizePlace(row, locale)`는 이미 `requested locale → ko fallback` 로직을 갖추고 있어 en 텍스트가 없는 장소도 한국어로 정상 표시된다.

**`HomePage.jsx`:**

```js
// 이전
getPlaces('ko')

// 이후
getPlaces('en')
```

**`TodayCourseDetail.jsx` — subtitle fallback 영문화:**

```js
// 이전
const subtitle = stop.firstMenu || stop.tags?.[0] || '음식점';

// 이후
const subtitle = stop.firstMenu || 'Restaurant';
```

tags 배열에서 첫 태그를 fallback으로 사용하는 로직을 제거했다. 영어 모드에서 `tags[0]`이 `'restaurant'` 등 의미 없는 값일 가능성이 있기 때문이다.

---

### 3. PlaceDetailSheet HIDDEN_TAGS 영문 보완

기계번역으로 생성된 en 태그는 `'restaurant'`, `'has photo'` 등 내부 상태성 태그를 영어로 번역한 값이다. 기존 HIDDEN_TAGS는 한국어 값만 포함하고 있었으므로 영어 equivalent를 추가했다.

```js
const HIDDEN_TAGS = new Set([
  // 기존 한국어
  '음식점', '사진 있음', '위치 있음', '메뉴 정보 있음', '포장 가능', '주차 가능', '영업시간 있음',
  // 추가된 영어
  'restaurant', 'has photo', 'has location', 'has menu info',
  'parking available', 'takeout available', 'has open time',
]);
```

---

### 4. SearchOverlay 영문 표시 개선

Kakao Places API는 영어 검색어를 입력해도 결과명과 주소를 한국어로 반환한다. 검색 결과 목록에서 영어 UI와의 이질감을 줄이기 위해 두 가지 개선을 적용했다.

**변경 원칙:**
- LLM 호출 없음
- Edge Function 수정 없음
- DB 수정 없음
- `onSelect` 콜백은 기존 구조 그대로 유지 (anchorPlace 동작 보존)

#### 4-1. DB 매칭 결과 영어 표시

각 Kakao 결과에 대해 `findAnchorPlace(r, places)`를 호출한다. 매칭되면 DB의 영어 name/address를 표시한다.

```js
const matched = findAnchorPlace(r, places);
const displayName    = matched ? matched.name    : r.place_name;
const displayAddress = matched ? matched.address : formatSeoulDistrictAddress(...);
```

`findAnchorPlace`는 기존 `anchorMatchService.js`를 그대로 재사용한다. 매칭 조건: FD6/CB2 카테고리 + 150m 이내 좌표 + 이름 포함 관계.

영어 DB name 형식(`Gadam (가담)`)과 Kakao 한국어 name(`가담`) 간 매칭 동작 확인:
- kakaoName = `"가담"` (공백 제거, 소문자)
- dbName = `"gadam(가담)"` (공백 제거, 소문자)
- `dbName.includes(kakaoName)` → `true` → 매칭 성공

기존 anchorMatchService 로직을 수정하지 않아도 en DB name에서 정상 동작한다.

#### 4-2. 미매칭 Kakao 결과 주소 축약

DB와 매칭되지 않는 관광지·역·거리·건물 등은 Kakao 원문 place_name을 유지하되, 주소를 `Seoul · Gangnam-gu` 형식으로 축약한다.

```js
const SEOUL_DISTRICT_EN = {
  강남구: 'Gangnam-gu', 강동구: 'Gangdong-gu', 강북구: 'Gangbuk-gu',
  강서구: 'Gangseo-gu', 관악구: 'Gwanak-gu',   광진구: 'Gwangjin-gu',
  구로구: 'Guro-gu',    금천구: 'Geumcheon-gu', 노원구: 'Nowon-gu',
  도봉구: 'Dobong-gu',  동대문구: 'Dongdaemun-gu', 동작구: 'Dongjak-gu',
  마포구: 'Mapo-gu',    서대문구: 'Seodaemun-gu',  서초구: 'Seocho-gu',
  성동구: 'Seongdong-gu', 성북구: 'Seongbuk-gu', 송파구: 'Songpa-gu',
  양천구: 'Yangcheon-gu', 영등포구: 'Yeongdeungpo-gu', 용산구: 'Yongsan-gu',
  은평구: 'Eunpyeong-gu', 종로구: 'Jongno-gu', 중구: 'Jung-gu',
  중랑구: 'Jungnang-gu',
};

function formatSeoulDistrictAddress(addressStr) {
  if (!addressStr) return null;
  if (!addressStr.includes('서울')) return addressStr;
  const match = addressStr.match(/([가-힣]+구)/);
  if (!match) return 'Seoul';
  const districtEn = SEOUL_DISTRICT_EN[match[1]];
  if (!districtEn) return addressStr;   // 매핑 없으면 원문 fallback
  return `Seoul · ${districtEn}`;
}
```

**표시 우선순위 요약:**

| Kakao 결과 유형 | displayName | displayAddress |
|---|---|---|
| DB 매칭 (FD6/CB2, 150m, 이름 일치) | DB 영어 name | DB 영어 address |
| 미매칭 (관광지·역·건물 등) | Kakao 원문 place_name | `Seoul · [구 영어명]` |
| 비서울 주소 또는 구 매핑 없음 | Kakao 원문 place_name | Kakao 원문 address |

**`onSelect` 보존:**

```js
onSelect({
  key: null,
  label: r.place_name,       // ← Kakao 원문 유지 (anchorPlace 매칭에 사용됨)
  lat: Number(r.y),
  lng: Number(r.x),
  source: 'search',
  address: r.address_name,   // ← Kakao 원문 유지
  categoryGroupCode: r.category_group_code,
});
```

display와 selection 데이터를 분리해 `handleSearchSelect → findAnchorPlace` 흐름과 `anchorPlace` 동작을 그대로 유지했다.

**`HomePage.jsx` 변경:**

`SearchOverlay`에 `places={places}` prop을 추가했다. DB 매칭에 필요한 place 목록을 전달하며, places 로딩 전(빈 배열)에는 모든 결과가 미매칭으로 처리된다.

---

## 발생한 문제와 해결

### OpenAI 429 insufficient_quota

dryRun 테스트 중 OpenAI API에서 429 에러 발생. Solar fallback을 추가해 자동으로 Solar로 전환되도록 처리했다. 이후 OpenAI 크레딧 충전 후 OpenAI 우선 → Solar fallback 순서로 최종 확정했다.

### 음식명 오역 — 난자완스 → egg waffle

Solar 번역 결과에서 `난자완스`가 `Egg waffle`로 오역됐다. LLM 프롬프트에 명시적 규칙을 추가해 수정했다:

```txt
Never translate 난자완스 as "egg waffle" — it should be "Nanjawanse (난자완스)"
```

6가지 구체적인 예시와 함께 "모르는 음식명은 로마자 + 한글 괄호 유지" 원칙을 프롬프트에 명시했다.

### translation_provider / translated_from_locale 컬럼 부재

계획 문서(`ai-docs/15`)에는 이 두 컬럼이 upsert 대상으로 포함되어 있었다. 그러나 실제 DB에서 해당 컬럼이 존재하지 않음을 확인(`mg-tour-seed`, `mg-tour-en-enrich` 모두 미사용). upsert 페이로드에서 제외해 DB 에러를 방지했다. provider 정보는 응답 JSON의 `result.provider` 필드와 `usage.byProvider`로 대신 제공한다.

### SearchOverlay — EN DB name과 Kakao 한국어 name 매칭

`getPlaces('en')` 전환 후 places의 name이 `"Gadam (가담)"` 형식이 됐다. 기존 `findAnchorPlace`의 이름 매칭 로직(`dbName.includes(kakaoName)`)으로 `"gadam(가담)".includes("가담")` = true 가 성립해 anchorMatchService 수정 없이 정상 동작함을 확인했다.

---

## 동작 확인

- `mg-place-translate-en` dryRun=true, limit=5 → Solar 번역 성공, preview 결과 확인
- dryRun=false, limit=5 → en/machine 2개 정상 저장 확인 (DB SQL 조회)
- 음식명 오역 수정 후 난자완스 → `Nanjawanse (난자완스)` 정상 번역 확인
- 프론트 `getPlaces('en')` 전환 후 DB en 텍스트 있는 장소는 영어로, 없는 장소는 한국어 fallback으로 표시
- PlaceDetailSheet 태그 칩 — `restaurant`, `has photo` 등 영어 내부 태그 미표시 확인
- TodayCourseDetail subtitle → `Restaurant` fallback 표시
- SearchOverlay — DB 매칭 음식점 결과에서 영어 name/address 표시 확인
- SearchOverlay — 관광지·지하철역 등 미매칭 결과에서 `Seoul · Gangnam-gu` 형식 주소 표시
- 검색 결과 선택 → selectedLocation, anchorPlace 동작 기존과 동일
- `npm run build` 에러 없음

---

## 이번 작업에서 하지 않은 것

- Supabase DB 마이그레이션 (translation_provider, translated_from_locale 컬럼 추가 없음)
- 기존 Edge Function 수정 (`mg-tour-seed`, `mg-tour-en-enrich`, `mg-voice-help`)
- Supabase deploy
- Git commit / push
- API key / env / GitHub Secrets 수정
- Food Type 필터 수정
- 언어 전환 UI 연결 (lang state가 실제 표시 언어를 바꾸는 기능)
- 대량 번역 (50개 초과)
- 번역 품질 수동 검수 UI
- 중국어/일본어 번역

---

## 현재 한계

- 기계번역 커버리지: 실행 시마다 limit개씩 수동 실행 필요. 전체 자동화 스케줄러 없음
- translation_status='machine' 데이터 품질은 프롬프트 기반이므로 수동 검수 없이는 오역 가능성 존재
- OpenAI/Solar API 비용: limit=5 기준 약 300~500 tokens. 전체 1,500개 실행 시 약 90,000~150,000 tokens 예상
- SearchOverlay 매칭은 FD6/CB2 카테고리 + 150m 조건에 한정. 이 조건을 벗어나는 DB 장소는 영어 표시 적용 안 됨
- 프론트 `selectedLocation.label`은 여전히 Kakao 원문 한국어명 사용 (TodayCourseDetail 블러브 등에 반영)

---

## 다음 작업 후보

- 대량 기계번역 실행 — dryRun=false, limit=50씩 단계적 진행 및 품질 검토
- 번역 품질 검수 — 오역 수정 후 translation_status를 'manual'로 업데이트하는 관리 도구
- SearchOverlay `selectedLocation.label` 영문화 — 매칭 DB place의 영어 name을 label로 사용
- 언어 전환 기능 — lang state(EN/KO)를 `getPlaces()` locale 인자와 연결
- Solar API 활용 확대 — 번역 외 다른 LLM 분석 작업에도 Solar 사용 검토
