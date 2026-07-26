# 55. 로그인 화면 서비스 소개 문구 추가 및 동선 목록 카드(CourseCard) 이미지 제거·압축형 개편

## 1. 작업 일시

- 작성일시: 2026-07-26 13:02 KST

---

## 2. 작업 배경

`docs/54-heart-icon-unification-and-phrases-voice-help-ui-polish.md`는 커밋 `969c375`(하트 아이콘 통일 및 Phrases Voice help UI 미세 조정)에 문서와 함께 커밋·push되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 다음 작업들을 다룬다. 이 문서 작성 시점까지 `969c970` 이후로는 어떤 `git add`/`commit`/`push`도 수행되지 않아, 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있었다.

1. 로그인 화면에 다국어 서비스 소개 문구 추가 + 스타일(간격·크기·색상) 2차 미세 조정
2. 모바일 필터 시트의 별점 영역 하단 여백을 상단과 대칭으로 조정
3. 지도 동선 추천 목록 카드 UI 개편을 위한 **조사 전용**(코드 미수정) 단계
4. `CourseCard.jsx` 이미지 제거 + 압축형 요약 카드로 전면 개편
5. `CourseCard.jsx` 가독성·간격 미세 조정(색상 위계, divider, 스톱 간격 비율)
6. `CourseCard.jsx` 카드 그림자 강도를 기존의 60% 수준으로 축소

이번 세션 중 이 작업들과 **무관하게** 워킹 디렉터리에 이미 존재하던 일본어("준비 중") 안내 관련 미커밋 변경(`LanguageModal.jsx`, `exploreOptions.js`, `HomePage.jsx`, `MyPage.jsx` 수정 + 신규 `JapaneseComingSoonModal.jsx`)이 함께 있었으나, 이번 세션에서는 전혀 건드리지 않았고 이번 커밋에도 포함하지 않는다.

---

## 3. 조사에 사용한 명령(전부 읽기 전용)

```
git log --oneline
git status --porcelain
git diff --stat HEAD
git diff HEAD -- <file>
git diff --check
npm run build
grep/Read — CourseCard.jsx, NearbySheet.jsx, courseBuilder.js, courseDisplay.js,
            courseMetrics.js, FoodCategoryProvider.jsx, placeApi.js, Thumbnail.jsx,
            tailwind.config.js, dictionary.js
```

---

## 4. 로그인 화면 서비스 소개 문구

### 4.1 최초 추가

`Welcome to Matgil` 환영 문구 아래에 서비스를 한 줄로 설명하는 보조 문구를 추가했다.

- **파일**: `src/features/auth/components/LoginForm.jsx`(126~135행 부근), `src/shared/i18n/dictionary.js`
- **신규 키**: `login.serviceDescription`(en/ko/zh-CN 3개 로케일 모두)
  - en: `A food route recommendation app for international visitors to Seoul.`
  - ko: `서울 방문 외국인 관광객을 위한 맛집 동선 추천 앱`
  - zh-CN: `面向首尔外国游客的美食路线推荐应用`
- 모바일/PC 로그인 폼이 동일한 `LoginForm.jsx`를 공유하므로 별도 반응형 분기 없이 양쪽에 자동 표시됨. PC 왼쪽 `DesktopIntroPanel.jsx`는 전혀 건드리지 않음.

### 4.2 스타일 2차 미세 조정(두 차례에 걸쳐 요청)

1차: 환영 문구-소개 문구 간격 `mt-2`(8px)→`mt-1.5`(6px, 요청한 90%에 가장 가까운 표준값), 글자 크기 `text-[0.8125rem]`(13px)→`text-xs`(12px, 90%에 근접), 색상 `text-ink-soft`→`text-ink-soft/85`(같은 색을 85% opacity로 옅게, 새 색상 발명 없음).

---

## 5. 모바일 필터 시트 별점 영역 하단 여백

- **파일**: `src/features/explore/components/FilterSheet.jsx`
- `MINIMUM RATING` 라벨 위에 이미 쓰이던 `SectionLabel`의 `mt-10`(40px)과 정확히 동일한 값으로, 별점 슬라이더를 감싸는 스크롤 본문 컨테이너의 `padding-bottom`을 `pb-2`(8px)→`pb-10`(40px)으로 변경 — 상단 여백과 픽셀 단위로 대칭. Reset/Show results 버튼 영역·별점 로직은 무변경.

---

## 6. 동선 추천 목록 카드 UI 개편 — 조사 단계(코드 미수정)

사용자가 "코드를 수정하지 말고 조사만" 요청한 단계. `Read`/`Grep`만 사용, `Edit`/`Write` 미호출.

