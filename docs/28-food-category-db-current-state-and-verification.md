# 28. 음식 카테고리 DB 현재 상태 및 검증 결과

## 작성 일시

2026-07-11 15:10 KST

## 문서 목적

맛길(Matgil) 프로젝트의 음식 카테고리 DB 전환 작업을 시작하기 전에, 현재 Supabase에 실제로 적용되어 있는 장소 카테고리 구조와 저장 코스 호환 상태를 확인하고 기록한다.

이 문서는 계획서나 구현 지시서가 아니라 다음 조회 결과를 보관하는 **현재 DB 상태 기록 문서**다.

* 음식 카테고리 관련 기존 테이블
* `mg_places` 실제 컬럼
* `mg_saved_courses` 실제 컬럼
* 현재 음식 카테고리 key와 사용 건수
* 카테고리 배열의 NULL·빈 배열·중복 여부
* 코드에 정의되지 않은 key 존재 여부
* `mg_places` 인덱스
* `mg_places`, `mg_saved_courses` RLS 상태와 정책
* 저장 코스 snapshot 안의 음식 카테고리 저장 방식

모든 SQL은 2026-07-11 15:10 KST 이전에 Supabase SQL Editor에서 읽기 전용으로 실행했다.

DB 구조나 데이터를 변경하는 DDL·DML은 실행하지 않았다.

---

# 1. 핵심 확인 결과

현재 DB 상태를 먼저 요약하면 다음과 같다.

```text
음식 카테고리 전용 관리 테이블:
없음

현재 음식 카테고리 저장 위치:
public.mg_places.matgil_category_keys

컬럼 타입:
text[]

NULL 허용:
허용하지 않음

기본값:
빈 text 배열 {}

현재 장소 수:
1,633건

NULL 배열:
0건

빈 배열:
0건

배열 내부 중복:
0건

현재 코드에 정의되지 않은 key:
0건

실제 사용 중인 음식 카테고리 key:
18개

all key의 DB 저장 여부:
저장되지 않음

카테고리 배열 인덱스:
GIN 인덱스 존재

mg_places RLS:
활성화

mg_saved_courses RLS:
활성화
```

현재 DB의 카테고리 데이터는 배열 구조 자체만 놓고 보면 깨진 데이터 없이 일관된 상태다.

다만 카테고리의 이름, 번역, 정렬 순서, 활성 여부, 자동 분류 키워드는 DB에서 관리되지 않고 프론트와 Edge Function 코드에 하드코딩되어 있다.

---

# 2. 카테고리 관련 기존 테이블 확인

## 2.1 실행 SQL

```sql
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name like '%categor%'
    or table_name in (
      'mg_places',
      'mg_saved_courses'
    )
  )
order by table_name;
```

## 2.2 조회 결과

| 테이블명                   | 용도                             |
| ---------------------- | ------------------------------ |
| `ail_board_categories` | 맛길 음식 카테고리와 관계없는 기존 게시판 계열 테이블 |
| `mg_phrase_categories` | 음식점 회화 표현 카테고리                 |
| `mg_places`            | 장소 본체와 음식 카테고리 key 배열 저장       |
| `mg_saved_courses`     | 사용자가 저장한 추천 코스 snapshot        |

## 2.3 해석

현재 다음과 같은 음식 카테고리 전용 테이블은 존재하지 않는다.

```text
mg_categories
mg_food_categories
mg_food_category_translations
mg_food_category_rules
mg_place_food_categories
```

따라서 현재 음식 카테고리의 이름·번역·정렬·활성 여부를 DB에서 관리하는 구조는 없다.

`mg_phrase_categories`는 Phrases 기능 전용이며 음식점 Food Type 필터와는 별개다.

---

# 3. `mg_places` 실제 컬럼 확인

## 3.1 실행 SQL

```sql
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'mg_places',
    'mg_saved_courses'
  )
order by table_name, ordinal_position;
```

## 3.2 `mg_places` 컬럼

