`ai-docs` 폴더에 커뮤니티/로그인 MVP 구현 지침 문서를 새로 만들어줘.

파일명은 아래로 해줘.

```txt id="jxol5q"
ai-docs/17-auth-and-community-mvp-plan.md
```

## 문서 제목

```md id="4euo2o"
# 17. 로그인/회원가입 및 Community MVP 구현 계획
```

## 작업 배경

Matgil은 외국인 대상 서울 음식 동선 추천 서비스다.

현재 프로젝트 상태는 아래와 같다.

```txt id="lbztyb"
Map 탭: Kakao Map, 장소 검색, 추천 코스 카드, 상세 sheet 등 일부 구현됨
Phrases 탭: Common phrases, TTS, Voice help 구현됨
Courses 탭: 아직 실제 기능 미구현 또는 mock/껍데기 상태
Community 탭: 화면/mock 중심, 실제 작성/저장 기능 미구현
Login/Auth: 화면은 있으나 실제 이메일 로그인/회원가입 기능 미구현
```

이번 작업의 목적은 Courses 탭이 아니라, **로그인/회원가입과 Community 게시글 작성의 최소 동작 흐름을 구현하기 위한 계획을 정리하는 것**이다.

---

## 최종 목표

### Auth

1. 이메일/비밀번호 회원가입
2. 이메일/비밀번호 로그인
3. 로그아웃
4. 로그인 상태에 따라 Community 글 작성 가능
5. Google/Facebook 버튼은 실제 연동하지 않고 `Coming soon` 또는 `준비중입니다` 안내만 표시

### Community

1. Community 탭에서 게시글 목록 표시
2. 로그인한 사용자만 글 작성 가능
3. 게시글 작성 폼 제공
4. 장소 첨부 기능은 이번 MVP에서 제외
5. 사진 첨부 기능은 DB 구조에 이미 관련 community 테이블/컬럼이 존재하면 검토하되, 없으면 텍스트 게시글만 구현
6. 카테고리 탭은 Phrases 탭처럼 가로 스크롤 가능하게 구현
7. 버튼 `shadow-coral` 같은 강한 그림자 제거
8. 아주 약한 그림자 또는 그림자 없음으로 정리

---

## 중요한 범위 제한

이번 계획은 **Courses 탭 구현 계획이 아니다.**

아래는 이번 범위에서 제외한다.

```txt id="whsne0"
Courses 탭 실제 기능 구현
코스 저장/북마크
코스 상세 페이지 확장
코스별 커뮤니티 연결
장소 첨부 기반 게시글 작성
지도에서 장소 선택 후 게시글 작성
```

Community 게시글에는 이번 MVP에서 장소를 첨부하지 않는다.
DB에 장소/코스 관련 테이블이 있어도 이번 Community MVP와 직접 연결하지 않는다.

---

## 반드시 먼저 확인할 것

구현 전에 실제 프로젝트 파일과 DB 설계 문서를 확인해줘.

확인할 후보:

```txt id="pc1ols"
src/pages/LoginPage.jsx
src/pages/CommunityPage.jsx
src/pages/CoursesPage.jsx
src/app/router.jsx
src/app/App.jsx
src/shared/components/*
src/features/community/*
src/features/auth/*
src/lib/supabase*
src/features/phrases/components/PhraseCategoryTabs.jsx
src/pages/PhrasesPage.jsx
src/index.css
ai-docs/*
docs/*
```

단, `CoursesPage.jsx`는 현재 상태 파악용으로만 확인하고, 이번 구현 범위에 포함하지 않는다.

---

## DB 관련 전제

현재 제공된 주요 DDL에는 아래 테이블들이 있다.

```txt id="7b4dqg"
mg_places
mg_place_sources
mg_place_texts
mg_place_food_details
mg_place_images
mg_courses
mg_course_places
mg_phrases
mg_api_fetch_logs
```

이 중:

```txt id="4cy8ss"
mg_places / mg_place_texts / mg_place_images → 장소 데이터용
mg_courses / mg_course_places → 아직 Courses 기능과 관련된 별도 영역
mg_phrases → 회화표현용
```

현재 제공된 DDL에는 **Community 전용 테이블이 명확히 없다.**

그러므로 실제 Supabase에 community 관련 테이블이 있는지 먼저 확인하고, 없으면 문서에 필요한 최소 테이블 설계를 제안만 해줘.

