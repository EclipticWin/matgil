# 17. TourAPI 영문 데이터 보강, GPS 현재 위치 추천, Map UX 개선

## 작업 일자

2026-06-18 ~ 2026-06-19

---

## 이전 작업 기준

- 이전 문서: `docs/16-anchor-place-matching-and-loading-state.md`
- `docs/16`에서 Kakao 검색 결과 중 음식점/카페를 DB에 anchor 매칭해 첫 번째 추천 코스에 포함하고, 로딩/빈 상태 분기를 개선했다.
- 이번 세션에서는 영문 데이터 보강 Edge Function 신규 구현, GPS 현재 위치 기반 추천, Map 드래그 위치로 추천 변경, Bottom Sheet 드래그 영역 확대, UI 레이아웃 조정, 언어 선택 MVP 축소를 진행했다.

---

## 이번 작업 목표

1. 한국관광공사 영문 TourAPI(`EngService2`)를 이용해 기존 `mg_places`에 영문 텍스트 보강
2. GPS 현재 위치 기반 추천 기능 추가
3. GPS UX 개선 — 에러 상태 센터 모달, 아이콘 개선, active 스타일
4. Bottom Sheet 드래그 가능 영역 확대
5. Map 드래그 후 "Find routes here" 버튼으로 해당 지점 기준 추천
6. 상단 UI 레이아웃 조정 — 3-column grid, 언어 버튼 아이콘 전용
7. 언어 선택 MVP 축소 — 중국어/일본어 제거

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `supabase/functions/mg-tour-en-enrich/index.ts` | 신규 |
| `ai-docs/13-tourapi-en-enrich-plan.md` | 신규 |
| `src/shared/components/Icon.jsx` | 수정 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/features/explore/components/KakaoMap.jsx` | 수정 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/explore/data/exploreOptions.js` | 수정 |

---

## 핵심 구현 내용

### 1. TourAPI 영문 데이터 보강 Edge Function

계획 문서: `ai-docs/13-tourapi-en-enrich-plan.md`

새 Edge Function `mg-tour-en-enrich`를 구현했다. 기존 `mg-tour-seed`(국문 데이터 수집)는 수정하지 않는다.

**처리 흐름:**

```txt
POST /mg-tour-en-enrich
→ ADMIN_SEED_TOKEN 검증 (x-admin-seed-token 헤더)
→ EngService2 areaBasedList2 호출 (contentTypeId=82, lDongRegnCd=11)
→ 각 item의 detailIntro2 호출
→ mg_places 좌표 기반 매칭 (150m 이내 가장 가까운 1개)
→ 매칭 성공 시 mg_place_texts(locale='en') upsert
→ mg_place_sources(TOUR_API_EN) upsert
→ mg_api_fetch_logs 기록
→ 결과 반환 (matchedCount / skippedCount / failedCount)
```

**좌표 매칭 방식:**

```txt
item.mapy → latitude
item.mapx → longitude

1단계: 바운딩 박스 pre-filter (±0.00135° ≈ 150m)
2단계: Haversine 거리 계산
3단계: 150m 이하 후보 중 가장 가까운 place 선택
매칭 실패 → 새 mg_places insert 금지, skipped 처리
```

**저장 대상:**

| 테이블 | 저장 조건 | unique 키 |
|---|---|---|
| `mg_place_texts` | 매칭 성공, locale='en' | `place_id + locale` |
| `mg_place_sources` | 매칭 성공, source='TOUR_API_EN' | `source + source_language + external_id + external_content_type_id` |

**보안:**

```txt
TOUR_ENG_API_SERVICE_KEY → Deno.env.get("TOUR_ENG_API_SERVICE_KEY") 로만 사용
API 키 console.log 금지
API 키 응답 JSON 포함 금지
VITE_ 환경변수로 프론트에 노출 금지
```

---

### 2. 영문 데이터 수집 결과

`EngService2 + contentTypeId=82 + lDongRegnCd=11` 기준 총 91개 서울 음식점 레코드가 존재한다.

pages 1~10 (numOfRows=10씩) 순차 실행 후 page 11에서 requestedCount=0 확인.

| 항목 | 수량 |
|---|---|
| EngService2 총 레코드 | 91개 |
| 매칭 성공 후 upserted sources (TOUR_API_EN) | 76개 |
| upserted en texts (mg_place_texts locale='en') | 71개 |

texts가 sources보다 적은 이유: 여러 영문 API 항목이 같은 `mg_places` row에 매칭된 경우 `place_id + locale='en'` unique 키 기준으로 하나만 남기 때문이다 (upsert 동작).

---

### 3. GPS 현재 위치 기반 추천 기능

계획 문서: `ai-docs/14-current-location-recommendation-plan.md`

**GPS 버튼 배치:**

