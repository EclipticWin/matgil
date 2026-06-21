# 23. Community 기능 구현 작업 로그

## 작성 일시

2026-06-22 KST

## 작업 배경

Matgil Community 탭에 게시글 조회만 있던 초기 상태에서, 로그인 사용자가 글을 작성·수정·삭제·좋아요·댓글을 달 수 있는 실사용 커뮤니티 기능을 단계적으로 확장했다.
마지막으로 게시글 이미지 첨부 + 전체화면 뷰어까지 구현했다.

커밋 3개로 나뉜다.

```
809912d  community 1차 — locale 분리, 수정/삭제, 좋아요, 댓글
0142fd0  community 2차 — CommentBottomSheet, 대댓글, 댓글 좋아요, 버그 수정
257c942  community 3차 — 이미지 첨부 + 전체화면 뷰어
```

---

## 수정/생성 파일 목록

```
src/features/community/services/communityService.js   — CRUD, 좋아요, 댓글, 이미지 업로드
src/features/community/components/PostComposer.jsx    — 글쓰기/수정 bottom sheet + 이미지 첨부 UI
src/features/community/components/PostCard.jsx        — 카드 수정/삭제/좋아요/이미지 carousel
src/features/community/components/CommentBottomSheet.jsx  — 댓글 bottom sheet (신규 생성)
src/features/community/components/ImageViewerModal.jsx    — 이미지 전체화면 뷰어 (신규 생성)
src/features/community/components/PostCommentSection.jsx  — 1차 인라인 댓글 (2차에서 BottomSheet로 대체)
src/features/community/data/communityPosts.js         — fallback 더미 게시글
src/pages/CommunityPage.jsx                           — 전체 orchestration, 이미지/댓글 연결
src/shared/components/Button.jsx                      — primary shadow 약화
src/shared/i18n/dictionary.js                         — EN/KO 문구 추가
src/shared/utils/avatarColor.js                       — 아바타 stable hash (신규 생성)
src/shared/utils/formatTime.js                        — 상대/절대 시간 포맷 (신규 생성)
docs/22-community-ddl-and-feature-reference.md        — DDL/기능 기준 문서 (사용자 작성)
```

---

## 구현된 Community 기능

### 1. 게시글 조회 — 한/영 locale 분리

- `fetchPosts({ locale, popular })` — `locale='ko'` 또는 `locale='en'` 필터링
- 해당 locale 게시글이 0개이면 전체 재조회(fallback)
- Popular 탭: `like_count desc → comment_count desc → created_at asc`
- 일반 탭: `created_at desc`
- DB 데이터 없으면 더미 `COMMUNITY_POSTS` fallback

### 2. 게시글 작성

- `PostComposer` — 카테고리 선택(General/Question/Review/Tips/Food/Routes), 본문 textarea
- `createPost({ userId, category, locale, content, authorName, imageUrls })`
- 최소 2자 입력 시 제출 버튼 활성화 (`canSubmit = content.trim().length >= 2 && !busy`)
- 카테고리 기본값: `general`
- 신규/수정 모드 전환 시 `useEffect`로 state 초기화

### 3. 게시글 수정

- 내 글에만 수정/삭제 버튼 표시 (`isOwn = user.id === post.userId`)
- `PostComposer isEditing` 모드로 재사용 — 기존 content/category 초기값 전달
- `updatePost(id, { category, content, imageUrls })`

### 4. 게시글 soft delete

- `deletePost(id, userId)` — `is_published = false`, `deleted_at`, `deleted_by` 업데이트
- `.eq('user_id', userId)` 조건으로 타인 글 삭제 불가
- Storage 파일은 삭제하지 않음

### 5. 게시글 좋아요

- `likePost / unlikePost` — `mg_community_post_likes` insert/delete
- Optimistic update: 클릭 즉시 UI 반영 → DB 반영 후 loadPosts 재조회
- 실패 시 rollback
- 내 글 좋아요 불가 (`canLike = isDbPost && user && !isOwn`)
- DB trigger로 `like_count` 자동 갱신

### 6. 댓글 Bottom Sheet

- `CommentBottomSheet` — Instagram 스타일 하단 드래그 sheet
- 댓글 목록 조회: `fetchComments(postId)` — soft delete된 최상위 댓글은 placeholder 표시
- 본인 댓글에만 삭제 버튼 표시 (`deleteComment` — soft delete)
- 비로그인 시 로그인 유도 버튼 표시 (`onLoginClick` prop)
- 댓글 개수 표시 헤더

