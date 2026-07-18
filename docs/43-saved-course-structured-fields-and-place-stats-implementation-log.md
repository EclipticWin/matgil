# 43. 저장 동선 구조화 필드 연결 + 가게 통계 표시 구현 로그

## 작업 일시

- 일자: 2026-07-18
- 시각: 14:56 KST(작업 종료 기준)

## 작업 목적

`docs/42-saved-course-db-structure-and-duplicate-prevention.md`에서 준비된 DB 구조(가게 저장 수 View, 저장 동선 구조화 컬럼, 활성 동선 중복 방지 인덱스)를 실제 애플리케이션 코드에 연결한다. 구체적으로:

1. 동선 상세/가게 상세에 평균 별점·리뷰 수·저장 수 표시
2. Saved Courses 가게 카드 클릭 시 전체 화면 가게 상세로 이동
3. 신규 저장 동선에 구조화된 기준 위치·취향·테마·`route_signature`·`title_schema_version = 2` 저장
4. 지도 임의 위치의 역지오코딩
5. 현재 선택 언어 기준 제목/기준 위치/취향 표시(저장 당시 언어와 무관)
6. 동선 중복 저장 오류의 사용자 친화적 처리
7. 기존(`title_schema_version = 1`) 데이터 하위 호환

이번 작업은 Supabase SQL을 다시 실행하지 않았고, DB 스키마도 변경하지 않았다.

## 시작 상태

- branch: `main`(원 작업 디렉터리) — 이번 작업은 격리된 worktree(`worktree-sprightly-pondering-owl`)에서 수행
- HEAD: `c5fa283b239ed64f7e3f13a3cd7ab6bbdd6d5629` ("feat: Voice Help LLM 호출을 Solar 1차 + OpenAI fallback 구조로 전환")
- 시작 시 `git status`: 아래 5개 파일이 **미커밋 상태**로 이미 수정되어 있었음(직전 세션의 `docs/41` 작업 결과물)
  - `src/features/courses/services/savedCourseService.js`
  - `src/features/courses/utils/courseDisplay.js`
  - `src/features/explore/components/TodayCourseDetail.jsx`
  - `src/pages/SavedCourseDetailPage.jsx`
  - `src/shared/i18n/dictionary.js`
  - 추가로 `docs/41-*.md`, `docs/42-*.md`가 untracked 상태로 존재
- worktree는 원 작업 디렉터리와 동일한 HEAD(`c5fa283`)에서 생성되었으나, **격리된 worktree라 위 미커밋 변경분이 자동으로 포함되지 않았다** — 원 작업 디렉터리에서 `git diff`로 해당 5개 파일의 diff를 추출해 worktree에 `git apply`로 그대로 재적용한 뒤, 그 위에 이번 작업을 이어갔다(§"기존 미커밋 변경 삭제·초기화 금지" 규칙 준수 — diff를 그대로 복제했을 뿐 내용을 바꾸지 않았다).

## 사전 조사 결과(요약)

