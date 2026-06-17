# Supabase Secrets & TourAPI Edge Function 가이드

## 1. 핵심 원칙

맛길(Matgil) 프로젝트는 Supabase Edge Function을 통해 외부 API를 호출한다.

```txt
프론트엔드에는 비밀키를 넣지 않는다.
DB 테이블에 API 키를 평문으로 저장하지 않는다.
OpenAI, Solar, TourAPI 키는 Supabase Edge Function Secrets에 저장한다.
React 프론트는 Supabase Edge Function 또는 Supabase DB만 호출한다.
Edge Function이 내부에서 Secrets를 읽고 외부 API를 호출한다.
```

---

## 2. 현재 Supabase 상태

현재 Supabase 프로젝트는 아래 방식으로 정리되어 있다.

```txt
cw_settings 테이블 삭제 완료
DB에 LLM API 키 저장하지 않음
SOLAR_API_KEY / OPENAI_API_KEY는 Supabase Edge Function Secrets에 저장
기존 chat Edge Function은 Secrets 방식으로 정상 응답 확인 완료
프론트 코드는 수정하지 않았고 GitHub Pages 배포 화면에서 챗봇 정상 작동 확인 완료
```

현재 구조:

```txt
React 프론트
→ Supabase Edge Function chat 호출
→ Edge Function이 SOLAR_API_KEY / OPENAI_API_KEY를 Secrets에서 읽음
→ Solar/OpenAI 호출
→ 프론트에 응답 반환
```

---

## 3. Supabase Secrets에 저장할 값

맛길 프로젝트에서 사용할 Secrets는 아래와 같다.

```txt
SOLAR_API_KEY
OPENAI_API_KEY
TOUR_KOR_API_SERVICE_KEY
ADMIN_SEED_TOKEN
```

역할:

```txt
SOLAR_API_KEY
- Solar LLM 호출용

OPENAI_API_KEY
- OpenAI 호출 또는 Solar 실패 시 폴백용

TOUR_KOR_API_SERVICE_KEY
- 한국관광공사_국문 관광정보 서비스_GW 호출용
- 현재 사용하는 TourAPI 국문 서비스키

ADMIN_SEED_TOKEN
- mg-tour-seed Edge Function을 아무나 실행하지 못하게 막는 관리자용 토큰
```

`ADMIN_SEED_TOKEN`은 임의의 긴 문자열로 만든다.

예:

```txt
matgil_seed_2026_random_long_string
```

추후 다른 API를 추가할 경우 키 이름은 구체적으로 분리한다.

```txt
TOUR_KOR_API_SERVICE_KEY     한국관광공사 국문 TourAPI
TOUR_ENG_API_SERVICE_KEY     한국관광공사 영문 TourAPI
GOOGLE_PLACES_API_KEY        Google Places API
KAKAO_REST_API_KEY           Kakao API
NAVER_CLIENT_ID              Naver API Client ID
NAVER_CLIENT_SECRET          Naver API Client Secret
```

---

## 4. 프론트에 넣어도 되는 값

Vite 프론트에서 사용 가능한 값은 아래 두 개뿐이다.

```txt
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

이 두 값은 GitHub Secrets에 넣고 GitHub Pages 빌드 시 주입해도 된다.
단, 최종 빌드된 브라우저 코드에서는 보일 수 있으므로 RLS 정책이 반드시 필요하다.

---

## 5. 절대 하면 안 되는 것

아래 방식은 금지한다.

```txt
VITE_SOLAR_API_KEY 사용 금지
VITE_OPENAI_API_KEY 사용 금지
VITE_TOUR_KOR_API_SERVICE_KEY 사용 금지
VITE_TOUR_API_SERVICE_KEY 사용 금지

React에서 OpenAI 직접 호출 금지
React에서 Solar 직접 호출 금지
React에서 TourAPI 직접 호출 금지

Supabase DB 테이블에 API 키 평문 저장 금지
settings, cw_settings, mg_settings에 비밀키 저장 금지

SUPABASE_SERVICE_ROLE_KEY를 프론트에 넣는 것 금지
SUPABASE_SERVICE_ROLE_KEY를 GitHub Pages 빌드 환경변수로 넣는 것 금지

