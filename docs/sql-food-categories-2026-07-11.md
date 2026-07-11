# 음식 카테고리 DB 전환 SQL

- 작성 일시: 2026-07-11 KST
- 목적: 기존 `mg_places.matgil_category_keys` 배열은 변경하지 않고, 카테고리 메타데이터와 EN/KO 표시값을 DB에 추가한다.
- 실행 주체: 이 문서의 SQL은 자동 실행하지 않았다. 사용자가 Supabase SQL Editor에서 직접 실행해야 한다.

## 1. 실행 전 확인

```sql
select to_regclass('public.mg_food_categories') as categories_table,
       to_regclass('public.mg_food_category_translations') as translations_table;

select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_updated_at';

select distinct unnest(matgil_category_keys) as key
from public.mg_places order by 1;
```

두 테이블은 `null`, `set_updated_at`은 1행, key는 지시서의 18개여야 한다. 다르면 아래 DDL을 실행하지 말고 중단한다.

## 2. DDL, RLS, 권한, seed (하나의 transaction)

```sql
begin;

create table public.mg_food_categories (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  icon_key text not null default 'default',
  sort_order integer not null default 999,
  is_active boolean not null default false,
  is_filterable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  deleted_at timestamptz null,
  deleted_by uuid null
);

create table public.mg_food_category_translations (
  category_key text not null references public.mg_food_categories(key) on delete restrict,
  locale text not null check (btrim(locale) <> ''),
  label text not null check (btrim(label) <> ''),
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  updated_by uuid null,
  primary key (category_key, locale)
);

create trigger mg_food_categories_set_updated_at
before update on public.mg_food_categories
for each row execute function public.set_updated_at();

create trigger mg_food_category_translations_set_updated_at
before update on public.mg_food_category_translations
for each row execute function public.set_updated_at();

alter table public.mg_food_categories enable row level security;
alter table public.mg_food_category_translations enable row level security;

create policy "food categories public read" on public.mg_food_categories
for select to anon, authenticated using (true);
create policy "food category translations public read" on public.mg_food_category_translations
for select to anon, authenticated using (true);

grant select on public.mg_food_categories, public.mg_food_category_translations to anon, authenticated;
revoke insert, update, delete on public.mg_food_categories, public.mg_food_category_translations from anon, authenticated;

insert into public.mg_food_categories (key, icon_key, sort_order, is_active, is_filterable) values
('bbq','bbq',10,true,true), ('noodle','noodle',20,true,true),
('stew','stew',30,true,true), ('seafood','default',40,true,true),
('chicken','chicken',50,true,true), ('street','street',60,true,true),
('cafe','cafe',70,true,true), ('rice','default',80,true,true),
('pork','default',90,true,true), ('chinese','default',100,true,true),
('japanese','default',110,true,true), ('western','default',120,true,true),
('pasta','default',130,true,true), ('pizza','default',140,true,true),
('burger','default',150,true,true), ('indian','default',160,true,true),
('southeast_asian','default',170,true,true), ('other','default',999,true,true)
on conflict (key) do update set
  icon_key = excluded.icon_key, sort_order = excluded.sort_order,
  is_active = excluded.is_active, is_filterable = excluded.is_filterable,
  updated_at = now();

insert into public.mg_food_category_translations (category_key, locale, label) values
('bbq','en','Korean BBQ'),('bbq','ko','고기 구이'),
('noodle','en','Noodles'),('noodle','ko','면 요리'),
('stew','en','Stew & Soup'),('stew','ko','찌개·탕'),
('seafood','en','Seafood'),('seafood','ko','해산물'),
('chicken','en','Chicken'),('chicken','ko','치킨'),
('street','en','Street Food'),('street','ko','길거리 음식'),
('cafe','en','Cafe & Dessert'),('cafe','ko','카페·디저트'),
('rice','en','Rice Meals'),('rice','ko','밥·덮밥'),
('pork','en','Pork Cutlet & Pork'),('pork','ko','돼지고기'),
('chinese','en','Chinese'),('chinese','ko','중식'),
('japanese','en','Japanese'),('japanese','ko','일식'),
('western','en','Western'),('western','ko','양식'),
('pasta','en','Pasta'),('pasta','ko','파스타'),
('pizza','en','Pizza'),('pizza','ko','피자'),
('burger','en','Burger'),('burger','ko','버거'),
('indian','en','Indian'),('indian','ko','인도 음식'),
('southeast_asian','en','Southeast Asian'),('southeast_asian','ko','동남아 음식'),
('other','en','Other'),('other','ko','기타')
on conflict (category_key, locale) do update set
  label = excluded.label, updated_at = now();

commit;
```

## 3. 실행 후 검증

```sql
select count(*) as categories from public.mg_food_categories; -- 18
select count(*) as translations from public.mg_food_category_translations; -- 36
select locale, count(*) from public.mg_food_category_translations group by locale order by locale; -- en 18, ko 18

select distinct k.key
from (select unnest(matgil_category_keys) as key from public.mg_places) k
left join public.mg_food_categories c on c.key = k.key
where c.key is null; -- 0행

select category_key, locale, label from public.mg_food_category_translations
where category_key = 'bbq' and locale = 'ko'; -- bbq / ko / 고기 구이

select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies where schemaname='public'
and tablename in ('mg_food_categories','mg_food_category_translations') order by tablename;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public'
and table_name in ('mg_food_categories','mg_food_category_translations')
and grantee in ('anon','authenticated') order by table_name, grantee, privilege_type;
```

18/36/locale 건수, 누락 key 0행, `고기 구이`, SELECT 정책·권한만 확인한다. 하나라도 다르면 배포를 중단한다.

## 4. rollback (사용자가 필요시 직접 실행)

```sql
begin;
drop table if exists public.mg_food_category_translations;
drop table if exists public.mg_food_categories;
commit;
```

순서: 1) 실행 전 확인 2) transaction 전체 실행 3) 실행 후 검증 4) 앱 EN/KO 수동 확인. DDL/seed 오류, 기존 테이블 발견, 함수 누락, 실사용 key 불일치 시 즉시 중단한다.
