# 맛길 Supabase DB 설계 DDL

## 6. DDL

Supabase는 PostgreSQL이니까 PostgreSQL 기준입니다.
이 문서는 DB 설계 참고용이다. 현재 실제 작업 기준은 04-current-task-supabase-place-integration.md를 우선한다.

## 0단계: 확장 기능

좌표 검색을 나중에 제대로 하려면 PostGIS가 좋지만, 지금은 필수 아닙니다.
Supabase 무료 프로젝트에서 extension 켤 수 있으면 나중에 켜세요.

일단은 `latitude`, `longitude` 숫자 컬럼으로 충분합니다.

---

## 1. 장소 기본 테이블: `mg_places`

```sql
create table public.mg_places (
  id bigserial primary key,

  primary_source varchar(50) not null default 'TOUR_API',
  place_type varchar(50) not null default 'restaurant',

  representative_source_id bigint,

  content_type_id varchar(30),

  latitude double precision,
  longitude double precision,

  area_code varchar(30),
  sigungu_code varchar(30),
  ldong_regn_cd varchar(30),
  ldong_signgu_cd varchar(30),

  category_code_1 varchar(50),
  category_code_2 varchar(50),
  category_code_3 varchar(50),

  food_category_code_1 varchar(50),
  food_category_code_2 varchar(50),
  food_category_code_3 varchar(50),

  default_image_url text,

  is_active boolean not null default true,

  data_quality_score int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mg_places_type on public.mg_places(place_type);
create index idx_mg_places_location on public.mg_places(latitude, longitude);
create index idx_mg_places_ldong on public.mg_places(ldong_regn_cd, ldong_signgu_cd);
create index idx_mg_places_active on public.mg_places(is_active);
```

여기에는 **언어 텍스트를 넣지 않습니다.**
장소의 뼈대만 넣습니다.

`representative_source_id`는 아래 `mg_place_sources.id`를 나중에 연결하려고 둔 겁니다. 순환 참조가 부담이면 안 써도 됩니다.

---

## 2. 외부 API 출처 테이블: `mg_place_sources`

이 테이블이 중요합니다.
TourAPI 국문, TourAPI 영문, 나중에 다른 API까지 전부 여기에 기록합니다.

```sql
create table public.mg_place_sources (
  id bigserial primary key,

  place_id bigint not null references public.mg_places(id) on delete cascade,

  source varchar(50) not null,
  source_language varchar(10),

  external_id varchar(150) not null,
  external_content_type_id varchar(30),

  source_url text,

  license_type varchar(100),
  attribution text,

  cache_policy varchar(30) not null default 'stored',
  fetched_at timestamptz not null default now(),
  source_modified_at timestamptz,
  expires_at timestamptz,

  raw_list jsonb,
  raw_intro jsonb,
  raw_common jsonb,
  raw_images jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source, source_language, external_id, external_content_type_id)
);

create index idx_mg_place_sources_place on public.mg_place_sources(place_id);
create index idx_mg_place_sources_external on public.mg_place_sources(source, external_id);
create index idx_mg_place_sources_fetched on public.mg_place_sources(fetched_at);
```

예:

```txt
source = TOUR_API_KO
source_language = ko
external_id = 2869760

source = TOUR_API_EN
source_language = en
external_id = 2869760 또는 영문 API의 contentid

source = GOOGLE_PLACES
source_language = null
external_id = ChIJxxxx
cache_policy = cache_only
```

`raw_list`, `raw_intro` 같은 원본 JSON을 저장해두면 나중에 로직을 다시 고칠 수 있습니다. 이거 없으면 나중에 진짜 피곤해집니다.

---

## 3. 장소 언어별 텍스트 테이블: `mg_place_texts`

여기가 한국어/영어 표시용 데이터입니다.

