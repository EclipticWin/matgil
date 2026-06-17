# 06. Course Recommendation Plan — TODAY'S PICK 실제 데이터 기반 전환

## 목적

Map 화면 Bottom Sheet의 `TODAY'S PICK` 하드코딩 코스 카드를 실제 `nearby places` 기반 코스 카드로 전환한다.

이번 단계의 목표는 Kakao Map, LLM, 상세 코스 페이지 구현이 아니라, **현재 위치와 Food Type 필터 결과를 기반으로 1개의 추천 코스 데이터를 생성하고 카드에 표시할 수 있는 구조를 만드는 것**이다.

---

## 현재 구현 상태

### Supabase 음식점 데이터

* `mg_places` 기준 음식점 데이터 총 100개가 있다.
* 모든 place에 `latitude`, `longitude`, `matgilCategoryKeys`가 있다.
* `matgilCategoryKeys` 빈 배열 데이터는 0개다.
* `other` 비율이 높지만, MVP에서는 코스 기능 구현을 우선한다.

### `getPlaces()`

`src/api/placeApi.js`의 `getPlaces('ko')`는 Supabase에서 음식점 데이터를 가져오고, 정규화된 place 객체를 반환한다.

현재 place 객체는 대략 아래 필드를 가진다.

```js
{
  id,
  name,
  address,
  description,
  imageUrl,
  latitude,
  longitude,
  firstMenu,
  treatMenu,
  openTime,
  restDate,
  parking,
  packing,
  tags,
  tel,
  hasParking,
  hasPacking,
  hasOpenTime,
  hasMenuInfo,
  hasImage,
  hasLocation,
  matgilCategoryKeys
}
```

### Food Type 필터

* Food Type 필터는 `matgilCategoryKeys` 기반으로 동작한다.
* Food Type 필터는 최대 3개까지 복수 선택 가능하다.
* `cat: []`은 All과 같은 의미다.
* Food Type 선택 시 `applyFilters(places, filters)` 결과 안에서만 목록이 나온다.
* Food Type은 코스 점수 가산점이 아니라 **후보군을 거르는 기본 필터**다.

### 위치 프리셋 / 거리순 정렬

`src/features/explore/data/locations.js`에 아래 기능이 있다.

```js
PRESET_LOCATIONS
DEFAULT_LOCATION
calcDistanceKm
sortPlacesByDistance
```

현재 `HomePage.jsx`에서는 아래 흐름이 동작한다.

```js
sortPlacesByDistance(applyFilters(places, filters), selectedLocation)
```

즉 `NearbySheet`에는 선택 위치 기준으로 거리순 정렬된 `nearby places`가 전달된다.

### 현재 미구현 / 보류 상태

아래 기능들은 아직 구현하지 않는다.

* Kakao Map API
* 지도 마커
* polyline
* 실제 도보 경로 계산
* LLM 추천 / LLM 설명 생성
* 검색창 실제 검색
* 상세 코스 페이지
* 로그인 기반 취향 저장
* 예산 / price 필터의 실제 데이터 기반 처리
* features 필터의 실제 데이터 기반 처리
* nearby 개수 제한

`price/features` UI 또는 코드 흔적은 있을 수 있지만, 실제 Supabase 데이터 기반으로 신뢰할 수 있는 상태는 아니므로 이번 추천 알고리즘에서 강하게 반영하지 않는다.

---

## 이번 작업 목표

Bottom Sheet의 `TODAY'S PICK` 카드에 있는 하드코딩 코스명, 예를 들어 `Myeongdong Night Eats`, 를 실제 nearby places 기반 코스 카드로 대체한다.

이번 작업에서 만들 코스는 1개다.

```js
{
  id: 'today-pick',
  title: 'Seoul City Hall Food Walk',
  stopCount: 3,
  stops: [],
  totalDistanceKm,
  estimatedTime,
  score
}
```

---

## 코스 기본 정책

### stop 개수

기본 stop 개수는 3개로 고정한다.

```js
const DEFAULT_STOP_COUNT = 3;
```

