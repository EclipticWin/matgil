# 19. 주의 — TourAPI 영문 source 오매칭 검수 필요

## 작성 일시

2026-06-21 22:55 KST

## 작업 위치

언어 전환 Stage 1 구현 이후 확인할 후속 작업이다.

이번 문서는 코드 구현 지시가 아니라, 나중에 EN 화면에서 이상한 음식점명이 보일 때 원인을 빠르게 파악하기 위한 주의 문서다.

---

## 배경

Matgil은 현재 `mg_place_texts`에서 언어별 장소 텍스트를 관리한다.

현재 확인된 데이터 분포는 다음과 같다.

```txt
en / machine : 981
en / source  : 71
ko / source  : 1633
ko 데이터는 있지만 en 데이터가 아직 없는 place 수: 581
```

영문 데이터는 두 종류가 섞여 있다.

```txt
1. en / source
   - TourAPI EngService2에서 직접 받은 공식 영문 데이터
   - mg-tour-en-enrich 함수로 좌표 기반 매칭 후 저장됨

2. en / machine
   - ko/source 데이터를 LLM으로 번역해서 만든 데이터
   - mg-place-translate-en 함수로 저장됨
```

---

## 발견된 문제

Supabase SQL 조회 결과, 일부 `place_id`에서 `ko/source`와 `en/source`가 서로 다른 장소처럼 보이는 사례가 발견됐다.

예시:

```txt
place_id: 17

en / source:
Starbucks Buckhansan (스타벅스 더북한산)

ko / source:
가야밀면앤해물칼국수
```

이 경우 같은 `place_id`에 붙은 한국어 장소명과 영어 source 장소명이 서로 맞지 않는다.

이는 프론트 표시 로직 문제가 아니라, 과거 `mg-tour-en-enrich`에서 영문 TourAPI 데이터를 기존 `mg_places`에 매칭할 때 좌표 150m 기준만으로 매칭하면서 생긴 오매칭 가능성이 있다.

---

## 원인 추정

`mg-tour-en-enrich`는 새 장소를 만들지 않고, EngService2의 영문 음식점 데이터를 기존 `mg_places`와 좌표 기준으로 매칭했다.

당시 기준:

```txt
영문 TourAPI item 좌표
→ 기존 mg_places 좌표와 비교
→ 150m 이내 가장 가까운 place에 매칭
→ mg_place_texts(locale='en', translation_status='source') upsert
```

문제는 서울 도심에서는 150m 안에 여러 음식점/카페가 몰려 있을 수 있다는 점이다.

그래서 실제로는 다른 장소인데 좌표가 가까워서 잘못 붙었을 가능성이 있다.

---

## 중요한 판단

이 문제는 언어 전환 Stage 1에서 코드로 억지 보정하지 않는다.

이번 Stage 1의 목표는 다음이다.

```txt
EN 선택 시 en 우선 / ko fallback
KO 선택 시 ko 우선 / en fallback
SearchOverlay 표시 언어 분기
Map 핵심 UI 문구 다국어화
```

영문 source 오매칭은 DB 데이터 품질 문제이므로 별도 검수 작업으로 분리한다.

---

## 언어 전환 이후 확인해야 할 증상

언어 전환 Stage 1 이후 EN 모드에서 아래 증상이 보이면 이 문서를 먼저 확인한다.

```txt
1. 영어 모드에서 음식점 카드명이 전혀 다른 브랜드명으로 표시됨
2. 한국어 모드에서는 정상인데 영어 모드에서만 가게명이 이상함
3. SearchOverlay에서 DB 매칭된 음식점 이름이 엉뚱한 영어 이름으로 보임
4. 코스 상세 / 장소 상세에서 한국어 장소와 영어 장소가 서로 다른 곳처럼 보임
```

이 경우 프론트 코드보다 DB의 `en/source` row 오매칭을 먼저 의심한다.

---

## 우선 확인 SQL

### 1. 언어별 전체 분포

```sql
select locale, translation_status, count(*)
from public.mg_place_texts
group by locale, translation_status
order by locale, translation_status;
```

### 2. ko/en이 모두 있는 place 샘플 확인

```sql
select place_id, locale, name, address, translation_status
from public.mg_place_texts
where place_id in (
  select place_id
  from public.mg_place_texts
  group by place_id
  having count(*) >= 2
)
order by place_id, locale
limit 80;
```

