# nickname generation and community locale unification log

- 작성 일시: 2026-07-13 00:20 KST
- 범위: 닉네임 자동 생성·중복 방지 기능 구현부터 자동 닉네임 화면 미반영 버그 수정, Community 언어 통합 버그 수정까지
- 성격: 작업 기록(work log). 새로운 설계·분석이 아니라 실제로 완료한 작업만 정리한 문서

---

## 1. 닉네임 프로필 DB 구조

- `public.mg_user_profiles` 신규 생성 — `user_id`(PK, `auth.users` FK), `nickname`, `nickname_normalized`, `created_at`, `updated_at`
- `nickname`(표시용 원문)과 `nickname_normalized`(`lower(btrim(nickname))`, 중복 검사 전용)를 분리
- `nickname_normalized`에 unique 제약을 걸어 대소문자·앞뒤 공백 차이만 있는 닉네임도 동일 취급, 동시 요청 race condition을 DB 레벨에서 최종 방어
- RLS 활성화, 사용자는 자신의 프로필 행만 SELECT 가능(공개 프로필 없음)
- 쓰기(INSERT/UPDATE)는 `authenticated`에 grant하지 않고 SECURITY DEFINER RPC 전용으로 제한
- `authenticated`에는 테이블 SELECT만 부여, 나머지는 전부 revoke

## 2. 닉네임 RPC

- `public.set_my_nickname(p_preferred_nickname text default null)` — nickname/generated 반환
  - 인자가 없으면(닉네임 미입력) `matgiler` + 6자리 숫자(앞자리 0 허용) 자동 생성
  - 자동 생성 값이 이미 사용 중이면 unique 제약 위반을 감지해 재생성(최대 시도 횟수 제한)
  - 사용자가 입력한 닉네임이 중복이면 자동으로 다른 값으로 대체하지 않고 오류(`23505`)로 안내
  - 이미 프로필이 있는 상태에서 인자 없이 호출되면 기존 닉네임을 그대로 반환(재로그인 시 재생성 없음)
  - `auth.users.raw_user_meta_data.display_name`을 확정된 닉네임으로 동기화
  - 기존 `sync_my_author_name()`을 내부에서 호출해 `mg_community_posts`/`mg_community_comments`/`mg_place_reviews`의 작성자명 스냅샷을 동기화
- `public.is_nickname_available(p_nickname text)` — 정규화 기준 사전 중복 확인용, boolean만 반환(프로필 데이터 비노출)

## 3. 프론트 회원가입·프로필 연동

- 회원가입 닉네임 입력을 선택 사항으로 유지, 비워두면 자동 생성됨을 안내하는 문구 추가
- 회원가입/프로필 수정 화면에 `is_nickname_available` 기반 실시간(디바운스) 중복 확인 추가
- MyPage 닉네임 변경을 `set_my_nickname` RPC 한 번으로 처리하도록 변경(기존의 `auth.updateUser` + 커뮤니티 테이블 직접 UPDATE 제거)
- `normalizeUser`에서 이메일/이메일 앞부분 fallback 완전히 제거
- Edit profile 폼의 초기값에 확정된 닉네임이 표시되도록 연결
- 닉네임 중복·안내 관련 EN/KO 문구를 dictionary에 추가

## 4. 자동 닉네임 화면 반영 오류 수정

- 원인: 닉네임 미입력 회원가입 시 가입 처리 코드와 `onAuthStateChange` 리스너가 거의 동시에 각자 `set_my_nickname(null)`을 호출했고, 아직 프로필 행이 없는 상태에서 두 호출이 각각 INSERT를 시도하면서 늦게 도착한 쪽이 `user_id` 기본키 충돌로 실패
  - RPC의 재시도 로직이 이 충돌을 "무작위 닉네임이 우연히 겹친 경우"로 오인해 계속 재시도하다 결국 예외로 끝났고, 프론트가 이를 조용히 삼켜 빈 사용자 상태(`name: null`)로 귀결된 뒤 먼저 성공한 정상 결과를 덮어씀
- 수정: 사용자 ID별 in-flight Promise(`ensureNicknameOnce`)로 동일 계정에 대한 RPC 중복 호출 자체를 제거, `userRef`로 이미 확정된 사용자 상태를 추적해 `onAuthStateChange` 이벤트가 오래된 캐시로 덮어쓰지 못하게 처리
- 화면에 쓰는 닉네임은 항상 RPC 반환값을 최종 기준으로 적용
- 닉네임 확보 성공 후 `supabase.auth.refreshSession()`을 best-effort로 실행해, 이후 새로고침 시 세션 캐시에도 최신 메타데이터가 반영되게 함(단, 최종 표시값은 세션이 아니라 RPC 반환값 기준)

## 5. Community 언어 통합

- `communityService.js`의 `fetchPosts`에서 `.eq('locale', locale)` 필터와 `locale` 파라미터를 제거
- `CommunityPage.jsx`의 `loadPosts`가 더 이상 `locale`에 의존하지 않도록 수정(의존성 배열에서 제거), 0건일 때 무필터로 재조회하던 우회 코드 제거
- 게시물 작성 시 `createPost`에 `locale`을 저장하는 부분은 그대로 유지
- 앱 EN/KO 전환은 UI 문구만 바꾸고, 게시물 목록 자체는 재조회되지 않음
- EN/KO로 작성된 게시물이 하나의 최신순 피드에 함께 표시됨

## 6. SQL 실행·검증 결과

- 관련 SQL 문서: `docs/sql-user-nickname-2026-07-12.md` (SQL 전문은 이 문서에 다시 옮기지 않음)
- 사용자가 Supabase SQL Editor에서 직접 실행하여 다음을 확인 완료
  - `mg_user_profiles` 생성 성공, RLS 활성화
  - 정책 `user profiles select own` 1개 존재
  - `authenticated`의 테이블 권한은 SELECT만 존재(INSERT/UPDATE/DELETE 없음)
  - RPC 권한: anon은 `set_my_nickname` 실행 불가, authenticated는 실행 가능 / `is_nickname_available`은 anon·authenticated 모두 실행 가능
  - 기존 계정(닉네임 없던 사용자)의 닉네임 자동 보완 확인
  - 닉네임 변경 후 Community 글·댓글, 리뷰 작성자명 동기화 확인

## 7. 주요 수정 파일

`git status`/`git diff` 기준(이 작업일지 작성 시점):

- `src/features/auth/hooks/useAuth.jsx`
- `src/features/auth/hooks/useNicknameAvailability.js` (신규)
- `src/pages/SignUpPage.jsx`
- `src/features/profile/components/EditProfileSheet.jsx`
- `src/pages/MyPage.jsx`
- `src/features/community/services/communityService.js`
- `src/pages/CommunityPage.jsx`
- `src/shared/i18n/dictionary.js`
- `docs/sql-user-nickname-2026-07-12.md` (신규, 사용자 실행용 SQL 문서)

## 8. 테스트·빌드

- 닉네임 미입력 회원가입 → `matgiler` + 6자리 숫자 자동 생성 확인
- 닉네임 입력 회원가입 → 입력값 그대로 유지 확인
- 대소문자·앞뒤 공백만 다른 닉네임 중복 차단 확인
- 재로그인 후 동일 닉네임 유지 확인(재생성되지 않음)
- 닉네임 변경 후 기존 Community 글·댓글, 리뷰 작성자명 동기화 확인
- EN/KO 전환 전후 Community 게시물 수·목록 동일 확인
- `npm run build` 성공, 기존부터 있던 CSS 파서 경고 1건 외 신규 오류 없음
