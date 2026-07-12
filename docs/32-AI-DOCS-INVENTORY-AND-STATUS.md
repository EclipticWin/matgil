# AI-Docs Inventory and Status

- 작성 일시: 2026-07-12 KST
- 기준 코드: main @ 93d0dd6 (작업 트리 클린)
- 대상: `ai-docs/` 전체 26개 md 파일 전문 검독 + 충돌 의심 지점의 실제 코드 대조(src/, supabase/functions/, deploy.yml)
- 원칙: 문서를 삭제·개명·수정하지 않았다. 이 문서는 분류·권장만 기록한다.

---

## 1. 분류 기준

| 코드 | 의미 |
|---|---|
| A | 현재도 유효 — 현행 코드·구조와 맞고 계속 참조할 가치 |
| B | 완료된 작업 지시서 — 구현이 끝난 기록물 |
| C | 부분 유효 — 일부 조항만 현행과 일치 |
| D | 레거시 기준 — 위저드/mock/과거 라우트·데이터 구조 전제 |
| E | 현재 코드와 충돌 — 지금 따르면 잘못된 구현을 유도 |
| F | 향후 작업 후보 — 미구현이며 재사용 가능성 있음 |

## 2. 전체 요약표 (26개)

| # | 파일 | 주 분류 | 부 분류 | 권장 |
|---|---|---|---|---|
| 00 | project-brief | D | C | 아카이브 (브리프 부분만 신규 문서로 발췌) |
| 01 | implementation-rules | D | C, **E 위험** | 갱신 (유효 규칙만 현행판 재작성) |
| 02 | current-task | B | D | 아카이브 |
| 03 | ddl-rules | C | — | 갱신 (현행 스키마 스냅샷으로 개정) |
| 04 | current-task-supabase-place-integration | B | A | 아카이브 |
| 05 | location-preset-plan | B | A | 아카이브 |
| 06 | course-recommendation-plan | B | C | 갱신 (추천 알고리즘 명세로 개정 가치) |
| 07 | course-detail-sheet-plan | B | — | 아카이브 |
| 08 | kakao-map-course-visualization-plan | B | A | 아카이브 (키 관리 절만 이관) |
| 09 | phrases-tts-plan | B | **E 위험** | 아카이브 (파일명-산출물 불일치) |
| 10 | github-pages-deploy | **A** | — | 보존 (404 한계·키 노출 주석 소폭 갱신) |
| 11 | voice-help-llm-plan | B | F | 보존 (Solar 전환 전까지) |
| 12 | map-location-search-plan | B | — | 아카이브 |
| 13 | tourapi-en-enrich-plan | B | **E(150m 규칙)** | 아카이브 (19번 포인터 필수) |
| 14 | current-location-recommendation-plan | B | — | 아카이브 |
| 15 | machine-translation-enrichment-plan | B | **E(provider 미저장)** | 아카이브 (경고 주석 권장) |
| 16 | search-result-locale-display-fix-todo | B | **E(허위 "미구현" 표기)** | 아카이브 (상태 갱신 권장) |
| 17 | auth-and-community-mvp-plan | B | **E(구 DDL)** | 아카이브 |
| 18 | language-switch-i18n-plan-request | B | C | 아카이브 |
| 19 | 주의-tourapi-en-source-mismatch-check | **C** | **A(운영 주의 유효)** | **보존** |
| 20 | mypage-community-activity-profile-edit | B | — | 아카이브 |
| 21 | saved-courses-tab-and-map-route-plan-request | B | D | 아카이브 |
| 22 | refactor-frontend-structure | B | D | 아카이브 |
| 23 | phrases-db-common-bookmark-plan-request | B | F | 아카이브 (2차 후보 목록만 승계) |
| 24 | food-category-db-migration-and-frontend-integration | B | **F** | **보존** (현행 카테고리 스펙 문서) |
| — | SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE | **A** | C | 갱신 후 기준 문서 유지 |

