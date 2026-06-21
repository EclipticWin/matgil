# 22. Community DDL 및 기능 기준 문서

## 작성 일시

2026-06-22 KST

## 문서 목적

이 문서는 Matgil 프로젝트의 Community 기능과 관련된 Supabase DB 구조, RLS 정책, Storage 설정, 프론트엔드 동작 기준을 한 번에 파악하기 위해 작성한다.

이후 AI에게 Community 관련 작업을 요청할 때, 이 문서를 함께 제공하면 기존 테이블 구조와 구현 의도를 다시 추적하지 않아도 된다.

---

# 1. Community 기능 개요

현재 Community는 Supabase Auth 기반 로그인 사용자만 글/댓글/좋아요를 작성할 수 있는 구조다.

주요 기능:

```txt
- 게시글 작성
- 게시글 수정
- 게시글 soft delete
- 게시글 좋아요
- 댓글 작성
- 댓글 soft delete
- 대댓글 1depth
- 댓글 좋아요
- 댓글 bottom sheet UI
- 게시글 이미지 첨부
- 한/영 UI 문구 처리
- 게시글 locale 저장
```

현재 제외 또는 후속 확장 항목:

```txt
- 이미지 파일 실제 삭제
- 위치 태그
- 장소 태그
- 코스 태그
- 신고/차단
- 알림
- 프로필 이미지 업로드
- 회원 프로필 테이블
- 대댓글 2depth 이상
```

---

# 2. 핵심 설계 원칙

## 2.1 Soft delete 우선

게시글과 댓글은 실제로 삭제하지 않고 `deleted_at`, `deleted_by`를 채우는 soft delete 방식으로 처리한다.

이유:

```txt
- 추후 장소 태그 / 코스 태그 / 커뮤니티 언급 수를 추천 알고리즘에 활용할 수 있음
- 사용자 화면에서는 삭제된 것처럼 보이게 하되, 데이터 분석 가능성을 남김
- 글 삭제 시 이미지 파일도 Storage에 유지함
```

## 2.2 Storage 파일은 삭제하지 않음

게시글 이미지 수정 또는 게시글 삭제 시 Supabase Storage 파일은 삭제하지 않는다.

```txt
- 글 수정 시 이미지 제거: DB의 image_urls 배열에서만 제거
- 글 삭제 시: mg_community_posts soft delete
- Storage 파일 삭제: 하지 않음
- storage.remove(): 호출 금지
```

## 2.3 UI 언어와 게시글 언어는 구분

Community는 앱 UI locale과 게시글 locale을 구분해야 한다.

```txt
UI locale:
- 버튼, 탭, placeholder, confirm, empty state 등 화면 문구
- dictionary EN/KO 기준

Post locale:
- 게시글이 작성된 언어
- mg_community_posts.locale 값
```

중요:

```txt
사용자 작성 content는 번역하지 않는다.
작성자가 쓴 글/댓글 내용은 그대로 보여준다.
```

## 2.4 한국어/영어 모두 처리

Community 관련 UI를 수정할 때는 항상 EN/KO 둘 다 처리한다.

```txt
- dictionary에 EN/KO 모두 추가
- raw key 노출 금지
- 영어 모드와 한국어 모드 모두 화면 확인
```

---

# 3. Supabase Auth 연동 기준

현재 `useAuth`는 Supabase Auth를 직접 사용한다.

정규화된 user 객체 구조:

```js
{
  id: u.id,
  email: u.email,
  name: u.user_metadata?.display_name || u.email?.split('@')[0] || 'Traveller'
}
```

Community에서 주로 사용하는 값:

```txt
user.id     → posts.user_id, comments.user_id, likes.user_id
user.name   → posts.author_name, comments.author_name
user.email  → MyPage 표시용
```

현재 별도 회원 프로필 테이블은 없다.

```txt
mg_profiles 없음
프로필 이미지 컬럼 없음
Community/MyPage 아바타는 user.id 또는 authorName 기반 deterministic avatar 색상으로 표시
실제 프로필 사진 업로드는 후속 작업
```

---

# 4. 현재 Community 관련 테이블

현재 Community 관련 주요 테이블은 다음과 같다.

```txt
public.mg_community_posts
public.mg_community_post_likes
public.mg_community_comments
public.mg_community_comment_likes
storage.objects
storage.buckets
```

