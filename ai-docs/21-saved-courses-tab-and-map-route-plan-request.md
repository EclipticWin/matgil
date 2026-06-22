# 21. Saved Courses 탭 및 지도 동선 보기 구현 계획 요청

## 작성 일시

2026-06-22 KST

---

## 작업 목적

현재 `Courses / 동선` 탭은 하드코딩된 목업 화면이다.

이제 이 탭을 실제 로그인 사용자의 저장 코스 목록으로 연결하고 싶다.

핵심 목표는 다음과 같다.

```txt
1. Map 탭에서 추천 코스를 저장
2. Courses 탭에서 내가 저장한 코스 목록 확인
3. 저장 코스 클릭 시 기존 코스 상세 디자인으로 상세 보기
4. 상세 하단 버튼을 통해 Map 탭에서 해당 동선 다시 보기
```

---

## 현재 DB 준비 상태

Supabase SQL Editor에서 `mg_saved_courses` 테이블 생성 여부를 확인했다.

확인 쿼리:

```sql
select
  to_regclass('public.mg_saved_courses') as saved_courses;
```

결과:

```json
[
  {
    "saved_courses": "mg_saved_courses"
  }
]
```

즉, `public.mg_saved_courses` 테이블은 존재한다.

---

## mg_saved_courses 테이블 전제

현재 저장 코스 테이블은 아래 구조를 기준으로 한다.

```txt
id uuid
user_id uuid
locale varchar(5)
title text
subtitle text
description text
anchor_label text
total_distance_m integer
total_duration_min integer
stop_count integer
place_ids bigint[]
stops jsonb
course_snapshot jsonb
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz
deleted_by uuid
```

RLS 전제:

```txt
- 로그인 사용자는 자기 저장 코스만 select 가능
- 로그인 사용자는 자기 user_id로만 insert 가능
- 로그인 사용자는 자기 저장 코스만 update 가능
- 삭제는 hard delete가 아니라 soft delete로 처리
```

---

## 중요한 저장 원칙

저장 코스는 나중에 다시 계산하지 않는다.

즉, `place_id`만 저장하고 나중에 다시 동선 추천 알고리즘을 돌리는 방식은 피한다.

저장 시점의 추천 코스 데이터를 snapshot으로 저장한다.

저장해야 할 핵심 데이터:

```txt
- 현재 추천 코스 제목
- 설명
- 총 거리
- 예상 시간
- stop 개수
- place_id 배열
- stops 배열
- course_snapshot 전체
```

중요:

```txt
place_ids와 stops는 현재 추천된 순서 그대로 저장해야 한다.
저장 코스를 다시 열었을 때 장소 순서가 바뀌면 안 된다.
추천 알고리즘이 나중에 바뀌어도 저장된 코스는 저장 당시 상태를 유지해야 한다.
```

---

## 구현하고 싶은 사용자 흐름

### 1. 로그아웃 상태

`Courses / 동선` 탭 클릭 시 저장 코스 목록 대신 로그인 안내를 보여준다.

EN:

```txt
Log in to view your saved courses.
Save routes you like and revisit them anytime.
Log in
```

KO:

```txt
저장한 코스를 보려면 로그인해주세요.
마음에 드는 동선을 저장하고 언제든 다시 확인해보세요.
로그인
```

---

### 2. 로그인 상태 + 저장 코스 없음

EN:

```txt
No saved courses yet.
Save a recommended route from the map and come back here.
```

KO:

```txt
아직 저장한 코스가 없습니다.
지도에서 추천 동선을 저장하고 다시 확인해보세요.
```

---

### 3. 로그인 상태 + 저장 코스 있음

`Courses / 동선` 탭에 내가 저장한 코스 목록을 보여준다.

표시 항목 예시:

```txt
- 코스 제목
- stop 수
- 총 거리
- 예상 시간
- 대표 이미지 또는 placeholder
- 저장일
```

기존 Courses 탭 목업 카드 디자인은 최대한 유지한다.

---

### 4. Map 탭 추천 코스 상세에서 저장

Map 탭에서 추천 코스 상세 화면에 들어갔을 때 저장 버튼을 추가한다.

EN:

```txt
Save course
Saving...
Saved
Failed to save course
```

KO:

```txt
코스 저장
저장 중...
저장됨
코스 저장에 실패했습니다
```

비로그인 상태에서 저장 버튼을 누르면 로그인 안내를 보여준다.

---

### 5. 저장 코스 상세 보기

Courses 탭에서 저장 코스를 클릭하면 기존 코스 상세 목업 디자인을 유지한 채 상세 화면을 보여준다.

다만 내용은 DB의 `mg_saved_courses`에서 가져온 데이터로 표시한다.

표시 항목:

```txt
- 제목
- 설명
- stop count
- distance
- duration
- route stops
- 각 stop의 장소명/카테고리/거리/이미지
```

stops 순서는 저장된 `stops` 배열 순서 그대로 표시한다.

---

### 6. 지도에서 동선 보기

