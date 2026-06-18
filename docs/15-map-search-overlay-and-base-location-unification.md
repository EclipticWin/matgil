# 15. Map 검색 오버레이, 기준 위치 통합, 서울 검색 제한

## 작업 일자

2026-06-18

---

## 이전 작업 기준

- 이전 문서: `docs/14-voice-help-implementation-and-tts-improvements.md`
- Map 화면의 `selectedLocation`은 프리셋 hot place 목록(LocationSheet)에서만 선택할 수 있었다. 사용자가 직접 장소를 검색해 기준 위치를 바꾸는 방법이 없었다.

---

## 이번 작업 목표

1. 사용자가 서울 안의 장소를 직접 검색해 기준 위치를 바꿀 수 있도록 Map 검색 UX 구현
2. 검색한 장소를 기준으로 nearby 목록·추천 코스를 자동 재계산
3. 검색 결과를 서울로 제한 (Matgil은 서울 맛길 서비스)
4. 기준 위치 마커를 지도에 표시
5. 지도 UI 전반 소폭 정리 (그림자, 아이콘, 폴리라인 색상)

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/map/loadKakaoMapSdk.js` | 수정 (`&libraries=services` 추가) |
| `src/features/explore/services/kakaoPlaceSearchService.js` | 신규 |
| `src/features/explore/components/SearchOverlay.jsx` | 신규 |
| `src/features/explore/components/LocationSheet.jsx` | 수정 (검색 제거, 프리셋 전용) |
| `src/features/explore/components/KakaoMap.jsx` | 수정 (기준 위치 마커, polyline 색상 통일) |
| `src/pages/HomePage.jsx` | 수정 (SearchOverlay 연결, 버튼 구조 변경) |
| `src/index.css` | 수정 (검색 오버레이 fade 애니메이션 추가) |
| `src/features/phrases/components/PhraseCategoryTabs.jsx` | 수정 (버튼 그림자 제거) |
| `ai-docs/12-map-location-search-plan.md` | 신규 (구현 계획 문서) |

---

## 핵심 구현 내용

### 1. 검색 UX 역할 분리

초기에는 LocationSheet 안에 검색 input을 넣었다. 그러나 LocationSheet가 프리셋 선택과 직접 검색을 동시에 담당하면 역할이 섞이는 문제가 있었다.

**최종 구조:**

| UI 요소 | 역할 |
|---|---|
| 상단 검색창 | Kakao Places 직접 검색 → 검색 오버레이 열기 |
| 불 아이콘 버튼 | 프리셋 hot place 선택 (LocationSheet) |
| LocationSheet | 프리셋 목록만 표시, 검색 input 없음, 제목 "Choose a hot place" |

`SearchSheet` bottom sheet 방식은 제거됐고, `SearchOverlay` 방식으로 교체됐다.

---

### 2. SearchOverlay — 전체 화면 검색 모드

상단 검색창 탭 시 `SearchOverlay`가 `absolute inset-0 z-40`으로 펼쳐진다.

**UX 포인트:**

- 기본 검색창과 SearchOverlay 내 input의 위치·크기·패딩을 맞춤 (`px-4 pt-3.5`, `h-[3.25rem] rounded-2xl bg-ink/[0.07] px-3.5`)
- 열림/닫힘 애니메이션: 순수 opacity fade (translateY 없음). 위치 이동이 없어야 기존 검색창 위에서 자연스럽게 펼쳐지는 느낌이 난다.
- 왼쪽 SearchIcon 유지 (BackIcon 사용 시 "다른 화면에 온 것" 같은 느낌을 주므로 제거)
- X 버튼: 검색어 있으면 지우기, 없으면 검색 모드 닫기
- 필터 버튼: 검색 모드에서도 그대로 표시 및 동작
- 검색어 없을 때 안내 문구 표시
- 검색어 입력 시 Kakao Places 결과 300ms 디바운스

**z-index 적용:**

SearchOverlay(z-40)를 JSX에서 Modal 앞에 배치해 Modal이 그 위에 렌더링되도록 했다. 필터 버튼 탭 → FilterSheet가 SearchOverlay 위에 열린다.

---

### 3. Kakao Places 검색 서비스

`kakaoPlaceSearchService.js` — Kakao Maps JS SDK의 `services.Places.keywordSearch`를 Promise로 래핑.

SDK 로드 시 `&libraries=services` 추가가 필요하다. `loadKakaoMapSdk.js`에 반영했다.

**서울 필터링:**

```js
const seoulOnly = data.filter((r) => {
  const addr = r.address_name ?? '';
  const roadAddr = r.road_address_name ?? '';
  return addr.startsWith('서울') || roadAddr.startsWith('서울');
});
```

`address_name`, `road_address_name` 중 하나라도 `서울`로 시작하면 포함. 서울 밖 검색어는 `No results`로 표시.

**검색 결과의 성격:**

Kakao Places는 음식점뿐 아니라 역·건물·관광지 등 다양한 장소를 반환한다. 이 검색 결과 자체를 음식점 데이터로 사용하지 않는다. 선택한 장소의 좌표만 `selectedLocation`에 반영하고, 우리 Supabase DB 음식점 중 그 좌표 기준 nearby를 재계산한다.

---

### 4. selectedLocation 흐름

검색 결과 선택 시 `selectedLocation`이 아래 형태로 업데이트된다.

```js
{
  key: null,
  label: place_name,
  lat: Number(y),
  lng: Number(x),
  source: 'search',
  address: address_name,
}
```

`selectedLocation` 변경 이후 자동 흐름 (`useMemo` 의존):

1. 지도 중심 이동
2. 기준 위치 마커 업데이트
3. `nearby` 재계산 (거리 기준 정렬)
4. `recommendedCourses` 재계산
5. `activeCourseId` 리셋 → 새 첫 번째 코스 선택

검색 결과는 DB에 저장하지 않는다. 음식점을 코스에 강제 포함하지 않는다.

---

### 5. 기준 위치 마커

기존에는 기준 위치가 지도에 표시되지 않았다. 코스 stop 마커(coral 번호 원형)와 구분되도록 별도 마커를 추가했다.

**구현:**

- `KakaoMap.jsx`에 `locationMarkerRef` 추가 (코스 stop용 `overlaysRef`와 분리)
- Effect 2(`selectedLocation` 변경 감지)에서 기존 마커 제거 후 새 마커 생성
- `yAnchor: 1.0` — 원형 + 삼각 꼬리로 구성된 HTML 요소의 bottom이 좌표에 정확히 닿도록
- cleanup 시 `locationMarkerRef`도 함께 제거

**스타일:**

파란색(`#3B82F6`) 원형 + 아래 삼각 꼬리. 흰 테두리나 내부 점 없이 단순하게 유지.

