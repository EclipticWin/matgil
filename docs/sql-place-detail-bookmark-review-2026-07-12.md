# Place Detail, Bookmark and Review Supabase SQL

- 작성 일시: 2026-07-12 18:46 KST
- 대상 문서: `docs/35-PLACE-DETAIL-BOOKMARK-REVIEW-DB-DESIGN.md`
- 이 문서의 SQL은 **AI 에이전트가 실행하지 않았다.** 사용자가 Supabase SQL Editor에서 직접 실행해야 한다.
- 순서: 1) 실행 전 확인 → 2) 본 실행(트랜잭션) → 3) 실행 후 검증 → 4) 앱에서 EN/KO 화면 수동 확인 → (필요 시) rollback.
- 이 SQL은 신규 테이블 2그룹(섹션 메타데이터, 북마크/리뷰/리뷰이미지) + 뷰 1개 + 트리거 함수 2개 + RPC 2개(리뷰 soft delete 전용 `soft_delete_my_place_review`는 핵심 기능, 닉네임 동기화 `sync_my_author_name`은 선택) + 신규 Storage 버킷 1개만 다룬다. **기존 `set_updated_at()`, 커뮤니티 테이블/정책/버킷, 장소 데이터, 음식 카테고리 테이블, 저장 코스, `ail_*` 객체는 절대 변경하지 않는다.**

---

## 1. 실행 전 확인

```sql
-- 신규 객체 이름이 이미 존재하는지 확인 (전부 null 이어야 새로 생성 가능)
select
  to_regclass('public.mg_place_detail_sections') as sections,
  to_regclass('public.mg_place_detail_section_translations') as section_translations,
  to_regclass('public.mg_place_bookmarks') as bookmarks,
  to_regclass('public.mg_place_reviews') as reviews,
  to_regclass('public.mg_place_review_images') as review_images,
  to_regclass('public.mg_place_review_stats') as review_stats_view;

-- 기존 set_updated_at() 함수 존재 확인 (1행이어야 재사용 가능 — 새로 만들지 않는다)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_updated_at';

-- 신규 함수 이름 충돌 확인 (전부 0행이어야 함)
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('mg_place_reviews_before_write', 'mg_place_review_images_enforce_limit',
                  'soft_delete_my_place_review', 'sync_my_author_name');

-- 신규 Storage 버킷 이름 충돌 확인 (0행이어야 함)
select id from storage.buckets where id = 'place-review-images';

-- mg_places.id 타입 최종 재확인 (bigint여야 함 — 사용자가 이미 확인했으나 최종 재검증)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'mg_places' and column_name = 'id';
```

**해석 기준**: 위 6개 조회 중 하나라도 예상과 다르면(신규 테이블/함수/버킷이 이미 존재, `set_updated_at` 미존재, `mg_places.id`가 bigint 아님) **2번 본 실행 SQL을 실행하지 말고 중단**한다.

**트랜잭션 안내**: Supabase SQL Editor에서 여러 statement를 한 번에 붙여넣고 실행하면 기본적으로 autocommit이지만, 아래 "2. 본 실행 SQL"은 `begin; ... commit;`으로 감싸여 있어 그 안의 모든 statement가 하나의 트랜잭션으로 처리된다. 중간에 오류가 나면 전체가 자동으로 롤백되어 절반만 생성되는 상태가 되지 않는다.

---

## 2. 본 실행 SQL