| 순서 | 컬럼                     | 데이터 타입           | NULL | 기본값                           |
| -: | ---------------------- | ---------------- | ---- | ----------------------------- |
|  1 | `id`                   | bigint           | 불가   | `nextval('mg_places_id_seq')` |
|  2 | `primary_source`       | varchar          | 불가   | `TOUR_API`                    |
|  3 | `place_type`           | varchar          | 불가   | `restaurant`                  |
|  4 | `content_type_id`      | varchar          | 가능   | 없음                            |
|  5 | `latitude`             | double precision | 가능   | 없음                            |
|  6 | `longitude`            | double precision | 가능   | 없음                            |
|  7 | `area_code`            | varchar          | 가능   | 없음                            |
|  8 | `sigungu_code`         | varchar          | 가능   | 없음                            |
|  9 | `ldong_regn_cd`        | varchar          | 가능   | 없음                            |
| 10 | `ldong_signgu_cd`      | varchar          | 가능   | 없음                            |
| 11 | `category_code_1`      | varchar          | 가능   | 없음                            |
| 12 | `category_code_2`      | varchar          | 가능   | 없음                            |
| 13 | `category_code_3`      | varchar          | 가능   | 없음                            |
| 14 | `food_category_code_1` | varchar          | 가능   | 없음                            |
| 15 | `food_category_code_2` | varchar          | 가능   | 없음                            |
| 16 | `food_category_code_3` | varchar          | 가능   | 없음                            |
| 17 | `default_image_url`    | text             | 가능   | 없음                            |
| 18 | `is_active`            | boolean          | 불가   | `true`                        |
| 19 | `data_quality_score`   | integer          | 불가   | `0`                           |
| 20 | `created_at`           | timestamptz      | 불가   | `now()`                       |
| 21 | `updated_at`           | timestamptz      | 불가   | `now()`                       |
| 22 | `matgil_category_keys` | text[]           | 불가   | 빈 배열 `{}`                     |

## 3.3 음식 카테고리 관련 핵심 컬럼

```text
컬럼:
mg_places.matgil_category_keys

실제 PostgreSQL 타입:
text[]

내부 UDT:
_text

NULL:
허용하지 않음

기본값:
'{}'::text[]
```

하나의 음식점이 여러 음식 카테고리에 속할 수 있기 때문에 배열로 저장되어 있다.

예:

```json
["bbq", "pork"]
```

```json
["noodle", "stew"]
```

```json
["bbq", "noodle", "stew"]
```

현재 프론트의 필터와 코스 추천 로직은 이 배열의 key를 사용한다.

---

# 4. `mg_saved_courses` 실제 컬럼 확인

## 4.1 실제 컬럼

| 순서 | 컬럼                   | 데이터 타입      | NULL | 기본값                 |
| -: | -------------------- | ----------- | ---- | ------------------- |
|  1 | `id`                 | uuid        | 불가   | `gen_random_uuid()` |
|  2 | `user_id`            | uuid        | 불가   | 없음                  |
|  3 | `locale`             | varchar     | 불가   | `en`                |
|  4 | `title`              | text        | 불가   | 없음                  |
|  5 | `subtitle`           | text        | 가능   | 없음                  |
|  6 | `description`        | text        | 가능   | 없음                  |
|  7 | `anchor_label`       | text        | 가능   | 없음                  |
|  8 | `total_distance_m`   | integer     | 가능   | 없음                  |
|  9 | `total_duration_min` | integer     | 가능   | 없음                  |
| 10 | `stop_count`         | integer     | 불가   | `0`                 |
| 11 | `place_ids`          | bigint[]    | 불가   | 빈 배열 `{}`           |
| 12 | `stops`              | jsonb       | 불가   | 빈 배열 `[]`           |
| 13 | `course_snapshot`    | jsonb       | 불가   | 빈 객체 `{}`           |
| 14 | `created_at`         | timestamptz | 불가   | `now()`             |
| 15 | `updated_at`         | timestamptz | 불가   | `now()`             |
| 16 | `deleted_at`         | timestamptz | 가능   | 없음                  |
| 17 | `deleted_by`         | uuid        | 가능   | 없음                  |

## 4.2 카테고리 전환과 관련된 컬럼

저장 코스는 장소 ID만 저장하지 않고 저장 당시 코스와 장소 데이터를 JSON snapshot으로 보관한다.

