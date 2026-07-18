# saved course db structure and duplicate prevention

## 작업 일시

- 일자: 2026-07-18
- 시각: 14:25 KST
- 작업 대상: 맛길(Matgil) 저장 장소·저장 동선 DB 구조 보강
- 작업 범위: 가게 저장 수 집계, 저장 장소 중복 방지 확인, 저장 동선 중복 방지, 다국어·기준 위치·취향 저장을 위한 컬럼 준비

---

## 1. 작업 배경

저장 동선 상세 화면을 점검하는 과정에서 다음 개선 필요사항을 확인했다.

1. 가게 별점 옆에 리뷰 개수를 표시할 필요가 있음
2. 각 가게를 몇 명이 저장했는지 `♥ 2` 형태로 표시할 필요가 있음
3. 동일 사용자가 같은 가게를 여러 번 저장하지 못하게 해야 함
4. 동선에 포함된 가게 구성이 같다면 순서가 달라도 동일 동선으로 판단해야 함
5. 저장 당시 선택한 위치와 취향을 구조화하여 저장해야 함
6. 저장 당시 언어와 현재 화면 언어가 달라도 제목·기준 위치·취향이 현재 언어에 맞게 표시되어야 함
7. `선택한 지역 맛집 동선`, `Seoul City Hall`처럼 저장 당시의 완성된 문구를 그대로 표시하는 현재 구조를 개선해야 함

이번 작업에서는 애플리케이션 코드를 수정하지 않고, 향후 구현에 필요한 DB 구조를 우선 점검하고 보강했다.

---

## 2. 기존 저장 장소 구조 확인

저장 장소 테이블은 다음 테이블이다.

    public.mg_place_bookmarks

기존 컬럼 구조:

| 컬럼 | 타입 | NULL 허용 | 기본값 |
|---|---|---:|---|
| `user_id` | `uuid` | 아니요 | 없음 |
| `place_id` | `bigint` | 아니요 | 없음 |
| `created_at` | `timestamptz` | 아니요 | `now()` |

기존 제약조건:

    PRIMARY KEY (user_id, place_id)

외래키:

    place_id → public.mg_places(id) ON DELETE CASCADE
    user_id → auth.users(id) ON DELETE CASCADE

확인 결과 동일한 `(user_id, place_id)` 조합의 중복 데이터는 없었다.

    select
        user_id,
        place_id,
        count(*) as duplicate_count
    from public.mg_place_bookmarks
    group by user_id, place_id
    having count(*) > 1;

결과:

    No rows returned

### 결론

`PRIMARY KEY (user_id, place_id)`가 이미 존재하므로 같은 사용자가 같은 가게를 두 번 저장할 수 없다.

따라서 별도의 중복 방지 UNIQUE 인덱스는 추가하지 않았다.

---

## 3. 가게별 저장 수 집계 View 생성

가게를 저장한 사용자들의 신원은 공개하지 않고, 저장한 사용자 수만 화면에 표시하기 위해 다음 View를 생성했다.

    create or replace view public.mg_place_bookmark_stats
    with (security_invoker = true)
    as
    select
        place_id,
        count(*)::integer as save_count
    from public.mg_place_bookmarks
    group by place_id;

    grant select on public.mg_place_bookmark_stats
    to anon, authenticated;

조회 확인:

    select *
    from public.mg_place_bookmark_stats
    order by save_count desc, place_id;

확인 결과:

| place_id | save_count |
|---:|---:|
| 176 | 1 |
| 477 | 1 |
| 527 | 1 |

`mg_place_bookmarks`는 사용자당 같은 장소를 한 번만 저장할 수 있으므로, `count(*)`는 해당 가게를 저장한 고유 사용자 수와 동일하다.

이 View에서는 사용자 ID나 사용자 목록을 반환하지 않는다.

향후 화면 표시 예시:

    ★ 4.6 (2) · ♥ 3 · 241 m

- `4.6`: 평균 별점
- `(2)`: 리뷰 개수
- `♥ 3`: 해당 가게를 저장한 사용자 수
- `241 m`: 기준 위치에서 가게까지의 거리

기본적으로 한 줄로 표시하고, 화면 폭이 매우 좁은 경우에만 거리 부분을 다음 줄로 내리는 방향으로 구현한다.

---

## 4. 기존 저장 동선 구조 확인