핵심 조사 결과(§7 구현의 근거):
- 카드 렌더링: `CourseCard.jsx`(`CourseCardInner`), 목록: `NearbySheet.jsx` 460~500행대.
- course 객체는 프론트(`courseBuilder.js`)에서만 계산 — Edge Function/Supabase 쿼리 변경 불필요.
- 장소명(`stop.name`)은 fetch 시점에 이미 locale-resolved(`placeApi.js`의 `pickTranslatedRow`), 카테고리(`matgilCategoryKeys`)는 raw key라 `getCategoryLabel(key, locale)`(`FoodCategoryProvider.jsx`) 통과 필요.
- `Thumbnail.jsx`는 `loading="lazy"` 없이 즉시 `<img>` 요청 — 이미지 제거 시 요청 자체가 사라짐, `TodayCourseDetail`/`PlaceDetailSheet`/저장 스냅샷에는 영향 없음(각자 독립적으로 `Thumbnail` 호출).
- TODAY'S PICK은 별도 필드가 아니라 "배열의 0번째"라는 관례임을 확인.

---

## 7. CourseCard.jsx — 이미지 제거 + 압축형 요약 카드 개편

### 7.1 이미지 제거

`course.stops.slice(0,3)` + `Thumbnail` 3장 렌더링(`h-24` 컨테이너, 흰색 border, placeholder 포함) 전부 제거. `Thumbnail` import 삭제, `<img>`/`Thumbnail` 참조가 파일에 남지 않음을 확인.

### 7.2 새 카드 구조

