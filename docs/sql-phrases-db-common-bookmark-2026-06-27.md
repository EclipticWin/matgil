# SQL - Phrases DB Common Bookmark - 2026-06-27

## 작성 일시

2026-06-27 KST

---

## 1. 목적

현재 `src/features/phrases/data/phrases.js`에 하드코딩된 Common Phrases 데이터(카테고리 8개, 표현 85개)를 Supabase DB로 전환하고, 로그인 사용자가 표현을 북마크할 수 있는 DB 구조를 보강합니다.

**이 SQL 문서는 Claude Code가 실행하지 않습니다. 사용자가 Supabase SQL Editor에서 직접 실행해 주세요.**

### 이번 작업 대상 테이블

| 테이블 | 작업 유형 | 설명 |
|---|---|---|
| `mg_phrases` | ALTER | `phrase_key`, `note`, `bookmark_count` 컬럼 추가, category FK 추가 |
| `mg_phrase_categories` | CREATE | 카테고리 전용 테이블 신규 생성 |
| `mg_phrase_bookmarks` | CREATE | 사용자별 표현 북마크 테이블 신규 생성 |

### 절대 건드리지 않는 테이블

```
ail_board_categories
ail_comments
ail_posts
ail_profiles
```

---

## 2. 실행 전 주의사항

1. **이 SQL은 Supabase SQL Editor에서 사용자가 직접 실행합니다.** Claude Code가 실행하지 않습니다.
2. 실행 전 아래 사전 확인 쿼리로 현재 DB 상태를 먼저 확인해 주세요.
3. 각 섹션 SQL은 **Section 3의 실행 순서를 반드시 지켜** 실행해 주세요.
4. `mg_phrases` 현재 데이터가 0개인지 먼저 확인해 주세요. 데이터가 이미 있으면 seed upsert가 기존 데이터를 덮어쓸 수 있습니다.
5. `mg_phrase_categories` / `mg_phrase_bookmarks` 테이블이 이미 존재하면 `CREATE TABLE IF NOT EXISTS`로 처리되므로 오류는 발생하지 않으나, 이미 실행된 단계를 확인하고 중복 실행하지 않도록 주의해 주세요.

### 사전 확인 쿼리 (실행 전 반드시 확인)

```sql
-- 1. mg_phrases 현재 데이터 수 확인 (0개여야 안전)
SELECT COUNT(*) AS phrase_count FROM public.mg_phrases;

-- 2. mg_phrase_categories 존재 여부 확인
--    결과 NULL → 아직 없음 (정상)
--    결과 'public.mg_phrase_categories' → 이미 존재 (이미 실행됐을 수 있음)
SELECT to_regclass('public.mg_phrase_categories') AS categories_table;

-- 3. mg_phrase_bookmarks 존재 여부 확인
SELECT to_regclass('public.mg_phrase_bookmarks') AS bookmarks_table;

-- 4. mg_phrases.id 컬럼 identity 여부 확인
--    seed SQL의 id 제공 방식 결정에 필요합니다 (Section 2 하단 대응표 참고)
SELECT
  column_name,
  column_default,
  is_identity,
  identity_generation
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mg_phrases'
  AND column_name = 'id';

-- 5. 기존 mg_phrases RLS 정책 확인 (변경하지 않을 정책)
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'mg_phrases';
```

### mg_phrases.id identity 여부에 따른 seed 대응

| `is_identity` | `identity_generation` | seed 방식 |
|---|---|---|
| `NO` | NULL | 본 문서 seed SQL 그대로 사용 (명시적 id 1~85) |
| `YES` | `BY DEFAULT` | 본 문서 seed SQL 그대로 사용 (BY DEFAULT는 명시적 id 허용) |
| `YES` | `ALWAYS` | Section 9의 OVERRIDING SYSTEM VALUE 방식으로 대체 실행 |

---

## 3. 실행 순서

아래 순서를 반드시 지켜 실행해 주세요.

```
Step 1  →  Section 4-1  : mg_phrase_categories 테이블 생성 + 트리거 + 인덱스
Step 2  →  Section 4-2  : mg_phrases 컬럼 추가 (phrase_key / note / bookmark_count) + 인덱스
Step 3  →  Section 6-1  : mg_phrase_categories RLS 활성화 + SELECT 정책
Step 4  →  Section 5-1  : mg_phrase_categories seed (카테고리 8건)
Step 5  →  Section 5-2  : mg_phrases seed (표현 85건, 카테고리별 8개 블록)
Step 5-1→  Section 5-3  : mg_phrases_id_seq 시퀀스 재설정
                           ⚠ Step 5 완료 직후 실행 (FK 추가 전)
Step 6  →  Section 4-3  : mg_phrases.category → mg_phrase_categories FK 추가
                           ⚠ Step 4, Step 5, Step 5-1 완료 후 실행
Step 7  →  Section 4-4  : mg_phrase_bookmarks 테이블 생성 + 인덱스
Step 8  →  Section 6-2  : mg_phrase_bookmarks RLS 활성화 + 정책 3개
Step 9  →  Section 7    : bookmark_count 트리거 함수 생성 + 트리거 연결
Step 10 →  Section 8    : 검증 쿼리 실행 및 결과 확인
```

