# 24. MyPage / Locale / Routing 작업 로그

## 작성 일시

2026-06-22 KST

---

## 이전 작업 기준

`docs/23-community-implementation-log.md`

23번 문서에서 Community 기능(글쓰기/수정/삭제/좋아요/댓글/이미지 첨부/전체화면 뷰어)의 전체 구현을 완료했다.  
이번 24번 작업은 Community 자체 기능보다는 MyPage 실데이터 연결, 라우팅 안정화, 언어 설정 영구 저장, UI 마감, 데스크톱 소개 영역 준비에 집중한 후속 작업이다.

---

## 작업 배경

- 커뮤니티 기능 구현 이후 MyPage가 여전히 가짜 통계 데이터를 보여주고 있었다.
- MyPage에 실제 커뮤니티 활동 기반 정보를 표시할 필요가 있었다.
- 로컬 개발 서버에서 `/community`, `/my` 같은 경로를 새로고침하면 Vite base URL 경고와 흰 화면이 뜨는 문제가 있었다.
- 언어 설정은 가능했지만 새로고침/로그아웃/계정 변경 시 상태 유지가 불안정했다.
- PC에서는 모바일 앱 프레임만 보여서, 추후 데스크톱용 소개/QR 영역이 필요해졌다.

---

## 커밋 목록

```
2a55b35  feat: MyPage 3차 — Language 카드, 언어 유지/초기화 로직, UI 마감
37d7f52  feat: MyPage 2차 — view state 전환, 선택 삭제, stat 2개 정렬
a1e5f6c  feat: MyPage — 프로필 수정, 실제 activity count, 좋아요 글/댓글 탭
68f8f8a  feat: stabilize i18n and locale UI
d7bc37c  feat: EN/KO i18n Step 1-b — full tab coverage, Pretendard font, UI fixes
e706b27  feat: EN/KO i18n Stage 1 — LocaleProvider, Map core UI, SearchOverlay locale branching
```

---

## 1. 로컬 새로고침 라우팅 수정

### 수정 파일

```
vite.config.js
src/app/App.jsx
```

### 문제

로컬 개발 서버에서 `/community`, `/my`, `/phrases` 등을 직접 새로고침하면 Vite가 해당 경로에서 `index.html`을 찾지 못해 흰 화면이 발생했다.  
원인: `vite.config.js`에서 `base`가 `/matgil/`로 고정되어 있어 dev 환경에서도 경로가 `/matgil/community` 형태로 처리되었다.

### 수정 내용

**vite.config.js**

```js
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/matgil/' : '/',
  plugins: [react()],
}));
```

- `command === 'build'` 일 때만 GitHub Pages용 `/matgil/` 적용
- dev 서버에서는 `/` 사용

**src/app/App.jsx**

```js
const base = import.meta.env.BASE_URL ?? '/';
const basename = base === '/' ? undefined : base.replace(/\/$/, '');

<BrowserRouter basename={basename}>
```

- `import.meta.env.BASE_URL`은 vite.config의 `base` 값을 그대로 반영
- dev: `BASE_URL='/'` → `basename=undefined` (BrowserRouter 기본값)
- prod: `BASE_URL='/matgil/'` → `basename='/matgil'`

### 환경별 동작 정리

```
dev:  base = '/'         → basename = undefined
prod: base = '/matgil/'  → basename = '/matgil'
```

### 결과

로컬에서 `/community`, `/my`, `/login`, `/signup`, `/phrases`, `/courses` 등을 직접 새로고침해도 정상 라우팅.

---

## 2. MyPage 1차 구현 — 프로필 수정 + 커뮤니티 활동 연결

### 수정/생성 파일

```
src/pages/MyPage.jsx
src/features/auth/hooks/useAuth.jsx
src/features/community/services/communityService.js
src/features/profile/components/EditProfileSheet.jsx
src/shared/i18n/dictionary.js
```

### 프로필 카드

- 닉네임 + 이메일 표시
- 아바타: `avatarGradient(userId)` 기반 해시 gradient (stable, 새로고침 시 색 불변)
- `Edit profile` 버튼 → `EditProfileSheet` 바텀시트 열기

### EditProfileSheet

