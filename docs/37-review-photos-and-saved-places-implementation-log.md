# review photos and saved places implementation log

- 작성 일시: 2026-07-12 22:51 KST
- 범위: `docs/36-PLACE-DETAIL-BOOKMARK-REVIEW-IMPLEMENTATION-LOG.md` 작성 시점 이후부터 이 문서 작성 시점까지 진행한 모든 작업
- 성격: 작업 기록(work log). 새로운 설계·분석이 아니라 그동안 실제로 수행한 작업을 순서대로 정리한 문서

---

## 1. 작업 순서 요약

1. 리뷰 사진 업로드·표시·삭제 프론트 연동 (`place-review-images` 버킷·`mg_place_review_images` 테이블은 사용자가 사전에 생성 완료한 상태에서 프론트만 연결)
2. 리뷰 카드 UI 2건 소규모 수정 (사진을 본문보다 위로 이동, 별점 배지 색상을 테마 포인트 컬러로 통일)
3. Courses 화면을 Saved Routes / Saved Places 두 탭 구조로 개편
4. 이 작업 기록 문서 작성

이번 라운드 전체에서 새 DB 객체·SQL 실행은 없었다. 모두 이미 존재하는 테이블/버킷/RLS를 프론트에서 연결하는 작업이었다.

---

## 2. 리뷰 사진 업로드·표시·삭제

### 2.1 전제 조건 (사용자가 사전에 완료)

- `mg_place_review_images` 테이블 생성 완료 (컬럼: `review_id`, `storage_path`, `sort_order`, 리뷰당 최대 3장 트리거)
- `place-review-images` Storage 버킷 생성 완료 (public, 경로 규칙 `{user_id}/{review_id}/{uuid}.{ext}`)

### 2.2 수정 파일

- `src/features/places/services/placeReviewService.js`: `mg_place_review_images` join select에 `id` 컬럼 추가(기존엔 `storage_path`/`sort_order`만 조회해 개별 이미지 식별이 불가능했음), `normalizeReview`가 이미지를 URL 배열이 아니라 `{ id, storagePath, sortOrder, url }` 객체 배열로 반환하도록 변경. `validateReviewImageFile`(MIME/5MB 검증), `uploadReviewImages`(Storage 업로드 → `mg_place_review_images` INSERT, 실패 시 직전 업로드분 정리), `deleteReviewImage`(Storage 삭제 성공 후에만 DB row 삭제) 추가
- `src/features/places/components/ReviewComposer.jsx`: 사진 선택(JPEG/PNG/WebP, 장당 5MB, 최대 3장) + object URL 미리보기 + 개별 제거 UI 추가. 리뷰 row 생성/수정 후 `review.id`를 받아 순서대로 업로드하는 흐름 구현. 수정 모드에서는 기존 사진을 함께 표시하고, 기존 사진 삭제는 저장 버튼과 무관하게 클릭 즉시 Storage→DB 순으로 삭제
- `src/features/places/components/ReviewCard.jsx`: `review.images`가 URL 배열이 아니라 객체 배열로 바뀐 것에 맞춰 1/2/3장 그리드 렌더링 추가, 이미지 로드 실패 시 해당 이미지만 숨김 처리
- `src/pages/PlaceReviewsPage.jsx`, `src/features/explore/components/PlaceDetailSheet.jsx`: 수정 모드 `ReviewComposer`에 `initialImages` 전달, 사진 일부 업로드 실패 시 "리뷰는 저장됐지만 일부 사진 업로드에 실패했습니다" 배너를 5초간 표시
- `src/shared/i18n/dictionary.js`: 사진 추가/최대 장수/형식·용량 오류/업로드 중/부분 실패/삭제 실패 관련 EN/KO 키 추가

### 2.3 구현된 기능