- **저장 동선 저장 경로**: `NearbySheet.jsx`의 `handleSave()` → `savedCourseService.saveCourse()`. `course` 객체는 `courseBuilder.js`의 `buildRecommendedCourses()`가 생성.
- **`selectedLocation` 구조**: `HomePage.jsx`에서 생성. preset은 `{ key, label, labelKo, lat, lng, type }`(`source` 필드 없음), 검색은 `{ key: null, label, lat, lng, source: 'search', address, categoryGroupCode }`(`SearchOverlay.jsx`), 지도 중심은 `{ key: 'map_center', label, labelKo, lat, lng, source: 'map', address: null }`, GPS는 `{ key: 'current_location', ..., source: 'gps' }`.
- **취향 선택 state**: `HomePage.jsx`의 `filters.cat`(배열, `FilterSheet.jsx`에서 최대 3개 선택) — 값은 `matgil_category_keys`와 동일한 DB 카테고리 키(`bbq`, `cafe`, `noodle`, `seafood` 등, `foodCategoryFallback.js` 참고). 이 값이 추천 코스 스코어링(`courseBuilder.js`)에는 쓰이지만 저장 시점까지 전달되지는 않고 있었다.
- **`course` 객체의 테마 정보**: 명시적인 테마 필드는 없음. `courseDisplay.js`의 `detectTitleType(stops)`이 매 렌더링마다 `stops[].matgilCategoryKeys`로 재추정해 제목 템플릿을 고르는 방식.
- **`savedCourseService.js` 기존 payload**: `user_id/locale/title/subtitle/description/anchor_label/total_distance_m/total_duration_min/stop_count/place_ids/stops/course_snapshot` — `docs/42`에서 추가된 신규 컬럼은 전혀 채우지 않고 있었음.
- **`normalizeSavedCourseForDisplay()`**: `courseDisplay.js`에 존재(직전 `docs/41` 작업분). `getLocalizedCourseTitle()`을 무조건 호출해 v1 방식(스톱 카테고리 재추정)으로만 제목을 만듦.
- **Map 동선 상세/Saved Courses 상세**: 각각 `TodayCourseDetail.jsx`(바텀시트) / `SavedCourseDetailPage.jsx`(독립 페이지, `/saved-courses/:id`). 둘 다 `docs/41`에서 `formatStopRatingLine()` + `fetchPlaceReviewStatsBatch()` 배치 조회가 이미 적용되어 있었음(리뷰만, 저장 수 없음).
- **가게 상세 바텀시트**: `PlaceDetailSheet.jsx`(Map 전용, 탭형 섹션 구조 — 메뉴/리뷰/위치/방문정보). 리뷰 통계는 자체적으로 단일 조회.
- **전체 화면 상세 route**: `/places/:placeId/reviews` → `PlaceReviewsPage.jsx`가 이미 존재했으나 **리뷰 목록 전용**(메뉴/위치/영업정보 없음, 저장 하트 없음) — 요구된 "가게 전체 상세"에 해당하지 않아 재사용 대신 신규 라우트 `/places/:placeId`를 추가.
- **저장 장소 bookmark 서비스**: `placeBookmarkService.js`(`mg_place_bookmarks` CRUD). 저장 수 batch 조회 함수는 없었음(신규 추가).
- **리뷰 통계 batch**: `placeReviewService.js`의 `fetchPlaceReviewStatsBatch(placeIds)`(기존, 재사용).
- **i18n**: `LocaleProvider.jsx` — `t(key, params)`가 `{param}` 치환을 지원, locale은 `en`/`ko` 2종.
- **카카오 검색 결과 객체**: `SearchOverlay.jsx`의 `onSelect`가 `{ place_name, y, x, address_name, road_address_name, category_group_code }`를 소비. 기존에는 `address_name`(지번)만 저장 — 이번에 도로명 우선으로 수정.
- **역지오코딩 기존 기능**: 없었음(`Geocoder` 미사용). Kakao SDK는 `libraries=services`로 이미 로드되어 있어 `kakao.maps.services.Geocoder`를 바로 쓸 수 있음(`loadKakaoMapSdk.js` 확인).
- **라우터**: `BrowserRouter`(`App.jsx`, `basename`은 GitHub Pages 배포 시 `/matgil`) — HashRouter 아님. 기존 `/places/:placeId/reviews`도 동일하게 새로고침 시 404 위험을 이미 안고 있음(`docs/32` 감사에서도 지적된 기존 한계이며, 이번 신규 라우트 `/places/:placeId`도 같은 특성을 그대로 공유한다 — 이번 작업으로 새로 생긴 문제 아님).

## 구현 요약

전부 §0의 금지 규칙(SQL 실행/스키마 변경/View·인덱스 재생성/새 패키지 설치/대규모 리팩터링 없음)을 지키며 진행했다.

