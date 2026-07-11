# Matgil 프로젝트 전체 현재 상태 감사 (2026-07-11)

- 분석 기준: main 브랜치(3a22737) + 미커밋 diff 2건(포매팅 전용)
- 판단 우선순위: 현재 코드 > import/호출 흐름 > 최신 docs > 최신 ai-docs > 구 문서
- 조사 방식: 5개 관점(구조/라우팅, Supabase, 기능 완성도, i18n/하드코딩/관리자, 보안/무결성) 병렬 조사 후 메인에서 교차 검증. 핵심 주장 5건(mock 폴백, 게스트 locale 리셋, mg-voice-help 무인증, 404.html 부재, 제목 기반 중복 판정)은 코드 직접 재확인 완료.
- 이 문서는 분석 전용이며 코드/DB/배포를 변경하지 않았다.

---

## 1. 프로젝트 전체 구조

```
index.html → src/main.jsx → src/app/App.jsx (BrowserRouter, basename=/matgil prod)
  └ src/app/providers.jsx : LocaleProvider > AuthProvider > RecommendationProvider > BookmarkProvider
      └ src/app/router.jsx : 라우트 15개 정의
```

- 프론트: Vite 5 + React 18 + react-router-dom 6 + Tailwind 3 + @supabase/supabase-js 2 (package.json)
- 단일 모바일 UI(`max-w-app` = 22.5rem, tailwind.config.js:18-20)를 중앙 배치하고 데스크톱(lg↑)에서 좌측 `DesktopIntroPanel`(src/shared/components/DesktopIntroPanel.jsx:37) 추가. 화면 중복 없음.
- Supabase 클라이언트는 `src/lib/supabase.js` 단일 인스턴스(VITE_SUPABASE_URL/ANON_KEY), 9개 파일에서 import.
- API 계층은 `src/api/placeApi.js` 하나뿐이고 나머지는 feature별 service 파일(communityService, savedCourseService, phraseService, phraseBookmarkService 등).
- Edge Function 4개: `supabase/functions/{mg-tour-seed, mg-tour-en-enrich, mg-place-translate-en, mg-voice-help}`.
- 배포: `.github/workflows/deploy.yml` — main 푸시 → npm ci → build(시크릿 3개: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_KAKAO_MAP_JS_KEY) → GitHub Pages. lint/test 단계 없음.

## 2. 실제 사용자 접근 가능 화면 (8개)

| 경로 | 화면 | 진입 경로 |
|---|---|---|
| `/` | HomePage (Kakao 지도 + NearbySheet) | 하단 탭 Map |
| `/courses` | CoursesPage (저장 코스) | 하단 탭 Courses |
| `/community` | CommunityPage | 하단 탭 Community, 가입 성공 후(SignUpPage.jsx:63) |
| `/phrases` | PhrasesPage (표현/TTS/Voice help/북마크/인기 탭) | 하단 탭 Phrases |
| `/my` | MyPage | 하단 탭 You, 로그인 성공 후(LoginPage.jsx:15) |
| `/login` | LoginPage | 각 화면의 로그인 유도(CoursesPage.jsx:49 등) |
| `/signup` | SignUpPage | LoginForm.jsx:102 |
| `/saved-courses/:id` | SavedCourseDetailPage | CoursesPage.jsx:101 |

하단 탭 정의: src/features/navigation/components/BottomNavigation.jsx:7-13 (Map/Courses/Phrases/Community/You).

## 3. 숨은 화면 / 레거시 화면 (7개 고아 라우트)

router.jsx에 정의되어 있으나 UI 어디에서도 진입 링크가 없는 라우트:

