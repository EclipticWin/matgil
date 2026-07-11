# PLAN: 관리자 기능 기반 구축 (우선순위 3위)

관련 이슈: ISSUE-24, 07, 23(선행 제공) (2026-07-11-MATGIL-OPEN-ISSUES.md)

## 1. 작업 제목
역할 모델 + is_admin() RLS 함수 + 관리자 라우트 가드 — 관리자 기능 전체의 최소 기반

## 2. 현재 문제
- 코드에 role/admin 흔적이 전무하다(grep 히트는 ARIA 속성뿐). 관리자 판별 소스가 0개.
- user_metadata는 클라이언트가 `supabase.auth.updateUser`로 직접 쓸 수 있음이 코드로 증명됨(LocaleProvider.jsx:54) — 관리자 플래그를 넣으면 누구나 스스로 관리자가 된다.
- 관리 대상 데이터(음식 카테고리, 장소 분류/번역, Phrases 카탈로그, 커뮤니티 모더레이션, 수집·번역 실행)가 전부 코드 수정, 수동 SQL, ADMIN_SEED_TOKEN curl에 의존한다.
- docs/sql-phrases…md:531 — Phrases 쓰기 정책은 "관리자 확장 전까지 차단 유지"로 이 작업을 명시적으로 기다리고 있다.

## 3. 사용자 영향
직접 영향은 없으나, 카테고리 관리(4위 계획)·모더레이션·표현 카탈로그 관리가 모두 이 기반 없이는 불가능하다.

## 4. 목표
"관리자"라는 개념을 서버가 소유한 단일 소스로 정의하고, RLS와 프론트 라우팅이 같은 소스를 참조하게 한다. 관리자 화면 자체는 만들지 않는다(빈 셸 1장까지만).

## 5. 이번 작업 범위
1. 역할 저장소: `app_metadata.role = 'admin'` (Supabase가 서버에서만 쓰기 허용) — 대시보드/service role로만 부여.
2. `public.is_admin()` security definer 함수 — RLS 정책에서 재사용.
3. 관리자 RLS 1차 적용: mg_phrases/mg_phrase_categories 쓰기 정책(현재 deny) + mg_community_posts/comments의 관리자 UPDATE(숨김 처리용).
4. 프론트: `useAuth`에 isAdmin 노출(JWT의 app_metadata.role 읽기), `<AdminRoute>` 가드 컴포넌트, `/admin` 빈 셸 페이지(가드 검증용).
5. Edge Function 인증 이중화: 기존 x-admin-seed-token 유지 + 관리자 JWT도 허용(점진 전환 준비).

## 6. 제외 범위
- 실제 관리자 화면(카테고리 편집, 모더레이션 UI, 수집 실행 버튼 등) — 각 후속 계획에서.
- mg_profiles 테이블 신설/활용(존재 여부부터 REQUIRED-USER-INPUTS M으로 확인 — app_metadata 방식이면 불필요).
- ADMIN_SEED_TOKEN 완전 폐기(이중화까지만).

## 7. 현재 관련 코드 흐름
- 인증 상태: useAuth.jsx가 session.user를 normalize(11행 — display_name만 추출). app_metadata는 읽지 않음.
- 라우트 보호: 개념 자체가 없음 — 각 페이지가 `if (!user) navigate(ROUTES.login)` 조건부 렌더(CoursesPage.jsx:49 등).
- Edge Function 관리자 인증: x-admin-seed-token 단순 비교 3곳.

## 8. 수정할 파일
- `src/features/auth/hooks/useAuth.jsx` — normalizeUser에 `isAdmin: session.user.app_metadata?.role === 'admin'` 추가.
- `src/app/router.jsx` — `/admin` 라우트(AdminRoute 하위).
- `src/shared/constants/routes.js` — ROUTES.admin.
- `supabase/functions/mg-tour-seed/index.ts`, `mg-tour-en-enrich/index.ts`, `mg-place-translate-en/index.ts` — 토큰 검증 함수를 "seed 토큰 OR 유효 JWT의 app_metadata.role==='admin'"으로 확장.

## 9. 새로 만들 파일
- `src/features/auth/components/AdminRoute.jsx` — isAdmin 아니면 `/`로 리다이렉트.
- `src/pages/AdminPage.jsx` — 빈 셸(제목 + "준비 중").
- `docs/sql-admin-foundation-2026-07-11.md` — 아래 SQL 모음.

## 10. DB 변경 필요 여부
필요 (함수 1개 + 정책 추가. 테이블 신설 없음 — app_metadata 방식 채택 시).

## 11. DDL/DML 초안

**Claude가 작성할 SQL (사용자 실행):**
```sql
-- (1) 관리자 판별 함수 (JWT claim 기반 — 테이블 조회 없음, 빠름)
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- (2) Phrases 카탈로그 관리자 쓰기 (현재 deny — sql-phrases 문서 531행의 예정 작업)
create policy "phrases admin write" on public.mg_phrases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "phrase categories admin write" on public.mg_phrase_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- (3) 커뮤니티 모더레이션: 관리자 숨김 처리 허용
create policy "posts admin moderate" on public.mg_community_posts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "comments admin moderate" on public.mg_community_comments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
```