```sql
begin;

-- ============================================================
-- 2.1 상세 섹션 메타데이터 테이블
-- ============================================================

create table public.mg_place_detail_sections (
  section_key text primary key check (section_key ~ '^[a-z0-9_]+$'),
  icon_key text not null default 'default',
  sort_order integer not null default 999,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mg_place_detail_section_translations (
  section_key text not null references public.mg_place_detail_sections(section_key) on delete restrict,
  locale text not null check (btrim(locale) <> ''),
  label text not null check (btrim(label) <> ''),
  empty_title text not null check (btrim(empty_title) <> ''),
  empty_description text not null check (btrim(empty_description) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (section_key, locale)
);

create trigger mg_place_detail_sections_set_updated_at
before update on public.mg_place_detail_sections
for each row execute function public.set_updated_at();

create trigger mg_place_detail_section_translations_set_updated_at
before update on public.mg_place_detail_section_translations
for each row execute function public.set_updated_at();

-- ── seed: 고정 기능 섹션 4개 (rename/삭제 금지 — is_active만 관리자가 향후 변경) ──
insert into public.mg_place_detail_sections (section_key, icon_key, sort_order, is_active) values
  ('menu', 'menu', 10, true),
  ('reviews', 'star', 20, true),
  ('location', 'pin', 30, true),
  ('visit_info', 'clock', 40, true)
on conflict (section_key) do update set
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- ── seed: EN/KO 번역 (문구는 초안 — 관리자가 이후 자유롭게 변경 가능한 값) ──
insert into public.mg_place_detail_section_translations
  (section_key, locale, label, empty_title, empty_description) values
  ('menu', 'en', 'Menu', 'No menu info yet', 'We couldn''t find menu details for this place yet.'),
  ('menu', 'ko', '메뉴', '메뉴 정보가 아직 없어요', '이 가게의 메뉴 정보를 아직 확인하지 못했어요.'),
  ('reviews', 'en', 'Reviews', 'No reviews yet', 'Be the first to share your experience.'),
  ('reviews', 'ko', '리뷰', '아직 리뷰가 없어요', '첫 리뷰를 남겨보세요.'),
  ('location', 'en', 'Location', 'Location unavailable', 'We don''t have exact coordinates for this place yet.'),
  ('location', 'ko', '위치', '위치 정보가 없어요', '이 가게의 정확한 좌표 정보가 아직 없어요.'),
  ('visit_info', 'en', 'Visit Info', 'No visit info yet', 'Hours, rest days, and other details aren''t available yet.'),
  ('visit_info', 'ko', '방문 정보', '방문 정보가 아직 없어요', '영업시간, 휴무일 등 방문 정보가 아직 준비되지 않았어요.')
on conflict (section_key, locale) do update set
  label = excluded.label,
  empty_title = excluded.empty_title,
  empty_description = excluded.empty_description,
  updated_at = now();

-- ============================================================
-- 2.2 개별 가게 북마크
-- ============================================================

create table public.mg_place_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id bigint not null references public.mg_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ============================================================
-- 2.3 리뷰
-- ============================================================

create table public.mg_place_reviews (
  id bigint generated always as identity primary key,
  place_id bigint not null references public.mg_places(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  content text check (content is null or char_length(btrim(content)) between 1 and 1000),
  ui_locale text not null default 'en' check (btrim(ui_locale) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);

-- author_name 강제 + content 정규화 + edited_at 판정을 한 트리거에서 처리한다.
-- (모두 "BEFORE 쓰기 시점에 new.* 를 확정"하는 동일한 책임이라 하나로 묶었다.)
create or replace function public.mg_place_reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  -- (1) 빈 문자열 content는 null로 정규화 — 이후 CHECK가 정규화된 값을 검사한다.
  if new.content is not null and btrim(new.content) = '' then
    new.content := null;
  end if;

  -- (2) author_name은 항상 auth.users에서 재계산 — 클라이언트 값은 신뢰하지 않는다.
  --     display_name이 없거나 공백이면 쓰기 자체를 거부한다(이메일 fallback·공용 이름 금지).
  if new.user_id is not null then
    select nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
      into v_display_name
      from auth.users u
     where u.id = new.user_id;

    if v_display_name is null then
      raise exception 'mg_place_reviews: display_name is required before writing a review (user_id=%)', new.user_id
        using errcode = '23514';
    end if;

    new.author_name := v_display_name;
  end if;

  -- (3) edited_at은 rating/content가 실제로 바뀐 UPDATE에서만 갱신한다.
  --     soft delete, 닉네임 재동기화(업데이트만 발생) 등 다른 UPDATE에서는 이전 값을 유지한다.
  if tg_op = 'UPDATE' then
    if new.rating is distinct from old.rating or new.content is distinct from old.content then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;

  return new;
end;
$$;

create trigger mg_place_reviews_before_write
before insert or update on public.mg_place_reviews
for each row execute function public.mg_place_reviews_before_write();

create trigger mg_place_reviews_set_updated_at
before update on public.mg_place_reviews
for each row execute function public.set_updated_at();

-- 리뷰 soft delete는 오직 이 RPC를 통해서만 수행한다. deleted_at/deleted_by를 일반 UPDATE grant에
-- 포함하지 않음으로써(2.9), 사용자가 임의 시각·타인 UUID를 지정하거나 삭제를 복구하는 경로를 원천 차단한다.
create or replace function public.soft_delete_my_place_review(p_review_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_already_deleted timestamptz;
begin
  if v_uid is null then
    raise exception 'soft_delete_my_place_review: must be called by an authenticated user';
  end if;

  select user_id, deleted_at into v_owner, v_already_deleted
    from public.mg_place_reviews
   where id = p_review_id;

  if not found then
    raise exception 'soft_delete_my_place_review: review % does not exist', p_review_id;
  end if;

  if v_owner is distinct from v_uid then
    raise exception 'soft_delete_my_place_review: you can only delete your own review';
  end if;

  -- 이미 삭제된 리뷰는 조용히 넘어가지 않고 오류로 알린다 — 복구를 암시하는 no-op을 피하기 위함.
  if v_already_deleted is not null then
    raise exception 'soft_delete_my_place_review: review % is already deleted', p_review_id;
  end if;

  update public.mg_place_reviews
     set deleted_at = now(),
         deleted_by = v_uid
   where id = p_review_id;
end;
$$;

revoke all on function public.soft_delete_my_place_review(bigint) from public, anon;
grant execute on function public.soft_delete_my_place_review(bigint) to authenticated;

-- ============================================================
-- 2.4 리뷰 이미지
-- ============================================================

create table public.mg_place_review_images (
  id bigint generated always as identity primary key,
  review_id bigint not null references public.mg_place_reviews(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.mg_place_review_images_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.mg_place_review_images
   where review_id = new.review_id;

  if v_count >= 3 then
    raise exception 'mg_place_review_images: a review can have at most 3 images (review_id=%)', new.review_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger mg_place_review_images_enforce_limit
before insert on public.mg_place_review_images
for each row execute function public.mg_place_review_images_enforce_limit();

-- ============================================================
-- 2.5 평균 별점 view
-- ============================================================

create view public.mg_place_review_stats
with (security_invoker = true) as
select
  place_id,
  count(*)::int as rating_count,
  round(avg(rating)::numeric, 1) as rating_avg
from public.mg_place_reviews
where deleted_at is null
group by place_id;

-- ============================================================
-- 2.6 인덱스
-- ============================================================

create index mg_place_reviews_place_active_idx
  on public.mg_place_reviews (place_id, created_at desc, id desc)
  where deleted_at is null;

create index mg_place_reviews_user_active_idx
  on public.mg_place_reviews (user_id, created_at desc, id desc)
  where deleted_at is null;

create unique index mg_place_reviews_active_user_place_uidx
  on public.mg_place_reviews (place_id, user_id)
  where deleted_at is null and user_id is not null;

create index mg_place_review_images_review_idx
  on public.mg_place_review_images (review_id, sort_order);

-- ============================================================
-- 2.7 RLS 활성화
-- ============================================================

alter table public.mg_place_detail_sections enable row level security;
alter table public.mg_place_detail_section_translations enable row level security;
alter table public.mg_place_bookmarks enable row level security;
alter table public.mg_place_reviews enable row level security;
alter table public.mg_place_review_images enable row level security;

-- ============================================================
-- 2.8 정책
-- ============================================================

create policy "place detail sections public read" on public.mg_place_detail_sections
for select to anon, authenticated using (true);

create policy "place detail section translations public read" on public.mg_place_detail_section_translations
for select to anon, authenticated using (true);

create policy "place bookmarks select own" on public.mg_place_bookmarks
for select to authenticated using (user_id = auth.uid());

create policy "place bookmarks insert own" on public.mg_place_bookmarks
for insert to authenticated with check (user_id = auth.uid());

create policy "place bookmarks delete own" on public.mg_place_bookmarks
for delete to authenticated using (user_id = auth.uid());

create policy "place reviews public read" on public.mg_place_reviews
for select to anon, authenticated using (deleted_at is null);

create policy "place reviews insert own" on public.mg_place_reviews
for insert to authenticated with check (user_id = auth.uid());

create policy "place reviews update own" on public.mg_place_reviews
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "place review images public read" on public.mg_place_review_images
for select to anon, authenticated
using (exists (
  select 1 from public.mg_place_reviews r
  where r.id = review_id and r.deleted_at is null
));

create policy "place review images insert own" on public.mg_place_review_images
for insert to authenticated
with check (exists (
  select 1 from public.mg_place_reviews r
  where r.id = review_id and r.user_id = auth.uid() and r.deleted_at is null
));

create policy "place review images delete own" on public.mg_place_review_images
for delete to authenticated
using (exists (
  select 1 from public.mg_place_reviews r
  where r.id = review_id and r.user_id = auth.uid()
));

-- ============================================================
-- 2.9 최소 권한 grant (선 revoke, 후 필요한 것만 grant)
-- ============================================================

revoke all on public.mg_place_detail_sections from public, anon, authenticated;
revoke all on public.mg_place_detail_section_translations from public, anon, authenticated;
grant select on public.mg_place_detail_sections to anon, authenticated;
grant select on public.mg_place_detail_section_translations to anon, authenticated;

revoke all on public.mg_place_bookmarks from public, anon, authenticated;
grant select, insert, delete on public.mg_place_bookmarks to authenticated;

revoke all on public.mg_place_reviews from public, anon, authenticated;
grant select on public.mg_place_reviews to anon, authenticated;
-- user_id/author_name/created_at/edited_at/updated_at/id는 의도적으로 제외 —
-- user_id는 컬럼 DEFAULT auth.uid()가, author_name/edited_at은 트리거가 채운다.
grant insert (place_id, rating, content, ui_locale) on public.mg_place_reviews to authenticated;
-- 일반 UPDATE는 rating/content만 허용한다. deleted_at/deleted_by는 여기서 의도적으로 제외했다 —
-- 삭제는 반드시 soft_delete_my_place_review() RPC를 거치도록 강제한다(2.3 참조).
-- place_id/user_id/author_name/created_at/edited_at도 의도적으로 제외 (커뮤니티 like_count 조작 사례 재발 방지).
grant update (rating, content) on public.mg_place_reviews to authenticated;

revoke all on public.mg_place_review_images from public, anon, authenticated;
grant select on public.mg_place_review_images to anon, authenticated;
-- review_id/storage_path/sort_order만 허용 — id는 identity, created_at은 default now()가 채운다.
grant insert (review_id, storage_path, sort_order) on public.mg_place_review_images to authenticated;
grant delete on public.mg_place_review_images to authenticated;

grant select on public.mg_place_review_stats to anon, authenticated;

-- ============================================================
-- 2.10 신규 Storage 버킷 (community-post-images는 건드리지 않는다)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-review-images', 'place-review-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "place review images bucket public read"
on storage.objects for select
to public
using (bucket_id = 'place-review-images');

create policy "place review images bucket insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'place-review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.mg_place_reviews r
    where r.id::text = (storage.foldername(name))[2]
      and r.user_id = auth.uid()
  )
);

create policy "place review images bucket delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'place-review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
```

