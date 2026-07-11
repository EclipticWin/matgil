# Matgil 열린 이슈 전체 목록 (2026-07-11)

- 근거: 2026-07-11 전체 감사(`2026-07-11-MATGIL-PROJECT-AUDIT.md`). 각 이슈의 근거 파일은 감사 시점 코드 기준.
- 심각도: critical / high / medium / low, 상태: 미구현 / 부분 구현 / 버그 가능성 / 구조 개선 / 확인 필요.

---

## 보안

### ISSUE-01. mg-voice-help 무인증 호출로 LLM 비용 소진 가능
- 영역: Edge Function / 비용
- 심각도: **high** | 상태: 버그 가능성
- 사용자 영향: 직접 영향 없음. 서비스 운영자에게 OpenAI 비용 폭탄 가능.
- 기술적 영향: serve()에 토큰/JWT 검증 없음(다른 3개 함수는 x-admin-seed-token 검증). anon key는 번들 공개이므로 verify_jwt가 켜져 있어도 익명 호출 통과. rate limit·transcript 길이 제한 없음. transcript가 프롬프트에 문자열 보간(index.ts:42) — 프롬프트 인젝션 여지.
- 근거: supabase/functions/mg-voice-help/index.ts:110-137, src/features/phrases/components/VoiceHelpPlaceholder.jsx:39
- 선행: verify_jwt 실설정 확인(REQUIRED-USER-INPUTS F항)
- 난이도: 중 (JWT 검증 + rate limit + 입력 제한)

### ISSUE-02. 장소 테이블·mg_saved_courses RLS 정책 원문 부재
- 영역: DB 권한
- 심각도: **high** | 상태: **확인 필요**
- 사용자 영향: RLS 미활성이면 익명 사용자가 장소 데이터 조작 가능(최악 시나리오).
- 기술적 영향: mg_places/mg_place_texts/mg_place_food_details/mg_place_images/mg_saved_courses의 CREATE POLICY SQL이 리포 어디에도 없음. docs/25는 rls_enabled=true 캡처와 요약만. mg_place_sources/mg_api_fetch_logs(raw JSON 보유)의 노출 차단 여부도 미확인.
- 근거: ai-docs/SUPABASE_EDGE_FUNCTION_SECRETS_GUIDE.md §8(원칙만), docs/25:139-145(요약만)
- 선행: 없음 — REQUIRED-USER-INPUTS의 SQL A/B 실행이 곧 해결 첫 단계
- 난이도: 하 (확인) / 중 (정책 보완)

### ISSUE-03. 본인 게시글 like_count 등 카운트 컬럼 직접 UPDATE 가능성
- 영역: DB 권한 / Community
- 심각도: **high** | 상태: 확인 필요
- 사용자 영향: Popular 탭 순위 조작(fetchPosts가 like_count desc 정렬 — communityService.js:14-17), created_at·comment_count도 자기 행에 한해 조작 가능.
- 기술적 영향: grant가 컬럼 제한 없는 테이블 단위(docs/22:850), UPDATE 정책은 소유자 여부만 검사(docs/22:696-701). 좋아요 트리거는 posts 직접 UPDATE에 반응하지 않아 조작값 유지.
- 근거: docs/22-community-ddl-and-feature-reference.md:696-701, 850
- 선행: ISSUE-02 확인 SQL(컬럼 grant)
- 난이도: 중 (컬럼 레벨 grant 재구성)

### ISSUE-04. author_name 클라이언트 임의 지정 — 사칭 가능
- 영역: Community / Auth
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: 로그인 사용자가 supabase-js 직접 호출로 "운영자" 등 임의 이름으로 게시 가능. XSS 전이는 없음(React 이스케이프).
- 기술적 영향: createPost가 author_name을 클라이언트 값으로 insert(communityService.js:83). RLS는 user_id만 검증.
- 근거: src/features/community/services/communityService.js:83, docs/22:693
- 선행: 없음
- 난이도: 중 (트리거로 서버측 강제 또는 프로필 조인)

### ISSUE-05. 로그아웃 시 localStorage 북마크 미정리
- 영역: Auth / 개인정보
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: 공용 기기에서 이전 사용자의 북마크(장소 객체 전체)가 다음 사용자에게 노출/잔존.
- 기술적 영향: `matgil.bookmarks` 키가 사용자 스코프 없음, removeItem/clear 호출 전무.
- 근거: src/shared/hooks/useBookmarks.jsx:3,25, src/pages/MyPage.jsx:117(로그아웃 경로)
- 선행: 없음 (단, /bookmark 자체가 고아 기능 — ISSUE-19와 함께 존폐 결정 권장)
- 난이도: 하

