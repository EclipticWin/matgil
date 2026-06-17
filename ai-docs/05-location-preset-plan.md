# 05. Location Preset Plan — 기준 위치 선택 구조

## 작성 일자

2026-06-17

---

## 배경

Matgil의 핵심은 단순히 식당 하나를 검색하는 것이 아니라, 사용자가 여행할 지역이나 랜드마크를 기준으로 주변 음식점들을 묶어 **먹방 동선 / 코스** 형태로 추천하는 것이다.

현재까지 완료된 상태:

* Supabase `mg_places` 음식점 데이터 100개 확보
* 모든 음식점에 `latitude`, `longitude` 존재
* 모든 음식점에 `matgil_category_keys` 값 존재
* Food Type 필터는 `matgilCategoryKeys` 기준으로 동작
* Food Type 필터는 최대 3개까지 복수 선택 가능
* 현재 Map 화면에는 검색창, 현재 위치 버튼, Filter 버튼, Bottom Sheet가 존재
* 현재 `YOU'RE IN Myeongdong` 텍스트는 실제 상태가 아니라 하드코딩 상태
* 검색창은 실제 검색 기능이 아니라 UI만 존재하는 상태

---

## 핵심 판단

지금 단계에서는 랜드마크/관광지 데이터를 DB에 대량 수집하지 않는다.

이유:

* 구현 범위가 급격히 커짐
* 관광지 테이블 설계, 수집 함수, 검색 로직, 좌표 매칭까지 필요해짐
* 현재 MVP에서는 코스 추천 기능을 먼저 완성하는 것이 더 중요함

따라서 MVP에서는 주요 서울 지역/랜드마크를 **로컬 프리셋 상수**로 관리한다.

---

## 목표

사용자가 기준 위치를 선택하면, 해당 위치를 기준으로 음식점 목록이 가까운 순서로 정렬되도록 한다.

### 기본 목표

1. 앱 첫 진입 시 기본 기준 위치는 `Seoul City Hall`
2. 사용자는 현재 위치 버튼을 눌러 프리셋 위치를 선택할 수 있음
3. 선택한 위치명은 `YOU'RE IN ...` 영역에 표시됨
4. 음식점 목록은 선택 위치 기준 거리순으로 정렬됨
5. 아직 반경 필터로 결과를 자르지는 않음
6. GPS, 외부 지도 API, TourAPI 랜드마크 수집은 이번 단계에서 제외
7. 검색창은 이번 단계에서 수정하지 않음

---

## MVP 프리셋 위치 후보

```js
[
  {
    key: 'city_hall',
    label: 'Seoul City Hall',
    lat: 37.5663,
    lng: 126.9779,
    type: 'landmark',
  },
  {
    key: 'myeongdong',
    label: 'Myeongdong',
    lat: 37.5636,
    lng: 126.9834,
    type: 'area',
  },
  {
    key: 'hongdae',
    label: 'Hongdae',
    lat: 37.5563,
    lng: 126.9236,
    type: 'area',
  },
  {
    key: 'gangnam',
    label: 'Gangnam',
    lat: 37.4979,
    lng: 127.0276,
    type: 'area',
  },
  {
    key: 'seongsu',
    label: 'Seongsu',
    lat: 37.5446,
    lng: 127.0557,
    type: 'area',
  },
  {
    key: 'jongno',
    label: 'Jongno',
    lat: 37.5704,
    lng: 126.9922,
    type: 'area',
  },
  {
    key: 'gyeongbokgung',
    label: 'Gyeongbokgung',
    lat: 37.5796,
    lng: 126.9770,
    type: 'landmark',
  },
  {
    key: 'itaewon',
    label: 'Itaewon',
    lat: 37.5345,
    lng: 126.9946,
    type: 'area',
  },
  {
    key: 'dongdaemun',
    label: 'Dongdaemun',
    lat: 37.5700,
    lng: 127.0095,
    type: 'area',
  },
  {
    key: 'yeouido',
    label: 'Yeouido',
    lat: 37.5219,
    lng: 126.9246,
    type: 'area',
  },
]
```

좌표는 MVP 기준 프리셋 중심점이며, 정밀 지도 기능이 아니므로 현재 단계에서는 충분하다.

---

## 구현 방향

### 1. `locations.js` 신규 생성

위치 프리셋과 거리 계산 유틸을 둔다.

예상 위치:

```txt
src/features/explore/data/locations.js
```

