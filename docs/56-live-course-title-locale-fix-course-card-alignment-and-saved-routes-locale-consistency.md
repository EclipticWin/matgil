# 56. 라이브 추천 동선 제목 로케일 처리 개편, CourseCard 정렬·색상 정리, Saved Routes 저장/삭제 UI 및 다국어 일관성 확보

## 1. 작업 일시

- 작성일시: 2026-07-26 15:32 KST

---

## 2. 작업 배경

`docs/55-login-intro-copy-and-course-card-redesign.md`는 커밋 `fdbd1de`(로그인 소개 문구 추가 및 동선 목록 카드 이미지 제거·압축형 개편)에 문서와 함께 커밋되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 다음 다섯 묶음의 작업을 다룬다. 이 문서 작성 시점까지 `fdbd1de` 이후로는 어떤 `git add`/`commit`/`push`도 수행되지 않아, 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있었다.

1. 라이브 추천 동선 제목 생성 방식 전면 개편 — 취향/메뉴/카테고리 기반 제목, 저장 후에도 목록·상세·지도 재진입에서 제목 일관성 유지, 숫자 접미사 제거
2. `CourseCard.jsx` 장소명/대표메뉴 정렬 문제 2차례 수정(고정 2줄 높이 → CSS Grid 공유 행 방식)
3. 동선 목록 Saved 배지 위치 이동, 저장/저장취소 토글 버튼, 저장 코스 상세 하단 Remove/View map 2버튼 + 삭제 확인 모달, 여러 화면의 CTA 여백 대칭화
4. 핫플레이스(프리셋) 선택 후 locale 전환 시 동선 제목의 위치명이 영어로 고정되는 버그 수정, Saved Routes 카드에 저장일·삭제를 카드 내부로 재배치
5. Saved/코스 상세 보기 텍스트 색상을 코랄 계열에서 명확한 회색으로 최종 수정, Saved Routes 카드의 가게명·대표메뉴가 저장 당시 언어로 고정되어 언어가 섞이는 문제를 현재 locale batch 조회로 해결

이 저장소에는 Git worktree가 둘 이상 존재한다(`C:/Workspace/GitWorkspace/matgil`(main), `.claude/worktrees/sprightly-pondering-owl`). 각 작업 시작 전 `git rev-parse --show-toplevel`/`git branch --show-current`/`git worktree list`로 실제 실행 워크트리를 재확인했고, 대상 `courseDisplay.js`/`TodayCourseDetail.jsx`/`CourseCard.jsx` 등에 `getLiveRecommendedCourseTitle`/`titleTheme`/`onSave`·`saveState`/BookmarkIcon·CheckIcon 등 "현재 실행 화면과 일치하는 최신 버전"의 특징이 실제로 존재하는지 확인한 뒤에만 수정했다. 다른 worktree는 이번 세션 전체에서 한 번도 수정하지 않았다.

이번 세션 중 이 작업들과 **무관하게** 워킹 디렉터리에 이미 존재하던 일본어("준비 중") 안내 관련 미커밋 변경(`LanguageModal.jsx`, `exploreOptions.js`, `HomePage.jsx`, `MyPage.jsx` 수정 + 신규 `JapaneseComingSoonModal.jsx`)이 함께 있었으나, 이번 세션에서는 전혀 건드리지 않았고 이번 커밋에도 포함하지 않는다. 특히 `HomePage.jsx`는 이 무관한 변경과 이번 세션의 변경(§4.6, §11)이 같은 파일에 섞여 있어, 커밋 시 `git update-index --cacheinfo`로 "HEAD + 이번 세션 변경분만" 블롭을 직접 스테이징하고 일본어 관련 부분은 워킹 디렉터리에 미스테이징 상태로 남겨두었다(§14).

---

## 3. 조사·검증에 사용한 명령(읽기 전용 + 빌드/디프 검증)

```
git rev-parse --show-toplevel
git branch --show-current
git worktree list
git status --porcelain / --short
git diff --stat / -- <file>
git diff --check
git log --oneline
npm run build
grep/Read — courseDisplay.js, courseBuilder.js, savedCourseService.js, HomePage.jsx,
            NearbySheet.jsx, TodayCourseDetail.jsx, CourseCard.jsx, SavedRoutesTab.jsx,
            SavedCourseDetailPage.jsx, dictionary.js, Icon.jsx, Modal.jsx, FilterSheet.jsx,
            Button.jsx, locations.js, LocationSheet.jsx, useSavedCourses.jsx, placeApi.js,
            CoursesPage.jsx, DeleteReviewConfirmModal.jsx
```

