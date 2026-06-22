# 20. MyPage 커뮤니티 활동 및 프로필 수정 구현 요청

## 작성 일시

2026-06-22 KST

## 작업 목적

현재 `/my` 마이페이지는 일부 사용자 정보만 실제 Supabase Auth와 연결되어 있고, 나머지 통계 값은 하드코딩된 가짜 데이터다.

커뮤니티 기능이 어느 정도 구현된 상태이므로, 마이페이지에서 사용자의 실제 커뮤니티 활동을 확인할 수 있게 개선한다.

---

## 현재 상태

현재 MyPage에서 실제로 연결된 정보:

```txt
- 닉네임
- 이메일
```

현재 하드코딩된 가짜 데이터:

```txt
- Saved places: 0
- Courses walked: 2
- Reviews left: 14
```

이 값들은 실제 데이터가 아니므로 제거하거나 커뮤니티 기반 실제 데이터로 대체해야 한다.

---

## 구현 목표

MyPage에 다음 기능을 추가한다.

```txt
1. 내 프로필 영역 개선
2. 닉네임 수정 기능
3. 내가 좋아요한 글 보기
4. 내가 좋아요한 댓글 보기
5. 하드코딩된 fake stats 제거
6. 실제 커뮤니티 기반 activity count 표시
```

---

## 클로드 작업 지시

아래 내용을 기준으로 바로 구현해.

검토 보고 길게 하지 말고 바로 코드 수정해.
git add / commit / push 하지 마.
Supabase SQL 실행하지 마.
DB 수정하지 마.
Storage 건드리지 마.
새 패키지 설치하지 마.
수정 후 npm run build 실행해.

앞으로 input/textarea focus 상태에서 빨간색/coral border나 ring을 쓰지 마. 입력창 focus는 stone/gray 계열만 써라.

한국어/영어 버전 둘 다 처리해.
UI 문구는 dictionary에 EN/KO 모두 추가하고, raw key가 화면에 보이면 안 된다.

---

# 1. 내 프로필 영역

현재 로그인 사용자의 정보를 표시한다.

표시 항목:

```txt
- stable avatar
- 닉네임
- 이메일
- 내 정보 수정 / Edit profile 버튼
```

현재 별도 프로필 테이블은 만들지 않는다.

```txt
mg_profiles 생성 금지
DB schema 수정 금지
Supabase SQL 실행 금지
```

아바타는 기존 `avatarColor` 유틸이 있으면 재사용한다.

기준:

```txt
같은 user.id면 같은 색상/이니셜이 보여야 한다.
목록 순서나 페이지 이동에 따라 아바타 색상이 바뀌면 안 된다.
```

---

# 2. 닉네임 수정 기능

`Edit profile / 내 정보 수정` 버튼을 누르면 닉네임을 변경할 수 있게 한다.

UI 방식은 bottom sheet, modal, 별도 페이지 중 프로젝트에 가장 자연스러운 방식으로 선택해라.

단, 별도 페이지로 이동한다면 뒤로가기 버튼이 있어야 한다.

권장 방식:

```txt
bottom sheet 또는 modal
```

필수 UI:

```txt
제목: Edit profile / 내 정보 수정
입력: Display name / 닉네임
버튼: Cancel / 취소
버튼: Save / 저장
저장 중: Saving... / 저장 중...
```

입력 검증:

```txt
trim 기준 2자 이상
최대 20자 또는 30자
비어 있으면 저장 불가
```

입력창 스타일:

```txt
focus 빨간색 금지
focus:border-stone-400
focus:ring-stone-200
focus:outline-none
```

---

# 3. Supabase Auth 닉네임 업데이트

현재 `useAuth`에서 Supabase Auth user를 normalize하고 있을 것이다.

`updateDisplayName(displayName)` 같은 함수를 추가해라.

구현 방향:

```js
const { data, error } = await supabase.auth.updateUser({
  data: { display_name: displayName }
});
```

성공 후:

```txt
- normalizeUser(data.user)로 user state 갱신
- MyPage 닉네임 즉시 갱신
- 새로고침 후에도 닉네임 유지
```

주의:

```txt
별도 profiles 테이블 만들지 마.
DB schema 만들지 마.
Supabase SQL 실행하지 마.
```

선택 구현:

닉네임 변경 후 기존 내가 쓴 community posts/comments의 `author_name`도 업데이트 가능하면 처리해라.

대상:

```txt
mg_community_posts.author_name
mg_community_comments.author_name
```

조건:

```txt
user_id = 현재 user.id
```

단, RLS에 막혀 에러가 나면 Auth metadata 업데이트만 성공 처리해라.
author_name backfill 실패 때문에 전체 저장 실패로 만들지 마.

---

# 4. MyPage 활동 요약 count

기존 fake stats를 제거하거나 실제 커뮤니티 기반 값으로 대체해라.

추천 대체:

```txt
My posts / 내가 쓴 글
Liked posts / 좋아요한 글
Liked comments / 좋아요한 댓글
```

조회 기준:

```txt
My posts:
mg_community_posts
where user_id = 현재 user.id
and deleted_at is null
and is_published = true

Liked posts:
mg_community_post_likes
where user_id = 현재 user.id

Liked comments:
mg_community_comment_likes
where user_id = 현재 user.id
```

기존 하드코딩 숫자 `0, 2, 14`는 제거해라.

---

# 5. 내가 좋아요한 글 보기