Bottom Sheet의 snap/drag 상태와 높이(`height`) 계산이 `NearbySheet` 내부에 있으므로 GPS floating button도 `NearbySheet.jsx` 안에 배치했다. `bottom: height + 12` 인라인 스타일로 시트 상단에서 12px 위에 위치하며, 드래그 중에는 transition 없이 즉시 이동한다.

**gpsStatus 상태:**

```txt
idle        기본 상태 (아이콘: 회색 crosshair)
loading     현재 위치 요청 중 (스피너 표시, 버튼 disabled)
active      현재 위치 획득 성공 (아이콘: 파란색 crosshair)
denied      위치 권한 거부 → 에러 모달
error       위치 획득 실패 → 에러 모달
unsupported 브라우저 미지원 → 에러 모달
```

**selectedLocation 설정:**

```js
{
  key: 'current_location',
  label: 'Current location',
  lat,
  lng,
  source: 'gps',
  address: null
}
```

기존 `selectedLocation` 기반 추천 흐름을 그대로 재사용한다. GPS 성공 시 `setShowFindHere(false)`도 함께 호출해 Find routes here 버튼을 숨긴다.

**gpsStatus 리셋 조건:**

| 트리거 | 동작 |
|---|---|
| 검색 결과 선택 | `setGpsStatus('idle')` |
| 프리셋 hot place 선택 | `setGpsStatus('idle')` |
| Map 드래그 | `setGpsStatus('idle')` |
| Food Type 필터 변경 | gpsStatus 유지 (현재 위치 기준 재계산) |

**geolocation 옵션:**

```js
{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
```

---

### 4. GPS UX 개선

초기 구현의 black callout tooltip을 제거하고 아래 3가지를 수정했다.

**에러 표시 — 센터 모달로 변경:**

denied / error / unsupported 상태에서 기존 툴팁 대신 배경 dimming + 센터 카드 모달을 표시한다.

```txt
absolute inset-0 z-40 bg-black/40 (배경)
absolute inset-x-6 top-1/2 z-40 -translate-y-1/2 rounded-2xl bg-white p-6 (카드)
```

X 버튼 또는 배경 클릭 시 `onGpsStatusChange('idle')` 호출로 닫힌다. 자동 닫힘 타이머 없음.

**LocateIcon — crosshair SVG로 교체:**

기존 임시 아이콘을 `Icon.jsx`에 `LocateIcon`으로 추가했다.

```jsx
<circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.75" />
<circle cx="12" cy="12" r="1.75" fill="currentColor" />
<path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" ... />
```

**active 스타일 변경:**

active 상태에서 버튼 배경을 파란색으로 채우는 방식 → 항상 흰색 배경 + 아이콘 색상으로만 구분.

```txt
active  → text-blue-500 (아이콘만 파란색)
loading → text-ink/20
그 외   → text-ink-soft
```

---

### 5. Bottom Sheet 드래그 가능 영역 확대

기존에는 상단 drag pill strip (~16px)만 드래그 트리거였다.

**개선 내용:**

기본 목록 뷰의 헤더 div ("Eat near ..." 제목 영역, ~58px)에도 동일한 pointer event 핸들러를 추가했다. 드래그 가능 총 높이가 약 74px로 확대됐다.

```jsx
<div
  className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-0.5"
  onPointerDown={onDown}
  onPointerMove={onMove}
  onPointerUp={onUp}
  onPointerCancel={onUp}
>
  <h2 className="select-none ...">Eat near {selectedLocation?.label ?? 'here'}</h2>
</div>
```

`select-none`을 h2에 추가해 드래그 중 텍스트 선택을 방지했다.

---

### 6. Find routes here 기능

Map을 드래그해 이동한 뒤 해당 지점을 기준 위치로 설정하는 기능이다.

**구현 흐름:**

```txt
KakaoMap dragend 이벤트
→ onMapMoved() 호출 (좌표 전달 없음)
→ HomePage: setShowFindHere(true), setGpsStatus('idle')
→ 상단 컨트롤 중앙에 "Find routes here" 버튼 표시

버튼 클릭
→ mapApiRef.current.getCenter() 호출 (클릭 시점 지도 중심 읽기)
→ setSelectedLocation({ key: 'map_center', label: 'Selected area', source: 'map', ... })
→ setShowFindHere(false)
```

**mapApiRef 패턴:**

`KakaoMap`에 `mapApiRef` prop을 추가했다. 지도 초기화 후 `mapApiRef.current = { getCenter: () => { lat, lng } }`를 할당한다. `HomePage`에서 이 ref를 통해 클릭 시점의 최신 지도 중심 좌표를 읽는다.

**stale coords 버그 수정:**

초기 구현에서는 `dragend` 이벤트 발생 시 좌표를 `mapPendingCenter { lat, lng }` state에 저장했다. 모바일에서 관성 스크롤로 `dragend` 이후에도 지도가 계속 이동하기 때문에 저장된 좌표가 실제 버튼 클릭 시점 중심과 달랐다.

