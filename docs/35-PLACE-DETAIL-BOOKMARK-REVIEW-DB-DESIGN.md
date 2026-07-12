# Place Detail, Bookmark and Review DB Design

- 작성 일시: 2026-07-12 18:46 KST
- 기준: `docs/34-PLACE-DETAIL-BOOKMARK-REVIEW-RESEARCH.md`(조사) + 사용자가 확정한 정책(이번 요청 본문) + 사용자가 직접 확인한 Supabase 실측 정보
- 성격: **DB 설계 확정 문서**. 실행용 SQL은 별도 문서 `docs/sql-place-detail-bookmark-review-2026-07-12.md`에 있으며, 실행은 사용자가 Supabase SQL Editor에서 직접 한다. 이 문서는 코드도, 기존 DB도 변경하지 않는다.
- 준수 규칙: `ai-docs/25-current-implementation-rules.md`

---

## 1. 확정된 사용자 요구사항 (요약)

- 가게 상세 화면에 4개 고정 섹션 탭: `menu`, `reviews`, `location`, `visit_info`. 탭 바만 가로 스크롤, 콘텐츠는 세로 연속, 클릭 시 세로 이동, 스크롤 시 활성 탭 자동 갱신.
- **활성 섹션은 데이터 유무와 무관하게 항상 표시**한다(가게마다 탭 구성이 달라지지 않음) — 빈 상태 문구로 대응.
- 개별 가게 북마크: 로그인 전용, 중복 저장 불가, hard delete, 코스 저장과 완전 별도.
- 리뷰: 비로그인 열람·로그인 작성, **1인 1가게 1활성 리뷰(DB 제약)**, 별점 1~5 필수·내용 선택(별점만 있는 리뷰 허용), soft delete + 재작성 시 새 row, `edited_at`으로 수정 판정(시스템성 UPDATE와 분리), author_name은 서버가 강제(이메일 fallback 금지, display_name 없으면 insert 거부), 닉네임 변경 시 과거 리뷰까지 동기화.
- 사용자 탈퇴 후에도 리뷰 공개 유지(`user_id` nullable, `ON DELETE SET NULL`).
- 리뷰 사진: 신규 버킷 `place-review-images`, 최대 3장, storage_path를 DB에 저장(URL 배열 금지).
- 평균 별점: 1단계는 view로 집계, soft delete 리뷰 제외, 0건은 "0.0"이 아니라 문구.
- 상세 화면은 최신 리뷰 2개 + 전체보기 버튼, 전체 리뷰 화면은 5개 단위 cursor pagination(`created_at desc, id desc`), 모든 언어 통합 표시(`ui_locale`은 언어 배지로 쓰지 않음).
- "도움돼요"는 이번 범위 제외 — 컬럼 선반영 금지, 후속 관계 테이블로.
- 프로필 사진·사용자 리뷰 모음 화면은 후속 — 이번엔 avatar 관련 컬럼을 리뷰 테이블에 넣지 않음.
- 관리자 쓰기는 전 테이블 유보. section_key는 rename·삭제 불허, 비활성화만.
- 신규 테이블은 **선 revoke, 후 최소 grant** 원칙.

## 2. 이번 범위와 후속 범위

| 이번 범위 (이 SQL로 생성) | 후속 범위 (스키마 미생성, 설계만 기록) |
|---|---|
| 상세 섹션 메타데이터 2테이블 + seed | 상세 섹션 관리자 화면(6~7단계) |
| 가게 북마크 1테이블 | — |
| 리뷰 1테이블 + 통계 view + 트리거 2종 | 도움돼요 관계 테이블(`mg_place_review_helpful`, §9) |
| 리뷰 이미지 1테이블 + 개수 제한 트리거 | 사용자 프로필/아바타 테이블(`mg_user_profiles`, §7) |
| 닉네임 동기화 RPC(1개, 커뮤니티 2테이블 + 리뷰 1테이블 대상) | AI 리뷰 번역(§8) |
| 신규 Storage 버킷 + 정책 | Menu/Visit Info 가게별 override(§4) |

## 3. 기존 Menu·Visit Info 데이터 재사용 확인

새 음식 메뉴 테이블이나 새 Visit Info 콘텐츠 테이블은 **만들지 않는다.** 사용자가 직접 확인한 컬럼을 그대로 재사용한다.

| 표기 | 원본 컬럼 |
|---|---|
| Menu > Main | `mg_place_texts.first_menu` |
| Menu > Serves | `mg_place_texts.treat_menu` |
| Visit Info > Hours | `mg_place_texts.open_time` |
| Visit Info > Rest day | `mg_place_texts.rest_date` |
| Visit Info > Parking | `mg_place_texts.parking` |
| Visit Info > Takeout | `mg_place_texts.packing` |
| Visit Info > Phone | `mg_place_food_details.tel` |

이번에 새로 DB화하는 것은 **위 콘텐츠가 아니라 "Menu/Reviews/Location/Visit Info라는 4개 섹션의 존재·라벨·순서·노출·빈 상태 문구"라는 화면 구성 메타데이터**뿐이다.

## 4. 상세 섹션 메타데이터 구조

### `mg_place_detail_sections`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| section_key | text PK, `check (section_key ~ '^[a-z0-9_]+$')` | 고정 기능 key: menu/reviews/location/visit_info |
| icon_key | text not null default 'default' | 프론트 아이콘 registry 키. 음식 카테고리 선례와 동일하게 미등록 키는 프론트에서 `default`로 폴백 |
| sort_order | integer not null default 999 | |
| is_active | boolean not null default **false** | 음식 카테고리 선례와 동일한 방어적 기본값 — seed에서 명시적으로 true로 지정해야 노출됨 |
| created_at / updated_at | timestamptz not null default now() | `set_updated_at()` 트리거 재사용 |

