# 07. Course Detail Sheet Plan — Map Bottom Sheet 내부 코스 상세 화면

## 목적

Map 탭의 `TODAY'S PICK` 코스 카드를 눌렀을 때, Courses 탭의 mock 상세 페이지로 이동하지 않고 **Map 화면 Bottom Sheet 내부에서 실제 todayCourse 상세 화면을 보여준다.**

이번 단계의 목표는 라우팅 상세 페이지를 만드는 것이 아니라, 현재 Map 화면 안에서 Bottom Sheet 내용을 다음처럼 전환하는 것이다.

```txt
기본 상태:
- TODAY'S PICK 추천 코스 카드
- NEARBY RIGHT NOW 음식점 목록

상세 상태:
- 뒤로가기 버튼
- 선택한 추천 코스 요약
- 실제 course.stops 목록
- Start this course 버튼
```

현재는 추천 코스가 1개지만, 나중에 추천 코스가 여러 개가 될 수 있으므로 **선택한 course를 상세로 보여주는 구조**로 설계한다.

---

## 현재 구현 상태

### TODAY'S PICK 코스 생성

* Map 탭의 `TODAY'S PICK`은 `buildTodayCourse()`로 실제 nearby places 기반 생성된다.
* 하드코딩 `COURSES[0]`, `Myeongdong Night Eats`는 Map 탭에서 제거되었다.
* `todayCourse`는 `HomePage.jsx`에서 생성되어 `NearbySheet`로 전달된다.
* `CourseCard`는 `disableLink` prop을 지원한다.
* Map 탭에서는 `CourseCard course={course} disableLink`로 Courses 탭 이동을 막고 있다.

### todayCourse 구조

현재 course 객체는 대략 아래 형태다.

```js
{
  id: 'today-pick',
  title,
  stops,
  km,
  hr,
  accent,
  score,
  totalDistanceKm,
  stopCount,
  routeDistanceLevel
}
```

각 stop은 Supabase place 기반 객체이며 대략 아래 필드를 가진다.

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
  tags,
  matgilCategoryKeys,
  distanceKm,
  tint
}
```

### CourseCard 상태

* CourseCard 상단 이미지 영역은 `stop.imageUrl`이 있으면 실제 이미지 표시
* imageUrl이 없거나 실패하면 기존 tint placeholder fallback
* Courses 탭 기존 CourseCard는 link 이동 유지
* Map 탭 TODAY'S PICK은 `disableLink`로 링크 이동 비활성화됨

### 아직 미구현 / 보류

이번 작업에서 아래 기능은 구현하지 않는다.

* Kakao Map API
* 지도 마커
* polyline
* 실제 도보 길찾기 경로 계산
* LLM 추천 이유 생성
* 여러 추천 코스 생성
* Courses 탭 mock 데이터 실제화
* 상세 라우팅 페이지
* DB 작업
* Edge Function 수정
* Supabase deploy
* 검색 기능
* Food Type 필터 로직 변경
* courseBuilder 점수 계산 로직 변경

---

## 참고할 기존 디자인

Courses 탭에서 mock 코스를 눌렀을 때 보이는 상세 화면 디자인을 참고한다.

기존 상세 화면의 주요 구성:

```txt
상단 coral/red hero 영역
- 뒤로가기 버튼
- CURATED ROUTE 라벨
- 코스 제목
- stop 수 / 거리 / 예상 시간

본문
- 짧은 설명 문장
- ROUTE STOPS
- stop 번호 원형 배지
- 세로 dotted line
- 각 stop의 썸네일, 이름, 부제목, 보조 정보

하단
- Start this course 버튼
```

이 디자인 느낌은 유지하고 싶다.

단, Map 탭 Bottom Sheet 안에서 보여줄 때는 다음을 지킨다.

* 배경색은 현재 Bottom Sheet 톤을 유지한다.
* 완전히 새 페이지처럼 라우팅하지 않는다.
* Map 탭의 Bottom Sheet 내부 화면 전환으로 처리한다.
* 기존 Courses 탭 mock 상세 페이지 자체는 이번 작업에서 건드리지 않는다.

---

## 원하는 UX

### 기본 Bottom Sheet 상태

현재 상태를 유지한다.

```txt
Eat near {selectedLocation.label}
100 nearby 또는 현재 nearby count

★ TODAY'S PICK
[추천 코스 카드]