---

## 4. DB 보강 SQL

### 4-1. mg_phrase_categories 테이블 생성

```sql
-- =============================================================
-- Step 1: mg_phrase_categories 테이블 신규 생성
-- =============================================================

CREATE TABLE IF NOT EXISTS public.mg_phrase_categories (
  id          text        PRIMARY KEY,
  label_en    text        NOT NULL,
  label_ko    text        NOT NULL,
  label_ja    text,                              -- 향후 일본어 확장용 (nullable)
  label_zh    text,                              -- 향후 중국어 확장용 (nullable)
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거 (기존 set_updated_at() 함수 재사용)
DROP TRIGGER IF EXISTS trg_mg_phrase_categories_updated_at
  ON public.mg_phrase_categories;

CREATE TRIGGER trg_mg_phrase_categories_updated_at
  BEFORE UPDATE ON public.mg_phrase_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 활성 카테고리 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mg_phrase_categories_active
  ON public.mg_phrase_categories(is_active);
```

### 4-2. mg_phrases 컬럼 추가

```sql
-- =============================================================
-- Step 2: mg_phrases 컬럼 추가
-- =============================================================

ALTER TABLE public.mg_phrases
  ADD COLUMN IF NOT EXISTS phrase_key      text,
  ADD COLUMN IF NOT EXISTS note           text,
  ADD COLUMN IF NOT EXISTS bookmark_count integer NOT NULL DEFAULT 0;

-- bookmark_count 음수 방지 check constraint
ALTER TABLE public.mg_phrases
  DROP CONSTRAINT IF EXISTS chk_mg_phrases_bookmark_count_nonnegative;

ALTER TABLE public.mg_phrases
  ADD CONSTRAINT chk_mg_phrases_bookmark_count_nonnegative
  CHECK (bookmark_count >= 0);

-- phrase_key partial unique index
-- phrase_key IS NOT NULL 인 행에만 unique 제약 적용
-- upsert 기준 컬럼으로 사용
CREATE UNIQUE INDEX IF NOT EXISTS uq_mg_phrases_phrase_key
  ON public.mg_phrases(phrase_key)
  WHERE phrase_key IS NOT NULL;
```

### 4-3. mg_phrases.category → mg_phrase_categories FK 추가

> ⚠️ **반드시 Step 4 (categories seed), Step 5 (phrases seed), Step 5-1 (시퀀스 재설정)을 모두 완료한 후 실행해 주세요.**
> FK를 먼저 추가하면 seed INSERT 시 카테고리가 없어 오류가 발생합니다.

```sql
-- =============================================================
-- Step 6: mg_phrases.category → mg_phrase_categories FK 추가
-- (seed 완료 후 실행)
-- =============================================================

-- 실행 전 검증: mg_phrases의 모든 category 값이 mg_phrase_categories에 존재하는지 확인
-- 아래 쿼리 결과가 0건이어야 FK를 안전하게 추가할 수 있습니다.
SELECT DISTINCT category
FROM public.mg_phrases
WHERE category NOT IN (
  SELECT id FROM public.mg_phrase_categories
);
-- 위 결과가 0건이면 아래 FK 추가 진행

ALTER TABLE public.mg_phrases
  DROP CONSTRAINT IF EXISTS fk_mg_phrases_category;

ALTER TABLE public.mg_phrases
  ADD CONSTRAINT fk_mg_phrases_category
  FOREIGN KEY (category) REFERENCES public.mg_phrase_categories(id);
```

### 4-4. mg_phrase_bookmarks 테이블 생성

```sql
-- =============================================================
-- Step 7: mg_phrase_bookmarks 테이블 신규 생성
-- =============================================================

CREATE TABLE IF NOT EXISTS public.mg_phrase_bookmarks (
  id         bigint      GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  phrase_id  bigint      NOT NULL
               REFERENCES public.mg_phrases(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL
               REFERENCES auth.users(id)         ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_phrase_user_bookmark UNIQUE (phrase_id, user_id)
);

-- 사용자별 북마크 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mg_phrase_bookmarks_user
  ON public.mg_phrase_bookmarks(user_id);

-- 표현별 북마크 집계 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mg_phrase_bookmarks_phrase
  ON public.mg_phrase_bookmarks(phrase_id);
```

---

## 5. seed SQL

### 5-1. mg_phrase_categories seed (8건)

id 기준 upsert. 이미 존재하는 카테고리는 label/sort_order를 갱신합니다.

