# 10. Kakao Map 연동 및 추천 코스 지도 시각화

## 작업 일자

2026-06-18

---

## 이전 작업 요약 (09)

- `PlaceDetailSheet.jsx` 신규 — 코스 상세 내 stop 식당 상세 화면
- `NearbySheet.jsx` 수정 — 3단계 상태 머신 (기본 목록 ↔ 코스 상세 ↔ 식당 상세)
- `TodayCourseDetail.jsx` 수정 — stop 행을 `<button>`으로 교체, `onSelectPlace` prop 추가

---

## 이번 세션 작업 목표

Map 탭의 placeholder 지도 영역을 실제 Kakao Map으로 교체하고, TODAY'S PICK 추천 코스 1개를 지도 위에 번호 마커와 직선 polyline으로 시각화한다.
또한 Food Type 필터 적용 시 추천 코스가 선택 위치와 동떨어진 지역으로 튀는 현상을 `courseBuilder`의 후보 tier 선택 로직으로 보정한다.

---

## 이전 상태

- Map 탭에 `Map view` 텍스트 placeholder만 표시
- TODAY'S PICK 코스는 카드·상세 시트로만 확인 가능, 지도 위 마커/동선 없음
- Food Type 필터 적용 시 추천 코스가 selectedLocation과 먼 지역(압구정/강남 등)으로 튀는 현상 존재

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/map/loadKakaoMapSdk.js` | 신규 |
| `src/features/explore/components/KakaoMap.jsx` | 신규 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/data/courseBuilder.js` | 수정 |

---

## 핵심 구현 내용

### 1. `loadKakaoMapSdk.js` — 신규

Kakao Maps JavaScript SDK를 동적으로 로드하는 유틸.

**키 관리:**

```
환경변수: VITE_KAKAO_MAP_JS_KEY
읽기 위치: import.meta.env.VITE_KAKAO_MAP_JS_KEY
키 종류: Kakao Developers JavaScript 키 (REST API 키 아님)
보안: Kakao Developers 플랫폼 탭에 허용 도메인 등록으로 보호
커밋: .env는 .gitignore 대상 — 커밋하지 않음
```

**로딩 전략:**

```js
// autoload=false로 SDK script 로드
//dapi.kakao.com/v2/maps/sdk.js?appkey=KEY&autoload=false

// script.onload 후 kakao.maps.load(resolve) 콜백으로 resolve
// → 콜백 이후에만 kakao.maps.* API 사용 가능
```

**주요 동작:**

| 상황 | 처리 |
|---|---|
| `VITE_KAKAO_MAP_JS_KEY` 없음 | `'no-key'` 에러로 reject |
| `window.kakao?.maps` 이미 존재 | 즉시 resolve (재사용) |
| 로딩 중 | 모듈 변수 `sdkPromise` 캐시 — script 중복 삽입 방지 |
| script 로딩 실패 | `sdkPromise` 초기화 후 reject (재시도 허용) |

---

### 2. `KakaoMap.jsx` — 신규

Map 탭 배경 전체를 차지하는 지도 컴포넌트.

**props:** `selectedLocation`, `course`

**내부 상태:**

```js
status: 'idle' | 'loading' | 'ready' | 'no-key' | 'error'
```

**useEffect 구조:**

| Effect | deps | 역할 |
|---|---|---|
| 초기화 | `[]` | SDK 로드 → 지도 생성 → status `'ready'` |
| 중심 갱신 | `[selectedLocation, status]` | `map.setCenter()` |
| 마커/선 갱신 | `[course, status]` | 기존 overlay/polyline cleanup → 신규 생성 |

**번호 마커:**

```js
// Kakao CustomOverlay에 인라인 스타일 HTML 삽입
// xAnchor: 0.5, yAnchor: 0.5 → 원의 중심이 좌표에 위치
// pointer-events: none → 지도 pan/zoom 제스처 차단 방지
new kakao.maps.CustomOverlay({ position, content: '<div>1</div>', xAnchor: 0.5, yAnchor: 0.5 })
```

**Polyline:**

```js
// stop 좌표를 순서대로 직선으로 연결
// 실제 도보 경로가 아니라 추천 stop 순서 시각화용 직선
new kakao.maps.Polyline({ path, strokeWeight: 3, strokeColor: course.accent, strokeOpacity: 0.65, strokeStyle: 'solid' })
```

**Bounds fit:**

| stops 수 | 처리 |
|---|---|
| 0개 | selectedLocation 중심 유지 |
| 1개 | 해당 stop 중심으로 이동 |
| 2개 이상 | `LatLngBounds`로 전체 범위 fit (60px padding) |

**Fallback UI:**

```
status === 'no-key' | 'error'
  → 기존 "Map view" placeholder와 동일한 UI 표시
  → 지도 container는 visibility: hidden (DOM 유지)
```

**React StrictMode 대응:**

