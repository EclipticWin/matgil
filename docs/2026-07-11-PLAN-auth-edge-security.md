# PLAN: Edge Function·RLS 보안 강화 (우선순위 1위)

관련 이슈: ISSUE-01, 02, 03, 04, 05, 06, 08 (2026-07-11-MATGIL-OPEN-ISSUES.md)

## 1. 작업 제목
mg-voice-help 인증·비용 방어 + 커뮤니티 쓰기 권한 강화 + RLS 실태 검증 반영

## 2. 현재 문제
- `mg-voice-help`는 4개 Edge Function 중 유일하게 자체 인증이 없다(supabase/functions/mg-voice-help/index.ts:110-137). anon key는 번들에 공개되므로 verify_jwt가 켜져 있어도 익명 호출이 통과하고, 호출마다 OpenAI gpt-4o-mini 비용이 발생한다. rate limit·입력 길이 제한도 없다.
- `author_name`을 클라이언트가 임의 지정할 수 있고(communityService.js:83), RLS는 user_id만 검사한다 — 사칭 가능.
- grant가 테이블 단위라(docs/22:850) 본인 게시글의 like_count/comment_count/created_at을 직접 UPDATE해 Popular 순위를 조작할 수 있다(트리거는 posts 직접 UPDATE에 미반응).
- `updatePost`가 user_id 필터 없이 RLS에만 의존한다(communityService.js:93-97).
- 로그아웃 시 `matgil.bookmarks` localStorage가 정리되지 않는다(useBookmarks.jsx).
- 장소 테이블·mg_saved_courses의 RLS 정책 원문이 리포에 없어 실태를 모른다.

## 3. 사용자 영향
- 운영자: LLM 비용 유출, Popular 피드 신뢰 붕괴 가능.
- 사용자: 운영자 사칭 글에 속을 수 있음, 공용 기기에서 북마크 잔존.

## 4. 목표
익명 사용자가 비용을 유발하거나 데이터를 위조할 수 있는 경로를 전부 차단하고, RLS 상태를 코드/문서로 재현 가능하게 만든다.

## 5. 이번 작업 범위
1. mg-voice-help: 로그인 사용자 JWT 검증 + transcript 길이 제한 + 사용자별 간이 rate limit.
2. mg_community_posts/comments: 카운트·author_name·created_at의 클라이언트 조작 차단(컬럼 grant + 트리거).
3. updatePost에 user_id 필터 추가(클라이언트 방어선 일관화).
4. 로그아웃 시 localStorage 정리.
5. `supabase/config.toml` 작성으로 verify_jwt 설정 코드화.
6. RLS 실태 확인 결과(REQUIRED-USER-INPUTS A/B/C) 반영 — 누락 정책 보완 SQL 준비.

## 6. 제외 범위
- 관리자 역할 모델(PLAN-admin-foundation에서), ADMIN_SEED_TOKEN → JWT 전환(동일), 신고/모더레이션, 비밀번호 재설정, Kakao 키 도메인 설정(콘솔 작업 — 사용자 수동).

## 7. 현재 관련 코드 흐름
- 음성 도움: VoiceHelpPlaceholder.jsx:39 `supabase.functions.invoke('mg-voice-help', { body: { transcript, userLanguage } })` → index.ts serve() → buildPrompt(transcript 보간) → OpenAI.
- 게시글 작성: PostComposer → CommunityPage.handleSubmit(77행) → createPost({ authorName: user.name }) → insert.
- 좋아요: handleLike → likePost insert → DB 트리거가 like_count 갱신.
- 로그아웃: MyPage.jsx:117 → useAuth.logout → supabase.auth.signOut() (localStorage 북마크 미정리).

## 8. 수정할 파일
- `supabase/functions/mg-voice-help/index.ts` — JWT 검증(Authorization 헤더의 사용자 토큰을 supabase.auth.getUser로 검증, anon-only 거부), transcript 최대 300자, 요청 body 크기 제한, (선택) user_id 기준 분당 호출 제한.
- `src/features/community/services/communityService.js` — updatePost에 `.eq('user_id', userId)` 추가(시그니처에 userId 파라미터 추가), 호출부 CommunityPage.jsx:86 수정.
- `src/features/auth/hooks/useAuth.jsx` — logout에서 `localStorage.removeItem('matgil.bookmarks')` (또는 useBookmarks에 clear 함수 추가 후 호출).
- `src/features/phrases/components/VoiceHelpPlaceholder.jsx` — 비로그인 시 로그인 유도 UI(호출 자체를 막음).

## 9. 새로 만들 파일
- `supabase/config.toml` — 함수 4개의 verify_jwt 명시.
- `docs/sql-security-hardening-2026-07-11.md` — 아래 11번 SQL 모음(사용자 실행용).

## 10. DB 변경 필요 여부
필요 (grant 재구성 + 트리거 1개). RLS 정책 자체는 확인 결과에 따라 보완.

## 11. DDL/DML 초안

