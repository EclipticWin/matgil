# Matgil 프로젝트 React 구조 분석 리포트

본 리포트는 제공된 `src` 폴더의 코드베이스를 직접 분석하여 작성된 프로젝트 구조 및 상태 분석 문서입니다. 다른 코드를 수정하거나 실행하지 않고 코드를 정적으로 분석한 결과만 포함합니다.

---

## 1. `src` 폴더 전체 파일 트리

```text
src/
├── index.css
├── main.jsx
├── api/
│   └── placeApi.js
├── app/
│   ├── App.jsx
│   ├── providers.jsx
│   └── router.jsx
├── features/
│   ├── area/
│   │   ├── components/AreaSelector.jsx
│   │   └── data/mockAreas.js
│   ├── auth/
│   │   ├── components/LoginForm.jsx
│   │   ├── hooks/useAuth.jsx
│   │   └── services/mockAuthService.js
│   ├── community/
│   │   ├── components/CommunityTabs.jsx, PostCard.jsx
│   │   └── data/communityPosts.js
│   ├── courses/
│   │   ├── components/CourseCard.jsx
│   │   └── data/courses.js
│   ├── explore/
│   │   ├── components/CategoryIcon.jsx, FilterSheet.jsx, LanguageModal.jsx, Modal.jsx, NearbySheet.jsx
│   │   └── data/exploreOptions.js
│   ├── navigation/
│   │   └── components/BottomNavigation.jsx
│   ├── phrases/
│   │   ├── components/PhraseCard.jsx, PhraseCategoryTabs.jsx
│   │   ├── data/phrases.js
│   │   └── services/ttsService.js
│   ├── popular/
│   │   ├── components/PopularPlaceCard.jsx
│   │   └── data/mockPopularPlaces.js
│   ├── preference/
│   │   ├── components/PreferenceSelector.jsx
│   │   └── data/preferenceOptions.js
│   ├── recommendation/
│   │   ├── components/RecommendationCard.jsx, RecommendationSummary.jsx
│   │   ├── data/mockRecommendations.js
│   │   ├── hooks/useRecommendation.jsx
│   │   └── services/recommendationService.js
├── lib/
│   └── supabase.js
├── pages/
│   ├── AreaPage.jsx
│   ├── BookmarkPage.jsx
│   ├── CommunityPage.jsx
│   ├── CourseDetailPage.jsx
│   ├── CoursesPage.jsx
│   ├── HomePage.jsx
│   ├── LoadingPage.jsx
│   ├── LoginPage.jsx
│   ├── MyPage.jsx
│   ├── PhrasesPage.jsx
│   ├── PopularPage.jsx
│   ├── PreferencePage.jsx
│   └── ResultPage.jsx
└── shared/
    ├── components/
    │   ├── AppLayout.jsx, Button.jsx, Card.jsx, EmptyState.jsx, Header.jsx, Icon.jsx, StepIndicator.jsx, Thumbnail.jsx, TopBar.jsx
    ├── constants/
    │   └── routes.js
    ├── hooks/
    │   └── useBookmarks.jsx
    └── utils/
        └── classNames.js
```

---

## 2. 화면 접근성 및 라우터 구조

`src/app/router.jsx`와 `BottomNavigation.jsx`를 분석한 결과, 화면들은 네비게이션이 존재하는 그룹과 풀스크린 Flow를 타는 그룹으로 나뉘며, 버튼을 통해 이동할 수 있는 화면과 URL 직접 입력으로만 갈 수 있는 화면이 구분됩니다.

### 2.1 하단 메뉴 (Bottom Navigation) 구조
하단 탭은 5개의 탭으로 구성되며 `<AppLayout />` 아래서 작동합니다.
- **Map (Home)**: `/` (`HomePage.jsx`)
- **Courses**: `/courses` (`CoursesPage.jsx`)
- **Phrases**: `/phrases` (`PhrasesPage.jsx`)
- **Community**: `/community` (`CommunityPage.jsx`)
- **You (My)**: `/my` (`MyPage.jsx`)

### 2.2 화면 접근 형태 분류
* **실제로 UI 버튼 및 메뉴로 접근 가능한 화면:**
  - 하단 메뉴 연결 화면 전체 (위에 나열된 5개 화면)
  - `/login`: 로그인 되지 않은 상태에서 `/my`에 접근 시 자동으로 Redirect 됨
  - `/course/:id`: Courses 화면 내에서 개별 Course 카드를 클릭 시 접근
  - `/bookmark`: 로그인이 된 `MyPage`에서 "Saved places" 카드를 클릭 시 접근

* **URL 직접 입력으로만 접근 가능한 숨은 화면:**
  - `/area` → `/preference` → `/loading` → `/result` : 이 4가지 페이지는 서로 `navigate`로 연결된 Wizard 구조를 갖고 있으나, 사용자 UI 상에서 가장 처음 시작점인 `/area` 로 진입하는 버튼이나 로직이 현재 존재하지 않습니다.
  - `/popular` : `router.jsx`에 선언되어 있으나 앱 내에 메뉴나 링크 컴포넌트가 전혀 존재하지 않습니다.

---

## 3. Map 화면(HomePage) 기능 및 관계 분석

`src/pages/HomePage.jsx`는 지도 화면을 담당합니다.