- 사진은 선택 사항, 최대 3장, 순서 유지, 각 미리보기 개별 제거, 3장 도달 시 추가 선택 차단
- DB에는 public URL이 아니라 `storage_path`만 저장, 표시 시점에 `getPublicUrl`로 변환
- Storage 업로드 실패 시 이후 업로드 중단(먼저 성공한 사진은 유지), Storage 성공 후 DB INSERT 실패 시 방금 올린 Storage 파일 정리
- 저장 중 버튼·파일 입력·사진 제거 버튼 모두 비활성화(중복 제출 방지)
- 기존 사진 삭제는 Storage 삭제 성공 후에만 DB row 삭제(순서 고정, 고아 파일 방지)
- 가게 상세 Reviews 섹션·전체 리뷰 페이지 양쪽 `ReviewCard`에 동일하게 사진 표시(공용 컴포넌트라 한 번의 수정으로 반영)
- 사진 확대 뷰어는 새 컴포넌트를 만들지 않고 커뮤니티 기능의 기존 `ImageViewerModal`을 그대로 재사용

### 2.4 검증

- `npm run build` 성공, `git diff --check` 통과
- 이 라운드에서도 git add/commit/push는 진행하지 않음(요청 시에만 수행)

---

## 3. 리뷰 카드 UI 소규모 수정 2건

`src/features/places/components/ReviewCard.jsx`만 수정.

- **표시 순서 변경**: "작성자 정보 → 리뷰 본문 → 사진" 순서였던 것을 "작성자 정보 → 사진 → 리뷰 본문" 순서로 변경. 두 블록 모두 독립적으로 조건부 렌더링되므로 사진만 있는 리뷰, 본문만 있는 리뷰, 둘 다 없는 리뷰 모두 불필요한 빈 영역 없이 정상 표시된다. 가게 상세·전체 리뷰 페이지 양쪽에 공용 컴포넌트 수정 한 번으로 반영됨
- **별점 배지 색상 통일**: 배지의 별 아이콘·숫자 텍스트 색상을 `text-coral-deep`(진한 코랄, 임의로 더 어두운 톤)에서 `text-coral`(맛길 테마의 실제 primary 포인트 컬러, `tailwind.config.js`에 정의된 기존 토큰)로 변경. 배경(`bg-coral-tint`)과 다른 버튼/에러 색상, 상단 평균 점수 영역은 변경하지 않음

검증: `npm run build` 성공, `git diff --check` 통과.

---

## 4. Courses 화면 Saved Routes / Saved Places 개편

하단 내비게이션 이름은 "Courses" 그대로 유지하고, 화면 내부를 "Saved Routes"(저장한 코스) / "Saved Places"(저장한 가게) 두 탭으로 분리했다.

### 4.1 신규 파일

| 파일 | 역할 |
|---|---|
| `src/features/courses/components/SavedRoutesTab.jsx` | 기존 저장 코스 목록(기존 `CoursesPage.jsx` 로직을 그대로 옮김) |
| `src/features/courses/components/SavedPlacesTab.jsx` | 저장한 가게 목록 — 조회/삭제/로딩/오류/빈 상태 관리 |
| `src/features/places/components/SavedPlaceCard.jsx` | 저장한 가게 카드 (썸네일·이름·카테고리·거리·리뷰 통계·해제용 하트) |

### 4.2 수정 파일

