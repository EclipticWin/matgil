# Place Detail, Bookmark and Review Implementation Log

- 작성 일시: 2026-07-12 20:59 KST
- 범위: `docs/35-PLACE-DETAIL-BOOKMARK-REVIEW-DB-DESIGN.md` 작성 이후부터 이 문서 작성 시점까지 진행한 모든 작업
- 성격: 작업 기록(work log). 새로운 설계·분석이 아니라 그동안 실제로 수행한 작업을 순서대로 정리한 문서

---

## 1. 작업 순서 요약

1. DB 설계 문서(docs/35) + 사용자 실행용 SQL 문서 작성 (이전 단계, 이 로그의 시작점)
2. 리뷰 soft delete·리뷰 이미지 INSERT 관련 보안 수정 (기존 SQL/설계 문서 직접 수정)
3. 사용자가 Supabase에서 신규 DB 객체를 직접 생성·검증 완료
4. 가게 상세 화면 1차 실제 구현 (섹션 탭, 북마크, 리뷰 미리보기, 전체 리뷰 페이지)
5. 버그 수정 및 UX 개선 1차 (로그인 모달, 리뷰 작성 폼, 리뷰 페이지 1차 리디자인)
6. 버그 수정 및 UX 개선 2차 (탭 활성화 버그 근본 수정, 버튼 크기, 페이지 상단 정렬, 뒤로가기 상태 복원, 리뷰 작성 컴포넌트 구조 정리)
7. Git 커밋 및 원격 저장소 push
8. 이 작업 기록 문서 작성

---

## 2. 보안 수정 (docs/35, sql 문서 직접 수정)

기존에 작성해 둔 `docs/sql-place-detail-bookmark-review-2026-07-12.md`와 `docs/35-PLACE-DETAIL-BOOKMARK-REVIEW-DB-DESIGN.md`에서 두 가지 보안 취약점을 수정했다.

- **리뷰 soft delete**: `mg_place_reviews`의 `deleted_at`/`deleted_by` 컬럼을 일반 UPDATE grant에서 제외하고, 전용 함수 `soft_delete_my_place_review(bigint)`를 통해서만 삭제가 가능하도록 변경. 이 함수는 `auth.uid()` 기준으로 본인 소유 리뷰만 삭제할 수 있고, 임의 시각 지정·타인 UUID 지정·삭제 복구(다시 null로 되돌리기)를 모두 차단한다. 일반 UPDATE grant는 `rating`, `content` 두 컬럼만 허용하도록 축소했다.
- **리뷰 이미지 INSERT**: `mg_place_review_images`에 대한 authenticated INSERT 권한을 테이블 전체가 아니라 `review_id`, `storage_path`, `sort_order` 컬럼 단위로만 허용하도록 축소했다.

이 수정 내용을 실제 실행 SQL, 실행 후 검증 SQL, rollback SQL에도 모두 반영했다.

## 3. Supabase DB 실제 적용 (사용자 실행)

사용자가 Supabase SQL Editor에서 위 설계에 따른 SQL을 직접 실행하여 다음 객체를 생성·검증 완료했다.

- `mg_place_detail_sections`
- `mg_place_detail_section_translations`
- `mg_place_bookmarks`
- `mg_place_reviews`
- `mg_place_review_images`
- `mg_place_review_stats` (view)
- `soft_delete_my_place_review(bigint)` (RPC)
- `sync_my_author_name()` (RPC)
- `place-review-images` Storage 버킷

AI 에이전트는 이 단계에서 SQL을 직접 실행하지 않았다.

## 4. 가게 상세 화면 1차 실제 구현

### 4.1 신규 파일