저장 코스 상세 하단 버튼 문구를 변경한다.

기존:

```txt
Start this course
```

변경:

```txt
View route on map
```

KO:

```txt
지도에서 동선 보기
```

이 버튼을 누르면 Map 탭으로 이동하고, 저장된 코스의 동선이 지도 또는 지도 하단 상세 영역에 다시 표시되어야 한다.

가능한 구현 방식:

```txt
1. 기존 Map 탭의 코스 표시 상태/함수를 재사용
2. router state로 savedCourse 전달
3. 어렵다면 sessionStorage로 savedCourse 전달
```

최소 목표:

```txt
Map 탭으로 이동했을 때 저장한 코스 상세 정보가 다시 표시되어야 한다.
기존 지도 polyline 로직이 이미 있다면 재사용한다.
없다면 새로 크게 만들지 말고 1차에서는 저장 코스 상세를 Map 탭에서 다시 띄우는 것까지 구현한다.
```

---

## 예상 수정/생성 파일

정확한 파일명은 현재 코드 구조를 분석해서 판단한다.

우선 확인할 후보:

```txt
src/pages/CoursesPage.jsx
src/pages/CourseDetailPage.jsx
src/pages/MapPage.jsx
src/features/explore/data/courseBuilder.js
src/features/explore/components/TodayCourseDetail.jsx
src/features/explore/components/NearbySheet.jsx
src/features/explore/components/MapView.jsx
src/shared/constants/routes.js
src/app/router.jsx
src/shared/i18n/dictionary.js
src/features/auth/hooks/useAuth.jsx
src/lib/supabase.js
```

서비스 파일은 새로 만드는 것을 고려한다.

추천:

```txt
src/features/courses/services/savedCourseService.js
```

예상 함수:

```js
fetchSavedCourses({ userId })
saveCourse({ userId, locale, course })
fetchSavedCourseById({ userId, courseId })
softDeleteSavedCourse({ userId, courseId })
```

---

## i18n 필수

한국어/영어 둘 다 처리해야 한다.

dictionary에 EN/KO 모두 추가한다.

필수 문구:

```txt
Courses / 동선
Food courses / 맛집 동선
Saved courses / 저장한 동선
Log in to view your saved courses. / 저장한 코스를 보려면 로그인해주세요.
Save routes you like and revisit them anytime. / 마음에 드는 동선을 저장하고 언제든 다시 확인해보세요.
No saved courses yet. / 아직 저장한 코스가 없습니다.
Save a recommended route from the map and come back here. / 지도에서 추천 동선을 저장하고 다시 확인해보세요.
Save course / 코스 저장
Saving... / 저장 중...
Saved / 저장됨
Failed to save course / 코스 저장에 실패했습니다.
View route on map / 지도에서 동선 보기
Remove saved course / 저장한 코스 삭제
Delete saved course? / 저장한 코스를 삭제할까요?
```

raw key가 화면에 보이면 안 된다.

---

## UI 원칙

기존 Matgil 톤을 유지한다.

```txt
- cream/beige 배경
- coral 포인트
- 부드러운 카드
- 과한 shadow 금지
- 과한 glow 금지
- 모바일 360px 기준 유지
```

input/textarea focus 상태에서 빨간색/coral border나 ring을 쓰지 않는다.

```txt
focus:border-stone-400
focus:ring-stone-200
```

---

## 이번 작업에서 건드리지 말 것

```txt
PC 소개/QR 영역
MyPage
Community 이미지 업로드
Community 이미지 뷰어
Supabase Storage
DB schema
Supabase SQL 실행
Git commit / push
새 패키지 설치
```

---

## 계획 요청

아직 바로 구현하지 말고, 먼저 현재 코드 구조를 분석한 뒤 구현 계획만 보고해.

특히 아래를 반드시 확인해.

```txt
1. 현재 추천 코스 데이터 shape
2. Map 탭에서 코스 상세가 열리는 구조
3. Courses 탭 목업 데이터 구조
4. 저장 코스 상세 화면이 기존 라우터/컴포넌트로 가능한지
5. View route on map 연결을 router state로 할지 sessionStorage로 할지
6. 저장 시 course_snapshot에 어떤 값을 넣을지
7. 저장 버튼을 어느 컴포넌트에 추가할지
```

---

## 계획 보고 형식

아래 형식으로만 보고해.

```txt
Saved Courses 기능 구현 계획

1. 현재 코드 구조 분석
2. 현재 추천 코스 데이터 shape
3. DB 저장 방식
4. Save course 버튼 추가 위치
5. Courses 탭 구현 방식
6. 저장 코스 상세 화면 구현 방식
7. View route on map 연결 방식
8. 수정/생성 예정 파일
9. i18n 추가 예정 키
10. 위험 요소와 방지책
11. 구현 순서
12. 이번 작업에서 하지 않을 것

아직 코드는 수정하지 않았고, DB도 수정하지 않았고, 커밋/푸시도 하지 않았다.
승인하면 이 계획대로 단계별로 구현하겠다.
```