### ISSUE-06. updatePost에 user_id 필터 부재 (RLS 단일 의존)
- 영역: Community
- 심각도: medium | 상태: 버그 가능성
- 기술적 영향: `.eq('id', id)`만 사용 — RLS UPDATE 정책이 없거나 꺼지면 임의 글 수정 가능. deletePost/softDeletePosts는 user_id 병행(방어적) — 일관성 결여.
- 근거: src/features/community/services/communityService.js:93-97 (대조: 106-116, 294-304)
- 선행: ISSUE-02 확인
- 난이도: 하

### ISSUE-07. ADMIN_SEED_TOKEN 공유 시크릿 방식
- 영역: Edge Function
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: 토큰 1개 유출 시 시드/EN보강/LLM번역 파이프라인 전체 장악(service_role로 동작). 관리자 JWT 검증으로 전환 필요 — 관리자 기반(PLAN-admin-foundation)의 일부.
- 근거: supabase/functions/mg-tour-seed/index.ts:385-394 외 2개 함수 동일 패턴
- 선행: 관리자 역할 모델
- 난이도: 중

### ISSUE-08. supabase/config.toml 미버전관리 — verify_jwt 재현 불가
- 영역: Edge Function / 형상관리
- 심각도: low | 상태: 구조 개선
- 기술적 영향: 함수별 verify_jwt 설정을 코드로 확인·재현 불가. 배포 실수 시 감지 수단 없음.
- 근거: supabase/ 하위에 config.toml 부재(.temp만 존재)
- 난이도: 하

### ISSUE-09. Kakao JS 키 도메인 제한 여부 미확인
- 영역: 외부 API
- 심각도: low | 상태: 확인 필요
- 기술적 영향: VITE_KAKAO_MAP_JS_KEY는 번들 공개 전제 키 — Kakao 콘솔 도메인 화이트리스트 미설정 시 타 도메인 도용 가능.
- 근거: src/features/explore/map/loadKakaoMapSdk.js:28
- 난이도: 하 (콘솔 확인)

## 사용자 대면 오류