```sql
-- =============================================================
-- Step 4: mg_phrase_categories seed (8건)
-- =============================================================

INSERT INTO public.mg_phrase_categories (id, label_en, label_ko, sort_order)
VALUES
  ('waiting',  'Waiting',                 '대기',             0),
  ('arriving', 'Getting seated',          '자리 잡기',          1),
  ('menu',     'Choosing menu',           '메뉴 선택',           2),
  ('allergy',  'Allergy & dietary needs', '알러지 & 식이 제한',   3),
  ('ordering', 'Ordering',                '주문하기',            4),
  ('extra',    'Extra requests',          '추가 요청',           5),
  ('paying',   'Paying',                  '계산하기',            6),
  ('leaving',  'Leaving',                 '퇴장하기',            7)
ON CONFLICT (id) DO UPDATE SET
  label_en   = EXCLUDED.label_en,
  label_ko   = EXCLUDED.label_ko,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
```

### 5-2. mg_phrases seed (85건)

phrase_key 기준 partial unique index upsert입니다. `ja_text`, `zh_text`는 1차에서 NULL로 둡니다.

**카테고리별로 8개 블록으로 분리했습니다. 순서대로 실행해 주세요.**

> **참고**: mg_phrases.id가 `GENERATED ALWAYS AS IDENTITY`인 경우 Section 9의 OVERRIDING SYSTEM VALUE 방식을 사용하세요.