**의도적으로 넣지 않은 컬럼과 이유**
- `deleted_at`: 기능형 섹션은 완전 삭제하지 않고 `is_active=false`로만 비활성화하므로 불필요. 번역 테이블의 FK가 `on delete restrict`라 실수로 섹션 행을 지우려 해도 차단된다.
- `is_required`: 이번 요구사항에 "관리자도 끌 수 없는 섹션" 정책이 없어 생략(YAGNI). 필요해지면 `alter table ... add column is_required boolean not null default false`로 하위 호환 추가 가능.
- `created_by/updated_by`: 관리자 기반이 아직 없어(§ai-docs/25 미해결 목록) 지금 넣어도 값이 채워질 경로가 없다. 관리자 기반이 생길 때 추가하는 것이 과잉설계를 피하는 방향.
- `section_type`: 4개가 전부 기능형(코드 1:1 연결)이라 이번엔 불필요. 향후 자유 콘텐츠형 섹션이 생기면 그때 추가.

**section_key를 4개 값으로 제한하는 CHECK를 넣지 않은 이유**: enum형 체크를 걸면 향후 5번째 섹션 추가 시 스키마 마이그레이션이 필요해진다. 대신 정규식(`^[a-z0-9_]+$`)만으로 형식을 통제하고, "코드가 아는 4개 외의 key는 프론트가 렌더링하지 못한다"는 사실은 프론트 구현 단계의 폴백 처리로 방어한다(§33-16). **주의**: 이번 단계에서는 관리자 쓰기 권한이 전혀 없으므로(§6) 이 위험은 실제로는 발생하지 않는다 — 향후 관리자가 5번째 키를 추가할 수 있게 되는 시점에 프론트 "알 수 없는 섹션" 폴백을 반드시 먼저 갖춰야 한다.

### `mg_place_detail_section_translations`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| section_key | text, FK → sections(section_key) **on delete restrict** | |
| locale | text, `check (btrim(locale) <> '')` | |
| label | text not null | 탭 라벨 |
| empty_title | text not null | 항상 표시되는 섹션이므로 **not null** — 모든 섹션·모든 locale에 반드시 있어야 함 |
| empty_description | text not null | 상동 |
| created_at / updated_at | timestamptz not null default now() | |
| PK | `(section_key, locale)` | |

`description`(관리자 메모) 컬럼은 실제 요구가 없어 생략했다. `label_en`/`label_ko`/`label_ja` 같은 locale-per-column 구조는 사용하지 않았다 — `(section_key, locale)` 행 구조로 새 locale은 행 추가만으로 확장된다.

### Seed (4섹션 × EN/KO)

| section_key | icon_key | sort_order | label(EN/KO) |
|---|---|---|---|
| menu | menu | 10 | Menu / 메뉴 |
| reviews | star | 20 | Reviews / 리뷰 |
| location | pin | 30 | Location / 위치 |
| visit_info | clock | 40 | Visit Info / 방문 정보 |

빈 상태 문구는 SQL 문서 seed 구역에 EN/KO로 자연스러운 톤으로 작성했다 — 관리자가 나중에 자유롭게 바꿀 수 있는 값이며, 최초 문구는 예시일 뿐 확정 카피가 아니다.

## 5. section key와 label 분리 원칙

DB·스냅샷·필터에는 `section_key`만 저장·참조되고, 화면에 보이는 문자열은 항상 `(section_key, locale)`로 조회한 `label`이다. 이 원칙은 음식 카테고리(§ai-docs/24)와 동일하며, key를 rename하면 프론트 렌더러의 `switch(section_key)` 분기가 깨지므로 **key는 절대 불변, label만 가변**이라는 계약을 SQL 주석에도 명시했다.

## 6. EN/KO와 추가 locale 확장

모든 신규 번역 테이블(`mg_place_detail_section_translations`)은 `(대상 key, locale)` 복합 PK 행 구조다. 제3언어 추가는 새 컬럼 없이 `insert into ... (section_key, locale, ...) values ('menu','ja',...)` 행 추가만으로 끝난다. 리뷰의 `ui_locale`은 번역 테이블이 아니라 "작성 당시 앱 언어 기록"일 뿐이며 §23에서 오용 방지를 명시한다.

## 7. 가게 북마크 구조

### `mg_place_bookmarks`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | uuid not null, FK → auth.users(id) **on delete cascade** | 사용자 삭제 시 북마크 함께 삭제(요구사항 확인) |
| place_id | bigint not null, FK → mg_places(id) **on delete cascade** | 장소가 사라지면 북마크도 무의미하므로 cascade |
| created_at | timestamptz not null default now() | |
| PK | `(user_id, place_id)` | 복합 PK 자체가 "중복 저장 불가"를 보장 — surrogate id 불필요(이 테이블을 참조하는 다른 테이블 계획 없음) |

soft delete 불필요(요구사항 확인) — 해제는 hard delete. UPDATE 정책 없음(변경할 필드가 없음). `mg_phrase_bookmarks`(hard delete, unique 제약) 선례와 동일한 운용.

## 8. 리뷰 테이블 구조