다만 후보가 부족할 때 앱이 깨지지 않도록 fallback을 반드시 둔다.

| 후보 수  | 결과                           |
| ----- | ---------------------------- |
| 3개 이상 | 3 stops                      |
| 2개    | 2 stops                      |
| 1개    | 1 stop 기반 단일 추천 카드 또는 안전한 표시 |
| 0개    | 기존 EmptyState 또는 안전한 안내 상태   |

나중에 2개/4개 코스로 바꾸기 쉽도록 stop 개수는 상수로 관리한다.

### 후보 제한

화면에 표시되는 nearby 개수 제한은 아직 하지 않는다.

다만 코스 조합 계산 성능을 위해 코스 생성용 후보는 `nearby` 상위 20개 정도만 사용해도 된다.

```js
const COURSE_CANDIDATE_LIMIT = 20;
```

---

## 코스 생성 전제

코스 생성 함수는 이미 필터링되고 거리순 정렬된 `nearby places`를 입력으로 받는다.

```js
buildTodayCourse({
  places: nearby,
  selectedLocation,
  selectedFoodTypes
})
```

중요한 전제:

* Food Type은 추천 점수 가산점이 아니다.
* Food Type은 후보군 필터다.
* 사용자가 Food Type을 선택했다면 이미 필터링된 nearby places 안에서만 코스를 만든다.
* 사용자가 Food Type을 선택하지 않았다면 전체 nearby places 안에서 코스를 만든다.
* 같은 입력이면 항상 같은 결과가 나와야 한다.
* 랜덤을 사용하지 않는다.
* LLM을 사용하지 않는다.

---

## 코스 선정 기준

### 1. 기본 화면 / Food Type 미선택 상태

Food Type을 선택하지 않은 상태에서는 카테고리 다양성을 중요하게 본다.

예:

```txt
bbq + cafe + street
noodle + stew + cafe
rice + seafood + cafe
```

같은 카테고리 3개만 뽑는 것보다 가능한 서로 다른 성격의 장소를 섞는다.

### 2. Food Type 선택 상태

Food Type 선택 상태에서는 이미 선택된 Food Type으로 필터링된 후보 안에서만 코스를 만든다.

예:

```txt
선택: bbq, stew
→ bbq 또는 stew가 포함된 후보만 nearby로 들어옴
→ 그 후보 안에서 코스 조합
```

이 상태에서는 다양성보다 선택 조건 준수가 더 중요하다.

### 3. 클러스터 우선

선택 위치에서 첫 식당이 무조건 가까운 것보다, stops끼리 서로 가까운 클러스터를 더 중요하게 본다.

즉 아래 케이스도 좋은 코스가 될 수 있다.

```txt
기준 위치에서 1.8km 떨어져 있지만
A, B, C가 서로 300m 안에 붙어 있음
→ 좋은 동선 코스
```

### 4. 식사 + 카페

가능하면 식사 장소 2개 + cafe 1개 조합을 선호한다.

카페 후보가 없으면 일반 음식점 3개로 fallback한다.

### 5. 데이터 품질

이미지 있는 장소, 메뉴 정보 있는 장소를 우선한다.

다만 이미지가 없다는 이유만으로 완전히 배제하지 않는다.

### 6. other 처리

`other`는 무조건 제외하지 않는다.

* 사용자가 `other`를 Food Type으로 선택했다면 정상 후보로 사용한다.
* Food Type 미선택 상태에서 `matgilCategoryKeys`가 `['other']`만인 장소는 약하게만 감점한다.
* 이미지, 메뉴, 거리 조건이 좋으면 `other`도 선택될 수 있다.

---

## 점수 계산 기준

각 조합에 대해 아래 점수를 계산하고, 가장 점수가 높은 조합을 `TODAY'S PICK`으로 선택한다.

```js
courseScore =
  clusterScore
  + diversityScore
  + cafeBonus
  + dataQualityScore
  + startAccessScore
  - weakOtherPenalty
```

---

