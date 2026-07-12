# Matgil App Startup Flow Analysis

- 작성 일시: 2026-07-12 KST
- 기준 코드: main @ 93d0dd6 (음식 카테고리 DB 연동 커밋 반영, 작업 트리 클린)
- 목적: `index.html` 요청부터 첫 화면(Map 탭 + 추천 코스)이 완성되기까지의 실제 실행 순서를 파일·라인 근거로 기술한다. 분석 전용 — 코드 변경 없음.

---

## 0. 한눈에 보는 흐름

```
브라우저가 index.html 요청
  dev: Vite dev server(/) | prod: GitHub Pages(/matgil/)
→ 폰트 preconnect + /src/main.jsx 모듈 로드 (prod: 해시 번들로 치환)
→ createRoot + StrictMode (main.jsx)
→ <App/>: Providers → BrowserRouter(basename) → 레이아웃 셸 → AppRouter (App.jsx)
→ Provider 체인 마운트: Locale → FoodCategory → Auth → Recommendation(레거시) → Bookmark(레거시)
   (동기 초기값으로 즉시 렌더 가능, 비동기 부수효과는 마운트 후 시작)
→ AppRouter가 현재 URL 매칭: '/' → AppLayout → HomePage
→ HomePage: 기본 위치(서울시청)로 즉시 렌더 + getPlaces(locale) 비동기 조회
→ 병렬 네트워크: Kakao SDK · 카테고리 2테이블 · mg_places 전량 · (세션 복원)
→ places 도착 → useMemo로 nearby 정렬 → courseBuilder가 코스 최대 9개 동기 생성
→ KakaoMap이 SDK 로드 완료 후 지도 + 활성 코스 마커/폴리라인 렌더
```

## 1. 정적 문서 로드 (index.html)

`index.html`:
- `#root` 빈 div(15행)와 `<script type="module" src="/src/main.jsx">`(16행)뿐인 최소 셸. 로딩 스피너·noscript·인라인 스크립트 없음 — 번들 실행 전까지 완전 백지.
- Google Fonts preconnect + CSS 링크(7-12행, Bricolage Grotesque·Plus Jakarta Sans) — 앱과 무관하게 병렬 로드.
- `lang="en"` 고정(2행) — locale 전환 시에도 갱신되지 않음(접근성 관점 참고).

**dev vs prod 차이**:
- dev: `vite` dev server가 `/`에서 서빙, `/src/main.jsx`를 그대로 ESM 변환 제공.
- prod: `vite.config.js:5` — `base: command === 'build' ? '/matgil/' : '/'`. 빌드 시 script 경로가 `/matgil/assets/index-<hash>.js`로 치환된 index.html이 GitHub Pages에 배포됨.
- **prod 딥링크 한계**: 404.html이 없어(리포·dist 모두 부재) `/matgil/community` 등을 직접 요청하면 Pages가 index.html을 주지 못하고 404 — 라우터까지 도달하지 못한다. 루트(`/matgil/`)로 들어온 뒤의 클라이언트 내비게이션만 정상. (docs/31 High-④)

