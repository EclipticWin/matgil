# 26. 맛길 프론트엔드 1차 리팩토링 작업 결과

## 1. 작업 목적

이번 작업은 맛길 프론트엔드 프로젝트의 유지보수성을 높이기 위한 순수 리팩토링이다.

Claude Code 기반 바이브 코딩으로 빠르게 구현되면서 생긴 중복 코드, 역할이 섞인 컴포넌트, 파일 안에 인라인으로 정의된 유틸 함수와 상수를 정리했다.

- 기능 추가가 아니라 코드 내부 구조 정리만 진행했다.
- 현재 기능, UI, 라우팅, Supabase 연동 방식을 모두 유지하는 조건으로 진행했다.
- 앞으로 기능을 추가할 때 코드를 찾기 쉽고, 변경 범위가 작고, 중복 수정이 발생하지 않도록 하는 것이 목적이었다.

---

## 2. 작업 전 조건

이번 리팩토링은 아래 조건을 모두 준수했다.

- 기능 변경 금지
- UI 변경 금지
- 라우팅 변경 금지
- Supabase 연동 방식 변경 금지
- 사용자에게 보이는 문구 변경 금지
- TypeScript 전환 금지
- 새 라이브러리 추가 금지
- mock 파일 삭제 금지
- 사용 여부가 불명확한 파일 삭제 금지

---

## 3. 실제 변경한 파일

### `src/features/explore/components/Modal.jsx`

- 파일 내부에 직접 정의되어 있던 `findScrollParent` 함수를 제거했다.
- `shared/utils/dom.js`에서 `findScrollParent`를 import하도록 변경했다.
- 기존 드래그 닫힘 동작, 터치 이벤트, 포인터 이벤트 동작은 그대로 유지된다.

### `src/features/explore/components/NearbySheet.jsx`

- 파일 내부에 직접 정의되어 있던 `findScrollParent` 함수를 제거했다.
- `shared/utils/dom.js`에서 `findScrollParent`를 import하도록 변경했다.
- GPS 로딩 스피너, 무한 스크롤 로딩 스피너, 전체 로딩 스피너 3개의 `<div>` JSX를 공통 `Spinner` 컴포넌트로 교체했다. 각 스피너의 크기, 색상, border, animation 클래스는 그대로 `className` prop으로 전달했다.
- 기존 UI와 동작 유지.

### `src/features/explore/components/TodayCourseDetail.jsx`

- 파일 내부에 직접 정의되어 있던 `distLabel` 함수를 제거했다.
- `features/courses/utils/courseDisplay.js`에서 `formatStopDistance`를 import하도록 변경했다.
- 저장 버튼 안의 로딩 스피너 `<div>` JSX를 공통 `Spinner` 컴포넌트로 교체했다.
- 기존 거리 표시 결과(`250 m`, `1.4 km`)와 UI 유지.

### `src/pages/SavedCourseDetailPage.jsx`

- 파일 내부에 직접 정의되어 있던 `distLabel` 함수를 제거했다.
- `features/courses/utils/courseDisplay.js`에서 `formatStopDistance`를 import하도록 변경했다.
- 페이지 로딩 스피너 `<div>` JSX를 공통 `Spinner` 컴포넌트로 교체했다.
- 기존 거리 표시 결과와 UI 유지.

### `src/pages/CoursesPage.jsx`

- 파일 내부에 직접 정의되어 있던 `formatSavedDate` 함수를 제거했다.
- `shared/utils/formatDate.js`에서 `formatSavedDate`를 import하도록 변경했다.
- 코스 목록 로딩 스피너 `<div>` JSX를 공통 `Spinner` 컴포넌트로 교체했다.
- 기존 날짜 표시 결과(`Mar 12, 2024` / `2024년 3월 12일`)와 UI 유지.

### `src/pages/CommunityPage.jsx`