저장 동선 테이블은 다음 테이블이다.

    public.mg_saved_courses

기존 주요 컬럼:

| 컬럼 | 용도 |
|---|---|
| `id` | 저장 동선 ID |
| `user_id` | 저장 사용자 |
| `locale` | 저장 당시 언어 |
| `title` | 저장 당시 완성된 제목 |
| `subtitle` | 부제목 |
| `description` | 설명 |
| `anchor_label` | 저장 당시 기준 위치 문구 |
| `total_distance_m` | 전체 거리 |
| `total_duration_min` | 예상 이동 시간 |
| `stop_count` | 가게 수 |
| `place_ids` | 포함된 가게 ID 배열 |
| `stops` | 가게 정보 JSON |
| `course_snapshot` | 저장 당시 동선 전체 JSON |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |
| `deleted_at` | 소프트 삭제 시각 |
| `deleted_by` | 삭제 사용자 |

기존 저장 데이터는 다음과 같은 문제가 있었다.

    title: 선택한 지역 맛집 동선
    anchor_label: 선택한 지역

또는:

    title: Seoul City Hall Cafe & Bites
    anchor_label: Seoul City Hall

이 값들은 저장 당시 언어로 이미 완성된 문자열이므로, 화면 언어를 바꿔도 자동으로 번역할 수 없다.

또한 지도에서 임의 지점을 선택한 최근 데이터는 다음과 같이 저장되어 있었다.

    anchor_source: map
    anchor_lat: 저장됨
    anchor_lng: 저장됨
    anchor_address: null
    anchor_label: 선택한 지역

즉 지도 중심 좌표는 저장됐지만 역지오코딩된 주소나 지역명은 저장되지 않았다.

---

## 5. 취향 정보 저장 여부 확인

기존 `course_snapshot`의 전체 키를 확인했다.

확인된 키:

    accent
    anchor_address
    anchor_label
    anchor_lat
    anchor_lng
    anchor_source
    hr
    id
    km
    normalizedMetrics
    routeDistanceLevel
    score
    stopCount
    stops
    title
    totalDistanceKm

취향 관련 키를 검색했다.

    select
        id,
        title,
        course_snapshot
    from public.mg_saved_courses
    where deleted_at is null
      and (
          course_snapshot::text ilike '%preference%'
          or course_snapshot::text ilike '%taste%'
          or course_snapshot::text ilike '%theme%'
          or course_snapshot::text ilike '%filter%'
      )
    order by created_at desc;

결과:

    No rows returned

### 결론

현재 저장 동선에는 사용자가 동선 생성 시 선택했던 취향·필터 정보가 구조화되어 저장되지 않는다.

`고기 구이 동선` 등의 문구가 제목에 포함된 경우는 있지만, 이는 저장 당시 생성된 문자열일 뿐 다국어 변환이나 상세 표시를 위한 취향 원본 데이터가 아니다.

---

## 6. 저장 동선 신규 컬럼 추가

다국어 제목 생성, 기준 위치 보존, 취향 표시, 중복 동선 판별을 위해 다음 컬럼을 `mg_saved_courses`에 추가했다.

    alter table public.mg_saved_courses
        add column if not exists anchor_type text,
        add column if not exists anchor_key text,
        add column if not exists anchor_name_original text,
        add column if not exists anchor_area_original text,
        add column if not exists anchor_address_original text,
        add column if not exists anchor_lat double precision,
        add column if not exists anchor_lng double precision,
        add column if not exists preference_keys text[] not null default '{}'::text[],
        add column if not exists course_theme_key text,
        add column if not exists route_signature text,
        add column if not exists title_schema_version smallint not null default 1;

### 컬럼별 목적

#### `anchor_type`

기준 위치의 생성 방식을 저장한다.

허용 예정 값:

    preset
    search
    map
    gps

- `preset`: 서울시청, 동대문 같은 앱 기본 위치
- `search`: 카카오맵 등에서 장소나 주소를 검색하여 선택
- `map`: 지도 이동 후 현재 지도 중심을 선택
- `gps`: 현재 위치 사용

#### `anchor_key`

프리셋 위치의 번역 키를 저장한다.

예:

    seoul_city_hall
    dongdaemun

화면에서는 현재 언어에 따라 번역한다.

    ko: 서울시청
    en: Seoul City Hall
    ja: ソウル市庁