**배포 체인** (`.github/workflows/deploy.yml`): main push → Node 20 + npm ci → `npm run build`(빌드 env로 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_KAKAO_MAP_JS_KEY` 주입, 39-42행 — 번들에 문자열로 인라인됨) → dist 아티팩트 → deploy-pages. 테스트/린트 게이트 없음.

## 2. React 부트스트랩 (src/main.jsx)

- `createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)`(6-10행).
- `./index.css` import(4행) — Tailwind 진입점. JS 번들 평가 시점에 스타일 주입.
- **StrictMode 영향(dev 한정)**: 마운트 이펙트가 2회 실행된다. 이 코드베이스는 다음으로 방어한다 — Kakao SDK는 모듈 레벨 캐시 프로미스(loadKakaoMapSdk.js:1-2, 24), Auth/Locale 구독은 cleanup에서 unsubscribe, HomePage getPlaces는 `cancelled` 플래그(HomePage.jsx:46-60). 단 dev에서는 getPlaces·카테고리 조회가 2회 발생한다(무해, prod 무관).
- **모듈 평가 부수효과**: `src/lib/supabase.js`가 import 체인에서 평가되며 `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`를 **모듈 로드 시점**에 실행 — 렌더 전에 클라이언트가 준비되고, supabase-js가 localStorage의 `sb-<ref>-auth-token`을 읽을 준비를 한다.

## 3. App 셸 (src/app/App.jsx)

- basename 계산(8-9행): `import.meta.env.BASE_URL`이 `/matgil/`(prod)이면 `'/matgil'`, dev(`/`)면 undefined → `<BrowserRouter basename>`(14행).
- 구조(12-23행): `<Providers>` → `<BrowserRouter>` → 데스크톱 셸. **Provider가 Router 바깥**이므로 모든 전역 상태는 라우트 전환과 무관하게 유지된다.
- 레이아웃: `DesktopIntroPanel`(lg 이상에서만 표시되는 소개/QR 패널) + `max-w-app`(22.5rem) 모바일 프레임 중앙 배치 — 단일 모바일 UI를 데스크톱에서 프레임으로 감싸는 방식.

## 4. Provider 체인 초기화 (src/app/providers.jsx:13-19)

마운트 순서: `LocaleProvider > FoodCategoryProvider > AuthProvider > RecommendationProvider > BookmarkProvider`. 다섯 개 모두 **동기 초기값으로 첫 렌더를 막지 않으며**, 비동기 작업은 마운트 후 이펙트에서 시작된다. 로딩 게이트(전체 화면 스피너)는 없다.

### 4.1 LocaleProvider (src/shared/i18n/LocaleProvider.jsx)
- 초기값: `useState(() => localStorage.getItem('matgil_locale') || 'en')`(21-23행) — **동기**, 새로고침 플래시 방지 의도.
- 이펙트(25-46행): `supabase.auth.onAuthStateChange` 구독.
  - `INITIAL_SESSION` + 세션 있음 → `user_metadata.preferred_locale || 'en'`으로 교체 + localStorage 저장(33-37행).
  - `INITIAL_SESSION` + 세션 없음(게스트) → **무조건 'en' 강제 + localStorage 삭제**(38-42행). 초기 useState가 읽은 'ko'를 즉시 덮어씀 — 게스트 locale 리셋 결함(docs/31 Medium)이자 아래 §8-2 이중 조회의 원인.
  - `SIGNED_OUT` → 'en' 리셋(28-31행).
- `t(key)`: 현재 locale 사전 → EN 폴백 → 키 문자열(59-66행).

### 4.2 FoodCategoryProvider (src/features/explore/context/FoodCategoryProvider.jsx)
- 초기값: `FOOD_CATEGORY_FALLBACK` 18종 정적 데이터(8행) — **첫 렌더부터 필터/라벨이 fallback으로 즉시 동작**(fallback-first 설계).
- 이펙트(29행): `reload()` → `getFoodCategories()`(foodCategoryApi.js) — `mg_food_categories`·`mg_food_category_translations` **병렬 select 2건**(4-7행). 성공 시 `source='db'`로 교체, 실패 시 fallback 유지 + error 보존.
- **locale 비의존**: 전 locale 번역을 일괄 로드하므로 언어 전환 시 재조회 없음. 앱 세션당 요청 2건이 전부.

### 4.3 AuthProvider (src/features/auth/hooks/useAuth.jsx)
- 초기값: `user=null, loading=true`(16-17행).
- 이펙트(19-30행): ① `getSession()` — supabase-js가 localStorage 토큰으로 세션 복원(대부분 로컬 연산, 토큰 만료 임박 시에만 refresh 네트워크 호출) → user 세팅 + loading=false. ② `onAuthStateChange` 구독으로 이후 변화 반영.
- 첫 렌더 시점에는 항상 비로그인으로 보이며, 세션 복원 후 로그인 UI로 전환된다. HomePage는 user를 직접 쓰지 않으므로 첫 화면에는 영향 없음(NearbySheet의 저장 배지 등이 이후 반영).

### 4.4 RecommendationProvider / BookmarkProvider — 레거시
- 소비자가 고아 라우트(/area 위저드, /bookmark)뿐인데 전역에 상주(docs/31 §8). 시작 비용은 미미하다: Recommendation은 상태 초기화뿐, Bookmark는 localStorage `matgil.bookmarks` 동기 읽기 1회. 네트워크 없음.

## 5. 라우트 결정 (src/app/router.jsx)

- 15개 라우트 정의: 풀스크린 그룹(login/signup/위저드 4/courseDetail/savedCourseDetail, 30-37행)과 `<AppLayout/>` 탭 그룹(39-47행: home/courses/community/popular/phrases/bookmark/my), 와일드카드 `*` → `/` replace(49행).
- 최초 진입 URL `/`(prod에선 `/matgil/` — basename이 제거) → AppLayout 매칭 → 인덱스가 아닌 `path={ROUTES.home}`('/') → **HomePage**.
- AppLayout(src/shared/components/AppLayout.jsx): TopBar(데스크톱 전용 브랜드 바) + 스크롤 main(`<Outlet/>`) + BottomNavigation(탭 5개). 라우트 가드 없음 — 모든 탭이 비로그인 접근 가능하고, 인증 필요 동작은 페이지 내부에서 로그인 유도.
- 주석(22-25행)이 위저드를 현행처럼 설명하나 실제로는 고아 라우트(docs/31 §8) — 주석 stale.

## 6. HomePage 첫 렌더와 데이터 요청 (src/pages/HomePage.jsx)

### 6.1 동기 초기 상태 (첫 페인트에 쓰이는 값)
- `filters=EMPTY_FILTERS`, `places=[]`, `placesLoading=true`(27-31행)
- `selectedLocation=DEFAULT_LOCATION` = PRESET_LOCATIONS[0] **서울시청(37.5663, 126.9779)**(locations.js:2,14) — 위치 권한 요청 없이 시청 기준으로 시작. GPS는 사용자가 버튼을 눌러야 동작(handleGpsClick, 116-135행).
- 첫 페인트: 지도 영역(SDK 로드 전 빈 배경) + 검색바/필터/GPS/언어 플로팅 컨트롤 + NearbySheet 로딩 상태.

### 6.2 이펙트 체인
1. `useEffect([locale])`(45-61행): `getPlaces(locale)` — `mg_places` + texts/food_details/images 전량 조인 select 1건(placeApi.js:55-76). 성공 시 places 세팅. **실패는 catch로 무음 처리되어 빈 상태로 위장**(57-59행, docs/31 Medium 잔존). locale이 바뀌면 재조회.
2. `useLayoutEffect`(63-71행): ResizeObserver로 지도 컨테이너 높이(vh) 측정 — NearbySheet 드래그 스냅 계산용. 페인트 전 실행.
3. `useEffect([routeState])`(90-94행): SavedCourseDetailPage에서 router state로 주입된 저장 코스를 지도에 표시 후 state 소거 — 최초 직접 진입 시에는 no-op.

### 6.3 동기 파생 계산 (places 도착 시 같은 렌더 패스에서)
- `nearby = sortPlacesByDistance(applyFilters(places, filters), selectedLocation)`(73-76행) — 필터(카테고리 키 기반) 후 거리 정렬(Haversine, locations.js:16-26).
- `recommendedCourses = buildRecommendedCourses({ places: nearby, ..., maxCourses: 9, locale })`(78-81행) — courseBuilder가 반경 티어(2km→4km→전체) → 근접 20곳 슬라이스 → 3곳 조합 전수 스코어링으로 최대 9개 코스를 **동기 생성**. 제목은 `getLocalizedCourseTitle`(courseDisplay.js — 카테고리 DB화 이후 단일 소스).
- `activeCourse = savedCourseForMap ?? (선택 코스 ?? 첫 코스)`(96-98행) → KakaoMap과 NearbySheet에 전달.

### 6.4 KakaoMap 초기화 (KakaoMap.jsx + loadKakaoMapSdk.js)
- `loadKakaoMapSdk()`: `VITE_KAKAO_MAP_JS_KEY` 없으면 즉시 reject('no-key')(14-16행), 이미 로드됐으면 resolve(19-21행), 진행 중이면 캐시 프로미스 공유(24행 — StrictMode/재렌더 중복 방지). `autoload=false` + services 라이브러리로 `<script>` 삽입(27-28행) → onload에서 `kakao.maps.load(resolve)`(30-33행).
- 로드 완료 후 지도 생성, activeCourse의 정류지 번호 마커 + 폴리라인 + `setBounds`. 실패 시 핀 아이콘 + "Map view" 폴백(재시도 UI 없음 — docs/31 잔존 관찰).
- places 조회와 SDK 로드는 **서로 독립·병렬** — 어느 쪽이 먼저 끝나든 나중 도착분이 반영된다.

## 7. 최초 화면 완성까지의 네트워크 요청 총목록

| # | 요청 | 발생 시점 | 발생 위치 |
|---|---|---|---|
| 1 | Google Fonts CSS(+woff2) | HTML 파싱 | index.html:7-12 |
| 2 | JS/CSS 번들 (prod) | HTML 파싱 | vite 빌드 산출물 |
| 3 | Kakao Maps SDK script | KakaoMap 마운트 | loadKakaoMapSdk.js:27-40 |
| 4 | `mg_food_categories` select | FoodCategoryProvider 마운트 | foodCategoryApi.js:5 |
| 5 | `mg_food_category_translations` select | 동시(병렬) | foodCategoryApi.js:6 |
| 6 | `mg_places` 전량 조인 select | HomePage 마운트 | placeApi.js:55-76 |
| 7 | (조건부) auth token refresh | 세션 복원 시 토큰 만료 임박이면 | supabase-js 내부 |
| 8 | (조건부) `mg_places` **재조회** | locale 플립 시(§8-2) | HomePage.jsx:45-61 |
| 9 | (조건부) 저장 코스 목록 | 로그인 상태에서 NearbySheet 배지 | NearbySheet fetchSavedCourses |

캐시 계층은 없다 — 다른 탭에 갔다가 Map 탭에 돌아오면 HomePage가 재마운트되어 #6이 다시 발생한다(카테고리 #4·5는 Provider가 전역이라 재발생하지 않음).

## 8. 시작 단계의 경쟁 조건·관찰 사항

1. **fallback-first 카테고리**: DB 응답 전 필터 시트를 열면 정적 fallback 라벨이 먼저 보이고 응답 후 교체된다. 현재 seed와 fallback이 동일해 시각적 차이는 없으나, DB 라벨을 수정하면 첫 1초 내 구 라벨이 스칠 수 있다(설계 트레이드오프, 무해).
2. **locale 플립에 의한 getPlaces 이중 조회**: 초기 locale은 localStorage에서 동기로 읽지만(LocaleProvider.jsx:21-23), 직후 `INITIAL_SESSION`이 locale을 덮어쓸 수 있다 — (a) 게스트인데 localStorage가 'ko'였던 경우 'en'으로 강제(38-42행), (b) 로그인 사용자의 preferred_locale이 localStorage와 다른 경우. 두 경우 모두 HomePage의 `[locale]` 이펙트가 재발화하여 **mg_places 전량 조회가 2회** 발생하고 화면 언어가 눈에 띄게 플립된다. 게스트 케이스는 docs/31의 locale 리셋 결함과 같은 뿌리다.
3. **StrictMode(dev 한정)**: #4·5·6이 2회 발생 — `cancelled` 플래그와 캐시 프로미스로 상태 오염은 없음.
4. **에러 무음**: #6 실패 시 "코스 없음" 빈 상태로 위장(HomePage.jsx:57-59), #4·5 실패 시 조용히 fallback(의도된 설계로 docs/30에 문서화). 사용자에게 실패가 보이는 것은 Kakao SDK 실패(폴백 화면)뿐.
5. **로딩 게이트 부재의 효과**: Provider가 렌더를 막지 않아 TTI가 빠른 대신, 첫 화면이 "빈 지도 + 로딩 시트 → 코스 등장" 순으로 단계적으로 채워진다. places 도착 전 NearbySheet는 `isLoading=placesLoading`으로 로딩 상태를 표시한다.

## 9. dev / prod 시작 차이 요약

| 항목 | dev (`npm run dev`) | prod (GitHub Pages) |
|---|---|---|
| base / basename | `/` / undefined | `/matgil/` / `/matgil` |
| 번들 | ESM 온디맨드 변환 | 해시 번들 (500kB 초과 chunk 경고 존재 — docs/29) |
| StrictMode 이중 이펙트 | 발생 (요청 2배) | 없음 |
| 딥링크 새로고침 | 정상 (Vite SPA 폴백) | **404** (404.html 부재) |
| env | 로컬 `.env` | GitHub Secrets → 빌드 인라인 |

## 10. 결론

시작 구조는 "동기 초기값 + 마운트 후 병렬 비동기"라는 일관된 패턴으로, 전역 로딩 게이트 없이 첫 페인트가 빠르게 나오는 건강한 형태다. 시작 경로에서 확인된 개선 후보는 모두 기존 감사(docs/31)와 연결된다: ① 게스트 locale 강제 리셋(이중 조회·언어 플립의 원인, LocaleProvider.jsx:38-42), ② getPlaces 실패 무음(HomePage.jsx:57-59), ③ prod 딥링크 404, ④ HomePage 재마운트마다 mg_places 전량 재조회(캐시 부재), ⑤ 레거시 Provider 2개의 전역 상주. 신규 카테고리 Provider는 fallback-first·locale 비의존 설계로 시작 경로에 부담을 주지 않는다.
