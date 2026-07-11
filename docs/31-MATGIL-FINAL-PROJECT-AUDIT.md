# Matgil Final Project Audit

- 작성 일시: 2026-07-12 00:57 KST (로컬 `date` 명령으로 확인)
- 기준 코드: main 브랜치 292c95c + 미커밋 작업 트리(음식 카테고리 DB화 프론트 통합 — 수정 10파일, 신규 3파일)
- 선행 문서: `2026-07-11-MATGIL-PROJECT-AUDIT.md`(전체 감사), `2026-07-11-MATGIL-OPEN-ISSUES.md`(이슈 38건), PLAN 5종, `28~30` 음식 카테고리 작업 기록
- 이 문서는 선행 감사 이후의 변경(음식 카테고리 DB화)을 반영한 **최종 갱신판**이다. 선행 문서는 작업 기록으로 보존하며 덮어쓰지 않았다.
- 이 감사는 분석·문서 작성만 수행했다. 코드/DB/배포/git 이력을 변경하지 않았다.

---

## 1. 전체 요약

Matgil은 서울 방문 외국인을 위한 음식 동선 추천 SPA다(Vite + React + Tailwind, Supabase 백엔드, GitHub Pages 배포). 실제 제공 중인 기능과 완성도:

| 기능 | 완성도 |
|---|---|
| Kakao 지도 + GPS/검색/프리셋 기반 추천 코스(3곳 조합 스코어링) | 완료 |
| 코스/장소 상세, 코스 저장(스냅샷)·목록·지도 재연결 | 완료 — 이번에 중복 판정 결함 해소 |
| 음식 카테고리 필터(18종 + all) | 완료 — **이번에 DB 우선 + 정적 fallback 구조로 전환** |
| 이메일 로그인/가입/비밀번호 변경, MyPage | 완료 (비로그인 비밀번호 재설정은 미구현) |
| Community 글/댓글/좋아요/이미지 | 완료 (mock 무음 폴백 결함 잔존, 모더레이션 부재) |
| Phrases DB 조회/TTS/Voice help/북마크/인기 탭 | 완료 |
| EN/KO 전환 | 완료 (게스트 새로고침 리셋 결함 잔존) |
| TourAPI 수집·EN 보강·LLM 번역 파이프라인 | 완료 (관리자 토큰 curl 방식) |
| 관리자 화면, 테스트/CI 게이트 | 없음 |

초기 기획(ai-docs/00~02 세대)의 지역/취향 위저드 추천은 Map 탭의 courseBuilder로 대체되었으나, 위저드 라우트 4개와 mock 파일이 코드에 잔존한다(레거시 — §8).

**이번 사이클의 핵심 변화**: 음식 카테고리 메타데이터와 EN/KO 번역이 `mg_food_categories` / `mg_food_category_translations` 테이블로 이관되었고(사용자가 SQL 직접 실행·검증 완료 보고), 장애 대응용 정적 fallback이 의도적으로 유지되었다. 코스 제목 생성이 단일 함수로 통합되고, 저장 중복 판정이 place_ids 기준으로 교체되었으며, KO 표기 정책("한국식 BBQ" → "고기 구이")이 활성 코드 전체에 반영되었다.

## 2. 아키텍처