#### `anchor_name_original`

검색 결과로 선택한 건물·장소의 원래 명칭을 저장한다.

예:

    서울시청
    광화문광장
    코엑스

#### `anchor_area_original`

제목에 사용할 수 있는 대표 지역명을 저장한다.

예:

    광화문 일대
    중구 일대
    동대문 일대

전체 주소보다 짧고 제목에 사용하기 적합한 지역 표현이다.

#### `anchor_address_original`

검색 또는 역지오코딩으로 얻은 전체 주소를 저장한다.

예:

    서울특별시 중구 세종대로 110

#### `anchor_lat`, `anchor_lng`

저장 당시 기준 위치의 위도와 경도를 저장한다.

#### `preference_keys`

사용자가 동선 생성 시 선택한 취향을 번역 가능한 키 배열로 저장한다.

예:

    {bbq,pork}

화면 표시:

    ko: 선택 취향: 고기 구이 · 돼지고기
    en: Preferences: BBQ · Pork
    ja: 選択した好み: 焼肉・豚肉

#### `course_theme_key`

동선 제목에 사용할 대표 테마 키를 저장한다.

예:

    bbq
    cafe
    noodle
    seafood

#### `route_signature`

동선에 포함된 가게 ID들을 정렬한 중복 판별용 문자열이다.

예:

    place_ids: [477, 176, 527]
    route_signature: 176-477-527

가게 순서가 달라도 포함된 가게가 같으면 동일한 값이 된다.

#### `title_schema_version`

동선 제목 생성 방식의 버전을 구분한다.

    1: 기존 저장 문자열 기반
    2: 구조화된 위치·취향 키 기반 다국어 제목

기존 데이터는 기본값 `1`을 유지하고, 향후 신규 저장 데이터는 애플리케이션에서 `2`로 저장할 예정이다.

---

## 7. 저장 동선 값 제한 조건 추가

`anchor_type`에 허용되지 않은 값이 저장되지 않도록 제약조건을 추가했다.

    alter table public.mg_saved_courses
        drop constraint if exists chk_mg_saved_courses_anchor_type;

    alter table public.mg_saved_courses
        add constraint chk_mg_saved_courses_anchor_type
        check (
            anchor_type is null
            or anchor_type in ('preset', 'search', 'map', 'gps')
        );

위도 범위 제약:

    alter table public.mg_saved_courses
        drop constraint if exists chk_mg_saved_courses_anchor_lat;

    alter table public.mg_saved_courses
        add constraint chk_mg_saved_courses_anchor_lat
        check (
            anchor_lat is null
            or anchor_lat between -90 and 90
        );

경도 범위 제약:

    alter table public.mg_saved_courses
        drop constraint if exists chk_mg_saved_courses_anchor_lng;

    alter table public.mg_saved_courses
        add constraint chk_mg_saved_courses_anchor_lng
        check (
            anchor_lng is null
            or anchor_lng between -180 and 180
        );

모든 DDL은 정상 실행됐다.

---

## 8. 기존 저장 동선의 route_signature 생성

기존 데이터의 `place_ids`를 정렬하고 중복을 제거하여 `route_signature`에 저장했다.

    update public.mg_saved_courses c
    set route_signature = (
        select string_agg(place_id::text, '-' order by place_id)
        from (
            select distinct unnest(c.place_ids) as place_id
        ) ids
    )
    where c.route_signature is null
      and coalesce(array_length(c.place_ids, 1), 0) > 0;

생성 예시:

    [980, 92, 477]
    → 92-477-980

    [951, 571, 546]
    → 546-571-951

    [477, 176, 527]
    → 176-477-527

기존 동선의 실제 방문 순서는 `place_ids`와 `stops`에 그대로 보존된다.

`route_signature`만 중복 판별을 위해 정렬된 값을 사용한다.

---

## 9. 기존 활성 동선 중복 확인

같은 사용자가 동일한 `route_signature`를 가진 활성 동선을 여러 개 저장했는지 확인했다.

    select
        user_id,
        route_signature,
        count(*) as duplicate_count,
        array_agg(id order by created_at) as course_ids
    from public.mg_saved_courses
    where deleted_at is null
      and route_signature is not null
    group by user_id, route_signature
    having count(*) > 1;

