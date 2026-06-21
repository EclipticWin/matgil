# 21. TourAPI EN source 오매칭 정리 작업

## 작성 일시

2026-06-22 KST

## 작업 목적

언어 전환 작업 이후 영어 모드에서 일부 음식점명이 실제 한국어 장소와 전혀 다른 영문명으로 표시되는 문제가 확인되었다.

예:

```txt
KO: 가야밀냉면해물칼국수
EN: Starbucks Buckhansan (스타벅스 더북한산)
```

이 문제는 프론트엔드 i18n 로직 문제가 아니라, 과거 `mg-tour-en-enrich` 작업에서 TourAPI 영문 데이터를 기존 `mg_places`에 붙일 때 일부 잘못 매칭된 `mg_place_texts.locale = 'en' / translation_status = 'source'` row가 원인으로 판단하였다.

---

## 배경

Matgil은 장소 텍스트를 `mg_place_texts`에서 locale별로 관리한다.

언어 전환 작업 이후 확인된 분포는 다음과 같았다.

```txt
en / machine : 981
en / source  : 71
ko / source  : 1633
```

여기서 의미는 다음과 같다.

```txt
ko / source
- TourAPI 국문 데이터 기반 원본 장소명/주소

en / machine
- ko/source를 기반으로 Solar LLM 번역을 통해 생성한 영어 데이터

en / source
- TourAPI 영문 API 데이터를 기존 place_id에 매칭해서 저장한 공식 영문 source 데이터
```

이번 문제는 `en / machine` 981개가 아니라, `en / source` 71개 중 일부가 기존 한국어 place_id에 잘못 붙은 문제였다.

---

## 원인 추정

TourAPI 국문 API와 영문 API는 서로 다른 API이며, 같은 장소라도 양쪽의 외부 ID가 다를 수 있다.

따라서 단순히 `external_id`가 다르다는 이유만으로 오매칭이라고 볼 수는 없다.

하지만 실제 데이터 확인 결과, 일부 row는 같은 장소의 다른 ID 문제가 아니라 완전히 다른 음식점/카페의 영문 데이터가 한국어 장소에 붙어 있었다.

문제의 핵심은 다음과 같다.

```txt
TourAPI EN item
→ 기존 mg_places와 좌표 기준으로 매칭
→ 서울 도심에서는 근처 150m 안에 여러 매장이 존재
→ 실제로는 다른 장소인데 가까운 좌표 때문에 기존 place_id에 붙음
```

---

## 오매칭 판단 기준

정상 예:

```txt
KO: 개성만두 궁
EN: Gaeseong Mandu Koong (개성만두 궁)

KO: 고려삼계탕
EN: Korea Samgyetang (고려삼계탕)
```

오매칭 예:

```txt
KO: 런던베이글뮤지엄 안국
EN: Bukchon Son Mandu Bukchon Branch (북촌손만두 북촌점)

KO: 명동 영양센터
EN: Starbucks Byuldabang (스타벅스 별다방)

KO: 바이킹스워프 롯데월드몰점
EN: Bicena (비채나)
```

판단 기준은 `en.name` 괄호 안의 한국어 힌트와 `ko.name`이 같은 장소명인지 여부를 우선으로 보았다.

---

## 1차 분류 쿼리

`en/source` 71개를 대상으로 한국어 원본명과 영문 source명 괄호 안의 한국어명을 비교하였다.

```sql
with pairs as (
  select
    ko.place_id,
    ko.name as ko_name,
    ko.address as ko_address,
    en.name as en_name,
    en.address as en_address,
    en.translation_status as en_status,
    substring(en.name from '\(([^)]*)\)') as en_korean_hint,
    regexp_replace(ko.name, '[^가-힣a-zA-Z0-9]', '', 'g') as ko_norm,
    regexp_replace(coalesce(substring(en.name from '\(([^)]*)\)'), ''), '[^가-힣a-zA-Z0-9]', '', 'g') as en_hint_norm
  from public.mg_place_texts ko
  join public.mg_place_texts en
    on en.place_id = ko.place_id
  where ko.locale = 'ko'
    and en.locale = 'en'
    and en.translation_status = 'source'
),
classified as (
  select
    *,
    case
      when en_korean_hint is null or en_korean_hint = '' then '확인 필요'
      when ko_norm = en_hint_norm then '정상 가능성 높음'
      when ko_norm like '%' || en_hint_norm || '%' then '정상 가능성 있음'
      when en_hint_norm like '%' || ko_norm || '%' then '정상 가능성 있음'
      else '오매칭 의심'
    end as check_result
  from pairs
)
select check_result, count(*)
from classified
group by check_result
order by check_result;
```