* **지도 베이스 컴포넌트**: 현재 API 연동 없이 CSS (`bg-map-land`)와 아이콘을 통해 렌더링된 가짜 Placeholder 지도를 사용하고 있습니다.
* **상단 UI**: 검색창 표기, 언어 선택 모달 버튼, 카테고리 필터 모달 버튼을 제어합니다.
* **NearbySheet와 FilterSheet 상관관계**:
  * 두 컴포넌트는 `HomePage.jsx` 안에서 형제(Sibling)로 선언된 UI입니다.
  * `FilterSheet`가 모달 형태로 나타나 사용자가 조건을 선택하고 적용(Apply)하면 HomePage의 `filters` 상태(가령 `cat`, `price` 값 등)가 변경됩니다.
  * HomePage가 렌더링될 때 `exploreOptions.js`의 `applyFilters()` 함수가 호출되어 전체 `RESTAURANTS` 목록에서 필터링된 결과값을 `nearby` 배열로 산출합니다.
  * 만들어진 `nearby` 배열은 `<NearbySheet places={nearby} />` 형태로 `NearbySheet` 컴포넌트에 Prop으로 전달되어 화면 아래쪽에 스크롤/드래그 가능한 핫플레이스 목록으로 그려지게 됩니다.

---

## 4. 데이터 계층 분석

### 4.1 Mock 데이터 사용 위치
- **권한 연동 (`features/auth`):**
  - `mockAuthService.js`: `useAuth.jsx` 및 `LoginForm`에서 페이크 로그인 수행
- **탐색 영역 (`features/explore`):**
  - `exploreOptions.js`: 음식 카테고리 기획용 필터 데이터
- **지역 선택 (`features/area`):**
  - `mockAreas.js`: `/area` 지역 선택지 (AreaSelector 컴포넌트)
- **위저드 환경 (`features/preference`):**
  - `preferenceOptions.js`: `/preference` 에서 취향조사용 데이터
- **추천 데이터 (`features/recommendation`):**
  - `mockRecommendations.js`: `/result` 및 맵 하단의 **`NearbySheet`** (`HomePage.jsx`)에 레스토랑 하드코딩 데이터를 뿌리는 데 사용 (`RESTAURANTS`)
- **기타 컨텐츠 영역:**
  - `mockPopularPlaces.js`: 숨은 페이지인 `PopularPage.jsx`의 UI를 위해 설계됨
  - `communityPosts.js`: `CommunityPage.jsx`
  - `courses.js`: `HomePage.jsx`, `CoursesPage.jsx`
  - `phrases.js`: `PhrasesPage.jsx`

### 4.2 Supabase `getPlaces()` 호출 위치
현재 진짜 DB가 연동된 코드는 단 2곳에만 작성되어 있습니다. (*`HomePage`에서는 호출하지 않음*)
1. `src/pages/PopularPage.jsx`: 숨겨진 화면인 Popular 페이지 렌더링 시 최상단에서 호출.
2. `src/features/recommendation/services/recommendationService.js`: 추천 서비스 호출 시 (`ResultPage` 등 내부에서 사용됨) 가져와서 결과 값을 형성하는 데 활용.

---

## 5. 향후 액션 플랜 분석

### 5.1 Supabase 식당 데이터를 Map 화면 (NearbySheet)에 10개 띄우기
위 분석을 토대로, 현재 Map 화면이 Mock 데이터를 직접 Import해 쓰고 있으므로 Supabase DB로 연동하려면 **`src/pages/HomePage.jsx`** 단 1개의 파일만 수정하면 됩니다.
*(필요 시, Supabase 데이터를 가져올 때 제한을 두기 위해 `src/api/placeApi.js` 도 수정 검토 가능)*

- 수정 내역 기획:
  - `mockRecommendations.js`에서 가져오는 `RESTAURANTS` 하드코딩 변수 Import 제거
  - `getPlaces()` API를 `../api/placeApi.js`로부터 Import
  - `HomePage` 안에서 `useEffect` 훅을 사용해 마운트 시 `getPlaces`를 비동기 호출 후 내부 상태(`useState`)에 데이터 등록. 배열이 세팅되면 `applyFilters()`로 넘겨줌.

### 5.2 Food Type 필터를 다중 선택(최대 3개)으로 변경하기
현재 Food type은 `exploreOptions.js` 내에 `{ cat: 'all', ... }` 처럼 1개의 문자열(String)로 상태를 관리하고 있습니다. 이를 변경하려면 다음 2개의 파일을 수정해야 합니다.

1. **`src/features/explore/data/exploreOptions.js` (상태 구조 개편)**
   - **`EMPTY_FILTERS`**: `cat: 'all'` -> `cat: []` 형태로 빈 배열로 베이스 구조 변경
   - **`filterCount` 함수**: `cat === 'all'` 판별값을 쓰는 로직을 배열의 길이(length)를 감지하도록 변경
   - **`applyFilters` 함수**: `.includes()` 등을 이용해 필터 배열 안에 식당 고유 카테고리가 매치되는지 확인하도록 로직을 교체

2. **`src/features/explore/components/FilterSheet.jsx` (선택 로직 및 UI 제어)**
   - Pill 컴포넌트가 클릭(`onClick`)되었을 때 무조건 1개만 할당하던 `setDraft()` 제어문을 로직 변경. 이미 있는거면 필터 아웃 시키고 없는거면 배열에 담는 토글(Toggle) 형 배열 관리 로직 적용.
   - 최대 3개까지만 가능하므로 "안 눌려있는 걸 눌렀을 때 이미 배열 길이가 3개라면 `return` 시켜서 안 눌리게 차단하는" 제한 로직 추가.