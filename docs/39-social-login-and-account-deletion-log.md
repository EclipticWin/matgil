# social login and account deletion log

- 작성 일시: 2026-07-14 00:35 KST
- 범위: `docs/38-nickname-generation-and-community-locale-unification-log.md` 작성 시점 이후부터 이 문서 작성 시점까지 진행한 모든 작업
- 성격: 작업 기록(work log). 새로운 설계·분석이 아니라 실제로 완료한 작업만 정리한 문서

---

## 1. Google/Facebook 소셜 로그인 연동 (사용자 직접 작업)

이 부분은 AI 에이전트 없이 사용자가 직접 구현. 이후 AI 에이전트가 회원 탈퇴 기능을 구현하기 전, 기존 로그인 기능을 깨뜨리지 않기 위해 변경분을 먼저 확인.

### 1.1 수정 파일

- `src/features/auth/components/LoginForm.jsx`
- `src/shared/i18n/dictionary.js`

### 1.2 변경 내용

- 기존에는 Google/Facebook 버튼을 누르면 `alert(t('login.socialComingSoon'))`만 뜨는 placeholder였음
- `handleSocialLogin(provider)`를 새로 추가해 `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`를 호출하도록 교체
  - `redirectTo`는 `${window.location.origin}${import.meta.env.BASE_URL}`로 구성 — GitHub Pages 등 서브패스 배포(basename) 환경에서도 올바른 경로로 돌아오도록 처리
  - Google/Facebook 버튼 모두 같은 함수를 provider 인자만 다르게 호출
  - 처리 중(`busy`) 상태에서 버튼 중복 클릭 방지
- OAuth 에러 메시지를 케이스별로 분기해 안내 문구를 다르게 표시 (`cancel`/`access_denied` → 취소, `provider`/`client`/`configuration` 포함 → 설정 오류, 그 외 → provider별 로그인 실패)
- `dictionary.js`의 `login` 네임스페이스에 `googleLoginFailed`, `facebookLoginFailed`, `socialLoginCancelled`, `oauthConfigurationError` EN/KO 문구 추가
- `useAuth.jsx`는 이 변경에서 건드리지 않음 — OAuth 리다이렉트 후 세션 확립은 Supabase 클라이언트의 기본 `detectSessionInUrl` 동작과 기존 `onAuthStateChange` 리스너에 그대로 위임되는 구조

### 1.3 AI 에이전트 확인 결과

- 기존 닉네임 확보 로직과 충돌하지 않음을 확인. Google/Facebook에서 유효한 display_name이 제공되면 이를 우선 사용하고, 사용할 수 없거나 중복된 경우 기존 정책에 따라 matgiler + 6자리 숫자 닉네임을 생성.
- 기존 이메일 로그인/회원가입, 로그아웃, EN/KO 오류 문구 등 기존 인증 흐름에 회귀가 없음을 확인

---

## 2. 회원 탈퇴 기능 구현 (AI 에이전트 작업)

이메일 가입자뿐 아니라 Google/Facebook 로그인 사용자도 동일하게 탈퇴할 수 있도록 구현.

### 2.1 신규 파일

| 파일 | 역할 |
|---|---|
| `supabase/functions/delete-my-account/index.ts` | 계정 삭제 Edge Function (service role 권한, JWT 검증) |
| `src/features/profile/components/DeleteAccountView.jsx` | Edit profile 바텀시트 내부 탈퇴 안내·확인 화면 |

### 2.2 수정 파일

- `src/features/auth/hooks/useAuth.jsx` — `deleteAccount()`(서버 호출만), `clearLocalSession()`(signOut + 로컬 user 상태 정리) 추가
- `src/features/profile/components/EditProfileSheet.jsx` — 내부 `view` state(`'edit'|'delete'`)로 같은 바텀시트에서 탈퇴 화면 전환, "더 알아보기 >" 링크 추가
- `src/features/places/components/ReviewCard.jsx` — 저장된 리터럴 `"Deleted user"`를 로케일에 맞게 "탈퇴한 사용자"/"Deleted user"로 표시
- `src/shared/i18n/dictionary.js` — 탈퇴 관련 EN/KO 문구 다수 추가

### 2.3 DB 구조 확인 결과 (기존 문서·SQL 기준, 스키마 변경 없음)