### `mg_place_reviews`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint generated always as identity PK | |
| place_id | bigint not null, FK → mg_places(id) **on delete restrict** | 장소는 보통 `is_active` 플래그로만 비활성화되고 hard delete되지 않으므로, 실수로 장소가 삭제될 때 리뷰 이력이 통째로 사라지는 사고를 막기 위해 restrict 선택(북마크는 반대로 cascade — 북마크는 이력 가치가 없는 포인터라 성격이 다름) |
| user_id | uuid **null**, FK → auth.users(id) **on delete set null**, default `auth.uid()` | 탈퇴 후에도 리뷰 유지 요구를 충족하려면 컬럼 자체가 nullable이어야 한다(not null이면 `on delete set null` 액션이 제약 위반으로 실패한다) |
| author_name | text not null | INSERT/UPDATE 시 트리거가 `auth.users.display_name`으로 강제 설정(§9) — 클라이언트 값 불신 |
| rating | smallint not null, `check (rating between 1 and 5)` | |
| content | text null, `check (content is null or char_length(btrim(content)) between 1 and 1000)` | **별점만 있는 리뷰 허용** — content 미입력이면 null. 빈 문자열은 트리거가 null로 정규화(§9) 후 이 체크를 통과 |
| ui_locale | text not null default 'en', `check (btrim(ui_locale) <> '')` | 작성 당시 앱 언어 기록. **실제 리뷰 언어 배지로 사용 금지**(§23) |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | `set_updated_at()` 트리거 |
| edited_at | timestamptz null | rating/content 실변경 시에만 트리거가 갱신(§9) |
| deleted_at | timestamptz null | soft delete |
| deleted_by | uuid null, FK → auth.users(id) **on delete set null** | |

**별점만 있는 리뷰**: `content`는 nullable이고 NOT NULL 제약이나 프론트 필수 검증을 두지 않는다. 평균 별점·리뷰 수 집계(§12)는 `rating`만으로 이뤄지므로 별점만 있는 리뷰도 정상 포함된다.

**삭제 경로**: `deleted_at`/`deleted_by`는 일반 UPDATE grant에 포함하지 않는다 — 오직 `soft_delete_my_place_review(p_review_id)` RPC(§24, §25)만 이 두 컬럼을 설정할 수 있고, RPC 내부에서 `deleted_at = now()`, `deleted_by = auth.uid()`를 강제한다. 사용자가 임의 시각을 지정하거나, 타인 UUID를 `deleted_by`로 지정하거나, `deleted_at`을 다시 null로 되돌려 삭제를 복구하는 경로는 전부 차단된다. 이미 삭제된 리뷰에 RPC를 다시 호출하면 조용히 넘어가지 않고 오류를 낸다(복구를 암시하는 no-op을 피하기 위함).

### 1인 1가게 1활성 리뷰 (부분 유니크 인덱스)

```sql
create unique index ... on mg_place_reviews (place_id, user_id)
  where deleted_at is null and user_id is not null;
```

- soft delete된 행은 인덱스 대상에서 빠지므로, 삭제 후 같은 (place_id, user_id)로 **새 insert**가 즉시 허용된다(과거 이력은 deleted_at이 채워진 채 보존).
- `user_id is not null` 조건 덕분에, 탈퇴로 `user_id`가 null이 된 여러 리뷰가 같은 장소에 있어도 이 인덱스에 걸리지 않는다(null끼리는 유니크 판정에서 서로 다른 것으로 취급되지만, 조건을 명시해 의도를 분명히 한다).

### edited_at 판정 방식 — 채택 이유

| 방식 | 채택 여부 |
|---|---|
| `updated_at > created_at` | **기각** — soft delete, 닉네임 동기화 RPC의 UPDATE 등 시스템성 UPDATE도 `updated_at`을 건드리므로 오탐 발생 |
| **`edited_at nullable`** | **채택** — BEFORE UPDATE 트리거가 `rating` 또는 `content`가 실제로 바뀐 경우에만 `edited_at := now()`로 세팅하고, 그 외 UPDATE(soft delete, 닉네임 동기화)에서는 `edited_at`을 이전 값으로 유지 |
| `edit_count` | 기각(이번 요구 — "Edited" 단일 표시에는 과잉) — 필요해지면 `edited_at is not null` 곁에 `alter table add column edit_count`로 추가 가능한 하위 호환 확장 |

## 9. author_name 보안 — 트리거 설계

리뷰 INSERT/UPDATE 시 실행되는 단일 BEFORE 트리거 `mg_place_reviews_before_write()`가 세 가지를 처리한다(순서대로):

1. **content 정규화**: 빈 문자열(공백만 포함)이면 `null`로 변환 — 이후 CHECK 제약이 이 정규화된 값을 검사한다.
2. **author_name 강제**: `new.user_id`가 not null이면 `auth.users.raw_user_meta_data ->> 'display_name'`을 조회해 `new.author_name`에 강제 대입. **display_name이 없거나 빈 문자열이면 예외를 발생시켜 INSERT/UPDATE 자체를 거부**(요구사항: "display_name이 없으면 리뷰 insert를 거부"). 이메일 fallback이나 `'Traveller'` 같은 공통 이름 대입은 절대 하지 않는다.
3. **edited_at 판정**: `TG_OP = 'UPDATE'`이고 `rating` 또는 `content`가 이전 값과 다를 때만 `edited_at := now()`, 그 외에는 이전 값 유지.

트리거는 `security definer`로 만들어 `auth.users`(일반적으로 authenticated 역할이 직접 select할 수 없는 테이블)를 안전하게 조회하고, `set search_path = public`으로 고정한다.

**author_name 스푸핑 방어의 이중 구조**: ① 트리거가 client가 보낸 값과 무관하게 항상 `auth.users`에서 값을 재계산해 덮어쓴다. ② INSERT/UPDATE 컬럼 grant에서 `author_name` 자체를 클라이언트에게 부여하지 않는다(§10) — 클라이언트는 이 컬럼을 명시적으로 지정할 수조차 없다.

## 10. 닉네임 변경 동기화

### 개별 리뷰: 자동 (추가 코드 불필요)