- `absolute inset-0 z-50` 배치 (AppLayout의 `relative flex h-full flex-col` 기준)
- 닉네임 2~30자 유효성 검사
- `canSave = trimmed.length >= 2 && trimmed.length <= 30 && !busy`
- 저장 시 `useAuth().updateDisplayName(trimmed)` 호출
- 입력창 focus: `stone/gray` 계열 border/ring — coral/red 사용 금지

### updateDisplayName (useAuth.jsx)

```js
const { data, error } = await supabase.auth.updateUser({
  data: { display_name: trimmed },
});
setUser(normalizeUser(data.user));
// best-effort author_name backfill
await supabase.from('mg_community_posts').update({ author_name: trimmed }).eq('user_id', userId);
await supabase.from('mg_community_comments').update({ author_name: trimmed }).eq('user_id', userId);
```

- `user_metadata.display_name` 업데이트 후 user state 즉시 반영
- 기존 작성한 게시글/댓글의 `author_name` backfill 시도 (RLS/네트워크 에러는 무시)

### 실제 활동 count 연결

`communityService.js`에 `fetchMyActivityCounts(userId)` 추가:

```js
export async function fetchMyActivityCounts(userId) {
  const [postsResult, likedPostsResult, likedCommentsResult] = await Promise.all([
    supabase.from('mg_community_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('is_published', true).is('deleted_at', null),
    supabase.from('mg_community_post_likes')
      .select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('mg_community_comment_likes')
      .select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { myPosts: postsResult.count, likedPosts: likedPostsResult.count, likedComments: likedCommentsResult.count };
}
```

- 기존 가짜 하드코딩 통계 완전 제거
- 로딩 전 `null` → 화면에 `–` 표시

### 주의 사항

- 별도 `profiles` 테이블은 만들지 않았다.
- Supabase SQL은 실행하지 않았다.
- user_metadata 기반으로 프로필 정보를 관리한다.
- Storage 건드리지 않았다.

---

## 3. MyPage 2차 정리 — view state 전환 + 목록 화면 분리

### 수정/생성 파일

```
src/pages/MyPage.jsx
src/features/community/services/communityService.js
src/features/profile/components/MyPostsView.jsx   (신규 생성)
src/features/profile/components/LikedPostsView.jsx (신규 생성)
src/shared/i18n/dictionary.js
```

### 구조 변경

MyPage 메인 화면에서 좋아요한 글/댓글 목록 직접 노출 제거.  
메인 화면은 프로필 카드 + 요약 카드 3개 + 로그아웃 버튼 중심으로 정리.  
브라우저 라우트 추가 없이 내부 view state로 화면 전환:

```js
const [view, setView] = useState('home'); // 'home' | 'myPosts' | 'likedPosts'
```

- 카드 클릭 → `setView('myPosts')` 또는 `setView('likedPosts')`
- 각 뷰에서 뒤로가기 버튼 → `setView('home')` + `loadCounts()` 재조회

### Liked comments UI 제거

- Liked comments 탭 및 관련 카드 제거
- `fetchMyLikedComments`는 `communityService.js`에 함수는 남겨두되, UI에서 노출하지 않음

### MyPostsView (신규)

```
src/features/profile/components/MyPostsView.jsx
```

- `fetchMyPosts(userId)` — 내가 쓴 글 목록 (is_published=true, deleted_at=null, 최신순)
- Compact 카드: 본문 미리보기, 좋아요/댓글 수, 날짜, 썸네일
- Checkbox 선택: Select all / Deselect all
- Delete selected → confirm banner → `softDeletePosts(ids, userId)`
- soft delete: `is_published=false`, `deleted_at=now()`, `deleted_by=userId`
- hard delete 없음, Storage 파일 삭제 없음

### LikedPostsView (신규)

```
src/features/profile/components/LikedPostsView.jsx
```

- `fetchMyLikedPosts(userId)` — 내가 좋아요한 글 목록 (최근 좋아요 순)
- 읽기 전용 (삭제 기능 없음)
- 좋아요한 순서 기준 정렬 (`orderMap` 기반 re-sort)

### communityService.js 추가 함수