---

## 4. 라이브 추천 동선 제목 생성 개편

### 4.1 배경 — 기존 제목의 한계

기존 `getLocalizedCourseTitle()`은 stops의 카테고리만으로 5개 버킷(카페/길거리/고기/면/기본) 중 하나를 골라 `"{location} Food Walk"`류 고정 문구를 반환했다. 서로 다른 스톱 조합도 같은 버킷으로 자주 묶여 "Food Walk 2", "Food Walk 3" 같은 무의미한 숫자 접미사(`appendCourseSequenceNumber`)가 붙었다. 사용자가 실제로 선택한 취향(`selectedFoodTypes`)이나 각 스톱의 실제 대표메뉴는 제목에 전혀 반영되지 않았다.

### 4.2 새 함수 `getLiveRecommendedCourseTitle`

- **파일**: `src/features/courses/utils/courseDisplay.js`
- 기존 `getLocalizedCourseTitle()`은 완전히 그대로 유지(title_schema_version 1 저장 코스·레거시 fallback에서 계속 사용) — 광범위하게 재작성하지 않고 라이브 추천 전용 신규 함수만 추가.
- 시그니처: `getLiveRecommendedCourseTitle(stops, selectedLocation, locale, { selectedFoodTypes, getCategoryLabel })` → `{ title, titleTheme }` 반환.
- 위치 표시는 기존 `getLocationDisplayName()`/`getLocalizedLocationLabel()`을 그대로 재사용(§7 전까지는 무변경).

### 4.3 제목 테마 우선순위

1. **취향 선택 시**: `selectedFoodTypes`(`'all'`/빈 값 제외, 중복 제거, 최대 2개)를 `getCategoryLabel(key, locale)`로 라벨화 — `source: 'preference'`.
2. **취향 미선택 시**: 각 스톱의 `firstMenu` → `treatMenu` → `matgilCategoryKeys`의 첫 유효 항목(카테고리 라벨) 순으로 후보 수집.
   - 메뉴 텍스트 정제: HTML 태그 제거, `<br>`/줄바꿈/`/`/`,`/`·` 분리 후 첫 토큰만 사용, 공백 정규화, 10자 초과 시 카테고리 라벨로 대체(`normalizeMenuCandidate`/`getStopThemeCandidate`/`buildThemeCandidatesFromStops`).
   - 메뉴 기반 후보를 카테고리 기반보다 우선(더 구체적), 최대 2개, 중복 제거. 나머지는 `candidateLabels`로 보관(충돌 해소용).
3. **둘 다 없으면**: 기존과 동일한 "맛집"/"Food"/"美食" 기본값.

### 4.4 제목 문법(§13 스펙과 동일 형태, `courseDisplay.js` 내부에만 존재)

- ko: `{지역} {주제1} 동선` / `{지역} {주제1}·{주제2} 동선`
- en: `{Location} {Theme1} Route` / `{Location} {Theme1} & {Theme2} Route`
- zh-CN: `{地区}{主题1}路线` / `{地区}{主题1}·{主题2}路线`

기존 `courseTitle.withLocation`/`themeOnly`(dictionary.js, "Walk" 문구, 취향 선택된 v2 저장 코스의 구조화 제목이 계속 사용)와는 별개의 문구 — `formatLiveCourseTitle()`이라는 내부 헬퍼로 단일화, 새 dictionary 키 없이 기존 `KO_TITLE_TEMPLATES` 등과 같은 방식으로 JS 템플릿 리터럴에 유지.

### 4.5 제목 충돌 해소 — `resolveLiveCourseTitleCollisions`

동일 화면에 표시되는 여러 추천 코스가 같은 제목을 갖게 되는 경우, 기존의 `appendCourseSequenceNumber()`(숫자 접미사) 호출을 제거하고 실제 데이터 기반으로 해소한다.

1. 해당 코스 자신의 미사용 테마 후보(`titleTheme.candidateLabels`)로 교체
2. 그래도 겹치면 해당 코스 첫 스톱의 현재 로케일 이름을 `"{title} — {상호명}"` 형태로 보조 표기
3. 그래도 안 되면 그대로 둠(가짜 형용사·랜덤 없음, 결정론적)

`appendCourseSequenceNumber()` 함수 자체는 다른 의존 가능성을 고려해 삭제하지 않고 남겨두었다(더 이상 호출되지 않음을 주석으로 명시).

### 4.6 `courseBuilder.js`/`HomePage.jsx` 연동