- `mg_place_reviews.user_id` — `on delete set null` 확인, `author_name`은 `mg_place_reviews_before_write` 트리거가 `user_id`가 not null일 때 항상 `auth.users.display_name`에서 재계산함을 확인
- `mg_place_bookmarks`, `mg_phrase_bookmarks`, `mg_user_profiles`, `mg_community_posts`, `mg_community_comments`, 커뮤니티 게시글/댓글 좋아요 테이블 — 모두 `user_id`에 `on delete cascade` 확인
- `mg_saved_courses` — 문서상 FK 정책이 확인되지 않아 방어적으로 Edge Function에서 명시적 DELETE 처리
- `community-post-images` 버킷 — 일반 사용자용 delete 정책이 없어 삭제 불가하지만, Edge Function은 service role로 동작하므로 RLS와 무관하게 삭제 가능함을 확인
- `place-review-images`(리뷰 사진) — 리뷰 유지 정책과 일관되게 그대로 보존, 전혀 건드리지 않음

### 2.4 구현 중 발견한 문제와 수정

- `mg_place_reviews_before_write` 트리거가 `new.user_id is not null`일 때 `author_name`을 항상 재계산하므로, "author_name만 먼저 익명화하고 나중에 계정을 삭제"하는 순서로는 트리거가 익명화를 즉시 되돌려버림을 발견
- 해결: `user_id`와 `author_name`을 **하나의 UPDATE 문**에서 동시에 변경해 트리거의 재계산 조건 자체를 피하도록 구현
- `deleteAccount()`가 로컬 `user` 상태를 즉시 null로 만들면 MyPage의 기존 `!user → /login 리다이렉트` 가드가 먼저 발동해 홈이 아닌 로그인 화면이 잠깐 노출되는 문제를 발견
- 해결: 서버 호출(`deleteAccount`)과 로컬 세션 정리(`clearLocalSession`)를 분리하고, **홈으로 이동한 뒤** 로컬 세션을 정리하도록 순서를 고정

### 2.5 Edge Function 처리 순서

1. `Authorization: Bearer <JWT>` 필수, 없으면 401
2. service role 클라이언트의 `admin.auth.getUser(jwt)`로 JWT 검증 후 `userId` 확보 (요청 body의 user_id는 신뢰하지 않음)
3. `mg_place_reviews`에서 해당 사용자 리뷰의 `user_id`를 null, `author_name`을 `"Deleted user"`로 동시에 UPDATE
4. `mg_community_posts`의 이미지 경로를 조회해 `community-post-images` 버킷에서 best-effort 삭제
5. `mg_saved_courses`를 명시적으로 DELETE
6. `admin.auth.admin.deleteUser(userId)` 호출 (나머지 cascade 테이블 정리)
7. 실패 시 내부 로그만 구체적으로 남기고 클라이언트에는 일반화된 오류만 반환

### 2.6 MyPage/Edit profile UI

- Confirm password 입력 아래 작은 텍스트 링크("더 알아보기 >")로 탈퇴 화면 진입, 라우트 이동 없이 같은 바텀시트 내부에서 전환
- 안내 화면: 뒤로가기, 제목, 삭제되는 데이터 설명, 남는 리뷰 설명, 소셜 로그인 안내, 경고문, `DELETE` 텍스트 확인 입력, 하단 버튼
- `DELETE`를 정확히(대소문자 구분, 앞뒤 공백만 제거) 입력해야 탈퇴 버튼 활성화, 클릭 시 최종 확인 모달을 한 번 더 표시
- 처리 중에는 입력·버튼·뒤로가기·바깥 클릭이 모두 비활성화

### 2.7 Supabase 배포 현황

- SQL 실행 불필요 (스키마 변경 없이 기존 FK 구조만 활용)
- `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 모든 Edge Function에 기본 주입하므로 별도 secret 등록 불필요
- `delete-my-account` Edge Function을 프로젝트 lpdijndoqijhhkwicwoy에 배포 완료했다. JWT 검증 기본값을 유지했으며 `--no-verify-jwt`는 사용하지 않음

### 2.8 빌드·검증

- `npm run build` 성공, 기존부터 있던 CSS 파서 경고 1건 외 신규 오류 없음
- `git diff --check` 통과 (CRLF 개행 경고만 존재)
- Supabase SQL은 실행하지 않았으며, delete-my-account Edge Function은 사용자가 Supabase CLI를 통해 배포 완료