| 파일 | 역할 |
|---|---|
| `src/api/placeDetailSectionApi.js` | 상세 섹션 메타데이터 + 번역 조회 |
| `src/features/places/data/placeDetailSectionFallback.js` | DB 실패 시 정적 fallback (4섹션 EN/KO) |
| `src/features/places/hooks/usePlaceDetailSections.js` | 모듈 캐시 기반 훅 (DB 우선, fallback, 0행 방어) |
| `src/features/places/services/placeBookmarkService.js` | 개별 가게 북마크 조회/추가/삭제 |
| `src/features/places/services/placeReviewService.js` | 리뷰 통계·목록(cursor pagination)·본인 리뷰 조회·작성·별점 분포 |
| `src/features/places/components/PlaceLocationMap.jsx` | Kakao 미니 지도 (provider 독립, 최소 책임) |
| `src/features/places/components/ReviewCard.jsx` | 리뷰 카드 (시트 미리보기·전체 페이지 공용) |
| `src/features/places/components/ReviewComposer.jsx` | 리뷰 작성 폼 (별점 필수, 내용 선택, 1,000자 제한) |
| `src/features/places/components/AuthRequiredModal.jsx` | 공용 로그인 필요 모달 (북마크·리뷰 작성 공용) |
| `src/features/explore/data/lastPlaceView.js` | 리뷰 페이지 왕복 후 지도 상태 복원용 세션 스토어 |
| `src/pages/PlaceReviewsPage.jsx` | 전체 리뷰 페이지 (`/places/:placeId/reviews`) |

### 4.2 수정 파일

- `src/features/explore/components/PlaceDetailSheet.jsx`: 가게 이름 옆 북마크 하트, 이름 하단 평균 별점 요약, Menu/Reviews/Location/Visit Info 4개 섹션 탭(가로 스크롤 + 세로 콘텐츠 + 스크롤 스파이), 기존 Menu·Visit Info 데이터는 그대로 재사용
- `src/features/explore/components/NearbySheet.jsx`: 리뷰 페이지에서 돌아왔을 때 특정 장소를 자동으로 다시 여는 로직 추가
- `src/pages/HomePage.jsx`: 마운트 시 지도 상태 복원 로직 추가
- `src/api/placeApi.js`: `getPlaceById(id, locale)` 추가 (딥링크 시 장소명 조회용)
- `src/app/router.jsx`, `src/shared/constants/routes.js`: `/places/:placeId/reviews` 라우트 추가
- `src/shared/i18n/dictionary.js`: 북마크·리뷰 관련 EN/KO 문구 추가

### 4.3 구현된 기능

- 활성 섹션은 DB의 `is_active`/`sort_order`/번역을 따르고, 데이터 유무와 무관하게 항상 표시(빈 상태는 DB의 empty_title/empty_description 사용)
- 개별 가게 북마크: 로그인 사용자만 저장/해제, 낙관적 업데이트 + 실패 시 원복, 비로그인 시 로그인 모달
- Reviews 섹션: 평균 별점 + 리뷰 수, 최신 리뷰 최대 2개, "모든 리뷰 보기"/"리뷰 작성하기" 진입점(리뷰 0건이어도 항상 노출)
- 전체 리뷰 페이지: 평균 별점, 별점 분포(5→1, 전체 rating 컬럼만 조회하는 최소 쿼리로 계산, 새 DB 객체 없음), 5개 단위 cursor pagination(`created_at desc, id desc`), 비로그인 조회 가능
- 리뷰 작성: 별점 1~5 필수, 내용 선택(최대 1,000자), 현재 앱 locale을 `ui_locale`에 저장, 중복 리뷰 사전 확인 + DB 유니크 오류 발생 시 자연스러운 문구로 변환

## 5. 버그 수정 및 UX 개선 1차

