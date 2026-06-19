# 19. 이메일 로그인/회원가입 실제 연동 및 Community MVP 구현

## 작업 일자

2026-06-19

---

## 이전 작업 기준

- 이전 문서: `docs/18-machine-translation-en-enrichment-and-search-overlay.md`
- `docs/18`에서 LLM 기계번역 Edge Function 구현, 프론트 영어 우선 표시 전환, 검색 오버레이 영문화를 완료했다.
- 이번 세션에서는 계획 문서 `ai-docs/17-auth-and-community-mvp-plan.md`를 기반으로, mock 기반이었던 Auth를 실제 Supabase Auth로 교체하고 Community 게시글 작성/조회 MVP를 구현했다.

---

## 이번 작업 목표

1. `useAuth` — mockAuthService를 실제 Supabase Auth로 교체
2. `LoginForm` — 실제 로그인 연결, 에러 표시, 소셜 버튼 → Coming soon 처리
3. `SignUpPage` — 신규 회원가입 페이지 구현 (`/signup`)
4. `communityService` — `mg_community_posts` 테이블 대상 fetchPosts / createPost
5. `CommunityPage` — DB 게시글 조회 + 로그인 유도 sheet + PostComposer 연결
6. `PostComposer` — 카테고리 선택 + 텍스트 작성 bottom sheet
7. `CommunityTabs` — 카테고리 가로 스크롤 구조 개선 + 카테고리 추가 + shadow-coral 제거
8. `MyPage` — auth loading 중 flash-redirect 방지

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/auth/hooks/useAuth.jsx` | 수정 |
| `src/features/auth/components/LoginForm.jsx` | 수정 |
| `src/pages/SignUpPage.jsx` | 신규 |
| `src/app/router.jsx` | 수정 |
| `src/shared/constants/routes.js` | 수정 |
| `src/features/community/services/communityService.js` | 신규 |
| `src/features/community/components/PostComposer.jsx` | 신규 |
| `src/features/community/components/CommunityTabs.jsx` | 수정 |
| `src/features/community/data/communityPosts.js` | 수정 |
| `src/pages/CommunityPage.jsx` | 수정 |
| `src/pages/MyPage.jsx` | 수정 |
| `ai-docs/17-auth-and-community-mvp-plan.md` | 수정 (작업 중 주석 추가) |

---

## 핵심 구현 내용

### 1. useAuth — 실제 Supabase Auth 연동

기존 `mockAuthService.js`를 완전히 제거하고 `supabase.auth.*` 직접 호출로 교체했다.

**변경 전:**

```js
import * as authService from '../services/mockAuthService.js';
const [user, setUser] = useState(() => authService.getUser());
```

**변경 후:**

```js
import { supabase } from '../../../lib/supabase.js';

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(normalizeUser(session?.user ?? null));
    setLoading(false);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(normalizeUser(session?.user ?? null));
  });

  return () => subscription.unsubscribe();
}, []);
```

**normalizeUser — Supabase user 객체 정규화:**

```js
function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.display_name || u.email?.split('@')[0] || 'Traveller',
  };
}
```

**각 auth 메서드:**

```js
// 로그인
const login = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return normalizeUser(data.user);
};

// 회원가입
const signUp = async ({ email, password, displayName }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: displayName ? { data: { display_name: displayName } } : undefined,
  });
  if (error) throw error;
  return { user: normalizeUser(data.user), needsConfirmation: !data.session };
};

// 로그아웃
const logout = async () => {
  await supabase.auth.signOut();
};
```

`loginWithProvider`는 제거했다. Context value에 `loading` 상태를 추가해 앱 초기화 중 auth 판단을 가드할 수 있게 했다.

---

### 2. LoginForm — 실제 로그인 + 에러 처리

**주요 변경:**

```js
const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  setBusy(true);
  try {
    await login({ email, password });
    onDone?.();
  } catch (err) {
    setError(err.message || 'Login failed. Please check your credentials.');
  } finally {
    setBusy(false);
  }
};
```

- `busy` 상태 중 버튼 비활성화 + 로딩 텍스트(`Logging in…`)
- 에러는 인풋 아래 `bg-red-50` 박스에 표시
- "Sign up with email" → `navigate(ROUTES.signup)` 으로 교체 (기존: `signUp()` 즉시 호출)
- Google/Facebook → `alert('Coming soon!')` 처리
- `shadow-coral` 제거 (브랜드 아이콘 영역)

---

### 3. SignUpPage — 신규 회원가입 페이지

`/signup` 경로에 새 페이지를 생성했다.

**필드:**

```txt
Display name (optional)
Email
Password (min 6 characters)
Confirm password
```

**처리 흐름:**

```txt
password !== confirm  → 에러 표시, 요청 안 함
password.length < 6   → 에러 표시
signUp() 호출
  needsConfirmation=true  → "Check your email" 성공 메시지 + Back to Login 링크
  needsConfirmation=false → navigate(ROUTES.community)
