# 18. EN/KO 언어 전환 및 검색 결과 표시 정리 계획 요청

## 작업 방식

이번 작업은 바로 구현하지 말고, 먼저 현재 코드 구조를 확인한 뒤 **수정 계획만 보고**한다.

코드 수정 금지.
파일 수정 금지.
DB 수정 금지.
Edge Function 수정 금지.
Supabase deploy 금지.
번역 함수 실행 금지.
git add / git commit / git push 금지.

허용되는 작업은 다음뿐이다.

```txt
- 현재 코드 파일 읽기
- 현재 구조 파악
- 수정 대상 파일 후보 정리
- 구현 단계 계획 작성
- 위험 요소 정리
- 사용자에게 확인이 필요한 항목 정리
```

이번 작업은 Matgil 앱의 EN/KO 언어 전환 구조를 제대로 잡기 위한 대공사다.
바로 구현하지 말고, 계획을 먼저 보고해라.

---

## 현재 프로젝트 최신 상태 요약

Matgil은 외국인 관광객을 위한 서울 맛집 동선 추천 웹앱이다.

현재는 초기 mock MVP 단계가 아니라, 이미 아래 기능들이 구현된 상태다.

```txt
- Supabase 기반 장소 데이터 조회
- mg_places / mg_place_texts / mg_place_food_details / mg_place_images 사용
- getPlaces(locale) 구조 존재
- mg_place_texts에 locale='ko', locale='en' 데이터 존재
- en 데이터는 TourAPI EN source + LLM machine translation으로 보강 중
- 현재 Map 화면은 getPlaces('en')로 영어 우선 표시 중
- Kakao Map 연동
- Kakao Places 검색 오버레이 구현
- 검색 결과가 DB place와 매칭되면 DB 영어 name/address 표시
- 검색 결과가 DB와 미매칭이면 원문 이름 + Seoul · District 형식 표시
- GPS 현재 위치 추천 구현
- 지도 드래그 후 Find routes here 구현
- 프리셋 hot place 선택 구현
- Food Type 필터 구현
- 추천 코스 다중 생성 구현
- 코스 상세 Bottom Sheet 구현
- 장소 상세 Bottom Sheet 구현
- Phrases 탭 / TTS / Voice help 구현
- Auth / Community MVP 구현
```

현재 문제는 LanguageModal에서 EN/KO를 선택할 수는 있지만, 실제 앱 전체 표시 언어와 데이터 조회 언어가 제대로 연결되어 있지 않다는 점이다.

---

## 이번 작업의 핵심 목표

LanguageModal에서 선택한 언어에 따라 앱 핵심 화면이 아래처럼 동작해야 한다.

### English 선택 상태

```txt
- 장소 데이터는 getPlaces('en') 기준
- en 텍스트가 있으면 en 표시
- en 텍스트가 없으면 ko fallback 허용
- SearchOverlay에서 DB 매칭 음식점/카페는 DB 영어 name/address 표시
- SearchOverlay에서 DB 미매칭 결과는 Kakao 원문 이름 + Seoul · District 주소 표시
- 추천 코스 제목은 영어
- 코스 상세 / 장소 상세 / 필터 / NearbySheet 문구는 영어
```

### 한국어 선택 상태

```txt
- 장소 데이터는 getPlaces('ko') 기준
- ko 텍스트가 있으면 ko 표시
- ko 텍스트가 없으면 en fallback 허용
- SearchOverlay 검색 결과는 Kakao 원문 한글 name/address 표시
- 한국어 모드에서는 DB 영어 name/address로 치환하지 않음
- 한국어 모드에서는 Seoul · District 주소 축약을 사용하지 않음
- 추천 코스 제목은 한국어
- 코스 상세 / 장소 상세 / 필터 / NearbySheet 문구는 한국어
```

---

## 중요한 정책

### 1. locale 값 통일

현재 LanguageModal에서 `EN`, `KO` 같은 코드가 쓰이고 있을 수 있다.

실제 데이터 조회와 i18n 처리는 아래처럼 소문자 locale로 통일하는 방향을 검토한다.

