# User Nickname Auto-generation and Uniqueness Supabase SQL

- 작성 일시: 2026-07-12 23:11 KST
- 이 문서의 SQL은 **AI 에이전트가 실행하지 않았다.** 사용자가 Supabase SQL Editor에서 직접 실행해야 한다.
- 순서: 1) 실행 전 확인 → 2) 본 실행(트랜잭션) → 3) 실행 후 검증 → 4) 앱에서 회원가입/닉네임 변경 수동 확인 → (필요 시) rollback.
- 이 SQL은 신규 테이블 1개(`mg_user_profiles`) + RPC 2개(`set_my_nickname`, `is_nickname_available`)만 다룬다. **기존 `set_updated_at()`, `sync_my_author_name()`, 커뮤니티/리뷰/북마크/코스 테이블·정책·버킷, `ail_*` 객체는 절대 변경하지 않는다.**
- `set_my_nickname()`은 내부에서 기존 `sync_my_author_name()`을 그대로 호출해 커뮤니티 글·댓글·리뷰 author_name 동기화를 재사용한다(로직 복제 없음).

---

## 1. 실행 전 확인

```sql
-- 신규 객체 이름이 이미 존재하는지 확인 (전부 null 이어야 새로 생성 가능)
select
  to_regclass('public.mg_user_profiles') as user_profiles;

-- 신규 함수 이름 충돌 확인 (0행이어야 함)
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('set_my_nickname', 'is_nickname_available');

-- 기존 set_updated_at() 함수 존재 확인 (1행이어야 재사용 가능 — 새로 만들지 않는다)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_updated_at';

-- 기존 sync_my_author_name() 함수 존재 확인 (1행이어야 재사용 가능 — 새로 만들지 않는다)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'sync_my_author_name';
```

**해석 기준**: `mg_user_profiles`는 null(존재하지 않음), 신규 함수 2개는 0행, `set_updated_at`/`sync_my_author_name`은 각 1행이어야 정상이다. 하나라도 다르면 **2번 본 실행 SQL을 실행하지 말고 중단**한다.

**트랜잭션 안내**: 아래 "2. 본 실행 SQL"은 `begin; ... commit;`으로 감싸여 있어 그 안의 모든 statement가 하나의 트랜잭션으로 처리된다. 중간에 오류가 나면 전체가 자동으로 롤백되어 절반만 생성되는 상태가 되지 않는다.

---

## 2. 본 실행 SQL

