# Food Category DB Migration and Frontend Integration Summary

## 작업 정보

- 작업 일시: 2026-07-11 16:37:22 KST
- 작업 범위: 음식 카테고리 DB 전환을 위한 SQL 문서 작성, 프론트엔드 연동, 정적 대체 데이터, 코스 제목·저장 중복 로직 정리, 빌드 검증
- DB 실행 주체: 사용자

## 작업 결과

음식 카테고리와 언어별 표시값을 DB에서 조회할 수 있도록 API와 전역 공급자를 구현했다. DB 테이블이 없거나 일시적으로 조회할 수 없는 경우에도 기존 필터와 장소 상세 화면이 정상 작동하도록 18개 카테고리의 정적 대체 데이터를 유지했다.

`bbq`의 한국어 표시값은 활성 사용자 기능에서 `한국식 BBQ`가 아닌 `고기 구이`로 변경했다. 영어 `Korean BBQ`와 코스 제목 `Korean BBQ Route`는 유지했다.

신규 추천 코스와 저장 코스의 제목 생성은 공용 함수 하나를 사용하도록 통합했다. 저장 코스 중복 판정은 제목 문자열이 아닌 순서가 같은 `place_ids`를 기준으로 하도록 변경했다.

## 새로 작성한 파일

- `src/api/foodCategoryApi.js`: 카테고리와 번역 전체 조회 및 응답 정규화
- `src/features/explore/data/foodCategoryFallback.js`: 18개 EN/KO 정적 대체 데이터
- `src/features/explore/context/FoodCategoryProvider.jsx`: DB 조회, 대체 전환, label·icon 조회, 정렬·필터링, 오류 상태 공유
- `docs/sql-food-categories-2026-07-11.md`: 사용자가 직접 실행할 DDL, RLS, 권한, seed, 검증, 되돌리기 SQL
- `docs/29-food-category-db-integration-result.md`: 구현 결과와 검증 내용

## 수정한 파일

- `src/app/providers.jsx`: `LocaleProvider` 안에 음식 카테고리 공급자 연결
- `src/features/explore/data/exploreOptions.js`: 정적 음식 카테고리 목록 제거, key 기반 필터 로직 유지
- `src/features/explore/components/FilterSheet.jsx`: DB 기반 필터 카테고리와 가상 `all` 옵션 사용
- `src/features/explore/components/PlaceDetailSheet.jsx`: 대표 카테고리와 칩에 DB/대체 라벨 적용
- `src/features/explore/components/CategoryIcon.jsx`: DB `icon_key` 지원, 미등록 아이콘의 기본 아이콘 처리
- `src/features/explore/data/courseBuilder.js`: 중복 제목 템플릿 제거 및 공용 제목 함수 사용
- `src/features/courses/utils/courseDisplay.js`: 코스 제목의 단일 소스 유지, `고기 구이 동선` 반영
- `src/features/courses/services/savedCourseService.js`: 순서가 같은 `place_ids` 기준 저장 중복 판정
- `src/features/explore/components/NearbySheet.jsx`: 변경된 중복 판정 함수 인자 적용
- `src/shared/i18n/dictionary.js`: `filter.all` EN/KO 문구 추가 및 미사용 코스 제목 번역 중복 제거

## DB 적용 전·후 동작

DB 적용 전에는 정적 대체 데이터로 필터와 장소 상세 화면이 정상 작동한다. 조회 실패 오류는 숨기지 않고 공급자의 `error`에 보존하며, 데이터 출처는 `fallback`으로 표시된다.

사용자가 SQL을 적용한 후에는 DB의 번역, 정렬 순서, 활성 상태, 필터 노출 여부, 아이콘 key가 화면에 반영된다. 비활성 카테고리는 필터에서 제외되지만 기존 장소와 저장 코스의 key는 계속 label로 해석할 수 있다.

## 검증 결과

- `npm run build` 성공
- Vite 5.4.21에서 174개 모듈 변환 완료
- 활성 `src` 코드의 `한국식 BBQ` 검색 결과 없음
- FilterSheet와 PlaceDetailSheet의 정적 `CATEGORIES` 사용 없음
- `KO_TITLES`, `EN_TITLES`, `makeTitle`, `courseTitle` 검색 결과 없음
- `checkCourseAlreadySaved`와 호출부가 course/​`place_ids` 기준으로 일치
- Community, Phrases, 레거시 mock, `mg-tour-seed` 변경 없음
- 빌드에 기존 CSS 구문 경고와 큰 chunk 경고가 남았지만 빌드 실패는 없음

## 제외 및 준수 사항

- Supabase SQL을 직접 실행하지 않음
- DB 데이터, RLS, 기존 장소, `mg_places.matgil_category_keys`를 변경하지 않음
- `mg-tour-seed` 자동 분류 규칙을 수정하거나 배포하지 않음
- 관리자 기능, 장소 재분류, `mg_place_food_categories`, 패키지 추가를 수행하지 않음
- Community, Phrases, 레거시 mock 카테고리를 음식 카테고리와 혼합하지 않음
- `git add`, `git commit`, `git push`를 실행하지 않음

## 사용자 후속 작업

1. `docs/sql-food-categories-2026-07-11.md`의 실행 전 확인 SQL을 Supabase SQL Editor에서 실행한다.
2. 테이블, `set_updated_at()` 함수, 실사용 key 결과가 문서와 일치하는지 확인한다.
3. DDL, RLS, 권한, seed transaction을 직접 실행한다.
4. 실행 후 검증 SQL로 18개 카테고리, 36개 번역, 누락 key 0개, `bbq / ko / 고기 구이`를 확인한다.
5. 앱을 재로드하고 EN/KO 필터, 장소 상세, 코스 제목, 저장 중복 차단을 수동 테스트한다.