결과:

    No rows returned

활성 상태의 중복 동선은 없었다.

같은 사용자의 동일 동선이 두 개 존재하는 사례는 있었지만, 한 행은 `deleted_at`이 존재하는 소프트 삭제 데이터였으므로 활성 동선 중복에는 해당하지 않았다.

---

## 10. 저장 동선 중복 방지 UNIQUE 인덱스 생성

활성 상태의 저장 동선에 대해 다음 UNIQUE 인덱스를 생성했다.

    create unique index if not exists uq_mg_saved_courses_user_route_signature_active
    on public.mg_saved_courses (user_id, route_signature)
    where deleted_at is null
      and route_signature is not null;

생성 확인 결과:

    CREATE UNIQUE INDEX uq_mg_saved_courses_user_route_signature_active
    ON public.mg_saved_courses
    USING btree (user_id, route_signature)
    WHERE (
        deleted_at IS NULL
        AND route_signature IS NOT NULL
    )

### 중복 판정 규칙

다음 두 동선은 동일한 동선으로 판단한다.

    사용자 A
    [176, 477, 527]

    사용자 A
    [527, 176, 477]

두 동선의 `route_signature`는 모두 다음과 같다.

    176-477-527

따라서 두 번째 저장은 DB에서 거부된다.

다른 사용자가 같은 가게 구성의 동선을 저장하는 것은 허용된다.

    사용자 A + 176-477-527 → 허용
    사용자 B + 176-477-527 → 허용

소프트 삭제된 동선은 UNIQUE 인덱스 대상에서 제외된다.

따라서 사용자가 저장 동선을 삭제한 뒤 같은 동선을 다시 저장하는 것은 허용된다.

---

## 11. 현재까지 완료된 DB 작업

### 저장 장소

- `mg_place_bookmarks` 구조 확인
- 사용자당 같은 가게 한 번만 저장되는 것 확인
- 중복 데이터 없음 확인
- 별도 중복 방지 인덱스 불필요 판단
- `mg_place_bookmark_stats` View 생성
- 사용자 정보 없이 가게별 저장 수 조회 가능

### 저장 동선

- 다국어 및 기준 위치 저장용 컬럼 추가
- 취향 키 저장용 컬럼 추가
- 대표 동선 테마 저장용 컬럼 추가
- 동선 중복 판별용 `route_signature` 추가
- 제목 구조 버전 컬럼 추가
- 기준 위치 종류 및 좌표 제약조건 추가
- 기존 데이터의 `route_signature` 생성
- 활성 중복 동선 없음 확인
- 사용자별 동일 가게 구성 동선 중복 방지 UNIQUE 인덱스 생성

---

## 12. 아직 구현되지 않은 부분

현재는 DB 구조만 준비된 상태다.

애플리케이션에서는 아직 다음 신규 컬럼을 자동으로 채우지 않는다.

    anchor_type
    anchor_key
    anchor_name_original
    anchor_area_original
    anchor_address_original
    anchor_lat
    anchor_lng
    preference_keys
    course_theme_key
    route_signature
    title_schema_version

따라서 다음 단계에서 프론트엔드와 Supabase 저장 로직을 수정해야 한다.

---

## 13. 향후 애플리케이션 구현 계획

### 13.1 신규 동선 저장

동선 저장 시 다음 값을 저장한다.

    anchor_type
    anchor_key
    anchor_name_original
    anchor_area_original
    anchor_address_original
    anchor_lat
    anchor_lng
    preference_keys
    course_theme_key
    route_signature
    title_schema_version = 2

`route_signature`는 `place_ids`의 중복을 제거한 뒤 오름차순 정렬하여 생성한다.

예:

    [980, 92, 477]
    → 92-477-980

DB UNIQUE 인덱스가 최종적으로 중복 저장을 차단한다.

중복 저장 오류는 사용자에게 다음과 같이 표시한다.

    이미 저장된 동선입니다.
    This route is already saved.

### 13.2 지도 임의 위치 처리

현재 `map` 방식은 좌표만 저장하고 주소가 `null`이다.

향후 지도 중심 위치를 선택할 때 역지오코딩을 수행하여 다음을 저장한다.

    anchor_type: map
    anchor_area_original: 광화문 일대
    anchor_address_original: 서울특별시 중구 세종대로 일대
    anchor_lat: 기준 위도
    anchor_lng: 기준 경도

