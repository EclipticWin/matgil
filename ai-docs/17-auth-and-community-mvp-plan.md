# 17. 로그인/회원가입 및 Community MVP 구현 계획

## 문서 목적

Matgil의 이메일 기반 로그인/회원가입과 Community 탭의 최소 동작 흐름을 구현하기 위한 작업 지침을 정리한다.

이번 작업의 목표는 복잡한 커뮤니티 플랫폼을 만드는 것이 아니라, 다음 흐름이 실제로 동작하도록 만드는 것이다.

```txt
회원가입
로그인
로그인 상태 확인
로그인한 사용자만 게시글 작성
Community 게시글 목록 표시
```

Courses 탭은 아직 실제 기능이 구현되지 않았으므로, 이번 작업 범위에 포함하지 않는다.

---

## 현재 상태

현재 프로젝트 상태는 아래와 같다.

```txt
Map 탭: Kakao Map, 장소 검색, 추천 코스 카드, 상세 sheet 등 일부 구현됨
Phrases 탭: Common phrases, TTS, Voice help 구현됨
Courses 탭: 아직 실제 기능 미구현 또는 mock/껍데기 상태
Community 탭: 화면/mock 중심, 실제 작성/저장 기능 미구현
Login/Auth: 화면은 있으나 실제 이메일 로그인/회원가입 기능 미구현
```

이번 작업은 Auth와 Community MVP에만 집중한다.

---

## 구현 목표

### Auth

구현할 기능:

```txt
이메일/비밀번호 회원가입
이메일/비밀번호 로그인
로그아웃
로그인 상태 유지
로그인 상태에 따른 Community 글 작성 가능 여부 제어
```

구현하지 않을 기능:

```txt
Google OAuth 실제 연동
Facebook OAuth 실제 연동
소셜 로그인 콜백 처리
프로필 상세 페이지
비밀번호 재설정
이메일 인증 플로우 고도화
```

Google/Facebook 버튼은 현재 UI에 남기되, 클릭하면 `Coming soon` 또는 `준비중입니다` 안내만 표시한다.

---

## Community MVP 목표

구현할 기능:

```txt
Community 게시글 목록 조회
Community 게시글 작성
카테고리 선택
작성자 이름 표시
작성 시간 표시
로그인하지 않은 사용자는 글 작성 제한
카테고리 가로 스크롤
```

구현하지 않을 기능:

```txt
댓글 작성
좋아요 실제 저장
장소 첨부
코스 첨부
지도 장소 검색 첨부
이미지 업로드 복잡 구현
신고/차단
알림
Courses 탭 연동
```

Community 게시글은 이번 단계에서 장소나 코스와 연결하지 않는다.

---

## Courses 탭 관련 주의

Courses 탭은 아직 실제 기능이 구현되지 않았다.

따라서 이번 작업에서 아래 작업은 하지 않는다.

```txt
Courses 탭 구현
코스 저장
코스 북마크
코스 상세 페이지 확장
코스와 Community 게시글 연결
Community 게시글에 course_id 연결
Community 게시글에 place_id 연결
```

Community 카테고리에 `Routes` 같은 라벨이 있더라도, 이는 단순 게시글 카테고리일 뿐 실제 Courses 기능과 연결하지 않는다.

---

## Auth 구현 계획

Supabase Auth를 사용한다.

### 로그인 화면

현재 Login 화면에 있는 요소:

```txt
Email
Password
Log in
Sign up with email
Google
Facebook
```

구현 방향:

```txt
Log in 클릭 → supabase.auth.signInWithPassword()
Sign up with email 클릭 → 회원가입 페이지로 이동
Google 클릭 → Coming soon 안내
Facebook 클릭 → Coming soon 안내
```

로그인 성공 시:

```txt
세션 저장
이전 페이지 또는 Map/Community 등 적절한 화면으로 이동
Community 글 작성 가능 상태로 변경
```

로그인 실패 시:

```txt
간단한 에러 메시지 표시
비밀번호/이메일 입력값은 유지
```

---

## 회원가입 페이지 계획

새 회원가입 페이지를 만든다.

예상 경로:

```txt
/signup
```

예상 필드:

```txt
Email
Password
Password confirm
Nickname 또는 display name
Sign up
Back to login
```