NEARBY RIGHT NOW
[음식점 목록]
```

현재는 추천 코스가 1개이지만, 나중에 여러 추천 코스가 생길 수 있다.

---

### 코스 상세 상태

사용자가 TODAY'S PICK 코스 카드를 누르면, Bottom Sheet 안의 내용이 상세 화면으로 전환된다.

```txt
[뒤로가기 버튼]

[선택한 코스 요약]
- 제목
- stop 수
- 거리
- 예상 시간

[ROUTE STOPS]
- Stop 1
- Stop 2
- Stop 3

[Start this course 버튼]
```

상세 상태에서는 `NEARBY RIGHT NOW` 음식점 목록을 숨긴다.

뒤로가기 버튼을 누르면 다시 기본 Bottom Sheet 상태로 돌아간다.

---

## 상세 화면 구성 요구

### 상단 뒤로가기 버튼

* 선택한 추천 코스 요약보다 위에 위치한다.
* 기존 Courses 상세 화면의 둥근 back 버튼 느낌을 참고한다.
* 누르면 상세 상태를 닫고 기본 Bottom Sheet 상태로 돌아간다.
* 라우터 이동이 아니라 내부 상태 전환이다.

### 코스 요약 영역

표시할 내용:

```txt
★ CURATED ROUTE 또는 ★ TODAY'S PICK
course.title
course.stopCount 또는 stops.length
course.km
course.hr
```

`routeDistanceLevel`은 아직 화면에 표시하지 않는다.

### 코스 설명 문장

LLM을 사용하지 않는다.

rule-based 문장만 사용한다.

예:

```txt
A short food walk built from nearby places around {selectedLocation.label}.
```

또는:

```txt
A nearby food route with {stopCount} stops selected from your current filters.
```

문장은 너무 거창하게 만들지 않는다.

### Route Stops 목록

각 stop에 표시할 내용:

```txt
번호 배지: 1, 2, 3
썸네일: stop.imageUrl 있으면 이미지, 없으면 fallback
이름: stop.name
부제목: stop.firstMenu || stop.tags[0] || matgilCategoryKeys 기반 텍스트
보조 정보: stop.distanceKm 또는 address
```

기존 mock 상세처럼 세로 dotted line과 번호 배지를 활용하면 좋다.

단, 과도한 디자인 변경은 하지 않는다.

### Start this course 버튼

* 화면 하단에 배치 가능하다.
* 이번에는 실제 지도 경로 시작 기능은 구현하지 않는다.
* 버튼 클릭 동작은 아직 없어도 된다.
* 필요하면 disabled 또는 no-op으로 둔다.
* 버튼 텍스트는 `Start this course` 유지 가능.

---

## Bottom Sheet z-index / 상단 UI 가림 문제

현재 Map 탭 상단에는 검색창, 현재 위치 버튼, 언어 선택 버튼이 있다.

문제:

* Bottom Sheet가 위로 올라올 때 이 상단 UI들이 Bottom Sheet보다 위에 떠서 Sheet 내용을 가릴 수 있다.

요구:

* 코스 상세 상태에서는 Bottom Sheet가 상단 검색/위치/언어 UI보다 위에 보여야 한다.
* 가능하면 상세 상태에서만 z-index를 높이거나, 상단 UI보다 높은 stacking context를 적용한다.
* 전체 레이아웃을 크게 갈아엎지 않는다.
* 최소 변경으로 처리할 수 있는 방안을 먼저 조사한다.

가능한 방향 예시:

```txt
1. NearbySheet/detail state일 때 z-index를 더 높임
2. Bottom Sheet를 상단 UI보다 높은 z-index 레이어로 올림
3. 상세 상태에서는 sheet height를 더 크게 하고 상단 UI를 덮는 방식 검토
```

구현 전에 현재 z-index 구조를 반드시 확인한다.

---

## 상태 관리 방향

다음 중 적절한 방식을 조사 후 선택한다.

### 후보 A: NearbySheet 내부 상태

`NearbySheet` 안에서 `viewMode` 또는 `selectedCourse` 상태를 둔다.

```js
const [selectedCourse, setSelectedCourse] = useState(null);
```

* `selectedCourse === null` → 기본 목록 상태
* `selectedCourse !== null` → 상세 상태

장점:

* Map Bottom Sheet 내부 전환이라 NearbySheet에 자연스럽다.
* HomePage 상태가 과도하게 늘어나지 않는다.

단점:

* 나중에 여러 코스 / 외부 제어가 필요하면 HomePage로 올릴 수 있다.

### 후보 B: HomePage 상태

`HomePage`에서 selectedCourse 상태를 관리한다.

장점:

* 상위에서 상태를 제어하기 쉽다.
* 나중에 Kakao Map 마커/polyline과 연결할 때 유리할 수 있다.

단점:

* 현재 단계에서는 HomePage가 복잡해질 수 있다.

### 현재 권장

이번 MVP 단계에서는 **NearbySheet 내부 상태**를 우선 검토한다.

다만 Kakao Map 마커/polyline과 연결할 때 selectedCourse를 HomePage로 올려야 할 가능성이 있으므로, 구조를 너무 막아두지 않는다.

---

## 컴포넌트 구조 후보

새 컴포넌트를 만든다면 아래 위치를 우선 검토한다.

```txt
src/features/explore/components/CourseDetailSheet.jsx
```

또는

```txt
src/features/explore/components/TodayCourseDetail.jsx
```

권장:

```txt
src/features/explore/components/TodayCourseDetail.jsx
```

이유:

* 실제 Modal/Shell 전체가 아니라 NearbySheet 내부 상세 콘텐츠에 가깝다.
* Map 탭의 TODAY'S PICK 전용 상세 UI라는 의미가 명확하다.

---

## CourseCard 클릭 처리

현재 Map 탭에서는 `CourseCard`에 `disableLink`를 전달한다.

이번 작업에서는 `disableLink` 상태에서도 클릭 이벤트를 받을 수 있게 검토한다.

예상 방향:

```jsx
<CourseCard
  course={course}
  disableLink
  onClick={() => setSelectedCourse(course)}