`선택한 지역`은 저장 데이터의 실제 위치명으로 사용하지 않는다.

`선택한 지역`은 위치 정보를 불러오는 동안 사용하는 임시 UI 문구로만 취급한다.

### 13.3 검색 장소 처리

카카오맵 등에서 건물이나 장소를 검색해 선택한 경우 다음을 저장한다.

    anchor_type: search
    anchor_name_original: 서울시청
    anchor_area_original: 서울시청 일대
    anchor_address_original: 서울특별시 중구 세종대로 110
    anchor_lat
    anchor_lng

특정 지도 서비스에 종속된 이름을 핵심 컬럼명에 사용하지 않는다.

예를 들어 다음 이름은 사용하지 않는다.

    kakao_address
    kakao_lat
    kakao_place_name

지도 제공자 변경에도 유지할 수 있도록 일반적인 이름을 사용한다.

### 13.4 프리셋 위치 처리

서울시청, 동대문 같은 앱 프리셋 위치는 번역된 문자열 대신 키를 저장한다.

    anchor_type: preset
    anchor_key: seoul_city_hall

현재 언어에 따라 표시한다.

    ko: 서울시청
    en: Seoul City Hall
    ja: ソウル市庁

### 13.5 현재 위치 처리

GPS 기준 동선은 다음과 같이 저장한다.

    anchor_type: gps
    anchor_lat
    anchor_lng
    anchor_area_original
    anchor_address_original

가능한 경우 역지오코딩 결과를 저장한다.

`현재 위치`, `Current location` 같은 문구를 저장 제목의 실제 위치명으로 사용하지 않는다.

---

## 14. 다국어 제목 생성 원칙

신규 동선은 완성된 번역 제목을 데이터의 원본으로 사용하지 않는다.

DB에는 제목을 만들기 위한 구조화된 값을 저장한다.

    anchor_key 또는 anchor_area_original
    course_theme_key
    preference_keys

화면에서는 현재 선택된 언어에 맞춰 제목을 조합한다.

예:

    ko: 광화문 일대 고기 구이 동선
    en: Gwanghwamun Area BBQ Walk
    ja: 光化門周辺 焼肉コース

언어를 바꾸면 저장 당시 언어와 관계없이 현재 언어로 다시 생성한다.

### 제목 생성 우선순위

1. 번역 가능한 프리셋 위치명
2. 검색 결과 장소명
3. 역지오코딩된 지역명 또는 `~ 일대`
4. 동선 가게들의 주소에서 얻은 공통 지역명
5. 대표 취향 또는 테마

최종 제목 구조:

    [지역명] + [취향 또는 테마] + [동선 문구]

예:

    광화문 일대 고기 구이 동선
    중구 카페 동선
    동대문 면 요리 동선

지역명이 전혀 없는 경우에도 전부 같은 `추천 맛집 동선`으로 만들지 않는다.

취향 또는 대표 테마를 사용한다.

예:

    고기 구이 추천 동선
    카페와 디저트 동선
    면 요리 추천 동선

---

## 15. 저장 동선 상세 화면 계획

저장 동선 상세 제목 아래에 다음 정보를 표시한다.

    광화문 일대 고기 구이 동선
    기준 위치: 광화문 일대
    선택 취향: 고기 구이 · 돼지고기

영어:

    Gwanghwamun Area BBQ Walk
    Starting point: Gwanghwamun Area
    Preferences: BBQ · Pork

`기준 위치`, `Starting point`, `선택 취향`, `Preferences`는 i18n 번역 키로 관리한다.

저장 당시 언어가 영어였더라도 현재 한국어 화면에서는 한국어로 표시되어야 한다.

기존 데이터는 구조화된 값이 부족하므로 다음 fallback을 사용한다.

1. 알려진 프리셋 문자열은 번역 키로 변환
2. `선택한 지역`, `Selected area`는 그대로 표시하지 않음
3. 가능한 경우 저장된 가게 주소에서 공통 지역명을 계산
4. 정확히 복원할 수 없는 값은 억지로 번역하거나 추정하지 않음

---

## 16. 별점·리뷰 수·저장 수 표시 계획

동선 상세의 가게 카드와 가게 상세 화면에서 다음 정보를 표시한다.

    ★ 4.6 (2) · ♥ 3 · 241 m