- `alive` 플래그로 cleanup 후 async 콜백 진입 차단
- cleanup 시 container `innerHTML = ''` 초기화 → 재마운트 시 지도 중복 생성 방지

---

### 3. `HomePage.jsx` — 수정

- placeholder div 제거, `<KakaoMap>` 삽입

```jsx
// 이전
<div className="absolute inset-0 flex items-center justify-center">
  <PinIcon ... /> <span>Map view</span>
</div>

// 이후
<KakaoMap selectedLocation={selectedLocation} course={todayCourse} />
```

- `selectedLocation`, `todayCourse` 생성 흐름 유지
- `NearbySheet` props 및 기존 Bottom Sheet 동작 유지

---

### 4. `courseBuilder.js` — 수정 (추천 코스 위치 이탈 보정)

**문제 원인:**

기존 점수 구조에서 selectedLocation 근접성이 차지하는 비중이 낮았다.

| 점수 항목 | 최대 | selectedLocation 반영 |
|---|---|---|
| clusterScore (stop 간 거리) | 35 | ❌ |
| diversityScore | 20 | ❌ |
| cafeBonus | 15 | ❌ |
| dataQualityScore | 20 | ❌ |
| startAccessScore | **10** | ✅ |

데이터 품질이 좋고 촘촘히 클러스터된 먼 지역 3곳이 총점에서 근처 장소를 이길 수 있었다. 반경 제한이 없었기 때문이다.

**수정 내용 — 반경 tier 후보 선택:**

```js
const LOCAL_RADIUS_KM = 2.0;
const EXTENDED_RADIUS_KM = 4.0;

tier1 = validPlaces where distFromSelected <= 2.0
tier2 = validPlaces where distFromSelected <= 4.0

if (tier1.length >= 3)      → candidates = tier1   // 2km 이내 3개 이상: tier1만 사용
else if (tier2.length >= 1) → candidates = tier2   // tier1 부족: 4km 이내로 확장
else                        → candidates = validPlaces.slice(0, 20)  // 4km 내 없을 때만 전체 fallback
```

**tier별 stop 수:**

| tier | candidates 수 | stop 수 |
|---|---|---|
| tier1 | 3개 이상 | 3 stop |
| tier2 | 3개 이상 | 3 stop |
| tier2 | 1~2개 | 1~2 stop 허용 |
| fallback | 전체 | 최대 3 stop |

`stopCount = Math.min(DEFAULT_STOP_COUNT, candidates.length)` 기존 로직이 자동 처리.

기존 점수 계산, tie-break, idealPool/preferredPool 로직 변경 없음.

---

## 동작 확인

- 기본 지도 표시 정상
- 검색창 / 필터 버튼 / You're in / 언어 버튼이 지도 위에 정상 표시 (z-index 유지)
- Bottom Sheet가 지도 위에 정상 표시
- 위치 변경 시 Bottom Sheet 제목 변경, 지도 중심·마커·선 갱신
- 위치 변경 시 TODAY'S PICK 제목/코스 변경
- Food Type 필터 변경 시 nearby 개수 변경, TODAY'S PICK 변경
- Food Type 필터 변경 시 이전 마커/선이 남지 않고 교체
- TODAY'S PICK 클릭 → 코스 상세 정상 진입
- 코스 상세 stop 클릭 → 식당 상세 정상 진입
- 식당 상세 뒤로가기 → 코스 상세 복귀 정상
- 코스 상세 뒤로가기 → 기본 목록 복귀 정상
- 지도 드래그/줌 정상 (마커가 터치 이벤트 차단하지 않음)
- 새로고침 후 지도 정상 표시
- `npm run build` 통과

---

## 콘솔 경고 기록

- React DevTools 안내 메시지: 개발 환경 안내, 동작 무관
- React Router Future Flag Warning: 라이브러리 마이그레이션 경고, 동작 무관
- Kakao Map 관련 빨간 에러 없음

---

## 아직 하지 않은 것

- 여러 추천 코스 생성 (현재 1개 고정)
- activeCourse 상태 — 선택된 코스만 지도에 표시
- 실제 도보 경로 계산
- Kakao Directions API 연결
- GPS 현재 위치 기능
- 장소 검색 기능
- 마커 클릭 시 식당 상세 열기
- GitHub Pages 배포 workflow에 `VITE_KAKAO_MAP_JS_KEY` env 주입
- Kakao Map 운영용 앱 전환 (현재 기존 앱에 Web 도메인 추가 방식으로 임시 운영)

---

## 다음 작업 후보

- 추천 코스 2~3개 확장
- activeCourse 상태 도입 — 선택된 코스만 지도에 표시
- GitHub Pages 배포 workflow 구성 + `VITE_KAKAO_MAP_JS_KEY` Secret 주입
- 실제 도보 경로 계산 검토 (Kakao Directions API)
- 지역별 음식점 데이터 확장 (현재 명동 일대 집중)