- `buildOneCourse()`가 `getLiveRecommendedCourseTitle()`을 호출하도록 교체, 반환 course 객체에 `titleTheme` 필드 추가.
- `buildRecommendedCourses()`는 전체 코스 생성 후 `resolveLiveCourseTitleCollisions(courses, selectedLocation, locale)`을 한 번 호출(기존 숫자 접미사 루프 삭제).
- `buildOneCourse`/`buildRecommendedCourses`에 `getCategoryLabel` 파라미터 추가.
- 추천 점수 계산(`calcClusterScore`/`calcDiversityScore`/`calcCafeBonus`/`calcDataQualityScore`/`calcStartAccessScore`/`calcWeakOtherPenalty`/`calcScore`), 조합(`combinations`/`selectCandidates`), 정렬·타이브레이크, `usedIds`, `maxCourses`, course id, 스톱 순서는 **전혀 변경하지 않았다**.
- `HomePage.jsx`: `useFoodCategories()`로 `getCategoryLabel`을 얻어 `buildRecommendedCourses(...)` 호출과 `recommendedCourses` useMemo 의존성 배열에 추가 — 이미 존재하던 `getPlacesWithReviewStats(locale)` 재조회, `locale` 의존성은 그대로.

### 4.7 저장 시 titleTheme 보존

`savedCourseService.js`의 `saveCourse()`는 `courseSnapshot = {...course, ...}` 스프레드 구조라, `course.titleTheme`이 별도 코드 변경 없이 자동으로 `course_snapshot.titleTheme`에 포함됨을 확인 — **이 파일은 수정하지 않았다.** `computeCourseThemeKey()`(취향 미선택 시 `null` 반환, docs/44 정책)의 의미도 변경하지 않았다.

### 4.8 `getSavedCourseDisplayTitle()` 확장

- **파일**: `src/features/courses/utils/courseDisplay.js`
- v2 저장 코스 + `preference_keys` 존재: 기존 구조화 제목(`getStructuredCourseTitle`) 그대로.
- v2 저장 코스 + `preference_keys` 없음:
  1. `course_snapshot.titleTheme`이 있고, **저장 당시 locale(`savedRow.locale`)과 현재 표시 locale이 같고**, `savedRow.title`이 있으면 → **`savedRow.title`을 최우선으로 그대로 반환**(저장 시점에 충돌 해소로 붙었을 수 있는 상호명 보조 문구까지 그대로 보존).
  2. 그 외(locale이 다르거나 `savedRow.title` 사용 불가) → `getTitleFromTitleTheme()`으로 현재 locale 재생성.
  3. `titleTheme` 자체가 없으면 기존 `getStructuredCourseTitle()` 기본값 fallback.
- v1/버전 누락: 기존 `getLocalizedCourseTitle()` 그대로.
- `pickTitleThemeLabels(titleTheme, locale, { getCategoryLabel, localizedStops })` 우선순위(최종본): **1) `localizedStops`(현재 locale로 즉석 재계산) → 2) `titleTheme.labelsByLocale[locale]`(정확히 일치하는 로케일) → 3) `titleTheme.categoryKeys`를 `getCategoryLabel`로 변환(어떤 로케일에서도 안전) → 4) 없으면 `null`**. 다른 로케일의 `labelsByLocale` 값은 참조하지 않아 원문 혼용을 방지.

### 4.9 저장 목록·상세·지도 재진입 반영

- **`SavedRoutesTab.jsx`**: `getSavedCourseDisplayTitle(saved, locale, { getCategoryLabel, t })` 호출은 그대로 — 추가 조회 없이 위 우선순위 로직만으로 동일 locale에서는 저장 당시 제목을, 다른 locale에서는 카테고리 기반 안전 재번역을 자동으로 얻는다.
- **`SavedCourseDetailPage.jsx`**: 이미 있던 `getPlacesByIds(placeIds, locale)` 배치 조회 결과(`stops`)를 `displayHelpers.localizedStops`로 전달하도록 변수 선언 순서만 재배치 — 추가 쿼리 없이 가장 정확한(현재 locale 실제 메뉴 기반) 제목을 재생성.
- **`localizeSnapshotForDisplay()`**(지도 "View on map" 재진입 경로): `snapshot.titleTheme`을 인식하도록 확장, 위치 로직은 기존 `getLocalizedLocationLabel(anchorLabel, locale)` 그대로. `NearbySheet.jsx`가 `useFoodCategories()`를 추가로 연결해 `getCategoryLabel`을 전달(기존 로드된 컨텍스트 재사용, 추가 쿼리 없음).