```js
fetchMyPosts(userId)           // 내가 쓴 글
fetchMyLikedPosts(userId)      // 내가 좋아요한 글
fetchMyLikedComments(userId)   // 내가 좋아요한 댓글 (UI 미사용)
softDeletePosts(ids, userId)   // 선택 soft delete
```

---

## 4. MyPage 언어 설정 카드 + 언어 유지/초기화 로직

### 수정 파일

```
src/pages/MyPage.jsx
src/shared/i18n/LocaleProvider.jsx
src/shared/i18n/dictionary.js
```

### Language 카드 추가

- My posts / Liked posts 카드와 동일한 줄에 Language 카드 추가 (3개 한 줄)
- 카드 클릭 → 기존 `LanguageModal` 재사용 (`Modal variant="center"`)
- Map 탭 언어 선택과 MyPage 언어 선택이 같은 `LocaleContext` 상태를 공유

### LocaleProvider 언어 유지 로직

`LocaleProvider`는 `providers.jsx`에서 `AuthProvider` 바깥에 위치한다.  
`useAuth()`를 사용할 수 없으므로 `supabase`를 직접 사용한다.

```js
// providers.jsx 순서
LocaleProvider > AuthProvider > RecommendationProvider > BookmarkProvider
```

#### onAuthStateChange 이벤트 핸들러

```js
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    setLocaleState('en');
    localStorage.removeItem(LOCALE_KEY);  // 'matgil_locale'
    return;
  }
  if (session) {
    // INITIAL_SESSION / SIGNED_IN / USER_UPDATED / TOKEN_REFRESHED
    const preferred = session.user?.user_metadata?.preferred_locale || 'en';
    setLocaleState(preferred);
    localStorage.setItem(LOCALE_KEY, preferred);
  } else {
    // INITIAL_SESSION with no session (비로그인)
    setLocaleState('en');
    localStorage.removeItem(LOCALE_KEY);
  }
});
```

#### 언어 변경 시 저장

```js
const setLocale = useCallback((code) => {
  setLocaleState(code);
  localStorage.setItem(LOCALE_KEY, code);
  // 로그인 상태면 user_metadata에도 저장
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      supabase.auth.updateUser({ data: { preferred_locale: code } }).catch(() => {});
    }
  });
}, []);
```

- `updateUser({ data: { preferred_locale } })` — 기존 `display_name` 등 다른 metadata는 자동 병합(유지)

### 동작 규칙

```
로그인 상태:
  user_metadata.preferred_locale 우선
  없으면 en

로그아웃 상태:
  기본 en (localStorage 초기화)

다른 계정 로그인:
  이전 계정 언어 이어받지 않음
  해당 계정의 preferred_locale 사용
  없으면 en
```

### 테스트된 흐름

```
- 계정 A에서 ko 설정 → 새로고침 후 ko 유지
- 로그아웃 → 로그인 화면 en으로 초기화
- 계정 B 로그인 → 계정 A 언어가 남지 않음
- 계정 A 재로그인 → 계정 A preferred_locale 복원
```

### 비밀번호 변경 기능 추가 (후속 작업 — 2026-06-23)

#### 수정 파일

```
src/features/profile/components/EditProfileSheet.jsx
src/features/auth/hooks/useAuth.jsx
src/pages/MyPage.jsx
src/shared/i18n/dictionary.js
```

#### 변경 내용

닉네임만 변경 가능하던 `EditProfileSheet`에 비밀번호 변경 섹션을 추가했다.

**EditProfileSheet 구조 변경**

닉네임 입력 아래에 구분선(`border-t border-stone-100`)을 삽입하고, 그 아래 비밀번호 필드 2개를 추가했다:

```
닉네임 입력
─────────────────
새 비밀번호 입력
비밀번호 확인 입력
```

**유효성 검사 로직**

```js
const pwEmpty = newPw === '' && confirmPw === '';
const pwTooShort = newPw.length > 0 && newPw.length < 6;
const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw;
const pwValid = newPw.length >= 6 && newPw === confirmPw;
const canSave = nameValid && (pwEmpty || pwValid) && !busy;
```