### (선택 블록 — 별도 실행 권장) 닉네임 동기화 RPC

이 블록은 **기존 `mg_community_posts`/`mg_community_comments`의 데이터(값)를 UPDATE할 수 있는 함수**를 새로 만든다. 스키마·RLS·grant는 건드리지 않지만, 실제로 이 함수를 호출하면 그 사용자의 커뮤니티 글·댓글 `author_name` 값이 바뀐다. 원치 않으면 이 블록만 건너뛰어도 섹션/북마크/리뷰 기능은 완전히 독립적으로 동작한다.

```sql
begin;

create or replace function public.sync_my_author_name()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'sync_my_author_name: must be called by an authenticated user';
  end if;

  select nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
    into v_display_name
    from auth.users u
   where u.id = v_uid;

  if v_display_name is null then
    raise exception 'sync_my_author_name: no display_name set for user %', v_uid;
  end if;

  update public.mg_community_posts
     set author_name = v_display_name
   where user_id = v_uid;

  update public.mg_community_comments
     set author_name = v_display_name
   where user_id = v_uid;

  -- 리뷰는 값을 직접 대입하지 않는다 — updated_at만 건드려 트리거가 재계산하도록 위임한다.
  update public.mg_place_reviews
     set updated_at = now()
   where user_id = v_uid
     and deleted_at is null;
end;
$$;

revoke all on function public.sync_my_author_name() from public, anon;
grant execute on function public.sync_my_author_name() to authenticated;

commit;
```

