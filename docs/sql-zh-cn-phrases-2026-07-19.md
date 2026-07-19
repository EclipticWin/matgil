# 표현/표현 카테고리 zh-CN 번역 추가 SQL

- 작성 일시: 2026-07-19 KST
- 목적: `public.mg_phrase_categories`(8건)의 `label_zh`와 `public.mg_phrases`(85건)의 `zh_text`를 채운다.
- 실행 주체: 이 문서의 SQL은 자동 실행하지 않았다. 사용자가 Supabase SQL Editor에서 직접 실행해야 한다.
- 전제: `docs/sql-phrases-db-common-bookmark-2026-06-27.md`의 DDL/seed(카테고리 8건, 표현 85건, `ja_text`/`zh_text` 컬럼)가 이미 실행되어 있는 상태.

## 안전 원칙

- `phrase_key`, `id`, `category`, `sort_order`, `ko_text`, `romanization`, `en_text`, `note`는 이 문서의 어떤 SQL로도 변경되지 않는다 — 오직 `label_zh`/`zh_text` 컬럼만 대상으로 한다.
- **UPDATE만 사용하고 INSERT는 사용하지 않는다** — 카테고리 8건, 표현 85건은 이미 DB에 존재하는 행이므로 새로 만들 필요가 없다.
- 각 UPDATE는 `WHERE (label_zh IS NULL OR btrim(label_zh) = '')` / `WHERE (zh_text IS NULL OR btrim(zh_text) = '')` 조건을 걸어, **이미 값이 채워진 행은 절대 덮어쓰지 않는다.** 이미 `docs/sql-phrases-db-common-bookmark-2026-06-27.md` seed 시점에 `zh_text`/`label_zh`가 전부 `NULL`이었으므로(현재 상태: 85건/8건 모두 0건) 이 문서를 최초 실행하면 전부 채워지고, 이후 재실행해도(이미 채워진 값이 있으므로) 아무 행도 바뀌지 않는 멱등(idempotent) 동작이다.
- `id`/`phrase_key` 기준으로 정확히 1:1 매칭해 업데이트한다 — 카테고리별 묶음으로 나누지 않고 표현 85건을 한 번의 `UPDATE ... FROM (VALUES ...)` 문으로 처리해 실행 순서 실수를 줄인다.

## 1. 실행 전 확인

```sql
-- 카테고리 8건, label_zh는 전부 NULL이어야 한다
select count(*) as categories, count(label_zh) as has_label_zh
from public.mg_phrase_categories;

-- 표현 85건, zh_text는 전부 NULL이어야 한다
select count(*) as phrases, count(zh_text) as has_zh_text
from public.mg_phrases;

-- phrase_key가 이 문서의 85개와 정확히 일치하는지(카테고리별 건수: waiting 10 / arriving 10 / menu 10 / allergy 15 / ordering 10 / extra 10 / paying 10 / leaving 10)
select category, count(*) from public.mg_phrases group by category order by category;
```

건수가 다르면(특히 `has_label_zh`/`has_zh_text`가 0이 아니면) 실행을 중단하고 원인을 먼저 확인한다 — 이미 누군가 다른 경로로 zh 데이터를 채웠을 수 있다.

## 2. mg_phrase_categories.label_zh 업데이트 (8건)

```sql
begin;

update public.mg_phrase_categories as c set
  label_zh = v.label_zh,
  updated_at = now()
from (values
  ('waiting',  '等待'),
  ('arriving', '入座'),
  ('menu',     '选择菜单'),
  ('allergy',  '过敏与饮食禁忌'),
  ('ordering', '点餐'),
  ('extra',    '额外要求'),
  ('paying',   '结账'),
  ('leaving',  '离开')
) as v(id, label_zh)
where c.id = v.id
  and (c.label_zh is null or btrim(c.label_zh) = '');

commit;
```

## 3. mg_phrases.zh_text 업데이트 (85건)

`phrase_key` 기준으로 매칭한다 — `docs/sql-phrases-db-common-bookmark-2026-06-27.md`의 seed와 정확히 같은 85개 `phrase_key`를 사용하며, 순서나 값을 바꾸지 않았다.