| 경로 | 상태 | 근거 |
|---|---|---|
| `/area` → `/preference` → `/loading` → `/result` | 레거시 추천 위저드. recommendationService.js:6 주석 그대로 "MVP: 앞 3개 사용" — 입력을 무시한 가짜 추천. 전 문구 영어 하드코딩 | ROUTES.area 사용처가 위저드 내부 back 버튼뿐 |
| `/courses/:id` (CourseDetailPage) | mock COURSES(c1~c3) 전용. CourseCard 실사용처 2곳이 모두 `disableLink`라 절대 도달 불가. URL 직접 입력 시 가짜 데이터 + 동작 없는 "Start this course" 버튼(CourseDetailPage.jsx:92-94) | CourseCard.jsx:77-84 분기 미실행 |
| `/popular` (PopularPage) | 내비게이션에 없음. `getPlaces('ko')` 고정(PopularPage.jsx:14) + '인기 맛집' 등 한국어 하드코딩(23-35행), 인기 정렬 없이 id순 | ROUTES.popular 사용처 router.jsx뿐 |
| `/bookmark` (BookmarkPage) | 내비게이션에 없음. 북마크 추가 경로가 도달 불가 페이지(PopularPlaceCard)뿐 — 사실상 죽은 기능 쌍 | ROUTES.bookmark 사용처 router.jsx뿐 |

완전 데드 파일 4개 (어디서도 import되지 않음):
- src/features/auth/services/mockAuthService.js
- src/features/community/components/PostCommentSection.jsx
- src/features/popular/data/mockPopularPlaces.js
- src/features/recommendation/data/mockRecommendations.js

레거시 체인으로만 살아있는 파일: mockAreas.js, preferenceOptions.js, courses/data/courses.js, RecommendationCard/Summary, recommendationService.js, Header.jsx(위저드 3페이지 전용), StepIndicator. `RecommendationProvider`와 `BookmarkProvider`는 소비자가 고아 화면뿐인데 전역 Providers에 상주(src/app/providers.jsx:12-18).

## 4. 주요 기능 구현 상태

| 기능 | 상태 | 근거 / 비고 |
|---|---|---|
| Kakao Map (마커/폴리라인/bounds) | 완료 | KakaoMap.jsx, loadKakaoMapSdk.js |
| GPS / 위치 검색 / 프리셋 | 완료 | HomePage.jsx handleGpsClick, SearchOverlay.jsx(300ms 디바운스, 서울 필터), locations.js 10곳 |
| 음식점 조회·정규화 | 완료(페이지네이션 없음) | placeApi.js getPlaces — 전량 조회, locale 폴백, nameKo 보존 |
| 음식 카테고리 필터 (다중 3개) | 완료 | exploreOptions.js, FilterSheet.jsx:97-99 |
| 추천 코스 생성 | 완료 | courseBuilder.js — 반경 티어, 20개 슬라이스, 3곳 조합 전수 스코어링, 앵커 강제 포함(anchorMatchService.js) |
| 코스 상세 / 장소 상세 | 완료(KO 하드코딩 1건) | TodayCourseDetail.jsx, PlaceDetailSheet.jsx:69-70 'Parking: 가능' EN 노출 |
| Saved Courses | 완료(locale 결함 다수) | savedCourseService.js — 스냅샷 저장·soft delete. §12 참조 |
| 이메일 로그인/가입/로그아웃 | 완료 | useAuth.jsx |
| 비밀번호 변경 (로그인 상태) | 완료 | EditProfileSheet.jsx → updatePassword — docs/24 §4와 일치 |
| 비밀번호 재설정 (비로그인) | 미구현 | resetPasswordForEmail 호출 없음 — 분실 시 복구 수단 없음 |
| 소셜 로그인 | 계획만 존재 | LoginForm.jsx:56-58 — 버튼은 보이나 alert('Coming soon') |
| MyPage (프로필/활동/내글 관리) | 완료 | MyPage.jsx, EditProfileSheet, MyPostsView, LikedPostsView |
| Community (글/댓글/좋아요/이미지) | 완료(mock 폴백 위험) | communityService.js. §9, §11 참조 |
| 커뮤니티 신고/차단/모더레이션 | 미구현(문서상 의도된 제외) | docs/22:43 |
| Phrases DB 조회/북마크/인기 탭 | 완료 | phraseService.js, phraseBookmarkService.js — docs/27, 최근 커밋 2건과 일치 |
| TTS | 완료 (Web Speech API, 서버 아님) | ttsService.js — 디버그 log 9곳 잔존 |
| Voice help | 완료 | speechRecognitionService.js → mg-voice-help(gpt-4o-mini). Solar는 TODO 스텁(index.ts:97-103) |
| EN/KO 전환 | 완료(게스트 리셋 결함) | LocaleProvider.jsx — §8 참조 |
| TourAPI 수집 / EN 보강 / LLM 번역 | 완료 (관리자 수동 curl 방식) | Edge Function 3종, x-admin-seed-token |
| 관리자 화면 | 미구현 (기반도 0) | role/admin 흔적 코드에 전무 |
| 테스트/린트/CI 게이트 | 전무 | package.json 스크립트 dev/build/preview뿐 |