signUp 실패           → 에러 메시지 표시
```

**needsConfirmation 판단:**

```js
return { user: normalizeUser(data.user), needsConfirmation: !data.session };
```

Supabase 이메일 확인 설정이 켜져 있으면 `data.session`이 null이므로 `needsConfirmation=true`.

---

### 4. 라우터 / 라우트 상수

`ROUTES`에 `signup: '/signup'` 추가.

`router.jsx`에 `<Route path={ROUTES.signup} element={<SignUpPage />} />` 추가.

---

### 5. communityService — Supabase CRUD

`src/features/community/services/communityService.js` 신규 생성.

**fetchPosts:**

```js
export async function fetchPosts() {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

**createPost:**

```js
export async function createPost({ userId, category, content, authorName }) {
  const { data, error } = await supabase
    .from('mg_community_posts')
    .insert({ user_id: userId, category, content, author_name: authorName })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

DB 테이블 `mg_community_posts` 가 존재하지 않으면 `fetchPosts`가 throw하며, `CommunityPage`는 이 경우 mock 데이터로 fallback한다.

---

### 6. CommunityPage — DB 연동 + 게시글 작성 흐름

**DB 데이터 로딩 및 fallback:**

```js
const loadPosts = useCallback(async () => {
  try {
    const rows = await fetchPosts();
    setDbPosts(rows);
  } catch {
    setDbPosts([]);   // 실패 시 빈 배열 → mock fallback
  }
}, []);

// DB에 실제 글이 있으면 DB 우선, 없으면 mock
const sourcePosts =
  dbPosts && dbPosts.length > 0 ? dbPosts.map(normalizeDbPost) : COMMUNITY_POSTS;
```

**normalizeDbPost — DB row → PostCard 호환 형식 변환:**

```js
function normalizeDbPost(p, i) {
  // created_at → "5m", "2h", "3d" 형식의 ago 문자열 계산
  return {
    id: String(p.id),
    kind: p.category,
    author: p.author_name || 'Traveller',
    from: p.country || '',
    ago,
    text: p.content,
    place: null,
    likes: p.like_count ?? 0,
    comments: p.comment_count ?? 0,
    photo: false,
    tint: POST_TINTS[i % POST_TINTS.length],
  };
}
```

**Post 버튼 클릭 흐름:**

```txt
비로그인 → loginPrompt bottom sheet 표시
  Later → 닫기
  Log in → navigate(ROUTES.login)

로그인 → PostComposer bottom sheet 표시
  작성 완료 → createPost() → 닫기 → loadPosts() 재조회
```

**shadow-coral 제거:** floating button의 `shadow-coral` → `shadow-[0_2px_6px_rgba(248,72,31,0.22)]`

---

### 7. PostComposer — 게시글 작성 bottom sheet

`src/features/community/components/PostComposer.jsx` 신규 생성.

**카테고리 (작성용):**

```txt
Question / Review / Tips / Food / Routes / General
```

**구조:**

```txt
헤더: "New Post" + 닫기 버튼
카테고리 가로 스크롤 칩 (category-scroll 패턴 적용)
textarea: 최소 5자 이상 입력 시 Post 버튼 활성화
하단: Cancel | Post 버튼
```

backdrop 클릭 시 닫히는 구조 (`onClick={onClose}` + `e.stopPropagation()`).

---

### 8. CommunityTabs — 가로 스크롤 구조 개선 + 카테고리 추가

**스크롤 구조 개선 (Phrases 탭 패턴 적용):**

```jsx
// 변경 전: flat overflow-x-auto
<div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-1 pt-[0.9375rem]">

// 변경 후: 3단 래퍼 구조
<div className="min-w-0 max-w-full overflow-hidden">
  <div className="category-scroll flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 pt-[0.9375rem]">
    <div className="flex min-w-max gap-2">
      {/* 버튼들 */}
    </div>
  </div>
</div>
```

**카테고리 변경:**

| 이전 | 이후 |
|---|---|
| All, Popular, Questions, Reviews, General (free) | All, Popular, Questions, Reviews, **Tips, Food, Routes,** General |

**active 버튼 shadow 변경:**

```txt
이전: shadow-coral
이후: shadow-[0_2px_6px_rgba(248,72,31,0.22)]
```

**communityPosts.js mock 데이터:** `kind: 'free'` → `kind: 'general'` 로 수정해 필터 키 일치.

---

### 9. MyPage — auth loading 가드

```js
// 변경 전
if (!user) return <Navigate to={ROUTES.login} replace />;

// 변경 후
if (loading) return null;   // 초기화 완료 전 렌더 블로킹
if (!user) return <Navigate to={ROUTES.login} replace />;
```

앱 초기화 중 `user`가 잠시 `null`이 되어 로그인 페이지로 flash-redirect 되는 문제를 수정했다.

---

## Community DB 테이블 상태

`mg_community_posts` 테이블은 이번 작업에서 SQL 적용을 하지 않았다. `communityService.js`가 테이블에 접근하지만, `CommunityPage`에서 fetch 실패 시 mock 데이터로 fallback하므로 테이블 없이도 앱이 동작한다.

실제 테이블을 만들려면 아래 SQL이 필요하다:

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

-- RLS
alter table public.mg_community_posts enable row level security;

create policy "Anyone can read published posts"
  on public.mg_community_posts for select
  using (is_published = true);

create policy "Authenticated users can insert"
  on public.mg_community_posts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own posts"
  on public.mg_community_posts for update
  to authenticated
  using (user_id = auth.uid());

create policy "Users can delete own posts"
  on public.mg_community_posts for delete
  to authenticated
  using (user_id = auth.uid());
```

---

## 동작 확인 항목

```txt
이메일 로그인 — Supabase Auth signInWithPassword 호출
로그인 실패 — 에러 메시지 red box 표시
로그인 성공 — onDone() 호출, MyPage 접근 가능
회원가입 — /signup 이동, signUp() 호출
  이메일 확인 필요 시 — "Check your email" 메시지
  즉시 로그인 시 — Community 탭으로 이동
로그아웃 — MyPage에서 실행, Map으로 리디렉션
Google/Facebook 버튼 — "Coming soon" alert
MyPage — 로딩 중 flash-redirect 없이 auth 완료 후 정상 표시
Community Post 버튼 (비로그인) — 로그인 유도 bottom sheet
Community Post 버튼 (로그인) — PostComposer bottom sheet 표시
PostComposer — 카테고리 선택 + 5자 이상 입력 시 Post 활성화
게시글 작성 → DB 저장 → 목록 즉시 갱신 (테이블 존재 시)
게시글 작성 실패 → 에러 메시지 표시
CommunityTabs 카테고리 — 좌우 스크롤 정상, 화면 밖으로 삐져나가지 않음
active 카테고리 — shadow-coral 없이 약한 coral shadow
npm run build 통과
```

---

## 이번 작업에서 하지 않은 것

```txt
mg_community_posts 테이블 실제 SQL 적용 (Supabase Dashboard 미실행)
댓글 작성
좋아요 실제 저장
장소/코스 첨부
이미지 업로드
Google/Facebook OAuth 실제 연동
비밀번호 재설정
이메일 인증 플로우 고도화 (resend 버튼 등)
Courses 탭 구현
Edge Function 수정
Git commit / push
```

---

## 현재 한계

- `mg_community_posts` 테이블이 없으면 실제 글 저장이 불가능하고 mock 데이터만 보임
- `user.country`는 회원가입 시 수집하지 않아 DB 저장 시 공백 처리됨
- 게시글에 이미지 첨부 없음 (텍스트 전용)
- Popular 필터는 실제 like_count 정렬 미구현 (현재 기본 정렬과 동일)
- `PostCard`는 DB 글도 mock 글도 같은 컴포넌트로 표시하므로 `photo: false` 고정

---

## 다음 작업 후보

- `mg_community_posts` 테이블 SQL Supabase Dashboard에 적용
- 대량 기계번역 실행 — dryRun=false, limit=50씩 단계적 진행
- Popular 탭 — like_count DESC 정렬 구현
- Community 게시글 좋아요 실제 저장
- 언어 전환 기능 — lang state(EN/KO)를 `getPlaces()` locale 인자와 연결