```sql
begin;

-- ============================================================
-- 2.1 사용자 닉네임 프로필 테이블
-- ============================================================
-- 프로필 사진 컬럼은 이번 작업 범위가 아니므로 추가하지 않는다.
-- nickname: 사용자에게 표시되는 원문. nickname_normalized: btrim + lower한 중복 검사 전용 값.

create table public.mg_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null
    check (char_length(btrim(nickname)) between 2 and 20 and nickname !~ '[\r\n]'),
  nickname_normalized text not null unique
    check (nickname_normalized = lower(btrim(nickname))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mg_user_profiles_set_updated_at
before update on public.mg_user_profiles
for each row execute function public.set_updated_at();

-- ============================================================
-- 2.2 닉네임 확보 RPC — 회원가입 직후/최초 세션/마이페이지 변경 공용
-- ============================================================
-- p_preferred_nickname이 있으면 그 값을 그대로 확보 시도(중복이면 23505로 실패, 자동 대체 없음).
-- null이면: 이미 프로필이 있으면 그대로 반환(멱등 — 재로그인마다 재생성하지 않음),
--           프로필이 없으면 auth.users의 기존 display_name을 우선 재사용 시도(기존 사용자 보존),
--           그것도 없거나 이미 사용 중이면 matgiler+6자리 숫자를 중복 없을 때까지 재생성한다.
-- DB unique 제약(nickname_normalized)이 race condition의 최종 방어선이다.

create or replace function public.set_my_nickname(p_preferred_nickname text default null)
returns table(nickname text, generated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trimmed text;
  v_existing_nickname text;
  v_existing_display_name text;
  v_candidate text;
  v_candidate_norm text;
  v_generated boolean := false;
  v_inserted boolean := false;
  v_attempt int := 0;
  v_max_attempts constant int := 20;
begin
  if v_uid is null then
    raise exception 'set_my_nickname: must be called by an authenticated user' using errcode = '28000';
  end if;

  v_trimmed := nullif(btrim(p_preferred_nickname), '');

  -- 멱등성: 특정 값을 요청한 게 아니고 이미 프로필이 있으면 그대로 반환(재로그인마다 재생성 금지).
  if v_trimmed is null then
    select p.nickname into v_existing_nickname
      from public.mg_user_profiles p where p.user_id = v_uid;
    if v_existing_nickname is not null then
      return query select v_existing_nickname, false;
      return;
    end if;
  end if;

  if v_trimmed is not null then
    if length(v_trimmed) < 2 or length(v_trimmed) > 20 or v_trimmed ~ '[\r\n]' then
      raise exception 'set_my_nickname: nickname must be 2-20 characters with no line breaks'
        using errcode = '22023';
    end if;

    v_candidate := v_trimmed;
    v_candidate_norm := lower(v_candidate);

    begin
      insert into public.mg_user_profiles (user_id, nickname, nickname_normalized, updated_at)
      values (v_uid, v_candidate, v_candidate_norm, now())
      on conflict (user_id) do update
        set nickname = excluded.nickname,
            nickname_normalized = excluded.nickname_normalized,
            updated_at = now();
    exception when unique_violation then
      raise exception 'set_my_nickname: nickname already in use' using errcode = '23505';
    end;
    v_generated := false;

  else
    -- 프로필 없음 + 지정 닉네임 없음: 기존 display_name(가입 전 수동 세팅 포함)을 먼저 시도.
    select nullif(btrim(u.raw_user_meta_data ->> 'display_name'), '')
      into v_existing_display_name
      from auth.users u where u.id = v_uid;

    if v_existing_display_name is not null
       and length(v_existing_display_name) between 2 and 20
       and v_existing_display_name !~ '[\r\n]' then
      begin
        insert into public.mg_user_profiles (user_id, nickname, nickname_normalized, updated_at)
        values (v_uid, v_existing_display_name, lower(v_existing_display_name), now());
        v_candidate := v_existing_display_name;
        v_generated := false;
        v_inserted := true;
      exception when unique_violation then
        v_inserted := false; -- 다른 사용자가 이미 같은 이름 사용 중 — 아래 자동 생성으로 대체
      end;
    end if;

    if not v_inserted then
      loop
        v_attempt := v_attempt + 1;
        v_candidate := 'matgiler' || lpad(floor(random() * 1000000)::int::text, 6, '0');
        v_candidate_norm := lower(v_candidate);
        begin
          insert into public.mg_user_profiles (user_id, nickname, nickname_normalized, updated_at)
          values (v_uid, v_candidate, v_candidate_norm, now());
          v_generated := true;
          exit;
        exception when unique_violation then
          if v_attempt >= v_max_attempts then
            raise exception 'set_my_nickname: could not generate a unique nickname after % attempts', v_max_attempts;
          end if;
          -- 계속 반복 — 다음 시도에서 새 랜덤값으로 재시도
        end;
      end loop;
    end if;
  end if;

  -- auth.users.raw_user_meta_data.display_name도 같은 값으로 갱신.
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('display_name', v_candidate)
   where id = v_uid;

  -- 커뮤니티 글/댓글/리뷰 author_name snapshot 동기화 — 기존 RPC를 그대로 재사용한다.
  -- sync_my_author_name()은 auth.uid()로 호출자를 식별하므로, 같은 트랜잭션 내에서
  -- 호출해도 이 함수를 호출한 사용자 본인 기준으로 정확히 동작한다.
  perform public.sync_my_author_name();

  return query select v_candidate, v_generated;
end;
$$;

revoke all on function public.set_my_nickname(text) from public, anon;
grant execute on function public.set_my_nickname(text) to authenticated;

-- ============================================================
-- 2.3 닉네임 availability 확인 RPC (boolean만 반환, 프로필 데이터 노출 없음)
-- ============================================================
-- 회원가입 화면(아직 세션 없음)에서도 UX용으로 미리 확인할 수 있도록 anon도 허용한다.
-- 로그인 사용자가 자신의 현재 닉네임을 조회하면 "사용 가능"으로 처리한다(본인 행 제외).

create or replace function public.is_nickname_available(p_nickname text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    btrim(coalesce(p_nickname, '')) <> ''
    and length(btrim(p_nickname)) between 2 and 20
    and p_nickname !~ '[\r\n]'
    and not exists (
      select 1 from public.mg_user_profiles p
      where p.nickname_normalized = lower(btrim(p_nickname))
        and (auth.uid() is null or p.user_id <> auth.uid())
    );
$$;

revoke all on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to anon, authenticated;

-- ============================================================
-- 2.4 RLS
-- ============================================================
-- 공개 사용자 프로필 기능이 아직 없으므로 전체 SELECT는 허용하지 않는다 — 자신의 행만 조회 가능.
-- 쓰기는 RPC(SECURITY DEFINER) 전용 — authenticated에 INSERT/UPDATE/DELETE grant 자체를 주지 않는다.

alter table public.mg_user_profiles enable row level security;

create policy "user profiles select own" on public.mg_user_profiles
  for select to authenticated using (user_id = auth.uid());

-- ============================================================
-- 2.5 최소 권한 grant (선 revoke, 후 필요한 것만 grant)
-- ============================================================

revoke all on public.mg_user_profiles from public, anon, authenticated;
grant select on public.mg_user_profiles to authenticated;

commit;
```

