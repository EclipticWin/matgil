# 16. TODO — 검색 결과 언어 표시 분기 수정 필요

## 문서 목적

Map 검색 오버레이의 검색 결과 표시 방식에서 발견된 언어 분기 문제를 정리한다.

이 문서는 **아직 구현하지 않은 작업**에 대한 TODO 문서다.
현재 급한 작업 우선순위 때문에 실제 수정은 보류한다.

---

## 현재 상태

Map 화면은 `getPlaces('en')`로 변경되어 DB 음식점 데이터는 영어 우선 / 한국어 fallback 구조를 사용한다.

```txt
en 텍스트가 있으면 en 표시
en 텍스트가 없으면 ko fallback
```

또한 `SearchOverlay` 검색 결과 표시 개선 작업으로, Kakao Places 검색 결과가 우리 DB place와 매칭되는 경우 DB의 `matchedPlace.name`, `matchedPlace.address`를 표시하도록 변경했다.

현재 구현 요약:

```js
const matched = findAnchorPlace(r, places);
const displayName = matched ? matched.name : r.place_name;
const displayAddress = matched
  ? matched.address
  : formatSeoulDistrictAddress(r.address_name || r.road_address_name);
```

이 구조는 영어 모드에서는 유용하지만, 한국어 선택 상태에서도 DB 매칭 결과가 영어로 표시되는 문제가 있다.

---

## 발견된 문제

현재 언어 선택 모달에서 한국어가 선택된 상태여도, DB와 매칭되는 음식점 검색 결과가 영어로 표시된다.

예:

```txt
현재 언어: 한국어
검색어: gadam
검색 결과: Gadam (가담)
주소: 35 Eonju-ro 167-gil, Gangnam-gu, Seoul
```

한국어 선택 상태에서는 아래처럼 Kakao 원문이 그대로 보여야 한다.

```txt
가담
서울 강남구 신사동 ...
```

즉, 현재 문제는 다음과 같다.

```txt
SearchOverlay 검색 결과 표시가 현재 선택 언어를 고려하지 않음
DB matched place가 있으면 항상 matchedPlace.name/address를 사용함
영어 주소 축약도 언어와 무관하게 적용될 수 있음
```

---

## 원하는 정책

검색 결과 표시는 현재 선택 언어에 따라 달라져야 한다.

### 1. 현재 언어가 English인 경우

DB place와 매칭되는 Kakao 결과는 DB의 영어 우선 텍스트를 표시한다.

```txt
displayName = matchedPlace.name
displayAddress = matchedPlace.address
```

예:

```txt
Gadam (가담)
35 Eonju-ro 167-gil, Gangnam-gu, Seoul
```

DB place와 매칭되지 않는 일반 Kakao 결과는 장소명 원문은 유지하고, 주소만 영어식 축약 주소로 표시한다.

```txt
displayName = kakao.place_name
displayAddress = Seoul · District
```

예:

```txt
서울선릉과정릉
Seoul · Gangnam-gu
```

---

### 2. 현재 언어가 한국어인 경우

DB place와 매칭되더라도 검색 결과 목록은 Kakao 원문을 그대로 표시한다.

```txt
displayName = kakao.place_name
displayAddress = kakao.address_name || kakao.road_address_name
```

예:

```txt
가담
서울 강남구 신사동 ...
```

한국어 선택 상태에서는 다음을 하지 않는다.

```txt
DB 영어 텍스트로 치환하지 않음
Seoul · District 축약 주소를 사용하지 않음
```

---

## 구현 방향

`SearchOverlay`가 현재 선택된 언어를 기준으로 `displayName`, `displayAddress`를 결정하도록 수정해야 한다.

현재 언어 상태가 어디에 있는지 먼저 확인한다.

확인 후보:

```txt
HomePage.jsx
Language 모달 관련 state
SearchOverlay props
```

현재 언어 state가 이미 있다면 `SearchOverlay`에 prop으로 전달한다.

예:

```jsx
<SearchOverlay
  ...
  locale={selectedLanguage}
/>
```

프로젝트 내 실제 변수명에 맞춰 적용한다.

---

## 표시 분기 예시

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

핵심은 다음과 같다.

```txt
한국어 선택 상태에서는 DB 영어 텍스트로 치환하지 않는다.
한국어 선택 상태에서는 Seoul · District 축약 주소를 쓰지 않는다.
English 선택 상태에서만 DB 매칭 결과 또는 영어식 주소 축약을 사용한다.
```

---

## 수정 대상 예상 파일

```txt
src/features/explore/components/SearchOverlay.jsx
src/pages/HomePage.jsx
```

필요 시 언어 선택 모달 또는 언어 상태 관리 파일도 확인한다.

---

## 유지해야 할 것

검색 결과 선택 동작은 기존과 동일해야 한다.

`onSelect`로 넘기는 값은 기존처럼 Kakao 원문 기반을 유지한다.

```js
onSelect({
  key: null,
  label: r.place_name,
  lat: Number(r.y),
  lng: Number(r.x),
  source: 'search',
  address: r.address_name,
  categoryGroupCode: r.category_group_code,
});
```

이유:

```txt
selectedLocation label/address는 기존 Kakao 기준 흐름을 유지
handleSearchSelect → findAnchorPlace → anchorPlace 흐름 보존
검색 결과 선택 후 지도 이동/추천 재계산 동작 보존
```

---

## 주의사항

이번 작업에서는 아래를 하지 않는다.

```txt
DB 수정 금지
Edge Function 수정 금지
번역 함수 실행 금지
LLM 호출 금지
Food Type 필터 수정 금지
matgil_category_keys 수정 금지
getPlaces('en') 구조 변경 금지
anchorPlace 매칭 동작 변경 금지
검색 결과 선택 동작 변경 금지
docs / README 수정 금지
Git commit / push 금지
```

---

## 구현 후 확인할 것

1. 한국어 선택 상태에서 검색 결과가 기존처럼 한글 이름 / 한글 주소로 보이는지
2. English 선택 상태에서 DB 매칭되는 음식점은 영어 이름 / 영어 주소로 보이는지
3. English 선택 상태에서 DB 매칭 안 되는 일반 Kakao 결과는 원문 이름 + `Seoul · District`로 보이는지
4. 검색 결과 선택 후 지도 이동이 기존과 동일하게 작동하는지
5. anchorPlace 동작이 깨지지 않았는지
6. Food Type 필터가 그대로 작동하는지
7. `npm run build`가 통과하는지

---

## 현재 작업 상태

```txt
상태: 미구현 / TODO
우선순위: 높음
이유: 언어 선택이 한국어일 때 검색 결과가 영어로 표시되는 UX 오류 발생
```

현재는 다른 급한 작업 때문에 구현을 보류한다.
다음 세션에서 이 문서를 기준으로 SearchOverlay 언어 분기 수정을 진행하면 된다.