```text
place_ids:
코스에 포함된 장소 ID 배열

stops:
저장 당시 장소 정보 배열

course_snapshot:
저장 당시 코스 전체 정보
```

`stops`와 `course_snapshot.stops` 안에는 다음 값이 들어 있다.

```json
{
  "id": 117,
  "name": "Geuril 1492 Bonjeom (그릴1492 본점)",
  "nameKo": "그릴1492 본점",
  "matgilCategoryKeys": [
    "bbq",
    "western"
  ]
}
```

따라서 음식 카테고리 구조를 변경할 때 기존 key를 삭제하거나 이름을 변경하면 과거 저장 코스에 영향을 줄 수 있다.

반대로 다음처럼 **시스템 key는 유지하고 표시 라벨만 변경**하면 과거 저장 코스도 계속 해석할 수 있다.

```text
시스템 key:
bbq 유지

영어 표시:
Korean BBQ 유지

한국어 표시:
한국식 BBQ → 고기 구이
```

---

# 5. 현재 음식 카테고리 key와 사용량

## 5.1 실행 SQL

```sql
select
  category_key,
  count(*) as place_count
from public.mg_places p
cross join lateral unnest(
  coalesce(p.matgil_category_keys, array[]::text[])
) as category_key
group by category_key
order by place_count desc, category_key;
```

## 5.2 조회 결과

| 순위 | category key      | 장소 수 |
| -: | ----------------- | ---: |
|  1 | `other`           |  612 |
|  2 | `stew`            |  199 |
|  3 | `bbq`             |  180 |
|  4 | `noodle`          |  167 |
|  5 | `seafood`         |  152 |
|  6 | `cafe`            |  130 |
|  7 | `pork`            |   89 |
|  8 | `japanese`        |   77 |
|  9 | `street`          |   77 |
| 10 | `rice`            |   59 |
| 11 | `western`         |   51 |
| 12 | `chicken`         |   36 |
| 13 | `pasta`           |   32 |
| 14 | `chinese`         |   20 |
| 15 | `indian`          |   18 |
| 16 | `pizza`           |   16 |
| 17 | `southeast_asian` |    9 |
| 18 | `burger`          |    8 |

## 5.3 해석

현재 DB에서 실제 사용 중인 Food Type key는 총 18개다.

```text
bbq
noodle
stew
seafood
chicken
street
cafe
rice
pork
chinese
japanese
western
pasta
pizza
burger
indian
southeast_asian
other
```

프론트의 `all`은 전체 필터를 뜻하는 UI 가상 값이며 DB에는 저장되어 있지 않다.

현재 `other`가 612건으로 가장 많다.

이는 DB 오류는 아니지만 다음 가능성을 의미한다.

```text
- 자동 분류 키워드가 충분하지 않음
- TourAPI 장소명과 카테고리 원문만으로 세부 분류하기 어려움
- 현재 분류 규칙에 포함되지 않은 음식 유형이 많음
- 재분류 도구 또는 관리자 직접 분류 기능이 필요할 수 있음
```

향후 자동 분류 규칙을 DB로 이전할 경우 `other` 612건을 우선 검수 대상으로 활용할 수 있다.

---

# 6. NULL 및 빈 배열 확인

## 6.1 실행 SQL

```sql
select
  count(*) as total_count,
  count(*) filter (
    where matgil_category_keys is null
  ) as null_count,
  count(*) filter (
    where matgil_category_keys is not null
      and cardinality(matgil_category_keys) = 0
  ) as empty_count
from public.mg_places;
```

## 6.2 조회 결과

| 전체 장소 | NULL 배열 | 빈 배열 |
| ----: | ------: | ---: |
| 1,633 |       0 |    0 |

## 6.3 해석

현재 모든 `mg_places` row에는 최소 하나 이상의 음식 카테고리 key가 들어 있다.

```text
NULL 데이터:
없음

빈 배열 데이터:
없음
```

현재 분류되지 않은 장소도 빈 배열로 두지 않고 `other`로 분류된 것으로 판단된다.

---

# 7. 배열 내부 중복 key 확인