### 1. clusterScore — 최대 35점

stops끼리의 총 이동거리 합이 짧을수록 높다.

* 3 stops: `stop1-stop2 + stop2-stop3`
* 2 stops: `stop1-stop2`
* 1 stop: 0

거리 계산에는 기존 `calcDistanceKm`를 사용한다.

| stop 간 총 이동거리 |  점수 |
| ------------- | --: |
| 0.5km 이하      | +35 |
| 1.0km 이하      | +28 |
| 1.5km 이하      | +20 |
| 2.0km 이하      | +12 |
| 2.0km 초과      |  +5 |

---

### 2. diversityScore

Food Type 미선택 상태에서는 최대 20점이다.

| 조건               |  점수 |
| ---------------- | --: |
| 서로 다른 카테고리 3종 이상 | +20 |
| 서로 다른 카테고리 2종    | +12 |
| 전부 같은 성격         |  +5 |

Food Type 선택 상태에서는 최대 10점이다.

| 조건               |  점수 |
| ---------------- | --: |
| 서로 다른 카테고리 3종 이상 | +10 |
| 서로 다른 카테고리 2종    |  +6 |
| 전부 같은 성격         |  +3 |

카테고리 판단은 `matgilCategoryKeys`를 사용한다.

대표 카테고리는 `matgilCategoryKeys[0]`를 우선 사용할 수 있다. 필요하면 전체 key set을 활용해도 된다.

---

### 3. cafeBonus — 최대 15점

stops 중 `matgilCategoryKeys`에 `cafe`가 포함된 장소가 있으면 +15점.

카페가 없으면 +0점.

후보에 cafe가 전혀 없어도 에러가 나면 안 된다.

---

### 4. dataQualityScore — 최대 20점

각 stop별 품질 점수를 계산한 뒤 합산하고, 최대 20점으로 제한한다.

place 1개당:

| 조건                                        | 점수 |
| ----------------------------------------- | -: |
| `imageUrl` 또는 `hasImage` 있음               | +3 |
| `firstMenu` 또는 `hasMenuInfo` 있음           | +2 |
| `latitude`, `longitude` 있음                | +2 |
| `matgilCategoryKeys`가 있고 `['other']`만은 아님 | +2 |

최종 계산:

```js
dataQualityScore = Math.min(20, sumOfPlaceQualityScores);
```

---

### 5. startAccessScore — 최대 10점

선택 위치에서 첫 stop까지의 거리 기준이다.

이 점수는 보조 점수다. 클러스터 점수보다 중요하지 않다.

| 첫 stop 거리 |  점수 |
| --------- | --: |
| 0.5km 이하  | +10 |
| 1.0km 이하  |  +8 |
| 2.0km 이하  |  +5 |
| 3.0km 이하  |  +2 |
| 3.0km 초과  |  +0 |

---

### 6. weakOtherPenalty

`other`는 강하게 배제하지 않는다.

| 조건                                         |        감점 |
| ------------------------------------------ | --------: |
| 사용자가 `other`를 Food Type으로 선택한 경우           |         0 |
| Food Type 미선택 상태에서 `['other']`만 있는 stop 포함 |    장소당 -2 |
| Food Type 선택 상태에서 필터 결과로 other 포함          | 과도한 감점 없음 |

---

## Tie-break 기준

점수가 같은 경우 랜덤을 쓰지 않고 아래 순서로 고정 정렬한다.

1. stops끼리의 총 이동거리 합이 짧은 코스
2. 이미지 있는 장소 수가 많은 코스
3. 첫 stop이 `selectedLocation`에서 가까운 코스
4. stop id들을 오름차순 정렬해 문자열로 합쳤을 때 사전순이 빠른 코스

이렇게 하면 같은 입력에서 항상 같은 결과가 나온다.

---

## 코스 제목 정책

LLM을 사용하지 않고 rule-based로 만든다.

하드코딩된 `Myeongdong Night Eats`는 제거한다.

`selectedLocation.label`을 기반으로 제목을 만든다.

제목 우선순위 예:

1. cafe 포함 + 일반 음식점 포함 → `${selectedLocation.label} Cafe & Bites`
2. street 카테고리가 중심 → `${selectedLocation.label} Street Food Tour`
3. bbq 카테고리가 중심 → `${selectedLocation.label} Korean BBQ Route`
4. noodle 카테고리가 중심 → `${selectedLocation.label} Noodle Walk`
5. 그 외 → `${selectedLocation.label} Food Walk`

제목 생성도 deterministic해야 한다.

---

## 코스 데이터 구조

나중에 Kakao Map 마커/선을 붙일 수 있도록 stops 배열에 좌표를 포함한다.

```js
{
  id: 'today-pick',
  title: 'Seoul City Hall Food Walk',
  stopCount: 3,
  stops: [
    {
      id,
      name,
      latitude,
      longitude,
      imageUrl,
      firstMenu,
      address,
      matgilCategoryKeys,
      distanceKm
    }
  ],
  totalDistanceKm,
  estimatedTime,
  score
}
```

`totalDistanceKm`는 실제 도보 경로가 아니라 stop 간 좌표 거리의 단순 합이다.

Kakao polyline / 도보 경로 계산은 아직 하지 않는다.

`estimatedTime`은 rule-based로 만든다.

| stop 수 | 예상 시간     |
| -----: | --------- |
|      1 | `~30 min` |
|      2 | `~1 hr`   |
|      3 | `~1.5 hr` |
|      4 | `~2 hr`   |

---

## 구현 위치 후보

코스 생성 함수는 UI 컴포넌트 안에 직접 넣지 않는다.

후보:

```txt
src/features/explore/data/courseBuilder.js
```

또는

```txt
src/features/explore/utils/courseBuilder.js
```

추천은 `src/features/explore/data/courseBuilder.js`.

이유:

* 현재 `exploreOptions.js`, `locations.js`가 `data` 폴더에 있음
* 코스 생성도 화면 데이터 구성 로직에 가까움
* NearbySheet UI와 분리 가능

---

## 이번 작업에서 수정 가능성이 있는 파일

조사 후 확정한다.

예상 파일:

```txt
src/features/explore/data/courseBuilder.js
src/features/explore/components/NearbySheet.jsx
src/pages/HomePage.jsx
```

필요할 경우 `filters.cat` 또는 selected Food Type 정보를 `NearbySheet` / course builder에 넘기기 위해 `HomePage.jsx` 수정이 필요할 수 있다.

---

## 이번 작업에서 하지 않는 것

* Kakao Map API 붙이기
* 지도 마커 만들기
* polyline 만들기
* 실제 도보 경로 계산
* DB 작업
* Edge Function 수정
* Supabase deploy
* LLM 붙이기
* 상세 코스 페이지 만들기
* 검색창 기능 구현
* Food Type 필터 로직 변경
* price/features 필터 새로 구현
* nearby 개수 제한
* 디자인 대폭 변경

---

## 구현 전 확인할 것

1. `NearbySheet.jsx`에서 TODAY'S PICK 하드코딩 카드 위치 확인
2. NearbySheet가 받는 props 확인
3. nearby place 객체 구조 확인
4. `selectedLocation`이 NearbySheet까지 전달되는지 확인
5. 현재 `filters` 또는 Food Type 선택 상태를 NearbySheet에서 알 수 있는지 확인
6. Food Type 선택 여부를 코스 점수에 반영하려면 `filters.cat` 또는 `selectedFoodTypes`를 prop으로 넘기는 것이 필요한지 확인
7. 코스 생성 함수를 어디에 두는 것이 좋은지 확인
8. fallback 처리를 어디에서 할지 확인
9. 필요한 수정 파일 목록 정리

---

## 최종 원칙

```txt
랜덤 금지
LLM 금지
점수 기준 고정
Tie-break 고정
입력 nearby가 같으면 결과도 항상 같게
현재 구현된 필드만 사용
아직 미구현된 기능은 확장 예정으로만 남김
```