## 5. 프론트 데이터 흐름

- 장소: `placeApi.getPlaces(locale)`가 mg_places + texts/details/images 전량 조인 조회(placeApi.js:55-76) → normalize(요청 locale 우선, 반대 locale 폴백, nameKo 항상 보존) → HomePage/PopularPage/recommendationService **3곳에서 캐시 없이 각각 호출**. HomePage는 locale 변경마다 재조회(HomePage.jsx:45-61).
- 코스: places → courseBuilder.buildRecommendedCourses(반경 티어 → 근접 20 슬라이스 → 조합 스코어링, 최대 9개) → NearbySheet(초기 3개 + IntersectionObserver + 인위적 400ms 지연) → 저장 시 스냅샷 통째로 mg_saved_courses.
- 커뮤니티: fetchPosts(locale 필터, 0건이면 전체 locale 재조회 폴백) → **여전히 0건/실패면 mock COMMUNITY_POSTS 표시**(CommunityPage.jsx:64-67).
- 표현: mg_phrase_categories/mg_phrases 조회, 실패 시 정적 폴백(phrases.js) 유지. 북마크는 낙관적 업데이트 + 롤백.
- 상태 관리는 Context 4개 + 지역 훅. 전역 스토어 없음. HomePage → NearbySheet props 11개 전달(HomePage.jsx:231-245).

## 6. Supabase 테이블 사용 관계 (프론트 실사용 11개)

| 테이블 | 사용처 | 연산 |
|---|---|---|
| mg_places (+texts/food_details/images 임베드) | placeApi.js:55-76 | SELECT |
| mg_community_posts | communityService.js 다수, useAuth.jsx:66(author_name 백필) | SELECT/INSERT/UPDATE(soft delete 포함) |
| mg_community_post_likes | communityService.js:121-137 등 | SELECT/INSERT/DELETE |
| mg_community_comments | communityService.js:146-173, useAuth.jsx:71 | SELECT/INSERT/UPDATE |
| mg_community_comment_likes | communityService.js:186-223 | SELECT/INSERT/DELETE |
| mg_saved_courses | savedCourseService.js | SELECT/INSERT/UPDATE |
| mg_phrase_categories / mg_phrases | phraseService.js | SELECT |
| mg_phrase_bookmarks | phraseBookmarkService.js | SELECT/INSERT/DELETE |

- `.rpc()` 사용 없음. `functions.invoke` 1건(VoiceHelpPlaceholder.jsx:39 — 컴포넌트가 서비스 계층 없이 직접 호출).
- 문서에만 있고 프론트 미사용: mg_courses, mg_course_places, mg_profiles, mg_place_sources, mg_api_fetch_logs, mg_community_post_place_tags.
- DDL 근거는 ai-docs/03-ddl-rules.md, docs/22(커뮤니티 확정 DDL+RLS+트리거), docs/sql-phrases-…md(표현 북마크). **docs/db-snapshots 폴더와 .sql 파일은 존재하지 않음.**
- 코드-문서 충돌: mg_places.matgil_category_keys가 정식 DDL에 없음(docs/03·04에 수동 추가 기록만), mg_phrases는 ALTER 이력이 sql 문서에만 존재, mg-place-translate-en이 translation_provider 컬럼을 기록하지 않음.