```sql
create table public.mg_place_texts (
  id bigserial primary key,

  place_id bigint not null references public.mg_places(id) on delete cascade,

  locale varchar(10) not null,

  name text not null,
  address text,
  description text,

  first_menu text,
  treat_menu text,
  open_time text,
  rest_date text,
  parking text,
  packing text,

  tags jsonb not null default '[]'::jsonb,

  translation_status varchar(30) not null default 'source',
  translation_provider varchar(50),
  translated_from_locale varchar(10),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (place_id, locale)
);

create index idx_mg_place_texts_locale on public.mg_place_texts(locale);
create index idx_mg_place_texts_name on public.mg_place_texts using gin (to_tsvector('simple', coalesce(name, '')));
```

`translation_status`는 이렇게 쓰면 됩니다.

```txt
source       API가 원래 준 언어
machine      기계번역/LLM 번역
manual       사람이 직접 수정
fallback     다른 언어 값을 임시로 보여줌
```

이게 지금 고민의 핵심 해결책입니다.

예를 들어 영문 없는 API에서 한국어만 받았다면:

```txt
mg_place_texts locale = ko, translation_status = source
mg_place_texts locale = en, translation_status = machine
```

TourAPI 영문에서 직접 받은 데이터라면:

```txt
mg_place_texts locale = en, translation_status = source
```

---

## 4. 음식점 상세 정보 테이블: `mg_place_food_details`

언어와 무관하거나, 검색/필터에 쓸 값을 저장합니다.

```sql
create table public.mg_place_food_details (
  id bigserial primary key,

  place_id bigint not null references public.mg_places(id) on delete cascade unique,

  tel varchar(100),

  has_parking boolean,
  has_packing boolean,
  has_open_time boolean not null default false,
  has_menu_info boolean not null default false,
  has_image boolean not null default false,
  has_location boolean not null default false,

  kids_facility boolean,
  smoking_info text,
  credit_card_info text,
  reservation_info text,
  license_no varchar(100),

  price_level int,
  is_halal_friendly boolean,
  is_vegetarian_friendly boolean,
  has_english_menu boolean,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mg_food_details_flags on public.mg_place_food_details(has_parking, has_packing, has_menu_info);
create index idx_mg_food_details_special on public.mg_place_food_details(is_halal_friendly, is_vegetarian_friendly, has_english_menu);
```

여기서 주의할 점:

```txt
is_halal_friendly
is_vegetarian_friendly
has_english_menu
price_level
```

이건 TourAPI에서 정확히 주는 값이 아닙니다.
그래서 일단 NULL로 두세요.

`false`가 아니라 `null`이 맞습니다.

```txt
true  = 확인됨
false = 확인 결과 아님
null  = 모름
```

모르는 걸 false로 저장하면 나중에 “할랄 아님”처럼 잘못 해석될 수 있습니다.

---

## 5. 이미지 테이블: `mg_place_images`

대표 이미지는 `mg_places.default_image_url`에 있어도 되지만, 여러 장을 고려하면 따로 둡니다.

```sql
create table public.mg_place_images (
  id bigserial primary key,

  place_id bigint not null references public.mg_places(id) on delete cascade,

  image_url text not null,
  thumbnail_url text,

  source varchar(50),
  license_type varchar(100),
  attribution text,

  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  unique (place_id, image_url)
);

create index idx_mg_place_images_place on public.mg_place_images(place_id);
```

이미지는 처음엔 **다운로드해서 Supabase Storage에 저장하지 말고 URL만 저장**하세요.
이미지 저작권/재배포 문제까지 끌고 오면 복잡해집니다.

---

## 6. 코스 테이블: `mg_courses`

```sql
create table public.mg_courses (
  id bigserial primary key,

  area_key varchar(100),
  course_type varchar(50) not null default 'food_walk',

  title_ko text not null,
  title_en text,

  description_ko text,
  description_en text,

  estimated_distance_m int,
  estimated_duration_min int,

  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mg_courses_area on public.mg_courses(area_key);
create index idx_mg_courses_published on public.mg_courses(is_published);
```

코스는 일단 수동/반자동 생성으로 가세요.

---

## 7. 코스-장소 연결 테이블: `mg_course_places`

