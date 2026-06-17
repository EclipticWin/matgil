# 09. Place Detail Sheet — 코스 stop 식당 상세 화면

## 작업 일자

2026-06-18

---

## 이전 작업 요약 (08)

- `TodayCourseDetail.jsx` 신규 — Map Bottom Sheet 내부 코스 상세 화면
- `NearbySheet.jsx` 수정 — `selectedCourse` 상태로 기본 목록 ↔ 코스 상세 전환
- `CourseCard.jsx` 수정 — `onClick` prop 추가 (Map 탭 전용 인터랙션)
- z-index 정리: NearbySheet `z-30`, floating controls `z-20`, Modal `z-40`

---

## 이번 세션 작업 목표

Map 탭 코스 상세 화면(`TodayCourseDetail`)에서 **각 stop 식당 행을 눌렀을 때, 해당 식당 정보를 Bottom Sheet 내부에서 보여주는 Place Detail 화면을 만든다.**

라우팅 상세 페이지 없이, NearbySheet 내부 상태 전환만으로 처리한다.

---

## 수정 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/components/PlaceDetailSheet.jsx` | 신규 |
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/explore/components/TodayCourseDetail.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. NearbySheet.jsx — 3단계 상태 머신

기존 `selectedCourse` 상태에 `selectedPlace` 상태를 추가해 3단계 렌더 분기를 구성했다.

```js
const [selectedCourse, setSelectedCourse] = useState(null);
const [selectedPlace, setSelectedPlace] = useState(null);
```

**상태 전환 함수:**

```js
const openDetail  = (c)     => { setSelectedCourse(c); setSelectedPlace(null); setSnap('full'); setDragH(null); };
const closeDetail = ()      => { setSelectedCourse(null); setSelectedPlace(null); };
const openPlace   = (place) => setSelectedPlace(place);
const closePlace  = ()      => setSelectedPlace(null);
```

**렌더 분기:**

```jsx
{selectedCourse ? (
  selectedPlace ? (
    <PlaceDetailSheet place={selectedPlace} selectedLocation={selectedLocation} onBack={closePlace} />
  ) : (
    <TodayCourseDetail course={selectedCourse} selectedLocation={selectedLocation}
      onBack={closeDetail} onSelectPlace={openPlace} />
  )
) : (
  /* 기본 목록 */
)}
```

**상태 전환 흐름:**

```txt
기본 목록
  └─ TODAY'S PICK 카드 탭 → 코스 상세 (sheet full 확장)
       └─ stop 행 탭 → 식당 상세
            └─ 뒤로가기 → 코스 상세 복귀
       └─ 뒤로가기 → 기본 목록 복귀
```

---

### 2. TodayCourseDetail.jsx — stop 행 → button

`onSelectPlace` prop 추가. stop 행의 바깥 `<div>`를 `<button type="button">`으로 교체해 탭 인터랙션을 활성화했다.

```jsx
// 이전
<div key={stop.id ?? i} className="relative flex items-center gap-5">

// 이후
<button
  key={stop.id ?? i}
  type="button"
  onClick={() => onSelectPlace?.(stop)}
  className="relative flex w-full items-center gap-5 text-left"
>
```

`onSelectPlace`는 optional chaining(`?.`)으로 처리해 prop 없이 렌더해도 안전하다.

---

### 3. PlaceDetailSheet.jsx — 신규

Map Bottom Sheet 내부 전용 식당 상세 콘텐츠 컴포넌트.

**props:** `place`, `selectedLocation`, `onBack`

**화면 구성:**

```txt
[shrink-0 헤더]
  뒤로가기 버튼

[스크롤 본문 flex-1 overflow-y-auto]
  식당명
  히어로 이미지 (h-44 w-full, rounded-2xl)
  subtitle / 거리 / 주소
  description

  [MENU 섹션]     firstMenu 또는 treatMenu가 있을 때만 표시
  [VISIT INFO 섹션]  openTime / restDate / tel / parking / packing 중 하나라도 있을 때만 표시
  [Tags 섹션]     표시할 chip이 있을 때만 표시
```

**place 필드 적응 규칙:**

