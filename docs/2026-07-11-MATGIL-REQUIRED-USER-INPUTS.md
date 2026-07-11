# Matgil — 실제 확인이 필요한 사용자 입력 목록 (2026-07-11)

로컬 코드·문서만으로 확정할 수 없는 항목입니다. 아래 SQL은 전부 **읽기 전용**(SELECT만)이며, Supabase Dashboard → SQL Editor에서 실행하면 됩니다. 결과는 각 항목의 "전달 형식"대로 붙여넣어 주시면 됩니다(표 복사 또는 CSV 다운로드 모두 가능).

> 어떤 항목도 DDL/DML 실행을 요구하지 않습니다. API key·비밀번호 등 Secret 값은 보내지 마세요.

---

## A. mg_ 테이블 전체의 RLS 활성화 여부 — **최우선**

- 왜: 장소 테이블(mg_places 계열)과 mg_saved_courses의 RLS 정책 원문이 리포에 없습니다(ISSUE-02). RLS가 꺼져 있으면 anon key로 쓰기가 가능한 최악의 경우가 성립합니다.
- 어디서: SQL Editor
```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'mg\_%'
order by c.relname;
```
- 전달 형식: 결과 표 전체 (테이블명 + rls_enabled true/false)

## B. 전체 RLS 정책 원문 — 문서 vs 실제 대조

- 왜: 커뮤니티/표현 테이블은 docs/22·sql 문서에 정책이 있으나 실배포와 일치하는지 미확인. 장소/저장코스는 정책 원문 자체가 없습니다.
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
- 전달 형식: 결과 표 전체 (행이 많으면 CSV)

## C. 컬럼 단위 권한 — like_count 조작 가능 여부 (ISSUE-03)

- 왜: grant가 테이블 단위면 본인 게시글의 like_count/comment_count/created_at을 직접 UPDATE해 Popular 순위를 조작할 수 있습니다.
```sql
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('mg_community_posts','mg_community_comments')
  and grantee in ('anon','authenticated')
order by table_name, grantee, column_name;

-- 테이블 단위 grant도 함께
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'mg\_%'
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
```
- 전달 형식: 두 결과 표. 첫 쿼리가 0행이면 "컬럼 단위 제한 없음"이라는 의미이므로 그 사실만 알려주셔도 됩니다.

## D. 카운트 무결성 스팟체크 — 조작·트리거 오동작 탐지

- 왜: like_count가 실제 좋아요 행 수와 다르면 트리거 누락 또는 직접 조작 흔적입니다.
```sql
select p.id, p.like_count,
       (select count(*) from public.mg_community_post_likes l where l.post_id = p.id) as actual_likes
from public.mg_community_posts p
where p.like_count <> (select count(*) from public.mg_community_post_likes l where l.post_id = p.id);
```
- 전달 형식: "0행" 또는 불일치 행 목록

## E. 트리거·함수 존재 확인

- 왜: 커뮤니티 카운트 동기화 4종 + updated_at + 표현 북마크 카운트 트리거가 문서에만 있고 실제 적용 여부 미확인. mg_saved_courses의 updated_at 트리거 부재(문서상 의도)도 재확인.
```sql
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

select p.proname, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_updated_at','sync_community_post_like_count',
    'sync_community_post_comment_count','sync_community_comment_like_count',
    'update_phrase_bookmark_count');
```
- 전달 형식: 두 결과 표

## F. Edge Function 배포 상태 + verify_jwt — mg-voice-help 핵심 (ISSUE-01)

- 왜: mg-voice-help는 코드에 자체 인증이 없어, verify_jwt 설정과 호출 로그가 비용 위험 판단의 핵심입니다.
- 어디서: Dashboard → Edge Functions → 각 함수 상세 화면(verify_jwt 토글 상태), 또는 로컬 터미널에서 `supabase functions list`
- 추가 확인: Dashboard → Edge Functions → mg-voice-help → Logs에서 최근 호출량이 비정상적으로 많은지
- 전달 형식: 함수 4개 각각의 (배포 여부, verify_jwt on/off) + mg-voice-help 최근 호출량 대략치

## G. 테이블 컬럼 실구조 — 문서와 대조가 필요한 4개 테이블

- 왜: mg_saved_courses는 DDL 원문 부재(docs/25 요약뿐), mg_places.matgil_category_keys는 정식 DDL에 없는 수동 추가 컬럼, mg_phrases는 ALTER 이력이 문서에만 존재합니다.
```sql
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('mg_saved_courses','mg_places','mg_place_texts','mg_phrases','mg_phrase_categories')
order by table_name, ordinal_position;
```
- 전달 형식: 결과 표 (CSV 권장)

## H. 인덱스·유니크 제약 — upsert onConflict 전제 검증

- 왜: mg-tour-en-enrich의 upsert가 `(place_id, locale)`, `(source, source_language, external_id, external_content_type_id)` 유니크를 전제합니다. 문서상 인덱스들(ai-docs/03)의 실제 생성 여부도 미확인.
```sql
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename like 'mg\_%'
order by tablename, indexname;
```
- 전달 형식: 결과 표