- `src/pages/CoursesPage.jsx`: 기존 저장 코스 목록 렌더링 로직을 모두 걷어내고, 로그인 안내 + 탭 셸(Saved Routes/Saved Places 전환)만 담당하도록 재작성. 두 탭 콘텐츠를 항상 마운트해두고 `hidden` 클래스로만 전환해 탭을 오갈 때 재조회가 일어나지 않게 함
- `src/api/placeApi.js`: 기존 비공개 `normalizePlace` 함수를 export로 전환(새 파일에 정규화 로직을 복제하지 않기 위함), 여러 `place_id`를 한 번에 조회하는 `getPlacesByIds(ids, locale)` 추가(`.in('id', ids)` 단일 쿼리, N+1 방지)
- `src/features/places/services/placeBookmarkService.js`: `fetchSavedPlaces({ userId, locale })` 추가 — `mg_place_bookmarks`를 최신순으로 조회한 뒤 `getPlacesByIds`로 일괄 조회해 병합, 서울시청 기준 거리(`distanceKm`)를 함께 계산해 붙임
- `src/features/places/services/placeReviewService.js`: `fetchPlaceReviewStatsBatch(placeIds)` 추가 — `mg_place_review_stats`를 `.in('place_id', ids)`로 한 번에 조회(리뷰 통계 N+1 방지), 리뷰 0건인 장소는 view에 행이 없으므로 결과 Map에서 자연스럽게 빠짐
- `src/features/explore/components/NearbySheet.jsx`: 특정 장소로 바로 진입하는 기존 `initialPlaceId` 로직이 추천 코스(`courses`) 목록 안에서만 대상을 찾던 것을, `initialCourse`(전달받은 단일 장소용 합성 코스)도 함께 검색하도록 확장. 추천 코스 목록에 해당 장소가 없거나 아직 로딩 전이어도 항상 정확한 장소 상세가 열리도록 하기 위함
- `src/shared/i18n/dictionary.js`: `courses` 네임스페이스에 탭 라벨(`tabRoutes`/`tabPlaces`) 추가, `savedCourses.empty`/`emptyHint` 문구를 새 지정 문구로 교체, `savedPlaces` 네임스페이스 신설(빈 상태·조회 실패·해제 실패·재시도 문구), `placeDetail.noReviewsYet` 추가

### 4.3 구현된 기능

- Saved Routes 탭: 기존 저장 코스 조회/카드/상세 이동/삭제 기능을 그대로 유지(로직 재구현 없이 파일만 이동)
- Saved Places 탭: `mg_place_bookmarks` 기준 저장한 가게를 최신순으로 표시, 대표 이미지·이름(현재 locale, en fallback)·카테고리·거리·리뷰 평균/개수(0건이면 "아직 리뷰가 없어요") 표시
- 카드 하트 클릭 시 낙관적 삭제(즉시 목록에서 제거) 후 실패하면 원래 위치로 복원 + 5초 배너, 카드 클릭과 하트 클릭 이벤트 충돌 없음(`stopPropagation`)
- 카드 클릭 시 클릭한 장소 하나만 담은 합성 "단일 스톱 코스"를 만들어, 저장 코스 상세의 "지도에서 보기"가 쓰는 것과 동일한 라우터 state 채널로 Map 화면에 전달 → 해당 장소의 상세 바텀시트가 곧바로 열림(서울시청 기본 화면만 뜨고 사라지는 문제 없이 항상 정확한 장소가 열리도록 `NearbySheet` 검색 범위 확장으로 보장)
- 비로그인 시 기존 Courses 로그인 안내 UI를 그대로 재사용, 로그인 상태에서는 페이지 재진입마다 두 탭 모두 최신 데이터로 새로 조회되어 방금 추가한 북마크가 즉시 반영됨

### 4.4 이번 범위에서 제외한 후속 작업

- 북마크 폴더/컬렉션, 저장한 가게 직접 정렬·드래그 재정렬, 메모, 공유 기능
- Saved Places 지도 일괄 표시
- 프로필 사진, 사용자 공개 프로필, 도움돼요, AI 리뷰 번역, 관리자 화면

### 4.5 검증

- `npm run build` 성공, `git diff --check` 통과
- 이 라운드에서도 git add/commit/push는 진행하지 않음(요청 시에만 수행)

---

## 5. 빌드 및 검증 상태 종합

- 이번 문서에 기록된 3개 작업(리뷰 사진, 리뷰 카드 UI, Courses 개편) 모두 각 단계마다 `npm run build`와 `git diff --check`를 통과한 상태로 남겨두었다
- 실제 브라우저 동작(사진 업로드·확대 보기, 별점 배지 색상, Saved Places 탭에서 가게 상세로 이동)은 사용자가 직접 확인이 필요한 상태로 남아 있다
- 이 문서 작성 직후 git add/commit/push를 진행한다(사용자 요청에 따름)