**Claude가 작성할 SQL (사용자가 직접 실행):**
```sql
-- (1) 카운트/작성자/시각 컬럼의 클라이언트 UPDATE 차단 (컬럼 단위 grant로 축소)
revoke update on public.mg_community_posts from authenticated;
grant update (category, content, image_urls, locale, updated_at, is_published, deleted_at, deleted_by, author_name)
  on public.mg_community_posts to authenticated;

revoke update on public.mg_community_comments from authenticated;
grant update (content, updated_at, deleted_at, deleted_by, author_name)
  on public.mg_community_comments to authenticated;

-- (2) author_name 서버측 강제: insert/update 시 auth 메타데이터로 덮어쓰기
create or replace function public.enforce_author_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1))
     from auth.users u where u.id = new.user_id),
    new.author_name);
  return new;
end $$;

create trigger trg_enforce_post_author before insert or update of author_name
  on public.mg_community_posts for each row execute function public.enforce_author_name();
create trigger trg_enforce_comment_author before insert or update of author_name
  on public.mg_community_comments for each row execute function public.enforce_author_name();
```
주의: (2)를 적용하면 useAuth.jsx:64-74의 닉네임 백필 UPDATE도 트리거가 최신 metadata로 덮어쓰므로 동작이 유지된다. insert 시 created_at은 default now()이므로 insert grant에서 컬럼 제한은 선택 사항(필요 시 동일 방식).

**실행 전 확인 SQL:** REQUIRED-USER-INPUTS C(현재 grant), B(현재 정책).

**실행 후 검증 SQL:**
```sql
select column_name from information_schema.column_privileges
where table_name='mg_community_posts' and grantee='authenticated' and privilege_type='UPDATE';
-- like_count/comment_count/created_at/user_id가 없어야 함
select tgname from pg_trigger where tgrelid='public.mg_community_posts'::regclass and not tgisinternal;
```

**rollback SQL:**
```sql
drop trigger if exists trg_enforce_post_author on public.mg_community_posts;
drop trigger if exists trg_enforce_comment_author on public.mg_community_comments;
drop function if exists public.enforce_author_name();
grant update on public.mg_community_posts to authenticated;
grant update on public.mg_community_comments to authenticated;
```

## 12. RLS/트리거/인덱스 영향
- 기존 UPDATE 정책(user_id = auth.uid())은 유지 — 컬럼 grant는 정책과 AND로 결합.
- 신규 트리거 2개는 기존 카운트 동기화 트리거와 충돌 없음(다른 컬럼).
- 인덱스 영향 없음.

## 13. 기존 데이터 마이그레이션
- 기존 author_name 오염 여부 점검(선택): `select id, author_name from mg_community_posts p where author_name <> (select coalesce(raw_user_meta_data->>'display_name', split_part(email,'@',1)) from auth.users where id = p.user_id);` — 불일치 행은 수동 판단.

## 14. 하위 호환 전략
- 프론트 createPost/updatePost의 authorName 전달은 그대로 두어도 트리거가 덮어씀 — 프론트 배포와 SQL 실행 순서 무관.
- updatePost 시그니처 변경은 호출부가 CommunityPage 1곳뿐.

## 15. 단계별 구현 순서
1. REQUIRED-USER-INPUTS A/B/C/F 결과 수령 → 실태 확정.
2. mg-voice-help 코드 수정(JWT 검증 + 입력 제한) → `supabase functions deploy mg-voice-help` (사용자 실행).
3. config.toml 작성·커밋.
4. SQL (1)(2) 사용자 실행 → 검증 SQL 확인.
5. 프론트 수정(updatePost userId, 로그아웃 정리, VoiceHelp 로그인 게이트) → 배포.

## 16. 사용자 수동 작업
- SQL 실행(11번), Edge Function 배포, verify_jwt 대시보드 확인, Kakao 콘솔 도메인 제한 확인.

## 17. 롤백 방법
- SQL: 11번 rollback. 함수: 이전 버전 재배포(git 이력). 프론트: revert 커밋.

## 18. 엣지 케이스
- display_name이 없는 사용자(가입 직후 metadata 누락) → 트리거의 email 앞부분 폴백.
- mg-voice-help에 만료 토큰으로 호출 → 401 + 프론트에서 로그인 유도.
- 익명 사용자가 Voice help 탭 진입 → 호출 전 로그인 배너(Phrases 북마크의 기존 패턴 재사용, PhrasesPage.jsx:113-151).

## 19. 회귀 위험
- 컬럼 grant 축소로 정상 UPDATE(글 수정)가 막히면 안 됨 — 허용 컬럼 목록에 프론트가 보내는 모든 컬럼(category, content, image_urls, updated_at) 포함 확인 필수.
- 닉네임 백필(useAuth)이 author_name grant에 의존 — 허용 목록에 author_name 유지.

## 20. 테스트 시나리오
1. 비로그인 브라우저 콘솔에서 anon key로 mg-voice-help fetch → 401.
2. 로그인 후 Voice help 정상 동작.
3. 로그인 사용자가 콘솔에서 `update mg_community_posts set like_count=999` 시도 → permission denied.
4. 글 작성 시 author_name이 metadata display_name과 일치(임의 값 전달해도 덮어써짐).
5. 글 수정/삭제/좋아요/댓글 정상 동작(회귀).
6. 로그아웃 → localStorage에 matgil.bookmarks 없음.

## 21. 완료 기준
- 익명 mg-voice-help 호출 401. 카운트 직접 UPDATE 거부. author_name 위조 불가. config.toml 커밋됨. 기존 커뮤니티 기능 전부 정상.

## 22. 작업 후 확인 명령
```bash
npm run build
# 배포 후: 시크릿 없는 curl로 mg-voice-help 호출 → 401 확인
curl -s -X POST "https://lpdijndoqijhhkwicwoy.supabase.co/functions/v1/mg-voice-help" -H "Content-Type: application/json" -d '{"transcript":"test"}'
```
+ 20번 시나리오 수동 확인, 검증 SQL(11번) 실행.