---

## 3. 실행 후 검증 SQL

```sql
-- 테이블/뷰 존재
select
  to_regclass('public.mg_place_detail_sections'),
  to_regclass('public.mg_place_detail_section_translations'),
  to_regclass('public.mg_place_bookmarks'),
  to_regclass('public.mg_place_reviews'),
  to_regclass('public.mg_place_review_images'),
  to_regclass('public.mg_place_review_stats');

-- 컬럼 타입
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('mg_place_detail_sections', 'mg_place_detail_section_translations',
                      'mg_place_bookmarks', 'mg_place_reviews', 'mg_place_review_images')
order by table_name, ordinal_position;

-- PK/FK/unique 제약
select tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('mg_place_detail_sections', 'mg_place_detail_section_translations',
                        'mg_place_bookmarks', 'mg_place_reviews', 'mg_place_review_images')
order by tc.table_name, tc.constraint_type;

-- 인덱스
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('mg_place_reviews', 'mg_place_review_images')
order by tablename, indexname;

-- seed: section 4행, 번역 en 4 / ko 4
select count(*) as sections_count from public.mg_place_detail_sections;
select locale, count(*) from public.mg_place_detail_section_translations group by locale order by locale;
select section_key, locale, label, empty_title from public.mg_place_detail_section_translations
where section_key = 'reviews' order by locale;

-- RLS 활성화 여부
select relname, relrowsecurity
from pg_class
where relname in ('mg_place_detail_sections', 'mg_place_detail_section_translations',
                  'mg_place_bookmarks', 'mg_place_reviews', 'mg_place_review_images');

-- 정책 목록
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public'
  and tablename in ('mg_place_detail_sections', 'mg_place_detail_section_translations',
                    'mg_place_bookmarks', 'mg_place_reviews', 'mg_place_review_images')
order by tablename, policyname;

-- 컬럼 단위 grant 확인 (리뷰 INSERT/UPDATE에 허용 컬럼만 나와야 함 — UPDATE에는 rating/content만, deleted_at/deleted_by는 없어야 함)
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'mg_place_reviews' and grantee = 'authenticated'
order by privilege_type, column_name;

-- 리뷰 이미지 INSERT 컬럼 grant 확인 (review_id, storage_path, sort_order만 나와야 함)
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'mg_place_review_images' and grantee = 'authenticated'
order by privilege_type, column_name;

-- soft_delete_my_place_review 함수 존재 + 실행 권한 (authenticated만 true, anon은 false여야 정상)
select
  has_function_privilege('authenticated', 'public.soft_delete_my_place_review(bigint)', 'execute') as auth_can_execute_soft_delete,
  has_function_privilege('anon', 'public.soft_delete_my_place_review(bigint)', 'execute') as anon_can_execute_soft_delete;

-- 테이블 단위 grant
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('mg_place_detail_sections', 'mg_place_detail_section_translations',
                     'mg_place_bookmarks', 'mg_place_reviews', 'mg_place_review_images', 'mg_place_review_stats')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- view 조회 (아직 리뷰가 없으면 0행이 정상)
select * from public.mg_place_review_stats limit 5;

-- Storage 버킷·정책
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'place-review-images';

select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname ilike 'place review images%';

-- 함수/트리거 존재
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('mg_place_reviews_before_write', 'mg_place_review_images_enforce_limit',
                  'soft_delete_my_place_review', 'sync_my_author_name');

select tgname, tgrelid::regclass from pg_trigger
where tgrelid in (
  'public.mg_place_reviews'::regclass,
  'public.mg_place_review_images'::regclass,
  'public.mg_place_detail_sections'::regclass,
  'public.mg_place_detail_section_translations'::regclass
) and not tgisinternal;

-- anon/authenticated 예상 접근 재확인 (마지막 값은 false여야 정상 — 북마크는 anon 접근 불가)
select
  has_table_privilege('anon', 'public.mg_place_reviews', 'select') as anon_can_select_reviews,
  has_table_privilege('authenticated', 'public.mg_place_reviews', 'insert') as auth_can_insert_reviews,
  has_table_privilege('anon', 'public.mg_place_bookmarks', 'select') as anon_can_select_bookmarks;
```