## 변경 파일 상세

| 파일 | 변경 내용 |
|---|---|
| `src/features/places/services/placeBookmarkService.js` | `fetchPlaceBookmarkStatsBatch(placeIds)` 추가 — `mg_place_bookmark_stats`를 `place_id in (...)`로 1회 조회, `Map<place_id, save_count>` 반환. 저장한 사용자 ID/목록은 절대 조회하지 않음. |
| `src/features/explore/data/seoulDistricts.js` | (신규) `SearchOverlay.jsx`에 있던 `SEOUL_DISTRICT_EN` 구 단위 한→영 매핑을 공유 모듈로 추출(`translateSeoulDistrict()` 추가) — 검색 결과 주소 표시와 지도/GPS 역지오코딩 지역명 표시가 같은 매핑을 재사용하도록. |
| `src/features/explore/components/SearchOverlay.jsx` | 위 매핑을 import로 교체(로직 동일, 중복 제거). 검색 결과 저장 시 `address`를 지번(`address_name`) 대신 **도로명 우선**(`road_address_name \|\| address_name`)으로 변경(§12 요구사항). |
| `src/features/explore/services/reverseGeocodeService.js` | (신규) `reverseGeocodeCoords(lat, lng)` — 기존에 로드된 Kakao `services.Geocoder`(`coord2Address`)로 `{ address, area }`를 반환. `area`는 구 단위 원본 한국어 지역명. SDK/키 없음, 매칭 실패 등 모든 실패는 `null` 반환(throw 없음, best-effort). |
| `src/pages/HomePage.jsx` | `handleFindHere()`/`handleGpsClick()`에서 위치 확정 직후 `reverseGeocodeCoords()`를 비동기 호출해 `selectedLocation.address/area`를 보강(같은 위치가 유지 중일 때만 반영 — 이후 위치가 또 바뀌면 stale 응답 무시). `NearbySheet`에 `selectedFoodTypes={filters.cat}` prop 추가 전달. |
| `src/features/explore/components/NearbySheet.jsx` | `selectedFoodTypes` prop 추가, `saveCourse()` 호출 시 `preferenceKeys: selectedFoodTypes`로 전달. `saveState`에 `'duplicate'` 상태 추가 — `DuplicateCourseError`를 잡아 일반 실패와 구분. |
| `src/features/courses/services/savedCourseService.js` | `saveCourse()`가 `preferenceKeys`를 받아 `anchor_type/anchor_key/anchor_name_original/anchor_area_original/anchor_address_original/anchor_lat/anchor_lng/preference_keys/course_theme_key/route_signature/title_schema_version(=2)`를 함께 insert. `buildAnchorFields()`(selectedLocation → anchor_* 매핑), `buildRouteSignature()`(정렬·중복제거 후 `-` 조인), `DuplicateCourseError`(Postgres `23505` 캐치) 추가. `checkCourseAlreadySaved()`/`isSameCourse()`를 순서 무관 비교(정렬 후 비교)로 수정 — DB의 새 `route_signature` UNIQUE 규칙과 클라이언트 사전 판정을 일치시킴. 기존 `course_snapshot` 보강 로직(§`docs/41`)은 그대로 유지. |
| `src/features/courses/utils/courseDisplay.js` | `formatStopRatingLine()` → `formatPlaceRatingSaveLine(stats, saveCount, noRatingsLabel)`로 교체(별점+리뷰 수+저장 수 헤드 문자열, 거리는 분리). `computeDominantCategoryKey()`/`computeCourseThemeKey()`(테마 키 결정), `getAnchorLocationPart()`/`getCourseThemeLabel()`/`getSavedCourseDisplayTitle()`/`getSavedCourseAnchorLine()`/`getSavedCoursePreferenceLine()` 추가 — 전부 `title_schema_version >= 2`일 때만 구조화 필드를 쓰고, 그 미만은 기존 v1 로직(`getLocalizedCourseTitle`/`getSavedCourseAnchorDisplay`)을 그대로 호출해 하위 호환을 보장. `normalizeSavedCourseForDisplay()`가 `helpers`(`{ getCategoryLabel, t }`)를 받아 제목 생성에 사용하도록 시그니처 확장. |
| `src/features/explore/components/TodayCourseDetail.jsx` | 저장 수 batch 조회(`fetchPlaceBookmarkStatsBatch`) `useEffect` 추가(리뷰 조회와 별개, 1회). 스톱 카드 3번째 줄을 `formatPlaceRatingSaveLine()` + `formatStopDistance()`를 각각 별도 flex 항목으로 렌더링(좁은 화면에서 거리만 다음 줄로 줄바꿈, `truncate` 제거). 저장 버튼에 `saveState === 'duplicate'` 분기 추가. |
| `src/pages/SavedCourseDetailPage.jsx` | 위와 동일한 저장 수 batch 조회 추가. 헤더에 `기준 위치`/`선택 취향` 줄 추가(`getSavedCourseAnchorLine`/`getSavedCoursePreferenceLine`, 값 없으면 줄 자체 숨김). 스톱 카드를 `Link`(`react-router-dom`)로 감싸 `/places/:placeId`로 이동(place id 없는 비정상 데이터는 클릭 불가능한 기존 `div`로 폴백). 카드 3번째 줄도 Today와 동일하게 별점+저장수/거리 분리 렌더링. |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 저장 수 단일 조회(`fetchPlaceBookmarkStatsBatch([place.id])`) 추가, 평균 별점 줄 옆에 `♥ {saveCount}` 표시(Map 바텀시트·신규 전체 화면 상세 양쪽에 공통 반영 — 같은 컴포넌트라 한 번만 수정). 북마크 토글 시 저장 수도 낙관적으로 ±1(실패 시 원복). |
| `src/features/courses/components/SavedRoutesTab.jsx` | 목록 카드 제목을 `getLocalizedCourseTitle()` 직접 호출 대신 `getSavedCourseDisplayTitle(saved, locale, { getCategoryLabel, t })`로 교체 — v2 저장 코스도 목록에서부터 구조화 제목이 보이도록. |
| `src/pages/PlaceDetailPage.jsx` | (신규) `/places/:placeId` — 전체 화면 가게 상세. 기존 `PlaceDetailSheet`를 그대로 재사용(새 디자인 없음). Saved Courses에서 넘어올 때는 router state의 `place` 객체(이미 로드된 stop 데이터)를 그대로 쓰고, state 없이 직접 접근한 경우에만 `getPlaceById()`로 폴백 조회. `selectedLocation`은 `null`로 고정(저장 당시 기준 위치 복원 안 함), stop에 남아있을 수 있는 저장 당시 `distanceKm`은 `null`로 지워 표시하지 않음(§8 요구사항). |
| `src/app/router.jsx` | `<Route path={ROUTES.placeDetail(':placeId')} element={<PlaceDetailPage />} />` 추가(전체 화면 그룹, `AppLayout` 밖 — 기존 `/places/:placeId/reviews`와 동일 그룹). |
| `src/shared/constants/routes.js` | `placeDetail: (placeId) => \`/places/${placeId}\`` 추가. |
| `src/shared/i18n/dictionary.js` | `courseDetail.startingPointLine`/`preferencesLine`, `courseTitle.withLocation`/`themeOnly`/`areaSuffix`/`defaultTheme`, `savedCourses.duplicateError` 키를 EN/KO 양쪽에 추가. 기존 키(`noRatings` 등)는 재사용, 중복 추가 없음. |