닉네임을 바꾼 사용자의 리뷰 row는 어떤 이유로든 UPDATE될 때마다(§9 트리거) `author_name`이 최신 `display_name`으로 재계산된다. 따라서 "리뷰를 언제든 다시 저장/터치"하면 자동 동기화된다.

### 즉시 동기화가 필요한 경우: `sync_my_author_name()` RPC

닉네임 변경 즉시 커뮤니티 글·댓글·리뷰의 표시 이름을 한 번에 맞추기 위한 함수. 요구사항(§6)대로 커뮤니티 2테이블도 함께 다룬다 — **이것은 기존 커뮤니티 테이블의 스키마·RLS·grant를 전혀 바꾸지 않는다.** 이 함수는 SECURITY DEFINER로 테이블 소유자 권한으로 UPDATE를 실행하는 새 DB 객체 1개일 뿐이며, 현재 `useAuth.jsx`의 best-effort 이중 UPDATE(64-74행, 실패 시 무음 무시)를 대체할 수 있는 더 안전한 대안으로 설계했다.

```
public.sync_my_author_name()
```

- 인자 없음 — **클라이언트가 새 닉네임 문자열을 보내지 않는다.**
- `auth.uid()`로 호출자를 식별하고, `auth.users.raw_user_meta_data ->> 'display_name'`에서 **직접** 최신 이름을 읽는다.
- display_name이 없으면 예외(동기화할 이름이 없음).
- `mg_community_posts`, `mg_community_comments`는 `author_name = v_name`으로 직접 UPDATE(자기 자신의 `user_id` 행만 — `where user_id = auth.uid()`).
- `mg_place_reviews`는 `updated_at = now()`만 세팅해 UPDATE를 발생시키면 §9 트리거가 `author_name`을 자동 재계산한다(로직 중복 없음).
- `security definer`, `set search_path = public`, **`grant execute`는 `authenticated`에만 부여, `anon`은 실행 불가.**
- 다른 사용자의 이름은 절대 변경할 수 없다 — 모든 UPDATE의 WHERE 절이 `auth.uid()`로 고정돼 있고 함수 인자로 대상 user_id를 받지 않는다.

**프론트 반영은 이번 범위 밖**이다(이 문서는 DB 설계만). 후속 구현 시 `updateDisplayName`이 기존 이중 UPDATE 대신 이 RPC 1회 호출로 대체될 수 있다는 점만 여기 기록해 둔다.

## 11. 이메일 fallback 금지 — 반영 위치

§9 트리거의 "display_name 없으면 예외" 로직이 이메일이나 고정 문자열로 대체하지 않고 **쓰기 자체를 막는** 방식으로 이 요구사항을 만족한다. 프론트에서는 리뷰 작성 진입 전 사용자가 display_name을 갖고 있는지 먼저 확인해 안내하는 UX가 필요하다는 점을 후속 구현 메모(§33)에 남긴다.

## 12. 사용자 탈퇴 후 리뷰 유지

- `user_id uuid null references auth.users(id) on delete set null` — 탈퇴 시 FK 액션으로 `user_id`만 null이 되고, `author_name`(마지막 공개 닉네임 snapshot)·`rating`·`content`·이미지는 그대로 남아 리뷰가 계속 공개된다.
- SELECT 정책은 `deleted_at is null`만 검사하므로 `user_id`가 null인 리뷰도 정상 노출된다.
- 부분 유니크 인덱스는 `user_id is not null` 조건이 있어 탈퇴 리뷰끼리 충돌하지 않는다(§8).
- 탈퇴 사용자를 "Deleted user"로 표시할지는 **후속 정책**이며 이번엔 적용하지 않는다(요구사항 명시) — 현재는 마지막 snapshot 닉네임이 그대로 보인다.
- 북마크는 요구사항대로 `user_id on delete cascade`로 탈퇴 시 함께 삭제된다(리뷰와 반대 정책 — 개인화 데이터라 보존 가치가 없음).

## 13. 프로필 사진 향후 확장

이번 스키마에는 avatar URL/path를 **어디에도 넣지 않는다**(리뷰 테이블 포함). 향후 별도 프로필 테이블이 생기면:

```
review.user_id  →  (미래) mg_user_profiles.user_id  →  mg_user_profiles.avatar_path
```

식으로 리뷰가 `user_id`를 통해 프로필과 조인된다. `user_id`가 null(탈퇴)이면 조인 결과가 없어 프론트가 자동으로 기본 아바타를 쓰면 된다 — 이것이 `user_id`를 nullable로 유지해야 하는 또 다른 이유(FK 조인의 자연스러운 폴백)다. **이번 SQL에서 `mg_user_profiles`를 만들지 않는다.**

## 14. 사용자 리뷰 모음 향후 확장

`mg_place_reviews(user_id, created_at desc, id desc) where deleted_at is null` 부분 인덱스(§16)를 이번에 미리 만들어 둔다 — 후속 라우트(`/users/:userId/reviews` 후보) 도입 시 인덱스 마이그레이션 없이 바로 사용 가능하다. 공개 정보는 프로필 이미지·닉네임·공개 리뷰 수·공개 리뷰 목록이며, 이메일·Auth metadata 전체·로그인 제공자·내부 UUID 원문 노출은 금지된다는 정책만 기록하고 화면 구현은 후속이다.

## 15. 리뷰 이미지 Storage와 DB 구조

### 저장 방식 비교와 채택

| 방식 | 평가 |
|---|---|
| 리뷰 row에 URL 배열(jsonb/text[]) | 커뮤니티가 쓰는 방식과 동일하나, 개별 이미지 삭제·재정렬이 배열 조작이 되고 **고아 파일을 추적할 수단이 없다**(커뮤니티에 이미 존재하는 문제) |
| **별도 테이블 + storage_path** | **채택.** path 인벤토리가 DB에 남아 고아 정리 배치가 가능하고, 개별 삭제·순서·모더레이션 확장에 유리 |