## 7.1 실행 SQL

```sql
select
  p.id,
  p.matgil_category_keys
from public.mg_places p
where p.matgil_category_keys is not null
  and cardinality(p.matgil_category_keys) <> (
    select count(distinct x)
    from unnest(p.matgil_category_keys) as x
  );
```

## 7.2 조회 결과

```text
Success. No rows returned.
```

## 7.3 해석

한 장소의 배열 안에 동일한 category key가 두 번 이상 들어간 데이터는 없다.

정상 예:

```json
["bbq", "pork"]
```

발견되지 않은 비정상 예:

```json
["bbq", "bbq", "pork"]
```

---

# 8. 현재 코드에 없는 DB key 확인

## 8.1 실행 SQL

```sql
with valid_keys(key) as (
  values
    ('bbq'),
    ('noodle'),
    ('stew'),
    ('seafood'),
    ('chicken'),
    ('street'),
    ('cafe'),
    ('rice'),
    ('pork'),
    ('chinese'),
    ('japanese'),
    ('western'),
    ('pasta'),
    ('pizza'),
    ('burger'),
    ('indian'),
    ('southeast_asian'),
    ('other')
),
used_keys as (
  select distinct
    unnest(coalesce(matgil_category_keys, array[]::text[])) as key
  from public.mg_places
)
select u.key
from used_keys u
left join valid_keys v on v.key = u.key
where v.key is null
order by u.key;
```

## 8.2 조회 결과

```text
Success. No rows returned.
```

## 8.3 해석

현재 DB에서 사용하는 모든 category key는 현재 프론트 코드에 정의된 18개 실제 key와 일치한다.

다음과 같은 오탈자나 미등록 key는 발견되지 않았다.

```text
barbecue
bbq_food
noodles
south_east_asian
all
unknown
```

따라서 신규 음식 카테고리 테이블을 만들 때 현재 18개 key를 그대로 seed하면 기존 데이터와 일치한다.

---

# 9. `mg_places` 인덱스 확인

## 9.1 실행 SQL

```sql
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'mg_places'
order by indexname;
```

## 9.2 조회 결과

| 인덱스                                  | 종류 및 대상                                    |
| ------------------------------------ | ------------------------------------------ |
| `idx_mg_places_active`               | B-tree, `is_active`                        |
| `idx_mg_places_ldong`                | B-tree, `ldong_regn_cd`, `ldong_signgu_cd` |
| `idx_mg_places_location`             | B-tree, `latitude`, `longitude`            |
| `idx_mg_places_matgil_category_keys` | GIN, `matgil_category_keys`                |
| `idx_mg_places_type`                 | B-tree, `place_type`                       |
| `mg_places_pkey`                     | Unique B-tree, `id`                        |

## 9.3 핵심 확인

음식 카테고리 배열에는 이미 GIN 인덱스가 존재한다.

```sql
CREATE INDEX idx_mg_places_matgil_category_keys
ON public.mg_places
USING gin (matgil_category_keys);
```

따라서 현재 배열 기반 카테고리 검색 성능을 위한 기본 인덱스는 갖춰져 있다.

신규 관리 테이블을 도입하더라도 `matgil_category_keys`를 즉시 삭제할 이유는 없다.

---

# 10. RLS 활성화 상태

## 10.1 실행 SQL

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'mg_places',
    'mg_saved_courses'
  )
order by c.relname;
```

## 10.2 조회 결과

| 테이블                | RLS 활성화 | Force RLS |
| ------------------ | ------- | --------- |
| `mg_places`        | true    | false     |
| `mg_saved_courses` | true    | false     |

## 10.3 해석

두 테이블 모두 Row Level Security가 활성화되어 있다.

`force_rls=false`는 테이블 소유자나 service role까지 RLS를 강제로 적용하는 설정은 아니라는 뜻이다.

일반 프론트의 anon/authenticated 요청에는 아래 정책이 적용된다.

---

# 11. 실제 RLS 정책

## 11.1 실행 SQL

```sql
select
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'mg_places',
    'mg_saved_courses'
  )