이번 문서 생성 단계에서는 DB를 직접 수정하지 마.

---

## Auth 구현 방향

Supabase Auth를 사용한다.

### 로그인

현재 Login 화면에는 아래 UI가 있다.

```txt id="ye6hoq"
Email
Password
Log in
Sign up with email
Google
Facebook
```

구현 계획에는 아래 내용을 포함해줘.

```txt id="puckn0"
Log in 클릭 → supabase.auth.signInWithPassword
Sign up with email 클릭 → 회원가입 페이지로 이동
Google 클릭 → "Coming soon" 또는 "준비중입니다" 안내
Facebook 클릭 → "Coming soon" 또는 "준비중입니다" 안내
```

### 회원가입 페이지

새 페이지를 만들 계획을 포함해줘.

예상 필드:

```txt id="ceknpb"
Email
Password
Password confirm
Nickname 또는 display name
Sign up
Back to login
```

회원가입 처리:

```txt id="6wahwb"
supabase.auth.signUp({ email, password })
```

닉네임 저장은 DB 프로필 테이블이 있으면 연결하고, 없으면 이번 MVP에서는 생략하거나 추후 작업으로 남긴다.

### 로그인 상태 관리

구현 계획에 아래를 포함해줘.

```txt id="1rzz7a"
앱 시작 시 supabase.auth.getSession()
auth state change 구독
로그인 상태를 필요한 페이지에서 사용
로그아웃 기능은 You/My page 쪽에 연결 가능하면 연결
```

---

## Community MVP 구현 방향

### 게시글 기능 범위

이번 MVP에서 지원할 것:

```txt id="vbyuel"
게시글 목록 보기
게시글 작성
카테고리 선택
작성자 표시
작성 시간 표시
좋아요/댓글 숫자는 mock 또는 0으로 표시 가능
```

이번 MVP에서 하지 않을 것:

```txt id="ut1aag"
댓글 작성
좋아요 실제 저장
장소 첨부
코스 첨부
지도 장소 검색 첨부
이미지 업로드 복잡 구현
신고/차단
프로필 상세
알림
Courses 탭과의 연동
```

### 장소/코스 첨부 제외

Community 게시글에 장소나 코스를 첨부하지 않는다.

이유:

```txt id="bajprh"
Courses 탭이 아직 실제 기능 구현 전이므로, Community에서 course/place 첨부까지 연결하면 범위가 커짐
현재 MVP 목적은 로그인한 사용자가 텍스트 게시글을 작성할 수 있게 하는 것
Map/Place 데이터와 Community를 지금 연결하면 DB/RLS/UX 범위가 커짐
```

---

## 사진 첨부 정책

DB 구조를 먼저 확인해줘.

```txt id="mnnvqj"
community post image 관련 테이블/컬럼이 이미 있으면:
  사진 첨부 1장 정도만 MVP 계획에 포함 가능

없으면:
  사진 첨부 제외
  텍스트 게시글만 가능
```

현재 제공된 DDL의 `mg_place_images`는 장소 이미지용이다.
Community 게시글 이미지용으로 사용하면 안 된다.

따라서 community 전용 이미지 테이블/컬럼이 없다면, 이번 MVP는 텍스트 게시글만 계획한다.

---

## Community 테이블 설계 제안

실제 DB에 community 테이블이 없다면, 문서에 아래 같은 최소 테이블 제안을 포함해줘.

단, 이 단계에서는 SQL 실행하지 마. 문서에 제안만 작성.