## 7. Auth / Storage / Edge Function 관계

- Auth: useAuth.jsx에 signInWithPassword/signUp(display_name metadata)/signOut/updateUser(password·display_name). LocaleProvider가 preferred_locale을 user_metadata에 저장. **app_metadata 사용 없음. OAuth/OTP/재설정 메일 없음.**
- Storage: `community-post-images` 버킷 1개(public). 업로드 경로 `{userId}/{ts}-{uuid}.{ext}`(communityService.js:47), public URL만 사용. DELETE 정책 의도적 부재(docs/22:486-491) → soft delete된 글의 이미지가 영구 누적.
- Edge Functions:

| 함수 | 인증 | 외부 API | DB |
|---|---|---|---|
| mg-tour-seed | x-admin-seed-token(index.ts:385-394) | TourAPI KorService2 | mg_places 계열 insert (service_role), 자동 분류 키워드 17종 하드코딩(175-205행) |
| mg-tour-en-enrich | x-admin-seed-token | TourAPI EngService2 | 좌표 150m 매칭 → mg_place_texts en upsert |
| mg-place-translate-en | x-admin-seed-token, dryRun 기본 true | OpenAI gpt-4o-mini → Solar 폴백 | mg_place_texts en upsert(status='machine'). translation_provider 미기록, fetch_logs 미기록 |
| mg-voice-help | **없음** (serve()에 토큰/JWT 검증 부재 — index.ts:110-137 직접 확인) | OpenAI gpt-4o-mini | DB 접근 없음 |

- `supabase/config.toml`이 리포에 없어 verify_jwt 설정을 코드로 확인 불가 — 실제 Supabase 확인 필요. verify_jwt가 켜져 있어도 anon key 자체가 유효 JWT라 mg-voice-help는 익명 호출 가능.

## 8. locale / i18n 구조

- 사전: src/shared/i18n/dictionary.js 단일 파일, EN/KO 각 205키 완전 대칭. `t()`는 EN 폴백 → 키 문자열 반환.
- locale 저장: localStorage `matgil_locale` + 로그인 시 user_metadata.preferred_locale 동기화. **URL 로케일 라우팅은 없음**(docs/24 제목의 "routing"은 SPA 새로고침 수정을 의미).
- **게스트 locale 리셋 결함**: LocaleProvider.jsx:38-42 — 세션 없는 INITIAL_SESSION에서 무조건 'en' 강제 + localStorage 삭제. 비로그인 사용자가 KO 선택 후 새로고침하면 EN으로 복귀 (직접 확인).
- 제2의 i18n 체계 병존: label/labelKo 배열 6개 파일(exploreOptions, locations, communityConstants, communityPosts, phrases 폴백, LANGUAGES), 컴포넌트 인라인 이중언어 다수, locale 삼항 분기 27곳/18파일, `pickLabel` 공용 헬퍼 부재로 동일 삼항이 10곳 산재.
- 코스 제목 템플릿 3중 복제: courseBuilder.js:129-143 = courseDisplay.js:17-36 (완전 중복) + dictionary.js courseTitle.*(**미사용 dead keys**).
- DB 다국어: mg_place_texts locale별 행(ko/en), en 없으면 ko 폴백. mg_phrases는 en_text 단일 컬럼(제3언어 확장 장벽). 커뮤니티는 locale 컬럼으로 피드 분리.
- 제3언어 추가 비용: 코드 약 25파일 + DB 스키마 2곳 + 번역 파이프라인 1개 (Agent D 전수 목록).

## 9. 하드코딩 및 mock 현황

