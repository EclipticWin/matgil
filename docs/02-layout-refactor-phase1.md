# 02. 공통 레이아웃 컴포넌트 1차 리팩토링

## 작업 일자

2026-06-17

---

## 작업 목표

Map 화면을 제외한 일반 탭 페이지들에서 반복되는 레이아웃 코드를 공통 컴포넌트로 분리한다.
기능 동작, 색상, 폰트, 여백은 변경하지 않는다.

---

## 배경 분석 — 공통화 후보 전체 목록

분석 결과 식별된 반복 패턴 (이번 작업 범위 외 항목 포함):

| 패턴 | 해당 파일 수 | 난이도 |
|------|------------|--------|
| 탭 페이지 outer wrapper `px-5 pb-6 pt-6` | 4개 | 낮음 |
| 페이지 H1 스타일 | 5개 | 낮음 |
| 북마크 버튼 (HeartIcon + useBookmarks) | 3개 | 낮음 |
| 섹션 라벨 (ALL CAPS) | 3개 | 낮음 |
| 수평 스크롤 탭/칩 행 | 2개 | 중간 |
| 선택형 Chip/Pill | 4곳 local 구현 | 중간 |
| 장소 카드 행 구조 | 3개 | 중간 |
| 위저드 페이지 outer shell | 2개 | 높음 |

이번 작업은 난이도 낮음에 해당하는 wrapper/h1 패턴만 처리한다.

---

## 새로 만든 파일

### `src/shared/components/PageShell.jsx`

탭 페이지 표준 outer wrapper.

- 기본 클래스: `px-5 pb-6 pt-6`
- `className` prop으로 override 가능 (예: `pb-[6.5rem]` 같은 예외 케이스)

### `src/shared/components/PageHeader.jsx`

페이지 수준 h1 + optional subtitle.

- h1 클래스: `font-display text-[1.75rem] font-bold tracking-tight text-ink`
- `titleClassName` prop: h1에 추가 클래스 (예: `mb-5`)
- `subtitleClassName` prop: subtitle `<p>`에 추가 클래스 (예: `mt-1`, `[text-wrap:pretty]`)
- subtitle이 없으면 `<p>` 미렌더링

---

## 수정한 파일

### `src/pages/CoursesPage.jsx`

PageShell + PageHeader 적용. subtitle `subtitleClassName="mt-1"`.

### `src/pages/PhrasesPage.jsx`

PageShell + PageHeader 적용. subtitle 없음.

### `src/pages/MyPage.jsx`

PageShell + PageHeader 적용. h1 아래 Card와의 간격을 위해 `titleClassName="mb-5"`.

### `src/pages/CommunityPage.jsx`

PageHeader만 적용. outer 구조는 그대로 유지.
- CommunityTabs는 full-width가 필요해 outer에 `px-5` 없음 → PageShell 미적용
- subtitle `subtitleClassName="[text-wrap:pretty]"` (기존 스타일 유지)

---

## 건드리지 않은 것

HomePage, FilterSheet, NearbySheet, Supabase 관련 파일, router.jsx, BottomNavigation.jsx, /popular 관련 파일 전체

---

## 다음 단계 후보 (2차 리팩토링)

| 항목 | 설명 |
|------|------|
| `BookmarkButton` | PopularPlaceCard, RecommendationCard, NearbyRow 3곳의 동일한 북마크 버튼 추출 |
| `PlaceCard` | 3개 카드 컴포넌트의 공통 구조 추출 (배지 색·크기 옵션화 필요) |
| `TabBar` | PhraseCategoryTabs, CommunityTabs 공통화 (크기 variant 필요) |

---

## 빌드 검증

```
npm run build
✓ 134 modules transformed.  (+2 신규 컴포넌트)
✓ built in 2.48s
```