### 7. 대댓글 1depth

- Reply 버튼 탭 → replyTo state 세팅 → submit 시 `parent_comment_id` 전달
- `createComment({ ..., parentCommentId })`
- 댓글 트리: 최상위 댓글 + 하위 대댓글 들여쓰기 표시
- 대댓글 작성 취소 버튼 (`cancelReply`)

### 8. 댓글 좋아요

- `likeComment / unlikeComment` — `mg_community_comment_likes` insert/delete
- `fetchLikedCommentIds(userId, commentIds)` — 댓글 목록 로드 후 좋아요 상태 일괄 조회
- 내 댓글 좋아요 불가
- DB trigger로 `like_count` 자동 갱신

### 9. 삭제된 부모 댓글 placeholder

- `fetchComments` 쿼리: `deleted_at.is.null OR parent_comment_id.is.null`
  - 삭제된 최상위 댓글도 row 유지 → 대댓글이 있으면 "Deleted comment" placeholder 표시
  - 대댓글은 정상 표시

### 10. 이미지 첨부 (Supabase Storage)

- Storage bucket: `community-post-images` (Public, authenticated 사용자 본인 userId 폴더만 업로드 가능)
- `uploadPostImages(files, userId)`:
  - 경로: `{userId}/{YYYYMMDDHHmmss}-{uuid}.{ext}`
  - `image/*` 타입만 허용
  - 1장당 최대 5MB — 초과 시 throw `tooLarge`
  - 최대 3장 — 초과 시 throw `tooMany`
  - 업로드 후 public URL 배열 반환
- `storage.remove()` 호출 없음 — Storage 파일 삭제 금지

### 11. 게시글 1개당 이미지 최대 3장

- `PostComposer`에서 기존 이미지 + 신규 파일 합계 3장 초과 불가
- 수정 모드: 기존 `imageUrls` props → X 버튼으로 화면에서 제거(DB에서만 제외, Storage 유지)
- 신규 파일: ObjectURL 썸네일 미리보기, 제거 가능
- submit 시 신규 파일 먼저 업로드 → 기존 URL + 신규 URL 합쳐서 `image_urls` 저장

### 12. 이미지 목록 카드 표시

- `PostCard`의 `imageUrls` 배열 기반 carousel
- 한 번에 1장 표시 — dot indicator 클릭으로 이미지 전환
- 이미지 우측 상단 `N/전체` 배지
- 이미지 클릭 → `ImageViewerModal` 열기
- 카드 이미지 위 화살표 없음 (dot만으로 전환)
- `normalizeCommunityImageUrls(raw)` — DB의 `image_urls` jsonb 배열을 http URL 배열로 정규화

### 13. 이미지 전체화면 뷰어

- `ImageViewerModal` — `absolute inset-0 z-[300]` (AppLayout의 `relative` div 기준)
  - 앱 모바일 프레임 밖으로 나가지 않음 (`overflow-hidden` 클립)
- 이미지 `block w-full h-auto` — 앱 프레임 너비에 딱 맞춤
- 배지/X/화살표 — 이미지 wrapper(`relative w-full`) 기준 absolute 배치
- dot indicator — 이미지 아래 중앙, `h-1.5 w-1.5`
- Escape 키 닫기

### 14. Pinch zoom / swipe

- Touch 이벤트 직접 구현 (외부 패키지 없음)
- Pinch zoom: 두 손가락 거리 비율로 scale 계산, clamp 1~4
- scale은 `<img>`에만 `transform` 적용 — wrapper/컨트롤 위치 무영향
- Swipe: touchStart X → touchEnd X 차이 50px 이상 시 이미지 전환
- zoom 상태(scale > 1.05)에서는 swipe 비활성
- 이미지 전환 시 scale 1로 초기화

### 15. 아바타 색상 stable 처리

- `avatarGradient(id)` — userId 또는 authorName 문자열을 djb2-like 해시로 고정 gradient 반환
- 새로고침이나 목록 재조회 시 아바타 색이 바뀌지 않음

### 16. 시간 표시 개선

