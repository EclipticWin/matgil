# Matgil Current Implementation Rules

- 작성 일시: 2026-07-12 16:15 KST
- 기준 코드: main @ 93d0dd6 (음식 카테고리 DB 연동 커밋 반영)
- 근거 문서: `docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`, `docs/32-AI-DOCS-INVENTORY-AND-STATUS.md`, `docs/33-APP-STARTUP-FLOW-ANALYSIS.md`, `ai-docs/24`, `ai-docs/19`, `ai-docs/10`, `ai-docs/SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE.md` + 현행 src/supabase/functions/배포 설정 직접 검독
- 이 문서는 **맛길 프로젝트에서 작업하는 모든 AI 에이전트(Claude Code, Codex, Fable 등)가 가장 먼저 읽는 공통 기준 문서**다.
- 기존 `ai-docs/01-implementation-rules.md`는 mock·위저드 세대(2026-06 초) 규칙이므로 **이 문서가 그것을 대체한다**. 01번은 작업 기록으로만 보존한다.

---

## 1. 빠른 시작 — 작업 전 반드시

1. `git status`와 현재 브랜치·HEAD를 확인한다. **기존 미커밋 변경은 절대 수정·되돌리기 하지 않는다.**
2. `docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`(전체 현황)와 `docs/33-APP-STARTUP-FLOW-ANALYSIS.md`(시작 구조)를 읽는다.
3. 작업할 기능의 **최신 작업일지**(`docs/` 번호 높은 순)를 읽는다. 예: 카테고리→docs/28~30, Phrases→docs/27, 저장 코스→docs/25.
4. 문서만 믿지 말고 **현재 실제 코드**(import·라우트·호출 경로)를 조사한다. 문서와 코드가 다르면 코드가 우선이다.
5. **Supabase SQL을 직접 실행하지 않는다.** DDL/DML/RLS/grant 전부 — SQL은 문서로만 작성하고 실행은 사용자가 한다.
6. 과거 `ai-docs` 문서를 현재 요구사항으로 사용하지 않는다. 문서별 유효성은 `docs/32` 분류표를 따른다.
7. 요청받은 기능 범위를 임의로 확대하지 않는다. 레거시 정리·리팩터링·디자인 변경은 별도 요청이 있을 때만 한다.
8. 사용자가 명시적으로 요청하지 않으면 `git add` / `git commit` / `git push`를 하지 않는다.
9. 파일이 존재한다는 이유만으로 활성 기능이라 판단하지 않는다(§8 레거시 목록 참조).
10. 맛길에 다른 프로젝트(개인 블로그, 회사 프로젝트)의 구조·컨벤션을 섞지 않는다.

이 10줄만 지켜도 이 프로젝트에서 가장 위험한 실수(사용자 작업 파괴, DB 임의 변경, 죽은 코드 부활, 무단 커밋)는 막을 수 있다.

## 2. 프로젝트 식별

| 항목 | 값 |
|---|---|
| 프로젝트명 | 맛길 (Matgil) |
| 성격 | 서울 방문 외국인을 위한 음식 동선 추천 React SPA |
| 프론트엔드 | Vite 5 + React 18 + **JavaScript** (react-router-dom 6, @supabase/supabase-js 2 — package.json) |
| 스타일 | Tailwind CSS 3 |
| 백엔드 | Supabase (Auth / PostgreSQL / Storage / Edge Functions) |
| 지도 | Kakao Maps JS SDK |
| 배포 | GitHub Pages (`.github/workflows/deploy.yml`, main push 시 자동 배포) |

- **프론트엔드는 TypeScript를 사용하지 않는다.** 새 파일도 `.jsx`/`.js`로 만든다. Supabase Edge Function(`supabase/functions/**`)만 TypeScript/Deno다.
- npm 스크립트는 `dev` / `build` / `preview` 3개뿐이다. 테스트·린트 스크립트는 없다(§17 참조).
- Vite 설정: `vite.config.js` — prod 빌드 시 `base: '/matgil/'`.
- 맛길은 이 프론트 저장소 + Supabase 프로젝트(백엔드)로 구성된다. 개인 블로그·회사 프로젝트와 완전히 별개이며, 그쪽 규칙·구조·코드를 가져오지 않는다.

## 3. 문서와 코드의 판단 우선순위