### 4.10 레거시 호환

`title_schema_version` 1, 버전 누락, v2+`titleTheme` 없음, `preference_keys` 있는 기존 저장 코스, `course_theme_key`만 있는 기존 저장 코스 — 모두 기존 동작 그대로 유지, 마이그레이션·DB update 없음.

---

## 5. CourseCard.jsx — 장소명/대표메뉴 정렬 (2차 수정)

### 5.1 1차: 고정 2줄 높이(이후 되돌림)

장소명이 1줄인 스톱에서 대표메뉴 시작선이 스톱마다 달라 보이는 문제를 `min-h-[2.0625rem]`(leading-snug × 0.75rem 폰트 크기 기준 정확한 2줄 높이 계산값)으로 우선 수정 — 모든 스톱에 무조건 2줄 높이를 예약.

### 5.2 2차: CSS Grid 공유 행 방식으로 교체

1차 방식은 "세 장소명이 모두 1줄"인 카드에서 대표메뉴 위에 불필요한 빈 줄이 남는 부작용이 있어, 순수 CSS Grid로 재구현했다.

- 스톱 2~3개를 하나의 공통 Grid로 배치: 홀수 트랙(1, 3, 5…)은 스톱(`1fr`씩), 짝수 트랙은 화살표(`auto`, 2스톱=3트랙/3스톱=5트랙).
- 각 스톱은 `className="contents"`(박스를 만들지 않는 wrapper)로 감싸고, 배지·장소명·대표메뉴가 각각 `gridColumn: i*2+1`에 `gridRow: 1/2/3`으로 직접 배치.
- 화살표는 아이콘 컴포넌트(`ChevronRightIcon`)가 `style` prop을 받지 않으므로, 자체 `div` wrapper에 grid 위치를 주고 그 안에 아이콘을 넣음.
- **결과**: 같은 `gridRow`를 공유하는 셀은 브라우저가 그 행에서 가장 긴 콘텐츠에 맞춰 행 높이를 자동 결정 — 하나라도 2줄이면 행 전체가 2줄, 모두 1줄이면 행 전체가 1줄로 자동 축소. JS 글자 수 계산이나 DOM 측정 effect는 전혀 사용하지 않았다. `min-h-[2.0625rem]` 하드코딩은 제거했다.
- 장소명 최대 2줄(`line-clamp-2`)·말줄임·가운데 정렬(`text-center`), 대표메뉴 한 줄 truncate, 숫자 배지·간격·화살표 위치·카드 클릭 동작은 그대로 유지. 저장 목록/라이브 추천 목록 공통 사용.

---

## 6. 동선 상세·목록의 저장/삭제 UI 개편

### 6.1 Saved 배지 위치 이동

- **문제**: `NearbySheet.jsx`가 저장된 카드 우측 상단에 `right-3 top-3` 절대 위치 배지(코랄 배경 + CheckIcon + "Saved")를 얹었는데, `CourseCard` 내부의 우측 상단 `3 STOPS` 배지와 겹쳤다.
- **수정**: 절대 배지 JSX를 완전히 삭제하고, `CourseCard`에 `isSaved` prop을 추가해 카드 하단 "View course"와 같은 행 왼쪽에 `[채워진 BookmarkIcon] Saved` 상태 표시(클릭 불가, 순수 span)로 이동. `SavedRoutesTab`은 이 prop을 넘기지 않아(기본값 `false`) 중복 표시 없음.

### 6.2 저장/저장취소 토글