---

# 5. `mg_community_posts`

## 5.1 역할

Community 게시글 본문을 저장한다.

기능:

```txt
- 게시글 본문
- 작성자
- 카테고리
- locale
- 이미지 URL 배열
- 좋아요 수
- 댓글 수
- soft delete 상태
```

## 5.2 현재 컬럼

확인된 컬럼:

```txt
id              bigint, primary key
user_id         uuid, not null
category        varchar, not null, default 'general'
title           text, nullable
content         text, not null
author_name     text, nullable
country         text, nullable
image_url       text, nullable
image_urls      jsonb, not null, default []
like_count      integer, not null, default 0
comment_count   integer, not null, default 0
is_published    boolean, not null, default true
created_at      timestamptz, not null, default now()
updated_at      timestamptz, not null, default now()
locale          varchar, not null, default 'en'
deleted_at      timestamptz, nullable
deleted_by      uuid, nullable
```

## 5.3 DDL

```sql
create table if not exists public.mg_community_posts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category varchar(50) not null default 'general',
  title text,
  content text not null,
  author_name text,
  country text,
  image_url text,
  image_urls jsonb not null default '[]'::jsonb,
  like_count int not null default 0,
  comment_count int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locale varchar(5) not null default 'en',
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);
```

기존 테이블 보강용 ALTER:

```sql
alter table public.mg_community_posts
  add column if not exists locale varchar(5),
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);

update public.mg_community_posts
set locale = 'en'
where locale is null;

alter table public.mg_community_posts
  alter column locale set default 'en',
  alter column locale set not null;
```

locale check constraint:

```sql
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mg_community_posts_locale_check'
  ) then
    alter table public.mg_community_posts
      add constraint mg_community_posts_locale_check
      check (locale in ('ko', 'en'));
  end if;
end $$;
```

---

# 6. `mg_community_post_likes`

## 6.1 역할

게시글 좋아요 정보를 저장한다.

규칙:

```txt
- 로그인 사용자만 가능
- 한 사용자는 한 게시글에 1번만 좋아요 가능
- 자기 글에는 좋아요 불가
- 삭제된 글에는 좋아요 불가
```

## 6.2 현재 컬럼

```txt
id          bigint, primary key
post_id     bigint, not null
user_id     uuid, not null
created_at  timestamptz, not null, default now()
unique(post_id, user_id)
```

## 6.3 DDL

```sql
create table if not exists public.mg_community_post_likes (
  id bigserial primary key,
  post_id bigint not null references public.mg_community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);
```

---

# 7. `mg_community_comments`

## 7.1 역할

게시글 댓글과 대댓글을 저장한다.

규칙:

```txt
- 댓글은 로그인 사용자만 작성 가능
- 댓글은 게시글에 속함
- 대댓글은 parent_comment_id로 1depth만 지원
- 댓글 삭제는 soft delete
- 대댓글 없는 삭제 댓글은 화면에서 사라짐
- 대댓글 있는 부모 댓글 삭제 시 “삭제된 댓글입니다” placeholder 표시
- 삭제된 대댓글은 화면에서 사라짐
```

## 7.2 현재 컬럼

```txt
id                  bigint, primary key
post_id             bigint, not null
user_id             uuid, not null
author_name         text, nullable
content             text, not null
created_at          timestamptz, not null, default now()
updated_at          timestamptz, not null, default now()
parent_comment_id   bigint, nullable
like_count          integer, not null, default 0
deleted_at          timestamptz, nullable
deleted_by          uuid, nullable
```

## 7.3 DDL

```sql
create table if not exists public.mg_community_comments (
  id bigserial primary key,
  post_id bigint not null references public.mg_community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  parent_comment_id bigint references public.mg_community_comments(id) on delete cascade,
  like_count int not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);
```

기존 테이블 보강용 ALTER:

```sql
alter table public.mg_community_comments
  add column if not exists parent_comment_id bigint references public.mg_community_comments(id) on delete cascade,
  add column if not exists like_count int not null default 0,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id);
```

---

# 8. `mg_community_comment_likes`

## 8.1 역할

댓글 및 대댓글 좋아요 정보를 저장한다.

규칙:

```txt
- 로그인 사용자만 가능
- 한 사용자는 한 댓글에 1번만 좋아요 가능
- 자기 댓글에는 좋아요 불가
- 삭제된 댓글에는 좋아요 불가
```

## 8.2 현재 컬럼

```txt
id           bigint, primary key
comment_id   bigint, not null
user_id      uuid, not null
created_at   timestamptz, not null, default now()
unique(comment_id, user_id)
```

## 8.3 DDL

```sql
create table if not exists public.mg_community_comment_likes (
  id bigserial primary key,
  comment_id bigint not null references public.mg_community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id)
);
```

---

# 9. Storage 설정

## 9.1 Bucket

Community 이미지 첨부 기능은 Supabase Storage를 사용한다.

Bucket:

```txt
community-post-images
```

설정:

```txt
Public bucket: ON
File size limit: 5MB
Allowed MIME types: image/*
```

## 9.2 저장 경로 규칙

업로드 경로는 반드시 첫 번째 폴더가 `user.id`여야 한다.

정상:

```txt
{userId}/{timestamp}-{random}.{ext}
```

예:

```txt
a20de9eb-de57-4001-9e39-da5069fee54f/20260622-032010-a8f3.png
```

비정상:

```txt
community/{userId}/file.png
posts/{userId}/file.png
{userId}/스크린샷 2026-06-22.png
```

이유:

```txt
Storage insert policy가 (storage.foldername(name))[1] = auth.uid()::text 조건을 사용함
```

## 9.3 Storage 정책

현재 의도:

```txt
- 누구나 public image read 가능
- 로그인 사용자는 본인 userId 폴더에만 upload 가능
- Storage delete policy 없음
```

DDL:

```sql
drop policy if exists "Public can read community post images" on storage.objects;
drop policy if exists "Authenticated users can upload own community post images" on storage.objects;

create policy "Public can read community post images"
on storage.objects
for select
to public
using (bucket_id = 'community-post-images');

create policy "Authenticated users can upload own community post images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

삭제 정책은 만들지 않는다.

```txt
Storage 파일은 게시글 수정/삭제 시에도 유지한다.
storage.remove() 호출 금지.
```

---

# 10. Trigger / Function

## 10.1 updated_at 자동 갱신

게시글과 댓글 update 시 `updated_at`을 자동 갱신한다.

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_mg_community_posts_updated_at on public.mg_community_posts;
create trigger set_mg_community_posts_updated_at
before update on public.mg_community_posts
for each row
execute function public.set_updated_at();

drop trigger if exists set_mg_community_comments_updated_at on public.mg_community_comments;
create trigger set_mg_community_comments_updated_at
before update on public.mg_community_comments
for each row
execute function public.set_updated_at();
```

## 10.2 게시글 좋아요 수 동기화

`mg_community_post_likes` insert/delete 후 `mg_community_posts.like_count`를 동기화한다.

```sql
create or replace function public.sync_community_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id bigint;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.mg_community_posts
  set like_count = (
    select count(*)::int
    from public.mg_community_post_likes
    where post_id = target_post_id
  )
  where id = target_post_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_community_post_like_count_insert on public.mg_community_post_likes;
create trigger sync_community_post_like_count_insert
after insert on public.mg_community_post_likes
for each row
execute function public.sync_community_post_like_count();

drop trigger if exists sync_community_post_like_count_delete on public.mg_community_post_likes;
create trigger sync_community_post_like_count_delete
after delete on public.mg_community_post_likes
for each row
execute function public.sync_community_post_like_count();
```

## 10.3 게시글 댓글 수 동기화

`mg_community_comments` insert/delete/update of deleted_at 후 `mg_community_posts.comment_count`를 동기화한다.

삭제되지 않은 댓글만 센다.

```sql
create or replace function public.sync_community_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id bigint;
begin
  target_post_id := coalesce(new.post_id, old.post_id);

  update public.mg_community_posts
  set comment_count = (
    select count(*)::int
    from public.mg_community_comments
    where post_id = target_post_id
      and deleted_at is null
  )
  where id = target_post_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_community_post_comment_count_insert on public.mg_community_comments;
create trigger sync_community_post_comment_count_insert
after insert on public.mg_community_comments
for each row
execute function public.sync_community_post_comment_count();

drop trigger if exists sync_community_post_comment_count_delete on public.mg_community_comments;
create trigger sync_community_post_comment_count_delete
after delete on public.mg_community_comments
for each row
execute function public.sync_community_post_comment_count();

drop trigger if exists sync_community_post_comment_count_update on public.mg_community_comments;
create trigger sync_community_post_comment_count_update
after update of deleted_at on public.mg_community_comments
for each row
execute function public.sync_community_post_comment_count();
```