```sql
begin;

update public.mg_phrases as p set
  zh_text = v.zh_text,
  updated_at = now()
from (values
  -- waiting (10)
  ('waiting-01', '需要等位吗？'),
  ('waiting-02', '大概要等多久？'),
  ('waiting-03', '可以先登记排队吗？'),
  ('waiting-04', '我一个人。'),
  ('waiting-05', '我们两个人。'),
  ('waiting-06', '我们带着孩子。'),
  ('waiting-07', '到我们的时候请叫我们。'),
  ('waiting-08', '请叫我的名字。'),
  ('waiting-09', '可以在外面等吗？'),
  ('waiting-10', '我马上回来。'),
  -- arriving (10)
  ('arriving-01', '一位，谢谢。'),
  ('arriving-02', '两位，谢谢。'),
  ('arriving-03', '我们带着孩子。'),
  ('arriving-04', '有空位吗？'),
  ('arriving-05', '可以坐这里吗？'),
  ('arriving-06', '可以坐窗边吗？'),
  ('arriving-07', '我有预约。'),
  ('arriving-08', '我们没有预约。'),
  ('arriving-09', '可以分开坐吗？'),
  ('arriving-10', '可以坐一起吗？'),
  -- menu (10)
  ('menu-01', '有英文菜单吗？'),
  ('menu-02', '有什么推荐的吗？'),
  ('menu-03', '哪道菜最受欢迎？'),
  ('menu-04', '这个辣吗？'),
  ('menu-05', '可以做得不辣一点吗？'),
  ('menu-06', '这里面有肉吗？'),
  ('menu-07', '这里面有海鲜吗？'),
  ('menu-08', '这是一人份吗？'),
  ('menu-09', '这个够两个人吃吗？'),
  ('menu-10', '这是什么菜？'),
  -- allergy (15)
  ('allergy-01', '这个不含麸质吗？'),
  ('allergy-02', '这里面有猪肉吗？'),
  ('allergy-03', '这里面有牛肉吗？'),
  ('allergy-04', '这里面有鸡肉吗？'),
  ('allergy-05', '这里面有海鲜吗？'),
  ('allergy-06', '这里面有贝类吗？'),
  ('allergy-07', '这里面有花生吗？'),
  ('allergy-08', '这里面有鸡蛋吗？'),
  ('allergy-09', '这里面有乳制品吗？'),
  ('allergy-10', '我对坚果过敏。'),
  ('allergy-11', '我对海鲜过敏。'),
  ('allergy-12', '我不能吃猪肉。'),
  ('allergy-13', '我吃素。'),
  ('allergy-14', '有素食选择吗？'),
  ('allergy-15', '请不要放这个食材。'),
  -- ordering (10)
  ('ordering-01', '我要这个。'),
  ('ordering-02', '一份这个，谢谢。'),
  ('ordering-03', '两份这个，谢谢。'),
  ('ordering-04', '我们要点餐了。'),
  ('ordering-05', '请给我水。'),
  ('ordering-06', '请给我小菜。'),
  ('ordering-07', '可以再点一些吗？'),
  ('ordering-08', '跟他们一样的，谢谢。'),
  ('ordering-09', '请不要做辣。'),
  ('ordering-10', '先这些就好。'),
  -- extra (10)
  ('extra-01', '请再给我一些泡菜。'),
  ('extra-02', '请再给我一些米饭。'),
  ('extra-03', '请给我叉子。'),
  ('extra-04', '请给我剪刀。'),
  ('extra-05', '请给我勺子。'),
  ('extra-06', '可以打包吗？'),
  ('extra-07', '请再给我一些纸巾。'),
  ('extra-08', '请给我一个小盘子。'),
  ('extra-09', '酱料请放旁边。'),
  ('extra-10', '请给我筷子。'),
  -- paying (10)
  ('paying-01', '买单，谢谢。'),
  ('paying-02', '可以刷卡吗？'),
  ('paying-03', '可以分开付款吗？'),
  ('paying-04', '请给我收据。'),
  ('paying-05', '在哪里付款？'),
  ('paying-06', '是先付款吗？'),
  ('paying-07', '是在柜台付款吗？'),
  ('paying-08', '可以各自付款吗？'),
  ('paying-09', '可以用国外的卡吗？'),
  ('paying-10', '请确认一下账单。'),
  -- leaving (10)
  ('leaving-01', '谢谢。'),
  ('leaving-02', '很好吃。'),
  ('leaving-03', '我们该走了。'),
  ('leaving-04', '可以把剩下的打包吗？'),
  ('leaving-05', '再见。'),
  ('leaving-06', '谢谢款待。'),
  ('leaving-07', '都很好吃。'),
  ('leaving-08', '祝你有美好的一天。'),
  ('leaving-09', '我们真的很喜欢。'),
  ('leaving-10', '我们会再来的。')
) as v(phrase_key, zh_text)
where p.phrase_key = v.phrase_key
  and (p.zh_text is null or btrim(p.zh_text) = '');

commit;
```