| 항목 | 위치 | 영향 |
|---|---|---|
| **커뮤니티 mock 무음 폴백** | CommunityPage.jsx:64-67 — DB 0건 또는 fetch 실패 시 가짜 글 4개(COMMUNITY_POSTS)를 실데이터처럼 표시 | 가짜 글에 좋아요 시 NaN insert 실패→하트 깜빡임, 댓글 작성 실패 무음(CommentBottomSheet.jsx:60-61) |
| 음식 카테고리 19종 | exploreOptions.js CATEGORIES + mg-tour-seed 키워드 맵 + CategoryIcon PATHS + courseBuilder 특정 키 의존 스코어링 | 카테고리 변경 = 코드 수정 + 함수 재배포 |
| "한국식 BBQ" | exploreOptions.js:6, dictionary.js:316(dead), courseDisplay.js:25, courseBuilder.js:132 — 정확히 4곳 | 정책("고기 구이")은 코드 어디에도 미반영 |
| KO 하드코딩(EN 모드 노출) | PlaceDetailSheet.jsx:69-70 '가능', PopularPlaceCard.jsx:13 '음식점', EditProfileSheet.jsx:85 '6자 이상' | EN 사용자에게 한국어 노출 |
| EN 하드코딩(KO 모드 노출) | SignUpPage.jsx:45,49,61,89 검증/안내문, VoiceHelpPlaceholder.jsx:46,53-55(사전 키가 있는데 미사용), aria-label 전반, 레거시 4페이지 전체 | KO 사용자에게 영어 노출 |
| AUTH_ERROR_KO 중복 | LoginForm.jsx:12-18 / SignUpPage.jsx:13-18 부분 중복 | 유지보수 |
| PRICES/FEATURES 잠복 버그 | exploreOptions.js — applyFilters는 r.price/r.features 검사하나 placeApi normalize 결과에 해당 필드 없음. UI 재활성화 시 즉시 전체 0건 | docs/25 "가격대/취향 섹션 제거"의 잔재 |
| TTS 디버그 로그 | ttsService.js 9곳 `[TTS DEBUG]` console.log | 프로덕션 잔존 |
| 삼켜진 catch | HomePage.jsx:57(getPlaces 실패=빈 상태로 위장), CommunityPage.jsx:46,97, CommentBottomSheet.jsx:35,60,73, NearbySheet.jsx:109,120, useAuth.jsx:69,74, MyPage.jsx:33 | 에러↔빈 상태 미구분 |
| 인위적 지연 | NearbySheet.jsx:77-80 — 점진 로딩 400ms setTimeout (연출, docs/12와 일치) | 의도됨 |

## 10. 코드와 문서 불일치

1. **ai-docs/16 (SearchOverlay locale 분기 TODO)** — 문서는 미구현이라 하지만 SearchOverlay.jsx:149-154에 이미 구현 완료. 문서 갱신 누락.
2. **docs/24 "언어 설정 영구 저장"** — 로그인 사용자만 참. 게스트는 새로고침 시 EN 리셋(코드 직접 확인). 문서에 게스트 케이스 없음.
3. **레거시 위저드** — ai-docs/00~02 세대의 플로우가 Map 탭 courseBuilder로 대체됐으나 라우트·Provider·mock 미제거.
4. **커밋 3a22737의 "Popular 탭"** — /popular 페이지가 아니라 Phrases 내부 인기 표현 탭. /popular·/bookmark 페이지의 존폐는 어느 문서에도 정리 안 됨.
5. **mg_places.matgil_category_keys** — 정식 DDL 문서에 없고 docs/03·04의 수동 추가 기록만 존재.
6. **dictionary courseTitle.*** — 코드 미사용 dead keys.
7. docs/27의 "다음 작업 후보" 10건은 전부 미착수(계획만 존재) — 정상적 기록이나 혼동 주의.
8. docs/22의 커뮤니티 제외 항목(신고/이미지 실삭제/알림/프로필 이미지)은 코드와 정확히 일치 — 불일치 아님을 명시.

## 11. 보안 위험 (상세는 OPEN-ISSUES 문서)