## 가게 카드 표시 결과

- 리뷰 있음: `★ 4.6 (2) · ♥ 3` 다음 줄 없이 이어서 `241 m`(공간 충분 시 한 줄)
- 리뷰 없음: `평점 없음 · ♥ 3 · 241 m`(KO) / `No ratings · ♥ 3 · 241 m`(EN)
- 저장 수 0: `♥ 0`(숨기지 않음)
- 좁은 화면: `★ 4.6 (2) · ♥ 3`까지가 한 덩어리(`whitespace-nowrap`)로 유지되고, 거리만 `flex-wrap`으로 다음 줄에 배치됨. 고정 breakpoint를 추가하지 않고 flex 컨테이너의 자연스러운 줄바꿈만 사용.

## 통계 조회 구조

- 리뷰 통계: 동선당 1회(`fetchPlaceReviewStatsBatch`, 기존 유지)
- 저장 수: 동선당 1회(`fetchPlaceBookmarkStatsBatch`, 신규) — 리뷰 통계와 별도 View라 별도 요청 1회는 허용 범위(§6)
- 가게 상세(`PlaceDetailSheet`): 리뷰 통계 1회(기존) + 저장 수 1회(신규, 단일 ID 배치 함수 재사용)
- N+1 방지: 두 batch 모두 `stopIdsKey`(id 집합을 dedup한 원시 문자열) 의존성으로 실행 — 정류지 배열/객체 참조가 아니라 실제 id 구성이 바뀔 때만 재조회
- 실패 시: `.catch()`가 빈 `Map`/`0`으로 대체 → 화면은 정상 렌더, 리뷰는 "평점 없음", 저장 수는 `0`으로 표시(요구사항의 "안전한 fallback")

