# 08. Kakao Map Course Visualization Plan

## 목적

Map 탭의 기존 placeholder 지도 영역을 실제 Kakao Map으로 교체하고, 현재 추천된 TODAY'S PICK 코스 1개를 지도 위에 시각화한다.

이번 단계의 목표는 여러 추천 코스 확장이 아니라, 현재 생성된 추천 동선 1개가 지도 위에서 보이도록 만드는 것이다.

## 현재 상태

* Map 탭은 HomePage 기반으로 구성되어 있다.
* Supabase `mg_places` 데이터에서 실제 식당 목록을 가져온다.
* 각 place에는 `latitude`, `longitude`가 있다.
* `selectedLocation` 기준으로 nearby places가 정렬된다.
* `buildTodayCourse()`가 nearby places 기반으로 추천 코스 1개를 생성한다.
* TODAY'S PICK 카드 클릭 시 Bottom Sheet 내부에서 코스 상세 화면이 열린다.
* 코스 상세 화면에서 stop 식당을 클릭하면 식당 상세 화면이 열린다.
* 아직 실제 지도는 없다.
* 아직 지도 위 마커, polyline, fit bounds 기능은 없다.

## 이번 작업 범위

이번 작업은 Kakao Map 기본 연동과 현재 추천 코스 1개 시각화까지만 진행한다.

구현 목표:

1. Kakao Map JavaScript SDK 로드
2. Map 탭 배경 영역에 실제 Kakao Map 표시
3. `selectedLocation` 기준으로 지도 초기 중심 설정
4. TODAY'S PICK 코스의 stops 1, 2, 3을 지도 위에 마커로 표시
5. stop 순서가 보이도록 마커에 번호 표시
6. stop들을 직선 polyline으로 연결
7. TODAY'S PICK 클릭 시 지도 중심/범위가 해당 코스 stops를 포함하도록 이동
8. 기존 Bottom Sheet 동작은 유지

## 이번 작업에서 하지 않을 것

* 여러 추천 코스 생성
* 여러 코스 동시 표시
* 실제 도보 경로 계산
* Kakao Directions API 또는 길찾기 API 연결
* GPS 현재 위치 기능
* 장소 검색 기능
* 지도 마커 클릭 시 식당 상세 열기
* 코스별 색상 구분
* Supabase DB 구조 변경
* Edge Function 변경
* LLM 연결
* 추천 알고리즘 변경

## 키 관리 방침

Kakao Map JavaScript SDK를 사용한다.

필요한 키:

* Kakao Developers의 JavaScript 키

환경변수 이름 후보:

```env
VITE_KAKAO_MAP_JS_KEY=your_kakao_javascript_key
```

주의:

* Kakao Map JavaScript SDK에는 REST API 키가 아니라 JavaScript 키를 사용한다.
* JavaScript 키는 프론트에서 SDK 로드에 사용되므로 브라우저에 노출될 수 있다.
* 대신 Kakao Developers에서 JavaScript SDK 도메인을 반드시 등록해야 한다.
* 로컬 개발용 도메인과 배포 도메인을 모두 등록해야 할 수 있다.

  * 예: `http://localhost:5173`
  * 예: GitHub Pages 배포 도메인
* 필요한 정보가 없으면 임의로 진행하지 말고 사용자에게 물어본다.

Claude가 사용자에게 물어봐야 할 수 있는 정보:

1. Kakao Developers JavaScript 키
2. 로컬 개발 도메인
3. GitHub Pages 배포 도메인
4. 현재 프로젝트에서 사용할 환경변수 이름 확정 여부
5. Kakao Map API 사용 설정이 켜져 있는지 여부
6. Kakao Developers에 JavaScript SDK 도메인이 등록되어 있는지 여부

## 구현 방향

### 1. Kakao Map SDK 로더 분리

Kakao Map SDK를 동적으로 로드하는 유틸을 만든다.

파일 후보:

```txt
src/features/explore/map/loadKakaoMapSdk.js
```

역할:

* `VITE_KAKAO_MAP_JS_KEY` 환경변수 확인
* 이미 `window.kakao?.maps`가 있으면 재사용
* SDK script가 이미 로딩 중이면 중복 삽입 방지
* SDK 로딩 성공/실패 처리
* app key가 없으면 에러를 던지거나 fallback 표시

### 2. KakaoMap 컴포넌트 생성

파일 후보:

```txt
src/features/explore/components/KakaoMap.jsx
```

역할:

* 지도 DOM container 생성
* selectedLocation을 중심으로 지도 초기화
* todayCourse stops를 마커로 표시
* todayCourse stops를 polyline으로 연결
* stops가 있으면 bounds를 계산해 지도 범위 조정
* stops가 없으면 selectedLocation 중심만 표시
* SDK 로딩 실패 시 기존 placeholder 또는 안내 UI 표시