- 비밀번호 필드가 모두 비어 있으면 닉네임만 저장
- 비밀번호를 입력한 경우에만 유효성 검사 (6자 이상, 두 필드 일치)
- 인라인 에러: `my.passwordTooShort`, `my.passwordMismatch` 키 사용

**저장 호출 방식 변경**

기존 `onSave(trimmed)` → `onSave({ displayName: trimmed, newPassword: pwEmpty ? '' : newPw })`

**useAuth.jsx — updatePassword 추가**

```js
const updatePassword = useCallback(async (newPassword) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}, []);
```

**MyPage.jsx — handleSaveProfile 변경**

```js
const handleSaveProfile = useCallback(async ({ displayName, newPassword }) => {
  if (displayName !== user.name) {
    await updateDisplayName(displayName);
  }
  if (newPassword) {
    await updatePassword(newPassword);
  }
  setEditingProfile(false);
  setToast(t('my.profileUpdated'));
  setTimeout(() => setToast(''), 3000);
}, [updateDisplayName, updatePassword, user, t]);
```

- 닉네임은 변경된 경우에만 API 호출
- 비밀번호는 입력된 경우에만 API 호출

**dictionary.js 추가 키 (EN/KO)**

```
my.newPassword          — 새 비밀번호 / New password
my.confirmPassword      — 비밀번호 확인 / Confirm password
my.passwordMismatch     — 비밀번호가 일치하지 않습니다 / Passwords do not match
my.passwordTooShort     — 비밀번호는 6자 이상이어야 합니다 / Password must be at least 6 characters
my.passwordUpdateFailed — 비밀번호 변경에 실패했습니다 / Failed to update password
```

---

## 5. MyPage UI 마감

### 수정 파일

```
src/pages/MyPage.jsx
src/shared/i18n/dictionary.js
```

### 카드 정렬 통일

3개 카드 모두:
- 상단: 라벨 (text-[0.7rem] font-semibold text-ink-soft)
- 하단: 값 (font-display font-bold text-coral)

기존 구조(값 위, 라벨 아래)에서 뒤집음.

### Language 카드 수정

- 지구 아이콘(GlobeIcon) 제거
- 값 표시: `LANGUAGES.find(l => l.code === locale).short` → `'EN'` 또는 `'한'`
- 값 크기: `text-xl` (My posts/Liked posts의 `text-2xl`보다 한 단계 작게)
- `StatCard`에 `valueClassName` prop 추가로 카드별 크기 분리

```js
function StatCard({ value, label, onClick, valueClassName }) {
  ...
  <div className={`mt-1 font-display font-bold text-coral ${valueClassName ?? 'text-2xl'}`}>
  ...
}

<StatCard value={currentLang.short} label={t('my.language')} ... valueClassName="text-xl" />
```

### Log out 버튼

- 기존: `rounded-full` (과도하게 pill 형태, 카드와 톤 불일치)
- 변경: `rounded-2xl` (카드 radius와 통일)
- 스타일: `bg-coral/10 text-coral border border-coral/70 shadow-[0_2px_6px_rgba(248,72,31,0.10)]`

### Footer 문구

Log out 버튼 아래에 4~5줄 안내 문구 추가.  
`mt-10` 상단 여백으로 구분, `text-xs text-stone-400 leading-relaxed`.

dictionary 키 구성:

```
my.footerLine1   — 서비스 소개 1줄
my.footerLine2   — 서비스 소개 2줄
my.footerLine3   — EclipticWin 제작자 정보
my.footerContact — 연락처
my.footerAddress — 주소
my.footerCopy    — 저작권 (text-[0.65rem] text-stone-300)
```

**영문 출력:**

```
Matgil is a Seoul food route service for travellers.
Crafted to help visitors explore local places more easily.
Designed and operated by EclipticWin.
Contact: hello@matgil.app
Address: Jung-gu, Seoul, Republic of Korea
© 2026 Matgil. All rights reserved.
```

**한글 출력:**

```
맛길은 서울을 여행하는 사람들을 위한 맛집 동선 추천 서비스입니다.
방문자가 더 쉽게 로컬 맛집을 찾을 수 있도록 만들었습니다.
EclipticWin이 기획하고 제작했습니다.
문의: hello@matgil.app
주소: 서울특별시 중구
© 2026 맛길. All rights reserved.
```