## 전체 화면 가게 상세

- route: `/places/:placeId`(`ROUTES.placeDetail`)
- 재사용: `PlaceDetailSheet.jsx`(메뉴/리뷰/위치/방문정보 탭, 북마크 하트, 리뷰 CRUD 전부 그대로) — 새 디자인 없이 페이지 wrapper만 추가
- 뒤로 가기: `window.history.length > 1`이면 `navigate(-1)`(브라우저 히스토리로 원래 Saved Courses 상세 복귀), 히스토리가 없으면 `/courses`로 폴백(딥링크 직접 접근 대비)
- Map의 기존 바텀시트 흐름(`TodayCourseDetail` → `PlaceDetailSheet`)은 변경하지 않음 — Saved Courses에서만 전체 화면 이동 적용

## 신규 저장 필드 매핑

| 컬럼 | 값 |
|---|---|
| `anchor_type` | `selectedLocation.source`가 `search`/`gps`/`map`이면 그대로, 없으면(`preset`) `'preset'` |
| `anchor_key` | preset일 때만 `selectedLocation.key`, 그 외 `null` |
| `anchor_name_original` | search일 때만 `selectedLocation.label`(장소명), 그 외 `null` |
| `anchor_area_original` | map/gps일 때만 `selectedLocation.area`(역지오코딩 구 이름), 그 외 `null` |
| `anchor_address_original` | map/gps일 때만 `selectedLocation.address`(역지오코딩 도로명 주소), 그 외 `null` |
| `anchor_lat`/`anchor_lng` | 항상 `selectedLocation.lat/lng`(유효 숫자일 때만) |
| `preference_keys` | `filters.cat` 배열(사용자가 선택한 내부 카테고리 키, 번역 문자열 아님) |
| `course_theme_key` | `preference_keys[0]` 우선, 없으면 스톱 `matgilCategoryKeys`의 최빈값('other' 제외), 둘 다 없으면 `null`(표시 시 안전한 기본 테마로 대체) |
| `route_signature` | `place_ids` 숫자 정규화 → 중복 제거 → 오름차순 정렬 → `-` 조인. 빈 경우 `null`(DB 부분 UNIQUE 인덱스가 `route_signature is not null` 조건이므로 의도된 동작) |
| `title_schema_version` | 신규 저장은 항상 `2` |

## 위치 종류별 저장 방식