```sql
create table public.mg_course_places (
  id bigserial primary key,

  course_id bigint not null references public.mg_courses(id) on delete cascade,
  place_id bigint not null references public.mg_places(id) on delete cascade,

  sequence_no int not null,

  note_ko text,
  note_en text,

  created_at timestamptz not null default now(),

  unique (course_id, sequence_no),
  unique (course_id, place_id)
);

create index idx_mg_course_places_course on public.mg_course_places(course_id);
create index idx_mg_course_places_place on public.mg_course_places(place_id);
```

---

## 8. 회화표현 테이블: `mg_phrases`

```sql
create table public.mg_phrases (
  id bigserial primary key,

  category varchar(100) not null,

  ko_text text not null,
  romanization text,
  en_text text,
  ja_text text,
  zh_text text,

  sort_order int not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mg_phrases_category on public.mg_phrases(category);
create index idx_mg_phrases_active on public.mg_phrases(is_active);
```

이건 정적 데이터라 간단하게 갑니다.

---

## 9. API 수집 로그 테이블: `mg_api_fetch_logs`

나중에 왜 데이터가 이상한지 확인하려면 로그가 필요합니다.

```sql
create table public.mg_api_fetch_logs (
  id bigserial primary key,

  source varchar(50) not null,
  endpoint varchar(100) not null,

  request_params jsonb,
  response_status int,
  result_code varchar(50),
  result_message text,

  success boolean not null default false,
  fetched_count int not null default 0,

  error_message text,

  fetched_at timestamptz not null default now()
);

create index idx_mg_api_fetch_logs_source on public.mg_api_fetch_logs(source, endpoint);
create index idx_mg_api_fetch_logs_fetched_at on public.mg_api_fetch_logs(fetched_at);
```

---

# 7. 이 설계가 나중에 문제를 줄이는 이유

## 1. 영문 API가 있는 경우

```txt
TourAPI KO 호출 → mg_place_texts(locale='ko', status='source')
TourAPI EN 호출 → mg_place_texts(locale='en', status='source')
```

깔끔합니다.

## 2. 영문 API가 없는 경우

```txt
다른 API KO 호출 → mg_place_texts(locale='ko', status='source')
LLM/번역 API 사용 → mg_place_texts(locale='en', status='machine')
```

나중에 사람이 수정하면:

```txt
translation_status='manual'
```

로 바꾸면 됩니다.

## 3. API마다 저장 정책이 다른 경우

`mg_place_sources.cache_policy`로 구분합니다.

```txt
stored      저장 가능
cache_only  일정 기간 캐시만 가능
reference   원본 링크/ID만 저장 권장
manual      직접 입력 데이터
```

이렇게 해두면 나중에 구글/네이버 같은 약관 까다로운 API를 붙일 때도 테이블을 엎지 않습니다.

## 4. 한 장소가 여러 API에 존재하는 경우

예:

```txt
TourAPI의 가담
Google Places의 Gadam
```

같은 장소라고 판단되면 둘 다 `mg_place_sources`에 붙이면 됩니다.

```txt
mg_places 1개
mg_place_sources 여러 개
```

---

# 8. “저장하는 게 맞냐, API 호출하는 게 맞냐” 최종 판단

지금 프로젝트 기준으로는 **저장하는 게 맞습니다.**

다만 이렇게 구분하세요.

## 저장해도 되는 것

```txt
TourAPI의 장소명
주소
좌표
영업시간
대표메뉴
전화번호
카테고리
원본 contentid
원본 JSON
```

현재 TourAPI 국문 서비스는 공공데이터포털에서 이용허락범위 제한 없음으로 표시되어 있으므로, 프로젝트 DB에 저장해서 서비스에 활용하는 방향이 자연스럽습니다.

## 조심해야 하는 것

```txt
이미지 파일을 직접 다운로드해서 재배포
다른 민간 API의 장소 데이터를 영구 저장
리뷰 크롤링
네이버 블로그/카카오맵 리뷰 무단 수집
구글 평점/리뷰 저장
```

이건 약관 문제가 생길 수 있습니다.

## 추천 방식