회원가입 처리:

```js
supabase.auth.signUp({
  email,
  password,
});
```

비밀번호 확인:

```txt
password와 password confirm이 다르면 요청하지 않고 에러 표시
```

닉네임 처리:

```txt
프로필 테이블이 이미 있으면 저장 연동 검토
프로필 테이블이 없으면 이번 MVP에서는 auth metadata 또는 게시글 작성 시 author_name으로 처리
```

이번 단계에서 복잡한 프로필 테이블 구현은 필수 아님.

---

## 로그인 상태 관리

앱에서 Supabase 세션을 확인해야 한다.

구현 방향:

```txt
앱 시작 시 supabase.auth.getSession()
supabase.auth.onAuthStateChange() 구독
로그인 상태를 Community / Login / You 페이지에서 사용할 수 있게 관리
```

구현 위치는 현재 프로젝트 구조를 확인한 뒤 정한다.

가능한 후보:

```txt
src/features/auth/
src/app/
src/lib/supabase*
```

Auth 상태가 이미 있는 경우 기존 구조를 재사용하고, 없으면 최소 구조만 추가한다.

---

## 로그아웃

로그아웃은 가능하면 You/My 페이지 쪽에 연결한다.

구현 방향:

```txt
supabase.auth.signOut()
성공 시 로그인 상태 초기화
필요하면 Login 또는 Map으로 이동
```

You 페이지 구조가 아직 mock 중심이라면, 버튼 하나만 추가하는 최소 방식으로 처리한다.

---

## Community DB 테이블 필요 여부

현재 제공된 DDL에는 Community 전용 테이블이 명확히 없다.

장소 이미지용 `mg_place_images`는 Community 게시글 이미지용으로 사용하지 않는다.

실제 Supabase에 community 관련 테이블이 이미 있는지 먼저 확인해야 한다.

확인할 후보 이름:

```txt
mg_community_posts
mg_posts
community_posts
```

없으면 최소 테이블을 새로 만들어야 한다.

---

## Community 최소 테이블 제안

Community 전용 테이블이 없다면 아래 구조를 제안한다.

실제 SQL 적용은 별도 승인 후 진행한다.

```sql
create table public.mg_community_posts (
  id bigserial primary key,

  user_id uuid not null references auth.users(id) on delete cascade,

  category varchar(50) not null default 'general',
  title text,
  content text not null,

  author_name text,
  country text,

  image_url text,

  like_count int not null default 0,
  comment_count int not null default 0,

  is_published boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### RLS 정책 제안

```txt
select: 모두 가능
insert: 로그인 사용자만 가능
update: 본인 글만 가능
delete: 본인 글만 가능
```

insert 정책:

```txt
user_id = auth.uid()
```

이번 MVP에서는 RLS를 반드시 단순하게 유지한다.

---

## 사진 첨부 처리 방침

사진 첨부는 다음 기준으로 판단한다.

```txt
Community 전용 image_url 컬럼 또는 이미지 테이블이 이미 있으면:
  게시글 작성 시 이미지 URL 1개 정도는 저장 가능

없으면:
  사진 첨부 제외
  텍스트 게시글만 구현