- **preset**: `anchor_type='preset'`, `anchor_key`(예: `city_hall`) 저장 — 표시 시 `PRESET_LOCATIONS`에서 현재 locale로 재번역
- **search**: `anchor_type='search'`, `anchor_name_original`에 Kakao 장소명 저장(주소는 도로명 우선으로 `address_original`에도 저장하지만, 제목/기준위치 표시에는 이름을 우선 사용)
- **map**(지도 중심 "여기서 동선 찾기"): `anchor_type='map'`, 좌표 즉시 저장 + 역지오코딩 결과(구 이름/도로명 주소)를 비동기로 보강
- **gps**: `anchor_type='gps'`, 동일하게 좌표 즉시 저장 + 역지오코딩 비동기 보강

## 역지오코딩 구현

- 기존 Kakao Maps SDK(`libraries=services`, `loadKakaoMapSdk.js`)에 이미 포함된 `kakao.maps.services.Geocoder.coord2Address()`를 그대로 사용(새 패키지/외부 API 없음)
- 실패(SDK 미로드, 키 없음, 매칭 없음) 시 `null` 반환 — 저장 자체는 좌표만으로 계속 진행되고 `anchor_area_original`/`anchor_address_original`은 `null`로 남음(§22 요구사항)
- `선택한 지역`/`현재 위치` 제거 방식: 이 문자열들은 `selectedLocation.label`(UI 임시 표시용)에만 남고, DB에는 애초에 저장되지 않음(`anchor_area_original`은 오직 역지오코딩 결과만 사용) — 신규 저장 데이터에는 이 제네릭 라벨이 구조적으로 들어갈 수 없음

## 다국어 처리

- `mg_saved_courses.locale`(저장 당시 언어)은 기록용으로만 남기고 표시 로직에서 참조하지 않음 — 모든 표시는 `useLocale()`의 현재 `locale` 기준
- 제목: `title_schema_version >= 2`이면 `anchor_key`(프리셋 번역)/`anchor_name_original`(검색 장소명)/`anchor_area_original`(역지오코딩, 현재 locale로 구 이름 번역 후 "일대"/"Area" 접미사는 UI 템플릿에서 부착) 중 하나 + `course_theme_key`의 카테고리 라벨(`useFoodCategories().getCategoryLabel`, DB 번역 재사용)을 `courseTitle.withLocation`/`themeOnly` i18n 템플릿에 주입해 매번 재생성
- 기준 위치 줄: `courseDetail.startingPointLine`, 취향 줄: `courseDetail.preferencesLine` — 둘 다 값이 없으면 줄 자체를 숨김
- 기존 데이터(`title_schema_version = 1`): `getLocalizedCourseTitle()`(기존 로직, 변경 없음)을 그대로 사용 — 알려진 프리셋 라벨(`Seoul City Hall`/`서울시청` 등) 재번역, `선택한 지역`/`Selected area`류는 계속 숨김 처리(`docs/41`에서 이미 구현됨)

## 동선 중복 처리

- `route_signature` 예: `place_ids=[980, 92, 477]` → `route_signature='92-477-980'`
- unique violation 감지: Supabase insert 에러의 `error.code === '23505'`(Postgres unique_violation)를 확인해 `DuplicateCourseError`로 변환 — 그 외 에러는 그대로 재throw(모든 실패를 중복으로 오인하지 않음)
- 사용자 메시지: `savedCourses.duplicateError` 키(KO: `이미 저장된 동선입니다.` / EN: `This route is already saved.`) — 저장 버튼이 회색으로 바뀌며 3초 후 원상복귀(기존 실패 상태와 동일한 UX 패턴)
- 클라이언트 사전 판정(`checkCourseAlreadySaved`/`isSameCourse`)도 순서 무관 비교로 함께 수정해 "이미 저장됨" 뱃지가 DB 판정과 일치하도록 함

## 개인정보 처리