### Storage 경로 규칙 — 채택안과 비교

리뷰 row 생성 전에는 review_id가 없다는 문제를 다음과 같이 비교했다.

| 방식 | 평가 |
|---|---|
| **① 리뷰 row 먼저 생성 → `{user_id}/{review_id}/{uuid}.{ext}`로 업로드** | **채택.** 이미지는 어차피 FK로 review_id가 필요해 리뷰 존재가 전제이며, 경로 자체가 "어느 리뷰의 사진인지"를 담아 고아 정리가 쉽다(리뷰 폴더 단위로 목록·정리 가능) |
| ② 임시 경로 업로드 후 review_id 경로로 이동 | 기각 — 이동 작업이 추가 실패 지점을 만들고, 고아 위험을 줄이지 못하면서 복잡도만 늘린다 |
| ③ `{user_id}/{uuid}.{ext}` (review_id 없이) | 기각 — 사용자 폴더 전체를 뒤져야 어느 리뷰 소속인지 알 수 있어 고아 추적이 오히려 어려워진다 |

**채택 흐름**: 리뷰 작성(내용+별점) → row 생성(id 발급) → 최대 3장 업로드(`{user_id}/{review_id}/{uuid}.{ext}`) → `mg_place_review_images` insert. 리뷰 수정 화면에서 사진을 나중에 추가하는 경우도 review_id가 이미 있으므로 동일 경로 규칙이 그대로 적용된다.

### 원자성 한계와 대응 (문서화)

Storage와 Postgres는 별개 시스템이라 트랜잭션이 없다.

- **업로드 성공 + DB insert 실패** → Storage에 고아 파일. 대응: DB insert 실패 시 프론트가 방금 올린 파일을 즉시 remove(베스트 에포트). 놓치더라도 파일 경로가 특정 review_id 폴더에 속해 있어 후속 배치가 "DB에 없는 review_id 폴더의 파일"을 정리할 수 있다.
- **DB row 삭제 성공 + Storage remove 실패** → Storage에 파일이 남지만 DB에 참조가 없어 화면에는 노출되지 않는다(무해). 후속 배치가 정리.
- 이번 범위에서 자동 정리 배치는 만들지 않는다 — 수동/후속 운영 작업으로 남긴다(§26 남은 위험).

### `mg_place_review_images`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | bigint identity PK | |
| review_id | bigint not null, FK → mg_place_reviews(id) **on delete cascade** | 리뷰가 (관리 목적으로) hard delete되면 이미지 메타데이터도 함께 정리 |
| storage_path | text not null | public URL이 아니라 path — 표시 시점에 `getPublicUrl` 파생 |
| sort_order | smallint not null default 0 | 표시 순서 |
| created_at | timestamptz not null default now() | |

- **최대 3장 DB 보장**: BEFORE INSERT 트리거가 해당 review_id의 기존 이미지 수를 세어 3장 이상이면 예외. 프론트 검증(선택 단계에서 3장 제한)과 이중 방어.
- soft delete 없음 — 이미지 메타데이터는 이력 보존 가치가 낮아 **hard delete 허용**(요구사항 확인). 리뷰가 soft delete되면(§8) 이미지 row는 그대로 남지만 SELECT 정책이 부모 리뷰의 `deleted_at is null`을 검사하므로 **화면에는 즉시 비노출**된다(요구사항: "리뷰가 soft delete되면 화면에는 절대 노출되지 않는다" 충족). 실제 Storage 파일 삭제는 배치로 후속 처리(즉시 삭제 대신 유지 후 배치 정리를 채택 — 소프트 삭제된 리뷰가 관리자 판단으로 복원될 가능성에 대비해 이미지 파일을 급하게 지우지 않는 편이 안전).

## 16. 인덱스 설계

```
-- 가게별 최신 리뷰 (상세 화면 최신 2개 + 전체 리뷰 5개 cursor pagination)
create index ... on mg_place_reviews (place_id, created_at desc, id desc) where deleted_at is null;

-- 사용자별 공개 리뷰 (후속 사용자 리뷰 모음 화면 대비 — 지금 만들어도 부담 적음)
create index ... on mg_place_reviews (user_id, created_at desc, id desc) where deleted_at is null;

-- 활성 리뷰 유니크 (1인 1가게 1리뷰)
create unique index ... on mg_place_reviews (place_id, user_id) where deleted_at is null and user_id is not null;

-- 리뷰 이미지 표시 순서
create index ... on mg_place_review_images (review_id, sort_order);
```

## 17. 평균 별점 집계 방식

| 방식 | 평가 | 채택 시점 |
|---|---|---|
| 매 요청 클라이언트 집계 | 리뷰 수가 늘면 낭비 | 사용 안 함 |
| **SQL view (`mg_place_review_stats`)** | 단건 조회(가게 상세)에 적합, 구조 단순 | **1단계 채택** |
| RPC 함수 | PostgREST 집계 제한 시 대안 — 이번엔 view로 충분 | 필요 시 대안 |
| materialized view | refresh 관리 필요, 실시간성 낮음 | 부적합 |
| `mg_places` 집계 컬럼 + 트리거 | Saved Places 카드·지도 카드 등 **다건 표시**에만 현실적 | **2단계(후속)** — 이번엔 과잉이라 생성하지 않음 |

```
create view mg_place_review_stats
with (security_invoker = true) as
select place_id, count(*)::int as rating_count, round(avg(rating)::numeric, 1) as rating_avg
from mg_place_reviews
where deleted_at is null
group by place_id;
```