- **문제**: `TodayCourseDetail.jsx`의 저장 버튼이 `disabled={isBusy || isSaved}`라서, 저장된 코스를 다시 눌러 삭제할 수 없었다.
- **수정**: `disabled={isBusy}`만 남기고(저장 완료 상태에서 클릭 가능), `onSave` prop을 `onToggleSave`로 개명(전체 소스 검색 결과 이 prop의 유일한 사용처가 `NearbySheet.jsx`임을 확인 후 안전하게 개명). `NearbySheet.jsx`에 `handleRemove()`(저장 row를 `isSameCourse()`로 찾아 기존 `softDeleteSavedCourse({ userId, courseId })` 호출)와 `handleToggleSave()`(현재 `saveState`가 `'saved'`면 `handleRemove`, 아니면 `handleSave`)를 추가, `saveState`에 `'removing'` 상태를 추가했다.
- 삭제 성공 시 `savedRows`에서 즉시 제거 + `saveState`를 `'idle'`로 → 목록 Saved 표시·상세 버튼이 즉시 갱신. 실패 시 `saveState`를 `'saved'`로 복구(row는 그대로 유지, 재시도 가능).
- 저장 완료 버튼 텍스트는 처음엔 "Saved · Tap to remove"류 보조 문구를 붙였다가, 이후 요청에 따라 화면 표시는 단순히 `Saved`/`저장됨`/`已收藏`만 남기고, 재클릭 시 해제된다는 설명은 `aria-label`/`title`(`savedCourses.savedAriaLabel`)로만 제공하도록 정리했다. `disabled` 제거 후에도 hover/active 피드백(연한 회색 배경 톤 변화)은 유지.
- 저장 취소 완료/실패 안내는 별도 toast 컴포넌트가 없어(프로젝트 내 `PlaceDetailSheet.jsx`/`MyPage.jsx`의 로컬 transient 메시지 패턴을 참고) `TodayCourseDetail.jsx` 내부에 `saveState`의 `'removing' → 'idle'`(성공)/`'removing' → 'saved'`(실패) 전환만 감지하는 `useRef`+`useEffect`로 CTA 위 절대 오버레이 pill을 2.5초간 표시하는 방식으로 구현. 가짜 Undo는 만들지 않았다.

### 6.3 저장 코스 상세 하단 — Remove / View map 2버튼

- **파일**: `src/pages/SavedCourseDetailPage.jsx`, 신규 `src/features/courses/components/RemoveSavedCourseConfirmModal.jsx`
- 전체 폭 "View route on map" 단일 버튼을 Map 필터 시트의 Reset/Show results와 동일한 스타일 위계(`h-[3.25rem] flex-1 rounded-[0.9375rem]`, `gap-3`)의 2버튼으로 교체: 왼쪽 `Remove`(TrashIcon, 흰 배경 + 얇은 border), 오른쪽 `View map`(RouteIcon, 코랄 배경).
- `Remove` 클릭 → 기존 리뷰 삭제 확인 모달(`DeleteReviewConfirmModal`)과 같은 `Modal` 구조를 재사용하되 새 문구·비-빨강 코랄 확인 버튼으로 `RemoveSavedCourseConfirmModal`을 신설(리뷰 삭제와 UI 맥락이 달라 직접 재사용은 하지 않음) → 확인 시 기존 `softDeleteSavedCourse({ userId, courseId: savedCourse.id })` 호출 → 성공 시 절대 오버레이 toast(약 0.9초) 후 `navigate(ROUTES.courses)`로 복귀(`CoursesPage`의 탭 기본값이 이미 `'routes'`라 Saved Routes 탭으로 자연스럽게 이동, `useSavedCourses()`가 새 마운트에서 재조회해 삭제된 코스가 즉시 목록에서 빠짐) → 실패 시 모달 유지 + 실패 안내, 삭제하지 않음.

### 6.4 CTA 여백 대칭화

`SavedCourseDetailPage.jsx`·`TodayCourseDetail.jsx`의 하단 CTA wrapper 상하 padding을 각각 `pb-7 pt-3`/`pb-5 pt-3`에서 `pb-3 pt-3`로 통일해 위·아래 바깥 여백이 시각적으로 동일하도록 맞췄다. 버튼 자체 높이(`h-[3.25rem]`), `border-t`, 배경색은 그대로 유지. 별도 safe-area padding이 겹치는 곳은 없음을 확인했다.

---

## 7. 핫플레이스 locale 버그 수정 — `getLocationDisplayName`

### 7.1 원인

`getLocationDisplayName(selectedLocation, locale)`이 `source === 'map'`(지도 중심)인 경우만 locale 처리를 하고, 프리셋(핫플레이스) 위치를 포함한 나머지 모든 경우에는 항상 `selectedLocation.label`(영어 원문)을 그대로 반환했다. 프리셋을 key로 재조회해 재번역하는 분기가 아예 없었던 것이 원인 — 영어로 핫플레이스를 선택한 뒤 한국어/중국어로 전환해도 동선 제목의 위치명만 `Seoul City Hall` 같은 영어로 남는 증상으로 나타났다.

### 7.2 수정

map 처리 다음 단계로 `PRESET_LOCATIONS.find(item => item.key === selectedLocation.key)`를 추가해, 찾으면 `pickTranslated({ko: preset.labelKo, en: preset.label, 'zh-CN': preset.labelZh}, locale) ?? preset.label`을 반환하도록 했다. `getLocalizedLocationLabel()`의 기존 프리셋 번역과 동일한 매핑을 사용했고, map 우선순위·search/gps 정책·`titleTheme`/충돌 해소 로직은 손대지 않았다.