## I. 데이터 건수·번역 상태 분포

- 왜: EN 데이터 커버리지(translation_status 분포)가 i18n 계획(스냅샷 양언어 보존, LLM 번역 잔여량)의 규모 산정에 필요합니다.
```sql
select 'mg_places' as t, count(*) from public.mg_places
union all select 'mg_place_texts_ko', count(*) from public.mg_place_texts where locale='ko'
union all select 'mg_place_texts_en', count(*) from public.mg_place_texts where locale='en'
union all select 'mg_place_sources', count(*) from public.mg_place_sources
union all select 'mg_community_posts', count(*) from public.mg_community_posts
union all select 'mg_community_comments', count(*) from public.mg_community_comments
union all select 'mg_saved_courses', count(*) from public.mg_saved_courses
union all select 'mg_phrases', count(*) from public.mg_phrases
union all select 'mg_phrase_bookmarks', count(*) from public.mg_phrase_bookmarks
union all select 'mg_api_fetch_logs', count(*) from public.mg_api_fetch_logs;

select locale, translation_status, count(*)
from public.mg_place_texts group by locale, translation_status order by locale, translation_status;
```
- 전달 형식: 두 결과 표

## J. Storage 버킷·정책

- 왜: community-post-images가 public 버킷 + 본인 폴더 INSERT 정책(문서상)이 실제와 일치하는지, 다른 버킷이 더 있는지 확인.
```sql
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;

select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';
```
- 전달 형식: 두 결과 표

## K. 원본/로그 테이블의 anon 노출 여부

- 왜: mg_place_sources(raw JSON)·mg_api_fetch_logs는 "프론트 공개 금지" 원칙만 문서에 있고 실제 차단 여부 미확인.
```sql
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename in ('mg_place_sources','mg_api_fetch_logs');

select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('mg_place_sources','mg_api_fetch_logs')
  and grantee in ('anon','authenticated');
```
- 전달 형식: 두 결과 표 (정책 0행 + grant 존재 = 위험 신호)

## L. 잔존 백업 테이블

- 왜: docs/21 정리 작업의 백업 테이블 2개가 아직 남아 있는지 확인(정리 대상 판단).
```sql
select to_regclass('public.backup_mg_place_texts_en_source_20260622') as bak1,
       to_regclass('public.backup_mg_place_texts_en_source_mismatch_20260622') as bak2;
```
- 전달 형식: 결과 1행

## M. 미사용 추정 테이블 존재 여부

- 왜: mg_courses/mg_course_places/mg_profiles가 문서에는 있으나 프론트 미사용 — 실존 여부에 따라 관리자 기반 설계(mg_profiles.role 활용안)가 달라집니다.
```sql
select to_regclass('public.mg_courses') as mg_courses,
       to_regclass('public.mg_course_places') as mg_course_places,
       to_regclass('public.mg_profiles') as mg_profiles;
```
- 전달 형식: 결과 1행

## N. 대시보드/외부 콘솔 확인 (SQL 아님)

| 항목 | 왜 | 어디서 | 전달 형식 |
|---|---|---|---|
| GitHub Pages 딥링크 404 | 404.html 부재가 코드상 확정 — 실제 증상 재현 확인 | 배포 URL에서 `/matgil/community` 접속 후 새로고침 | "404 발생함/안 함" |
| GitHub Actions Secrets 이름 | 워크플로가 참조하는 3개(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_KAKAO_MAP_JS_KEY)가 실제 등록돼 있는지 (값은 불필요) | GitHub → Settings → Secrets and variables → Actions | 등록된 Secret 이름 목록 |
| Kakao JS 키 도메인 제한 | 번들 공개 키의 도용 방지 설정 여부 | Kakao Developers → 앱 → 플랫폼(Web) 등록 도메인 | 등록 도메인 목록 |
| Edge Function Secrets 등록 여부 | TOUR_KOR/ENG_API_SERVICE_KEY, OPENAI_API_KEY, SOLAR_API_KEY, ADMIN_SEED_TOKEN이 등록돼 있는지 (값은 불필요) | Dashboard → Edge Functions → Secrets | 등록된 이름 목록 |
| Auth 이메일 확인 설정 | signUp의 needsConfirmation 분기 실동작 판단 | Dashboard → Authentication → Providers → Email (Confirm email 토글) | on/off |
| 데모/공유 계정 존재 | 코드에는 흔적 없음(mockAuthService의 traveller@matgil.app는 데드 코드) — 실계정 존재 여부는 확인 불가 | Dashboard → Authentication → Users | 공용 계정 유무 |

---

## 우선순위 안내

1. **A, B, C** — 보안 계획(PLAN-auth-edge-security)의 전제. 이것 없이는 어떤 보안 판단도 확정 불가.
2. **F** — mg-voice-help 비용 위험의 실측.
3. **G, H, I** — 카테고리/i18n 계획의 규모 산정.
4. 나머지는 해당 계획 착수 시점에 확인해도 됩니다.