| 필드 | 표시 방식 |
|---|---|
| `distanceKm` | `370 m from {selectedLocation.label}` / `1.2 km from ...` / label 없으면 `370 m` |
| `address` | 그대로 표시 |
| `firstMenu` | subtitle + MENU 섹션 Main 항목 |
| `treatMenu` | MENU 섹션 Serves 항목 |
| `openTime` | VISIT INFO Hours (줄바꿈 허용, 파싱 없음) |
| `restDate` | VISIT INFO Rest day |
| `tel` | VISIT INFO Phone |
| `parking` / `hasParking` | VISIT INFO Parking |
| `packing` / `hasPacking` | VISIT INFO Takeout |
| `matgilCategoryKeys` + `tags` | Tags chip (HIDDEN_TAGS 필터 후) |

없는 필드 → 해당 행/섹션 전체 숨김 (`null` 반환). 빈칸 `-` 표시 없음.

**내부 상태성 chip 필터 (`HIDDEN_TAGS`):**

```js
const HIDDEN_TAGS = new Set([
  '음식점', '사진 있음', '위치 있음', '메뉴 정보 있음',
  '포장 가능', '주차 가능', '영업시간 있음',
]);
```

표시 chip = `matgilCategoryKeys` + HIDDEN_TAGS 제외한 `tags`. 없으면 Tags 섹션 숨김.

**섹션 제목 스타일:**

```jsx
<h3 className="mb-3 inline-flex items-center gap-1.5 text-[0.78rem] font-extrabold tracking-wide text-ink-soft">
  <SparkleIcon size={13} /> MENU
</h3>
```

- MENU 앞: `SparkleIcon`
- VISIT INFO 앞: `ClockIcon`
- 아이콘 색은 제목 텍스트와 동일 (`currentColor` 상속, `text-coral` 없음)
- 개별 항목 앞에는 아이콘 없음

**InfoRow 컴포넌트:**

```jsx
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="w-[4.75rem] shrink-0 text-[0.72rem] font-bold text-ink-faint">
        {label}
      </span>
      <span className="flex-1 text-sm leading-relaxed text-ink-soft">{value}</span>
    </div>
  );
}
```

openTime 같은 긴 문자열은 `leading-relaxed flex-1`로 자연스럽게 줄바꿈됨.

---

## UI 조정 과정

### 1차: 초기 구현
- 식당명이 이미지 아래에 배치됨 (순서 오류)
- 영업시간 앞에 ClockIcon 배치 (항목 아이콘 방식)
- UI 라벨이 한국어 (`대표`, `취급`, `영업시간` 등)

### 2차: 배치 재정렬 + 라벨 영문화 + 아이콘 개선

**배치 수정 최종:**

```txt
뒤로가기 버튼
식당명
[히어로 이미지]
subtitle / 거리 / 주소
description
MENU / VISIT INFO / Tags
```

**UI 라벨 영문화:**

| 이전 | 이후 |
|---|---|
| 대표 | Main |
| 취급 | Serves |
| 영업시간 | Hours |
| 휴무일 | Rest day |
| 전화번호 | Phone |
| 포장 | Takeout |
| 주차 | Parking |

DB 데이터 값(`돼지국밥`, `매주 일요일`, `[평일] - 11:00~...` 등)은 번역 없이 원문 유지.

**아이콘 수정:**
- 항목별 아이콘 제거, 섹션 제목 앞에만 아이콘 허용
- `text-coral` 제거 → 제목과 동일한 `currentColor` 상속

### 3차: subtitle 줄 간격 조정
- subtitle `pb-2` 추가로 거리 줄과의 간격 확보

---

## 동작 확인

- stop 행 탭 → 식당 상세 화면 전환
- 식당 상세에서 뒤로가기 → 코스 상세 복귀
- 코스 상세에서 뒤로가기 → 기본 목록 복귀
- 없는 정보(섹션 전체) 숨김 확인
- 사용자에게 보이면 안 되는 chip 필터링 확인
- 거리 표시 `{X} m/km from {selectedLocation.label}` 확인

---

## 아직 하지 않은 것

- Start this course 실제 기능
- Kakao Map 마커 / polyline
- 실제 도보 경로 계산
- LLM 추천 이유 생성
- 여러 추천 코스 생성
- 검색창 실제 검색 기능

---

## 다음 작업 후보

- 추천 코스 2~3개 확장
- Kakao Map 마커 / polyline 연결
- 지역 데이터 확장 (TourAPI 추가 수집)