집계: 보존 4(10, 11, 19, 24) / 갱신 4(01, 03, 06, SECRETS_GUIDE) / 아카이브 18.

## 3. 문서별 상세

### 1세대 — mock 위저드 세대 (00~02)

- **00-project-brief**: 서비스 정체성 정의 + "mock 껍데기 MVP" 목표. 서비스 정의(L3-11)와 스택·TS 금지(L38-59)는 유효하나, L17-21 "백엔드/DB/지도 미구현"·L77-90 제외 목록(로그인·Supabase·Edge Function·지도·마이페이지)이 전부 구현 완료된 현재와 정반대. L51 "Solar 기반 추천"도 실제(mg-voice-help의 OpenAI, 추천은 LLM 미사용)와 다름.
- **01-implementation-rules**: TS 금지·rem·모바일 중앙 레이아웃은 지금도 지켜지는 규칙. 그러나 L92 "포인트 컬러 #fcbe32 필수"는 현행 coral 계열(courseBuilder.js:20 COURSE_ACCENTS '#F8481F' 등)과 **충돌(E)**, L129-146 하단 메뉴(북마크/인기맛집/홈/표현/마이)는 현행 탭(Map/Courses/Phrases/Community/You)과 다르고, L24-48 "실연동 금지·mock 인증"은 역행 지시가 됨.
- **02-current-task**: 10개 화면 껍데기 구축 지시 — 완료·폐기된 세대. L369-382 라우트 목록(`/areas`,`/preferences`)은 실제 라우트명(`/area`,`/preference`)과도 불일치(문서-코드 이중 불일치). 이 문서로 "누락"을 찾으면 죽은 위저드를 되살리게 됨.

### 2세대 — Supabase 전환기 (03~09, 12~17)

- **03-ddl-rules**: 장소 5테이블 DDL·translation_status 규칙(L172-195)은 현행 일치(살아있는 참조). 그러나 `mg_phrases` 단일 테이블 스키마(L350-373)는 현행 3테이블(phrases/categories/bookmarks)과 충돌, `mg_courses`/`mg_course_places`(L292-346)는 미사용(실제는 `mg_saved_courses`), `matgil_category_keys`·커뮤니티·카테고리 2테이블 등 이후 추가분 미기재.
- **04-supabase-place-integration**: place mock→실데이터 전환 지시(완료). L291-299 "ko만 존재" 전제 구식, L350-365 slice(0,2) 임시 추천은 고아 recommendationService.js에만 잔존 — 참조 구현으로 오인 금지.
- **05-location-preset-plan**: PRESET_LOCATIONS 도입(완료, locations.js와 일치). L293-301 반경 수치(1.5→3km)는 현행(2→4km, courseBuilder.js:9-10)과 다름.
- **06-course-recommendation-plan**: 점수 체계(cluster/diversity/cafeBonus, L243-357)·tie-break(L360-369)의 **원 설계 근거 문서**. 단 "코스 1개"(L104-115) 전제와 영어 전용 제목(L379-389)은 현행(최대 9개, getLocalizedCourseTitle EN/KO)과 다름 — 알고리즘 명세로 개정 가치 있음.
- **07-course-detail-sheet-plan**: TodayCourseDetail/PlaceDetailSheet 계획(완료). L133 "/courses/:id mock 상세는 건드리지 않음" 결정이 현재 고아 CourseDetailPage 잔존의 유래.
- **08-kakao-map-plan**: SDK 연동 계획(완료). 키 관리 방침(L52-83 — JS 키의 번들 노출 특성·도메인 등록)은 지금도 유효한 운영 지식 — 10번 또는 SECRETS_GUIDE로 이관 권장.
- **09-phrases-tts-plan**: **파일명과 실체 불일치** — 계획서가 아니라 "계획 문서를 생성하라"는 프롬프트 원문이며, 지정 산출물(`09-phrases-tts-and-voice-help-plan.md`)은 존재하지 않음. L65·L268-276 "표현 DB 저장 금지, 즐겨찾기 금지"는 현행(mg_phrases DB + 북마크 구현)을 역행하는 **E 위험** 조항.
- **12-map-location-search-plan**: 검색 기반 위치 변경 계획(완료). L84 "LocationSheet 안에 검색 input" → 실제는 별도 SearchOverlay로 분리 구현.
- **13-tourapi-en-enrich-plan**: mg-tour-en-enrich 설계(완료·실행됨). **핵심 규칙인 150m 최근접 매칭(L174)이 오매칭 원인으로 판명**(19번 문서·docs/21) — 이 문서대로 재실행하면 잘못된 데이터를 재생산(E).
- **14-current-location-recommendation-plan**: GPS 추천의 계획 문서 생성을 요청하는 프롬프트 원문(구현 완료). 참조 가치 낮음.
- **15-machine-translation-enrichment-plan**: mg-place-translate-en 설계(완료). **L295-296 "translation_provider/translated_from_locale 저장" 지시가 실제 배포 함수에 미반영**(index.ts는 translation_status='machine'만 기록 — 코드 확인) — 문서를 근거로 "provider별 재번역 필터링 가능"이라 판단하면 오류(E).
- **16-search-result-locale-display-fix-todo**: L260-263 "상태: 미구현/TODO, 우선순위 높음"이 **허위 상태** — SearchOverlay.jsx:149-154에 제안 코드가 거의 축자적으로 구현 완료(주소 fallback 순서만 도로명 우선으로 반전). 26개 중 "따르면 중복 작업" 위험이 가장 직접적.
- **17-auth-and-community-mvp-plan**: Auth+Community MVP 지시(완료). **L276-298 제안 DDL(단일 posts 테이블, soft delete 없음)은 실제 4테이블+soft delete 스키마(docs/22)와 상이** — DB 절 재사용 금지(E). L441-445 `YouPage.jsx` 등 존재하지 않는 파일명.