## 4. 실행 후 검증

```sql
-- 카테고리: label_zh 8건 모두 채워졌는지
select count(*) as categories, count(label_zh) as has_label_zh
from public.mg_phrase_categories; -- categories=8, has_label_zh=8

select id, label_en, label_ko, label_zh, sort_order
from public.mg_phrase_categories
order by sort_order;

-- 표현: zh_text 85건 모두 채워졌는지
select count(*) as phrases, count(zh_text) as has_zh_text
from public.mg_phrases; -- phrases=85, has_zh_text=85

-- 카테고리별 zh_text 채움 건수 (waiting 10 / arriving 10 / menu 10 / allergy 15 / ordering 10 / extra 10 / paying 10 / leaving 10)
select category, count(*) as total, count(zh_text) as has_zh_text
from public.mg_phrases
group by category
order by category;

-- phrase_key/ko_text/en_text/note/sort_order가 이번 작업으로 바뀌지 않았는지 샘플 확인
select id, phrase_key, category, ko_text, en_text, zh_text, note, sort_order
from public.mg_phrases
order by category, sort_order
limit 20;

-- 혹시 매칭되지 않은 phrase_key가 있는지 (0행이어야 함 — VALUES의 85개 키가 실제 DB의 85개 키와 정확히 일치했는지)
select phrase_key from public.mg_phrases where zh_text is null; -- 0행
```

## 5. rollback (사용자가 필요 시 직접 실행)

이번 작업으로 채운 `zh_text`/`label_zh`만 되돌린다. `ko_text`/`en_text`/`note`/`phrase_key`/`sort_order`/`category`는 이 문서로 변경된 적이 없으므로 되돌릴 대상도 아니다.

```sql
begin;
update public.mg_phrases set zh_text = null where zh_text is not null;
update public.mg_phrase_categories set label_zh = null where label_zh is not null;
commit;
```

## 6. 기대 행 개수 요약

| 테이블 | 컬럼 | 실행 전 | 실행 후 |
|---|---|---:|---:|
| `mg_phrase_categories` | `label_zh` 채워진 행 | 0 / 8 | 8 / 8 |
| `mg_phrases` | `zh_text` 채워진 행 | 0 / 85 | 85 / 85 |

`ko_text`/`en_text`/`note`/`phrase_key`/`category`/`sort_order`/`id`는 실행 전후 완전히 동일해야 한다(3절 검증 SQL로 확인).

## 7. 순서

1. 1절 실행 전 확인으로 현재 상태(label_zh/zh_text 전부 NULL)가 예상과 같은지 확인
2. 2절 실행(카테고리 8건)
3. 3절 실행(표현 85건)
4. 4절 실행 후 검증으로 8/8, 85/85 확인 + 기존 컬럼 무변경 확인
5. 앱에서 zh-CN 선택 후 표현 탭의 카테고리명과 "뜻" 줄이 중국어로 보이는지 육안 확인

건수가 예상과 다르거나 기존 컬럼(`ko_text`/`en_text`/`note` 등)이 변경된 흔적이 있으면 5절 rollback을 실행하고 원인을 확인한다.