- **[HIGH] mg-voice-help 무인증** — anon key(번들 공개)만으로 누구나 호출, rate limit 없음 → OpenAI 비용 소진 + transcript 프롬프트 인젝션(index.ts:42). 나머지 3개 함수는 토큰 검증 존재.
- **[HIGH·확인 필요] 장소 테이블(mg_places 계열)·mg_saved_courses의 RLS 정책 원문이 리포 어디에도 없음** — 실제 활성화/정책 미확인. 커뮤니티/표현 테이블은 정책 SQL 문서화 양호.
- **[MED·확인 필요] 카운트 컬럼 클라이언트 UPDATE** — grant가 테이블 단위(docs/22:850)라 본인 글 like_count 직접 조작 → Popular 정렬(communityService.js:14-17) 왜곡 가능.
- **[MED] author_name 클라이언트 임의 지정**(communityService.js:83) — RLS는 user_id만 검사 → 사칭 가능. XSS로는 전이 안 됨(React 이스케이프, dangerouslySetInnerHTML 0건).
- **[MED] 로그아웃 시 matgil.bookmarks localStorage 미정리**(useBookmarks.jsx) — 공용 기기 계정 간 잔존.
- **[MED] updatePost에 user_id 필터 부재**(communityService.js:93-97) — RLS 단일 의존.
- **[MED] ADMIN_SEED_TOKEN 공유 시크릿** — 유출 시 시드/번역 파이프라인 전체 장악.
- 양호: 하드코딩 키 없음, .env/dist 미커밋, service_role은 Deno.env 전용, 이미지 업로드 검증(MIME/5MB/3장), XSS 방어(React 텍스트 렌더 + http 스킴 필터).

## 12. 데이터 무결성 위험

- **저장 코스 스냅샷**: 원본 장소 변경/폐업 미반영(place_ids 재조회 없음 — 설계 의도로 보이나 stale 정책 미문서화). 재지역화는 title/stop.name만 — address/description/firstMenu는 저장 시점 locale 고정. KO 모드 저장 시 EN 이름이 스냅샷에 아예 없어 EN 표시에서 한국어 노출.
- **중복 저장 판정 이원화**: checkCourseAlreadySaved는 title 문자열(savedCourseService.js:77-86, 직접 확인), 목록 배지 isSameCourse는 place_ids — EN 저장 후 KO 전환 시 같은 코스 중복 저장 가능, 반대로 다른 코스가 제목 충돌로 저장 불가 오탐.
- **Storage 고아 파일**: soft delete + 이미지 실삭제 금지 정책 → 장기 누적.
- **author_name 비정규화**: 닉네임 변경 백필이 best-effort catch 무시(useAuth.jsx:64-74) — 부분 실패 시 옛 닉네임 잔존.
- **updated_at**: mg_saved_courses는 트리거 없어 클라이언트 세팅(문서화됨), 커뮤니티는 트리거+클라이언트 중복 세팅(무해).

## 13. 유지보수 위험

- 고아 라우트 7 + 데드 파일 4 + 죽은 Provider 2개 전역 상주 — 신규 기여자가 두 세대의 코드를 동시에 읽어야 함.
- 카테고리 라벨·제목 템플릿 3중 복제, locale 삼항 27곳, pickLabel 헬퍼 부재.
- getPlaces 전량 조회 3곳 중복, 페이지네이션 없음(커뮤니티/장소/표현 공통).
- VoiceHelpPlaceholder가 서비스 계층 없이 Edge Function 직접 호출 — 파일명("Placeholder")도 실체와 불일치.
- fetchMyPosts/fetchMyLikedPosts 로직 유사 중복(communityService.js:237-304).

## 14. 테스트·검증 공백

- 테스트 파일 0개, 테스트 프레임워크 없음, ESLint/Prettier 설정 파일 없음, 타입체크 없음.
- CI는 배포 전용 — main 푸시가 곧 프로덕션 배포. 빌드만 통과하면 어떤 회귀도 배포됨.
- **GitHub Pages SPA 404**: 404.html이 리포 어디에도 없음(Glob 직접 확인, public/ 폴더 자체 부재). BrowserRouter이므로 딥링크 새로고침 404 예상 — Pages 설정에 우회가 있는지 실제 확인 필요.

## 15. 가장 큰 구조적 부채 (종합)