---

## 3. 실행 후 검증

```sql
-- 테이블/RLS/정책 확인
select
  to_regclass('public.mg_user_profiles') as user_profiles,
  (select relrowsecurity from pg_class where oid = 'public.mg_user_profiles'::regclass) as rls_enabled;

select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'mg_user_profiles';

-- 테이블 권한 확인 (authenticated는 select만 있어야 하고 insert/update/delete는 없어야 한다)
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'mg_user_profiles'
order by grantee, privilege_type;

-- RPC 권한 확인
select
  has_function_privilege('anon', 'public.set_my_nickname(text)', 'execute') as anon_can_set_nickname,
  has_function_privilege('authenticated', 'public.set_my_nickname(text)', 'execute') as auth_can_set_nickname,
  has_function_privilege('anon', 'public.is_nickname_available(text)', 'execute') as anon_can_check_availability,
  has_function_privilege('authenticated', 'public.is_nickname_available(text)', 'execute') as auth_can_check_availability;
```

**해석 기준**: `user_profiles`는 not null, `rls_enabled`는 true, 정책은 `user profiles select own` 1개(select/authenticated)만 있어야 한다. 테이블 grant는 `authenticated`에 `SELECT`만 있어야 하고 `INSERT`/`UPDATE`/`DELETE`는 **나오지 않아야** 한다(쓰기는 RPC 전용). `anon_can_set_nickname`은 **false**, `auth_can_set_nickname`은 **true**, `anon_can_check_availability`/`auth_can_check_availability`는 둘 다 **true**여야 정상이다.

## 4. 앱에서 수동 확인

1. 닉네임을 입력하지 않고 회원가입 → 로그인 직후 `matgiler` + 6자리 숫자 닉네임이 MyPage에 표시되는지 확인.
2. 닉네임을 입력하고 회원가입 → 입력한 닉네임 그대로 반영되는지 확인.
3. 이미 존재하는 닉네임(대소문자만 다르게, 예: `Matgiler123` vs `matgiler123`)으로 가입/변경 시도 → "이미 사용 중인 닉네임이에요." 안내가 뜨는지 확인.
4. MyPage에서 닉네임 변경 후 커뮤니티 글/댓글, 리뷰의 작성자 표시가 새 닉네임으로 바뀌는지 확인.
5. 같은 계정으로 재로그인했을 때 닉네임이 매번 새로 생성되지 않고 그대로 유지되는지 확인.

---

## 5. Rollback SQL

이번에 만든 객체(신규 테이블 1개 + RPC 2개)만 역순으로 제거한다. **기존 `set_updated_at()`, `sync_my_author_name()`, 커뮤니티/리뷰/북마크/코스 테이블·정책·버킷, `ail_*` 객체는 절대 건드리지 않는다.** 이 rollback은 `auth.users.raw_user_meta_data.display_name`에 이미 반영된 닉네임 값은 되돌리지 않는다 — 이는 정상적인 데이터였으므로 되돌릴 이유가 없다.

```sql
begin;

revoke all on public.mg_user_profiles from authenticated;

revoke all on function public.is_nickname_available(text) from anon, authenticated;
drop function if exists public.is_nickname_available(text);

revoke all on function public.set_my_nickname(text) from authenticated;
drop function if exists public.set_my_nickname(text);

drop policy if exists "user profiles select own" on public.mg_user_profiles;
drop trigger if exists mg_user_profiles_set_updated_at on public.mg_user_profiles;
drop table if exists public.mg_user_profiles cascade;

commit;
```