#### 5-2-A. waiting (10건, id 1~10)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (1,  'waiting-01', 'waiting', '웨이팅 있나요?',        'We-i-ting innayo?',              'Is there a wait?',                    NULL, 1),
  (2,  'waiting-02', 'waiting', '얼마나 기다려요?',        'Eolmana gidaryeoyo?',            'How long is the wait?',               NULL, 2),
  (3,  'waiting-03', 'waiting', '웨이팅 등록해도 돼요?',   'We-i-ting deungnokaedo dwaeyo?', 'Can I put my name on the list?',       NULL, 3),
  (4,  'waiting-04', 'waiting', '한 명이에요.',            'Han myeong-ieyo.',               'I am one person.',                    NULL, 4),
  (5,  'waiting-05', 'waiting', '두 명이에요.',            'Du myeong-ieyo.',                'We are two people.',                  NULL, 5),
  (6,  'waiting-06', 'waiting', '아이가 있어요.',           'Aiga isseoyo.',                  'We have a child.',                    NULL, 6),
  (7,  'waiting-07', 'waiting', '순서 되면 불러 주세요.',  'Sunseo doemyeon bulleo juseyo.', 'Please call us when it is our turn.', NULL, 7),
  (8,  'waiting-08', 'waiting', '이름 불러 주세요.',       'Ireum bulleo juseyo.',           'Please call my name.',                NULL, 8),
  (9,  'waiting-09', 'waiting', '밖에서 기다려도 돼요?',   'Bakkeseo gidaryeodo dwaeyo?',    'Can I wait outside?',                 NULL, 9),
  (10, 'waiting-10', 'waiting', '잠깐 나갔다 올게요.',     'Jamkkan naggatda olgeyo.',       'I will be right back.',               NULL, 10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-B. arriving (10건, id 11~20)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (11, 'arriving-01', 'arriving', '한 명이에요.',          'Han myeong-ieyo.',              'Table for one, please.',          NULL, 1),
  (12, 'arriving-02', 'arriving', '두 명이에요.',          'Du myeong-ieyo.',               'Table for two, please.',          NULL, 2),
  (13, 'arriving-03', 'arriving', '아이가 있어요.',         'Aiga isseoyo.',                 'We have a child.',                NULL, 3),
  (14, 'arriving-04', 'arriving', '자리 있어요?',           'Jari isseoyo?',                 'Do you have a table?',            NULL, 4),
  (15, 'arriving-05', 'arriving', '여기 앉아도 돼요?',      'Yeogi anjado dwaeyo?',          'Can we sit here?',                NULL, 5),
  (16, 'arriving-06', 'arriving', '창가 자리 있어요?',      'Changga jari isseoyo?',         'Can we sit by the window?',       NULL, 6),
  (17, 'arriving-07', 'arriving', '예약했어요.',            'Yeyakhaesseoyo.',               'I have a reservation.',           NULL, 7),
  (18, 'arriving-08', 'arriving', '예약은 없어요.',         'Yeyageun eopseoyo.',            'We do not have a reservation.',   NULL, 8),
  (19, 'arriving-09', 'arriving', '따로 앉아도 돼요?',      'Ttaro anjado dwaeyo?',          'Can we sit separately?',          NULL, 9),
  (20, 'arriving-10', 'arriving', '같이 앉을 수 있어요?',   'Gachi anjeul su isseoyo?',      'Can we sit together?',            NULL, 10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-C. menu (10건, id 21~30)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (21, 'menu-01', 'menu', '영어 메뉴 있어요?',          'Yeongeo menyu isseoyo?',              'Do you have an English menu?',        NULL, 1),
  (22, 'menu-02', 'menu', '추천 메뉴가 뭐예요?',         'Chucheon menyuga mwoyeyo?',           'What do you recommend?',              NULL, 2),
  (23, 'menu-03', 'menu', '제일 잘 나가는 게 뭐예요?',   'Jeil jal naganeun ge mwoyeyo?',       'What is the most popular dish?',      NULL, 3),
  (24, 'menu-04', 'menu', '이거 매워요?',               'Igeo maewoyo?',                       'Is this spicy?',                      NULL, 4),
  (25, 'menu-05', 'menu', '덜 맵게 해 주세요.',          'Deol maepge hae juseyo.',             'Can you make it less spicy?',         NULL, 5),
  (26, 'menu-06', 'menu', '이거 고기 들어가요?',         'Igeo gogi deureogayo?',               'Does this have meat?',                NULL, 6),
  (27, 'menu-07', 'menu', '이거 해산물 들어가요?',       'Igeo haesanmul deureogayo?',          'Does this have seafood?',             NULL, 7),
  (28, 'menu-08', 'menu', '이거 1인분이에요?',           'Igeo ilinbun-ieyo?',                  'Is this one serving?',                NULL, 8),
  (29, 'menu-09', 'menu', '이거 두 명이 먹을 수 있어요?','Igeo du myeongi meogeul su isseoyo?', 'Is this enough for two people?',      NULL, 9),
  (30, 'menu-10', 'menu', '이게 뭔가요?',               'Ige mwongayo?',                       'What is this dish?',                  NULL, 10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-D. allergy (15건, id 31~45)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (31, 'allergy-01', 'allergy', '이거 글루텐 없는 건가요?', 'Igeo geulluten eomneun geongayo?',  'Is this gluten-free?',               NULL,                                       1),
  (32, 'allergy-02', 'allergy', '이거 돼지고기 들어가요?',  'Igeo dwaejigogi deureogayo?',       'Does this contain pork?',            NULL,                                       2),
  (33, 'allergy-03', 'allergy', '이거 소고기 들어가요?',    'Igeo sogogi deureogayo?',           'Does this contain beef?',            NULL,                                       3),
  (34, 'allergy-04', 'allergy', '이거 닭고기 들어가요?',    'Igeo dakgogi deureogayo?',          'Does this contain chicken?',         NULL,                                       4),
  (35, 'allergy-05', 'allergy', '이거 해산물 들어가요?',    'Igeo haesanmul deureogayo?',        'Does this contain seafood?',         NULL,                                       5),
  (36, 'allergy-06', 'allergy', '이거 조개류 들어가요?',    'Igeo jogaeryu deureogayo?',         'Does this contain shellfish?',       NULL,                                       6),
  (37, 'allergy-07', 'allergy', '이거 땅콩 들어가요?',      'Igeo ttangkong deureogayo?',        'Does this contain peanuts?',         NULL,                                       7),
  (38, 'allergy-08', 'allergy', '이거 달걀 들어가요?',      'Igeo dalgyal deureogayo?',          'Does this contain eggs?',            NULL,                                       8),
  (39, 'allergy-09', 'allergy', '이거 유제품 들어가요?',    'Igeo yujepum deureogayo?',          'Does this contain dairy?',           NULL,                                       9),
  (40, 'allergy-10', 'allergy', '견과류 알레르기가 있어요.','Gyeongwaryu allereugi-ga isseoyo.', 'I have a nut allergy.',              NULL,                                       10),
  (41, 'allergy-11', 'allergy', '해산물 알레르기가 있어요.','Haesanmul allereugi-ga isseoyo.',   'I have a seafood allergy.',          NULL,                                       11),
  (42, 'allergy-12', 'allergy', '돼지고기 못 먹어요.',      'Dwaejigogi mot meogeoyo.',          'I cannot eat pork.',                 NULL,                                       12),
  (43, 'allergy-13', 'allergy', '채식주의자예요.',           'Chaesikjuuijayeyo.',                'I am vegetarian.',                   NULL,                                       13),
  (44, 'allergy-14', 'allergy', '채식 메뉴 있어요?',        'Chaesik menyu isseoyo?',            'Is there a vegetarian option?',      NULL,                                       14),
  (45, 'allergy-15', 'allergy', '이 재료 빼 주세요.',       'I jaeryo bbae juseyo.',             'Please leave out this ingredient.',  'Point at the ingredient on the menu.',     15)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-E. ordering (10건, id 46~55)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (46, 'ordering-01', 'ordering', '이거 주세요.',            'Igeo juseyo.',                    'I will have this one.',         'Point at the menu item.',    1),
  (47, 'ordering-02', 'ordering', '이거 하나 주세요.',        'Igeo hana juseyo.',               'One of this, please.',          NULL,                         2),
  (48, 'ordering-03', 'ordering', '이거 두 개 주세요.',       'Igeo du gae juseyo.',             'Two of this, please.',          NULL,                         3),
  (49, 'ordering-04', 'ordering', '주문할게요.',              'Jumunhalgeyo.',                   'We are ready to order.',        NULL,                         4),
  (50, 'ordering-05', 'ordering', '물 주세요.',               'Mul juseyo.',                     'Water, please.',                NULL,                         5),
  (51, 'ordering-06', 'ordering', '반찬 주세요.',             'Banchan juseyo.',                 'Side dishes, please.',          NULL,                         6),
  (52, 'ordering-07', 'ordering', '추가 주문해도 돼요?',      'Chuga jumunaedo dwaeyo?',         'Can we order more?',            NULL,                         7),
  (53, 'ordering-08', 'ordering', '저거랑 같은 걸로 주세요.', 'Jeogerang gateun geollo juseyo.', 'Same as theirs, please.',       'Point at another table.',    8),
  (54, 'ordering-09', 'ordering', '안 맵게 해 주세요.',       'An maepge hae juseyo.',           'Please make it not spicy.',     NULL,                         9),
  (55, 'ordering-10', 'ordering', '이걸로 할게요.',           'Igeolro halgeyo.',                'That''s all for now.',          NULL,                         10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-F. extra (10건, id 56~65)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (56, 'extra-01', 'extra', '김치 더 주세요.',   'Gimchi deo juseyo.',    'More kimchi, please.',     NULL,                                    1),
  (57, 'extra-02', 'extra', '밥 더 주세요.',     'Bap deo juseyo.',       'More rice, please.',       NULL,                                    2),
  (58, 'extra-03', 'extra', '포크 주세요.',      'Pokeu juseyo.',         'A fork, please.',          NULL,                                    3),
  (59, 'extra-04', 'extra', '가위 주세요.',      'Gawi juseyo.',          'Scissors, please.',        'Used for cutting meat at Korean BBQ.',  4),
  (60, 'extra-05', 'extra', '숟가락 주세요.',    'Sutgarak juseyo.',      'A spoon, please.',         NULL,                                    5),
  (61, 'extra-06', 'extra', '포장해 주세요.',    'Pojanghaejuseyo.',      'Can you pack this to go?', NULL,                                    6),
  (62, 'extra-07', 'extra', '냅킨 더 주세요.',   'Naepkin deo juseyo.',   'More napkins, please.',    NULL,                                    7),
  (63, 'extra-08', 'extra', '앞접시 주세요.',    'Apjeopssi juseyo.',     'A small plate, please.',   NULL,                                    8),
  (64, 'extra-09', 'extra', '소스 따로 주세요.', 'Soseu ttaro juseyo.',   'Sauce on the side, please.',NULL,                                   9),
  (65, 'extra-10', 'extra', '젓가락 주세요.',    'Jeotgarak juseyo.',     'Chopsticks, please.',      NULL,                                    10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-G. paying (10건, id 66~75)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (66, 'paying-01', 'paying', '계산할게요.',           'Gyesanhalgeyo.',             'Check, please.',                         NULL,                                                   1),
  (67, 'paying-02', 'paying', '카드 돼요?',             'Kadeu dwaeyo?',              'Can I pay by card?',                     NULL,                                                   2),
  (68, 'paying-03', 'paying', '따로 계산해도 돼요?',    'Ttaro gyesanaedo dwaeyo?',   'Can we split the bill?',                 NULL,                                                   3),
  (69, 'paying-04', 'paying', '영수증 주세요.',         'Yeongsujeung juseyo.',       'Receipt, please.',                       NULL,                                                   4),
  (70, 'paying-05', 'paying', '어디서 계산해요?',       'Eodiseo gyesanaeyo?',        'Where do I pay?',                        NULL,                                                   5),
  (71, 'paying-06', 'paying', '선불이에요?',            'Seonbul-ieyo?',              'Is it prepaid?',                         'Some restaurants collect payment before seating.',      6),
  (72, 'paying-07', 'paying', '카운터에서 계산하나요?', 'Kaunteoeseo gyesanahannayo?','Do I pay at the counter?',               NULL,                                                   7),
  (73, 'paying-08', 'paying', '각자 계산해도 돼요?',    'Gakja gyesanaedo dwaeyo?',   'Can we pay separately?',                 NULL,                                                   8),
  (74, 'paying-09', 'paying', '외국 카드 돼요?',        'Oeguk kadeu dwaeyo?',        'Can I use a foreign card?',              NULL,                                                   9),
  (75, 'paying-10', 'paying', '계산서 확인해 주세요.',  'Gyesanseo hwakinhaejuseyo.', 'Please check the bill.',                 NULL,                                                   10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

#### 5-2-H. leaving (10건, id 76~85)

```sql
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
VALUES
  (76, 'leaving-01', 'leaving', '감사합니다.',           'Gamsahamnida.',              'Thank you.',                NULL, 1),
  (77, 'leaving-02', 'leaving', '맛있었어요.',            'Masissesseoyo.',             'It was delicious.',         NULL, 2),
  (78, 'leaving-03', 'leaving', '저희 가볼게요.',         'Jeohui gabolgeyo.',          'We are heading out now.',   NULL, 3),
  (79, 'leaving-04', 'leaving', '남은 거 포장해 주세요.', 'Nameun geo pojanghaejuseyo.','Can you pack the leftovers?',NULL,4),
  (80, 'leaving-05', 'leaving', '안녕히 계세요.',         'Annyeonghi gyeseyo.',        'Goodbye.',                  NULL, 5),
  (81, 'leaving-06', 'leaving', '잘 먹었습니다.',         'Jal meogeosseumnida.',       'Thank you for the meal.',   NULL, 6),
  (82, 'leaving-07', 'leaving', '다 맛있었어요.',         'Da masissesseoyo.',          'Everything was great.',     NULL, 7),
  (83, 'leaving-08', 'leaving', '좋은 하루 되세요.',      'Joeun haru doeseyo.',        'Have a nice day.',          NULL, 8),
  (84, 'leaving-09', 'leaving', '정말 맛있었어요.',       'Jeongmal masissesseoyo.',    'We really enjoyed it.',     NULL, 9),
  (85, 'leaving-10', 'leaving', '다음에 또 올게요.',      'Daeume tto olgeyo.',         'We''ll come again.',        NULL, 10)
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  category     = EXCLUDED.category,
  ko_text      = EXCLUDED.ko_text,
  romanization = EXCLUDED.romanization,
  en_text      = EXCLUDED.en_text,
  note         = EXCLUDED.note,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
```

### 5-3. mg_phrases_id_seq 시퀀스 재설정

> ⚠️ **반드시 Section 5-2 seed (85건) 전체 완료 후, Section 4-3 FK 추가 전에 실행해 주세요.**

`mg_phrases.id`의 기본값은 `nextval('mg_phrases_id_seq')`입니다. seed SQL에서 id 1~85를 명시적으로 INSERT하면 시퀀스가 자동으로 이동하지 않습니다. 재설정하지 않으면 이후 새 표현을 INSERT할 때 `id = 1`부터 다시 시작하여 primary key 충돌이 발생합니다.

```sql
-- =============================================================
-- Step 5-1: mg_phrases_id_seq 시퀀스 재설정
-- seed 85건 완료 직후 실행
-- =============================================================

SELECT setval(
  pg_get_serial_sequence('public.mg_phrases', 'id'),
  COALESCE((SELECT MAX(id) FROM public.mg_phrases), 1),
  true
);

-- 실행 결과: 85 가 반환되면 정상입니다.
-- 이후 새 표현 INSERT 시 id = 86부터 자동 할당됩니다.
```

> **참고**: `pg_get_serial_sequence`가 NULL을 반환하는 경우
> `mg_phrases.id`가 serial/sequence가 아닌 경우 이 단계는 생략해도 됩니다.
> 아래 쿼리로 먼저 확인해 주세요.
>
> ```sql
> SELECT pg_get_serial_sequence('public.mg_phrases', 'id');
> -- 결과: 'public.mg_phrases_id_seq' → 시퀀스 존재, 위 setval 실행 필요
> -- 결과: NULL                        → 시퀀스 없음, 이 단계 생략
> ```

---

## 6. RLS 정책 SQL

### 6-1. mg_phrase_categories RLS

```sql
-- =============================================================
-- Step 3: mg_phrase_categories RLS 활성화 + SELECT 정책
-- =============================================================

ALTER TABLE public.mg_phrase_categories ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (idempotent)
DROP POLICY IF EXISTS "public read mg_phrase_categories"
  ON public.mg_phrase_categories;

CREATE POLICY "public read mg_phrase_categories"
  ON public.mg_phrase_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- INSERT / UPDATE / DELETE 는 1차에서 정책을 만들지 않습니다.
-- RLS 활성화 상태에서 정책 없음 = 기본 deny → 관리자 확장 전까지 차단 유지.
```

### 6-2. mg_phrases RLS (기존 정책 확인)

mg_phrases의 기존 RLS 정책(`public read mg_phrases`, `is_active = true`)은 변경하지 않습니다.

아래 쿼리로 기존 정책이 정상적으로 존재하는지 확인해 주세요. 없다면 하단 재생성 SQL을 실행해 주세요.

```sql
-- 기존 정책 확인 쿼리 (변경하지 않음, 확인용)
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'mg_phrases';
-- 결과에 "public read mg_phrases" 정책이 있어야 합니다.

-- ▼ 만약 위 쿼리에서 정책이 없다면 아래를 실행해 주세요 ▼
-- (정상이면 실행하지 않아도 됩니다)
/*
ALTER TABLE public.mg_phrases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read mg_phrases" ON public.mg_phrases;
CREATE POLICY "public read mg_phrases"
  ON public.mg_phrases
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
*/
```

### 6-3. mg_phrase_bookmarks RLS

```sql
-- =============================================================
-- Step 8: mg_phrase_bookmarks RLS 활성화 + 정책 3개
-- =============================================================

ALTER TABLE public.mg_phrase_bookmarks ENABLE ROW LEVEL SECURITY;

-- SELECT: 로그인 사용자가 본인 북마크만 조회 가능
DROP POLICY IF EXISTS "authenticated select own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks;

CREATE POLICY "authenticated select own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: 로그인 사용자가 본인 user_id로만 삽입 가능
DROP POLICY IF EXISTS "authenticated insert own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks;

CREATE POLICY "authenticated insert own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE: 로그인 사용자가 본인 북마크만 삭제 가능
DROP POLICY IF EXISTS "authenticated delete own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks;

CREATE POLICY "authenticated delete own mg_phrase_bookmarks"
  ON public.mg_phrase_bookmarks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- anon 및 public read는 열지 않습니다.
-- user_id 노출을 막기 위해 mg_phrase_bookmarks는 인증된 사용자 본인 데이터만 접근 허용합니다.
-- 인기 표현(bookmark_count)은 mg_phrases의 public read를 통해 공개합니다.
```

---

## 7. bookmark_count 트리거 SQL

```sql
-- =============================================================
-- Step 9: bookmark_count 자동 증감 트리거 함수 + 트리거
-- =============================================================

-- 트리거 함수 생성 (SECURITY DEFINER)
-- authenticated 사용자는 mg_phrases UPDATE 권한이 없으므로
-- SECURITY DEFINER로 함수 소유자 권한으로 실행합니다.
CREATE OR REPLACE FUNCTION public.update_phrase_bookmark_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mg_phrases
       SET bookmark_count = bookmark_count + 1
     WHERE id = NEW.phrase_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mg_phrases
       SET bookmark_count = GREATEST(0, bookmark_count - 1)
     WHERE id = OLD.phrase_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 트리거 연결 (mg_phrase_bookmarks INSERT/DELETE 후 실행)
DROP TRIGGER IF EXISTS trg_phrase_bookmark_count
  ON public.mg_phrase_bookmarks;

CREATE TRIGGER trg_phrase_bookmark_count
  AFTER INSERT OR DELETE ON public.mg_phrase_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_phrase_bookmark_count();
```

---

## 8. 실행 후 검증 쿼리

**이 쿼리들은 Claude Code가 실행하지 않습니다. 사용자가 Supabase SQL Editor에서 직접 실행하여 결과를 확인해 주세요.**

### 8-1. 데이터 수 확인

```sql
-- mg_phrase_categories 8건이어야 합니다
SELECT COUNT(*) AS category_count
FROM public.mg_phrase_categories;

-- mg_phrases 85건이어야 합니다
SELECT COUNT(*) AS phrase_count
FROM public.mg_phrases;

-- 카테고리별 표현 수 확인
-- waiting: 10 / arriving: 10 / menu: 10 / allergy: 15 / ordering: 10 / extra: 10 / paying: 10 / leaving: 10
SELECT
  category,
  COUNT(*) AS phrase_count
FROM public.mg_phrases
GROUP BY category
ORDER BY category;

-- mg_phrase_bookmarks 0건이어야 합니다 (아직 사용자 북마크 없음)
SELECT COUNT(*) AS bookmark_count
FROM public.mg_phrase_bookmarks;
```

### 8-2. RLS 활성화 확인

```sql
SELECT
  c.relname             AS table_name,
  c.relrowsecurity      AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'mg_phrases',
    'mg_phrase_categories',
    'mg_phrase_bookmarks'
  )
ORDER BY c.relname;
-- 세 테이블 모두 rls_enabled = true 이어야 합니다
```

### 8-3. RLS 정책 확인

```sql
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'mg_phrases',
    'mg_phrase_categories',
    'mg_phrase_bookmarks'
  )
ORDER BY tablename, policyname;
```

예상 결과:

| tablename | policyname | cmd |
|---|---|---|
| mg_phrase_bookmarks | authenticated delete own mg_phrase_bookmarks | DELETE |
| mg_phrase_bookmarks | authenticated insert own mg_phrase_bookmarks | INSERT |
| mg_phrase_bookmarks | authenticated select own mg_phrase_bookmarks | SELECT |
| mg_phrase_categories | public read mg_phrase_categories | SELECT |
| mg_phrases | public read mg_phrases | SELECT |

### 8-4. 샘플 데이터 확인

```sql
SELECT
  id,
  phrase_key,
  category,
  ko_text,
  romanization,
  en_text,
  note,
  bookmark_count,
  sort_order,
  is_active
FROM public.mg_phrases
ORDER BY category, sort_order
LIMIT 20;
```

### 8-5. phrase_key 유니크 인덱스 확인

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mg_phrases'
  AND indexname = 'uq_mg_phrases_phrase_key';
-- 결과가 1건 있어야 합니다
```

### 8-6. FK 제약 확인

```sql
SELECT
  conname        AS constraint_name,
  contype        AS constraint_type,
  confdeltype    AS on_delete
FROM pg_constraint
WHERE conrelid = 'public.mg_phrases'::regclass
  AND conname = 'fk_mg_phrases_category';
-- 결과가 1건 있어야 합니다
```

### 8-7. 트리거 확인

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'mg_phrases',
    'mg_phrase_categories',
    'mg_phrase_bookmarks'
  )
ORDER BY event_object_table, trigger_name;
```

예상 결과:

| trigger_name | event_manipulation | event_object_table |
|---|---|---|
| trg_mg_phrase_categories_updated_at | UPDATE | mg_phrase_categories |
| trg_mg_phrases_updated_at | UPDATE | mg_phrases (기존) |
| trg_phrase_bookmark_count | INSERT | mg_phrase_bookmarks |
| trg_phrase_bookmark_count | DELETE | mg_phrase_bookmarks |

### 8-8. bookmark_count 트리거 동작 테스트

> ⚠️ 아래 테스트는 실제 user_id가 필요합니다. 프론트에서 로그인 후 북마크 버튼을 테스트하는 방식으로 검증하거나, Supabase 대시보드의 Authentication에서 실제 UUID를 확인한 후 실행하세요.
> 테스트 완료 후 반드시 삭제 쿼리도 실행해 주세요.

```sql
-- 테스트용 (실제 uuid로 교체)
-- INSERT 테스트: bookmark_count 1 증가 확인
/*
INSERT INTO public.mg_phrase_bookmarks (phrase_id, user_id)
VALUES (1, '<실제-user-uuid>');

SELECT id, bookmark_count
FROM public.mg_phrases
WHERE id = 1;
-- bookmark_count = 1 이어야 합니다

-- DELETE 테스트: bookmark_count 1 감소 확인
DELETE FROM public.mg_phrase_bookmarks
WHERE phrase_id = 1 AND user_id = '<실제-user-uuid>';

SELECT id, bookmark_count
FROM public.mg_phrases
WHERE id = 1;
-- bookmark_count = 0 으로 복구되어야 합니다
*/
```

---

## 9. 롤백/주의사항

### 9-1. mg_phrases.id가 GENERATED ALWAYS AS IDENTITY인 경우

사전 확인 쿼리에서 `identity_generation = 'ALWAYS'`로 확인되면 Section 5-2의 seed SQL에서 아래처럼 `OVERRIDING SYSTEM VALUE`를 추가해 주세요.

```sql
-- GENERATED ALWAYS AS IDENTITY 인 경우 사용
INSERT INTO public.mg_phrases
  (id, phrase_key, category, ko_text, romanization, en_text, note, sort_order)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'waiting-01', ...)
  ...
ON CONFLICT (phrase_key) WHERE phrase_key IS NOT NULL DO UPDATE SET
  ...;

-- seed 완료 후 sequence를 최댓값 이후로 재설정 (중복 방지)
SELECT setval(
  pg_get_serial_sequence('public.mg_phrases', 'id'),
  (SELECT MAX(id) FROM public.mg_phrases)
);
```

### 9-2. 롤백이 필요한 경우

아래 SQL로 이번 작업을 되돌릴 수 있습니다.

```sql
-- ⚠ 주의: 아래 롤백 SQL은 데이터가 삭제됩니다. 신중하게 실행하세요.

-- 1. 트리거 및 함수 제거
DROP TRIGGER IF EXISTS trg_phrase_bookmark_count ON public.mg_phrase_bookmarks;
DROP FUNCTION IF EXISTS public.update_phrase_bookmark_count();

-- 2. mg_phrase_bookmarks 삭제
DROP TABLE IF EXISTS public.mg_phrase_bookmarks;

-- 3. FK 제거
ALTER TABLE public.mg_phrases
  DROP CONSTRAINT IF EXISTS fk_mg_phrases_category;

-- 4. mg_phrase_categories 삭제
DROP TRIGGER IF EXISTS trg_mg_phrase_categories_updated_at
  ON public.mg_phrase_categories;
DROP TABLE IF EXISTS public.mg_phrase_categories;

-- 5. mg_phrases seed 데이터 삭제 (phrase_key가 있는 행 = 이번에 삽입된 행)
DELETE FROM public.mg_phrases WHERE phrase_key IS NOT NULL;

-- 6. mg_phrases 컬럼 제거
ALTER TABLE public.mg_phrases
  DROP CONSTRAINT IF EXISTS chk_mg_phrases_bookmark_count_nonnegative;

DROP INDEX IF EXISTS uq_mg_phrases_phrase_key;

ALTER TABLE public.mg_phrases
  DROP COLUMN IF EXISTS phrase_key,
  DROP COLUMN IF EXISTS note,
  DROP COLUMN IF EXISTS bookmark_count;
```

### 9-3. FK 추가 실패 시

Section 4-3 FK 추가 전 검증 쿼리에서 category 불일치 행이 나온다면, seed가 완전히 완료되지 않은 것입니다. Section 5-2 seed를 다시 실행한 후 FK를 추가해 주세요.

### 9-4. 기존 mg_phrases RLS 정책 보존

이번 작업에서 기존 `public read mg_phrases` 정책은 변경하지 않습니다. 실수로 DROP했다면 Section 6-2의 주석 처리된 재생성 SQL을 실행해 복구해 주세요.

### 9-5. ail_* 테이블 관련

이 문서의 SQL은 mg_* 테이블만 대상으로 합니다. `ail_board_categories`, `ail_comments`, `ail_posts`, `ail_profiles`는 이번 작업 대상에 포함되지 않으며, 위 SQL 중 어느 것도 ail_* 테이블에 영향을 주지 않습니다.