마이페이지에서 내가 좋아요한 커뮤니티 게시글 목록을 볼 수 있게 해라.

조회 방식:

```txt
1. mg_community_post_likes에서 user_id = 현재 user.id인 post_id 목록 조회
2. mg_community_posts에서 id in postIds 조회
3. is_published = true
4. deleted_at is null
```

정렬:

```txt
가능하면 최근 좋아요한 순서
어렵다면 게시글 created_at desc
```

표시 방식:

기존 `PostCard`를 재사용 가능하면 재사용해라.

단, MyPage에서 수정/삭제 기능까지 제공할 필요는 없다.

최소 표시 항목:

```txt
- 글 내용 일부
- 작성자
- 작성 시간
- 좋아요 수
- 댓글 수
- 이미지가 있으면 대표 이미지
```

빈 상태:

```txt
No liked posts yet / 아직 좋아요한 글이 없습니다
```

---

# 6. 내가 좋아요한 댓글 보기

마이페이지에서 내가 좋아요한 댓글 목록을 볼 수 있게 해라.

조회 방식:

```txt
1. mg_community_comment_likes에서 user_id = 현재 user.id인 comment_id 목록 조회
2. mg_community_comments에서 id in commentIds 조회
3. deleted_at is null
```

가능하면 댓글의 `post_id`로 연결된 게시글 일부도 가져와라.

표시 항목:

```txt
- 댓글 내용
- 댓글 작성자
- 댓글 작성 시간
- 연결된 게시글 내용 일부
```

정렬:

```txt
가능하면 최근 좋아요한 순서
어렵다면 댓글 created_at desc
```

빈 상태:

```txt
No liked comments yet / 아직 좋아요한 댓글이 없습니다
```

댓글을 클릭했을 때 해당 게시글 댓글 시트를 여는 기능은 가능하면 구현하되, 어렵다면 목록 표시까지만 해도 된다.

---

# 7. MyPage UI 구조

추천 구조:

```txt
Your trip / 내 여행

[프로필 카드]
avatar
nickname
email
Edit profile 버튼

[활동 요약 카드 3개]
My posts / 내가 쓴 글
Liked posts / 좋아요한 글
Liked comments / 좋아요한 댓글

[활동 탭]
Liked posts / 좋아요한 글
Liked comments / 좋아요한 댓글
```

탭 방식 권장:

```txt
- 좋아요한 글
- 좋아요한 댓글
```

모바일 화면에 맞게 카드 간격과 여백을 정리해라.

기존 Matgil 톤 유지:

```txt
cream/beige 배경
coral 포인트
부드러운 카드
과한 shadow 금지
```

---

# 8. i18n 필수

dictionary에 EN/KO 모두 추가해라.

필수 문구:

```txt
Edit profile / 내 정보 수정
Display name / 닉네임
Save / 저장
Saving... / 저장 중...
Cancel / 취소
My posts / 내가 쓴 글
Liked posts / 좋아요한 글
Liked comments / 좋아요한 댓글
No liked posts yet / 아직 좋아요한 글이 없습니다
No liked comments yet / 아직 좋아요한 댓글이 없습니다
No community activity yet / 아직 커뮤니티 활동이 없습니다
Profile updated / 프로필이 수정되었습니다
Failed to update profile / 프로필 수정에 실패했습니다
```

이미 있는 키는 중복 추가하지 말고 재사용해라.

raw key가 화면에 보이면 안 된다.

---

# 9. 수정 예상 파일

주로 아래 파일을 확인/수정해.

```txt
src/pages/MyPage.jsx
src/features/auth/hooks/useAuth.jsx
src/features/community/services/communityService.js
src/shared/i18n/dictionary.js
src/shared/utils/avatarColor.js
src/shared/utils/formatTime.js
```

필요하면 새 컴포넌트를 만들어도 된다.

추천 새 파일:

```txt
src/features/profile/components/EditProfileSheet.jsx
src/features/profile/components/MyActivityList.jsx
src/features/profile/services/profileService.js
```

다만 너무 큰 구조 변경은 하지 마.

---

# 10. 건드리지 말 것

아래는 건드리지 마.

```txt
Supabase SQL
DB schema
Storage
Map/Search/Courses/Phrases 핵심 로직
Community 이미지 업로드 로직
Community 이미지 뷰어 레이아웃
Git commit / push
```

---

# 11. 확인 기준

로그인 상태에서 `/my` 진입 후 확인한다.

```txt
1. 닉네임/이메일 표시
2. Edit profile 클릭
3. 닉네임 변경
4. 저장 후 MyPage 닉네임 즉시 변경
5. 새로고침 후에도 닉네임 유지
6. 내가 좋아요한 글 목록 표시
7. 내가 좋아요한 댓글 목록 표시
8. fake 숫자 제거 또는 실제 count로 변경
9. KO/EN 모드 문구 정상
10. input focus에 빨간 border/ring 없음
```

---

# 12. 완료 후 실행

수정 후 반드시 실행한다.

```bash
npm run build
```

완료 보고는 아래 형식으로 짧게 해.

```txt
MyPage 커뮤니티 활동/프로필 수정 기능 완료

1. 수정/생성 파일 목록
2. 구현한 기능 목록
3. 닉네임 업데이트 방식
4. 좋아요한 글/댓글 조회 방식
5. fake stats 제거 여부
6. npm run build 결과
7. git add / commit / push 하지 않았다는 확인
```