`src/features/explore/data/locations.js`의 `PRESET_LOCATIONS`(city_hall, myeongdong, hongdae, gangnam, seongsu, jongno, gyeongbokgung, itaewon, dongdaemun, gwangjang_market, yeouido, jamsil 총 12개)는 확인 결과 **이미 모든 항목에 `labelZh`가 채워져 있어**(선행 커밋에서 완료됨) 수정하지 않았다. `LocationSheet.jsx`도 이미 `pickTranslated({ko: loc.labelKo, en: loc.label, 'zh-CN': loc.labelZh}, locale)`를 쓰고 있어 무변경. `HomePage.jsx`도 locale 변경 시 `getPlacesWithReviewStats(locale)` 재조회·`recommendedCourses` useMemo의 `locale` 의존성이 이미 갖춰져 있어 추가 effect 없이 이 한 곳의 수정만으로 해결되었다.

---

## 8. Saved Routes 카드 — 저장일·삭제 위치 재배치(1차: actionMode 도입)

- **파일**: `src/features/courses/components/CourseCard.jsx`, `src/features/courses/components/SavedRoutesTab.jsx`
- 기존에는 `CourseCard` 아래 별도 `<div>` 행에 저장일과 삭제 버튼(휴지통 아이콘 + 취소/삭제 확인 텍스트 전환)이 있었다. 이를 카드 내부로 이동:
  - 카드 상단 badge row 왼쪽: `저장일: {날짜}`(`t('savedCourses.savedDate', {date})`, 신규 키, en/ko/zh-CN)
  - 카드 하단 action row 왼쪽: 삭제(휴지통 아이콘 + 확인 시 취소/삭제 텍스트로 전환, 기존 `pendingDeleteId` 상태·`remove(saved.id)` 서비스 그대로)
  - 카드 밖의 날짜/삭제 행은 완전히 제거.
- **중첩 button 방지 구조**: `CourseCard`에 `actionMode`/`savedDateLabel`/`deleteSlot` prop을 추가. `actionMode`일 때는 카드 전체를 하나의 button/Link로 감싸지 않고 순수 `div`로 바꾼 뒤, badge row~route path("upperContent")만 자체 `<button onClick={onClick}>`으로 감싸고, 하단 action row(삭제 버튼 + "코스 상세 보기" 버튼)는 그 button의 **형제 요소**로 배치 — 삭제 클릭이 상세 이동을 유발하지 않고, `stopPropagation` 없이도 구조적으로 이벤트가 섞이지 않는다. `actionMode`가 `false`(기본값)인 다른 모든 호출부(라이브 추천 카드 등)는 기존 3개 분기(Link/button/div)가 그대로 실행되어 영향이 없다.

---

## 9. Saved/코스 상세 보기 텍스트 색상 — 최종 회색 수정

- **1차 시도(부적절)**: Saved 텍스트·코스 상세 보기 텍스트를 "완화"한다며 `text-coral/70`(코랄의 70% 불투명도)으로 변경 — 실제로는 여전히 코랄 색상이라 옅은 코랄로 보였고, 회색이 아니었다.
- **최종 수정**: 색상 선택 여지 없이 명확한 회색으로 교체.
  - Saved wrapper: `text-ink-faint`(BookmarkIcon에만 `className="text-coral"`을 명시해 아이콘만 코랄 유지)
  - View course: 기본 `text-ink-soft`, `hover:text-ink active:text-ink`(코랄 계열 완전 제거, 화살표도 같은 span 안에서 currentColor로 동일 색)
  - 라이브 추천 카드·Saved Routes 카드 모두 동일 적용.

---

## 10. Saved Routes 다국어 일관성 — 저장 당시 언어 snapshot 문제

### 10.1 원인

`SavedRoutesTab.jsx`가 각 저장 코스의 `saved.stops ?? snapshot.stops`(저장 당시 locale로 굳어진 스냅샷)를 그대로 `adaptedCourse.stops`에 넘기고 있어, 가게명·`firstMenu`·`treatMenu`·`tags`가 저장 당시 언어로 고정되고 현재 화면 locale과 무관하게 표시되었다 — 한 목록 안에서 한국어·영어·중국어가 섞이는 원인.

### 10.2 수정

