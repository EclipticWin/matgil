# 음식 카테고리 DB 전환 프론트엔드 구현 결과

- 작업일: 2026-07-11
- SQL은 문서로만 작성했고 DB에 실행하지 않았다.
- `mg_places.matgil_category_keys`, 기존 장소, `mg-tour-seed`, Community/Phrases/mock 카테고리는 변경하지 않았다.

## 구현

- 카테고리/번역 전체 조회 API와 정규화 shape 추가
- 18개 EN/KO 정적 fallback 추가 (`bbq` KO: `고기 구이`)
- Provider/Context로 DB/fallback source, error, reload, label/icon helper 공유
- FilterSheet와 PlaceDetailSheet의 정적 `CATEGORIES` 의존 제거
- DB `icon_key` registry 연결, 미지 icon은 `default`, `all`은 기존 전체 아이콘 유지
- 신규/저장 코스 제목을 `courseDisplay.js` 함수로 단일화
- KO `고기 구이 동선`, EN `Korean BBQ Route` 유지
- 저장 중복 판정을 순서가 같은 `place_ids` 기준으로 통일

## 동작

DB 테이블이 없거나 조회가 실패하면 Provider는 fallback을 계속 제공하고 `source='fallback'`, `error`를 보존한다. SQL 적용 후 재로드하면 DB 라벨·정렬·활성·필터 여부·icon key가 반영된다.

## 수동 테스트

- SQL 전: EN/KO 필터, 장소 상세 chip, 추천/저장 코스
- SQL 후: DB source 전환, sort_order, 비활성 필터 제외, 비활성 기존 key label 표시
- 동일 place_ids 저장 차단과 순서가 다른 코스 저장 허용

## 검증 결과

- `npm run build`: 성공 (Vite 5.4.21, 174 modules transformed)
- 기존 CSS 구문 경고 1건과 500 kB 초과 chunk 경고가 남았으나 build 실패는 아님
- `한국식 BBQ`, `KO_TITLES`, `EN_TITLES`, `makeTitle`, `courseTitle`: `src` 결과 없음
- `FilterSheet`, `PlaceDetailSheet`: 정적 `CATEGORIES` import 없음
- `checkCourseAlreadySaved`: `course` 인자와 순서 일치 `place_ids` 비교로 호출부 일치