---

## 6. PC 소개/QR 영역 준비 상태

PC에서는 모바일 앱 프레임 왼쪽에 소개/QR 영역을 추가할 계획이다.  
QR 이미지는 사용자가 직접 생성해서 아래 경로에 배치했다.

```
src/assets/desktop/matgil-qr.png
```

**아직 구현하지 않은 항목** (다음 작업으로 남겨둠):

```
- 데스크톱에서만 왼쪽 소개 영역 표시
- 오른쪽에는 기존 모바일 앱 프레임 유지
- 소개 영역과 앱 프레임은 동일 너비로 배치
- 소개 영역 폰트는 앱과 동일하게 Pretendard 사용
- 모바일에서는 소개 영역 숨김
```

QR 이미지만 asset으로 배치했고, 레이아웃 구현은 다음 작업이다.

---

## 7. i18n 작업 원칙

이번 작업에서 계속 지킨 원칙:

```
- UI 문구는 EN/KO 둘 다 dictionary.js에 추가
- raw key가 화면에 노출되지 않게 처리
- MyPage, Language modal, footer 문구 모두 EN/KO 대응
- t() 함수 fallback: KO 키 없으면 EN 키 사용, EN 키도 없으면 key 문자열 반환
```

디자인 원칙:

```
- input/textarea focus에서 red/coral border/ring 사용 금지
- 입력창 focus는 stone/gray 계열만 사용 (focus:border-stone-400 focus:ring-stone-200)
```

---

## 8. 이번 작업에서 건드리지 않은 것

```
Supabase DB schema
Supabase SQL
Storage 설정
Community 이미지 업로드 로직
Community 이미지 뷰어 로직
Map / Search / Courses / Phrases 핵심 로직
Git commit / push (사용자가 명시적으로 요청한 경우에만 실행)
```

---

## 9. 수정/생성 파일 전체 목록

```
vite.config.js                                         — dev/prod base 분기
src/app/App.jsx                                        — BrowserRouter basename 동적 계산
src/pages/MyPage.jsx                                   — 프로필/카드/언어/footer UI
src/features/auth/hooks/useAuth.jsx                    — updateDisplayName + backfill
src/features/community/services/communityService.js    — fetchMyActivityCounts, fetchMyPosts, fetchMyLikedPosts, fetchMyLikedComments, softDeletePosts 추가
src/features/profile/components/EditProfileSheet.jsx   — 닉네임 수정 바텀시트 (신규)
src/features/profile/components/MyPostsView.jsx        — 내가 쓴 글 목록 + 선택 삭제 (신규)
src/features/profile/components/LikedPostsView.jsx     — 좋아요한 글 목록 (신규)
src/shared/i18n/LocaleProvider.jsx                     — 언어 유지/초기화 로직
src/shared/i18n/dictionary.js                          — my.* 키 전체 추가 (EN/KO)
src/assets/desktop/matgil-qr.png                       — QR 이미지 asset (신규)
```

---

## 10. 현재 남은 작업 후보

```
- PC 데스크톱 소개/QR 영역 실제 구현
- MyPage 목록 카드 디자인 추가 개선
- MyPage에서 내가 쓴 글 상세/수정으로 이동하는 기능
- 좋아요한 댓글 기능은 UI에서 제거했지만 필요하면 추후 별도 화면으로 재검토
- 실제 회사/문의 정보 확정 시 footer 문구 교체
```

---

## 11. npm run build 결과

```
vite v5.4.21 building for production...
✓ 157 modules transformed.
dist/index.html                  0.79 kB │ gzip:   0.46 kB
dist/assets/index-Ct8fmrpg.css  33.56 kB │ gzip:   7.09 kB
dist/assets/index-DHR279_V.js  537.30 kB │ gzip: 155.09 kB
✓ built in 3.65s
```

- 신규 에러 없음
- CSS warning (`-: T.Z`): 기존 Tailwind arbitrary value 처리 경고 — 기능 영향 없음
- chunk size 500kB 초과 경고: 기존부터 있던 경고 — 이번 작업과 무관