---

### 6. Polyline 색상 통일

기존에는 `course.accent`를 polyline 색상으로 사용했다. 코스마다 색상이 달라 지도가 산만해 보였다.

`KakaoMap.jsx`에 `CORAL = '#F8481F'` 상수를 추가하고, 모든 polyline에 고정 적용했다.

---

### 7. UI 조정

| 항목 | 변경 내용 |
|---|---|
| 기준 위치 버튼 | "You're in …" 텍스트 제거 → 불 아이콘 버튼으로 교체 |
| 검색창 그림자 | `shadow-card` → `shadow-soft` (약화) |
| 검색 모드 input | 그림자 없음 |
| 필터 버튼 그림자 | `shadow-coral` (`0 6px 16px rgba(248,72,31,0.4)`) → `shadow-[0_2px_6px_rgba(248,72,31,0.22)]` (대폭 약화) |
| PhraseCategoryTabs 버튼 | active/inactive 모두 그림자 제거 |

---

## 동작 확인

- 검색창 탭 → SearchOverlay 열림, input 자동 포커스
- 검색어 입력 → Kakao Places 결과 표시 (서울만)
- 결과 선택 → 검색 모드 닫힘, 지도 중심 이동, nearby 재계산, 코스 업데이트
- X 버튼: 검색어 있으면 지우기, 없으면 닫기
- 불 아이콘 버튼 탭 → LocationSheet 열림, 프리셋 선택 가능
- 기준 위치 마커 지도에 표시 (파란 pin)
- 코스 polyline 모두 coral 색상
- 필터 버튼 SearchOverlay 내에서도 정상 동작 (FilterSheet가 오버레이 위에 열림)
- `npm run build` 통과

---

## 이번 작업에서 하지 않은 것

- Supabase DB 수정
- Supabase Edge Function 수정
- Supabase deploy
- 검색 결과 DB 저장
- GPS 현재 위치 구현
- 서울 경계 polygon 구현
- 검색한 음식점을 코스에 강제 포함
- LLM / OpenAI / Solar 관련 작업
- TTS / Voice help 수정
- Food Type 필터 로직 변경
- Courses 탭 변경

---

## 다음 작업 후보

### 검색한 음식점 anchor 포함

현재는 검색한 장소의 좌표를 기준으로 코스를 재계산한다.

관광지·역·건물을 검색한 경우에는 이 방식이 자연스럽다. 그런데 사용자가 음식점 이름을 직접 검색했다면, 그 음식점이 우리 DB에 존재하는 경우 추천 코스에 포함되는 것이 더 자연스러운 흐름이다.

**향후 방향:**

1. Kakao 검색 결과의 카테고리 그룹(`category_group_code: 'FD6'`)으로 음식점 여부 판단
2. 음식점이면 Supabase places에서 이름·좌표가 가까운 항목 매칭 시도
3. 매칭 성공 시 `anchorPlace`로 지정 → 코스 생성 시 해당 식당을 반드시 포함
4. 매칭 실패 시 기존 방식(검색 위치 기준 nearby)으로 fallback

DB 매칭은 이름 유사도(문자열)와 좌표 근접성(Haversine)을 함께 고려해야 한다. 이름이 완전히 다를 수 있어서 좌표 기준 반경 검색을 primary로, 이름 유사도를 secondary로 쓰는 것이 현실적이다.

이 작업은 `courseBuilder.js` 수정 + 검색 결과 처리 로직 추가가 필요하다. 이번 작업 범위에 포함하지 않는다.

### GPS 현재 위치 기능

`navigator.geolocation.getCurrentPosition`으로 현재 위치를 가져와 `selectedLocation`에 적용. 권한 거부·미지원 브라우저 fallback 필요.

### 지도 드래그 후 "이 지역 재검색" 버튼

지도를 드래그한 뒤 현재 지도 중심 좌표를 `selectedLocation`으로 설정하는 버튼. Kakao Map의 `center_changed` 이벤트 또는 `dragend` 이벤트 활용.