의미:

- `★ 4.6`: 평균 별점
- `(2)`: 리뷰 개수
- `♥ 3`: 저장한 사용자 수
- `241 m`: 기준 위치에서 가게까지의 거리

리뷰가 없는 경우:

    평점 없음 · ♥ 3 · 241 m
    No ratings · ♥ 3 · 241 m

기본은 한 줄 표시다.

화면 폭이 매우 좁아 내용이 들어가지 않는 경우에만 거리 부분을 다음 줄로 내린다.

    ★ 4.6 (2) · ♥ 3
    241 m

가게 저장 수는 `mg_place_bookmark_stats`를 여러 장소에 대해 배치 조회한다.

사용자 ID나 저장한 사용자 목록은 화면에 전달하지 않는다.

---

## 17. Saved Courses 가게 상세 이동 계획

Saved Courses 동선 상세의 가게 카드는 클릭 가능한 전체 영역으로 만든다.

클릭 시 바텀시트가 아니라 전체 화면 가게 상세 페이지로 이동한다.

예:

    /saved-courses/:courseId
    → /places/:placeId

뒤로 가기 시 저장 동선 상세 화면으로 돌아온다.

저장 당시의 기준 위치를 가게 상세 화면에서 복원하거나 다시 표시할 필요는 없다.

가게 자체의 전체 상세 정보만 보여준다.

---

## 18. 기존 데이터 처리 원칙

기존 데이터에는 다음 값이 없을 수 있다.

    anchor_type
    anchor_key
    anchor_name_original
    anchor_area_original
    anchor_address_original
    preference_keys
    course_theme_key
    title_schema_version = 2

따라서 모든 신규 로직은 null-safe하게 구현해야 한다.

기존 데이터의 예:

    Seoul City Hall
    Dongdaemun
    선택한 지역
    Selected area
    현재 위치
    Current location

처리 원칙:

- `Seoul City Hall`: 현재 언어에 맞춰 알려진 프리셋으로 변환
- `Dongdaemun`: 현재 언어에 맞춰 알려진 프리셋으로 변환
- `선택한 지역`: 직접 표시하지 않음
- `Selected area`: 직접 표시하지 않음
- `현재 위치`: 직접 표시하지 않음
- `Current location`: 직접 표시하지 않음
- 가능한 경우 `stops.address`에서 공통 지역명을 추출
- 저장되지 않았던 정확한 위치나 취향은 임의로 만들어내지 않음

기존 데이터 마이그레이션은 가능한 범위에서만 수행한다.

---

## 19. 주의사항

- DB 구조는 준비됐지만 애플리케이션 코드는 아직 새 컬럼을 사용하지 않는다.
- 신규 동선 저장 시 `route_signature`를 반드시 채워야 UNIQUE 인덱스가 동작한다.
- `route_signature`가 `null`이면 현재 UNIQUE 인덱스의 중복 방지 대상이 아니다.
- 기존 `title`, `anchor_label`, `course_snapshot`은 하위 호환을 위해 삭제하지 않는다.
- 지도 임의 지점의 주소를 얻으려면 애플리케이션에서 역지오코딩 구현이 필요하다.
- 취향은 번역된 문자열이 아니라 키 배열로 저장해야 한다.
- 다국어 제목은 저장 문자열을 번역하는 방식이 아니라 구조화된 키로 다시 생성해야 한다.
- 사용자 신원이나 저장 사용자 목록은 가게 저장 수 API나 View에서 노출하지 않는다.

---

## 20. 최종 상태

이번 DB 작업은 정상 완료됐다.

완료된 객체:

    public.mg_place_bookmark_stats
    public.mg_saved_courses 신규 컬럼
    chk_mg_saved_courses_anchor_type
    chk_mg_saved_courses_anchor_lat
    chk_mg_saved_courses_anchor_lng
    uq_mg_saved_courses_user_route_signature_active

최종 중복 방지 정책:

    가게:
    PRIMARY KEY (user_id, place_id)

    저장 동선:
    UNIQUE (user_id, route_signature)
    WHERE deleted_at IS NULL
      AND route_signature IS NOT NULL

다음 단계는 현재 DB 구조를 기준으로 애플리케이션 저장·조회·다국어 표시 로직을 구현하는 것이다.