**해석 기준**: sections=4, translations en/ko 각 4(합 8), RLS 전부 true, `mg_place_bookmarks`에 대한 `anon_can_select_bookmarks`는 **false**여야 정상이다. 리뷰 컬럼 grant 조회 결과에 `user_id`/`author_name`/`created_at`/`edited_at`이 **나오지 않아야** 하고, **UPDATE에는 `rating`/`content`만 있고 `deleted_at`/`deleted_by`가 없어야** 설계대로다(삭제는 RPC 전용). 리뷰 이미지 INSERT 컬럼 grant에는 `review_id`/`storage_path`/`sort_order`만 있어야 한다. `auth_can_execute_soft_delete`는 **true**, `anon_can_execute_soft_delete`는 **false**여야 정상이다.

### 실제 쓰기 동작 검증 (SQL 밖에서 진행 권장)

SQL Editor는 postgres(관리자) 컨텍스트로 실행되어 RLS를 우회하므로, `auth.uid()`가 실제 로그인 사용자처럼 동작하지 않는다. 따라서 "실제 로그인 사용자가 리뷰를 쓸 수 있는지", "display_name 없는 계정은 거부되는지" 같은 검증은 SQL Editor가 아니라 **앱(또는 REST API를 실제 사용자 JWT로 호출)**에서 확인해야 한다. 권장 절차:
1. display_name이 있는 테스트 계정으로 로그인 → 리뷰 1건 작성 → `author_name`이 자신의 display_name과 일치하는지 확인.
2. (가능하면) display_name이 없는 계정으로 리뷰 작성 시도 → 오류가 발생하는지 확인.
3. 같은 계정으로 같은 가게에 두 번째 리뷰 작성 시도 → 유니크 인덱스 위반으로 실패하는지 확인.
4. 자신의 리뷰에 대해 `select public.soft_delete_my_place_review(<review_id>);` 호출 → `deleted_at`/`deleted_by`가 설정되고 목록에서 사라지는지 확인.
5. 같은 리뷰에 다시 같은 RPC 호출 → "already deleted" 오류가 발생하는지 확인(no-op이 아니라 오류여야 정상).
6. 다른 사용자의 review_id로 이 RPC 호출 → "you can only delete your own review" 오류로 거부되는지 확인.
7. 삭제 후 같은 가게에 다시 리뷰 작성 → 새 row가 생기는지 확인.
8. 로그인 사용자가 REST/클라이언트로 자신의 리뷰에 `update ... set deleted_at = ...`를 직접 시도(RPC 우회) → 컬럼 권한 부족으로 거부되는지 확인.