API 키를 console.log로 출력 금지
API 키를 응답 JSON에 포함 금지
API 키를 GitHub에 커밋 금지
```

`VITE_`로 시작하는 환경변수는 브라우저에 노출된다.
비밀키에는 절대 `VITE_`를 붙이지 않는다.

---

## 6. Edge Function에서 Secrets 읽는 방식

Edge Function 내부에서는 아래처럼 읽는다.

```ts
const SOLAR_KEY = Deno.env.get("SOLAR_API_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const TOUR_KOR_API_SERVICE_KEY = Deno.env.get("TOUR_KOR_API_SERVICE_KEY") ?? "";
const ADMIN_SEED_TOKEN = Deno.env.get("ADMIN_SEED_TOKEN") ?? "";
```

이 값들은 프론트로 반환하면 안 된다.

나쁜 예:

```ts
return new Response(JSON.stringify({
  key: TOUR_KOR_API_SERVICE_KEY
}));
```

좋은 예:

```ts
return new Response(JSON.stringify({
  insertedCount,
  skippedCount,
  failedCount
}));
```

---

## 7. 맛길 DB 테이블

맛길 관련 테이블은 모두 `mg_` 접두사를 사용한다.

```txt
mg_places
mg_place_sources
mg_place_texts
mg_place_food_details
mg_place_images
mg_courses
mg_course_places
mg_phrases
mg_api_fetch_logs
```

용도:

```txt
mg_places
- 장소 공통 정보
- 좌표, 카테고리, 대표 이미지 URL, 지역 코드 등

mg_place_sources
- 외부 API 원본 정보
- TourAPI 원본 JSON 저장
- 프론트 공개 읽기 금지

mg_place_texts
- 언어별 표시 텍스트
- ko/en 등 locale 기준 이름, 주소, 설명, 메뉴, 태그 저장

mg_place_food_details
- 음식점 상세 속성
- 전화번호, 주차, 포장, 영업시간 여부, 메뉴정보 여부 등

mg_place_images
- 이미지 URL 저장
- 이미지 파일은 당장 다운로드하지 않고 URL만 저장

mg_api_fetch_logs
- TourAPI 수집 성공/실패 로그
- 프론트 공개 읽기 금지
```

---

## 8. RLS 정책 원칙

프론트에서 읽어야 하는 테이블은 공개 `select`만 허용한다.

```txt
프론트 공개 읽기 허용:
mg_places
mg_place_texts
mg_place_food_details
mg_place_images
mg_courses
mg_course_places
mg_phrases

프론트 공개 읽기 금지:
mg_place_sources
mg_api_fetch_logs
```

이유:

```txt
mg_place_sources에는 원본 API 응답 JSON이 들어간다.
mg_api_fetch_logs에는 수집 로그가 들어간다.
둘 다 프론트에 공개할 필요가 없다.
```

데이터 insert/update/delete는 프론트에서 하지 않는다.
데이터 수집과 저장은 Edge Function에서 service_role 권한으로 처리한다.

---

## 9. TourAPI 수집 방식

맛길은 로컬 seed 스크립트가 아니라 Supabase Edge Function으로 TourAPI 데이터를 수집한다.

사용할 함수명:

```txt
mg-tour-seed
```

역할:

```txt
1. 한국관광공사 국문 TourAPI areaBasedList2 호출
2. 음식점 목록 조회
3. 각 음식점의 contentid, contenttypeid로 detailIntro2 호출
4. mg_ 테이블에 저장
5. 이미 저장된 음식점은 중복 insert하지 않고 skipped 처리
6. 수집 결과를 mg_api_fetch_logs에 기록
```

프론트에서 이 함수를 일반 사용자 기능으로 호출하지 않는다.
관리자 또는 개발자가 데이터 수집 목적으로만 호출한다.

---

## 10. mg-tour-seed 보안 조건

`mg-tour-seed`는 반드시 관리자 토큰을 검사해야 한다.

요청 Header:

```txt
x-admin-seed-token: ADMIN_SEED_TOKEN 값
```

Edge Function 내부 검증:

```ts
const adminToken = req.headers.get("x-admin-seed-token");
const expectedToken = Deno.env.get("ADMIN_SEED_TOKEN") ?? "";

if (!expectedToken) {
  return jsonResponse({ error: "ADMIN_SEED_TOKEN이 설정되지 않았습니다." }, 500);
}

if (!adminToken || adminToken !== expectedToken) {
  return jsonResponse({ error: "권한이 없습니다." }, 401);
}
```

이 검증 없이 `mg-tour-seed`를 만들면 안 된다.
검증이 없으면 아무나 함수를 호출해서 DB에 데이터를 넣을 수 있다.

---

## 11. mg-tour-seed TourAPI 호출 조건

현재 사용하는 API:

```txt
한국관광공사_국문 관광정보 서비스_GW
```

Secrets 이름:

```txt
TOUR_KOR_API_SERVICE_KEY
```

TourAPI 기본 URL:

```txt
https://apis.data.go.kr/B551011/KorService2
```

음식점 목록 조회:

```txt
GET /areaBasedList2
```

기본 파라미터:

```txt
MobileOS=ETC
MobileApp=matgil
_type=json
contentTypeId=39
lDongRegnCd=11
numOfRows=10
pageNo=1
```

상세정보 조회:

```txt
GET /detailIntro2
```

상세정보 파라미터:

```txt
contentId=TourAPI contentid
contentTypeId=TourAPI contenttypeid
MobileOS=ETC
MobileApp=matgil
_type=json
```

Edge Function 내부 TourAPI 키 확인:

```ts
const TOUR_KOR_API_SERVICE_KEY = Deno.env.get("TOUR_KOR_API_SERVICE_KEY") ?? "";

if (!TOUR_KOR_API_SERVICE_KEY) {
  throw new Error("TOUR_KOR_API_SERVICE_KEY가 설정되지 않았습니다.");
}
```

TourAPI 요청 시:

```ts
url.searchParams.set("serviceKey", TOUR_KOR_API_SERVICE_KEY);
```

---

## 12. mg-tour-seed 저장 흐름

TourAPI 목록 item 하나를 기준으로 아래 순서대로 저장한다.

```txt
1. mg_place_sources에서 동일한 TourAPI contentid/contenttypeid가 이미 있는지 확인
2. 이미 있으면 skipped 처리
3. 없으면 mg_places insert
4. mg_place_sources insert
5. mg_place_texts insert(locale='ko')
6. mg_place_food_details insert
7. firstimage가 있으면 mg_place_images insert
8. 전체 수집 결과를 mg_api_fetch_logs에 기록
```

중복 판정 기준:

```txt
source = TOUR_API_KO
source_language = ko
external_id = contentid
external_content_type_id = contenttypeid
```

---

## 13. TourAPI 필드 매핑

### mg_places

```txt
primary_source        ← TOUR_API_KO
place_type            ← restaurant
content_type_id       ← contenttypeid
latitude              ← mapy
longitude             ← mapx
area_code             ← areacode
sigungu_code          ← sigungucode
ldong_regn_cd         ← lDongRegnCd
ldong_signgu_cd       ← lDongSignguCd
category_code_1       ← cat1
category_code_2       ← cat2
category_code_3       ← cat3
food_category_code_1  ← lclsSystm1
food_category_code_2  ← lclsSystm2
food_category_code_3  ← lclsSystm3
default_image_url     ← firstimage
is_active             ← true
```

### mg_place_sources

```txt
place_id                  ← mg_places.id
source                    ← TOUR_API_KO
source_language           ← ko
external_id               ← contentid
external_content_type_id  ← contenttypeid
license_type              ← 공공데이터
attribution               ← 한국관광공사 TourAPI
cache_policy              ← stored
source_modified_at        ← modifiedtime
raw_list                  ← areaBasedList2 item 원본
raw_intro                 ← detailIntro2 응답 원본
```

### mg_place_texts

```txt
place_id            ← mg_places.id
locale              ← ko
name                ← title
address             ← addr1 + addr2
description         ← 직접 생성한 한국어 설명문
first_menu          ← firstmenu
treat_menu          ← treatmenu
open_time           ← opentimefood
rest_date           ← restdatefood
parking             ← parkingfood
packing             ← packing
tags                ← 생성 태그 배열
translation_status  ← source
```

### mg_place_food_details

```txt
place_id                    ← mg_places.id
tel                         ← infocenterfood 또는 tel
has_parking                 ← parkingfood가 "가능"이면 true, 모르면 null
has_packing                 ← packing이 "가능"이면 true, 모르면 null
has_open_time               ← opentimefood 존재 여부
has_menu_info               ← firstmenu 또는 treatmenu 존재 여부
has_image                   ← firstimage 존재 여부
has_location                ← mapx/mapy 존재 여부
kids_facility               ← kidsfacility
smoking_info                ← smoking
credit_card_info            ← chkcreditcardfood
reservation_info            ← reservationfood
license_no                  ← lcnsno
price_level                 ← null
is_halal_friendly           ← null
is_vegetarian_friendly      ← null
has_english_menu            ← null
```

### mg_place_images

```txt
place_id       ← mg_places.id
image_url      ← firstimage
thumbnail_url  ← firstimage2
source         ← TOUR_API_KO
license_type   ← 공공데이터
attribution    ← 한국관광공사 TourAPI
sort_order     ← 0
```

---

## 14. 데이터 가공 규칙

`<br>` 태그는 줄바꿈으로 변환한다.

```ts
function cleanText(text: unknown) {
  if (!text) return null;

  return String(text)
    .replaceAll("<br>", "\n")
    .replaceAll("<br/>", "\n")
    .replaceAll("<br />", "\n")
    .trim();
}
```

한국어 설명문은 MVP 기준으로 간단히 생성한다.

```txt
{식당명}은(는) {주소}에 위치한 음식점입니다. 대표 메뉴는 {대표메뉴}입니다.
```

대표메뉴가 없으면:

```txt
{식당명}은(는) {주소}에 위치한 음식점입니다.
```

태그 생성 규칙:

```txt
기본 태그: 음식점
firstimage 있으면: 사진 있음
mapx/mapy 있으면: 위치 있음
firstmenu/treatmenu 있으면: 메뉴 정보 있음
parkingfood가 가능이면: 주차 가능
packing이 가능이면: 포장 가능
```

---

## 15. mg-tour-seed 응답 형식

`mg-tour-seed`는 아래 형식으로 응답한다.

```json
{
  "message": "TourAPI 음식점 데이터 수집 완료",
  "requestedCount": 10,
  "insertedCount": 10,
  "skippedCount": 0,
  "failedCount": 0,
  "results": []
}
```

이미 저장된 데이터를 다시 수집하면 아래처럼 나와야 한다.

```json
{
  "insertedCount": 0,
  "skippedCount": 10,
  "failedCount": 0
}
```

---

## 16. mg-tour-seed 제한

처음부터 대량 수집하지 않는다.

```txt
numOfRows 기본값: 10
numOfRows 최대값: 30
pageNo 최소값: 1
```

예시:

```ts
const safeNumOfRows = Math.min(Math.max(numOfRows, 1), 30);
const safePageNo = Math.max(pageNo, 1);
```

---

## 17. mg-tour-seed 테스트 요청

Method:

```txt
POST
```

Headers:

```txt
Content-Type: application/json
x-admin-seed-token: ADMIN_SEED_TOKEN 값
```

Body:

```json
{
  "numOfRows": 10,
  "pageNo": 1
}
```

정상 동작 후 Supabase SQL Editor에서 아래 쿼리로 확인한다.

```sql
select count(*) from public.mg_places;
select count(*) from public.mg_place_texts;
select count(*) from public.mg_place_food_details;
select count(*) from public.mg_place_images;
```

실제 데이터 확인:

```sql
select
  p.id,
  t.locale,
  t.name,
  t.address,
  t.first_menu,
  t.open_time,
  p.latitude,
  p.longitude,
  p.default_image_url
from public.mg_places p
join public.mg_place_texts t on t.place_id = p.id
order by p.id
limit 10;
```

---

## 18. 다국어 처리 원칙

맛길은 외국인 대상 서비스이므로 영어 표시가 중요하다.
그러나 한국 공모전 제출과 한국인 사용자도 고려해야 하므로 한국어 데이터도 유지한다.

언어별 텍스트는 `mg_place_texts`에 저장한다.

```txt
locale = ko
- 한국어 원문 또는 한국어 표시 데이터

locale = en
- TourAPI 영문 데이터 또는 LLM/기계번역으로 생성한 영어 데이터
```

`translation_status` 규칙:

```txt
source
- 해당 언어 API에서 직접 받은 원문 데이터

machine
- LLM 또는 번역 API로 생성한 데이터

manual
- 사람이 직접 수정한 데이터

fallback
- 해당 언어 데이터가 없어 다른 언어를 임시로 보여주는 데이터
```

영어 데이터가 없을 때 fallback 규칙:

```txt
현재 locale = en 인 경우
1. mg_place_texts에서 locale='en' 조회
2. 있으면 영어 표시
3. 없으면 locale='ko' 표시
4. 필요하면 "Korean data only" 또는 "한국어 정보만 제공" 표시
```

---

## 19. 프론트 연결 원칙

프론트는 TourAPI를 직접 호출하지 않는다.
프론트는 Supabase DB 또는 Edge Function만 호출한다.

프론트에서 장소 데이터를 조회할 때는 아래 테이블을 사용한다.

```txt
mg_places
mg_place_texts
mg_place_food_details
mg_place_images
```

프론트 컴포넌트는 TourAPI 원본 필드명을 직접 사용하지 않는다.

나쁜 예:

```ts
place.title
place.addr1
place.firstimage
```

좋은 예:

```ts
place.name
place.address
place.imageUrl
```

즉, API 원본 데이터를 화면용 place 객체로 정규화해서 사용한다.

---

## 20. AI 코딩 작업 지시문

AI가 코드를 작성할 때 반드시 아래 규칙을 지킨다.

```txt
1. 프론트에서는 외부 API 키를 절대 사용하지 않는다.
2. React 코드에서 OpenAI, Solar, TourAPI를 직접 호출하지 않는다.
3. 프론트는 Supabase Edge Function 또는 Supabase DB만 호출한다.
4. Edge Function 내부에서 Deno.env.get()으로 Secrets를 읽는다.
5. API 키를 DB 테이블에 저장하지 않는다.
6. API 키를 응답 JSON에 포함하지 않는다.
7. API 키를 console.log로 출력하지 않는다.
8. API 키를 GitHub에 커밋하지 않는다.
9. Supabase URL과 anon key만 VITE_ 환경변수로 사용한다.
10. 맛길 관련 DB 테이블은 mg_ 접두사를 사용한다.
11. 한국관광공사 국문 TourAPI 키 이름은 TOUR_KOR_API_SERVICE_KEY를 사용한다.
12. TourAPI 데이터 수집은 mg-tour-seed Edge Function에서 처리한다.
13. mg-tour-seed는 x-admin-seed-token 검증 없이는 실행되면 안 된다.
14. 이미 저장된 TourAPI contentid/contenttypeid는 중복 insert하지 않는다.
15. 원본 API 응답은 mg_place_sources에 저장한다.
16. 프론트 공개 읽기에서 mg_place_sources와 mg_api_fetch_logs는 제외한다.
```

---

## 21. 구현 작업 시 적용 규칙

이 문서는 특정 한 번의 작업만을 위한 문서가 아니라, 맛길 프로젝트 전체에서 Supabase Edge Function과 외부 API를 연결할 때 지켜야 하는 기준 문서다.

AI 코딩 작업을 시킬 때는 아래 원칙을 기준으로 구현한다.

```txt
1. 외부 API 키는 Supabase Edge Function Secrets에 저장한다.
2. React 프론트에는 외부 API 키를 넣지 않는다.
3. React 프론트는 TourAPI, OpenAI, Solar 등을 직접 호출하지 않는다.
4. 외부 API 호출은 Supabase Edge Function에서 처리한다.
5. 한국관광공사 국문 TourAPI 키 이름은 TOUR_KOR_API_SERVICE_KEY를 사용한다.
6. 데이터 수집용 Edge Function에는 관리자 검증용 ADMIN_SEED_TOKEN을 사용한다.
7. 수집된 장소 데이터는 mg_ 접두사 테이블에 저장한다.
8. 원본 API 응답은 mg_place_sources에 저장한다.
9. 프론트 화면은 원본 API 필드가 아니라 정규화된 place 객체를 사용한다.
10. mg_place_sources와 mg_api_fetch_logs는 프론트 공개 조회 대상에서 제외한다.
```

새 기능을 추가할 때도 위 규칙을 우선 적용한다.

예를 들어 추후 영문 TourAPI, Google Places API, Kakao API, Naver API를 추가하더라도 프론트에서 직접 호출하지 않고, 각각의 Edge Function에서 Secrets를 읽어 호출하도록 구현한다.