수정 방향:
- `mapPendingCenter { lat, lng }` state 제거
- `showFindHere` boolean state로 교체
- `dragend`에서는 boolean만 `true`로 설정
- 실제 좌표는 "Find routes here" 버튼 클릭 시점에 `mapApiRef.current.getCenter()`로 읽기

이 방식으로 관성 이동이 완전히 멈춘 뒤 사용자가 버튼을 클릭하는 시점의 정확한 좌표를 사용할 수 있다.

**dragend vs setBounds:**

`kakao.maps.event.addListener(map, 'dragend', ...)` 는 사용자 드래그에만 반응한다. Effect 3의 `mapRef.current.setBounds(bounds, 60)` (코스 변경 시 자동 이동)는 `dragend`를 발생시키지 않는다. 따라서 코스 선택만으로 Find routes here 버튼이 의도치 않게 표시되는 문제는 없다.

---

### 7. 상단 컨트롤 UI 레이아웃 조정

**2행 레이아웃 변경 — 3-column grid:**

기존 `flex` 레이아웃에서 `grid grid-cols-3`으로 변경. 좌(flame) / 중(Find routes here) / 우(globe) 3열 고정.

```jsx
<div className="mt-3 grid grid-cols-3 items-center">
  {/* Left */}  <button>FlameIcon</button>
  {/* Center */} <div className="flex justify-center">{showFindHere && <button>...</button>}</div>
  {/* Right */}  <div className="flex justify-end"><button>GlobeIcon</button></div>
</div>
```

Find routes here 버튼 텍스트 줄바꿈 방지: `whitespace-nowrap` 추가.

**언어 버튼 — 아이콘 전용:**

기존에 "EN"/"한" 텍스트와 ChevronRightIcon을 표시하던 언어 버튼을 `GlobeIcon`만 있는 `h-10 w-10 rounded-full` 원형 버튼으로 변경.

---

### 8. 언어 선택 MVP 축소

`exploreOptions.js`의 `LANGUAGES` 배열에서 `ZH` (中文), `JA` (日本語)를 제거했다.

```js
// 이전
export const LANGUAGES = [
  { code: 'EN', ... },
  { code: 'KO', ... },
  { code: 'ZH', ... },
  { code: 'JA', ... },
];

// 이후
export const LANGUAGES = [
  { code: 'EN', short: 'EN', name: 'English' },
  { code: 'KO', short: '한', name: '한국어' },
];
```

MVP 범위에서 EN/KO만 지원하며 ZH/JA는 추후 콘텐츠 준비 후 추가한다.

---

## 동작 확인

- GPS 버튼 클릭 → 현재 위치로 지도 이동 + 추천 코스 재계산
- GPS active 상태에서 검색/프리셋 선택 → gpsStatus idle 리셋
- GPS 권한 거부 → 센터 모달 표시 → X 버튼 또는 배경 클릭으로 닫힘
- Bottom Sheet 헤더 영역 드래그 → 시트 스냅 동작 정상
- Map 드래그 → Find routes here 버튼 표시 → 클릭 시 해당 지점 기준 추천
- 코스 변경(Effect 3 setBounds) → Find routes here 버튼 미표시
- 언어 모달 → EN / 한국어 2개만 표시
- `npm run build` 에러 없음

---

## 이번 작업에서 하지 않은 것

- Supabase DB 마이그레이션
- 기존 Edge Function 수정 (`mg-tour-seed` 등)
- Supabase deploy
- Git commit / push
- API key / env / GitHub Secrets 수정
- TTS / Voice help 수정
- 추천 알고리즘 수정
- Food Type 필터 UI/로직 수정
- Courses 탭 수정
- watchPosition 실시간 위치 추적
- 영문 데이터를 새 `mg_places`로 insert
- 영문 API 이미지 별도 저장
- 프론트 다국어 전환 연결

---

## 현재 한계

- GPS는 1회 위치 획득 (`getCurrentPosition`)만 지원. 이동 중 자동 갱신 없음
- Find routes here는 지도 드래그 후 명시적 버튼 클릭 필요. 드래그 종료 즉시 자동 재추천 없음
- 영문 TourAPI 커버리지: 91개 레코드 → 76개 source, 71개 en text upsert. DB에 좌표가 없거나 150m 밖인 레코드는 매칭 미적용
- 언어 전환(EN/KO)이 실제 UI 텍스트를 바꾸는 기능은 아직 미구현

---

## 다음 작업 후보

- 영문 TourAPI 외 추가 영문 데이터 소스 연결
- 언어 전환 기능 — EN 선택 시 UI 텍스트를 영문으로, KO 선택 시 한국어로 표시
- Find routes here 트리거 개선 — 드래그 종료 후 일정 시간 내 자동 적용 옵션
- GPS active 상태에서 재시도 버튼 제공
- 코스 상세 / 식당 상세 뷰에서도 GPS 연동 확인