order by tablename, policyname;
```

## 11.2 `mg_places`

### 정책

```text
정책명:
public read mg_places

명령:
SELECT

대상 역할:
anon, authenticated

조회 조건:
is_active = true
```

### 해석

일반 사용자와 로그인 사용자는 활성 장소만 조회할 수 있다.

현재 확인된 정책에는 INSERT, UPDATE, DELETE가 없다.

따라서 일반 프론트 사용자에게 `mg_places` 쓰기 권한을 열어 둔 구조는 확인되지 않는다.

---

## 11.3 `mg_saved_courses`

### INSERT 정책

```text
정책명:
insert own saved courses

대상:
authenticated

조건:
user_id = auth.uid()
```

### SELECT 정책

```text
정책명:
read own saved courses

대상:
authenticated

조건:
user_id = auth.uid()
```

### UPDATE 정책

```text
정책명:
update own saved courses

대상:
authenticated

사용 조건:
user_id = auth.uid()

저장 후 조건:
user_id = auth.uid()
```

### 해석

로그인 사용자는 자기 저장 코스만 생성·조회·수정할 수 있다.

DELETE 정책은 없다.

현재 저장 코스 삭제 기능은 row 삭제가 아니라 다음 컬럼을 갱신하는 soft delete 방식이다.

```text
deleted_at
deleted_by
updated_at
```

---

# 12. 저장 코스 snapshot 확인

## 12.1 실행 SQL

```sql
select
  id,
  locale,
  title,
  place_ids,
  stops,
  course_snapshot
from public.mg_saved_courses
where deleted_at is null
order by created_at desc
limit 2;
```

## 12.2 조회한 저장 코스

### 코스 1

```text
locale:
en

title:
Dongdaemun Food Walk

place_ids:
204, 117, 662
```

카테고리:

```text
204:
stew

117:
bbq, western

662:
street
```

### 코스 2

```text
locale:
en

title:
Seoul City Hall Cafe & Bites

place_ids:
477, 176, 527
```

카테고리:

```text
477:
stew

176:
bbq, noodle, stew

527:
cafe
```

## 12.3 snapshot 내부 저장 구조

`mg_saved_courses.stops`와 `course_snapshot.stops` 양쪽에 모두 장소 정보와 `matgilCategoryKeys`가 저장되어 있다.

대표 구조:

```json
{
  "id": 176,
  "name": "Nampomyeonok (남포면옥)",
  "nameKo": "남포면옥",
  "address": "24 Euljiro 3-gil, Jung-gu, Seoul",
  "latitude": 37.5672330058385,
  "longitude": 126.98158779132,
  "matgilCategoryKeys": [
    "bbq",
    "noodle",
    "stew"
  ]
}
```

## 12.4 카테고리 DB 전환 시 의미

기존 저장 코스에는 카테고리 label 문자열이 아니라 category key 배열이 저장되어 있다.

따라서 다음 방식은 기존 snapshot과 호환된다.

```text
bbq key:
유지

한국어 label:
한국식 BBQ → 고기 구이

영어 label:
Korean BBQ 유지
```

반대로 key 자체를 다음처럼 변경하면 과거 snapshot을 해석하지 못할 수 있다.

```text
bbq → grilled_meat
```

따라서 기존 18개 key는 안정적인 시스템 식별자로 취급하고 생성 후 이름을 변경하지 않는 정책이 필요하다.

---

# 13. 현재 상태에 대한 확정 결론

## 13.1 현재 카테고리 저장 구조

현재 음식점과 음식 카테고리의 관계는 별도 관계 테이블이 아니라 다음 배열 컬럼으로 저장된다.

```text
mg_places.matgil_category_keys text[]
```

한 장소에 여러 key를 저장할 수 있다.

## 13.2 데이터 무결성 상태

현재 1,633개 장소 기준:

```text
NULL:
0건

빈 배열:
0건

배열 내 중복:
0건

