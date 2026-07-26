# Public Course Detail — Recommended by-key RPC (not implemented, not executed)

- 작성 일시: 2026-07-27 KST
- **이 문서의 SQL은 설계 제안일 뿐이며, 이 세션에서 실행하지 않았다.** Supabase에 이런 함수가 실제로 존재하는지도 확인하지 않았다 — 아래는 "필요하다면 이런 모양이어야 한다"는 제안이다.
- 배경: `src/pages/PublicCourseDetailPage.jsx`(공개 동선 전체 화면 상세)는 목록에서 넘어올 때는 router state(`location.state.publicCourse`)를 즉시 사용하지만, 사용자가 URL을 직접 열거나 새로고침하면 state가 없다. 이때 프론트는 임시로 기존 `get_public_course_feed(p_sort, p_limit, p_offset)`를 `sort='popular'`/`'latest'` 두 번 호출해(각각 `MAX_PUBLIC_FEED_ITEMS`=150건) 그 안에서 `public_route_key`가 일치하는 행을 찾는 방식(`fetchPublicCourseByKey()`, `src/features/courses/services/publicFeedService.js`)으로 임시 대응했다.
- 이 임시 방식의 한계: 인기순/최신순 각 상위 150건 안에 없는(오래되고 인기가 없는) 공개 동선은, 그 동선이 여전히 유효한 공개 동선이더라도 "찾을 수 없음"으로 잘못 표시된다. 또한 매번 최대 300행을 조회하므로 목록 화면보다 훨씬 무겁다.
- 아래 RPC가 실제로 만들어지면 `fetchPublicCourseByKey()`를 이 RPC 호출 한 번으로 교체하면 된다(다른 프론트 코드는 그대로 두어도 됨 — 함수 시그니처는 `fetchPublicCourseByKey(publicRouteKey) => Promise<row|null>`로 이미 고정해 두었다).

---

## 제안하는 RPC

```sql
-- 제안만 함. 실행하지 않았음. 실제 mg_saved_courses 컬럼과 대조 후 사용할 것.
create or replace function public.get_public_course_by_key(p_public_route_key text)
returns table (
  public_route_key text,
  title text,
  locale text,
  stops jsonb,
  course_snapshot jsonb,
  total_distance_m integer,
  total_duration_min integer,
  stop_count integer,
  preference_keys text[],
  course_theme_key text,
  title_schema_version integer,
  anchor_type text,
  anchor_key text,
  anchor_label text,
  anchor_name_original text,
  anchor_address_original text,
  anchor_area_original text,
  save_count integer,
  is_saved boolean,
  my_saved_course_id bigint
)
language sql
security definer
set search_path = public
as $$
  -- get_public_course_feed와 동일한 "대표 동선 anonymize" 규칙을 그대로 재사용해야 한다.
  -- user_id/작성자 닉네임 등 개인 식별 정보를 반환하지 않는 것도 동일하게 유지.
  -- 실제 정의는 get_public_course_feed의 내부 쿼리(대표 동선 선정 로직, save_count
  -- 집계, 호출자 본인의 is_saved/my_saved_course_id 계산)를 public_route_key 단일
  -- 값으로 필터링하는 형태가 되어야 한다 — 이 문서는 그 내부 쿼리 본문을 알지 못하므로
  -- (기존 RPC의 실제 SQL 정의가 이 저장소에 없음) 반환 컬럼 목록만 제안한다.
$$;
```

## 입력

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `p_public_route_key` | `text` | `PublicCourseCard`/`PublicRoutesTab`이 이미 쓰는 것과 동일한 대표 동선 식별자 |

## 반환 (1행 또는 0행)

`get_public_course_feed`가 각 행에 이미 채워주는 필드와 동일해야 한다 — `docs/57` §4.3/§9가 문서화한 필드 구성을 그대로 따름:

- 익명화된 대표 동선의 공개 가능 컬럼 전체(`title`, `stops`, `course_snapshot`, `total_distance_m`, `total_duration_min`, `stop_count`, `preference_keys`, `course_theme_key`, `title_schema_version`, `anchor_*`, `locale` 등 — `mg_saved_courses`의 `user_id`/`id`/`deleted_at` 등 개인 식별·소유 컬럼은 제외)
- `save_count` — 이 대표 동선을 저장한 전체 사용자 수
- `is_saved` — **호출한 현재 사용자 본인** 기준 저장 여부(비로그인이면 항상 `false`)
- `my_saved_course_id` — 저장했다면 본인의 `mg_saved_courses.id`, 아니면 `null`(`togglePublicCourseSave`/`softDeleteSavedCourse`가 그대로 쓸 수 있어야 함)

## 보안

- `get_public_course_feed`/`get_public_place_feed`와 동일하게 **SECURITY DEFINER**여야, 다른 사용자의 저장 데이터를 집계(`save_count`)하고 호출자 본인의 `is_saved`/`my_saved_course_id`만 골라 계산할 수 있다.
- 비로그인 호출도 허용해야 한다(공개 동선 상세는 로그인 없이 열람 가능해야 함 — 이번 작업의 요구사항).
- 존재하지 않거나 더 이상 공개되지 않는 `public_route_key`는 0행을 반환해야 한다(에러가 아니라 빈 결과 — 프론트의 "찾을 수 없음" 상태와 자연스럽게 맞물림).

## 프론트 교체 지점

`src/features/courses/services/publicFeedService.js`의 `fetchPublicCourseByKey(publicRouteKey)` 함수 본문만 아래처럼 교체하면 된다(반환 shape는 이미 이 문서의 반환 컬럼과 동일하게 맞춰 두었음).

```js
export async function fetchPublicCourseByKey(publicRouteKey) {
  if (!publicRouteKey) return null;
  const { data, error } = await supabase.rpc('get_public_course_by_key', {
    p_public_route_key: publicRouteKey,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
```

`PublicCourseDetailPage.jsx`는 이 함수의 반환값(`row` 객체 또는 `null`)에만 의존하도록 이미 작성되어 있으므로, 이 교체 외에 페이지 쪽 코드를 바꿀 필요는 없다.