### 프론트엔드
```
index.html → src/main.jsx → src/app/App.jsx (BrowserRouter, prod basename=/matgil)
  providers.jsx: LocaleProvider > FoodCategoryProvider(신규) > AuthProvider
                 > RecommendationProvider(레거시) > BookmarkProvider(레거시)
  router.jsx: 라우트 15개 (실사용 8, 고아 7)
```
- 데이터 접근: `src/lib/supabase.js` 단일 클라이언트 → `src/api/placeApi.js`, `src/api/foodCategoryApi.js`(신규), feature별 service(community/savedCourse/phrase/phraseBookmark).
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KAKAO_MAP_JS_KEY` — 전부 번들 공개 전제(적절). 비밀 키의 프론트 노출 없음.
- 배포: `.github/workflows/deploy.yml` — main 푸시 → build → Pages. lint/test 단계 없음.

### Supabase
- 프론트 사용 테이블 13개: 장소 4(mg_places/texts/food_details/images — SELECT), 커뮤니티 4(CRUD), mg_saved_courses, phrases 3, **음식 카테고리 2(신규 — SELECT 전용)**.
- Edge Function 4개: mg-tour-seed / mg-tour-en-enrich / mg-place-translate-en(이상 3개 `x-admin-seed-token` 검증 + service_role), **mg-voice-help(자체 인증 없음 — 잔존 이슈)**. LLM(OpenAI gpt-4o-mini)은 mg-voice-help(실시간)와 mg-place-translate-en(배치, dryRun 기본)에서 활성.
- Auth: 이메일 로그인, user_metadata에 display_name/preferred_locale. app_metadata·역할 모델 없음.
- Storage: community-post-images 버킷 1개(public). soft delete 정책상 이미지 실삭제 없음.
- RLS: 커뮤니티/표현/신규 카테고리 테이블은 정책 SQL이 리포에 존재. **장소 4테이블·mg_saved_courses는 정책 원문이 여전히 리포에 없음(실제 확인 필요 — 선행 감사와 동일)**.
- 스냅샷: mg_saved_courses.stops/course_snapshot(jsonb) — 저장 시점 고정, 원본 변경 미반영(설계 의도).

## 3. 실제 사용자 흐름

- **비로그인**: 지도 탐색·필터·추천 코스·장소 상세·Phrases 열람 가능. 저장/북마크/커뮤니티 작성/Voice help 결과 저장은 로그인 유도. **결함: 언어를 KO로 바꿔도 새로고침 시 EN으로 리셋**(LocaleProvider.jsx:38-42).
- **로그인**: 코스 저장(중복 차단 — 이번에 place_ids 기준으로 정확해짐), 커뮤니티 CRUD, 표현 북마크, MyPage(닉네임/비밀번호 변경, 활동 통계, 내 글 관리).
- **지도 탐색**: 프리셋 10곳/GPS/검색(SearchOverlay, 서울 한정) → getPlaces 전량 조회 → courseBuilder가 반경 티어(2km→4km→전체)·근접 20곳·3곳 조합 스코어링으로 최대 9개 코스 생성 → NearbySheet 점진 표시.
- **필터**: FilterSheet가 **FoodCategoryProvider의 DB 카테고리**(sort_order 정렬, is_active·is_filterable·미삭제만)를 렌더. 'all'은 프론트 가상 옵션(dictionary `filter.all`). 다중 3개 제한 유지.
- **저장 코스**: 목록/상세/지도 재연결. 표시 시점에 제목·정류지명 재지역화(공용 getLocalizedCourseTitle). KO 저장분의 EN 표시 한계(스냅샷에 EN 이름 부재)는 잔존.
- **Community**: locale 분리 피드. **결함: DB 0건/실패 시 가짜 글 4개가 실데이터처럼 표시**(CommunityPage.jsx:64-67 — 이번 사이클에서 미변경 확인).
- **Phrases**: DB 카테고리/표현, Web Speech TTS, Voice help(음성 인식 → mg-voice-help LLM 분석), 북마크·인기 탭.

## 4. 음식 카테고리 최종 구조

### 4.1 전환 전 → 후

| 항목 | 전환 전 (2026-07-11 감사 시점) | 전환 후 (현재) |
|---|---|---|
| 키·라벨 정의 | exploreOptions.js CATEGORIES 19종 하드코딩 | **DB 2테이블 + 정적 fallback 18종** (all은 프론트 가상) |
| 라벨 소비 | 컴포넌트별 `locale==='ko'?labelKo:label` 삼항 | `getCategoryLabel(key, locale)` 단일 헬퍼 (locale→en→ko→key 폴백) |
| 아이콘 | 키=아이콘 1:1 하드코딩 | DB `icon_key` → CategoryIcon registry, 미등록은 `default` 아이콘 |
| 코스 제목 템플릿 | courseBuilder/courseDisplay 이중 + dictionary dead keys | **courseDisplay.js 단일 소스** (getLocalizedCourseTitle) |
| bbq KO 표기 | "한국식 BBQ" | **"고기 구이"** — src 전체 grep 0건 확인 |
| 저장 중복 판정 | title 문자열 | **순서 동일 place_ids** (savedCourseService.js:77-97) |

### 4.2 DB 상태 (사용자 실행·검증 보고 기준, 2026-07-12)

`docs/sql-food-categories-2026-07-11.md`의 transaction이 실제 적용되었고 다음이 검증되었다:
- `mg_food_categories` 18행 / `mg_food_category_translations` 36행(en 18, ko 18)
- 실사용 `matgil_category_keys` 중 카테고리 테이블 누락 key 0건
- `bbq/ko` = "고기 구이", `other/en` = "Other"
- 두 테이블 RLS 활성, anon/authenticated **SELECT 정책·권한만** 존재(`using (true)` — 비활성/삭제 행도 조회 가능해 과거 스냅샷 라벨 해석 보장, 의도된 설계)
- 프론트 REST 200 + DB 라벨 변경의 화면 반영 확인
- 스키마: key PK(`^[a-z0-9_]+$` check), icon_key, sort_order, is_active, is_filterable, soft delete 컬럼, set_updated_at 트리거. 번역은 (category_key, locale) PK, FK on delete restrict.

기존 데이터 무변경 확인: mg_places.matgil_category_keys, 장소 1,633건, 배열 순서, GIN 인덱스, mg-tour-seed 분류 규칙, 저장 코스 snapshot.

### 4.3 프론트 구현 검토 (신규 3파일 직접 검독)

- `src/api/foodCategoryApi.js` — 두 테이블 병렬 select(*) → key별 translations 맵으로 정규화. 에러 시 throw.
- `src/features/explore/data/foodCategoryFallback.js` — DB seed와 동일 18종(bbq KO "고기 구이" 포함) 정적 데이터.
- `src/features/explore/context/FoodCategoryProvider.jsx` —
  - 마운트 1회 로드, 성공 시 `source='db'`, 실패 시 fallback 복귀 + `error` 보존 + `source='fallback'`. `reload()` 노출.
  - **locale 비의존 로드**: 전 locale 번역을 한 번에 받으므로 언어 전환 시 재조회 없음(양호).
  - `filterCategories`: is_active && is_filterable && deleted_at null, sort_order 정렬.
  - `getCategoryLabel`: 요청 locale → en → ko → key 폴백. `categoryMap`은 비활성 포함 전체라 **비활성 카테고리의 과거 스냅샷 key도 라벨 해석 가능**(설계 의도 충족).
  - Provider 위치: LocaleProvider 바로 안쪽(providers.jsx) — Auth 비의존이라 적절.
- 소비처: FilterSheet(가상 all + DB 카테고리), PlaceDetailSheet(대표 카테고리·칩 — 미지 key는 raw 표시), CategoryIcon(default 폴백).
- 네트워크: 앱 로드당 요청 2건(병렬) 1회 — 중복 없음.

### 4.4 정확한 해석과 남은 하드코딩

**"음식 카테고리 metadata와 번역은 DB 우선 구조로 전환됐으며, 장애 대응을 위한 정적 fallback이 의도적으로 유지되어 있다."** 하드코딩이 완전히 사라진 것은 아니다:

아직 코드에 남은 것(후속 과제):
- TourAPI 자동 분류 키워드 맵 — mg-tour-seed/index.ts:175-205 (17종, 함수 재배포 필요)
- 추천 스코어링의 특수 키 규칙 — courseBuilder.js (cafe 보너스, other 감점)
- 코스 제목 유형 판정(street/bbq/noodle 분기) — courseDisplay.js detectTitleType
- 장소별 category 배열 자체(mg_places.matgil_category_keys) — 관계 테이블(mg_place_food_categories류) 미도입
- 관리자 카테고리 CRUD — 쓰기 권한이 전부 revoke되어 현재 관리 수단은 service role SQL뿐 (PLAN-admin-foundation의 is_admin() 정책이 선행 조건)
- 아이콘 SVG registry — 프론트 코드(신규 icon_key는 default로 안전 강하)

### 4.5 신규 구조에서 발견한 엣지 케이스 (신규 발견)

1. **[Low] DB 조회 성공 + 0행 반환 시 fallback 미전환** — FoodCategoryProvider.jsx:16-19: 빈 배열도 `source='db'`로 채택 → filterCategories가 비어 필터에 'all'만 남는다. 테이블을 비우는 운영 실수 시 정적 fallback이 작동하지 않는다(에러일 때만 fallback). 현재 18행이 있어 잠복 상태.
2. **[Info] 일부 번역 누락 시** — en→ko→key 폴백으로 안전 강하(코드 확인). 결함 아님.
3. **[Info] exploreOptions.js 파일 헤더 주석이 삭제된 CATEGORIES를 여전히 설명** — 코드와 주석 불일치(1-3행).
4. **[Info] PlaceDetailSheet 칩의 미지 key는 raw key 문자열 노출**(PlaceDetailSheet.jsx:174-177) — 종전 동작과 동일하나 카테고리 삭제 운영 시 노출 가능.

## 5. 완료된 항목 (선행 OPEN-ISSUES 대비)

| 이슈 | 상태 | 근거 |
|---|---|---|
| ISSUE-15 저장 중복 판정 제목 기준 | **해결** | checkCourseAlreadySaved가 순서 동일 place_ids 비교로 교체(savedCourseService.js:83-97), 호출부 NearbySheet.jsx:118 일치. locale 전환 중복 저장 경로 소멸 |
| ISSUE-26 "한국식 BBQ" 정책 미반영 | **해결** | src 전체 grep 0건. courseDisplay.js:25 "고기 구이 동선", fallback/DB seed "고기 구이". EN "Korean BBQ"/"Korean BBQ Route" 유지 |
| ISSUE-27 제목 템플릿 3중 복제 | **해결** | courseBuilder의 KO_TITLES/EN_TITLES/makeTitle 삭제 → getLocalizedCourseTitle 단일 사용. dictionary courseTitle.* dead keys 삭제(EN/KO 대칭 유지, filter.all 추가) |
| ISSUE-25 카테고리 하드코딩 분산 | **부분 해결** | metadata·번역·아이콘 키·정렬·활성화는 DB화. 분류 키워드·스코어링 특수 규칙·제목 유형 판정·관리자 CRUD는 잔존(§4.4) |
| ISSUE-28 라벨 픽커 삼항 산재 | **부분 해결** | FilterSheet:108, PlaceDetailSheet 카테고리 라벨, courseBuilder 삼항 제거(카테고리 계열만). 나머지 label/labelKo 소스(locations/community/phrases fallback)와 삼항은 잔존 |
| ISSUE-02 RLS 원문 부재 | **부분 해결** | 신규 카테고리 2테이블은 정책 SQL 리포 보존 + 사용자 검증. 장소 4테이블·mg_saved_courses는 여전히 미확인 |
| (PLAN-food-category-management) | **핵심 범위 이행** | 관계 테이블·키워드 DB화·재분류 모드는 계획 문서의 후속 범위로 미착수 |

선행 PLAN 대비: PLAN-food-category-management의 1·2단계(테이블+시드, 프론트 전환)와 PLAN-i18n-consolidation의 일부(중복 판정 통일, 제목 단일화)가 이행되었다. 설계 차이: 계획의 단일 `mg_categories(keywords 포함)` 대신 **카테고리/번역 2테이블 분리 + 키워드 미포함**으로 구현 — 다국어 확장에 더 유리한 구조이며, 키워드 DB화는 미이행 상태로 남는다.

## 6. 남은 문제 (심각도순)

Critical: 없음 (단, RLS 미확인 항목이 "미활성"으로 판명되면 승격).

### High
1. **mg-voice-help 무인증 LLM 비용 소진** — 잔존, 미변경(supabase/functions/mg-voice-help/index.ts:110-137). 즉시 처리 권장. [지금 당장]
2. **장소 4테이블·mg_saved_courses RLS 실태 미확인** — 잔존. REQUIRED-USER-INPUTS A/B 실행이 유일한 확정 수단. [지금 당장 — 확인]
3. **커뮤니티 mock 무음 폴백** — 잔존(CommunityPage.jsx:64-67 재확인). 가짜 데이터 위장 + 상호작용 무음 실패. [지금 당장]
4. **GitHub Pages SPA 딥링크 404** — 잔존(404.html·public/ 부재 재확인). [지금 당장 — 저비용]
5. **카운트 컬럼 클라이언트 UPDATE 가능성**(Popular 순위 조작) — 잔존, 확인 필요. [단기]
6. **관리자 기반 전무** — 잔존. 신규 카테고리 테이블도 쓰기 경로가 service role SQL뿐이라 이 기반 없이는 카테고리 운영이 수동 SQL에 머문다. [단기]
7. **테스트·린트·CI 게이트 전무** — 잔존. main 푸시 = 즉시 배포. [단기]

### Medium
- author_name 위조 가능(communityService.js:83), updatePost user_id 필터 부재, 로그아웃 시 matgil.bookmarks 미정리, ADMIN_SEED_TOKEN 공유 시크릿 — 전부 잔존 (PLAN-auth-edge-security 범위).
- 게스트 locale 새로고침 리셋(LocaleProvider.jsx:38-42) — 잔존.
- getPlaces 실패의 빈 상태 위장(HomePage.jsx:57-59) + 삼켜진 catch 다수 — 잔존.
- 저장 코스 KO 저장→EN 표시 한국어 잔존(스냅샷 EN 이름 부재, courseDisplay.js:70-74) — 잔존. 제목은 이번 통합으로 일관화됐으나 정류지명·주소·anchor_label(검색 유래)은 미해결.
- 비밀번호 재설정 부재, 신고/모더레이션 부재, 페이지네이션 부재, mg_phrases 다국어 구조 한계 — 잔존.
- 고아 라우트 7개·데드 파일 4개·죽은 Provider 2개(providers.jsx에 Recommendation/Bookmark 여전히 등록 — 재확인) — 잔존.

### Low
- PlaceDetailSheet '가능' KO 하드코딩(64-65행 — 재확인 잔존), SignUpPage EN 검증문, VoiceHelp EN 에러문, TTS DEBUG 로그 9곳(재확인 잔존), PRICES/FEATURES 잠복 버그(exploreOptions에 데이터·필터 로직 잔존), translation_provider 미기록, Storage 고아 이미지, Kakao 키 도메인 제한 미확인, config.toml 미버전관리.
- **[신규] DB 성공+0행 시 fallback 미전환**(§4.5-1).

### Informational
- exploreOptions.js 주석 stale(§4.5-3), 미지 카테고리 key raw 노출(§4.5-4), FoodCategoryProvider의 error가 UI에 미표시(fallback 무음 전환 — **의도된 설계**로 docs/30에 문서화됨).

## 7. 보안과 데이터 보호

- **양호(재확인)**: 하드코딩 키 없음, .env/dist 미커밋, service_role은 Edge Function Deno.env 전용, 신규 카테고리 테이블은 SELECT-only grant + revoke 명시(sql 문서 70-71행) — 선행 감사의 grant 이슈(테이블 단위 전체 허용)를 반복하지 않은 개선된 패턴.
- **잔존 위험**: mg-voice-help 무인증(비용), 커뮤니티 카운트/author_name 클라이언트 조작 여지(확인 필요), 장소·저장코스 RLS 미확인, 로그아웃 시 localStorage 잔존, ADMIN_SEED_TOKEN 단일 토큰.
- 삭제 정책: 커뮤니티·저장코스 soft delete 일관, Storage 실삭제 금지(의도) — 고아 파일 장기 누적.
- 브라우저 노출 정보: VITE_ 3종(모두 공개 전제 키), anon key로 가능한 동작은 RLS 실태 확인 전까지 확정 불가.

## 8. 코드 품질

- **개선됨**: 제목 생성 단일화(courseBuilder→courseDisplay 재사용), 중복 판정 로직 공용화(getCoursePlaceIds), 카테고리 라벨 해석 단일 헬퍼, checkCourseAlreadySaved가 에러를 삼키지 않고 throw로 변경.
- **잔존**: 삼켜진 catch 9곳, label/labelKo 배열 5파일 + locale 삼항(카테고리 계열 제거로 감소), AUTH_ERROR_KO 중복, fetchMyPosts/fetchMyLikedPosts 유사 중복, getPlaces 전량 조회 3곳, VoiceHelp 직접 invoke, 레거시 위저드 체인.
- 테스트 가능성: 테스트 0, 린트 설정 없음. FoodCategoryProvider·courseDisplay는 순수 로직 비중이 높아 단위 테스트 도입 시 좋은 시작점.
- 빌드: `npm run build` 성공(docs/29 — Vite 5.4.21, 174모듈). 기존 CSS 구문 경고 1건 + 500kB 초과 chunk 경고 잔존(실패 아님).

## 9. 배포 준비 상태

- 빌드 성공 확인됨(docs/29). GitHub Pages 파이프라인·Secrets 구조 무변경.
- **배포 전 확인 필요**: ① 실배포 URL 딥링크 새로고침 404 여부, ② mg-voice-help verify_jwt·호출량(비용), ③ 장소/저장코스 RLS(REQUIRED-USER-INPUTS A/B), ④ 현재 미커밋 상태 — 카테고리 통합 코드가 커밋·푸시되어야 배포 반영됨(DB는 이미 적용 상태이므로 **프론트 미배포 동안에도 구버전은 fallback 정적 데이터로 정상 동작** — 하위 호환 확인됨).
- **배포 전에 막아야 할 문제**: mock 커뮤니티 폴백(가짜 데이터 노출)과 mg-voice-help 무인증은 공개 트래픽 증가 전 처리 권장.

## 10. 권장 로드맵

1. **즉시 처리**: RLS 실태 확인 SQL 실행(사용자), mg-voice-help 인증+제한, 커뮤니티 mock 폴백 제거, 404.html, 게스트 locale 유지. (PLAN-auth-edge-security + PLAN-user-facing-reliability)
2. **단기 개선**: 컬럼 grant 축소·author_name 강제, 삼켜진 catch 정리, 레거시 라우트/데드 파일/죽은 Provider 정리, CI 게이트(lint+build), TTS 로그 제거, DB 0행 fallback 엣지 보강.
3. **관리자 기능 단계**: is_admin() 역할 모델 → 카테고리 2테이블에 admin 쓰기 정책 추가 → /admin 카테고리 CRUD → 커뮤니티 모더레이션. (PLAN-admin-foundation — 신규 카테고리 테이블이 첫 수혜자)
4. **자동 분류 고도화**: mg-tour-seed 키워드 맵의 DB 이관(카테고리 테이블에 keywords 컬럼 또는 별도 테이블) + reclassify 모드 + dryRun, 장소-카테고리 관계 테이블 검토.
5. **장기 확장**: 저장 코스 스냅샷 양언어 보존, 제3언어(번역 테이블 구조는 이미 locale 행 기반이라 유리), 페이지네이션, mg_phrases 다국어 재설계, Storage 정리 배치.

## 11. 확인하지 못한 부분 (실제 Supabase/외부 확인 필요)

- 장소 4테이블·mg_saved_courses·mg_place_sources·mg_api_fetch_logs의 RLS 정책/grant 실태 (REQUIRED-USER-INPUTS A/B/C/K)
- Edge Function 4종의 verify_jwt 설정과 mg-voice-help 호출량 (동 F)
- 커뮤니티 카운트 컬럼 grant·무결성 (동 C/D)
- GitHub Pages 실배포 딥링크 404 재현, Kakao 키 도메인 제한, Auth 이메일 확인 설정 (동 N)
- 음식 카테고리 2테이블은 사용자 검증 보고(18/36행, RLS, SELECT-only, REST 200)를 근거로 채택했다 — 본 감사에서 SQL을 직접 실행해 재검증하지는 않았다.

---

### 부록: 이번 사이클 변경 파일 대조 (미커밋 작업 트리)

신규: src/api/foodCategoryApi.js, src/features/explore/data/foodCategoryFallback.js, src/features/explore/context/FoodCategoryProvider.jsx, docs/29·30, docs/sql-food-categories-2026-07-11.md, ai-docs/24(커밋본 2026-07-11-food-category-…md의 개명)
수정: providers.jsx(+FoodCategoryProvider), exploreOptions.js(−CATEGORIES), FilterSheet.jsx, PlaceDetailSheet.jsx, CategoryIcon.jsx(+default), courseBuilder.js(−템플릿/makeTitle), courseDisplay.js(고기 구이), savedCourseService.js(place_ids 판정), NearbySheet.jsx(호출부), dictionary.js(+filter.all, −courseTitle)
— 전 항목을 git diff로 직접 검독했으며 문서(docs/29·30)의 기술과 일치함을 확인했다.