**관리자 부여 (사용자가 직접, Dashboard 또는 SQL):**
Dashboard → Authentication → Users → 대상 사용자 → raw app meta data에 `{"role": "admin"}` 추가. (SQL로는 `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb where email = '<관리자 이메일>';` — auth 스키마 직접 수정이므로 대시보드 방식 권장.)

**실행 전 확인 SQL:** `select * from pg_policies where tablename in ('mg_phrases','mg_phrase_categories','mg_community_posts');`

**실행 후 검증 SQL:**
```sql
select public.is_admin();  -- SQL Editor(service role)에서는 false여도 정상 — 실검증은 프론트에서
select tablename, policyname, cmd from pg_policies where policyname ilike '%admin%';
```

**rollback SQL:**
```sql
drop policy if exists "phrases admin write" on public.mg_phrases;
drop policy if exists "phrase categories admin write" on public.mg_phrase_categories;
drop policy if exists "posts admin moderate" on public.mg_community_posts;
drop policy if exists "comments admin moderate" on public.mg_community_comments;
drop function if exists public.is_admin();
```

## 12. RLS/트리거/인덱스 영향
- 기존 "본인만" 정책과 관리자 정책은 OR로 결합(PostgreSQL permissive policy) — 기존 사용자 동작 불변.
- ISSUE-03의 컬럼 grant 축소(1위 계획)와 병행 시, 관리자도 grant 제약을 받으므로 모더레이션에 필요한 컬럼(is_published, deleted_at, deleted_by)이 grant 허용 목록에 있는지 확인 — 1위 계획의 허용 목록에 이미 포함됨.
- 인덱스 영향 없음.

## 13. 기존 데이터 마이그레이션
없음. 관리자 계정 지정만 필요.

## 14. 하위 호환 전략
- app_metadata에 role이 없는 기존 사용자 → is_admin() false — 아무 변화 없음.
- Edge Function은 기존 토큰 방식 병행 — 기존 curl 스크립트 계속 동작.
- 주의: app_metadata 변경 후 기존 세션의 JWT에는 반영이 안 됨 — 관리자는 재로그인 필요(문서화).

## 15. 단계별 구현 순서
1. REQUIRED-USER-INPUTS M(mg_profiles 존재) 확인 — 존재하고 활용 계획이 있으면 테이블 방식 재검토, 아니면 app_metadata 확정.
2. SQL (1)~(3) 실행.
3. 관리자 계정 1개 지정 + 재로그인.
4. 프론트 isAdmin/AdminRoute/AdminPage 구현 → 배포.
5. Edge Function 인증 이중화 → 재배포.

## 16. 사용자 수동 작업
- SQL 실행, 관리자 지정(대시보드), Edge Function 3개 재배포, 관리자 계정 재로그인.

## 17. 롤백 방법
- SQL rollback 실행, app_metadata에서 role 제거, 프론트 revert.

## 18. 엣지 케이스
- 관리자가 자기 role을 스스로 제거 시도 → app_metadata는 클라이언트 쓰기 불가라 불가능(정상).
- 일반 사용자가 /admin 직접 입력 → 리다이렉트.
- JWT 갱신 전 관리자(재로그인 안 함) → isAdmin false — 안내 필요.
- 관리자 모더레이션 UPDATE가 enforce_author_name 트리거(1위 계획)와 충돌하지 않는지 — 트리거는 author_name 컬럼 변경 시만 발화하도록 `update of author_name`으로 한정되어 있어 안전.

## 19. 회귀 위험
- permissive policy 추가는 기존 동작을 넓히기만 함 — 일반 사용자 회귀 없음.
- useAuth normalize 변경이 user 객체 소비처(MyPage 등)에 영향 없는지 — 필드 추가만이므로 안전.

## 20. 테스트 시나리오
1. 일반 계정: /admin 진입 → `/` 리다이렉트, mg_phrases insert 시도(콘솔) → 거부.
2. 관리자 계정(재로그인 후): /admin 렌더, mg_phrases insert 성공, 타인 글 is_published=false 성공.
3. 관리자 JWT로 mg-tour-seed 호출(dryRun성 파라미터) → 통과. 기존 토큰 방식도 통과.
4. 기존 기능 전체 스모크(커뮤니티 CRUD, 표현 북마크).

## 21. 완료 기준
- is_admin() 기반 정책 4개 활성. 관리자만 /admin 접근. 일반 사용자 동작 불변. Edge Function 이중 인증 동작.

## 22. 작업 후 확인 명령
```bash
npm run build
```
+ 20번 시나리오, 11번 검증 SQL, `supabase functions deploy` 로그 확인.