- `security_invoker = true`로 조회자 권한 기준으로 동작(리뷰 SELECT가 이미 공개라 실효 위험은 낮지만 원칙대로 명시).
- **0건 장소는 이 view에 행 자체가 없다** — 프론트는 "행 없음"을 rating_count=0/`No reviews yet`으로 해석해야 한다(합성 0행을 만들지 않음 — 단순성 우선).
- 평균은 소수 1자리 반올림(`★ 4.6` 형태에 맞춤).
- 추천 알고리즘(courseBuilder)에는 반영하지 않는다(요구사항 확인).

## 18. 상세 화면 최신 리뷰 2개 정책 반영

Reviews 섹션은 전체 리뷰를 내려받지 않는다. 프론트는 `mg_place_reviews`에서 `place_id` + `deleted_at is null` + `order by created_at desc, id desc limit 2`로 최신 2개만 조회하고, `mg_place_review_stats`에서 `rating_count`를 함께 읽어 0/1/2+ 케이스에 따라 "모든 리뷰 보기" 버튼 노출 여부를 결정한다(§16의 `(place_id, created_at desc, id desc) where deleted_at is null` 인덱스가 이 쿼리를 지원).

## 19. 전체 리뷰 화면 cursor pagination 반영

후속 라우트(`/places/:placeId/reviews`)는 `(created_at, id)` 커서 기반 5개 단위 조회를 쓴다. 쿼리 형태(설계만, 실행 SQL 아님):

```sql
select * from mg_place_reviews
where place_id = :placeId and deleted_at is null
  and (created_at, id) < (:cursorCreatedAt, :cursorId)  -- 첫 페이지는 이 조건 생략
order by created_at desc, id desc
limit 5;
```

`(created_at desc, id desc)` 튜플 비교로 동일 `created_at` 충돌(동시 작성)도 `id`가 타이브레이커가 되어 안전하게 처리된다. 이 패턴을 지원하도록 §16 인덱스를 `(place_id, created_at desc, id desc)` 복합으로 설계했다. offset pagination은 사용하지 않는다(요구사항 확인).

## 20. 모든 언어 리뷰 통합 표시 반영

리뷰 목록·최신 2개 쿼리 어디에도 `ui_locale` 필터가 없다 — 작성 언어와 무관하게 한 목록에 표시된다(요구사항 확인). `ui_locale`은 통계·필터에 관여하지 않는 순수 기록 컬럼이다.

## 21. AI 번역 후속 확장 (설계만)

이번엔 테이블·컬럼을 추가하지 않는다. 후속 시 고려할 방향(기록만): 원문(`content`)은 불변 보존, 번역 결과는 별도 캐시 테이블(`mg_place_review_translations(review_id, target_locale, translated_content, provider, created_at)`) 또는 온디맨드 캐시로 분리 — 리뷰 원본 테이블에 번역 컬럼을 직접 추가하지 않는 편이 언어 확장에 유리하다는 점만 기록한다.

## 22. 도움돼요 후속 확장 (설계만)

이번 `mg_place_reviews`에 `helpful_count` 컬럼을 넣지 않았다. 후속 후보:

```
mg_place_review_helpful (review_id, user_id, created_at, PK(review_id, user_id))
```

검토 필요 사항(후속 설계 시): 로그인 전용, 본인 리뷰에 대한 자기 "도움돼요" 허용 여부, soft delete 리뷰 제외, 취소 가능, 카운트는 매 요청 집계 또는 `mg_place_reviews.helpful_count` 트리거 동기화 중 선택. 이번 범위에서는 스키마도 인덱스도 만들지 않는다.

## 23. `ui_locale` 오용 방지 명시

`ui_locale`은 "리뷰 작성 당시 사용자의 앱 UI 언어"일 뿐, **리뷰 본문이 실제로 어떤 언어로 쓰였는지를 보장하지 않는다**(예: UI가 EN이어도 사용자가 한국어로 리뷰를 쓸 수 있음). 따라서 언어 배지·번역 트리거 조건으로 `ui_locale`을 사용하지 않는다 — 실제 언어 배지는 후속 언어 감지 기능이 붙은 뒤에 별도로 구현한다(요구사항 확인, §12 문서 원본과 동일 원칙 유지).

## 24. RLS 요약

| 테이블/뷰 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| mg_place_detail_sections | anon+auth, `is_active`와 무관하게 전체(관리 화면·과거 스냅샷 해석 대비) | 없음(유보) | 없음(유보) | 없음 |
| mg_place_detail_section_translations | anon+auth 전체 | 없음(유보) | 없음(유보) | 없음 |
| mg_place_bookmarks | 본인만(`user_id=auth.uid()`) | 본인만 | 없음 | 본인만 |
| mg_place_reviews | anon+auth, `deleted_at is null` | 본인만(`user_id=auth.uid()`) | 본인만(행: `user_id=auth.uid()`, 컬럼: **rating/content만**) — soft delete는 RLS/grant가 아니라 `soft_delete_my_place_review()` RPC 전용 경로로만 수행 | 없음(hard delete 미제공) |
| mg_place_review_images | anon+auth, 부모 리뷰 `deleted_at is null`인 것만 | 본인 리뷰(`review.user_id=auth.uid()`)에만, 컬럼: **review_id/storage_path/sort_order만** | 없음 | 본인 리뷰의 이미지만 |
| mg_place_review_stats(view) | anon+auth | — | — | — |
| `soft_delete_my_place_review(bigint)` (RPC) | — (실행 권한 대상) | **authenticated만 EXECUTE**, anon EXECUTE 없음 | — | — |

## 25. 최소 grant 요약 (선 revoke, 후 최소 grant)

전 신규 테이블에 대해 `revoke all on ... from public, anon, authenticated;`를 먼저 실행한 뒤, 아래만 명시적으로 grant한다.

