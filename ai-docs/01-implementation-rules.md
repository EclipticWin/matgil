# 01-implementation-rules.md

## 기본 개발 규칙

이번 작업은 화면 껍데기 구현이 목표다.

불필요하게 과한 기능을 만들지 않는다.

현재는 mock 데이터와 mock 함수만 사용한다.

## TypeScript 금지

프론트엔드에서는 TypeScript를 사용하지 않는다.

금지:

* `.ts` 파일 생성
* `.tsx` 파일 생성
* Vite React TypeScript 템플릿 사용
* TypeScript 설정 파일 생성

반드시 React + JavaScript 기준으로 구현한다.

## 실제 연동 금지

아래 기능은 구현하지 않는다.

* 실제 Supabase 인증
* 실제 Supabase DB 연결
* 실제 Supabase Edge Functions 호출
* 실제 Solar API 호출
* 지도 API
* 네이버 검색 API
* pgvector
* 실시간 GPS
* 후기 저장
* 즐겨찾기 저장
* 마이페이지 실제 기능
* 복잡한 상태관리 라이브러리 추가
* 무거운 UI 라이브러리 추가

## 인증 관련 규칙

실제 인증은 구현하지 않는다.

로그인 화면은 UI만 구현한다.

이메일 로그인, 이메일 회원가입, Google 로그인, Facebook 로그인 버튼은 모두 mock 처리한다.

버튼 클릭 시 mock 로그인 상태 또는 게스트 상태로 홈 화면으로 이동하게 한다.

첫 화면은 로그인 화면이 아니라 홈 화면이다.

사용자는 로그인하지 않아도 아래 기능을 사용할 수 있어야 한다.

* 지역 선택
* 취향 선택
* 추천 결과 확인
* 자주 쓰는 표현 TTS

북마크와 마이페이지는 로그인 필요 안내 화면으로 처리한다.

## 소셜 로그인 버튼 규칙

Google, Facebook 로그인은 실제 연동하지 않는다.

실제 로고 이미지가 없어도 된다.

텍스트 기반 버튼 또는 간단한 원형 아이콘 자리만 표시한다.

외부 이미지 파일이나 아이콘 라이브러리를 무리하게 추가하지 않는다.

## 디자인 규칙

웹 애플리케이션이지만 모바일 앱처럼 보이도록 구성한다.

PC 화면에서 접속해도 중앙에 모바일 화면이 배치되어야 한다.

화면 기준:

* 기본 기준 너비: 360px
* 전체 컨테이너 최대 너비: `22.5rem`
* 360px보다 작은 모바일 화면에서도 내용이 잘리지 않도록 구성한다.
* CSS 크기 단위는 가능한 한 `rem`을 사용한다.
* `px` 사용은 최소화한다.

색상 규칙:

* 기본 배경은 흰색 중심으로 구성한다.
* 보더나 화면 영역 사이 빈 곳은 연한 회색을 사용한다.
* 텍스트는 검정 또는 진한 회색을 사용한다.
* 포인트 컬러는 반드시 `#fcbe32`를 사용한다.
* 파란색/보라색 중심 테마는 사용하지 않는다.

포인트 컬러 사용 위치:

* 주요 버튼
* 선택된 하단 메뉴
* 강조 아이콘
* 선택된 지역/취향 버튼
* 홈 버튼 강조

레이아웃 규칙:

* 모바일 앱처럼 세로형 레이아웃으로 구성한다.
* 카드, 버튼, 하단 메뉴바는 둥근 모서리를 사용한다.
* 버튼은 손가락으로 누르기 편한 높이로 만든다.
* 하단 메뉴바가 본문을 가리지 않도록 본문에 충분한 `padding-bottom`을 준다.
* 화면 좌우 여백은 작은 모바일에서도 너무 커지지 않게 한다.

## 용어 통일

식당 표현 TTS 화면의 사용자 표시 명칭은 **자주 쓰는 표현**으로 통일한다.

사용할 문구:

* 하단 메뉴명: `자주 쓰는 표현`
* 추천 결과 화면 버튼: `자주 쓰는 표현 보기`
* 화면 제목: `자주 쓰는 표현`