```

현재 제공된 DDL의 `mg_place_images`는 장소 이미지용이므로 Community 게시글 이미지용으로 사용하지 않는다.

이번 MVP에서는 텍스트 게시글만으로 진행해도 된다.

---

## Community 카테고리

예상 카테고리:

```txt
All
Popular
Questions
Reviews
Tips
Food
Routes
```

주의:

```txt
Routes는 단순 게시글 카테고리 라벨이다.
Courses 탭과 연결하지 않는다.
```

카테고리별 동작:

```txt
All: 전체 게시글
Questions: 질문 카테고리
Reviews: 후기 카테고리
Tips: 팁 카테고리
Food: 음식 관련 카테고리
Routes: 동선/이동 관련 게시글 카테고리
Popular: 이번 MVP에서는 like_count 기준 정렬 또는 mock 수준으로 처리 가능
```

---

## 카테고리 가로 스크롤 구현 지침

Phrases 탭에서 해결한 가로 스크롤 구조를 참고한다.

핵심 구조:

```txt
부모 래퍼: min-w-0 max-w-full overflow-hidden
스크롤 컨테이너: category-scroll 또는 no-scrollbar + overflow-x-auto
내부 div: flex min-w-max gap-2
버튼: shrink-0 whitespace-nowrap
overscroll-x-contain 적용
```

Phrases 쪽 참고 파일:

```txt
src/features/phrases/components/PhraseCategoryTabs.jsx
src/pages/PhrasesPage.jsx
src/index.css
```

가능하면 `.category-scroll` 유틸이 이미 있으면 재사용한다.

카테고리 버튼은 화면 너비를 넘어가도 오른쪽으로 삐져나오지 않아야 하며, 모바일에서 좌우 스와이프 가능해야 한다.

PC에서도 접근 가능해야 한다.

---

## UI shadow 정리 지침

강한 coral shadow를 사용하지 않는다.

피해야 할 것:

```txt
shadow-coral
강한 coral glow
과한 drop shadow
```

권장:

```txt
bg-coral text-white
shadow 없음
또는 아주 약한 그림자
```

약한 그림자 예시:

```txt
shadow-[0_2px_6px_rgba(248,72,31,0.18)]
```

Phrases 탭 카테고리 개선 때처럼 active 버튼도 강한 그림자 없이 깔끔하게 처리한다.

---

## 예상 수정 파일

실제 파일 구조 확인 후 확정한다.

예상 후보:

```txt
src/pages/LoginPage.jsx
src/pages/SignUpPage.jsx
src/pages/CommunityPage.jsx
src/pages/YouPage.jsx
src/app/router.jsx
src/app/App.jsx
src/features/auth/*
src/features/community/*
src/shared/components/Icon.jsx
src/index.css
```

Courses 관련 파일은 이번 작업에서 수정하지 않는다.

---

## 구현 순서

권장 순서:

```txt
1. Auth / Community 관련 현재 파일 구조 확인
2. Supabase client 연결 상태 확인
3. Community 테이블 존재 여부 확인
4. 테이블이 없으면 최소 SQL 작성 후 사용자 승인 대기
5. 이메일 로그인 구현
6. 회원가입 페이지 구현
7. 로그아웃 구현
8. Community 게시글 목록 조회 구현
9. 로그인 사용자 게시글 작성 구현
10. 카테고리 가로 스크롤 적용
11. shadow-coral 제거 및 UI 정리
12. npm run build
```

DB 테이블이 없는 경우, SQL은 바로 실행하지 말고 먼저 보고한다.

---

## 하지 않을 것

이번 작업에서 하지 않을 것:

```txt
Courses 탭 구현
Courses 관련 파일 수정
장소 첨부
코스 첨부
댓글 작성
좋아요 실제 저장
복잡한 이미지 업로드
Google OAuth 실제 연동
Facebook OAuth 실제 연동
Map 추천 로직 수정
Phrases / Voice help 안정 파일 수정
TourAPI 관련 함수 수정
번역 함수 수정
Edge Function 수정
기존 mg_places / mg_place_texts 수정
Git commit / push
```

특히 아래 파일들은 특별한 이유 없이 건드리지 않는다.

```txt
src/features/phrases/components/VoiceHelpPlaceholder.jsx
src/features/phrases/services/speechRecognitionService.js
src/features/phrases/services/ttsService.js
supabase/functions/mg-voice-help/index.ts
supabase/functions/mg-tour-seed/index.ts
supabase/functions/mg-tour-en-enrich/index.ts
supabase/functions/mg-place-translate-en/index.ts
```

---

## 확인 항목

구현 후 확인할 것:

```txt
이메일 회원가입 가능
이메일 로그인 가능
로그아웃 가능
로그인하지 않은 상태에서 글 작성 제한
로그인한 상태에서 글 작성 가능
Community 게시글 목록에 작성한 글 표시
카테고리 가로 스크롤 정상
카테고리 버튼이 화면 밖으로 삐져나가지 않음
강한 shadow-coral 제거
Google/Facebook 버튼 클릭 시 준비중 안내
npm run build 통과
```

---

## 현재 작업 상태

```txt
상태: 구현 전 계획
목표: Auth + Community 최소 동작 흐름 구현
범위: Login / Sign up / Community text post MVP
제외: Courses 탭, 장소 첨부, 코스 첨부, 소셜 로그인 실제 연동
```