### 3세대 — 현행 직전~현행 (18~24)

- **18-language-switch-i18n-plan-request**: i18n 대공사 계획 요청(완료). 채택안(LocaleProvider 전역 + 단일 dictionary)이 현행과 일치. dictionary 예시의 courseTitle.* 키는 93d0dd6에서 삭제됨. 게스트 locale 영속성은 이 문서도 다루지 않은 공백 → 현재의 리셋 결함(LocaleProvider.jsx:38-42)으로 잔존.
- **19-주의-tourapi-en-source-mismatch**: 오매칭 원인·검수 SQL·수정 원칙. **L259-268 "절대 금지"(150m 그대로 대량 재매칭 금지, en/source 대량 삭제 금지)는 mg-tour-en-enrich를 재실행하는 순간 다시 유효해지는 영구 운영 규칙**, L119-168 검수 SQL은 재사용 자산 — 26개 중 운영 참조 가치 최고.
- **20-mypage-…-profile-edit**: MyPage 실기능 전환 지시(완료 — author_name 백필 코드 useAuth.jsx:66,71 실재). 이후 추가된 비밀번호 변경은 이 문서에 없음 — MyPage 기준은 docs/24 작업일지.
- **21-saved-courses-…-plan-request**: 저장 코스 계획 요청(완료). snapshot 원칙(L89-113)은 현행 근간. 단 L274-287 파일 후보(MapPage.jsx/MapView.jsx 등)는 존재하지 않는 이름이고, **중복 저장 판정 정책이 없어** 이후 title 기준 구현 → 24번 §15에서 place_ids로 교정 — 저장 로직 기준은 24번.
- **22-refactor-frontend-structure**: 구조 리팩토링 지시(완료, 커밋 13790af). **파일명 22, 내부 H1은 "26."** — 번호 오염. L297-311 검증 화면 목록에 고아 라우트(지역/취향/결과/인기/북마크)가 유효 화면처럼 포함, L29-30 "라우팅 변경 금지"가 레거시 라우트 존속의 직접 원인 — 이 금지는 당시 세션 한정 제약이지 상시 규칙이 아님.
- **23-phrases-db-…-plan-request**: Phrases DB 전환+북마크 계획(1차 완료, 커밋 308b69c). L316-318 "1차 제외: Popular 탭"은 이미 구현됨(커밋 3a22737, bookmark_count 숫자 UI는 제거 방향으로 변경). L644-676 2차 후보 중 Bookmarked 탭·표현 검색·관리자·다국어는 미착수 — 유일하게 승계 가치 있는 부분.
- **24-food-category-db-migration**: 음식 카테고리 DB화 지시서. **문서-코드-DB 삼자 완전 정합이 확인된 유일한 문서** — API shape(§12.1)·Provider 제공값 9종과 순서(§12.3)·필터 조건(§12.4)·라벨 폴백(§12.5)·CATEGORIES 제거(§13.1)·제목 단일화(§14)·place_ids 중복 판정(§15) 전 항목이 구현과 필드 단위로 일치(에이전트 코드 대조 + 본 세션 직접 검독 이중 확인). §9(관리자 쓰기 정책 유보)·§16(키워드 맵 DB화·재분류 = 2차 작업)은 살아있는 향후 작업 정의 — 관리자 카테고리 CRUD 착수 시 §8-9가 스키마 기준.

