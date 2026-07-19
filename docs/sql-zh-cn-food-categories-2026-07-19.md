# 음식 카테고리 zh-CN 번역 추가 SQL

- 작성 일시: 2026-07-19 KST
- 목적: `public.mg_food_category_translations`에 이미 존재하는 18개 카테고리(en 18건, ko 18건)에 `locale='zh-CN'` 번역 18건을 추가한다. 기존 en/ko 행은 절대 수정하지 않는다.
- 실행 주체: 이 문서의 SQL은 자동 실행하지 않았다. 사용자가 Supabase SQL Editor에서 직접 실행해야 한다.
- 전제: `docs/sql-food-categories-2026-07-11.md`의 DDL(테이블 생성)이 이미 실행되어 `mg_food_categories`/`mg_food_category_translations`가 존재하는 상태.

## 1. 실행 전 확인

```sql
-- mg_food_categories가 18행이어야 한다 (docs/sql-food-categories-2026-07-11.md 기준)
select count(*) as categories from public.mg_food_categories;

-- 현재 locale 분포: en 18 / ko 18 / zh-CN 0 이어야 한다 (아직 zh-CN을 넣지 않은 상태)
select locale, count(*) from public.mg_food_category_translations group by locale order by locale;

-- 18개 category_key가 en/ko 두 문서(docs/sql-food-categories-2026-07-11.md)와 정확히 일치하는지 확인
select key from public.mg_food_categories order by sort_order;
```

`categories`가 18이 아니거나, `mg_food_categories`의 key 목록이 아래 18개(`bbq, noodle, stew, seafood, chicken, street, cafe, rice, pork, chinese, japanese, western, pasta, pizza, burger, indian, southeast_asian, other`)와 다르면 실행을 중단하고 먼저 원인을 확인한다.

## 2. zh-CN 번역 upsert (18건)

`category_key`는 위 확인 SQL로 조회한 기존 en/ko 행과 정확히 같은 18개 key를 그대로 사용한다. `description`은 en/ko와 마찬가지로 이번에도 채우지 않는다(NULL 허용 — 기존 en/ko 행도 전부 NULL).

`ON CONFLICT (category_key, locale)`는 이 문서를 재실행해도 안전하도록 zh-CN 행만 갱신한다 — en/ko 행은 `locale` 값이 다르므로 이 upsert의 대상이 될 수 없다.

```sql
begin;

insert into public.mg_food_category_translations (category_key, locale, label) values
('bbq','zh-CN','烤肉'),
('noodle','zh-CN','面食'),
('stew','zh-CN','炖汤'),
('seafood','zh-CN','海鲜'),
('chicken','zh-CN','炸鸡'),
('street','zh-CN','街头小吃'),
('cafe','zh-CN','咖啡·甜点'),
('rice','zh-CN','盖饭·饭类'),
('pork','zh-CN','猪肉料理'),
('chinese','zh-CN','中餐'),
('japanese','zh-CN','日式料理'),
('western','zh-CN','西式料理'),
('pasta','zh-CN','意面'),
('pizza','zh-CN','披萨'),
('burger','zh-CN','汉堡'),
('indian','zh-CN','印度菜'),
('southeast_asian','zh-CN','东南亚菜'),
('other','zh-CN','其他')
on conflict (category_key, locale) do update set
  label = excluded.label,
  updated_at = now();

commit;
```

## 3. 실행 후 검증

```sql
-- 전체 번역 행 수: 18(en) + 18(ko) + 18(zh-CN) = 54
select count(*) as translations from public.mg_food_category_translations; -- 54

-- locale별 건수: en 18 / ko 18 / zh-CN 18
select locale, count(*) from public.mg_food_category_translations group by locale order by locale;

-- en/ko 행이 이번 작업으로 변경되지 않았는지 확인 (updated_at이 이번 실행 이전 값이어야 함 — 실행 직전에 최댓값을 기록해두고 비교 권장)
select category_key, locale, label, updated_at
from public.mg_food_category_translations
where locale in ('en','ko')
order by category_key, locale;

-- zh-CN 18건 전체 확인
select category_key, locale, label
from public.mg_food_category_translations
where locale = 'zh-CN'
order by category_key;

-- bbq의 zh-CN label 확인
select category_key, locale, label from public.mg_food_category_translations
where category_key = 'bbq' and locale = 'zh-CN'; -- bbq / zh-CN / 烤肉

-- 카테고리 key 누락 확인: mg_places에서 쓰이는 key 중 category 테이블에 없는 것 (0행이어야 함, docs/sql-food-categories-2026-07-11.md와 동일 조건)
select distinct k.key
from (select unnest(matgil_category_keys) as key from public.mg_places) k
left join public.mg_food_categories c on c.key = k.key
where c.key is null; -- 0행
```

## 4. rollback (사용자가 필요 시 직접 실행)

zh-CN 행만 제거한다 — en/ko 행과 테이블 자체는 건드리지 않는다.

```sql
begin;
delete from public.mg_food_category_translations where locale = 'zh-CN';
commit;
```

## 5. 기대 행 개수 요약

| 시점 | en | ko | zh-CN | 합계 |
|---|---:|---:|---:|---:|
| 실행 전 | 18 | 18 | 0 | 36 |
| 실행 후 | 18 | 18 | 18 | 54 |

실행 후 en/ko 각각 18건에서 변화가 없어야 한다 — 변화가 있으면 즉시 롤백하고 원인을 확인한다.

## 6. 순서

1. 1절 실행 전 확인 SQL로 현재 상태가 예상과 같은지 확인
2. 2절 transaction 전체 실행
3. 3절 실행 후 검증 SQL로 54건/18건씩 분포 확인
4. 앱에서 zh-CN 선택 후 Food type 필터에 중국어 카테고리명이 보이는지 육안 확인

en/ko 건수가 실행 전후로 달라지거나, zh-CN이 18건이 아니면 배포(사용을) 중단하고 원인을 확인한다.
