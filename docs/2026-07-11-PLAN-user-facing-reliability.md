# PLAN: 사용자 대면 신뢰성 — 무음 실패 제거·레거시 차단 (우선순위 2위)

관련 이슈: ISSUE-10, 11, 12, 13, 16, 18, 19, 21, 29, 33 (2026-07-11-MATGIL-OPEN-ISSUES.md)

## 1. 작업 제목
커뮤니티 mock 폴백 제거, 에러↔빈 상태 분리, 게스트 locale 유지, SPA 404 폴백, 레거시 라우트 정리

## 2. 현재 문제
- CommunityPage.jsx:64-67 — DB 0건/실패 시 가짜 글 4개가 실데이터처럼 표시되고, 가짜 글에 대한 좋아요·댓글이 조용히 실패한다.
- HomePage.jsx:57-59 — getPlaces 실패가 "주변에 코스 없음"으로 위장된다.
- LocaleProvider.jsx:38-42 — 비로그인 사용자의 언어 선택이 새로고침마다 EN으로 리셋된다.
- 404.html 부재 — GitHub Pages에서 딥링크 새로고침 404 예상(BrowserRouter).
- 고아 라우트 7개(/area·/preference·/loading·/result·/courses/:id·/popular·/bookmark)로 딥링크 진입 시 가짜/한국어 고정 화면 노출. 데드 파일 4개, 죽은 Provider 2개 전역 상주.
- 삼켜진 catch 9곳(감사 문서 §9)이 실패를 무음 처리.
- HomePage.jsx:110,125 — 위치 라벨이 클릭 시점 locale 문자열로 고정.

## 3. 사용자 영향
현재 배포본에서 사용자가 실제로 겪는 결함 묶음: 가짜 게시글, 이유 없는 상호작용 실패, 언어 리셋, 새로고침 404, 레거시 화면 노출.

## 4. 목표
"실패는 보이게, 가짜는 없게": 모든 원격 실패가 사용자에게 식별 가능한 상태로 표시되고, 도달 불가 화면과 mock 데이터가 프로덕션 경로에서 사라진다.

## 5. 이번 작업 범위
1. mock 폴백 제거: dbPosts 실패 → 에러 상태 + 재시도 버튼, 0건 → 빈 상태 문구(사전 키 신설).
2. 에러/빈 상태 분리 패턴: HomePage(getPlaces), CommunityPage, CommentBottomSheet(댓글 작성·삭제 실패 토스트), MyPage 활동 카운트.
3. 게스트 locale 유지: 세션 없는 INITIAL_SESSION에서 localStorage 값 존중.
4. 404.html 추가(GitHub Pages SPA 리다이렉트 트릭: 404.html이 index.html 복사본 또는 sessionStorage 리다이렉트 방식) + public/ 디렉터리 신설.
5. 레거시 정리: 고아 라우트 7개 제거, 데드 파일 4개 삭제, RecommendationProvider/BookmarkProvider 제거(또는 /popular·/bookmark를 정식 기능으로 살릴지 결정 — 기본안: 제거), 관련 mock 파일 삭제, dictionary courseTitle.* dead keys 삭제.
6. 위치 라벨 stale 수정: selectedLocation에 label 대신 `labelKey`(프리셋 키 또는 'gps'/'pin' 마커)를 저장하고 표시 시점에 t()/labelKo 해석.
7. TTS 디버그 로그 9곳 제거.

## 6. 제외 범위
- 저장 코스 locale 정합성(PLAN-i18n-consolidation), 하드코딩 문구 전면 사전 이관(동일), 페이지네이션, CI 게이트(차순위 별도), 신고 기능.

## 7. 현재 관련 코드 흐름
- 커뮤니티: loadPosts → fetchPosts(locale) → 0건 시 전체 locale 재조회 → catch { setDbPosts([]) } → 렌더에서 dbPosts.length===0이면 COMMUNITY_POSTS 사용.
- 지도: HomePage useEffect([locale]) → getPlaces → catch 무음 → NearbySheet가 "No routes found nearby" 표시.
- 라우터: router.jsx 30-49행에 15개 라우트, 와일드카드는 `/` 리다이렉트.
- 부팅: LocaleProvider useState(localStorage) → onAuthStateChange가 즉시 덮어씀.

## 8. 수정할 파일
- `src/pages/CommunityPage.jsx` — mock 폴백 제거, status('loading'|'error'|'ready') 상태 추가, 에러 시 재시도 UI.
- `src/features/community/data/communityPosts.js` — COMMUNITY_POSTS 삭제(COMMUNITY_FILTERS는 유지 — 사용 중).
- `src/features/community/components/CommentBottomSheet.jsx` — 작성/삭제 실패 시 오류 문구 표시(catch 무음 3곳).
- `src/pages/HomePage.jsx` — placesError 상태 + 재시도, selectedLocation labelKey 방식 전환(110,125행).
- `src/features/explore/components/NearbySheet.jsx` — 에러 상태 표시 분기 추가.
- `src/shared/i18n/LocaleProvider.jsx` — 38-42행을 `localStorage 값이 있으면 유지`로 변경, courseTitle dead keys 삭제는 dictionary.js에서.
- `src/shared/i18n/dictionary.js` — 신규 키(community.loadError, community.empty, common.retry, map.loadError 등) EN/KO 추가, courseTitle.* 삭제.
- `src/app/router.jsx`, `src/shared/constants/routes.js` — 고아 라우트 7개 제거.
- `src/app/providers.jsx` — RecommendationProvider/BookmarkProvider 제거.
- `src/pages/MyPage.jsx` — 활동 카운트 실패 표시(선택: '—' 표기).
- `src/features/phrases/services/ttsService.js` — [TTS DEBUG] 로그 제거.
- `vite.config.js` — (필요 시) 404.html 복사 설정. Vite는 public/ 폴더를 자동 복사하므로 보통 불필요.