## 10.4 댓글 좋아요 수 동기화

`mg_community_comment_likes` insert/delete 후 `mg_community_comments.like_count`를 동기화한다.

```sql
create or replace function public.sync_community_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_comment_id bigint;
begin
  target_comment_id := coalesce(new.comment_id, old.comment_id);

  update public.mg_community_comments
  set like_count = (
    select count(*)::int
    from public.mg_community_comment_likes
    where comment_id = target_comment_id
  )
  where id = target_comment_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_community_comment_like_count_insert on public.mg_community_comment_likes;
create trigger sync_community_comment_like_count_insert
after insert on public.mg_community_comment_likes
for each row
execute function public.sync_community_comment_like_count();

drop trigger if exists sync_community_comment_like_count_delete on public.mg_community_comment_likes;
create trigger sync_community_comment_like_count_delete
after delete on public.mg_community_comment_likes
for each row
execute function public.sync_community_comment_like_count();
```

---

# 11. RLS 정책

## 11.1 Posts 정책

현재 목표:

```txt
- 공개 게시글은 누구나 읽기 가능
- soft delete된 게시글은 일반 목록에서 숨김
- 작성자는 자기 게시글 읽기 가능
- 로그인 사용자는 자기 user_id로만 insert 가능
- 작성자만 update 가능
- hard delete 정책 없음
```

SQL:

```sql
alter table public.mg_community_posts enable row level security;

drop policy if exists "read visible community posts" on public.mg_community_posts;
create policy "read visible community posts"
on public.mg_community_posts
for select
using (
  (is_published = true and deleted_at is null)
  or user_id = auth.uid()
);

drop policy if exists "insert own community posts" on public.mg_community_posts;
create policy "insert own community posts"
on public.mg_community_posts
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "update own community posts" on public.mg_community_posts;
create policy "update own community posts"
on public.mg_community_posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "delete own community posts" on public.mg_community_posts;
drop policy if exists "users can delete own posts" on public.mg_community_posts;
```

## 11.2 Post likes 정책

현재 목표:

```txt
- 누구나 좋아요 목록 읽기 가능
- 로그인 사용자만 좋아요 가능
- 자기 글에는 좋아요 불가
- 삭제된 글에는 좋아요 불가
- 본인 좋아요만 취소 가능
```

SQL:

```sql
alter table public.mg_community_post_likes enable row level security;

drop policy if exists "read community post likes" on public.mg_community_post_likes;
create policy "read community post likes"
on public.mg_community_post_likes
for select
using (true);

drop policy if exists "insert own community post likes" on public.mg_community_post_likes;
create policy "insert own community post likes"
on public.mg_community_post_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.mg_community_posts p
    where p.id = post_id
      and p.user_id <> auth.uid()
      and p.is_published = true
      and p.deleted_at is null
  )
);

drop policy if exists "delete own community post likes" on public.mg_community_post_likes;
create policy "delete own community post likes"
on public.mg_community_post_likes
for delete
to authenticated
using (user_id = auth.uid());
```

## 11.3 Comments 정책

현재 목표:

```txt
- 삭제되지 않은 댓글은 누구나 읽기 가능
- 작성자는 자기 댓글 읽기 가능
- 로그인 사용자는 자기 user_id로만 insert 가능
- 작성자만 update 가능
- hard delete 정책 없음
```

SQL:

```sql
alter table public.mg_community_comments enable row level security;

drop policy if exists "read visible community comments" on public.mg_community_comments;
create policy "read visible community comments"
on public.mg_community_comments
for select
using (
  deleted_at is null
  or user_id = auth.uid()
);

drop policy if exists "insert own community comments" on public.mg_community_comments;
create policy "insert own community comments"
on public.mg_community_comments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "update own community comments" on public.mg_community_comments;
create policy "update own community comments"
on public.mg_community_comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "delete own community comments" on public.mg_community_comments;
```