1. **현재 실제 코드와 git 상태**
2. `docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`
3. `docs/33-APP-STARTUP-FLOW-ANALYSIS.md`
4. 해당 기능의 최신 작업일지 (`docs/` 최신 번호)
5. 유효성이 검증된 최신 `ai-docs` (검증 결과는 `docs/32` 분류표)
6. 과거 `ai-docs` — **작업 기록으로만** 참고

### 단독 기준으로 사용 금지 문서 (docs/32에서 충돌 확인됨)

| 문서 | 이유 |
|---|---|
| ai-docs 00~02 (mock·위저드 세대) | "실연동 금지, mock 인증, 위저드 흐름, #fcbe32 색상" 등 폐기된 규칙 — 따르면 현행 역행 |
| ai-docs/09 (phrases TTS 과거 지시서) | "표현 DB 저장 금지, 북마크 금지" 조항이 현행(DB+북마크 구현 완료)과 정반대 |
| ai-docs/13 (TourAPI EN 보강) | 150m 최근접 매칭 규칙이 오매칭 원인으로 판명 — **반드시 ai-docs/19(운영 주의)와 함께 읽어야 하며, 19번의 금지 조항(150m 그대로 대량 재매칭 금지, en/source 대량 삭제 금지)이 우선한다** |
| ai-docs/15 (기계번역) | "translation_provider 저장" 지시가 실배포 함수에 미반영 — DB에 provider 기록이 있다고 가정하면 오판 |
| ai-docs/16 (검색 locale TODO) | "미구현/TODO" 표기가 허위 — SearchOverlay.jsx:149-154에 이미 구현 완료 |
| ai-docs/17 (Auth/Community MVP) | 제안 DDL(단일 posts 테이블)이 실제 스키마(4테이블+soft delete, docs/22)와 다름 — DB 절 재사용 금지 |

과거 문서에 "금지", "필수", "미구현"이라고 적혀 있어도 그것은 **작성 시점의 상태**다. 반드시 현재 코드와 docs/31·32로 재검증한 뒤 판단한다.

## 4. 현재 활성 사용자 흐름

### 활성 (실제 라우트·호출 경로 확인됨)

- **탭 5개** (BottomNavigation): Map(`/` HomePage), Courses(`/courses`), Phrases(`/phrases`), Community(`/community`), You(`/my` MyPage)
- **인증**: 로그인(`/login`), 회원가입(`/signup`), 로그아웃, 비밀번호 변경(MyPage 내)
- **Map 탭**: Kakao 지도, 지도 검색(SearchOverlay), GPS, 지역 프리셋 10곳(LocationSheet), 음식 카테고리 필터(FilterSheet, 다중 3개), 추천 코스 생성(courseBuilder, 최대 9개), 코스 상세(TodayCourseDetail), 장소 상세(PlaceDetailSheet), 코스 저장
- **저장 코스**: 목록(CoursesPage), 상세(`/saved-courses/:id`), 지도 재연결
- **Community**: 글·댓글(1-depth 대댓글)·좋아요·이미지(최대 3장), locale별 피드
- **Phrases**: DB 표현 조회, 인기 표현 탭, TTS(Web Speech), Voice help(음성 인식→mg-voice-help), 표현 북마크

### 레거시 (핵심 사용자 흐름 아님 — 새 기능의 기준으로 사용 금지)

`지역 선택 → 취향 선택 → 로딩 → 추천 결과` 위저드는 **레거시**다. 라우트(`/area`,`/preference`,`/loading`,`/result`)는 router.jsx에 남아 있으나 UI 진입 경로가 없는 고아 상태이며, `recommendationService.js`는 입력을 무시하는 가짜 MVP다. `/courses/:id`(mock 코스 상세), `/popular`, `/bookmark`도 동일한 고아 라우트다. 이들을 새 기능의 참조 구현이나 진입점으로 사용하지 않는다.

## 5. 앱 시작 구조

상세는 `docs/33-APP-STARTUP-FLOW-ANALYSIS.md`. 요약:

```text
index.html (#root + /src/main.jsx만 있는 최소 셸)
→ src/main.jsx (createRoot + StrictMode)
→ src/app/App.jsx (Providers → BrowserRouter(basename: prod '/matgil') → 모바일 프레임 셸)
→ src/app/providers.jsx (Provider 체인)
→ src/app/router.jsx (라우트 15개 정의, '/' → AppLayout → HomePage)
→ 현재 URL 페이지 렌더
```