- `mg_place_bookmark_stats`(place_id, save_count만 보유)만 조회 — 저장한 사용자 ID/이름/목록은 어떤 코드 경로에서도 조회·전달하지 않음
- `fetchPlaceBookmarkStatsBatch()`는 개수만 반환하는 `Map<place_id, save_count>` — 이 Map 이상의 정보를 UI에 전달하지 않음

## DB 작업 여부

- Supabase SQL 실행: 없음
- 스키마 변경(컬럼/View/인덱스/제약조건 추가·수정): 없음
- Edge Function 배포: 없음
- Supabase secret 변경: 없음
- 기존 데이터 일괄 UPDATE: 없음

## 실행한 검증

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공. 기존에 이미 알려진 경고 2건(CSS 구문 경고, 500kB 초과 청크 경고)만 존재, 신규 오류/경고 없음 |
| `git diff --check` | 통과(실제 whitespace 오류 없음, CRLF 안내만 표시) |
| 변경 파일 검토 | 16개 파일(수정 13, 신규 3) — 목록은 위 표 참고, 그 외 무관 파일 수정 없음 |
| 정적 코드 경로 검토 | 신규/수정된 import, route 등록, `saveCourse()` 호출부, `normalizeSavedCourseForDisplay()`/`getSavedCourseDisplayTitle()` 호출부를 코드 리딩으로 확인 |

## 수동 테스트한 항목

**수행하지 않음** — 이번 세션은 코드 작성 + `npm run build` 정적 검증까지만 진행했다. 실제 Supabase 데이터로 브라우저에서 아래 항목을 확인하는 작업은 사용자 확인이 필요하다.

- 가게 카드: 리뷰 있음/없음/저장 수 0/좁은 화면 줄바꿈
- 전체 화면 가게 상세 이동 및 뒤로 가기
- 신규 저장(프리셋/검색/지도 중심/GPS 4종)의 실제 DB row 확인(anchor_*, preference_keys, course_theme_key, route_signature, title_schema_version)
- 중복 저장 차단 및 메시지 표시(동일 사용자·동일 구성·순서 다름 포함)
- 언어 전환 시 제목/기준 위치/취향 재생성
- 기존(`title_schema_version = 1`) 데이터가 오류 없이 열리는지

## 남은 위험 / 미확인 사항

- 브라우저 실동작을 확인하지 못했다 — 위 수동 테스트 목록 전체가 미검증 상태
- 역지오코딩 결과의 `region_2depth_name`이 항상 자연스러운 구 이름을 반환하는지는 실제 좌표로 확인하지 못함(Kakao 응답 형식 자체는 기존 프로젝트 관례상 안정적이라고 가정)
- `mg_place_bookmark_stats`/`mg_saved_courses` 신규 컬럼에 대한 실제 운영 grant/RLS 상태는 `docs/42`의 서술을 근거로만 삼았고 이번에 SQL로 재확인하지 않았음
- 검색으로 저장된 장소명(`anchor_name_original`)은 Kakao 응답이 원래 한국어라, 영어 화면에서도 한국어로 표시될 수 있다는 기존 한계(`docs/41`에서도 언급)가 그대로 남아있음 — 이번 작업 범위 밖으로 판단
- `/places/:placeId` 딥링크 새로고침 시 GitHub Pages 404 가능성은 기존 `/places/:placeId/reviews`와 동일한 한계이며 이번에 해결하지 않음(`docs/32` 기존 지적사항)

## 문서 생성 내용

이 문서(`docs/43-saved-course-structured-fields-and-place-stats-implementation-log.md`)를 신규 작성했다. `docs/42-saved-course-db-structure-and-duplicate-prevention.md`는 내용을 수정하지 않았다(과거 DB 작업 기록 그대로 보존).

## 최종 git status

작업 종료 시점 기준(worktree): 아래 13개 파일 수정 + 3개 파일 신규 추가 + 이 문서 신규 추가. `git add`/`commit`/`push`는 수행하지 않았다.