- 파일 내부에 직접 정의되어 있던 `POST_TINTS` 상수를 제거했다.
- `features/community/data/communityConstants.js`에서 `POST_TINTS`를 import하도록 변경했다.
- 파일 내부에 직접 정의되어 있던 `normalizeDbPost` 함수를 제거했다.
- `features/community/services/communityService.js`에서 `normalizeDbPost`를 import하도록 변경했다.
- `formatRelativeOrAbsolute` import도 더 이상 직접 사용하지 않으므로 제거했다.
- 기존 게시글 표시 결과와 UI 유지.

### `src/features/community/components/PostComposer.jsx`

- 파일 내부에 직접 정의되어 있던 `WRITE_CATEGORIES` 상수를 제거했다.
- `features/community/data/communityConstants.js`에서 `WRITE_CATEGORIES`를 import하도록 변경했다.
- 기존 카테고리 목록(`general`, `question`, `review`, `tips`, `food`, `routes`)과 라벨, UI 유지.

### `src/features/community/services/communityService.js`

- `normalizeDbPost` 함수를 파일 하단에 추가했다.
- `normalizeDbPost`가 사용하는 `formatRelativeOrAbsolute`를 `shared/utils/formatTime.js`에서 import했다.
- `normalizeDbPost`가 사용하는 `POST_TINTS`를 `features/community/data/communityConstants.js`에서 import했다.
- 커뮤니티 게시글 DB 행을 PostCard에서 사용하는 정규화된 형태로 변환하는 책임이 페이지 컴포넌트에서 서비스 레이어로 이동했다.
- 반환 객체의 필드명(`id`, `userId`, `kind`, `author`, `from`, `ago`, `text`, `place`, `likes`, `comments`, `photo`, `tint`, `imageUrls`), 기본값, 표시 결과는 기존과 동일하게 유지.

### `src/features/courses/utils/courseDisplay.js`

- `formatStopDistance` 함수를 파일 상단에 추가했다.
- `TodayCourseDetail.jsx`와 `SavedCourseDetailPage.jsx`에서 각각 중복 정의되어 있던 `distLabel` 함수를 통합한 것이다.
- `stop.distanceKm`가 1km 미만이면 `"250 m"` 형식, 1km 이상이면 `"1.4 km"` 형식으로 반환하는 기존 동작 유지.
- `distanceKm`가 없으면 `stop.address`를 반환하고, 그것도 없으면 `null`을 반환하는 기존 동작 유지.

### `src/pages/MyPage.jsx`

- 파일 내부에 직접 정의되어 있던 `StatCard` 컴포넌트를 제거했다.
- `features/profile/components/StatCard.jsx`에서 `StatCard`를 import하도록 변경했다.
- 기존 JSX 구조, Tailwind 클래스, props(`value`, `label`, `onClick`, `valueClassName`) 모두 그대로 유지.

### `src/app/router.jsx`

- 하드코딩되어 있던 `"/saved-courses/:id"` 경로 문자열을 `ROUTES.savedCourseDetail(':id')` 사용으로 변경했다.
- `ROUTES.savedCourseDetail` 함수는 `(id) => \`/saved-courses/${id}\`` 이므로, `ROUTES.savedCourseDetail(':id')`의 최종 문자열은 `/saved-courses/:id`로 기존과 동일하다.
- 실제 라우팅 동작 변경 없음.

---

## 4. 새로 만든 파일

### `src/shared/utils/dom.js`

`findScrollParent(startEl, boundary)` 유틸 함수를 담은 파일이다.

`startEl`에서 시작해 `boundary`까지 DOM 트리를 올라가면서 스크롤 가능한 첫 번째 조상 요소를 찾아 반환한다. `Modal.jsx`와 `NearbySheet.jsx`에서 각각 동일하게 정의되어 있던 함수를 공통 위치로 이동했다.

### `src/shared/utils/formatDate.js`

`formatSavedDate(iso, locale)` 유틸 함수를 담은 파일이다.