**Provider 순서 (providers.jsx 실코드 기준):**

```
LocaleProvider > FoodCategoryProvider > AuthProvider > RecommendationProvider > BookmarkProvider
```

- `RecommendationProvider`·`BookmarkProvider`는 **레거시/미사용 확인 상태**(소비자가 고아 화면뿐):
  - 새 기능에서 자동으로 사용하지 않는다.
  - 사용하려면 실제 소비 컴포넌트와 호출 경로부터 조사한다.
  - **별도 레거시 정리 작업 전까지 임의 삭제하지 않는다** (providers.jsx에서 빼는 것도 정리 작업의 일부다).

**시작 시 데이터 로드 순서** (모두 첫 렌더를 막지 않는 마운트 후 비동기):
1. locale — localStorage에서 동기 초기화 후, Auth INITIAL_SESSION에서 user_metadata.preferred_locale로 덮어쓸 수 있음(게스트는 'en' 강제 리셋 — 알려진 결함, §14).
2. 음식 카테고리 — FoodCategoryProvider가 정적 fallback으로 즉시 동작하며 DB 2테이블을 병렬 조회(성공 시 교체). locale 비의존이라 언어 전환 시 재조회 없음.
3. 인증 — AuthProvider가 getSession()으로 세션 복원.
4. 장소 — HomePage 마운트 시 `getPlaces(locale)` 전량 조회. locale이 바뀌면 재조회(위 1의 덮어쓰기 시 이중 조회 발생 가능).

## 6. 음식 카테고리 현행 규칙 (2026-07-11 DB화 완료 — 스펙: ai-docs/24)

### DB 구조
- 테이블: `public.mg_food_categories`(key PK, icon_key, sort_order, is_active, is_filterable, soft delete 컬럼) + `public.mg_food_category_translations`((category_key, locale) PK, label, description). 클라이언트는 **SELECT만** 가능(RLS+grant).
- **카테고리 metadata와 번역은 DB 우선, DB 조회 실패 시 정적 fallback**(`src/features/explore/data/foodCategoryFallback.js`) — fallback은 장애 대응용으로 의도적으로 유지된다.
- `all`은 DB row가 아니라 **프론트 가상 옵션**(FilterSheet에서 주입, 라벨은 dictionary `filter.all`).
- 실제 category key는 **18개**(bbq, noodle, stew, seafood, chicken, street, cafe, rice, pork, chinese, japanese, western, pasta, pizza, burger, indian, southeast_asian, other).
- **label과 key를 구분한다**: DB·스냅샷·필터에는 key만 저장되고 label은 표시 시점에 해석된다. **기존 key rename 금지** — `mg_places.matgil_category_keys`·저장 코스 스냅샷과의 호환이 깨진다.

### 표시 정책
| 항목 | 값 |
|---|---|
| bbq KO label | **고기 구이** ("한국식 BBQ"는 폐기됨 — 코드에 다시 넣지 않는다) |
| bbq EN label | Korean BBQ |
| EN 코스 제목 | Korean BBQ Route |
| KO 코스 제목 | 고기 구이 동선 |

### 유지해야 하는 기존 구조 (임의 변경 금지)
- `mg_places.matgil_category_keys` text[] 유지 — **배열 순서에 의미가 있다**(첫 요소가 대표 카테고리, PlaceDetailSheet subtitle 등에서 사용).
- 기존 장소 데이터(1,633건), 기존 저장 코스 snapshot 임의 변경 금지.
- TourAPI 자동 분류 keyword는 아직 **Edge Function 코드에 하드코딩**(mg-tour-seed) — DB화는 후속 작업.
- 추천 점수의 `cafe` 보너스·`other` 감점 등 특수 규칙은 courseBuilder.js 코드에 있다 — DB화 대상 아님(현재).
- 관리자 CRUD 없음, 장소-카테고리 관계 테이블 없음 — 카테고리 데이터 변경은 사용자가 service role SQL로만 가능.