### 기준 문서

- **10-github-pages-deploy (A)**: base·workflow·Secrets 3종 전부 현행 일치. 보완 여지 2건 — 404.html 부재로 인한 딥링크 404 한계 미기재, Kakao JS 키의 "Secret이지만 번들 노출" 특성 미기재.
- **SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE (A/C)**: 키 관리 원칙·VITE_ 금지 목록(L104-130)·TourAPI 매핑(L400-491)은 정확한 현행 기준. 현행화 필요 3건 — ① 테이블/RLS 목록에 saved_courses·community·phrase 3종·food_categories 2종 미기재, ② "프론트에서 insert/update/delete 하지 않는다"(L241) 원칙이 커뮤니티 CRUD·북마크·코스 저장 구현으로 이미 폐기됨, ③ 사용자용 LLM 함수(mg-voice-help)의 보안 기준 공백(현재 무인증 — docs/31 High-①). L26-37 "chat Edge Function" 언급은 타 프로젝트 잔재.

## 4. 프롬프트 간 충돌 조사 (근거 포함)

1. **위저드 vs Map 추천**: 00(L23-30)·01(L125-147)·02(L369-443)는 지역→취향→로딩→결과 위저드를 완성 기준으로 규정 ↔ 05·06·07·08·12는 Map 탭+courseBuilder 전제. router.jsx에 양 세대 라우트가 공존하고 위저드 라우트는 전부 고아. 22(L297-311)는 리팩토링 검증 목록에 고아 화면을 유효 화면처럼 포함 ↔ 24(§3, §6)는 같은 파일들을 "레거시, 기준으로 사용하지 않음"으로 명시 — **같은 폴더 안에서 한 문서가 다른 문서의 전제를 폐기**.
2. **mock vs Supabase**: 00(L19-21)·01(L24-48)은 실연동 전면 금지, 04는 place만 전환하며 phrases mock 유지(L454-458), 09는 phrases DB 저장 금지(L268), 12·17은 Courses/Community mock 전제 → 이후 17·21·23이 차례로 실연동 전환. mockAuthService.js(01 유래)는 dead code로 잔존.
3. **정적 CATEGORIES vs DB 카테고리**: 02(L118-124) 한식/일식/중식 하드코딩 → 06(L54-58) matgilCategoryKeys 정적 필터 → 18(L223) exploreOptions.js를 카테고리 소스로 전제 → 24(§13.1)가 CATEGORIES 제거 지시. 현재 exploreOptions.js에 CATEGORIES export 없음(코드 확인) — **18 이전 문서를 따르면 존재하지 않는 상수를 참조하게 됨**.
4. **Provider 구조**: 00~17 어디에도 providers.jsx 구조 언급 없음(06·07은 HomePage 로컬 state 전제). 18이 선택지 3개 제시, 24(§12.3)가 확정 → 현행 일치. **레거시 Provider 2개(Recommendation/Bookmark)의 잔존은 어느 문서에도 기록되지 않은 공백**.
5. **라우트 목록**: 현행 도달 가능 8개 라우트를 기술한 문서는 26개 중 **0개**. 02의 `/areas`·`/preferences`는 코드와 이중 불일치, 01의 하단 메뉴는 고아 라우트(/bookmark,/popular)를 연결 규정, 17의 YouPage·21의 MapPage/MapView는 존재하지 않는 파일명.
6. **EN/KO 계보**: 03·SECRETS_GUIDE의 mg_place_texts locale 규칙은 현행 placeApi와 일치(생존) ↔ 04 "ko만 존재"(구식), 06 영어 전용 제목(구식), 11 "userLanguage en 고정"(구식), 15 §16 "언어 전환 안 함" → 16(TODO) → 18(대공사) → 완료. 16의 상태 표기만 허위로 남음. 게스트 locale 리셋 결함은 전 문서 공백.
7. **관리자 존재 가정**: 관리자 UI가 이미 있다고 가정한 문서는 없음. 다만 SECRETS_GUIDE(L267-268)·04(L64)의 "관리자가 호출"은 role 모델 없이 헤더 토큰뿐인 실태를 가릴 수 있는 표현. 09(L275)·23·24는 "관리자 기능은 향후"로 현행과 정합.
8. **저장 코스 snapshot vs 구 형태**: 02(L171-187)의 추천 결과 shape·03의 mg_courses/mg_course_places 설계는 실구현(mg_saved_courses 단일 테이블 + ordered place_ids)과 분기. 21이 snapshot 원칙 수립(중복 정책 부재) → 24 §15가 place_ids 판정으로 교정 — **저장 코스의 최신 기준은 24번**.
9. **문서 지시 vs 배포물 불일치 (확인된 사실)**: 15(L295-296)의 translation_provider 저장 지시가 실제 mg-place-translate-en에 미반영 — docs/31 이슈(translation_provider 미기록)의 문서 측 기원.
10. **자기모순 쌍**: 13(L174, 150m 매칭 규정) ↔ 19(L267, 동일 규칙 재사용 금지) — 13을 단독으로 읽으면 위험.
11. **번호 체계 오염**: ai-docs/22의 내부 제목이 "26."(docs 작업일지 번호와 교차), ai-docs/09·14는 계획서가 아닌 프롬프트 원문이 계획서 파일명으로 저장됨.