```js
locale = 'en' | 'ko'
```

LanguageModal 표시용 code가 `EN`, `KO`라면 내부 변환 함수가 필요할 수 있다.

```js
EN -> en
KO -> ko
```

---

### 2. 전역 locale 상태 필요 여부 검토

현재 `lang` state가 `HomePage.jsx` 안에만 있을 가능성이 높다.

이번 작업에서는 다음 중 어떤 방식이 가장 안전한지 검토한다.

```txt
A. HomePage 내부 lang state를 유지하고 Map 핵심 흐름만 먼저 연결
B. LocaleProvider / useLocale 전역 상태를 추가
C. 기존 AuthProvider나 AppLayout 근처에 locale state를 올림
```

권장 방향은 `LocaleProvider` 또는 그에 준하는 전역 locale 구조다.

이유:

```txt
- BottomNavigation
- Map
- SearchOverlay
- FilterSheet
- NearbySheet
- Course detail
- Place detail
- Phrases
- Community
- Login/My
```

위 화면들이 결국 같은 언어 상태를 봐야 하기 때문이다.

단, 1차 구현에서 범위를 줄이려면 Map 핵심 흐름부터 적용하고, 나머지 탭은 2단계로 미룰 수 있다.

계획에서 어떤 방식이 더 안전한지 판단해서 보고해라.

---

## 우선 구현 범위 제안

이번 대공사는 한 번에 모든 화면을 번역하지 말고 단계별로 나누는 것이 좋다.

계획에서 아래 단계 분리를 검토해라.

### Stage 1 — Map 핵심 흐름 EN/KO 전환

우선순위 가장 높음.

대상:

```txt
- LanguageModal 선택값을 실제 locale state에 연결
- HomePage getPlaces(locale)로 변경
- locale 변경 시 places 재조회
- SearchOverlay 검색 결과 표시 언어 분기
- FilterSheet 문구 번역
- NearbySheet 문구 번역
- CourseCard에 필요한 표시 문구 번역
- TodayCourseDetail 문구 번역
- PlaceDetailSheet 문구 번역
- courseBuilder 코스 제목 locale 분기
- 빈 상태 / 로딩 상태 문구 번역
```

### Stage 2 — 공통 레이아웃 및 주요 탭 문구 번역

대상:

```txt
- BottomNavigation
- TopBar
- LoginPage / SignUpPage
- MyPage
- BookmarkPage
- CommunityPage
- CoursesPage
```

### Stage 3 — Phrases / Voice help 언어 정리

대상:

```txt
- PhrasesPage UI 문구
- Phrase category label
- intentEn / note를 한국어로 보여줄지 여부
- Voice help userLanguage를 locale과 연결할지 여부
```

주의:

Phrases는 외국인 관광객이 한국어 표현을 배우는 기능이다.
한국어 모드라고 해서 한국어 표현 자체를 숨기거나 구조를 크게 바꾸면 안 된다.
한국어 UI 번역과 표현 데이터 번역은 분리해서 판단해야 한다.

---

## 반드시 확인할 파일

계획 수립 전에 아래 파일들을 먼저 확인해라.

```txt
src/pages/HomePage.jsx
src/features/explore/components/LanguageModal.jsx
src/features/explore/components/SearchOverlay.jsx
src/features/explore/components/FilterSheet.jsx
src/features/explore/components/NearbySheet.jsx
src/features/explore/components/TodayCourseDetail.jsx
src/features/explore/components/PlaceDetailSheet.jsx
src/features/explore/data/exploreOptions.js
src/features/explore/data/courseBuilder.js
src/features/explore/services/anchorMatchService.js
src/api/placeApi.js
src/shared/components/TopBar.jsx
src/features/navigation/components/BottomNavigation.jsx
src/app/App.jsx
src/app/router.jsx
```

필요 시 아래 파일도 확인한다.

```txt
src/pages/PhrasesPage.jsx
src/features/phrases/data/phrases.js
src/features/phrases/components/VoiceHelpPlaceholder.jsx
src/features/phrases/services/ttsService.js
src/pages/CommunityPage.jsx
src/pages/LoginPage.jsx
src/pages/SignUpPage.jsx
src/pages/MyPage.jsx
```

