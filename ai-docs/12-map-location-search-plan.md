# 12. Map 위치 검색 / 기준 위치 통합 / 지도 이동 후 재추천 기능 계획

## 문서 목적

Map 화면의 추천 기준 위치를 검색·프리셋·지도·GPS 중 어느 출처에서도 통합 업데이트할 수 있도록 설계 방향을 정리한다.
이 문서는 구현 전 계획 문서이며, 코드 수정은 포함하지 않는다.

---

## 1. 현재 문제

현재 Map 화면의 추천 기준 위치는 `selectedLocation` 프리셋에 의존하고 있다.

현재 흐름:

```txt
selectedLocation
→ places 필터링
→ selectedLocation 기준 거리순 정렬
→ nearby 생성
→ todayCourse 생성
→ NearbySheet / TODAY'S PICK / 지도 표시
```

문제점:

- 지도 중심 좌표와 추천 기준 좌표가 분리되어 있음
- 사용자가 지도를 상하좌우로 움직여도 TODAY'S PICK이 바뀌지 않음
- 위치 프리셋 선택은 가능하지만 직접 검색은 불가능함
- GPS 현재 위치 기능 없음
- 화면 상단의 `You're in ...` 텍스트는 공간을 차지하고 있고, 현재 위치 정보는 이미 Bottom Sheet의 `Eat near ...`에 표시되고 있어 중복임

---

## 2. 현재 확인된 사실

`src/api/placeApi.js` 기준으로 음식점 좌표는 이미 프론트 place 객체에 포함되어 있다.

```js
latitude: row.latitude ?? null,
longitude: row.longitude ?? null,
```

따라서 이번 작업에서 `place.latitude`, `place.longitude`를 새로 추가할 필요는 없다.
Supabase DB도 이번 작업에서 수정하지 않는다.

---

## 3. 핵심 설계 방향

검색, 프리셋, 지도 중심, GPS를 모두 최종적으로 하나의 기준 위치 상태로 통합한다.

기준 위치 객체 목표 형태:

```js
selectedLocation = {
  label: string,
  latitude: number,
  longitude: number,
  source: 'preset' | 'search' | 'map' | 'gps'
}
```

핵심 원칙:

```txt
selectedLocation이 바뀌면
→ nearby가 다시 계산되고
→ todayCourse가 다시 생성되고
→ NearbySheet 제목 / 거리 / 코스가 바뀐다
```

---

## 4. 이번 MVP 우선 구현 범위

이번 작업의 우선순위는 **검색 기반 위치 변경**이다.

### 우선 구현 항목

1. Map 화면의 `You're in ...` 텍스트 제거
2. 해당 버튼은 위치 아이콘만 남김
3. 버튼 클릭 시 LocationSheet 열림
4. LocationSheet 제목을 앱 톤에 맞게 변경 (예: `Choose a hot place`)
5. LocationSheet 안에 검색 input 추가
6. Kakao Places keyword search를 이용한 장소 검색
7. 검색 결과 목록 표시
8. 검색 결과 선택 시 `selectedLocation`을 검색 결과 좌표로 업데이트
9. `selectedLocation` 변경에 따라 nearby / todayCourse 자동 재계산 확인

---

## 5. 이번 MVP에서 구현하지 않을 것

- GPS 현재 위치 기능 (검색 기능 안정화 후 별도 작업)
- 검색 결과를 DB에 저장
- 검색 결과를 음식점 데이터로 저장
- 장소 검색용 새 Supabase 테이블 생성
- PostGIS 적용
- 실제 도보 경로 계산
- Kakao Map polyline 새로 설계
- 지도 이동 시마다 자동으로 추천 동선 변경
- 지도 이동 중 실시간 추천 재계산
- LLM 추천 이유 생성
- Courses 탭 mock 데이터 전환
- 기존 Food Type 필터 구조 변경

---

## 6. 지도 이동 후 재추천 방향 (다음 단계 후보)

지도 이동마다 자동으로 추천이 계속 바뀌는 방식은 피한다.

이유:
- 사용자가 지도를 잠깐 둘러보는 중에도 코스가 계속 바뀜
- 추천 결과가 흔들려 보이는 UX
- 체감 품질 저하

대신 다음 단계에서 아래 방향을 우선 검토한다:

```txt
사용자가 지도를 움직임
→ 현재 selectedLocation과 지도 중심 좌표가 달라짐
→ "Search this area" 버튼 표시
→ 사용자가 버튼 클릭
→ 지도 중심 좌표를 selectedLocation으로 반영
→ nearby / todayCourse 재계산
```