### 3. en/source만 따로 확인

```sql
select
  ko.place_id,
  ko.name as ko_name,
  ko.address as ko_address,
  en.name as en_name,
  en.address as en_address,
  en.translation_status as en_status
from public.mg_place_texts ko
join public.mg_place_texts en
  on en.place_id = ko.place_id
where ko.locale = 'ko'
  and en.locale = 'en'
  and en.translation_status = 'source'
order by ko.place_id
limit 100;
```

### 4. 특정 place_id 확인 예시

```sql
select place_id, locale, name, address, translation_status
from public.mg_place_texts
where place_id = 17
order by locale;
```

---

## 검수 기준

아래 경우는 정상일 수 있다.

```txt
ko: 가담
en: Gadam (가담)
→ 정상

ko: 남포면옥
en: Nampomyeonok (남포면옥)
→ 정상

ko: 스타벅스 더북한산
en: Starbucks Buckhansan (스타벅스 더북한산)
→ 정상
```

아래 경우는 오매칭 의심이다.

```txt
ko: 가야밀면앤해물칼국수
en: Starbucks Buckhansan (스타벅스 더북한산)
→ 오매칭 의심

ko: 한식당명
en: 완전히 다른 카페/브랜드명
→ 오매칭 의심

ko 주소의 구/동과 en 주소의 구/동이 크게 다름
→ 오매칭 의심
```

---

## 수정 원칙

오매칭이 확인되더라도 바로 대량 삭제하지 않는다.

우선 수동으로 몇 개만 확인한다.

수정 후보는 다음 중 하나다.

### 선택 A. 잘못 붙은 en/source row 삭제

영어 source가 명백히 다른 장소라면 해당 `mg_place_texts`의 `locale='en'` row를 삭제한다.

그러면 EN 모드에서는 ko fallback으로 표시된다.

```sql
-- 예시. 실제 실행 전 place_id를 반드시 재확인할 것.
delete from public.mg_place_texts
where place_id = 17
  and locale = 'en'
  and translation_status = 'source';
```

### 선택 B. 잘못 붙은 TOUR_API_EN source row도 함께 삭제

`mg_place_sources`에도 잘못된 TOUR_API_EN source가 붙어 있을 수 있다.

삭제 전 반드시 원본을 확인한다.

```sql
select *
from public.mg_place_sources
where place_id = 17
  and source = 'TOUR_API_EN';
```

명백히 다른 장소라면 삭제를 검토한다.

```sql
-- 예시. 실제 실행 전 raw_list/raw_intro 확인 필수.
delete from public.mg_place_sources
where place_id = 17
  and source = 'TOUR_API_EN';
```

### 선택 C. ko/source 기반으로 en/machine 재생성

잘못된 en/source row를 삭제한 뒤, 필요하면 `mg-place-translate-en`으로 해당 place의 영어 machine 번역을 다시 만들 수 있다.

단, 이 작업은 별도 계획을 세운 뒤 진행한다.

---

## 절대 하지 말 것

```txt
프론트 코드에서 특정 place_id를 하드코딩해 보정하지 말 것
영어 이름이 이상하다고 anchorMatchService를 과하게 수정하지 말 것
SearchOverlay 표시 로직으로 DB 오매칭을 숨기려 하지 말 것
en/source row를 전체 대량 삭제하지 말 것
mg-tour-en-enrich를 즉시 재실행하지 말 것
좌표 150m 기준을 그대로 두고 대량 재매칭하지 말 것
```

---

## 후속 작업 후보

언어 전환 Stage 1이 끝난 뒤, 시간이 있으면 아래 순서로 진행한다.

```txt
1. EN 화면에서 실제로 이상한 가게명이 보이는지 확인
2. 위 SQL로 en/source row 샘플 100개 검수
3. 오매칭 의심 place_id 목록 작성
4. 명백히 틀린 en/source row만 수동 삭제
5. 필요한 경우 ko/source 기반 en/machine 번역으로 보완
6. mg-tour-en-enrich 매칭 로직 개선 여부 검토
```

---

## 현재 결론

현재는 언어 전환 Stage 1 구현을 먼저 진행한다.

TourAPI 영문 source 오매칭 문제는 프론트 구현과 분리해서, 언어 전환 이후 DB 품질 검수 작업으로 처리한다.