단, Phrases / Voice help 안정 파일은 이번 1차 구현에서 바로 수정하지 않는 방향을 우선 검토한다.

---

## SearchOverlay 언어 분기 정책

이 작업은 특히 중요하다.

현재 TODO 문서의 문제를 반영해야 한다.

현재는 DB와 매칭되는 Kakao 검색 결과가 있으면 항상 DB place의 name/address를 표시하는 구조일 수 있다.

영어 모드에서는 이게 맞다.

```txt
Gadam (가담)
35 Eonju-ro 167-gil, Gangnam-gu, Seoul
```

하지만 한국어 모드에서는 틀리다.

한국어 모드에서는 DB와 매칭되더라도 Kakao 원문 결과를 보여줘야 한다.

```txt
가담
서울 강남구 신사동 ...
```

계획에는 반드시 아래 분기 방식을 포함해라.

```js
const isEnglish = locale === 'en';

const matched = isEnglish ? findAnchorPlace(r, places) : null;

const displayName =
  isEnglish && matched
    ? matched.name
    : r.place_name;

const displayAddress =
  isEnglish
    ? matched
      ? matched.address
      : formatSeoulDistrictAddress(r.address_name || r.road_address_name)
    : r.address_name || r.road_address_name;
```

중요:

```txt
- onSelect로 넘기는 값은 기존처럼 Kakao 원문 기반 유지
- selectedLocation label/address 흐름을 함부로 바꾸지 않음
- handleSearchSelect → findAnchorPlace → anchorPlace 흐름 유지
- anchor 매칭 동작 깨지지 않게 할 것
```

---

## getPlaces(locale) 연결 정책

현재 `HomePage.jsx`에서 `getPlaces('en')`가 고정되어 있을 가능성이 높다.

목표:

```js
getPlaces(locale)
```

locale 변경 시 기존 places를 다시 불러오게 해야 한다.

검토할 사항:

```txt
- locale 변경 시 placesLoading 처리
- locale 변경 시 activeCourseId reset 필요 여부
- locale 변경 시 anchorPlace reset 필요 여부
- locale 변경 시 selectedLocation 유지 여부
```

권장:

```txt
- selectedLocation은 유지
- filters는 유지
- gpsStatus는 유지 가능
- activeCourseId는 reset
- anchorPlace는 현재 places 객체 기반이므로 reset 또는 재매칭 필요
```

anchorPlace는 places 객체가 locale에 따라 다시 만들어지면 참조가 낡을 수 있다.
계획에서 이 부분을 반드시 검토해라.

---

## courseBuilder 제목 언어 분기

현재 `courseBuilder.js`의 코스 제목은 영어 고정일 가능성이 높다.

예:

```txt
Seoul City Hall Cafe & Bites
Seoul City Hall Noodle Walk
Seoul City Hall Food Walk
```

한국어 모드에서는 한국어 제목이 필요하다.

예:

```txt
서울시청 카페와 맛집
서울시청 면 요리 동선
서울시청 맛집 동선
```

계획에서 아래 중 어떤 방식이 적절한지 판단해라.

```txt
A. buildRecommendedCourses에 locale 전달
B. courseBuilder는 titleKey/titleType만 만들고 UI에서 번역
C. courseBuilder 기존 title 유지, UI에서 locale별 displayTitle 생성
```

현재 구조를 덜 흔드는 방식으로 제안해라.

---

## UI dictionary 구조 제안

하드코딩 문구가 많을 것으로 예상된다.

계획에서 dictionary 구조를 제안해라.

예상 파일 후보:

```txt
src/features/i18n/LocaleProvider.jsx
src/features/i18n/useLocale.js
src/features/i18n/dictionary.js
```

또는 더 가볍게:

```txt
src/shared/i18n/LocaleProvider.jsx
src/shared/i18n/dictionary.js
```

dictionary 예시:

```js
export const DICTIONARY = {
  en: {
    map: {
      searchPlaceholder: 'Search dishes, places...',
      findRoutesHere: 'Find routes here',
      todayPicks: "Today's picks",
      noRoutesTitle: 'No routes found nearby.',
    },
  },
  ko: {
    map: {
      searchPlaceholder: '음식, 장소를 검색하세요...',
      findRoutesHere: '이 지역에서 찾기',
      todayPicks: '오늘의 추천',
      noRoutesTitle: '근처 동선을 찾지 못했습니다.',
    },
  },
};
```

계획에서 `t(key)` 형태의 헬퍼가 필요한지 검토해라.

---

## 사용자 수동 작업으로 분리할 항목

아래는 Claude Code가 자동으로 처리하지 말고, 필요하면 사용자에게 요청할 항목이다.

```txt
- Supabase SQL Editor에서 locale/translation_status 분포 확인
- ko_without_en_count 확인
- 번역이 부족한 경우 mg-place-translate-en Edge Function 수동 실행
- 번역 결과 품질 육안 검토
- Supabase DB row 직접 수정
- Edge Function deploy
- Git commit / push
```

Claude는 이번 작업에서 DB에 내용을 넣거나 Edge Function을 실행하지 않는다.

---

## 금지사항

이번 계획 수립 및 이후 구현에서 아래는 금지한다.

```txt
- git add
- git commit
- git push
- 자동 커밋
- 자동 푸시
- Supabase DB 마이그레이션
- Supabase SQL 실행
- Supabase deploy
- Edge Function 수정
- Edge Function 실행
- mg-place-translate-en 실행
- OpenAI / Solar 호출
- TourAPI 호출
- API key / Secrets 수정
- Kakao key 수정
- NearbySheet drag/snap 로직 수정
- Modal draggableClose 로직 수정
- ttsService.js 수정
- VoiceHelpPlaceholder.jsx 수정
- speechRecognitionService.js 수정
- mg-voice-help Edge Function 수정
- 추천 알고리즘 대규모 변경
- Phrases 데이터 85개 전체 수정
```

특히 이미 안정화된 아래 기능을 깨면 안 된다.

```txt
- NearbySheet full / peek / collapsed
- NearbySheet 전체 영역 드래그
- 코스 카드 클릭 → 코스 상세
- route stop 클릭 → 장소 상세
- FilterSheet 모바일 드래그 닫기
- SearchOverlay 검색바 정렬
- GPS 버튼
- Find routes here
- Kakao Map 마커/폴리라인
- TTS 첫 클릭 재생
- Voice help 음성 입력 / LLM 분석
```

---

## 계획 보고 형식

코드 수정하지 말고 아래 형식으로만 보고해라.

```txt
1. 현재 언어 상태 구조 파악 결과
2. 현재 getPlaces(locale) 사용 상태
3. 현재 LanguageModal 구조
4. SearchOverlay 검색 결과 표시 구조
5. 코스 제목 생성 구조
6. 하드코딩 UI 문구가 많은 주요 파일
7. 추천하는 i18n 구조
8. Stage 1 구현 범위
9. Stage 2 이후로 미룰 범위
10. 수정 예상 파일 목록
11. 사용자 수동 작업으로 분리할 항목
12. 위험 요소와 방지책
13. 구현 순서
14. 구현 전 사용자 확인이 필요한 질문
```

마지막에 다음 문장을 포함해라.

```txt
아직 코드는 수정하지 않았고, 커밋/푸시도 하지 않았습니다. 승인하면 Stage 1부터 진행하겠습니다.
```

---

## 이번 계획의 완료 기준

아래 조건을 만족하면 계획 수립 완료로 본다.

```txt
- 현재 코드 기준으로 실제 수정 파일 후보가 정리됨
- EN/KO locale 상태를 어디에 둘지 제안됨
- getPlaces(locale) 재조회 흐름이 정리됨
- SearchOverlay 언어 분기 정책이 반영됨
- courseBuilder 제목 언어 처리 방향이 정리됨
- Map 핵심 흐름과 나머지 탭 작업이 단계 분리됨
- DB/Edge Function/번역 실행이 사용자 수동 작업으로 분리됨
- 구현 전 위험 요소가 정리됨
```