`회화 표현`, `식당 표현`, `TTS 표현` 등으로 사용자 화면 문구가 섞이지 않게 한다.

내부 파일명은 `phrases`를 사용해도 된다.

## 하단 메뉴바 규칙

하단 메뉴바는 모든 주요 화면 하단에 고정한다.

메뉴는 총 5개다.

1. 북마크
2. 인기맛집
3. 홈
4. 자주 쓰는 표현
5. 마이페이지

규칙:

* 홈 버튼은 가운데에 배치한다.
* 가운데 홈 버튼은 다른 메뉴보다 조금 더 강조한다.
* 선택된 메뉴에는 `#fcbe32`를 사용한다.
* 비선택 메뉴는 회색 계열로 표시한다.
* 북마크와 마이페이지는 로그인 필요 안내 페이지로 연결한다.
* 자주 쓰는 표현은 식당 표현 TTS 화면으로 연결한다.
* 인기맛집은 mock 인기맛집 화면으로 연결한다.
* 홈은 홈 화면으로 연결한다.
* 하단 메뉴바 때문에 본문이 가려지지 않도록 한다.

## 권장 폴더 구조

아래 구조를 기준으로 생성한다.

```txt
src/
  app/
    App.jsx
    router.jsx

  pages/
    LoginPage.jsx
    HomePage.jsx
    AreaPage.jsx
    PreferencePage.jsx
    LoadingPage.jsx
    ResultPage.jsx
    PhrasesPage.jsx
    PopularPage.jsx
    BookmarkPage.jsx
    MyPage.jsx

  features/
    auth/
      components/
        LoginForm.jsx
      services/
        mockAuthService.js

    area/
      components/
        AreaSelector.jsx
      data/
        mockAreas.js

    preference/
      components/
        PreferenceSelector.jsx
      data/
        preferenceOptions.js

    recommendation/
      components/
        RecommendationCard.jsx
        RecommendationSummary.jsx
      data/
        mockRecommendations.js
      services/
        recommendationService.js

    phrases/
      components/
        PhraseCard.jsx
        PhraseCategoryTabs.jsx
      data/
        phrases.js
      services/
        ttsService.js

    popular/
      components/
        PopularPlaceCard.jsx
      data/
        mockPopularPlaces.js

    navigation/
      components/
        BottomNavigation.jsx

  shared/
    components/
      AppLayout.jsx
      Header.jsx
      Button.jsx
      Card.jsx
      EmptyState.jsx
      StepIndicator.jsx

    constants/
      routes.js

    utils/
      classNames.js

  index.css
  main.jsx
```

## 구조 관련 조건

* `App.jsx`가 너무 비대해지지 않게 한다.
* 화면 전환은 `react-router-dom`을 사용해도 좋다.
* 단, 빠르게 작동하는 것이 중요하므로 설정은 과하게 복잡하게 만들지 않는다.
* 공통 버튼, 카드, 레이아웃은 `shared/components`로 분리한다.
* 기능별 컴포넌트와 mock 데이터는 `features` 하위에 둔다.
* 특정 기능에서만 쓰는 컴포넌트는 해당 feature 내부에 둔다.
* 나중에 Supabase Edge Functions와 Solar API를 연결할 수 있도록 `recommendationService.js`에 mock 추천 함수를 만들어둔다.
* `ttsService.js`에 Web Speech API 관련 함수를 분리한다.
* `authService`는 실제 인증이 아니라 mock 함수로만 만든다.

## 향후 확장 기준

나중에 커스텀 훅이 필요해지면 각 feature 내부에 `hooks` 폴더를 추가한다.

예:

```txt
features/
  recommendation/
    hooks/
      useRecommendation.js

  phrases/
    hooks/
      useTTS.js

  auth/
    hooks/
      useAuth.js
```

현재 1차 화면 껍데기 단계에서는 필요할 때만 만든다.

## 검증

구현 후 가능한 경우 아래 명령으로 오류를 확인한다.

```bash
npm run build
```

마지막에는 사용자가 실행할 명령어를 알려준다.

예:

```bash
npm install
npm run dev
```