포함할 내용:

* `PRESET_LOCATIONS`
* `DEFAULT_LOCATION`
* `calcDistanceKm`
* `sortPlacesByDistance`

거리 계산은 Haversine 공식을 사용한다.

---

### 2. `selectedLocation` 상태 추가

`HomePage.jsx`에서 관리한다.

이유:

* `HomePage.jsx`가 이미 `places`, `filters`, `sheet`, `lang` 등 Map 화면 주요 상태를 들고 있음
* `applyFilters(places, filters)` 호출 위치도 HomePage 쪽에 있음
* 선택 위치 기준 정렬도 `applyFilters` 이후에 처리하는 것이 자연스러움

예상 흐름:

```txt
places
→ applyFilters(places, filters)
→ sortPlacesByDistance(filteredPlaces, selectedLocation)
→ NearbySheet로 전달
```

---

### 3. LocationSheet 신규 생성

예상 위치:

```txt
src/features/explore/components/LocationSheet.jsx
```

역할:

* 프리셋 위치 목록 표시
* 현재 선택 위치 강조
* 위치 클릭 시 `onSelect(location)` 호출
* 선택 후 시트 닫기

기존 `FilterSheet`, `LanguageModal`, `Modal` 패턴을 최대한 따른다.

---

### 4. HomePage 수정

수정 방향:

* `selectedLocation` 상태 추가
* 기본값은 `DEFAULT_LOCATION`
* 기존 `YOU'RE IN Myeongdong` 하드코딩 제거
* `selectedLocation.label` 표시
* 현재 위치 버튼 클릭 시 `LocationSheet` 열기
* `sheet` 상태에 `'location'` 케이스 추가
* `applyFilters` 이후 `sortPlacesByDistance` 적용
* `LocationSheet`를 Modal로 렌더링

검색창은 이번 작업에서 건드리지 않는다.

---

### 5. NearbySheet 수정

수정 방향:

* `selectedLocation` prop 추가
* 제목을 가능하면 선택 위치 기반으로 표시

예:

```txt
Eat near Seoul City Hall
Eat near Myeongdong
Eat near Hongdae
```

* 각 장소에 `distanceKm` 값이 있으면 표시 가능
* 기존 카드/리스트 구조는 최대한 유지

---

## 이번 작업에서 하지 않는 것

* 랜드마크 DB 테이블 생성
* TourAPI 관광지/랜드마크 수집
* TourAPI `searchKeyword2` 연결
* GPS 실시간 위치
* 외부 지도 API 연동
* 실제 지도 이동 구현
* 검색창 실제 검색 기능
* 코스 카드 생성 로직
* 추천 결과 페이지 수정
* LLM 추천 이유 생성
* DB 작업
* Edge Function 수정
* Supabase deploy

---

## 추후 확장 방향

### 1. 로컬 프리셋 → DB 테이블화

나중에 필요하면 `PRESET_LOCATIONS`를 `mg_landmarks` 또는 `mg_locations` 테이블로 옮길 수 있다.

예상 구조:

```txt
mg_locations
- id
- key
- label
- type
- latitude
- longitude
- area_name
- is_active
```

### 2. TourAPI 키워드 검색 연결

추후 사용자가 직접 장소명을 검색할 수 있게 하려면:

```txt
사용자 검색어
→ TourAPI searchKeyword2
→ 관광지/랜드마크 좌표 획득
→ 해당 좌표 기준으로 DB 음식점 거리 계산
→ 코스 추천
```

이때 TourAPI는 식당을 매번 새로 찾는 용도보다, 사용자가 입력한 기준 위치의 좌표를 찾는 용도로 쓰는 것이 적절하다.

### 3. 반경 필터 추가

현재는 거리순 정렬만 한다.

나중에 데이터가 충분히 많아지면:

```txt
1차: 1.5km 이내
2차: 부족하면 3km 이내
3차: 그래도 부족하면 서울 전체 거리순
```

같은 방식으로 확장 가능하다.

---

## 현재 우선순위

```txt
1. 위치 프리셋 선택 구조 만들기
2. 선택 위치 기준 음식점 거리순 정렬
3. Bottom Sheet 목록에 선택 위치 반영
4. 그 다음 코스 카드 생성
5. 그 다음 추천 결과 페이지 연결
```

이번 작업의 목적은 “완전한 지도 검색”이 아니라, **코스 추천의 기준점이 되는 위치 상태를 만드는 것**이다.