ISO 날짜 문자열을 받아 `locale`에 따라 `ko-KR` 또는 `en-US` 형식의 짧은 날짜 문자열로 포맷한다. `CoursesPage.jsx`에 인라인으로 정의되어 있던 함수를 분리했다. 출력 형식은 기존과 동일하다.

### `src/shared/components/Spinner.jsx`

공통 로딩 스피너 컴포넌트다.

기본 클래스로 `animate-spin rounded-full border-2`를 갖고, 나머지 크기와 색상 클래스는 `className` prop으로 전달받는다. 기존 코드에서 반복되던 `<div className="h-8 w-8 animate-spin rounded-full border-2 ...">` 패턴을 하나의 컴포넌트로 추출했다. 각 사용처에서 `className`으로 정확히 같은 클래스를 전달하므로 렌더링 결과는 기존과 동일하다.

실제 사용처별 `className`:

| 사용처 | className |
|--------|-----------|
| `CoursesPage` 코스 목록 로딩 | `h-8 w-8 border-ink/10 border-t-ink/30` |
| `SavedCourseDetailPage` 페이지 로딩 | `h-8 w-8 border-ink/10 border-t-ink/30` |
| `NearbySheet` 전체 로딩 | `mb-3 h-8 w-8 border-ink/10 border-t-ink/30` |
| `NearbySheet` 무한 스크롤 로딩 | `h-7 w-7 border-ink/10 border-t-ink/30` |
| `NearbySheet` GPS 버튼 로딩 | `h-5 w-5 border-ink/10 border-t-ink/35` |
| `TodayCourseDetail` 저장 버튼 로딩 | `h-5 w-5 border-white/30 border-t-white` |

### `src/features/community/data/communityConstants.js`

커뮤니티 기능에서 사용하는 상수를 모아둔 파일이다.

- `POST_TINTS`: 게시글 카드 배경 틴트 색상 배열 `['#FFE3D4', '#FFEFC9', '#E6E9F7', '#E2F1DE']`. 기존에는 `CommunityPage.jsx`에 인라인으로 정의되어 있었다.
- `WRITE_CATEGORIES`: 글쓰기 폼의 카테고리 목록 배열. `general`, `question`, `review`, `tips`, `food`, `routes` 6개 항목. 기존에는 `PostComposer.jsx`에 인라인으로 정의되어 있었다. 값, 라벨, 한국어 라벨 모두 기존과 동일하게 유지.

### `src/features/profile/components/StatCard.jsx`

마이페이지의 통계 카드 컴포넌트다.

기존에는 `MyPage.jsx` 파일 안에 로컬 컴포넌트로 정의되어 있었다. JSX 구조, Tailwind 클래스, props 인터페이스(`value`, `label`, `onClick`, `valueClassName`) 모두 기존과 동일하게 분리했다.

---

## 5. 제거한 중복 코드

### `findScrollParent`

- 기존 위치: `Modal.jsx` 내부, `NearbySheet.jsx` 내부 (두 파일에 완전히 동일한 함수 정의)
- 변경 후 위치: `src/shared/utils/dom.js`

### `distLabel`

- 기존 위치: `TodayCourseDetail.jsx` 내부, `SavedCourseDetailPage.jsx` 내부 (두 파일에 완전히 동일한 함수 정의)
- 변경 후 위치: `src/features/courses/utils/courseDisplay.js`의 `formatStopDistance` 함수

### 스피너 JSX

- 기존 위치: `NearbySheet.jsx` 3곳, `TodayCourseDetail.jsx` 1곳, `SavedCourseDetailPage.jsx` 1곳, `CoursesPage.jsx` 1곳
- 변경 후 위치: `src/shared/components/Spinner.jsx`

### `formatSavedDate`

- 기존 위치: `CoursesPage.jsx` 내부
- 변경 후 위치: `src/shared/utils/formatDate.js`