코드에 없는 key:
0건
```

현재 데이터는 신규 카테고리 관리 테이블의 초기 seed와 비교 기준으로 사용할 수 있는 상태다.

## 13.3 기존 key 호환성

현재 실제 사용 key 18개는 모두 프론트 코드와 일치한다.

```text
all은 DB에 없음
other는 실제 DB key
```

`all`은 앞으로도 전체 선택을 의미하는 프론트 가상 옵션으로 유지하는 것이 적절하다.

## 13.4 현재 배열 컬럼 유지 필요

`matgil_category_keys`는 다음 기능이 사용하고 있다.

```text
- 음식 카테고리 필터
- 추천 코스 후보 필터링
- 코스 점수 계산
- 코스 제목 생성
- 장소 상세 표시
- 저장 코스 snapshot
- TourAPI 신규 장소 자동 분류
```

신규 관리 테이블을 추가하더라도 이 배열을 즉시 삭제하거나 타입을 변경하면 안 된다.

초기 전환은 기존 key 배열과 100% 호환되는 방식으로 진행해야 한다.

## 13.5 `other` 데이터 검수 필요성

`other`는 612건으로 가장 많다.

현재 전체 장소 수는 1,633건이므로 상당수의 장소가 구체적인 Food Type으로 분류되지 않은 상태다.

이는 신규 테이블 생성 자체와는 별개 문제지만 다음 기능을 만들 때 중요한 검수 대상이 된다.

```text
- 자동 분류 규칙 관리
- 기존 장소 재분류
- 관리자 직접 카테고리 지정
- 미분류 장소 관리 화면
```

---

# 14. 신규 DB 구조 설계 시 지켜야 할 조건

이번 조회 결과를 기준으로 이후 음식 카테고리 DB 구조는 최소한 다음 조건을 만족해야 한다.

## 14.1 기존 key 유지

```text
bbq
noodle
stew
seafood
chicken
street
cafe
rice
pork
chinese
japanese
western
pasta
pizza
burger
indian
southeast_asian
other
```

기존 key는 과거 장소 데이터와 저장 코스 snapshot의 식별자이므로 변경하지 않는다.

## 14.2 표시 이름과 시스템 key 분리

예:

```text
시스템 key:
bbq

영어 표시:
Korean BBQ