- **파일**: `SavedRoutesTab.jsx`(기존 `getPlacesByIds`/`mergeSavedStopWithLocalizedPlace` 헬퍼만 사용, 신규 서비스·DB 조회 없음)
- 탭 전체의 모든 저장 코스에서 stop id를 `useMemo`로 한 번에 모아(`Number.isFinite` 필터, `Set` 중복 제거, 정렬) `allStopIdsKey` 문자열을 만들고, `[allStopIdsKey, locale]`을 의존성으로 하는 **단일** `useEffect`에서 `getPlacesByIds(ids, locale)`를 **정확히 1회** 호출 — 코스별·스톱별 반복 조회(N+1) 없음. `SavedCourseDetailPage.jsx`가 이미 쓰는 것과 같은 패턴(키 문자열을 effect 안에서 다시 split하는 방식)이라 불필요한 `eslint-disable`도 추가하지 않았다.
- 결과를 `id → place` `Map`으로 변환해 `localizedPlacesById`에 저장, 각 코스의 `rawStops`에 `mergeSavedStopWithLocalizedPlace(stop, localizedPlacesById.get(Number(stop.id)))`를 적용한 `localizedStops`를 `adaptedCourse.stops`로 전달. helper는 새로 만들지 않고 기존 `courseDisplay.js`의 export를 그대로 사용 — `distanceKm`/`tint`/저장 순서 등 route context 값은 helper가 보존하고, 현재 locale의 `name`/`firstMenu`/`treatMenu`/`address`/`tags`는 localized place가 우선(localized place가 없을 때만 snapshot으로 fallback).
- **로딩 UX**: `localizedPlacesLoading` 상태를 추가해, batch 조회가 실제로 진행 중일 때만(그리고 조회할 stop이 있을 때만) 목록 영역에 기존 Spinner를 표시 — locale 전환 직후 이전 언어 snapshot이 잠깐 노출되는 깜빡임을 방지하면서도, 조회가 끝나면 즉시 카드가 나타나도록 했다. 새 skeleton UI는 만들지 않았다.
- 코스 제목은 `getSavedCourseDisplayTitle(saved, locale, { getCategoryLabel, t })` 호출을 그대로 유지 — 같은 locale에서 `saved.title` 우선 처리, `titleTheme`, `preference_keys` 구조화 제목, 레거시 fallback 모두 이번 작업에서 변경하지 않았다(§4의 로직 그대로).
- `getStopSummaryLabel`(카테고리 우선 → firstMenu → fallback)의 우선순위 자체는 변경하지 않았고, 전달되는 데이터만 현재 locale 기준으로 바꿨다.

---

## 11. 변경 파일 종합

| 파일 | 비고 |
|---|---|
| `src/features/courses/utils/courseDisplay.js` | `getLiveRecommendedCourseTitle`/`resolveLiveCourseTitleCollisions`/`titleTheme`/`pickTitleThemeLabels` 신설, `getLocationDisplayName` 프리셋 key 조회 추가, `getSavedCourseDisplayTitle`/`localizeSnapshotForDisplay` 확장 |
| `src/features/explore/data/courseBuilder.js` | `buildOneCourse`/`buildRecommendedCourses`가 새 제목 함수·`resolveLiveCourseTitleCollisions` 사용, `getCategoryLabel` 파라미터 추가(추천 알고리즘 자체는 무변경) |
| `src/pages/HomePage.jsx` | `useFoodCategories()`로 `getCategoryLabel`을 얻어 `buildRecommendedCourses` 호출/useMemo 의존성에 추가(3줄, §2 참고 — 일본어 관련 무관 변경과 같은 파일에 혼재) |
| `src/features/explore/components/NearbySheet.jsx` | `handleRemove`/`handleToggleSave` 추가, `saveState`에 `'removing'` 추가, 절대 Saved 배지 제거 + `CourseCard`에 `isSaved` 전달, `localizeSnapshotForDisplay`에 `getCategoryLabel` 전달 |
| `src/features/explore/components/TodayCourseDetail.jsx` | `onSave`→`onToggleSave` 개명, `disabled` 조건에서 `isSaved` 제거, 저장 완료 문구 단순화(`Saved`만 표시 + aria-label로 설명), 삭제 취소 toast, CTA 여백 대칭화 |
| `src/features/courses/components/CourseCard.jsx` | CSS Grid 장소명/대표메뉴 정렬, `isSaved`/`actionMode`/`savedDateLabel`/`deleteSlot` prop 추가, Saved/View course 텍스트 색상을 회색으로 최종 수정 |
| `src/features/courses/components/SavedRoutesTab.jsx` | `actionMode`로 카드 내부에 저장일·삭제 이동, 전체 stop id batch `getPlacesByIds` 조회 + `mergeSavedStopWithLocalizedPlace` 병합으로 다국어 일관성 확보 |
| `src/pages/SavedCourseDetailPage.jsx` | `localizedStops`를 제목 helper에 전달, 하단 CTA를 Remove/View map 2버튼으로 교체, 삭제 확인 모달·soft delete·toast, CTA 여백 대칭화 |
| `src/features/courses/components/RemoveSavedCourseConfirmModal.jsx` | 신규 — 저장 코스 삭제 확인 모달 |
| `src/shared/i18n/dictionary.js` | `savedCourses.savedAriaLabel`/`removing`/`removed`/`removeFailed`/`remove`/`viewMap`/`removeConfirmTitle`/`removeConfirmBody`/`savedDate` 등(en/ko/zh-CN) |