## 9. 새로 만들 파일
- `public/404.html` — GitHub Pages SPA 폴백(경로를 쿼리로 보존해 index.html로 리다이렉트하는 표준 spa-github-pages 스크립트 + index.html 측 복원 스크립트).
- (index.html에 복원 스크립트 삽입 — 기존 파일 수정)

## 10. DB 변경 필요 여부
불필요.

## 11. DDL/DML 초안
해당 없음.

## 12. RLS/트리거/인덱스 영향
없음.

## 13. 기존 데이터 마이그레이션
없음. 삭제 파일 목록: mockAuthService.js, PostCommentSection.jsx, mockPopularPlaces.js, mockRecommendations.js, mockAreas.js, preferenceOptions.js, courses/data/courses.js, AreaPage/PreferencePage/LoadingPage/ResultPage/CourseDetailPage/PopularPage/BookmarkPage, AreaSelector, PreferenceSelector, RecommendationCard/Summary, recommendationService.js, useRecommendation.jsx, useBookmarks.jsx, PopularPlaceCard.jsx, Header.jsx(위저드 전용 — StepIndicator 포함, 다른 사용처 없는지 재확인 후).

## 14. 하위 호환 전략
- 제거된 경로는 기존 와일드카드(`*` → `/`)가 흡수 — 별도 리다이렉트 불필요.
- 북마크 localStorage 데이터는 기능 제거 시 함께 정리(removeItem 1회성 코드는 두지 않고 방치 — 무해).

## 15. 단계별 구현 순서
1. 게스트 locale 수정(LocaleProvider) — 독립·저위험.
2. 404.html + index.html 복원 스크립트 → 배포 후 딥링크 새로고침 확인.
3. 커뮤니티 mock 폴백 제거 + 에러/빈 상태(사전 키 포함).
4. HomePage/NearbySheet 에러 상태 + 위치 라벨 labelKey 전환.
5. CommentBottomSheet·MyPage 무음 catch 정리, TTS 로그 제거.
6. 레거시 라우트·파일·Provider 일괄 제거 → 빌드·전 화면 스모크.

## 16. 사용자 수동 작업
- 배포 후 실URL에서 딥링크 새로고침 확인(REQUIRED-USER-INPUTS N-1).
- /popular·/bookmark를 "제거"가 아니라 "정식 기능화"로 원하면 사전에 결정 필요(기본안: 제거).

## 17. 롤백 방법
- 단계별 커밋 분리 → 문제 단계만 revert. 삭제 파일은 git 이력으로 복원 가능.

## 18. 엣지 케이스
- 커뮤니티 글 0건 + locale 폴백 0건 → 빈 상태 문구(가짜 글 아님).
- 오프라인 상태에서 지도 탭 진입 → 에러 상태 + 재시도.
- 404.html 리다이렉트와 basename(/matgil) 조합 — 리다이렉트 스크립트의 pathSegmentsToKeep=1 설정 필요.
- 게스트 localStorage에 'ko' 저장 후 로그인(preferred_locale='en') → 로그인 사용자 metadata가 우선(기존 동작 유지).
- StrictMode 이중 마운트에서 onAuthStateChange 중복 발화 — 기존 구조 유지로 영향 없음.

## 19. 회귀 위험
- Provider 제거 시 숨은 소비자가 있으면 크래시 — 제거 전 useRecommendation/useBookmarks import 전수 grep 필수(현재 파악: 고아 화면뿐).
- 라우트 제거로 ROUTES 상수 참조가 남으면 빌드 에러 — routes.js와 참조부 동시 정리.
- CommunityPage 상태 머신 변경이 좋아요 낙관적 업데이트 흐름과 얽히지 않게 loadPosts 시그니처 유지.

## 20. 테스트 시나리오
1. Supabase URL을 임시로 틀리게 한 dev 환경에서: 지도 탭 → 에러+재시도 표시(빈 상태 아님), 커뮤니티 → 에러+재시도(가짜 글 없음).
2. 정상 환경, 글 0건 locale → 빈 상태 문구.
3. 게스트가 KO 선택 → 새로고침 → KO 유지. 로그아웃 시 EN 리셋(기존 정책 유지 여부 결정 — 기본안: 로그아웃도 localStorage 유지로 변경할지 확인 필요, 최소한 게스트 새로고침은 유지).
4. 배포본에서 /matgil/community 새로고침 → 정상 렌더.
5. /area, /popular 등 구 URL 직접 입력 → `/`로 리다이렉트.
6. KO에서 GPS 사용 → EN 전환 → 헤더 위치명 영어로 갱신.
7. 댓글 작성 실패(네트워크 차단) → 오류 문구 노출.
8. 전 탭 스모크: 지도/코스/표현/커뮤니티/마이 + 로그인/가입.

## 21. 완료 기준
- mock 글이 어떤 조건에서도 표시되지 않음. 모든 원격 실패에 사용자 가시 표시 존재. 게스트 locale 유지. 배포본 딥링크 새로고침 정상. 고아 라우트 0. `npm run build` 성공.

## 22. 작업 후 확인 명령
```bash
npm run build
npx vite preview   # 프리뷰에서 20번 시나리오 수동 확인
grep -rn "COMMUNITY_POSTS\|mockAuthService\|mockRecommendations\|mockPopularPlaces\|TTS DEBUG" src/ || echo CLEAN
```