이 검증들은 **사용자 계정이나 실제 장소 데이터를 변경하는 절차이므로 본 실행 SQL에는 포함하지 않았다.** 원하실 때 별도로 진행하시면 된다.

---

## 4. Rollback

```sql
begin;

drop policy if exists "place review images bucket delete own" on storage.objects;
drop policy if exists "place review images bucket insert own" on storage.objects;
drop policy if exists "place review images bucket public read" on storage.objects;

revoke all on function public.sync_my_author_name() from authenticated;
drop function if exists public.sync_my_author_name();

drop table if exists public.mg_place_review_images cascade;
drop view if exists public.mg_place_review_stats;
drop table if exists public.mg_place_reviews cascade;
drop table if exists public.mg_place_bookmarks cascade;
drop table if exists public.mg_place_detail_section_translations cascade;
drop table if exists public.mg_place_detail_sections cascade;

drop function if exists public.mg_place_reviews_before_write();
drop function if exists public.mg_place_review_images_enforce_limit();

revoke all on function public.soft_delete_my_place_review(bigint) from authenticated;
drop function if exists public.soft_delete_my_place_review(bigint);

commit;

-- Storage 버킷 'place-review-images'는 위 트랜잭션에서 자동으로 지우지 않는다.
-- 완전히 제거하려면:
--   1) Supabase Dashboard > Storage > place-review-images 에서 안의 파일을 먼저 모두 삭제
--      (또는 Storage API로 삭제 — SQL로 storage.objects 행만 지우면 메타데이터만 삭제되고
--       실제 저장된 파일(blob)이 고아로 남을 수 있으므로 파일이 남아있는 채로 아래 DELETE를 실행하지 말 것)
--   2) 파일이 모두 비워진 뒤에만:
--      delete from storage.buckets where id = 'place-review-images';
```

**이 rollback이 절대 건드리지 않는 것**: `public.set_updated_at()`, `mg_community_posts`/`mg_community_comments`(테이블·RLS·정책·버킷), `mg_places`/`mg_place_texts`/`mg_place_food_details`/`mg_place_images`, `mg_food_categories`/`mg_food_category_translations`, `mg_saved_courses`, `community-post-images` 버킷, `ail_*` 객체. 만약 §2의 선택 블록(`sync_my_author_name`)을 실제로 호출한 적이 있다면, 그로 인해 이미 반영된 `author_name` 값(닉네임 동기화 결과)은 되돌리지 않는다 — 이는 원래 닉네임과 일치시키는 정상적인 데이터 보정이었으므로 되돌릴 이유가 없다.