결과:

```txt
오매칭 의심       37
정상 가능성 높음 32
정상 가능성 있음 2
```

---

## 오매칭 의심 place_id 목록

아래 37개는 실제 확인 결과, `ko_name`과 `en_name`이 서로 다른 장소로 판단되어 `en/source` row 삭제 대상으로 분류했다.

```txt
17, 25, 37, 49, 68,
174, 252, 260, 313, 318,
335, 339, 355, 373, 407,
414, 419, 438, 446, 449,
459, 484, 494, 526, 560,
567, 586, 632, 645, 660,
663, 672, 678, 695, 816,
980, 998
```

대표 사례:

```txt
17
KO: 가야밀냉면해물칼국수
EN: Starbucks Buckhansan (스타벅스 더북한산)

355
KO: 런던베이글뮤지엄 안국
EN: Bukchon Son Mandu Bukchon Branch (북촌손만두 북촌점)

446
KO: 명동 영양센터
EN: Starbucks Byuldabang (스타벅스 별다방)

526
KO: 바이킹스워프 롯데월드몰점
EN: Bicena (비채나)

998
KO: 온천집 익선
EN: Tteulan Teahouse (뜰안)
```

---

## 백업 작업

삭제 전 `en/source` 전체 71개를 백업하였다.

```sql
create table if not exists public.backup_mg_place_texts_en_source_20260622 as
select *
from public.mg_place_texts
where locale = 'en'
  and translation_status = 'source';
```

백업 확인:

```sql
select count(*)
from public.backup_mg_place_texts_en_source_20260622;
```

결과:

```txt
71
```

오매칭 의심 37개도 별도 백업하였다.

```sql
create table if not exists public.backup_mg_place_texts_en_source_mismatch_20260622 as
select *
from public.mg_place_texts
where locale = 'en'
  and translation_status = 'source'
  and place_id in (
    17, 25, 37, 49, 68, 174, 252, 260, 313, 318,
    335, 339, 355, 373, 407, 414, 419, 438, 446, 449,
    459, 484, 494, 526, 560, 567, 586, 632, 645, 660,
    663, 672, 678, 695, 816, 980, 998
  );
```

백업 확인:

```sql
select count(*)
from public.backup_mg_place_texts_en_source_mismatch_20260622;
```

결과:

```txt
37
```

---

## 삭제 전 dry-run

실제 삭제 전 transaction + rollback으로 삭제 대상 row를 확인하였다.

```sql
begin;

delete from public.mg_place_texts
where locale = 'en'
  and translation_status = 'source'
  and place_id in (
    17, 25, 37, 49, 68, 174, 252, 260, 313, 318,
    335, 339, 355, 373, 407, 414, 419, 438, 446, 449,
    459, 484, 494, 526, 560, 567, 586, 632, 645, 660,
    663, 672, 678, 695, 816, 980, 998
  )
returning place_id, locale, name, address, translation_status;

rollback;
```

확인 결과 37개 row가 반환되었고, rollback으로 실제 삭제는 취소되었다.

---

## 실제 삭제 작업

dry-run 확인 후, 오매칭 의심 37개의 `en/source` row만 삭제하였다.

```sql
delete from public.mg_place_texts
where locale = 'en'
  and translation_status = 'source'
  and place_id in (
    17, 25, 37, 49, 68, 174, 252, 260, 313, 318,
    335, 339, 355, 373, 407, 414, 419, 438, 446, 449,
    459, 484, 494, 526, 560, 567, 586, 632, 645, 660,
    663, 672, 678, 695, 816, 980, 998
  )
returning place_id, locale, name, address, translation_status;
```

삭제 후 분포 확인:

```sql
select locale, translation_status, count(*)
from public.mg_place_texts
group by locale, translation_status
order by locale, translation_status;
```

결과:

```txt
en / machine : 981
en / source  : 34
ko / source  : 1633
```

---

## 삭제 후 확인

삭제 대상 37개 place_id를 다시 조회하였다.

```sql
select place_id, locale, name, translation_status
from public.mg_place_texts
where place_id in (
  17, 25, 37, 49, 68, 174, 252, 260, 313, 318,
  335, 339, 355, 373, 407, 414, 419, 438, 446, 449,
  459, 484, 494, 526, 560, 567, 586, 632, 645, 660,
  663, 672, 678, 695, 816, 980, 998
)
order by place_id, locale;
```

확인 결과, 해당 37개 place_id에는 `ko/source` row만 남아 있었다.

즉 잘못 붙어 있던 `en/source` row는 제거되었다.

---

## 이번 작업에서 건드리지 않은 것

아래 항목은 이번 작업에서 수정하지 않았다.

```txt
mg_places
mg_place_sources
mg_place_food_details
mg_place_images
en/machine row 981개
ko/source row 1633개
프론트엔드 코드
Edge Function
TourAPI 재수집 함수
LLM 번역 함수
```

특히 `mg_place_sources`의 `TOUR_API_EN` row는 아직 남겨두었다.

이유:

```txt
- 앱 화면 표시 문제의 직접 원인은 mg_place_texts의 en/source row였음
- mg_place_sources는 원본 추적용 성격이 강함
- source row 삭제는 별도 검토 후 진행하는 것이 안전함
```

---

## 현재 앱 표시 영향

이번 삭제 후 영어 모드에서 해당 37개 장소는 더 이상 잘못된 영문 공식명으로 표시되지 않는다.

대신 다음 중 하나로 표시된다.

```txt
1. 해당 place_id에 en/machine row가 있으면 en/machine 표시
2. en/machine도 없으면 ko/source fallback 표시
```

영어 모드에서 일부 장소명이 한국어로 보일 수는 있지만, 잘못된 다른 가게명으로 보이는 것보다 안전하다.

---

## 향후 보완 방향

삭제된 37개는 필요하면 `ko/source` 기반으로 `en/machine` 번역을 다시 생성해 보완한다.

향후 TourAPI 영문 API 데이터를 다시 사용할 경우, 기존 방식처럼 좌표만으로 기존 place에 붙이면 안 된다.

권장 매칭 조건:

```txt
1. 좌표 거리
2. 주소의 구/도로명/건물 정보
3. en.name 괄호 안 한글명과 ko.name 비교
4. 정규화된 장소명 비교
5. 이름과 주소가 모두 신뢰 가능할 때만 en/source로 교체
```

향후 원칙:

```txt
기본 영어 데이터:
ko/source → en/machine

공식 영문 TourAPI 데이터:
검증 통과 시에만 en/source로 승격

애매한 경우:
en/source로 붙이지 않고 en/machine 또는 ko fallback 유지
```

---

## 복구 방법

이번 삭제 row는 아래 백업 테이블에 남아 있다.

```txt
backup_mg_place_texts_en_source_20260622
backup_mg_place_texts_en_source_mismatch_20260622
```

특정 place_id의 삭제 row를 복구해야 하는 경우 예시는 다음과 같다.

```sql
insert into public.mg_place_texts
select *
from public.backup_mg_place_texts_en_source_mismatch_20260622
where place_id = 17;
```

단, 실제 복구 전에는 현재 `mg_place_texts`에 같은 `place_id + locale` row가 이미 존재하는지 확인해야 한다.

```sql
select *
from public.mg_place_texts
where place_id = 17
  and locale = 'en';
```

---

## 현재 결론

이번 작업으로 `mg_place_texts`의 TourAPI EN source 오매칭 37개를 제거하였다.

최종 상태:

```txt
en / machine : 981
en / source  : 34
ko / source  : 1633
```

이번 작업은 전체 영어 데이터 재작업이 아니라, 잘못 붙은 공식 영문 source row만 제거한 응급 정리 작업이다.

Solar 기반 `en/machine` 데이터는 유지되었고, 국문 원본 `ko/source`도 유지되었다.