| 테이블 | anon | authenticated |
|---|---|---|
| mg_place_detail_sections / translations | select | select |
| mg_place_bookmarks | (없음) | select, insert, delete |
| mg_place_reviews | select | select, **insert(place_id, rating, content, ui_locale만)**, **update(rating, content만)** |
| mg_place_review_images | select | select, **insert(review_id, storage_path, sort_order만)**, delete |
| mg_place_review_stats | select | select |

- 리뷰 INSERT 컬럼 grant에서 **user_id·author_name·created_at·edited_at·updated_at·id·deleted_at·deleted_by를 의도적으로 제외**했다 — `user_id`는 `default auth.uid()`가 채우고, `author_name`은 트리거가 채운다. 클라이언트는 이 컬럼들을 애초에 SQL에서 지정할 수조차 없다(문법적으로 컬럼 grant가 없으면 INSERT 문에 해당 컬럼을 나열하는 것 자체가 권한 오류).
- **리뷰 UPDATE 컬럼 grant는 `rating`·`content`만 허용한다.** `place_id`·`user_id`·`author_name`·`created_at`·`edited_at`은 물론 **`deleted_at`·`deleted_by`도 제외**했다 — 처음 설계에서는 이 두 컬럼도 UPDATE grant에 포함했으나, 그러면 사용자가 `deleted_at`을 임의 시각으로 지정하거나 `deleted_by`에 타인 UUID를 넣거나 `deleted_at`을 다시 null로 되돌려 삭제를 "복구"할 수 있다는 문제가 있어 **soft_delete_my_place_review() RPC 전용 경로로 교체**했다(§8, §33). 이 컬럼 grant 축소는 커뮤니티 카운트 조작 사례(docs/31 ISSUE-03)의 교훈을 리뷰에 선반영한 것이기도 하다.
- **리뷰 이미지 INSERT 컬럼 grant는 `review_id`·`storage_path`·`sort_order`만 허용한다.** 처음 설계는 테이블 단위 `grant insert`였으나, `id`(identity)·`created_at`(default now())까지 클라이언트가 지정할 수 있게 열려 있을 필요가 없어 컬럼 단위로 축소했다.
- **`soft_delete_my_place_review(p_review_id bigint)`**: 인자로 `user_id`/`deleted_at`/`deleted_by`를 받지 않는다 — 함수 내부에서 `auth.uid()`로 소유자를 확인하고 `deleted_at = now()`, `deleted_by = auth.uid()`를 직접 설정한다. `security definer` + `set search_path = public`, `revoke all ... from public, anon` 후 `grant execute ... to authenticated`만 부여한다. 이미 삭제된 리뷰에 재호출하면 예외를 던진다(no-op이 아님 — 삭제 복구를 암시하지 않기 위함).

## 26. Storage 정책 방향

- 신규 버킷 `place-review-images`(public, 5MB, `image/jpeg|image/png|image/webp`).
- 경로: `{user_id}/{review_id}/{uuid}.{ext}`.
- 정책: public SELECT / authenticated 본인 폴더 INSERT(`(storage.foldername(name))[1] = auth.uid()::text` + `review_id` 폴더가 실제 본인 리뷰인지 서브쿼리로 재확인) / authenticated 본인 폴더 DELETE.
- **커뮤니티 버킷(`community-post-images`)에는 어떤 정책도 추가하지 않는다** — DELETE 정책 신설 금지 요구사항을 그대로 지켰다.

## 27. SQL 실행 순서 (요약 — 상세는 SQL 문서)

보조 함수·트리거 함수 → sections 테이블 → translations 테이블 → seed → bookmarks 테이블 → reviews 테이블 → 리뷰 트리거(작성자 강제/edited_at/content 정규화) → **soft_delete_my_place_review() RPC** → review_images 테이블 → 이미지 개수 제한 트리거 → stats view → 인덱스 → RLS 활성화+정책 → revoke/grant → Storage bucket → Storage policy → (선택) 닉네임 동기화 RPC.

## 28. 검증 방법 (요약)

테이블/뷰 존재, 컬럼 타입, PK/FK/unique/index 목록, seed 4행+8번역행, RLS 활성화, 정책 목록, grant 목록, view 조회, Storage 버킷·정책, 함수/트리거 존재, `select has_table_privilege` 계열로 anon/authenticated 예상 접근 재확인 — 전체 SQL은 별도 문서 §3에 있다.

## 29. Rollback

이번에 만든 객체(2개 신규 테이블 그룹 + 1개 view + 2개 트리거 함수 + 1개 RPC + 1개 버킷 + 관련 정책)만 역순으로 제거한다. **기존 `set_updated_at()`, 커뮤니티 테이블·정책·버킷, 장소 데이터, 음식 카테고리 테이블, 저장 코스, `ail_*` 객체는 절대 건드리지 않는다.** Storage 버킷은 안에 파일이 있으면 대시보드에서 먼저 비운 뒤 삭제해야 한다는 주의를 SQL 문서에 명시했다(메타데이터만 지우면 실제 blob이 고아로 남을 수 있음).

## 30. 남은 위험