## 5. 권장 운영 방안 (실행은 사용자 결정 후 — 이번 작업에서는 미실행)

1. **아카이브 이동**: `ai-docs/archive/` 폴더를 만들어 아카이브 18건을 이동(파일명 유지). 특히 09·13·15·16·17은 머리말에 한 줄 경고("완료됨 / X 조항은 현행과 충돌 — docs/32 참조") 추가를 권장.
2. **갱신 4건**: 01(유효 규칙만 남긴 현행 구현 규칙), 03(현행 스키마 스냅샷 — 사용자 확인 SQL 결과와 함께), 06(멀티 코스+locale 반영 추천 알고리즘 명세), SECRETS_GUIDE(테이블 목록·프론트 쓰기 정책·사용자용 함수 보안 기준).
3. **보존 4건**: 10, 11, 19, 24 — 이 중 19와 24는 후속 작업(EN 보강 재실행, 카테고리 관리자 CRUD)의 필수 선행 자료.
4. **최대 공백**: 현행 아키텍처를 기술한 문서가 ai-docs에 사실상 없음(10번·SECRETS_GUIDE 일부뿐). `docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`와 `docs/33-APP-STARTUP-FLOW-ANALYSIS.md`가 이 공백을 메우는 현행 기준이며, 새 작업 프롬프트는 구 ai-docs가 아닌 이 두 문서를 참조 기준으로 삼는 것을 권장.