1. **신뢰 경계가 문서에만 존재** — RLS 절반(장소/저장코스)은 정책 원문조차 리포에 없고, Edge Function 인증은 config.toml 미버전관리로 재현 불가. "보안이 어떻게 되어 있는지"를 코드만으로 증명할 수 없는 상태.
2. **관리자 기반 0** — 역할 모델·admin RLS·라우트 가드 전무. 카테고리/번역/모더레이션/표현 카탈로그가 전부 코드 수정 또는 수동 SQL.
3. **이중 i18n 체계** — 건강한 사전 계층 옆에 label/labelKo·삼항 분기·템플릿 복제가 병존, 카테고리 라벨 하나 바꾸는 데 4개 파일 수정 필요.
4. **무음 실패 문화** — mock 폴백과 삼켜진 catch가 에러를 정상 화면으로 위장, 프로덕션 장애를 인지할 수 없음.
5. **두 세대 코드 공존** — 레거시 위저드/mock 세대와 현행 Supabase 세대가 라우터에 함께 등록.

---

## 우선순위 표

| 순위 | 작업 (PLAN 문서) | 사용자 영향 | 기술 위험 | 확장성 기여 | 예상 작업량 | 회귀 위험 | 선행 작업 | 선정 이유 |
|---|---|---|---|---|---|---|---|---|
| 1 | Edge Function·RLS 보안 (PLAN-auth-edge-security) | 중 (비용/사칭/순위조작) | **최고** | 중 | 중 | 낮음 | RLS 실태 확인 SQL (사용자) | 유일한 실비용 유출 경로 + 신뢰 경계 미검증. 지금 확인하지 않으면 모든 후속 작업의 전제가 불확실 |
| 2 | 사용자 대면 신뢰성 (PLAN-user-facing-reliability) | **최고** | 중 | 낮음 | 중 | 낮음 | 없음 | mock 폴백·무음 에러·게스트 locale 리셋·SPA 404 — 현재 사용자가 지금 겪는 결함 묶음 |
| 3 | 관리자 기반 (PLAN-admin-foundation) | 낮음(간접) | 중 | **최고** | 중 | 낮음 | 1번(RLS 실태) | 카테고리 관리·모더레이션·표현 카탈로그·번역 실행 전부의 선행 조건. 역할 모델 없이는 어떤 관리자 기능도 불가 |
| 4 | 음식 카테고리 DB 관리 (PLAN-food-category-management) | 중 | 중 | **높음** | 높음 | 중 | 3번(admin RLS), 5번(pickLabel) | 하드코딩 최대 밀집 지점. 관리자·다국어 확장의 관문. "고기 구이" 정책 반영 포함 |
| 5 | i18n 통합 (PLAN-i18n-consolidation) | 중 | 낮음 | 높음 | 중 | 중 | 없음 (4번과 순서 조정 가능) | pickLabel 헬퍼·하드코딩 문구 이관·저장 코스 locale 정합성 — 제3언어 추가 비용을 25파일에서 소수 파일로 축소 |

### 차순위 작업 (상위 5개 미포함이지만 중요)

| 작업 | 심각도 | 비고 |
|---|---|---|
| 레거시 라우트 7개·데드 파일 4개·죽은 Provider 정리 | medium | 저비용·저위험. 2번 계획의 부속 단계로 일부 포함 |
| CI 게이트 (lint + build + 최소 스모크) | high(구조) | main 푸시 즉시 배포 구조의 안전망. 어떤 계획과도 병행 가능 |
| 비밀번호 재설정(resetPasswordForEmail) 도입 | medium | 분실 사용자 복구 수단 부재 |
| 장소/커뮤니티/표현 페이지네이션 | medium | 데이터 증가 시 병목. 현 규모에서는 유예 가능 |
| translation_provider·fetch_logs 기록 보강 | low | 번역 파이프라인 추적성 |
| Storage 고아 이미지 정리 배치 | low | 의도된 정책이나 장기 과제 |
| mg_phrases 다국어 구조(en_text 단일 컬럼) 재설계 | medium | 제3언어 시점에 필수 |