- 비로그인 시 인라인 배너 대신 `AuthRequiredModal`(중앙 모달, 기존 `Modal` 컴포넌트 재사용)로 로그인 안내 통일 — 북마크·리뷰 작성 공용
- 리뷰 0건이어도 "Write a review" 버튼 노출, 클릭 시 로그인 여부에 따라 모달 또는 전체 리뷰 페이지(작성 모드)로 이동
- `ReviewComposer` 최초 구현 및 `PlaceReviewsPage`에 연결(작성 성공 시 목록 최상단 반영 + 통계 재조회)
- 전체 리뷰 페이지에 평균 별점 큰 표시 + 별점 분포 막대 + "N개 기준" 문구 추가
- `placeId` route param을 정수로 검증, 잘못된 값이면 조회 없이 안내 화면 표시

## 6. 버그 수정 및 UX 개선 2차

- **탭 활성화 버그 근본 수정**: 바텀시트가 최상단 높이일 때 마지막 섹션(Visit Info 등)을 클릭하면 콘텐츠가 짧아 스크롤이 기준선까지 도달하지 못해 활성 탭이 이전 섹션으로 되돌아가던 문제를, `scrollTop + clientHeight >= scrollHeight - tolerance`로 스크롤 끝 도달 여부를 실제 계산해 마지막 섹션을 강제 판정하는 방식으로 수정
- 상세 시트의 리뷰 버튼을 큰 CTA에서 작은 pill 버튼으로 축소, 전체 리뷰 페이지의 버튼은 시트보다는 크되 과도한 full-width는 제거
- 전체 리뷰 페이지 상단 여백을 색상 배너용 값(`3.625rem`)에서 `max(0.75rem, env(safe-area-inset-top))`로 교체해 화면 최상단부터 시작하도록 수정, 가게명은 `truncate` 대신 `line-clamp-2`로 최대 2줄 허용
- **뒤로가기 상태 복원**: 가게 상세 → 리뷰 페이지 → 뒤로가기 시 서울시청 기본 화면으로 초기화되던 문제를, 별도 라우트 이동으로 Map 화면 전체가 언마운트되는 구조를 확인한 뒤 세션 스코프 모듈 스토어(`lastPlaceView.js`)를 도입해 해결. 리뷰 페이지 이동 직전 선택 위치·장소 id를 기록하고, Map 화면 재마운트 시 1회 소비해 위치를 복원하고 해당 장소의 상세 시트를 자동으로 다시 연다. 브라우저 뒤로가기와 화면 내 버튼 모두 동일하게 동작
- `ReviewComposer`를 별점/텍스트/액션 영역으로 명확히 분리하고, 향후 가격대·웨이팅·혼잡도 등 정보성 항목이 들어갈 자리를 주석으로 표시(이번 범위에서는 미구현)
- 본인이 이미 리뷰를 작성한 경우 전체 리뷰 페이지에서 큰 작성 버튼 대신 안내 문구만 표시

## 7. Git 커밋 및 push

- 커밋: `264d005` "feat: 가게 상세 섹션 탭·개별 북마크·리뷰 1차 구현" (21개 파일, +2864/-31)
- 원격 저장소 `origin/main`에 push 완료 (`f8efc72..264d005`)
- 커밋 전 `.env` 등 민감 파일이 포함되지 않았는지 확인

## 8. 이번 범위에서 제외한 후속 작업

- 리뷰 사진 업로드 (`place-review-images` 버킷은 생성되어 있으나 프론트 연동 미구현)
- 리뷰 수정, 리뷰 삭제(`soft_delete_my_place_review` RPC 프론트 연동)
- 리뷰 가격대·웨이팅·혼잡도 등 정보성 선택 항목
- 도움돼요, AI 리뷰 번역
- `sync_my_author_name()` RPC의 프론트 연동 (닉네임 변경 시 리뷰 author_name 즉시 동기화)
- Courses 화면 내부 Saved Routes / Saved Places 개편
- 관리자 화면(상세 섹션 라벨·순서·노출 관리)

## 9. 빌드 및 검증 상태

- 각 단계마다 `npm run build` 성공을 확인했다(최종 185 모듈, 기존에도 있던 CSS 구문 경고·chunk 크기 경고 외 신규 오류 없음)
- `git diff --check` 통과
- 실제 브라우저 동작(탭 전환, 북마크, 리뷰 작성, 뒤로가기 복원, EN/KO)은 사용자가 직접 확인이 필요한 상태로 남아 있다