`savedCourseService.js`(§4.7에서 수정 불필요 확인), `src/api/placeApi.js`(기존 `getPlacesByIds`만 사용), `src/features/explore/data/locations.js`/`LocationSheet.jsx`(§7.2에서 무변경 확인), DB 스키마·SQL·Edge Function, `package.json` — 이번 작업 전체에서 전혀 수정하지 않았다. `LanguageModal.jsx`/`exploreOptions.js`/`MyPage.jsx`/`JapaneseComingSoonModal.jsx`(일본어 안내 관련, 이번 세션과 무관한 기존 미커밋 변경)도 전혀 건드리지 않았다.

---

## 12. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 매 단계 성공, 최종 211 modules. 기존 CSS 압축 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 매 단계 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| 추천 알고리즘/코스 조합/점수 계산/스톱 순서 diff | 매 단계 무변경 확인(`calcClusterScore` 등 8개 함수, `combinations`, `selectCandidates`) |
| DB/SQL/Edge Function diff | 없음 |
| 다른 worktree(`sprightly-pondering-owl`) 상태 | 매 단계 확인, 이번 세션에서 한 번도 수정하지 않음 |
| 패키지 설치 여부 | 없음(`package.json` 무변경) |

### 미검증(승인된 한계)

이 환경에는 브라우저 자동화 도구가 없어, 아래는 코드/CSS 스펙·로직 재확인으로만 판단했고 실제 렌더링/동작은 확인하지 못했다.

- 로케일 전환 시 동선 제목·위치명이 실제 화면에서 즉시 바뀌는지
- CSS Grid 장소명 정렬의 실제 렌더링(2줄/1줄 혼합 카드에서 대표메뉴 기준선)
- 저장/저장취소 토글의 실제 클릭 반응, toast 노출·소멸 타이밍
- Saved Routes 카드의 실제 batch 로딩 스피너 노출 시점, locale 전환 시 깜빡임 여부
- Saved/View course 텍스트의 실제 색상 체감

---

## 13. git 상태 (이 문서 커밋 직전 기준)

- current branch: `main`
- 실제 실행 워크트리: `C:/Workspace/GitWorkspace/matgil`(다른 worktree `sprightly-pondering-owl`은 전혀 수정하지 않음)
- HEAD(커밋 전): `fdbd1de`(docs/55와 함께 커밋)
- 이 문서 작성 시점까지 `git add`/`commit`/`push` 없음
- 워킹 디렉터리에는 이번 작업과 **무관한** 기존 미커밋 변경(일본어 준비 중 안내 관련 `LanguageModal.jsx`/`exploreOptions.js`/`HomePage.jsx`/`MyPage.jsx` 일부 + 신규 `JapaneseComingSoonModal.jsx`)이 함께 있었다. `HomePage.jsx`는 이번 세션의 변경(§4.6)과 무관한 변경이 같은 파일에 섞여 있어, `git update-index --cacheinfo`로 "HEAD + 이번 세션 변경분만" 블롭을 직접 스테이징해 커밋에는 이번 세션 변경분만 포함시키고, 무관한 변경은 워킹 디렉터리에 미스테이징 상태로 남겨두었다. `LanguageModal.jsx`/`exploreOptions.js`/`MyPage.jsx`/`JapaneseComingSoonModal.jsx`는 아예 스테이징하지 않았다.

---

## 14. 후속 과제

- §12의 미검증 항목 전체에 대한 실기기 확인
- 일본어("준비 중") 안내 관련 미커밋 변경(`HomePage.jsx` 일부 포함) — 이번 세션과 무관하므로 별도로 검토·커밋 필요
