# 06. Food Type 복수 선택 + 위치 프리셋 기반 거리순 정렬

## 작업 일자

2026-06-17

---

## 이전 작업 요약 (05)

- `supabase/functions/mg-tour-seed/index.ts` 로컬 백업 등록
- `classifyMatgilCategories` 함수 추가 — `title + firstMenu` 기준 17개 카테고리 자동 분류
- Edge Function CLI 배포 완료
- `mg_places` 총 100개, `matgil_category_keys` 빈 배열 데이터 0개

---

## 이번 세션에서 한 것

### 작업 1: Food Type 필터 복수 선택 전환

#### 배경

기존 Food Type 필터는 단일 선택 (`cat: 'all'` 문자열)만 가능했다.
`price`, `features`는 이미 배열 기반이었고, Food Type도 배열로 통일하기로 결정.

#### 변경 파일: `src/features/explore/data/exploreOptions.js`

- `EMPTY_FILTERS.cat`: `'all'` → `[]`
- `filterCount`: `f.cat !== 'all' ? 1 : 0` → `Array.isArray(f.cat) ? f.cat.length : 0`
- `matchesCat(place, cats)`: 배열 기준으로 교체
  - 빈 배열이면 전체 노출
  - `cats.some((cat) => place.matgilCategoryKeys?.includes(cat))` OR 조건

#### 변경 파일: `src/features/explore/components/FilterSheet.jsx`

- Food type 섹션 선택 로직 교체
  - `All` 칩: `cur.length === 0` 일 때 active, 클릭 시 `cat: []`
  - 나머지 칩: `cur.includes(c.key)` 일 때 active
  - 최대 3개 선택 제한
  - 3개 초과 시도 시 2초 자동 소멸 toast 안내 메시지 표시
    - 위치: 헤더 영역(`shrink-0`) 안 — 스크롤과 무관하게 항상 노출
    - `role="status" aria-live="polite"` 접근성 처리
    - `useRef` + `setTimeout` 기반 타이머, 언마운트 시 cleanup
  - 카테고리 해제 / All / Reset 클릭 시 toast 즉시 소멸
- 모든 `draft.cat` 접근 시 `Array.isArray(draft.cat) ? draft.cat : []` 방어 처리

**동작 규칙 요약:**

| 상황 | 결과 |
|---|---|
| `cat: []` | All과 동일 — 전체 노출 |
| `cat: ['bbq', 'stew']` | bbq 또는 stew 포함 장소 노출 |
| 3개 선택 상태에서 4번째 클릭 | 무시 + 헤더 toast 안내 |
| 선택 카테고리 재클릭 | 해제 |

커밋: `fcc42de`

---

### 작업 2: 위치 프리셋 + 거리순 정렬

#### 배경

Map 화면의 "You're in Myeongdong"이 하드코딩 상태였고, 기준 위치 상태가 없었다.
랜드마크 DB 수집 없이 로컬 프리셋으로 MVP를 먼저 완성하기로 결정.

#### 신규 파일: `src/features/explore/data/locations.js`

```js
PRESET_LOCATIONS  // 10개 서울 주요 지역/랜드마크
DEFAULT_LOCATION  // Seoul City Hall (PRESET_LOCATIONS[0])
calcDistanceKm(lat1, lng1, lat2, lng2)  // Haversine 공식, km 반환
sortPlacesByDistance(places, location)
// - places에 distanceKm 주입
// - 거리순 정렬
// - latitude/longitude null인 장소는 맨 뒤로
// - location null이면 원래 순서 유지
```

**프리셋 위치 목록:**

| key | label | type |
|---|---|---|
| `city_hall` | Seoul City Hall | landmark |
| `myeongdong` | Myeongdong | area |
| `hongdae` | Hongdae | area |
| `gangnam` | Gangnam | area |
| `seongsu` | Seongsu | area |
| `jongno` | Jongno | area |
| `gyeongbokgung` | Gyeongbokgung | landmark |
| `itaewon` | Itaewon | area |
| `dongdaemun` | Dongdaemun | area |
| `yeouido` | Yeouido | area |

#### 신규 파일: `src/features/explore/components/LocationSheet.jsx`

- 프리셋 위치 목록 bottom sheet
- 현재 선택 위치 강조 (coral active + CheckIcon)
- 클릭 즉시 `onSelect(location)` + `onClose()`
- `LanguageModal` / `FilterSheet` 패턴 재사용

#### 변경 파일: `src/pages/HomePage.jsx`

- `selectedLocation` 상태 추가 — 기본값 `DEFAULT_LOCATION` (Seoul City Hall)
- `sheet` 상태에 `'location'` 케이스 추가
- "You're in" div → `<button>` 으로 변경, 클릭 시 `setSheet('location')`
- 하드코딩 `Myeongdong` → `selectedLocation.label`
- `nearby` 계산 파이프라인 변경:
  ```js
  // 변경 전
  const nearby = applyFilters(places, filters);
  // 변경 후
  const nearby = sortPlacesByDistance(applyFilters(places, filters), selectedLocation);
  ```
- `LocationSheet` Modal 추가 (`variant="sheet"`)
- `NearbySheet`에 `selectedLocation` prop 전달

#### 변경 파일: `src/features/explore/components/NearbySheet.jsx`

- `selectedLocation` prop 수신
- 제목 `"Eat near here"` → `"Eat near {selectedLocation?.label ?? 'here'}"`
- 각 카드 subtitle에 거리 표시: `subtitle · 0.3 km` 또는 `subtitle · 250 m`

---

## 이번 작업에서 하지 않은 것 (의도적 제외)

- 랜드마크 DB 테이블 생성
- GPS 실시간 위치
- 외부 지도 API 연동
- 반경 필터로 결과 자르기
- 검색창 실제 검색 기능
- 코스 카드 생성 로직
- DB 작업 / Edge Function 수정 / Supabase deploy

---

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| Food Type 필터 | 배열 기반 복수 선택, 최대 3개, toast 안내 |
| 기준 위치 | 프리셋 10개, 기본값 Seoul City Hall |
| 음식점 목록 정렬 | 선택 위치 기준 거리순 |
| 거리 표시 | NearbySheet 각 카드에 `· N km` 또는 `· N m` |
| GPS / 외부 지도 | 미구현 |
| 검색창 | UI만, 미구현 |

---

## 다음 세션 참고

- 현재 100개 음식점이 모두 명동 일대에 집중되어 있음 (TourAPI 수집 지역)
- Gangnam, Hongdae 등 선택 시 거리가 수십 km로 나올 수 있음 — 나중에 데이터 확장 필요
- 반경 필터 추가 시 `sortPlacesByDistance` 결과에서 `distanceKm <= N` 조건으로 자르면 됨
- 코스 추천 기능 구현 시 `selectedLocation`을 기준 좌표로 활용 예정