1. **author_name 트리거의 `auth.users` 조회 권한**: SECURITY DEFINER로 우회하지만, `auth` 스키마 조회 권한이 함수 소유자(대개 SQL Editor 실행자 = postgres/service 계열)에게 있어야 한다 — 실행 시 오류가 나면 소유자 권한을 사용자에게 안내해야 한다(검증 SQL에 확인 절차 포함).
2. **`security_invoker` view 옵션의 Postgres 버전 의존성** — 구버전이면 문법 오류 가능. 검증 SQL에서 view 생성 성공 여부를 1차 확인 지점으로 삼는다.
3. **Storage-DB 비원자성으로 인한 고아 파일** — 자동 정리 배치는 이번 범위에 없다(§15).
4. **sync_my_author_name()이 커뮤니티 테이블을 UPDATE한다는 점** — 스키마·RLS·grant는 그대로지만, 이 함수가 실행되면 실제 데이터(author_name 값)가 바뀐다. 사용자가 원치 않으면 이 함수 생성 블록만 SQL 실행에서 제외해도 나머지 기능(섹션/북마크/리뷰)은 완전히 독립적으로 동작한다 — SQL 문서에 이 블록을 별도로 표시했다.
5. **section_key 5번째 추가 시 프론트 폴백 부재** — 이번 범위 밖이지만 관리자 기능 이전에 반드시 처리해야 할 선행 조건으로 남긴다(§4).
6. **`mg_places.id` 등 FK 대상 타입은 사용자가 이미 확인한 bigint를 신뢰**하되, `mg_saved_courses.place_ids`가 `bigint[]`인 점과의 정합성은 이번 SQL이 검증 단계(§3)에서 재확인한다.

## 31. 프론트 구현 단계에서 주의할 점 (이번엔 미구현 — 기록만)

- 리뷰 작성 폼 진입 전 `display_name` 존재 여부를 먼저 확인해 없으면 "닉네임을 먼저 설정해 주세요" 안내(트리거의 거부를 사용자에게 사전에 설명하는 UX가 필요).
- 리뷰 작성 성공 후에만 이미지 업로드를 시작(§15 순서).
- Reviews 섹션은 활성 섹션이면 데이터 유무와 무관하게 항상 렌더(§3) — Menu/Visit Info도 동일 원칙으로 전환(현재 PlaceDetailSheet는 데이터 없으면 섹션을 숨기므로, 탭 도입 시 이 동작을 "탭은 항상 존재, 콘텐츠 영역만 빈 상태로 대체"로 바꿔야 함).
- `mg_place_review_stats`에 행이 없는 경우를 0건으로 처리(합성 0행 없음, §17).
- `ui_locale`을 언어 배지에 쓰지 않기(§23).
- 닉네임 변경 시 `sync_my_author_name()` RPC 호출로 기존 `useAuth.jsx`의 best-effort 이중 UPDATE를 대체할지는 후속 결정 사항.
- 리뷰 삭제 버튼은 직접 `update`가 아니라 `supabase.rpc('soft_delete_my_place_review', { p_review_id })`를 호출해야 한다 — 일반 UPDATE grant에는 `deleted_at`/`deleted_by`가 없으므로 직접 UPDATE 시도는 권한 오류로 실패한다(§8, §25).

## 32. 후속 구현 순서 (기록만 — 이번엔 코드 미변경)

1. 사용자가 SQL 직접 실행
2. 사용자 검증 결과 확인
3. 상세 섹션 API + fallback
4. PlaceDetailSheet 분리
5. 탭 바 가로 스크롤
6. 콘텐츠 세로 섹션
7. Location Kakao 미니 지도
8. 가게 북마크
9. Courses 내부 Saved Routes / Saved Places
10. 리뷰 통계 + 최신 리뷰 2개
11. 전체 리뷰 화면 + 5개 cursor pagination
12. 리뷰 작성·수정·soft delete
13. 리뷰 사진
14. 기본 아바타 UI
15. 작성자 영역 클릭 확장 준비
16. 향후 사용자 리뷰 모음
17. 향후 프로필 사진
18. 향후 도움돼요
19. 향후 AI 리뷰 번역
20. 관리자 기반 후 상세 섹션 관리

## 33. 요구사항 대조 체크리스트 (자체 검증)

- [x] Menu = 화면 섹션 탭, 새 음식 메뉴 DB 아님 (§3)
- [x] Visit Info 기존 DB 값 재사용, 재설계 아님 (§3)
- [x] 별점만 있는 리뷰 허용, content nullable, 필수 검증 없음 (§8)
- [x] 1인 1가게 1활성 리뷰 DB 제약(부분 유니크 인덱스) (§8)
- [x] soft delete 후 새 insert 허용(부분 인덱스가 삭제 행 제외) (§8)
- [x] edited_at이 rating/content 실변경에만 반응, 시스템성 UPDATE와 분리 (§9)
- [x] 탈퇴 사용자 리뷰 삭제되지 않음, user FK가 cascade 아닌 set null (§12)
- [x] 이메일 fallback 없음, display_name 없으면 insert 거부 (§9, §11)
- [x] author_name 사칭 방지(트리거 + 컬럼 grant 이중) (§9, §25)
- [x] 닉네임 변경 동기화(RPC, auth.uid() 기반, 인자로 이름 안 받음) (§10)
- [x] 프로필 사진 URL을 리뷰에 snapshot으로 넣지 않음 (§13)
- [x] 최신 리뷰 2개 반영 (§18)
- [x] 전체 리뷰 화면 5개 cursor pagination 반영 (§19)
- [x] 리뷰 읽기 비로그인 공개 (§24)
- [x] 모든 언어 리뷰 통합 표시, ui_locale로 필터하지 않음 (§20, §23)
- [x] 신규 리뷰 버킷이 커뮤니티 버킷과 완전 분리 (§26)
- [x] rollback이 기존 객체 무변경 (§29)
- [x] 리뷰 soft delete가 전용 RPC(`soft_delete_my_place_review`)로만 가능 — 일반 UPDATE grant에 `deleted_at`/`deleted_by` 없음, 임의 시각·타인 UUID 지정·삭제 복구 차단 (§8, §24, §25)
- [x] 리뷰 이미지 INSERT가 컬럼 단위(`review_id`/`storage_path`/`sort_order`)로 최소화 — 테이블 단위 grant 아님 (§25)