---

## 10. 리뷰 UI 개편 및 상세 탭 버그 3차 수정

- 작성 일시: 2026-07-12 (이 문서 최초 작성 이후 진행)

### 10.1 신규 파일

| 파일 | 역할 |
|---|---|
| `src/features/places/components/DeleteReviewConfirmModal.jsx` | 리뷰 삭제 전 확인 모달 (공용 `Modal` 재사용, 실패 시 인라인 오류 문구) |

### 10.2 수정 파일

- `src/features/places/components/ReviewCard.jsx`: 5개 별 반복 표시를 숫자 배지(`RatingBadge`, 별 아이콘 + 정수 별점)로 전면 교체. `isOwn`/`onEdit`/`onDelete` prop을 받아 본인 리뷰에만 점 3개(케밥) 메뉴를 노출, 메뉴는 카드 컴포넌트 내부에서 열림/닫힘·바깥 클릭·Esc 닫힘을 자체 처리하고, 다른 카드가 메뉴를 열면 `window` `CustomEvent`(`matgil:review-card-close-menus`)로 서로 자동으로 닫히도록 연결
- `src/features/places/components/ReviewComposer.jsx`: `reviewId`/`initialRating`/`initialContent`를 받으면 수정 모드로 동작하도록 확장(`isEdit = reviewId != null`), 제출 버튼 라벨을 작성/수정에 따라 분리, 오류 유형을 `rating`/`duplicate`/`updateFailed`/`generic`으로 구분
- `src/features/places/services/placeReviewService.js`: `fetchMyPlaceReview`, `updatePlaceReview`(rating·content 컬럼만 UPDATE), `deletePlaceReview`(`soft_delete_my_place_review` RPC 호출) 추가
- `src/shared/components/Icon.jsx`: 점 3개 케밥 아이콘 `MoreIcon` 추가
- `src/shared/i18n/dictionary.js`: 리뷰 수정/삭제/오류 관련 EN/KO 키 다수 추가 (수정/삭제 라벨은 기존 `community.edit`/`community.delete` 재사용)
- `src/features/explore/components/PlaceDetailSheet.jsx`, `src/pages/PlaceReviewsPage.jsx`: 본인 리뷰 카드에 `isOwn`/`onEdit`/`onDelete` 연결, 수정 클릭 시 해당 카드가 `ReviewCard` 대신 `ReviewComposer`(수정 모드)로 교체, 삭제 클릭 시 `DeleteReviewConfirmModal` 오픈 → 확인 시 RPC 호출 후 목록·통계 갱신. "이미 리뷰를 작성했습니다" 안내 배너 제거
- 탭 활성화 버그 2차 수정: 클릭 직후 스크롤이 짧은 콘텐츠 때문에 기준선까지 도달하지 못해 활성 탭이 되돌아가는 문제에 대해, 클릭한 탭 key를 `clickTargetRef`에 잠시 기록해 두고 바닥 도달 강제 판정이 "클릭한 섹션과 다른" 섹션으로는 되돌리지 않도록 조건을 추가(그러나 이 보정도 이후 사용자가 다시 문제를 재현해 4차 수정으로 이어짐 — 11장 참고)

### 10.3 구현된 기능

- 리뷰 별점을 5개 별 반복 대신 숫자 배지 하나로 표시(평균/분포에는 여전히 별 아이콘 사용)
- 본인 리뷰에 한해 점 3개 메뉴로 수정/삭제 가능, 수정은 인라인으로 같은 위치에서 폼으로 전환, 삭제는 확인 모달 후 soft delete
- 중복 리뷰 DB 오류(23505) 처리는 안전장치로 유지
- 사진, 가격대, 웨이팅, 혼잡도, 관리자 기능 등은 이번 범위에서 제외