배지 행(TODAY'S PICK ↔ STOPS) → 코스 제목(`line-clamp-2`) → 거리·시간·식당/카페 구성 → 1→2→3 압축 경로(번호·장소명·음식종류 + 화살표) → 우측 하단 "코스 상세 보기 →".

### 7.3 TODAY'S PICK과 active 상태 분리

- `isTodayPick`: `NearbySheet.jsx`에서 `course.id === courses[0]?.id`(**전체 배열** 기준, `visibleCourses`/무한스크롤과 무관) — 새 prop으로 `CourseCard`에 전달.
- `isActive`: 기존 `activeCourse` 비교 로직 그대로, "STOPS" 배지 색상에만 관여. 두 상태는 서로 독립.

### 7.4 식당/카페 구성 및 장소별 라벨

- `cafeCount = stops.filter(s => matgilCategoryKeys.includes('cafe')).length`, `restaurantCount = Math.max(0, stops.length - cafeCount)`(courseBuilder의 `calcCafeBonus`와 동일 판정 기준).
- 장소별 라벨: `matgilCategoryKeys[0]`이 있고 `'other'`가 아니면 `getCategoryLabel`, 아니면 `firstMenu`, 둘 다 없으면 기존 키 `courseDetail.restaurantFallback` 재사용(새 fallback 키 없음).
- 장소명: `getLocalizedStopName(stop, locale)`(`courseDisplay.js`의 기존 export 함수) 재사용 — 새 locale 조건문 없음.

### 7.5 신규 번역 키

`courseCard.restaurantCount`/`cafeCount`/`viewDetails`(en/ko/zh-CN). **TODAY'S PICK 배지는 새 키를 만들지 않고 기존 `courseDetail.label`("★ Today's pick" 등, `TodayCourseDetail.jsx` 헤더와 동일 문구)을 재사용**.

### 7.6 다른 호출부(SavedRoutesTab.jsx) 관련 고지

`CourseCard`는 Courses 탭의 `SavedRoutesTab.jsx`에서도 재사용된다. 이 경로는 저장된 course snapshot의 stop을 `getLocalizedStopName`/`getCategoryLabel` 재조회 없이 그대로 넘기는 기존 구조라, 저장 당시 locale로 굳어진 장소명이 표시될 가능성이 이론상 있음(기존에 이미 존재하던 데이터 특성, `courseDisplay.js`의 `mergeSavedStopWithLocalizedPlace` 주석에 문서화됨). 이번 작업 범위는 Map 탭 목록으로 한정해 `SavedRoutesTab.jsx`는 손대지 않았다.

---

## 8. CourseCard.jsx — 가독성·간격 미세 조정

- **텍스트 색상 4단계**(새 색상 발명 없이 기존 `ink`/`ink-soft`/`ink-faint`에 opacity만 적용): 제목 `text-ink`→`text-ink/90`, 장소명 `text-ink`→`text-ink/75`(제목보다 연하고 `ink-soft`보다는 진함), 메타 `text-ink-soft`·음식종류 `text-ink-faint`는 이미 적절한 순서라 무변경.
- **divider 추가**: 메타 정보와 경로 영역 사이에 `border-t border-ink/5`(`TodayCourseDetail.jsx`가 이미 쓰는 것과 동일한 "아주 연한 구분선" 컨벤션 재사용) + 위아래 `mt-3.5`.
- **스톱을 하나의 세로 묶음으로**: 장소명 박스에 걸려 있던 `min-h-[2.25rem]`(2줄 강제 예약)을 제거 — 1줄짜리 짧은 이름 뒤에 생기던 "가짜 여백"의 근본 원인이었음. 배지→이름 간격 `mt-1`(4px)→`mt-2`(8px, 정확히 2배), 이름→음식종류 간격 `mt-0.5`(2px)→`mt-1`(4px)로 조정(체감상 더 크게 준 것은 min-h 제거 효과).
- 장소명 `leading-tight`→`leading-snug`로 2줄일 때 덜 촘촘하게. `line-clamp-2`는 Tailwind 내장 기능 그대로 사용(플러그인/패키지 추가 없음).

---

## 9. CourseCard.jsx — 카드 그림자 축소

카드 wrapper 3곳(`button`/`div`/`Link`)의 `shadow-card`(`tailwind.config.js` 정의: `0 4px 14px rgba(38,26,17,0.10), 0 12px 30px rgba(38,26,17,0.08)`)를 `shadow-[0_4px_14px_rgba(38,26,17,0.06),0_12px_30px_rgba(38,26,17,0.048)]`로 교체 — offset·blur는 그대로 두고 alpha만 정확히 60%로 스케일(0.10→0.06, 0.08→0.048). `tailwind.config.js`의 공용 `shadow-card` 정의 자체와 다른 화면(`NearbySheet.jsx`/`Modal.jsx`/`ReviewCard.jsx`)의 `shadow-card` 사용은 무변경.

---

## 10. 변경 파일 종합

| 파일 | 비고 |
|---|---|
| `src/features/auth/components/LoginForm.jsx` | 서비스 소개 문구 + 스타일 조정 |
| `src/features/explore/components/FilterSheet.jsx` | 별점 영역 하단 여백 대칭화 |
| `src/features/courses/components/CourseCard.jsx` | 이미지 제거 + 압축형 개편 + 가독성 조정 + 그림자 축소(3단계 누적) |
| `src/features/explore/components/NearbySheet.jsx` | `isTodayPick` 계산·전달 |
| `src/shared/i18n/dictionary.js` | `login.serviceDescription`, `courseCard.restaurantCount/cafeCount/viewDetails`(전체 en/ko/zh-CN) |

`TodayCourseDetail.jsx`, `PlaceDetailSheet.jsx`, `courseBuilder.js`, `Thumbnail.jsx`, `tailwind.config.js`, DB/Supabase, `authRedirect.js`/`useAuthPrompt.jsx`/`shareUtils.js`(로그인·공유 관련) — 이번 작업 전체에서 전혀 수정하지 않았다.

---

## 11. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 매 단계 성공, 최종 210 modules. 기존 CSS 압축 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 매 단계 통과(CRLF 안내만 존재) |
| `Thumbnail`/`<img>` 잔존 검색 | `CourseCard.jsx`에서 완전히 제거 확인 |
| 패키지 설치 여부 | 없음(`package.json` 무변경) |

### 미검증(승인된 한계)

이 환경에는 브라우저 자동화 도구가 없어, 아래는 코드/CSS 스펙 근거로만 판단했고 실제 렌더링은 확인하지 못했다.

- 로그인 화면 소개 문구의 실제 줄바꿈·간격·색상 체감
- 필터 시트 상하 여백의 실제 시각적 대칭
- `CourseCard`의 압축 경로 레이아웃(모바일 폭에서의 가독성, 2줄 장소명 처리), 색상 위계, divider 은은함, 그림자 강도 체감

---

## 12. git 상태 (이 문서 커밋 직전 기준)

- current branch: `main`
- HEAD(커밋 전): `969c375`(docs/54와 함께 커밋)
- 이 문서 작성 시점까지 `git add`/`commit`/`push` 없음
- 워킹 디렉터리에는 이번 작업과 **무관한** 기존 미커밋 변경(일본어 준비 중 안내 관련 4개 파일 + 신규 `JapaneseComingSoonModal.jsx`)이 함께 있었으며, 이번 커밋에는 포함하지 않는다.

---

## 13. 후속 과제

- §11의 미검증 항목 전체에 대한 실기기 확인
- `SavedRoutesTab.jsx`에서 `CourseCard`의 새 장소명 표시가 저장 당시 locale로 고정되어 보일 수 있는 기존 한계(§7.6) — 필요 시 `getLocalizedStopName`/현재-locale 재조회 파이프라인을 `SavedRoutesTab.jsx`에도 적용하는 별도 작업 검토