```sql id="av7ort"
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

RLS 정책도 문서에 제안해줘.

```txt id="mhs8vv"
select: 모두 가능
insert: 로그인 사용자만 가능, user_id = auth.uid()
update/delete: 본인 글만 가능
```

단, 실제 SQL 적용은 나중에 별도 승인 후 진행한다.

---

## Community 카테고리 가로 스크롤

Phrases 탭에서 해결했던 가로 스크롤 방식을 참고해줘.

참고 내용:

```txt id="hz9kdy"
부모 래퍼: min-w-0 max-w-full overflow-hidden
스크롤 컨테이너: category-scroll 또는 no-scrollbar + overflow-x-auto
내부 div: flex min-w-max gap-2
버튼: shrink-0 whitespace-nowrap
overscroll-x-contain 적용
```

가능하면 Phrases의 `PhraseCategoryTabs.jsx` 구조를 참고해서 Community 카테고리 탭에도 같은 방식으로 적용한다.

카테고리 예시:

```txt id="xhrjha"
All
Popular
Questions
Reviews
Tips
Food
Routes
```

단, `Routes`는 실제 Courses 탭과 연결하지 않는다.
단순 게시글 카테고리 라벨로만 사용할 수 있다.

화면 너비를 넘어가면 좌우 스와이프로 접근 가능해야 한다.

PC에서도 접근 가능해야 하므로, 기존 `.category-scroll` 유틸이 있으면 재사용한다.

---

## UI shadow 정리

현재 일부 버튼에 `shadow-coral`처럼 강한 그림자가 있을 수 있다.

이번 Community/Auth 구현에서는 아래 원칙을 지켜줘.

```txt id="95ni8w"
shadow-coral 사용 금지
강한 coral glow 제거
버튼은 bg-coral + text-white 정도로 충분
필요하면 아주 약한 그림자만 사용
```

약한 그림자 예시:

```txt id="ke4i73"
shadow-[0_2px_6px_rgba(248,72,31,0.18)]
```

또는 버튼에 shadow를 아예 제거해도 된다.

Phrases 탭에서 했던 것처럼 카테고리 버튼은 active 상태에서도 강한 그림자 없이 깔끔하게 처리한다.

---

## 구현 시 파일 예상

문서에는 실제 파일 확인 후 정확한 파일명을 적어줘.

예상 후보:

```txt id="cogzve"
src/pages/LoginPage.jsx
src/pages/SignUpPage.jsx
src/pages/CommunityPage.jsx
src/app/router.jsx
src/features/auth/*
src/features/community/*
src/shared/components/Icon.jsx
src/index.css
```

Courses 관련 파일은 현재 상태 확인 외에는 수정 대상으로 넣지 않는다.

---

## 하지 말아야 할 것

이번 문서 생성 단계에서 아래를 절대 하지 마.

```txt id="ywdaa9"
코드 수정 금지
DB 수정 금지
Supabase SQL 실행 금지
Edge Function 수정 금지
번역 함수 실행 금지
Map / Phrases / Voice help 안정 파일 수정 금지
TourAPI 관련 함수 수정 금지
Courses 탭 구현 금지
Courses 관련 파일 수정 금지
Git commit / push 금지
```

특히 아래 안정 파일들은 건드리지 말 것.

```txt id="fzi4qt"
src/features/phrases/components/VoiceHelpPlaceholder.jsx
src/features/phrases/services/speechRecognitionService.js
src/features/phrases/services/ttsService.js
supabase/functions/mg-voice-help/index.ts
supabase/functions/mg-tour-seed/index.ts
supabase/functions/mg-tour-en-enrich/index.ts
supabase/functions/mg-place-translate-en/index.ts
```

---

## 문서에 포함할 섹션

아래 구조로 작성해줘.

```md id="jxneo1"
# 17. 로그인/회원가입 및 Community MVP 구현 계획

## 문서 목적
## 현재 상태
## 구현 목표
## 이번 범위에서 제외할 것
## Auth 구현 계획
## 회원가입 페이지 계획
## Community MVP 구현 계획
## Community DB 테이블 필요 여부
## 사진 첨부 처리 방침
## 카테고리 가로 스크롤 구현 지침
## UI shadow 정리 지침
## 예상 수정 파일
## 구현 순서
## 하지 않을 것
## 확인 항목
```

---

## 구현 순서 제안

문서에 아래 순서를 포함해줘.

```txt id="tmwxox"
1. 현재 Auth / Community 관련 파일 구조 확인
2. Supabase Auth 클라이언트 연결 상태 확인
3. Community 테이블 존재 여부 확인
4. 테이블이 없으면 SQL 제안만 작성
5. 로그인/회원가입 UI 흐름 설계
6. Community 목록/작성 MVP 설계
7. 카테고리 가로 스크롤 적용 방식 정리
8. 실제 구현은 다음 단계에서 별도 프롬프트로 진행
```

---

## 작업 후 보고

1. 생성한 파일명
2. 문서에 정리한 핵심 내용
3. Community DB 테이블이 이미 있는지 여부를 어떻게 판단했는지
4. 사진 첨부를 포함할지 제외할지 판단 기준
5. Courses 탭은 이번 범위에서 제외했는지
6. 아직 코드/DB를 수정하지 않았는지