## 11.4 Comment likes 정책

현재 목표:

```txt
- 누구나 댓글 좋아요 목록 읽기 가능
- 로그인 사용자만 댓글 좋아요 가능
- 자기 댓글에는 좋아요 불가
- 삭제된 댓글에는 좋아요 불가
- 본인 댓글 좋아요만 취소 가능
```

SQL:

```sql
alter table public.mg_community_comment_likes enable row level security;

drop policy if exists "read community comment likes" on public.mg_community_comment_likes;
create policy "read community comment likes"
on public.mg_community_comment_likes
for select
using (true);

drop policy if exists "insert own community comment likes" on public.mg_community_comment_likes;
create policy "insert own community comment likes"
on public.mg_community_comment_likes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.mg_community_comments c
    where c.id = comment_id
      and c.user_id <> auth.uid()
      and c.deleted_at is null
  )
);

drop policy if exists "delete own community comment likes" on public.mg_community_comment_likes;
create policy "delete own community comment likes"
on public.mg_community_comment_likes
for delete
to authenticated
using (user_id = auth.uid());
```

## 11.5 Grants

```sql
grant select on public.mg_community_posts to anon, authenticated;
grant insert, update on public.mg_community_posts to authenticated;

grant select on public.mg_community_post_likes to anon, authenticated;
grant insert, delete on public.mg_community_post_likes to authenticated;

grant select on public.mg_community_comments to anon, authenticated;
grant insert, update on public.mg_community_comments to authenticated;

grant select on public.mg_community_comment_likes to anon, authenticated;
grant insert, delete on public.mg_community_comment_likes to authenticated;

grant usage, select on all sequences in schema public to authenticated;
```

---

# 12. 프론트엔드 기능 기준

## 12.1 게시글 작성

게시글 작성 시 저장 값:

```txt
user_id: 현재 로그인 사용자 id
category: general/question/review/tips/food/routes 등
locale: 현재 앱 locale
content: 사용자 입력 본문
author_name: 현재 user.name
country: 현재는 공백 가능
image_urls: 이미지 public URL 배열
```

이미지 없는 경우:

```json
[]
```

## 12.2 게시글 수정

수정 가능 조건:

```txt
post.userId === user.id
```

수정 가능 항목:

```txt
content
category
image_urls
```

수정하지 않는 항목:

```txt
user_id
author_name
locale
created_at
```

이미지 수정 규칙:

```txt
- 기존 image_urls 중 사용자가 제거한 URL은 DB 배열에서 제거
- 새로 추가한 파일은 Storage 업로드 후 public URL 추가
- Storage 파일 삭제는 하지 않음
```

## 12.3 게시글 삭제

삭제 가능 조건:

```txt
post.userId === user.id
```

삭제 방식:

```sql
update public.mg_community_posts
set
  is_published = false,
  deleted_at = now(),
  deleted_by = auth.uid()
where id = :post_id
  and user_id = auth.uid();
```

프론트 구현 시 주의:

```txt
delete() 호출 금지
update 후 .select() 붙이지 않는 것이 안전
삭제 성공 후 loadPosts 재조회
```

## 12.4 게시글 좋아요

가능 조건:

```txt
로그인 사용자
post.userId !== user.id
post.is_published = true
post.deleted_at is null
```

좋아요:

```sql
insert into public.mg_community_post_likes (post_id, user_id)
values (:post_id, auth.uid());
```

좋아요 취소:

```sql
delete from public.mg_community_post_likes
where post_id = :post_id
  and user_id = auth.uid();
```

`like_count`는 trigger가 자동 동기화한다.

## 12.5 댓글 작성

댓글 작성 가능 조건:

```txt
로그인 사용자
```

루트 댓글:

```txt
parent_comment_id = null
```

대댓글:

```txt
parent_comment_id = 부모 댓글 id
```

대댓글은 1depth만 지원한다.

## 12.6 댓글 삭제

삭제 가능 조건:

```txt
comment.userId === user.id
```

삭제 방식:

```sql
update public.mg_community_comments
set
  deleted_at = now(),
  deleted_by = auth.uid()
where id = :comment_id
  and user_id = auth.uid();
```

프론트 구현 시 주의:

```txt
delete() 호출 금지
update 후 .select() 붙이지 않는 것이 안전
삭제 성공 후 fetchComments 재조회
필요 시 loadPosts 재조회
```

삭제 표시 규칙:

```txt
- 대댓글 없는 댓글 삭제: 화면에서 숨김
- 대댓글 있는 부모 댓글 삭제: “삭제된 댓글입니다” placeholder 표시
- 삭제된 대댓글: 화면에서 숨김
```

## 12.7 댓글 좋아요

가능 조건:

```txt
로그인 사용자
comment.userId !== user.id
comment.deleted_at is null
```

좋아요:

```sql
insert into public.mg_community_comment_likes (comment_id, user_id)
values (:comment_id, auth.uid());
```

좋아요 취소:

```sql
delete from public.mg_community_comment_likes
where comment_id = :comment_id
  and user_id = auth.uid();
```

`comments.like_count`는 trigger가 자동 동기화한다.

---

# 13. 게시글 정렬 기준

## 13.1 Popular 탭

Popular 탭에서만 인기순 정렬을 사용한다.

정렬 순서:

```txt
1. like_count desc
2. comment_count desc
3. created_at asc
```

의미:

```txt
좋아요 많은 글 우선
같은 좋아요 수면 댓글 많은 글 우선
좋아요/댓글 수가 같으면 오래된 글 우선
```

## 13.2 Popular 제외 모든 탭

All, Questions, Reviews, Tips, Food, Routes, General은 최신순이다.

정렬 순서:

```txt
created_at desc
```

---

# 14. 댓글 정렬 기준

댓글 bottom sheet 안에서는 기본적으로 작성 순서를 유지한다.

```txt
created_at asc
```

대댓글 달린 부모 댓글이 삭제되어도 placeholder는 원래 부모 댓글 위치에 남아야 한다.

```txt
삭제 placeholder가 맨 아래로 이동하면 안 됨
```

---

# 15. 이미지 첨부 기준

## 15.1 제한

```txt
게시글 1개당 이미지 최대 3장
이미지 1장당 최대 5MB
허용 MIME: image/*
```

## 15.2 저장 방식

실제 파일:

```txt
Supabase Storage
bucket: community-post-images
path: {userId}/{timestamp}-{random}.{ext}
```

DB:

```txt
mg_community_posts.image_urls jsonb
```

예:

```json
[
  "https://<project>.supabase.co/storage/v1/object/public/community-post-images/a20de9eb-de57-4001-9e39-da5069fee54f/20260622-032010-a8f3.png"
]
```

## 15.3 목록 카드 표시

게시글 목록에서는 이미지 1장만 표시한다.

여러 장인 경우:

```txt
- 우측 상단에 1/3, 2/3 같은 배지 표시
- 이미지 하단에 점 indicator 표시
- 현재 이미지 점은 진한 회색
- 나머지는 연한 회색
```

## 15.4 현재 주의사항

Storage에는 파일이 업로드되지만, public URL 생성/저장/인코딩 문제로 목록에서 이미지가 깨지는 이슈가 발생한 적이 있다.

의심 원인:

```txt
- image_urls에 public URL이 아닌 값이 저장됨
- Storage path가 URL로 잘못 사용됨
- 파일명에 한글/공백/특수문자가 포함되어 public URL 요청이 깨짐
- getPublicUrl 결과 처리 오류
```

해결 기준:

```txt
- 업로드 path는 ASCII 안전 파일명 사용
- original filename은 path에 쓰지 않는 것이 안전
- getPublicUrl(path)의 data.publicUrl 문자열만 image_urls에 저장
- image_urls에는 string URL 배열만 저장
- blob: URL, File 객체, path 객체 저장 금지
```

---

# 16. 카테고리 기준

현재 Community 카테고리:

```txt
all
popular
question
review
tips
food
routes
general
```

PostComposer 작성 카테고리 순서:

```txt
General
Question
Review
Tips
Food
Routes
```

기본 선택:

```txt
general
```

---

# 17. i18n 기준

Community에서 사용하는 모든 UI 문구는 EN/KO를 모두 처리해야 한다.

대표 문구:

```txt
Community / 커뮤니티
Post / 글쓰기
New Post / 새 글 작성
Edit / 수정
Delete / 삭제
Save / 저장
Cancel / 취소
Comments / 댓글
Reply / 답글
Write a comment... / 댓글을 입력하세요...
Deleted comment / 삭제된 댓글입니다
Add photos / 사진 추가
Remove image / 이미지 제거
Image unavailable / 이미지를 불러올 수 없습니다
Upload failed / 이미지 업로드에 실패했습니다
Too many images / 이미지는 최대 3장까지 첨부할 수 있습니다
Image is too large / 이미지 용량은 1장당 5MB 이하여야 합니다
```

원칙:

```txt
- raw key 화면 노출 금지
- UI 문구만 번역
- 사용자 작성 content는 번역하지 않음
```

---

# 18. 현재 주요 프론트 파일

Community 관련 주요 파일:

```txt
src/pages/CommunityPage.jsx
src/features/community/services/communityService.js
src/features/community/components/PostCard.jsx
src/features/community/components/PostComposer.jsx
src/features/community/components/CommentBottomSheet.jsx
src/features/community/components/PostCommentSection.jsx
src/features/community/components/CommunityTabs.jsx
src/features/community/data/communityPosts.js
src/shared/i18n/dictionary.js
src/shared/utils/avatarColor.js
src/shared/utils/formatTime.js
```

## 18.1 `communityService.js`

역할:

```txt
- fetchPosts
- createPost
- updatePost
- softDeletePost 또는 deletePost 내부 soft delete
- fetchLikedPostIds
- likePost
- unlikePost
- fetchComments
- createComment
- softDeleteComment 또는 deleteComment 내부 soft delete
- fetchLikedCommentIds
- likeComment
- unlikeComment
- uploadPostImages
```

## 18.2 `CommunityPage.jsx`

역할:

```txt
- locale별 게시글 로딩
- category 탭 상태
- popular 정렬 분기
- PostComposer 열기/닫기
- 글 작성/수정/삭제 핸들러
- 좋아요 핸들러
- CommentBottomSheet 열기/닫기
- 댓글 count 반영 위한 재조회
```

## 18.3 `PostCard.jsx`

역할:

```txt
- 게시글 카드 표시
- 작성자 avatar 표시
- 수정/삭제 버튼 조건부 표시
- 좋아요 버튼
- 댓글 bottom sheet 열기
- 이미지 carousel 표시
```

## 18.4 `PostComposer.jsx`

역할:

```txt
- 새 글 작성 bottom sheet
- 글 수정 bottom sheet
- 카테고리 선택
- 이미지 첨부/미리보기/제거
- 3장 제한
- 5MB 제한
- submit 시 Storage upload 후 image_urls 저장
```

## 18.5 `CommentBottomSheet.jsx`

역할:

```txt
- 댓글 bottom sheet
- 댓글 목록
- 대댓글 1depth 표시
- 댓글 작성
- 대댓글 작성
- 댓글 soft delete
- 댓글 좋아요
- 삭제된 부모 댓글 placeholder 표시
```

---

# 19. Avatar 기준

현재 실제 프로필 이미지 테이블은 없다.

```txt
mg_profiles 없음
avatar_url 없음
```

Community와 MyPage는 `user.id` 또는 `authorName` 기반 deterministic avatar color를 사용한다.

관련 파일:

```txt
src/shared/utils/avatarColor.js
```

원칙:

```txt
같은 userId면 같은 색상/이니셜 표시
목록 순서가 바뀌어도 avatar 색상이 바뀌면 안 됨
```

실제 프로필 이미지 기능은 후속 작업이다.

후속 확장 예시:

```sql
create table public.mg_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

# 20. 시간 표시 기준

게시글과 댓글 시간 표시는 공통 규칙을 사용한다.

```txt
2일 미만: 상대 시간
예: 18m, 3h, 1d