### `normalizeDbPost`

- 기존 위치: `CommunityPage.jsx` 내부
- 변경 후 위치: `src/features/community/services/communityService.js`

### `POST_TINTS`, `WRITE_CATEGORIES`

- 기존 위치: `POST_TINTS`는 `CommunityPage.jsx` 내부, `WRITE_CATEGORIES`는 `PostComposer.jsx` 내부
- 변경 후 위치: `src/features/community/data/communityConstants.js`

### `StatCard`

- 기존 위치: `MyPage.jsx` 내부 로컬 컴포넌트
- 변경 후 위치: `src/features/profile/components/StatCard.jsx`

---

## 6. 의도적으로 제외한 작업

### `DesktopIntroPanel.jsx`의 로컬 `PinIcon` 교체 제외

공유 `PinIcon`은 `fill="currentColor"`(텍스트 색 상속), `viewBox="0 0 16 16"`, 기본 크기 20px이다. 로컬 `PinIcon`은 `fill="#F8481F"`(고정 coral), `viewBox="0 0 24 24"`, 크기 26px이다. 색상과 크기가 다르므로 교체 시 화면 변화가 발생할 수 있어 제외했다.

### `PopularPage.jsx` i18n 적용 제외

현재 한국어로 하드코딩된 페이지 제목, 로딩 문구, 에러 문구를 `t()`로 교체하면 사전(`dictionary.js`) 수정이 동반되고 사용자에게 보이는 문구가 달라질 수 있어 제외했다.

### `ResultPage.jsx` i18n 적용 제외

레거시 wizard flow 페이지에 영어로 하드코딩된 문구를 `t()`로 교체할 경우 의도하지 않은 문구 변경 가능성이 있어 제외했다.

### `BookmarkPage.jsx`를 `PageShell`, `PageHeader`로 교체하는 작업 제외

현재 직접 작성된 `px-5 pb-6 pt-6`와 `h1` 태그가 `PageShell`, `PageHeader`와 완전히 동일한 여백/구조를 만들어내는지 확인이 필요하고, 미묘한 레이아웃 차이가 생길 수 있어 제외했다.

### `LoginPage.jsx`를 `AppLayout`으로 교체하는 작업 제외

현재 로그인 페이지는 라우터에서 `AppLayout` 바깥에 위치하면서도 `TopBar`와 `BottomNavigation`을 직접 포함하는 의도적인 구조다. `AppLayout` 안으로 이동하면 라우팅 구조와 화면 배치가 달라질 수 있어 제외했다.

### `Modal.jsx`, `LanguageModal.jsx` 위치 이동 제외

`features/explore/components/`에서 `shared/components/`로 이동하면 import 경로를 수정해야 하는 파일이 6개 이상이고, 경로 누락 시 런타임 오류가 발생할 수 있어 제외했다.

### `NearbySheet.jsx` 커스텀 훅 분리 제외

저장 상태 관리, 무한 스크롤, 드래그 제스처, 코스 선택 로직이 서로 얽혀 있는 핵심 복잡 컴포넌트다. 훅 분리 시 인터페이스 설계 실수나 의존성 누락으로 인한 기능 오류 가능성이 높아 제외했다.

### `PostComposer.jsx`, `EditProfileSheet.jsx` 오버레이를 공통 Modal로 교체하는 작업 제외

두 컴포넌트는 `absolute inset-0 z-50` 오버레이를 직접 구현하고 있다. 공유 `Modal` 컴포넌트로 교체하면 z-index, 닫힘 애니메이션, 클릭 이벤트 전파 동작이 미묘하게 달라질 수 있어 제외했다.

### mock 파일 삭제 제외

`mockAuthService.js`, `mockPopularPlaces.js`, `mockRecommendations.js`, `courses.js` 등의 실제 사용 여부를 전수 확인하지 않은 상태에서 삭제하면 위험하므로 제외했다.

---

## 7. 기능/UI 변경 여부