### 프론트 규칙
- 카테고리 접근은 반드시 `useFoodCategories()`(FoodCategoryProvider) 경유 — `getCategoryLabel(key, locale)`(폴백: locale→en→ko→key), `getCategoryIconKey(key)`, `filterCategories`. **정적 CATEGORIES 상수는 exploreOptions.js에서 삭제되었다** — 부활시키지 않는다.
- 코스 제목 생성은 공용 `getLocalizedCourseTitle`(`src/features/courses/utils/courseDisplay.js`) 단일 소스 — courseBuilder에 제목 템플릿을 다시 만들지 않는다.
- 저장 코스 중복 판정은 **순서가 동일한 `place_ids`** 기준(`savedCourseService.checkCourseAlreadySaved`) — 제목 문자열 비교로 되돌리지 않는다.
- 알 수 없는 category key는 화면을 깨뜨리지 않게 처리한다: 라벨은 key 문자열 폴백, 아이콘은 `default` 폴백(CategoryIcon).
- 아이콘은 DB `icon_key` ↔ 프론트 registry(CategoryIcon.jsx PATHS) 연결 방식 유지 — **SVG 경로나 외부 코드를 DB에 저장하는 구조로 만들지 않는다**.
- 알려진 엣지: DB 조회 성공+0행이면 fallback으로 전환되지 않는다 — 후속 개선 항목(§14)이며, 이를 전제로 한 코드를 새로 만들지 않는다.
- Community 카테고리(WRITE_CATEGORIES)·Phrases 카테고리(mg_phrase_categories)는 **별개 체계**다 — 음식 카테고리와 혼합하지 않는다.

## 7. Supabase 작업 규칙

- **AI 에이전트는 Supabase SQL을 직접 실행하지 않는다.** 테이블 생성·RLS·policy·grant·seed·update·delete 전부 해당된다.
- DB 변경 SQL은 **문서로만** 작성한다(선례: `docs/sql-food-categories-2026-07-11.md` — 실행 전 확인 / transaction / 실행 후 검증 / rollback 4단 구성). 실행은 사용자가 Supabase SQL Editor에서 직접 한다.
- DB 정보가 더 필요하면 **추측하지 않는다**. 사용자에게 읽기 전용 SQL을 제시하되 ① 왜 필요한지 ② 예상 결과 형태 ③ 결과에 따라 무엇이 달라지는지를 함께 설명한다. 추가 정보 없이 가능한 코드 조사·문서 작성은 기다리지 말고 먼저 진행한다.
- **service role key를 프론트에 노출하지 않는다.** Edge Function의 `Deno.env`에서만 사용한다.
- `VITE_` 환경변수는 **브라우저 공개 전제**다(현행 3종: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_KAKAO_MAP_JS_KEY). 비밀 키(LLM/TourAPI/service role)를 VITE_로 만들지 않는다.
- DB·RLS·grant의 **실제 상태를 코드만 보고 확정하지 않는다.** 장소 4테이블·mg_saved_courses의 RLS 정책 원문은 리포에 없다 — 실제 Supabase 확인이 필요한 내용은 반드시 `미확인`으로 기록한다(확인 SQL 모음: `docs/2026-07-11-MATGIL-REQUIRED-USER-INPUTS.md`).
- 기존 장소 데이터·저장 코스 snapshot·category 배열을 임의 수정하지 않는다.
- **Edge Function을 임의 배포하지 않는다.** 배포는 사용자 승인·실행 사항이다.
- 사용자가 승인하지 않은 데이터 재분류(matgil_category_keys 재산출 등)를 수행하지 않는다.

## 8. Git 작업 규칙

- 작업 시작 전 `git status` + 현재 브랜치·HEAD 확인.
- **기존 미커밋 변경 보호** — 사용자 작업을 discard / reset / checkout으로 되돌리지 않는다.
- 요청과 관련 없는 파일을 수정하지 않는다. 문서만 요청받았으면 코드 파일을 건드리지 않는다.
- `git add` / `git commit` / `git push`는 **사용자가 명시적으로 요청한 경우에만**. force push는 명시 요청된 특수 상황에서만. 기존 커밋 이력 임의 변경(amend/rebase 포함) 금지.
- 작업 완료 후 변경 파일 전체를 보고하고 `git diff --check`를 확인한다.

## 9. 코드 작업 규칙

