# 13. TourAPI 영문 데이터 보강 계획

## 문서 목적

한국관광공사 영문 관광정보서비스(`EngService2`)를 이용해 기존 Matgil 음식점 데이터에 영어 텍스트를 보강하는 계획을 정리한다.
이 문서는 구현 전 계획 문서이며, 코드 수정은 포함하지 않는다.

---

## 1. 작업 배경

현재 Matgil은 국문 TourAPI(`KorService2`)를 이용해 서울 음식점 데이터를 수집했다.

현재 구조:

```txt
mg_places
- 장소 공통 정보
- 좌표, 카테고리, 이미지, matgil_category_keys 등

mg_place_texts
- locale별 텍스트
- 현재 대부분 locale='ko'

mg_place_sources
- 외부 API 원본 출처
- 현재 TOUR_API_KO 원본 저장
```

영문 TourAPI 키는 Supabase Edge Function Secrets에 이미 추가되어 있다.

```txt
TOUR_ENG_API_SERVICE_KEY
```

이번 작업은 새 장소를 추가하는 것이 아니라, 기존 `mg_places`에 매칭되는 영문 데이터를 `mg_place_texts(locale='en')`로 보강하는 것이다.

---

## 2. 핵심 원칙

```txt
새 mg_places insert 금지
새 테이블 생성 금지
기존 mg-tour-seed 수정 금지
프론트에서 EngService2 직접 호출 금지
영문 API 키를 프론트에 노출 금지
매칭되는 기존 장소에만 en 텍스트 추가
```

영문 데이터 저장 위치:

```txt
mg_place_texts → locale='en'
mg_place_sources → source='TOUR_API_EN', source_language='en'
```

---

## 3. 사용할 TourAPI

영문 관광정보 서비스: `EngService2`

기본 URL:

```txt
https://apis.data.go.kr/B551011/EngService2
```

| 용도 | 엔드포인트 |
|---|---|
| 목록 조회 | `GET /areaBasedList2` |
| 상세 조회 | `GET /detailIntro2` |

음식점 파라미터:

```txt
contentTypeId=82
lDongRegnCd=11   (서울 법정동 코드)
MobileOS=ETC
MobileApp=matgil
_type=json
numOfRows
pageNo
```

---

## 4. 새 Edge Function 계획

새 함수명: `mg-tour-en-enrich`

처리 흐름:

```txt
EngService2 areaBasedList2 호출
→ 각 item의 detailIntro2 호출
→ 기존 mg_places와 좌표 기반 매칭
→ 매칭 성공 시 mg_place_texts(locale='en') upsert
→ mg_place_sources TOUR_API_EN upsert
→ 매칭 실패 시 skipped
```

기존 `supabase/functions/mg-tour-seed/index.ts`는 국문 데이터 수집용으로 안정적으로 동작 중이므로 수정하지 않는다.

---

## 5. 요청 방식

POST 요청. body 예시:

```json
{
  "numOfRows": 10,
  "pageNo": 1
}
```

제한:

```txt
numOfRows 기본값 10, 최대값 30
pageNo 최소값 1
```

기존 `mg-tour-seed`와 동일하게 `x-admin-seed-token`을 검사한다.

---

## 6. Secrets

필요한 Secret:

```txt
TOUR_ENG_API_SERVICE_KEY
ADMIN_SEED_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

영문 API 키 사용 방법:

```ts
Deno.env.get("TOUR_ENG_API_SERVICE_KEY")
```

주의:

```txt
API key를 console.log 하지 말 것
API key를 응답 JSON에 넣지 말 것
VITE_TOUR_ENG_API_SERVICE_KEY 만들지 말 것
프론트에 영문 API 키를 넣지 말 것
```

---

## 7. 기존 mg_places 매칭 방식

영문 item을 새 장소로 만들지 않는다.

좌표 매핑:

```txt
item.mapy → latitude
item.mapx → longitude
```

기존 `mg_places.latitude`, `mg_places.longitude`와 비교한다.

MVP 기준:

```txt
150m 이내 가장 가까운 mg_places 1개 선택
```

처리 규칙:

```txt
좌표가 없으면 → skipped
150m 이내 후보 없으면 → skipped
후보 여러 개면 → 가장 가까운 place 선택
매칭 실패한 item → 새 mg_places로 insert하지 않음
```

이름 매칭은 MVP에서 필수로 하지 않는다. 필요하면 보조 조건으로만 사용한다.

---

## 8. mg_place_texts 저장 방식

매칭 성공 시 `mg_place_texts`에 `locale='en'`으로 upsert한다.

unique 기준: `place_id + locale`

저장 필드:

```txt
place_id
locale           = 'en'
name             = item.title
address          = item.addr1 + item.addr2
description      (아래 규칙으로 생성)
first_menu       = introItem.firstmenu
treat_menu       = introItem.treatmenu
open_time        = introItem.opentimefood
rest_date        = introItem.restdatefood
parking          = introItem.parkingfood
packing          = introItem.packing
tags             = 영어 태그 배열
translation_status = 'source'
```

description 생성 규칙:

```txt
기본:
"{name} is a restaurant located at {address}."

first_menu가 있는 경우:
"{name} is a restaurant located at {address}. A signature menu item is {firstMenu}."
```

영문 API에서 직접 받은 데이터이므로 `translation_status='source'`로 저장한다.

---

## 9. mg_place_sources 저장 방식

매칭 성공 시 `mg_place_sources`에 영문 원본 출처를 upsert한다.

unique 기준: `source + source_language + external_id + external_content_type_id`

저장 필드:

```txt
place_id                  = 매칭된 기존 mg_places.id
source                    = 'TOUR_API_EN'
source_language           = 'en'
external_id               = item.contentid
external_content_type_id  = item.contenttypeid
license_type              = '공공데이터'
attribution               = '한국관광공사 TourAPI'
cache_policy              = 'stored'
source_modified_at        = item.modifiedtime 파싱
raw_list                  = areaBasedList2 item 원본
raw_intro                 = detailIntro2 원본
```

이미 있으면 update, 없으면 insert.

---

## 10. 저장하지 않을 것

이번 함수에서는 아래를 하지 않는다.

```txt
mg_places insert 금지
mg_place_food_details insert/update 금지
mg_place_images insert 금지
matgil_category_keys 수정 금지
기존 ko 텍스트 수정 금지
검색/프론트 코드 수정 금지
```

이번 작업은 영문 텍스트와 영문 원본 출처 보강만 담당한다.

---

## 11. 응답 형식

```json
{
  "message": "TourAPI 영문 음식점 데이터 보강 완료",
  "requestedCount": 10,
  "matchedCount": 7,
  "upsertedTextCount": 7,
  "upsertedSourceCount": 7,
  "skippedCount": 3,
  "failedCount": 0,
  "results": []
}
```

각 result 항목:

```txt
status         : matched | skipped | failed
title
contentId
matchedPlaceId
distanceKm
reason
```

API key는 절대 포함하지 않는다.

---

## 12. 로그

`mg_api_fetch_logs`에 로그를 남긴다.

```txt
source          = 'TOUR_API_EN'
endpoint        = 'areaBasedList2 + detailIntro2'
request_params  = { numOfRows, pageNo, contentTypeId: 82, lDongRegnCd: 11 }
success         = failedCount === 0
fetched_count   = upsertedTextCount
error_message   = 실패 개수 있으면 요약
```

---

## 13. 테스트 순서

대량 수집하지 말고 처음에는 10개만 실행한다.

```txt
numOfRows=10
pageNo=1
```

첫 실행 후 확인:

```txt
matchedCount
skippedCount
failedCount
mg_place_texts locale='en' 개수
mg_place_sources TOUR_API_EN 개수
```

---

## 14. 이번 단계에서 하지 않을 것

```txt
dryRun 구현
대량 수집
좌표 오매칭 정교화
영문 데이터로 새 장소 생성
영문 API 이미지를 별도 저장
프론트 다국어 UI 연결
언어 전환 기능 구현
```

이 작업들은 나중에 별도 단계로 진행한다.