- 기능 변경 없음
- UI 변경 없음
- 사용자에게 보이는 문구 변경 없음
- 라우팅 변경 없음
- Supabase 연동 변경 없음
- 새 라이브러리 추가 없음
- TypeScript 전환 없음

라우팅 관련 상세:

- 기존 경로 표기: `"/saved-courses/:id"` (하드코딩 문자열)
- 변경 후 표기: `ROUTES.savedCourseDetail(':id')` (상수 함수 사용)
- 최종 문자열: `"/saved-courses/:id"` (동일)
- 따라서 실제 라우팅 동작 변경 없음

---

## 8. 검증 결과

- `npm run build` 실행 결과: **성공**
- 빌드 완료 메시지: `✓ built in 4.48s`
- 에러 없음
- CSS minification 경고 (`-: T.Z`): 빌드 전부터 존재하던 경고로 이번 리팩토링과 무관
- chunk size 경고 (556 kB): 빌드 전부터 존재하던 경고로 이번 리팩토링과 무관

---

## 9. 커밋 전 확인할 사항

```
[ ] git status로 변경 파일 확인
[ ] git diff로 의도하지 않은 UI/문구 변경이 없는지 확인
[ ] npm run dev로 아래 주요 화면 직접 확인 (가능하면)
    [ ] 홈 (지도 탭)
    [ ] 코스 탭 (저장 코스 목록)
    [ ] 저장 코스 상세 페이지
    [ ] 저장 코스 → 지도에서 보기 (라우팅 확인)
    [ ] 주변 추천 바텀시트 (코스 카드, 무한 스크롤, 로딩, GPS 버튼)
    [ ] 코스 상세 (바텀시트 내부, 저장 버튼 로딩)
    [ ] 커뮤니티 탭 (게시글 목록)
    [ ] 커뮤니티 글 작성 (카테고리 탭, 이미지 업로드)
    [ ] 마이페이지 (통계 카드 3개, 프로필)
```

---

## 10. 추천 커밋 메시지

제목만:

```bash
git commit -m "refactor: 프론트엔드 공통 로직 및 컴포넌트 분리"
```

제목 + 본문:

```bash
git commit -m "refactor: 프론트엔드 공통 로직 및 컴포넌트 분리" -m "중복된 거리 표시, 스크롤 부모 탐색, 날짜 포맷, 스피너, 커뮤니티 상수 및 게시글 변환 로직을 공통 유틸/컴포넌트로 분리했다. 기능, UI, 라우팅, Supabase 연동 방식은 변경하지 않았다."
```

---

## 11. 다음 리팩토링 후보

이번 1차에서 제외한 작업들은 안전성 검토 후 2차 리팩토링 대상으로 검토할 수 있다.

- `PopularPage.jsx` i18n 적용 여부 검토 — 페이지 전체 문구가 하드코딩된 한국어로 되어 있음
- `BookmarkPage.jsx`의 `PageShell`/`PageHeader` 적용 여부 검토 — 다른 탭 페이지와 구조 불일치
- `LoginPage.jsx`의 `AppLayout` 적용 여부 검토 — 수동으로 TopBar + BottomNavigation을 조립하는 구조
- `Modal.jsx`, `LanguageModal.jsx`를 `shared/components/`로 이동하는 작업 검토 — 현재 `features/explore/`에 있지만 다른 페이지에서도 import 중
- `NearbySheet.jsx` 커스텀 훅 분리 검토 — 저장 로직, 무한 스크롤, 드래그 로직이 한 파일에 혼재
- `PostComposer.jsx`/`EditProfileSheet.jsx` 오버레이 공통화 검토 — 현재 공유 `Modal` 컴포넌트 미사용
- mock 파일 사용 여부 조사 후 정리 — `mockAuthService.js`, `mockPopularPlaces.js`, `mockRecommendations.js`, `courses.js` 실제 import 여부 확인