### ISSUE-10. 커뮤니티 mock 글 무음 폴백 — 가짜 데이터 위장 + 상호작용 무음 실패
- 영역: Community
- 심각도: **high** | 상태: 버그 가능성
- 사용자 영향: DB 0건 또는 fetch 실패 시 하드코딩 가짜 글 4개가 실데이터처럼 표시. 가짜 글 좋아요는 NaN insert 실패로 하트가 깜빡였다 꺼지고, 댓글 작성 실패는 무음(catch { // silent }) — 사용자는 원인을 알 수 없음.
- 기술적 영향: 프로덕션 DB 장애가 "정상 화면"으로 위장되어 장애 인지 불가.
- 근거: src/pages/CommunityPage.jsx:64-67(직접 확인), src/features/community/data/communityPosts.js, src/features/community/components/CommentBottomSheet.jsx:60-61
- 선행: 없음
- 난이도: 하~중

### ISSUE-11. GitHub Pages SPA 딥링크 404
- 영역: 배포
- 심각도: **high** | 상태: 확인 필요 (코드상 폴백 부재는 확정)
- 사용자 영향: `/matgil/community` 등에서 새로고침·링크 공유 시 404 예상.
- 기술적 영향: BrowserRouter 사용, 404.html·public/ 폴더 부재(Glob 확인). docs/24 §1 수정은 로컬 dev 전용.
- 근거: vite.config.js:5, src/app/App.jsx:8-9, 404.html 부재
- 선행: 실배포 URL에서 새로고침 재현 확인
- 난이도: 하 (404.html 복사 트릭)

### ISSUE-12. 게스트 locale이 새로고침 시 EN으로 강제 리셋
- 영역: i18n
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: 비로그인 사용자가 KO 선택 → 새로고침 → 영어로 복귀. 한국어권 게스트 UX 저해.
- 기술적 영향: INITIAL_SESSION(세션 없음)에서 setLocaleState('en') + localStorage 삭제 — 초기 useState의 localStorage 읽기를 즉시 덮어씀(직접 확인).
- 근거: src/shared/i18n/LocaleProvider.jsx:38-42
- 난이도: 하

### ISSUE-13. getPlaces 실패가 "주변에 코스 없음"으로 위장
- 영역: Map/Explore
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: DB 장애 시 에러 안내 없이 빈 상태 문구 표시. 재시도 수단 없음.
- 근거: src/pages/HomePage.jsx:57-59 `.catch(() => setPlacesLoading(false))`
- 난이도: 하

### ISSUE-14. 저장 코스 KO 저장 → EN 표시 시 한국어 잔존
- 영역: Saved Courses / i18n
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: KO 모드에서 저장한 코스를 EN으로 보면 정류지 이름(스냅샷에 EN 이름 자체가 없음)·주소·설명·부제목이 한국어로 노출. anchor_label도 EN 변환 불가(역매핑이 EN→KO만 존재).
- 근거: src/features/courses/utils/courseDisplay.js:56-73(getLocalizedStopName/getLocalizedLocationLabel), savedCourseService.js:14-53
- 선행: 스냅샷에 양언어 이름 보존 (스키마 변경 없이 stops jsonb 확장 가능)
- 난이도: 중

### ISSUE-15. 저장 코스 중복 판정이 제목 문자열 기준
- 영역: Saved Courses
- 심각도: medium | 상태: 버그 가능성
- 사용자 영향: (a) 정류지가 달라도 제목이 같으면 저장 불가 오탐, (b) EN 저장 후 KO 전환 시 같은 코스 중복 저장. 목록 배지(isSameCourse)는 place_ids 기준 — 판정 이원화.
- 근거: src/features/courses/services/savedCourseService.js:77-86(직접 확인), 88-97
- 난이도: 하 (place_ids 기준 통일)

### ISSUE-16. 지도 기준 위치 라벨이 클릭 시점 locale로 고정
- 영역: Map / i18n
- 심각도: low | 상태: 버그 가능성
- 사용자 영향: KO에서 GPS/"여기서 찾기" 사용 후 EN 전환 시 헤더 위치명이 한국어 잔존.
- 근거: src/pages/HomePage.jsx:110,125 — t() 결과를 state에 문자열로 저장
- 난이도: 하 (키 저장 후 표시 시점 해석)

### ISSUE-17. 화면 문구 하드코딩으로 locale 혼입 (양방향)
- 영역: i18n
- 심각도: low | 상태: 부분 구현
- 사용자 영향: EN 모드에 한국어('Parking: 가능' PlaceDetailSheet.jsx:69-70, '6자 이상' EditProfileSheet.jsx:85, '음식점' PopularPlaceCard.jsx:13), KO 모드에 영어(SignUpPage.jsx:45,49,61,89 검증문, VoiceHelpPlaceholder.jsx:46,53-55 — 사전 키 존재하는데 미사용, aria-label 전반).
- 난이도: 하~중 (사전 이관)

### ISSUE-18. /courses/:id 딥링크 시 mock 코스 노출
- 영역: 레거시
- 심각도: low | 상태: 버그 가능성
- 사용자 영향: URL 직접 입력 시 가짜 코스(c1~c3) + 동작 없는 "Start this course" 버튼.
- 근거: src/pages/CourseDetailPage.jsx:92-94, src/features/courses/data/courses.js
- 난이도: 하 (라우트 제거)

### ISSUE-19. /popular·/bookmark 고아 페이지 (locale 무시 + 한국어 하드코딩)
- 영역: 레거시
- 심각도: low | 상태: 구조 개선
- 사용자 영향: URL 직접 접근 시 getPlaces('ko') 고정·한국어 하드코딩 화면 노출. BookmarkProvider가 전역 상주.
- 근거: src/pages/PopularPage.jsx:14,23-35, src/pages/BookmarkPage.jsx, src/app/providers.jsx:12-18
- 난이도: 하 (존폐 결정 후 제거 또는 정식 편입)

### ISSUE-20. 커뮤니티 locale 폴백 시 출처 구분 불가
- 영역: Community / i18n
- 심각도: low | 상태: 구조 개선
- 사용자 영향: 현재 locale 글 0건이면 전체 locale 글을 표시(의도됨)하나, "다른 언어 글이 대신 보이는 중"임을 알 수 없음.
- 근거: src/pages/CommunityPage.jsx:41-44
- 난이도: 하

### ISSUE-21. 삼켜진 catch 블록 다수 — 에러↔빈 상태 미구분
- 영역: 전역
- 심각도: medium | 상태: 구조 개선
- 사용자 영향: 댓글 작성/삭제 실패, 저장 코스 목록 실패, 활동 카운트 실패 등이 조용히 무시되어 잘못된 화면 유지.
- 근거: CommunityPage.jsx:46,97 / CommentBottomSheet.jsx:35,60,73 / NearbySheet.jsx:109,120 / useAuth.jsx:69,74 / MyPage.jsx:33
- 난이도: 중 (에러 상태 표준 패턴 도입)

### ISSUE-22. 비밀번호 재설정(비로그인) 부재
- 영역: Auth
- 심각도: medium | 상태: 미구현
- 사용자 영향: 비밀번호 분실 시 계정 복구 수단 없음.
- 근거: resetPasswordForEmail 호출 전무(useAuth.jsx에 로그인 상태 updateUser만 존재)
- 난이도: 중 (메일 리다이렉트 + 복구 화면)

### ISSUE-23. 커뮤니티 신고/차단/모더레이션 부재
- 영역: Community
- 심각도: medium | 상태: 미구현 (docs/22:43에 의도된 제외로 기록)
- 사용자 영향: 부적절 콘텐츠 대응 수단이 수동 SQL뿐.
- 선행: 관리자 기반(역할 모델·admin RLS)
- 난이도: 중~상

## 구조 / 유지보수

### ISSUE-24. 관리자 기반 전무 (역할 모델·admin RLS·라우트 가드)
- 영역: 관리자
- 심각도: **high**(구조) | 상태: 미구현
- 기술적 영향: 코드에 role/admin 흔적 0. user_metadata는 클라이언트 쓰기 가능(LocaleProvider.jsx:54로 증명)이라 관리자 플래그로 부적합 — app_metadata 또는 별도 테이블 필요. 카테고리/번역/모더레이션/표현 카탈로그/수집 실행이 전부 코드 수정 또는 수동 SQL·curl.
- 근거: src 전체 grep(role/admin 히트는 ARIA 속성뿐), docs/sql-phrases…md:531("관리자 확장 전까지 쓰기 차단 유지")
- 난이도: 중

### ISSUE-25. 음식 카테고리 하드코딩 분산
- 영역: 카테고리 / 관리자 / i18n
- 심각도: **high**(구조) | 상태: 구조 개선
- 기술적 영향: 키·라벨은 exploreOptions.js(19종), 분류 키워드는 mg-tour-seed(17종, index.ts:175-205), 아이콘은 CategoryIcon.jsx PATHS, 특정 키 의미 의존 스코어링·제목은 courseBuilder.js(cafe 보너스/other 감점/street·bbq·noodle 분기). 카테고리 추가·수정 = 코드 수정 + 함수 재배포 + 기존 데이터 재분류 수단 없음.
- 근거: 감사 문서 §9, Agent D 의존성 맵
- 선행: ISSUE-24(관리 UI 시), pickLabel 헬퍼
- 난이도: 상

### ISSUE-26. "한국식 BBQ" 표기 정책 미반영
- 영역: 카테고리 / i18n
- 심각도: low | 상태: 미구현 (정책만 확정)
- 기술적 영향: KO 표시를 "고기 구이"로 바꾸려면 4곳 수정 필요: exploreOptions.js:6, courseDisplay.js:25, courseBuilder.js:132, dictionary.js:316(dead key — 삭제 대상). "고기 구이" 문자열은 리포에 아직 없음.
- 난이도: 하 (단, ISSUE-25 해결 시 1곳으로 축소)

### ISSUE-27. 코스 제목 템플릿 3중 복제
- 영역: 코드 중복
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: courseBuilder.js:129-143 ≡ courseDisplay.js:17-36 완전 중복 + dictionary courseTitle.* dead keys. 한쪽만 수정 시 신규 코스와 저장 코스 표시가 어긋남.
- 난이도: 하

### ISSUE-28. label/labelKo 픽커 삼항 10곳 산재 + locale 분기 27곳
- 영역: i18n
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: 공용 pickLabel 헬퍼 부재. 전 분기가 ko/en 이분법 — 제3언어 추가 시 25파일 수정.
- 근거: Agent D §2-3, §4 전수 목록
- 난이도: 하~중

### ISSUE-29. 고아 라우트 7개·데드 파일 4개·죽은 Provider 2개
- 영역: 레거시
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: 두 세대 코드 공존. RecommendationProvider/BookmarkProvider가 소비자 없는 채 전역 상주.
- 근거: 감사 문서 §3
- 난이도: 하

### ISSUE-30. getPlaces 전량 조회 3곳 중복 + 전역 페이지네이션 부재
- 영역: 성능
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: HomePage/PopularPage/recommendationService가 캐시 없이 동일 전체 쿼리. 커뮤니티/표현도 전량 조회. 데이터 증가 시 병목.
- 근거: src/api/placeApi.js:55-76 및 3개 임포터
- 난이도: 중

### ISSUE-31. 테스트·린트·CI 게이트 전무
- 영역: 품질
- 심각도: **high**(구조) | 상태: 미구현
- 기술적 영향: main 푸시 = 즉시 프로덕션 배포. 빌드 통과만이 유일한 게이트.
- 근거: package.json scripts, .github/workflows/deploy.yml
- 난이도: 하(lint+build 게이트)~중(테스트)

### ISSUE-32. PRICES/FEATURES 필터 잠복 버그
- 영역: Explore
- 심각도: low | 상태: 버그 가능성 (잠복)
- 기술적 영향: applyFilters가 r.price/r.features를 검사하나 normalize 결과에 해당 필드 없음 — UI 재활성화 즉시 전체 0건.
- 근거: src/features/explore/data/exploreOptions.js:53-60, src/api/placeApi.js normalizePlace
- 난이도: 하

### ISSUE-33. TTS 디버그 로그 프로덕션 잔존
- 영역: Phrases
- 심각도: low | 상태: 구조 개선
- 근거: src/features/phrases/services/ttsService.js:45,61,64,67-69,76,79,93,116 — `[TTS DEBUG]` 9곳
- 난이도: 하

### ISSUE-34. translation_provider·fetch_logs 미기록
- 영역: 데이터 파이프라인
- 심각도: low | 상태: 부분 구현
- 기술적 영향: mg-place-translate-en이 어느 LLM(OpenAI/Solar) 번역인지 DB에 남기지 않고, mg_api_fetch_logs에도 기록하지 않음(seed/enrich는 기록) — 번역 품질 이슈 추적 불가.
- 근거: supabase/functions/mg-place-translate-en/index.ts:338-357, ai-docs/03-ddl-rules.md:159-160(컬럼은 존재)
- 난이도: 하

### ISSUE-35. Storage 고아 이미지 누적
- 영역: Storage
- 심각도: low | 상태: 구조 개선 (의도된 정책)
- 기술적 영향: soft delete + 파일 실삭제 금지(docs/22:486-491) — 장기 누적. 정리 배치 또는 수명 정책 필요.
- 난이도: 중

### ISSUE-36. mg_phrases 다국어 구조 한계
- 영역: Phrases / i18n
- 심각도: medium | 상태: 구조 개선
- 기술적 영향: 뜻이 en_text 단일 컬럼(KO UI에서도 뜻이 영어로 표시 — 의도 여부 불확실). 제3언어는 컬럼 추가 또는 texts 테이블 분리 필요.
- 근거: src/features/phrases/services/phraseService.js:17-26, PhraseCard.jsx:37-40
- 난이도: 중

### ISSUE-37. AUTH_ERROR_KO 매핑 중복 + 미번역 검증문
- 영역: Auth / i18n
- 심각도: low | 상태: 구조 개선
- 근거: LoginForm.jsx:12-18 / SignUpPage.jsx:13-18 부분 중복. ISSUE-17과 연동.
- 난이도: 하

### ISSUE-38. VoiceHelp가 서비스 계층 없이 Edge Function 직접 호출 + 파일명 불일치
- 영역: 구조
- 심각도: low | 상태: 구조 개선
- 근거: VoiceHelpPlaceholder.jsx:39 — 이름은 Placeholder이나 실구현체. supabase 직접 import는 이 컴포넌트가 유일한 예외.
- 난이도: 하

---

## 심각도 집계

| 심각도 | 건수 | 이슈 |
|---|---|---|
| critical | 0 | — (단, ISSUE-02가 "RLS 미활성"으로 확인되면 critical로 승격) |
| high | 7 | 01, 02, 03, 10, 11, 24, 25, 31 중 구조성 포함 시 8 |
| medium | 14 | 04, 05, 06, 07, 12, 13, 14, 15, 21, 22, 23, 27, 28, 29, 30, 36 |
| low | 나머지 | — |