2일 이상: 절대 시간
예: 2026.06.22 02:24
```

관련 파일:

```txt
src/shared/utils/formatTime.js
```

---

# 21. 추천 알고리즘 확장 시 주의

향후 Community 데이터를 동선 추천 알고리즘에 반영할 수 있다.

단순히 장소 태그 횟수만 추천 점수로 사용하면 위험하다.

이유:

```txt
많이 언급된 장소가 반드시 긍정적인 장소는 아님
부정 후기, 질문, 불만, 혼잡도 언급도 포함될 수 있음
```

추천 반영 시 권장 방향:

```txt
커뮤니티 mention_count: 약한 가산
좋아요 많은 review/tips 글: 강한 가산
question 글: 중립 또는 매우 약한 가산
부정 키워드 포함 글: 감점 후보
최근 30일 언급: 약간 가산
삭제된 글: 추천 신호에서 제외 또는 매우 약하게 반영
```

후속으로 장소 태그 기능을 만들 경우 별도 테이블을 고려한다.

예시:

```sql
create table public.mg_community_post_place_tags (
  id bigserial primary key,
  post_id bigint not null references public.mg_community_posts(id) on delete cascade,
  place_id bigint not null references public.mg_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, place_id)
);
```

---

# 22. 상태 확인용 SQL

## 22.1 테이블 존재 확인

```sql
select
  to_regclass('public.mg_community_posts') as posts,
  to_regclass('public.mg_community_post_likes') as post_likes,
  to_regclass('public.mg_community_comments') as comments,
  to_regclass('public.mg_community_comment_likes') as comment_likes;
```

## 22.2 컬럼 확인

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'mg_community_posts',
    'mg_community_post_likes',
    'mg_community_comments',
    'mg_community_comment_likes'
  )
order by table_name, ordinal_position;
```

## 22.3 RLS 정책 확인

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
    'mg_community_posts',
    'mg_community_post_likes',
    'mg_community_comments',
    'mg_community_comment_likes'
  )
order by tablename, policyname;
```

## 22.4 Trigger 확인

```sql
select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'mg_community_posts',
    'mg_community_post_likes',
    'mg_community_comments',
    'mg_community_comment_likes'
  )
order by event_object_table, trigger_name, event_manipulation;
```

## 22.5 Storage bucket 확인

```sql
select id, name, public
from storage.buckets
where id = 'community-post-images';
```

## 22.6 Storage policy 확인

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Public can read community post images',
    'Authenticated users can upload own community post images'
  )
order by policyname;
```

## 22.7 게시글 이미지 확인

```sql
select id, user_id, content, image_url, image_urls, created_at
from public.mg_community_posts
order by created_at desc
limit 20;
```

---

# 23. 현재 주의할 점

## 23.1 hard delete 금지

Community에서는 게시글/댓글에 대해 hard delete를 사용하지 않는다.

```txt
supabase.from(...).delete() 사용 금지
```

대신 update를 사용한다.

```txt
posts:
is_published = false
deleted_at = now
deleted_by = user.id

comments:
deleted_at = now
deleted_by = user.id
```

## 23.2 update 후 `.select()` 주의

soft delete update 후 `.select()`를 붙이면 RLS select 정책과 충돌해 403이 날 수 있다.

권장:

```txt
update 실행
error만 확인
성공 후 목록 재조회
```

## 23.3 Storage 파일 삭제 금지

```txt
storage.remove() 호출 금지
Storage delete policy 없음
```

## 23.4 image_urls 값 검증

`image_urls`에는 반드시 public URL 문자열 배열만 저장한다.

정상:

```json
[
  "https://.../storage/v1/object/public/community-post-images/userId/file.png"
]
```

비정상:

```txt
File 객체
Blob 객체
blob:http://localhost...
{ publicUrl: "..." }
{ path: "..." }
undefined
null
빈 문자열
```

---

# 24. 현재 결론

Community는 현재 다음 구조를 기준으로 한다.

```txt
게시글:
mg_community_posts

게시글 좋아요:
mg_community_post_likes

댓글/대댓글:
mg_community_comments

댓글 좋아요:
mg_community_comment_likes

이미지:
Supabase Storage community-post-images
DB 연결:
mg_community_posts.image_urls
```

삭제는 모두 soft delete이며, 이미지 파일은 삭제하지 않는다.

한/영 UI는 dictionary로 처리하고, 사용자 작성 내용은 번역하지 않는다.

향후 장소 태그/코스 태그/추천 알고리즘 반영을 위해 현재 구조를 유지한다.


※ 이 문서는 2026-06-22 기준 Community 구현/DDL 기준이며, 이후 이미지 public URL 400 오류 수정 결과에 따라 image_urls 처리 방식은 일부 보완될 수 있음.