## 11. 잔존 버그 2건 최종 수정 (4차)

- 작성 일시: 2026-07-12 (10장 완료 보고 이후, 사용자가 두 가지 버그 재현을 보고하여 진행)
- 배경: 10장 작업 완료 보고 이후 사용자가 (1) 이미 활성 리뷰가 있는 로그인 사용자에게도 "Write a review" 버튼이 가게 상세·전체 리뷰 페이지 양쪽에서 계속 보이는 문제, (2) `clickTargetRef` + 바닥 도달 강제 활성화 + 타임아웃 보정이 서로 계속 충돌해 탭 활성화 버그가 여전히 재현되는 문제를 보고했다. 새 문서·SQL 작성 없이 코드만 직접 수정하라는 지시에 따라 진행했다.

### 11.1 수정 파일

- `src/features/explore/components/PlaceDetailSheet.jsx`
- `src/pages/PlaceReviewsPage.jsx`

### 11.2 버그 1 — Write a review 버튼 노출

- 원인: `PlaceDetailSheet.jsx`는 로그인 사용자의 기존 리뷰 여부를 전혀 조회하지 않아 버튼이 항상 렌더링됐고, `PlaceReviewsPage.jsx`는 딥링크(`openWrite`)로 `showComposer`가 true인 채 진입하면 `myReview`가 있어도 그 데이터로 프리필된 폼을 자동으로 열어(사실상 수정 모드 자동 진입) "수정은 점 3개 메뉴로만" 원칙을 어기고 있었다.
- 수정: 두 화면 모두 `fetchMyPlaceReview` 기반 `myReview`/`myReviewLoading` 상태를 도입, 조회가 끝나기 전에는 버튼도 폼도 그리지 않는다. `myReview`가 있으면 두 화면의 Write 버튼을 모두 숨기고, `PlaceReviewsPage`는 `showComposer && !myReview`일 때만 신규 작성 폼을 열도록 변경해 딥링크로 들어와도 `myReview`가 있으면 어떤 폼도 열지 않는다. 리뷰 수정/삭제 성공 시 `myReview`를 갱신/`null`로 되돌려 버튼이 정확한 시점에 나타나고 사라지도록 연결했다. 중복 리뷰 DB 오류(23505) 처리는 안전장치로 그대로 유지했다.

### 11.3 버그 2 — 가게 상세 탭 활성화

- 원인: `clickTargetRef`(클릭 대상 기억) + 바닥 도달 강제 활성화 + 고정 타임아웃 기반 "보정" 로직 세 가지가 겹치면서, 클릭 직후 자동 scroll-spy 재계산이 클릭 결과를 다른 탭으로 되돌리는 경우가 남아 있었다.
- 수정: 위 세 메커니즘을 모두 제거하고 `suppressScrollSpyRef` 불리언 하나로 단순화했다. 탭 클릭 시 `activeTab`을 즉시 설정하고 자동 scroll-spy를 완전히 억제한 뒤, 네이티브 `scrollend` 이벤트(지원 시) 또는 스크롤 이벤트마다 재시작되는 디바운스(150ms) 백업으로 실제 스크롤 종료를 감지한다. 스크롤 종료가 감지되면 억제만 해제하고 활성 탭을 재계산하지 않아 클릭한 탭이 그대로 유지되며, 이후 사용자가 직접 스크롤을 이어갈 때만 자동 scroll-spy가 다시 활성 탭을 갱신한다. `computeActiveSectionKey`는 순수 threshold 기반(기준선보다 위에 있는 섹션 중 가장 아래쪽) 계산만 남기고 바닥 도달 강제 로직은 완전히 삭제했다.

### 11.4 검증

- `npm run build` 성공(기존에도 있던 CSS 압축 관련 경고 외 신규 오류 없음)
- `git diff --check` 통과
- 이번 라운드에서도 git add/commit/push는 진행하지 않음(요청 시에만 수행)