/>
```

CourseCard는 다음을 지원할 수 있다.

* `disableLink === false`: 기존처럼 Link 렌더링
* `disableLink === true` + `onClick 있음`: button 또는 clickable div로 렌더링
* `disableLink === true` + `onClick 없음`: 단순 div 렌더링

접근성을 고려하면 clickable div보다 button 구조가 더 좋지만, 기존 카드 스타일을 깨지 않는지 확인한다.

---

## 이번 작업에서 수정 가능성이 있는 파일

조사 후 확정한다.

예상 파일:

```txt
src/features/explore/components/NearbySheet.jsx
src/features/explore/components/TodayCourseDetail.jsx
src/features/courses/components/CourseCard.jsx
```

필요 시:

```txt
src/pages/HomePage.jsx
```

단, 가능하면 HomePage 수정은 최소화한다.

---

## 이번 작업에서 하지 않는 것

* Courses 탭 mock 데이터 수정
* Courses 탭 상세 라우팅 구조 변경
* Kakao Map API 붙이기
* 지도 마커 만들기
* polyline 만들기
* 실제 도보 경로 계산
* LLM 추천 이유 생성
* DB 작업
* Edge Function 수정
* Supabase deploy
* 추천 코스 여러 개로 확장
* 검색 기능 구현
* Food Type 필터 로직 변경
* courseBuilder 점수 계산 로직 변경
* 디자인 전체 리뉴얼

---

## 구현 전 확인할 것

1. 현재 Courses 탭 상세 화면이 어떤 파일/컴포넌트로 구성되어 있는지 확인
2. 기존 Courses 상세 디자인 중 Map Bottom Sheet 내부에서 재사용 가능한 UI 패턴 확인
3. Map Bottom Sheet 현재 구조 확인
4. NearbySheet에서 기본 목록 상태와 상세 상태를 나눌 수 있는지 확인
5. CourseCard가 `disableLink` 상태에서 `onClick`을 받을 수 있는지 확인
6. z-index 때문에 상단 검색/위치/언어 UI가 sheet를 가리는 구조인지 확인
7. 최소 수정으로 상세 상태에서 Bottom Sheet를 최상단 레이어처럼 보이게 하는 방법 확인
8. 필요한 수정 파일 목록 정리

---

## 최종 원칙

```txt
Map 탭 내부 전환
라우팅 상세 페이지 금지
mock Courses 데이터 수정 금지
실제 todayCourse.stops만 표시
Kakao Map / LLM / 실제 경로 계산은 나중에
기존 Bottom Sheet 톤 유지
나중에 여러 추천 코스 확장 가능하게 설계
```