한국어 표시:
고기 구이
```

관리자는 번역 label을 수정할 수 있어야 하지만 `bbq` key를 수정하면 안 된다.

## 14.3 다국어 번역 행 구조 고려

향후 지원 언어가 추가될 수 있으므로 다음처럼 컬럼을 계속 추가하는 방식은 피하는 것이 적절하다.

```text
label_en
label_ko
label_ja
label_zh
```

권장 방향은 category 본체와 번역 테이블을 분리하는 것이다.

예상 구조:

```text
mg_food_categories
mg_food_category_translations
```

이 문서에서는 실제 DDL을 확정하지 않는다.

## 14.4 기존 배열 컬럼 즉시 삭제 금지

신규 테이블 도입 후에도 초기에는 다음 컬럼을 유지한다.

```text
mg_places.matgil_category_keys
```

필터, 추천 코스, 저장 코스가 기존 key 배열을 계속 사용할 수 있도록 하위 호환성을 유지한다.

## 14.5 `all` 저장 금지

`all`은 카테고리가 아니라 필터 전체 선택값이다.

신규 음식 카테고리 테이블이나 `matgil_category_keys`에는 저장하지 않는다.

## 14.6 `other` 삭제 금지

`other`는 실제로 612개 장소가 사용하고 있는 fallback key다.

새 분류 구조가 완전히 안정화되기 전에는 삭제하거나 이름을 변경하지 않는다.

## 14.7 hard delete 지양

카테고리를 실제 삭제하면 기존 장소 데이터와 저장 코스 snapshot에 고아 key가 남을 수 있다.

관리 기능에서는 다음 방식이 적절하다.

```text
is_active = false
```

비활성화한 카테고리는 신규 필터 목록에서 제외하되, 과거 데이터와 snapshot의 label은 계속 해석할 수 있어야 한다.

---

# 15. 아직 확정하지 않은 사항

다음 사항은 이번 DB 조회만으로 확정하지 않는다.

## 15.1 자동 분류 규칙의 최종 구조

현재 `mg-tour-seed`의 키워드 분류 규칙은 코드에 하드코딩되어 있다.

이후 설계 전에 실제 함수의 키워드 원문을 다시 읽어야 한다.

확인 대상:

```text
supabase/functions/mg-tour-seed/index.ts
classifyMatgilCategories
카테고리별 현재 키워드
other 처리 조건
복수 카테고리 판정 방식
```

## 15.2 관리자 인증 구조

카테고리 관리 UI를 만들려면 관리자 권한의 서버 측 기준이 필요하다.

현재 후보:

```text
Supabase app_metadata.role
별도 관리자 테이블
```

`user_metadata`는 사용자가 수정할 수 있으므로 관리자 권한 기준으로 사용하면 안 된다.

## 15.3 음식점별 직접 분류 구조

관리자가 특정 음식점의 카테고리를 직접 추가·해제하게 하려면 장기적으로 관계 테이블이 필요할 수 있다.

예상 후보:

```text
mg_place_food_categories
```

하지만 현재 배열 컬럼과 관계 테이블을 어떻게 동기화할지는 아직 결정하지 않았다.

## 15.4 자동 분류 규칙 관리자화 범위

다음 기능을 1차 작업에 포함할지 2차로 분리할지 결정이 필요하다.

```text
- 카테고리 label 관리
- 카테고리 순서 관리
- 활성·비활성 관리
- 아이콘 관리
- 음식점 직접 분류
- 자동 분류 키워드 관리
- 기존 장소 재분류
```

---

# 16. 추가 조회 필요 여부

## 16.1 현재 문서 작성 기준

현재 음식 카테고리 DB 상태를 기록하는 데 필요한 Supabase 조회 결과는 모두 확보했다.

추가 SQL은 필요하지 않다.

## 16.2 실제 마이그레이션 직전

실제 신규 테이블 DDL과 seed SQL을 실행하기 전에는 다음을 다시 확인해야 한다.

```text
1. mg-tour-seed의 실제 키워드 원문
2. 현재 코드의 전체 카테고리 key 참조 위치
3. 신규 테이블명과 번역 테이블 구조
4. 관리자 권한 모델
5. 기존 배열과 신규 구조의 동기화 방식
6. reclassify 작업의 dry-run 방식
7. rollback 방식
```

이 항목들은 추가 Supabase 조회가 아니라 코드 및 정책 결정 영역이다.

---

# 17. 현재 단계에서 실행하지 않을 작업

아래 작업은 최종 설계와 마이그레이션 계획이 확정되기 전에는 실행하지 않는다.

```text
- 기존 matgil_category_keys UPDATE
- 기존 category key 이름 변경
- 기존 category key 삭제
- mg_places 컬럼 삭제
- 신규 카테고리 테이블 생성
- 기존 장소 재분류
- mg-tour-seed 수정 및 배포
- 관리자 RLS 정책 생성
- public.is_admin() 함수 생성
- 프론트 CATEGORIES 제거
- 저장 코스 snapshot 일괄 수정
```

---

# 18. 최종 요약

현재 음식 카테고리는 별도 관리 테이블 없이 다음 배열에 저장되어 있다.

```text
public.mg_places.matgil_category_keys text[]
```

현재 데이터 상태는 정상이다.

```text
전체 장소:
1,633건

실제 key:
18개

NULL:
0건

빈 배열:
0건

중복:
0건

미등록 key:
0건

GIN 인덱스:
존재
```

기존 저장 코스의 `stops`와 `course_snapshot`에도 동일한 category key 배열이 저장되어 있다.

따라서 이후 DB 전환의 핵심 원칙은 다음과 같다.

```text
1. 기존 18개 key를 유지한다.
2. key와 다국어 표시 label을 분리한다.
3. bbq의 한국어 label은 고기 구이로 변경한다.
4. all은 DB에 저장하지 않는다.
5. other는 기존 데이터 호환을 위해 유지한다.
6. matgil_category_keys는 초기 단계에서 삭제하지 않는다.
7. 관리자가 label을 변경해도 기존 장소와 저장 코스가 깨지지 않게 한다.
8. 신규 테이블 적용 전 dry-run·검증·rollback 계획을 먼저 확정한다.
```