```txt
TourAPI 데이터:
DB 저장

이미지:
URL 저장, 출처 표시 고려

다른 공공 API:
각 데이터 상세의 이용허락범위 확인 후 저장

민간 지도/리뷰 API:
약관 확인 전까지 원본 ID와 최소 캐시만
```

---

# 9. Supabase에서 실제 구현 순서

지금 바로 테이블 다 만들고 복잡한 수집 로직부터 만들면 또 막힙니다.
순서는 이렇게 가세요.

## 1단계

위 DDL 중 이것만 먼저 만드세요.

```txt
mg_places
mg_place_sources
mg_place_texts
mg_place_food_details
mg_place_images
```

## 2단계

TourAPI `areaBasedList2` 응답 10개를 수동으로 넣거나, 간단한 스크립트로 넣습니다.

저장 흐름:

```txt
1. mg_places insert
2. mg_place_sources insert raw_list 저장
3. mg_place_texts locale='ko' insert
4. detailIntro2 호출
5. mg_place_sources raw_intro update
6. mg_place_texts ko 메뉴/영업시간 update
7. mg_place_food_details update
8. 이미지 있으면 mg_place_images insert
```

## 3단계

TourAPI 영문 API로 같은 장소를 찾을 수 있으면 `mg_place_texts locale='en'`에 넣습니다.

영문 API에서 매칭이 안 되면:

```txt
한국어 데이터를 바탕으로 en을 기계번역해서 저장
translation_status='machine'
```

## 4단계

프론트는 TourAPI가 아니라 Supabase에서 조회합니다.

```txt
사용자 언어 ko → mg_place_texts.locale='ko'
사용자 언어 en → mg_place_texts.locale='en'
en 없으면 ko fallback
```

---

# 10. 영어 fallback 로직

이건 꼭 필요합니다.

프론트/백엔드 로직은 이렇게 잡으세요.

```txt
현재 언어가 en일 때:
1. mg_place_texts에서 locale='en' 찾기
2. 있으면 en 표시
3. 없으면 locale='ko' 표시
4. 단, 화면에 "Korean data only" 같은 작은 표시 가능
```

한국어도 반대로 가능합니다.

```txt
현재 언어가 ko일 때:
1. ko 있으면 ko 표시
2. 없으면 en 표시
```

이렇게 해야 데이터가 일부만 있어도 화면이 안 깨집니다.

---

# 11. 부족한 점 검토

이 설계에서 일부러 뺀 것들이 있습니다.

```txt
회원 테이블
좋아요 테이블
리뷰 테이블
커뮤니티 테이블
방문 기록 테이블
알러지/개인 취향 테이블
```

왜 뺐냐면 지금 MVP에서 이걸 만들면 핵심이 흐려집니다.
Supabase Auth를 쓰면 회원 테이블은 나중에 `auth.users`와 연결해서 `mg_user_profiles` 만들면 됩니다.

나중에 추가한다면:

```sql
create table public.mg_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  preferred_locale varchar(10) default 'en',
  created_at timestamptz default now()
);
```

정도만 추가하면 됩니다.

---

# 12. 지금 최종 결론

지금은 이렇게 가시는 게 맞습니다.

```txt
1. mg_ 접두사 사용한다.
2. TourAPI 데이터는 DB에 저장한다.
3. 원본 JSON도 mg_place_sources에 저장한다.
4. 장소 공통정보와 언어별 텍스트를 분리한다.
5. TourAPI 국문/영문은 각각 source 데이터로 저장한다.
6. 영문 없는 API는 ko만 source로 저장하고, en은 machine/manual 번역으로 보완한다.
7. 프론트는 API 원본 필드가 아니라 mg_places + mg_place_texts 기반으로 표시한다.
8. 이미지 파일은 당장 저장하지 말고 URL만 저장한다.
```

그리고 지금 가장 먼저 만들 테이블은 이 5개입니다.

```txt
mg_places
mg_place_sources
mg_place_texts
mg_place_food_details
mg_place_images
```

코스까지 바로 보여줄 거면 추가로:

```txt
mg_courses
mg_course_places
```

회화표현까지 DB로 관리할 거면:

```txt
mg_phrases
```

이렇게 가시면 됩니다.