### 3. HomePage에 지도 연결

`HomePage.jsx`의 기존 지도 placeholder 영역을 KakaoMap 컴포넌트로 교체한다.

전달할 props 후보:

```jsx
<KakaoMap
  selectedLocation={selectedLocation}
  course={todayCourse}
/>
```

또는 추후 확장을 고려해:

```jsx
<KakaoMap
  selectedLocation={selectedLocation}
  activeCourse={todayCourse}
/>
```

### 4. TODAY'S PICK 클릭 시 지도 focus

기본 목표:

* todayCourse가 생성되면 지도에 해당 코스 마커/선이 보인다.
* TODAY'S PICK을 클릭해 코스 상세로 들어갈 때, 지도도 해당 코스 stops를 포함하도록 이동한다.

구현 방법 후보:

1. `KakaoMap`이 `activeCourse` 변경을 감지해서 bounds 조정
2. `NearbySheet`에서 코스 클릭 시 HomePage로 callback을 올리고 activeCourse를 별도 상태로 관리

MVP에서는 복잡도를 줄이기 위해 `todayCourse` 자체를 active course로 간주해도 된다.

다만 사용자가 TODAY'S PICK을 클릭했을 때만 지도 focus를 주고 싶다면, `selectedMapCourse` 상태를 HomePage에 추가하는 방식을 검토한다.

## 지도 표시 정책

### 마커

* stop 순서대로 1, 2, 3 번호가 보이게 한다.
* 기본 Kakao marker보다 custom overlay 또는 custom marker가 더 적합할 수 있다.
* MVP에서는 단순 번호 마커만 구현한다.
* 마커 클릭 상세는 이번 범위에서 제외한다.

### Polyline

* stop 좌표를 순서대로 연결한다.
* 실제 도보 경로가 아니라 직선 연결선이다.
* 사용자가 오해하지 않도록 코드 주석에 명확히 남긴다.

```txt
This polyline is a visual connection between recommended stops,
not an actual walking route.
```

### Bounds

* stops가 2개 이상이면 LatLngBounds를 만들어 모든 stop이 보이게 한다.
* stops가 1개면 해당 stop 중심으로 이동한다.
* stops가 없으면 selectedLocation 중심을 유지한다.

## Fallback 정책

아래 상황에서는 앱이 깨지면 안 된다.

1. Kakao key 없음
2. SDK 로딩 실패
3. window.kakao 없음
4. course 없음
5. stops 없음
6. 일부 stop에 latitude/longitude 없음

처리 방향:

* key 없음: 지도 영역에 안내 placeholder 표시
* SDK 실패: 지도 placeholder 표시
* 좌표 없는 stop: 마커/선에서 제외
* 표시 가능한 stop이 없으면 selectedLocation 중심만 표시

## 수정 예상 파일

신규:

```txt
src/features/explore/map/loadKakaoMapSdk.js
src/features/explore/components/KakaoMap.jsx
```

수정:

```txt
src/pages/HomePage.jsx
```

필요 시 수정:

```txt
.env.example
```

가능하면 건드리지 않을 파일:

```txt
src/features/explore/data/courseBuilder.js
src/features/explore/components/NearbySheet.jsx
src/features/explore/components/TodayCourseDetail.jsx
src/features/explore/components/PlaceDetailSheet.jsx
src/features/courses/components/CourseCard.jsx
```

## 구현 전 확인 질문

작업자가 아래 정보가 필요하면 임의로 진행하지 말고 사용자에게 질문한다.

* Kakao JavaScript 키가 있는지
* 환경변수 이름을 `VITE_KAKAO_MAP_JS_KEY`로 사용해도 되는지
* `.env.local` 또는 GitHub Secrets에 키를 등록할 수 있는지
* Kakao Developers에 등록할 로컬/배포 도메인이 무엇인지
* Kakao Map API 사용 설정이 켜져 있는지
* 현재 지도 placeholder 위치가 어느 컴포넌트인지 확실하지 않을 경우

## 완료 기준

* `npm run build` 통과
* Kakao key가 있을 때 실제 지도가 표시됨
* selectedLocation 기준으로 지도 중심이 잡힘
* todayCourse stops 1, 2, 3 마커가 지도에 표시됨
* stops 사이 직선 polyline이 표시됨
* TODAY'S PICK 클릭/상세 진입 기존 동작 유지
* 식당 상세/뒤로가기 기존 동작 유지
* key가 없거나 SDK 로딩 실패해도 앱이 깨지지 않음