- 현재 프로젝트 스타일 우선 — 주변 코드의 네이밍·주석 밀도·패턴을 따른다.
- 새 패키지 임의 설치 금지. 기능 범위 임의 확대 금지. 요청받지 않은 대규모 리팩터링·레거시 정리 금지.
- 새 파일을 만들기 전에 기존 공용 코드(shared/components, shared/hooks, features/*/services) 재사용 가능성을 먼저 조사한다.
- 계층 책임 구분: `src/api/`(DB 조회+정규화) / `features/*/services/`(기능별 Supabase 접근) / `context·Provider`(전역 상태) / 컴포넌트(표시). 컴포넌트에서 supabase를 직접 import하지 않는다(현행 유일 예외 VoiceHelpPlaceholder는 알려진 개선 대상이지 선례가 아니다).
- **오류를 무음으로 삼키지 않는다.** 빈 catch는 이 프로젝트의 알려진 부채(§14)다 — 새 코드에서 추가하지 않고, 에러 상태와 빈 상태를 구분한다.
- fallback을 쓸 때는 데이터 출처(source)와 오류 상태(error)를 구분해 보존한다(선례: FoodCategoryProvider). DB 조회 성공+0행 케이스도 별도로 검토한다.
- locale 변경 시 불필요한 네트워크 재요청이 생기지 않는지 확인한다(카테고리처럼 전 locale 일괄 로드 구조 선호).
- 저장 코스 snapshot을 읽는 코드는 **과거 데이터 호환**을 유지한다(신 필드는 추가만, 없으면 폴백).
- unknown key는 안전하게 처리하고, raw key가 사용자 화면에 노출되지 않는지 검토한다.
- 활성/레거시 판단은 **import·route·실제 호출 경로**로 한다. 파일 존재 = 활성이 아니다. 함수명·문서 설명만으로 실제 동작을 단정하지 않는다.
- 기존 기능을 이해하지 못한 상태에서 임의 삭제하지 않는다.
- 현재 Supabase 스키마(docs/22, docs/sql-* 문서, ai-docs/24)와 과거 제안 DDL(ai-docs/03·17)을 혼동하지 않는다.

## 10. 다국어 규칙

- 공식 UI locale은 **EN / KO** 2개.
- UI 문구는 `src/shared/i18n/dictionary.js` 기반 — `t(key)` 사용, EN/KO 키 대칭 유지. **컴포넌트에 한국어·영어 문자열을 새로 하드코딩하지 않는다.**
- 장소 데이터(mg_place_texts locale 행)·음식 카테고리(mg_food_category_translations)는 DB 번역을 활용한다.
- locale fallback 순서를 명확히 확인한다: 카테고리 라벨 = 요청 locale→en→ko→key, 장소 텍스트 = 요청 locale→반대 locale.
- **새 locale 추가를 막는 `labelEn`/`labelKo`/`labelJa` 식 컬럼·필드 구조를 새로 만들지 않는다.** DB 번역은 `(대상 key, locale)` 행 구조를 선호한다(mg_food_category_translations, mg_place_texts가 선례). 기존 label/labelKo 배열(locations.js 등)은 잔존 부채이지 확장할 패턴이 아니다.
- UI 라벨 번역(dictionary)과 DB 원본 데이터의 폴백을 구분한다 — 예: Phrases의 en_text는 의미 데이터이지 UI 번역이 아니다.
- 알려진 한계(전제로 삼되 임의 수정하지 않음): ① 게스트 locale이 새로고침 시 EN으로 리셋(LocaleProvider.jsx:38-42), ② 저장 코스 snapshot의 다국어 한계(KO 저장분에 EN 이름 부재).
- locale 변경 시 어떤 데이터가 재조회되는지 확인한다 — 장소·커뮤니티는 재조회, **카테고리는 전 locale 일괄 로드라 재조회 불필요**.

## 11. 디자인 규칙

- **모바일 우선.** `max-w-app`(22.5rem) 중앙 모바일 프레임 구조를 유지한다(App.jsx). 데스크톱은 좌측 DesktopIntroPanel 추가뿐 — 별도 데스크톱 레이아웃을 만들지 않는다.
- 기존 **coral / ink / paper / stone** 계열 디자인 토큰(tailwind.config.js)을 유지한다.
- 과거 `#fcbe32` 강제 규칙(ai-docs/01)은 **현재 기준이 아니다** — 사용하지 않는다.
- 파란색·보라색 등 새로운 색을 임의로 주요 브랜드 색상으로 추가하지 않는다.
- 요청 없이 기존 화면을 전면 재디자인하지 않는다. 요청 없는 애니메이션·색상 변경 금지.
- **입력·textarea focus에 red/coral 테두리나 강한 ring을 사용하지 않는다.** focus는 차분한 gray/stone 계열 — 예: `focus:border-stone-400`, 약한 stone ring. (참고: 기존 LoginForm의 `focus:border-coral`은 기존 코드 잔존이며, 새 입력 UI의 기준은 stone 계열이다.)
- 기존 spacing·radius·typography·shadow 스케일을 유지하고 기존 공용 컴포넌트(Button, Modal, Thumbnail 등)를 재사용한다.
- 작은 화면 overflow를 확인하고, bottom sheet·modal·fixed UI는 모바일 실제 폭에서 확인한다.

## 12. 레거시 처리 규칙

활성/레거시 판단은 router import와 실제 진입 경로, 컴포넌트 import와 호출 경로로 한다. 현행 레거시 목록(docs/31 §8 근거):

| 레거시 | 규칙 |
|---|---|
| 위저드 4라우트(/area,/preference,/loading,/result) + AreaSelector·PreferenceSelector·mockAreas·preferenceOptions | 현재 핵심 흐름 아님 — 새 기능 기준으로 사용 금지 |
| `recommendationService.js`, `mockRecommendations.js` | 현재 추천 기준 아님(추천은 courseBuilder.js) |
| `mockPopularPlaces.js`, `/popular`, `/bookmark`, PopularPlaceCard, useBookmarks | 현재 사용자 데이터 기준 아님 |
| `courses/data/courses.js`, `/courses/:id`(CourseDetailPage) | 현재 저장 코스 구조의 기준 아님(기준은 mg_saved_courses + savedCourseService) |
| `mockAuthService.js`, `PostCommentSection.jsx` | 완전 데드 파일 |
| `COMMUNITY_POSTS`(communityPosts.js) | mock 폴백 잔존 — 참조 데이터로 사용 금지 |
| RecommendationProvider, BookmarkProvider | 죽은 Provider — §5 규칙 적용 |

- 고아 라우트와 죽은 Provider는 **별도 레거시 정리 작업에서만** 제거한다. 기능 구현 중 겸사겸사 지우지 않는다.
- 기능 구현 중 레거시 파일을 새 구조에 억지로 연결하지 않는다. 과거 문서를 근거로 죽은 기능을 되살리지 않는다.
- 레거시를 제거할 때는 라우트·링크·import·저장 데이터 호환성(localStorage 포함)을 함께 확인한다.
- Community / Phrases / 음식 카테고리는 서로 다른 category 체계다 — 혼합 금지.

## 13. 보안 규칙

- service role key 브라우저 노출 금지. Edge Function secret을 로그로 출력하지 않는다.
- 관리자 token(ADMIN_SEED_TOKEN)을 코드·문서에 하드코딩하지 않는다.
- **RLS를 프론트 검증으로 대체하지 않는다.** 프론트의 `.eq('user_id', ...)` 필터는 방어적 추가 조치일 뿐 권한 통제가 아니다.
- 인증되지 않은 LLM 호출의 비용 위험을 고려한다(현행 mg-voice-help가 무인증 상태 — 알려진 High 이슈, 같은 패턴을 새로 만들지 않는다).
- 사용자 입력값과 작성자 표시값(author_name 등)을 무조건 신뢰하지 않는다.
- Storage public URL(읽기)과 쓰기 정책을 구분한다(community-post-images는 public 버킷 + 본인 폴더 INSERT만).
- 공개 anon key는 secret이 아니지만, **실제 권한은 RLS와 grant가 통제**한다 — 그 실태를 확인하지 못했으면 "안전하다"고 쓰지 않는다.
- 보안 문제를 실제 코드·정책 근거 없이 과장하지 않는다. 실제 Supabase 설정을 확인하지 못한 내용은 `미확인`으로 기록한다.
- Edge Function의 `verify_jwt` 상태는 배포 설정 확인 전에 단정하지 않는다(`supabase/config.toml` 미버전관리 상태).
- 환경변수의 실제 값을 문서나 보고서에 출력하지 않는다.

## 14. 현재 미해결 사항 (규칙이 아니라 후속 조사·개선 후보)

아래는 **알려진 이슈 목록**이다. 새 작업의 전제로 인지하되, 요청 없이 겸사겸사 수정하지 않는다. 상세·근거는 docs/31 §6과 `docs/2026-07-11-MATGIL-OPEN-ISSUES.md`.

- [High] mg-voice-help 인증 부재 — LLM 비용 통제 필요
- [High] 장소 4테이블·mg_saved_courses의 RLS 실제 상태 미확인 (확인 SQL: REQUIRED-USER-INPUTS A/B)
- [High] Community mock 무음 fallback (CommunityPage.jsx:64-67)
- [High] GitHub Pages 딥링크 404 (404.html 부재)
- [High] 관리자 기반(역할 모델·admin RLS·라우트 가드) 부재
- [High] 테스트·lint·CI 게이트 부재 (main push = 즉시 배포)
- [Med] 게스트 locale 새로고침 리셋 (LocaleProvider.jsx:38-42, 시작 시 이중 조회 유발)
- [Low] DB 카테고리 조회 성공+0행 시 fallback 미전환
- [Med] 레거시 라우트 7개·죽은 Provider 2개·mock/dead 파일
- [Med] 저장 코스 snapshot의 다국어 한계 (KO 저장분 EN 표시 불가)
- [Med] 일부 무음 catch (에러↔빈 상태 미구분)
- [미확인] Edge Function 4종의 verify_jwt 실제 설정

## 15. 테스트와 검증 규칙

기능 작업 후 최소 검증:

1. `npm run build` — **warning과 failure를 구분**한다(기존 CSS 구문 경고 1건·500kB chunk 경고는 알려진 상태).
2. 변경 관련 문자열 grep(제거했어야 할 상수·문구 잔존 확인) + import 오류 확인.
3. 활성 코드와 레거시 코드를 혼동하지 않았는지 확인(§12 목록 대조).
4. EN/KO 양쪽 화면, 로그인/비로그인 양쪽 상태 확인.
5. 모바일 폭 화면과 작은 화면 overflow 확인.
6. DB 미적용·DB 실패 시 fallback 동작 확인(해당 기능에 fallback이 있는 경우).
7. Network 탭에서 요청 수와 HTTP 상태 확인(불필요한 중복 요청·4xx 확인), 브라우저 Console 오류 확인.
8. 기존 저장 데이터 호환성(구 snapshot 표시), 저장 코스 중복 판정, 카테고리 label fallback — 관련 기능을 건드렸다면 필수.
9. Supabase SQL이 필요한 검증은 **사용자가 실행한 결과를 전달받아** 확인한다.
10. **테스트하지 못한 항목을 "테스트 완료"라고 쓰지 않는다.** 수동 테스트가 필요한 항목은 별도 목록으로 보고한다.

## 16. 작업 완료 보고 형식

작업 완료 후 다음 형식으로 보고한다:

1. 작업 요약
2. 조사한 파일
3. 새로 만든 파일
4. 수정한 파일별 변경 내용
5. DB 작업 여부 (**SQL을 직접 실행하지 않았다는 확인 포함**)
6. 사용자가 직접 실행해야 할 SQL (있는 경우 — 실행 전 확인/본문/검증/rollback 구분)
7. 빌드 결과 (warning/failure 구분)
8. 수행한 자동 검증
9. 사용자가 확인해야 할 수동 테스트
10. 남은 위험
11. 범위에서 제외한 항목
12. git add / commit / push 수행 여부 (**관련 없는 파일을 수정하지 않았다는 확인 포함**)
13. 사용자가 다음에 해야 할 일

---

## 부록: 이 문서의 위치

- 이 문서가 커버하지 않는 세부는 우선순위(§3)에 따라 docs/31 → docs/33 → 기능별 최신 작업일지 순으로 찾는다.
- ai-docs 개별 문서의 유효성 판단은 `docs/32-AI-DOCS-INVENTORY-AND-STATUS.md`의 분류표(A~F)를 따른다.
- 이 문서 자체가 코드와 어긋나게 되면(후속 구현으로 구조가 바뀌면), 코드를 우선하고 이 문서의 갱신을 사용자에게 제안한다.