- `formatRelativeOrAbsolute(isoStr)`
  - 2일 미만: `Xm`, `Xh`, `Xd` 상대 시간
  - 2일 이상: `YYYY.MM.DD HH:mm` 절대 시간

### 17. 버튼 shadow 개선

- `Button.jsx` primary variant: `shadow-coral`(강한 glow) → `shadow-[0_2px_6px_rgba(248,72,31,0.16)]`
- Floating Post 버튼, PostComposer 제출 버튼, 수정 Save 버튼 모두 동일 기준 적용

---

## Supabase DB/Storage 변경 요약

### DB (사용자가 직접 적용)

```sql
-- 게시글 이미지 URL 배열
ALTER TABLE public.mg_community_posts
  ADD COLUMN image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
```

기존 테이블 (작업 전 이미 존재):
- `mg_community_posts` — 게시글 (is_published soft delete)
- `mg_community_post_likes` — 게시글 좋아요
- `mg_community_comments` — 댓글/대댓글 (deleted_at soft delete)
- `mg_community_comment_likes` — 댓글 좋아요
- DB triggers: like_count, comment_count 자동 갱신

### Storage

- bucket: `community-post-images`
- Public 읽기 허용
- authenticated 사용자는 자신의 userId 폴더에만 업로드 가능
- 삭제 policy 없음 — 프론트에서 `storage.remove()` 호출하지 않음

---

## 현재 남은 문제 / 나중에 개선할 항목

1. **이미지 뷰어 세로 긴 이미지**: `block w-full h-auto`로 너비 고정 시 세로 이미지가 앱 화면보다 길어져 잘릴 수 있음. 가로 이미지/정사각 이미지는 정상. 세로 이미지 전용 `max-h` 처리 필요할 수 있음.
2. **이미지 뷰어 pan 기능 없음**: pinch zoom 후 확대된 이미지를 끌어서 볼 수 없음. pan 구현은 이번 범위에서 제외.
3. **이미지 뷰어 가로 carousel 없음**: 뷰어에서 좌우 swipe는 있지만, 슬라이드 애니메이션 없이 즉시 전환됨.
4. **댓글 soft delete placeholder**: 삭제된 최상위 댓글 중 대댓글이 없는 것도 placeholder로 보일 가능성 있음. 조건 정밀화 가능.
5. **이미지 업로드 중 loading 표시**: 업로드 중 PostComposer 버튼이 `busy` 상태이지만, 파일별 진행 상황 표시는 없음.
6. **Popular 탭 like_count 기준**: DB trigger 반영 타이밍에 따라 즉시 갱신이 안 될 수 있음.
7. **게시글 locale fallback**: EN 게시글이 없으면 전체(KO+EN) fallback. 영어 사용자가 보는 KO 글 처리 정책 미정.

---

## 테스트한 내용

- 로그인 후 글쓰기: 카테고리 선택, 본문 2자 이상, 제출 → DB 저장 확인
- 글 수정: 기존 내용/카테고리 로드, 수정 후 저장
- 글 삭제: soft delete 후 목록에서 사라짐
- 좋아요: 토글, 내 글 비활성, 숫자 갱신
- 댓글: 작성, 삭제, 대댓글 1depth, 댓글 좋아요
- 이미지 첨부: 1~3장, 5MB 초과 오류, 썸네일 미리보기, 수정 모드 기존 이미지 유지
- PostCard 이미지 carousel: dot 클릭으로 이미지 전환
- 전체화면 뷰어: 이미지 클릭 → 모달 열기, X 닫기, Escape 닫기, swipe, pinch zoom
- 앱 프레임 밖 overflow 없음 확인 (PC + 모바일 DevTools)
- EN/KO 전환 시 UI 문구 raw key 노출 없음 확인

---

## npm run build 결과

```
vite v5.4.21 building for production...
✓ 154 modules transformed.
dist/index.html                  0.79 kB │ gzip:   0.46 kB
dist/assets/index-CRbe2Xui.css  31.47 kB │ gzip:   6.81 kB
dist/assets/index-DlaH4hlf.js  523.08 kB │ gzip: 151.68 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 3.44s
```

경고: chunk size 500kB 초과는 기존부터 있던 경고로, 이번 작업과 무관.
CSS minify warning (`-: T.Z`) 도 기존 Tailwind arbitrary value 처리 경고로 기능 영향 없음.