이번 MVP에서는 구현하지 않고 다음 단계 후보로 남긴다.

---

## 7. UI 변경 방향

### Map 상단 위치 버튼

현재:

```txt
You're in Myeongdong
```

변경 목표:

```txt
위치 아이콘만 표시
```

요구사항:
- 텍스트 제거
- 기존 버튼 위치와 크기는 최대한 유지
- 접근성을 위해 `aria-label` 유지 (예: `aria-label="Choose location"`)
- 이모지 사용 금지
- 기존 Icon 컴포넌트에 위치 아이콘이 있으면 재사용
- 없으면 기존 아이콘 패턴에 맞춰 추가 검토

### LocationSheet

현재 제목이 `Choose location`이라면 더 목적에 맞게 변경한다.

후보 문구:
- `Choose a hot place`
- `Choose starting point`
- `Choose area`

앱 목적상 가장 자연스러운 문구를 코드 확인 후 선택한다.

---

## 8. Kakao Places 검색 설계

Kakao Map SDK가 이미 로드되어 있으므로, Kakao Places keyword search 사용 가능 여부를 먼저 확인한다.

예상 흐름:

```txt
사용자 검색어 입력
→ Kakao Places keywordSearch 실행
→ 검색 결과 목록 표시
→ 사용자가 결과 선택
→ selectedLocation = 검색 결과 좌표
```

검색 결과에서 사용할 값:

```js
{
  label: result.place_name,
  latitude: Number(result.y),
  longitude: Number(result.x),
  source: 'search'
}
```

주의사항:
- Kakao REST API key를 프론트에 새로 노출하지 않는다
- 이미 사용 중인 Kakao Map JS SDK 범위에서 가능한지 먼저 확인한다
- 새로운 비밀키를 프론트에 추가하지 않는다
- 검색 결과는 기준 위치로만 사용하고 DB에는 저장하지 않는다

---

## 9. 예상 수정 파일 후보

실제 구현 전 현재 파일 구조를 읽고 확정한다.

예상 후보:

```txt
src/pages/HomePage.jsx
src/features/explore/components/LocationSheet.jsx
src/features/explore/data/locations.js
src/features/explore/services/kakaoPlaceSearchService.js  (신규 생성 가능)
src/shared/components/Icon.jsx
```

실제 존재하는 파일과 구조를 먼저 확인해야 한다.

---

## 10. 작업 제한

이번 작업에서 건드리지 않는 것:

- `src/api/placeApi.js` — 좌표가 이미 들어오므로 불필요하면 수정하지 않는다
- `src/features/phrases/services/ttsService.js` 수정 금지
- Voice help 관련 파일 수정 금지
- Supabase Edge Function 수정 금지
- Supabase DB 마이그레이션 금지
- Supabase deploy 금지
- Common phrases 데이터 수정 금지
- Food Type 필터 로직 수정 금지
- Courses 탭 mock 데이터 수정 금지
- Map / Course 기존 안정 기능을 깨지 말 것
- OpenAI / Solar / TourAPI 키 관련 수정 금지
- 외부 패키지 설치 금지

---

## 11. 구현 전 확인해야 할 것

구현 전에 반드시 아래를 먼저 확인한다.

1. Kakao Map JS SDK가 현재 어디서 로드되는지
2. `window.kakao.maps.services.Places` 사용 가능 여부
3. 현재 `selectedLocation` 상태가 어디에서 관리되는지
4. `LocationSheet`가 현재 어떤 props를 받는지
5. `nearby`와 `todayCourse`가 `selectedLocation` 변경에 따라 이미 재계산되는지
6. 검색 결과 선택 시 지도 중심도 같이 이동시켜야 하는지
7. 현재 위치 버튼에 사용할 아이콘이 이미 있는지
8. 모바일 UI에서 검색 input이 Bottom Sheet 안에 자연스럽게 들어가는지

---

## 12. 구현 계획에서 먼저 보고할 것

아직 구현하지 말고, 계획 단계에서 아래를 먼저 보고한다.

1. 현재 `selectedLocation` 흐름
2. 현재 Kakao Map SDK / services 사용 가능 여부
3. 현재 `LocationSheet` 구조
4. 위치 아이콘 버튼으로 변경할 파일
5. 검색 input을 넣을 위치
6. Kakao keyword search 연결 방식
7. 검색 결과 선택 시 `selectedLocation` 업데이트 방식
8. `nearby` / `todayCourse` 재계산 영향
9. 지도 중심 이동까지 포함할지 여부
10. 수정 / 생성 파일 후보
11. 구현 단계
12. 구현 전 추가 확인이 필요한 정보
