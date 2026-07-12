# Place Detail, Bookmark and Review Research

- 작성 일시: 2026-07-12 17:48 KST
- 기준 코드: main @ f8efc72 (작업 트리 클린)
- 성격: **조사·분석·설계 후보 문서** — 코드 수정 없음, SQL 실행 없음. 실행용 최종 SQL은 후속 설계 문서에서 작성한다.
- 준수 규칙: `ai-docs/25-current-implementation-rules.md`. 실제 Supabase 확인이 필요한 항목은 `미확인`으로 표기했다.

---

## 1. 사용자 요구사항 확정본

1. **가게 상세 확장**: 가게 이름 우측에 개별 저장 하트, 이름 하단에 평균 별점+리뷰 수. 기존 대표 이미지·대표 메뉴·거리·주소·설명 유지. 설명 아래에 **가로 스크롤 섹션 탭**(Menu / Reviews / Location / Visit Info) — 탭 바만 좌우 스크롤, **콘텐츠는 세로 연속 배치**(캐러셀 아님). 탭 클릭 시 해당 섹션으로 부드러운 세로 이동, 세로 스크롤 시 활성 탭 자동 갱신.
2. **Menu/Visit Info는 기존 DB 데이터 재사용** — 새 음식 메뉴 테이블을 만들지 않는다. 새로 DB화하는 것은 "섹션 정의·번역·빈 상태 문구"라는 **화면 구성 메타데이터**다.
3. **개별 가게 북마크**: 로그인 사용자 저장/해제, 비로그인 로그인 유도, 코스 저장과 별도 구조, 동일 가게 중복 저장 불가. 하단 탭명 `Courses` 유지, 내부를 Saved Routes(저장한 동선) / Saved Places(저장한 가게)로 분리 — 내부 탭은 dictionary 기반, 관리자 DB 관리 대상 아님.
4. **리뷰**: 로그인 작성·비로그인 열람, **1인 1가게 1리뷰(DB 제약으로도 보장)**, 별점 1~5 정수, 내용, 작성 locale 저장, 본인 수정·삭제, 수정 시 `Edited`/`수정됨` 표시, 0건 시 DB 번역 기반 빈 상태 문구, 기존 리뷰 있으면 `Edit my review`, 평균 별점·리뷰 수 상단 표시(0건이면 `No reviews yet` 계열).
5. **리뷰 사진**: 리뷰당 최대 3장(우선), jpg/png/webp, 본인만 업로드·삭제, 고아 파일 방지, 표시 순서, storage path DB 저장.
6. **관리자(후속)**: 섹션 label·순서·노출·아이콘·빈 상태 문구 관리. 기능형 section key(menu/reviews/location/visit_info)는 rename 불허, 삭제보다 비활성화.
7. **locale**: EN/KO 현행 + 추가 locale 대비. `label_en/label_ko/label_ja` 식 컬럼 금지, locale row 번역 테이블 우선.
8. **지도**: 이번 단계에서 Google Maps 전환 없음. Location 섹션은 Kakao 미니 지도 재사용 + provider 독립형 추상화 검토.

## 2. 현재 PlaceDetailSheet 구조

`src/features/explore/components/PlaceDetailSheet.jsx` (188줄):

- **순수 표시 컴포넌트** — props `{ place, selectedLocation, onBack }`만 받고 **자체 데이터 조회가 전혀 없다**. 확장 시 데이터 훅(리뷰·북마크·섹션 설정)을 어디에 둘지가 첫 구조 결정이다.
- 렌더 컨테이너: `NearbySheet.jsx:333-341` — 드래그 바텀시트(높이 가변, height transition) 내부의 `min-h-0 flex-1 overflow-hidden` 래퍼에 마운트. 코스 상세(TodayCourseDetail)에서 정류지 탭 → `openPlace`로 진입, `onBack` → `closePlace`.
- 내부 스크롤: 헤더(뒤로가기, 84-93행)는 고정, 본문은 `no-scrollbar flex-1 overflow-y-auto`(96행) — **탭 스크롤 스파이는 이 컨테이너 기준**으로 구현해야 한다.
- 현재 세로 구성: 식당명(98-102) → 히어로 이미지(Thumbnail, 104-111) → subtitle/거리/주소/설명(113-137) → **Menu 섹션(139-150, 데이터 없으면 미렌더)** → **Visit Info 섹션(152-166, 동일)** → 카테고리 칩(168-182).
- 제스처 주의: NearbySheet가 pointer capture(323-327행)로 시트 드래그·스크롤 우선순위를 처리 중 — 새 가로 탭 바가 이 로직과 충돌하지 않는지 확인 필요(기존 bottom sheet UX 작업의 클릭 세이프 임계값·스크롤 우선 로직이 적용돼 있음).
- 알려진 결함: 64-65행 `'가능'` 한국어 하드코딩(EN 모드 노출 — docs/31 Low), 177행 미지 카테고리 key raw 노출.

## 3. 기존 Menu 데이터 출처

| 화면 표기 | place 객체 필드 | DB 원본 | 근거 |
|---|---|---|---|
| Menu > Main | `place.firstMenu` | **`mg_place_texts.first_menu`** (locale 행) | placeApi.js:35, PlaceDetailSheet.jsx:146 |
| Menu > Serves | `place.treatMenu` | **`mg_place_texts.treat_menu`** (locale 행) | placeApi.js:36, PlaceDetailSheet.jsx:147 |

- 섹션 자체는 `place.firstMenu || place.treatMenu`가 있을 때만 렌더(140행). subtitle에도 firstMenu가 재사용된다(54행).
- **결론: Menu는 이미 DB 데이터다. 새 테이블·이전·재구성 불필요.** 탭 구조로 바뀌어도 데이터 경로는 그대로 재사용한다.

## 4. 기존 Visit Info 데이터 출처

| 화면 표기 | place 객체 필드 | DB 원본 | 근거 |
|---|---|---|---|
| Hours | `place.openTime` | `mg_place_texts.open_time` (locale 행) | placeApi.js:37, Sheet:159 |
| Rest day | `place.restDate` | `mg_place_texts.rest_date` (locale 행) | placeApi.js:38, Sheet:160 |
| Phone | `place.tel` | `mg_place_food_details.tel` (locale 무관) | placeApi.js:43, Sheet:161 |
| Parking | `place.parking` 또는 `hasParking→'가능'` | `mg_place_texts.parking` + `mg_place_food_details.has_parking` | placeApi.js:39,44, Sheet:64,162 |
| Takeout | `place.packing` 또는 `hasPacking→'가능'` | `mg_place_texts.packing` + `mg_place_food_details.has_packing` | placeApi.js:40,45, Sheet:65,163 |

- 섹션은 위 5개 중 하나라도 있으면 렌더(67-73행). **결론: Visit Info도 전부 기존 DB 값 재사용.**

## 5. 현재 locale·영문 번역 데이터 흐름

- 조회: `getPlaces(locale)`(placeApi.js:55-76) — `mg_places` + `mg_place_texts`/`mg_place_food_details`/`mg_place_images` 임베드, `is_active=true` 전량.
- 정규화(normalizePlace, 3-53행): 요청 locale의 texts 행 우선 → **반대 locale 행 폴백**(7-11행) → `nameKo`는 locale 무관 항상 보존(15행, Kakao 앵커 매칭용).
- EN 데이터 생산: ① `mg-tour-en-enrich`(TourAPI EN, translation_status='source') ② `mg-place-translate-en`(LLM 번역, status='machine'). first_menu/treat_menu/open_time/rest_date/parking/packing 모두 번역 대상 필드에 포함(mg-place-translate-en의 KoTextRow와 동일 구조).
- 시사점: **상세 섹션 번역 테이블도 동일한 locale-행 패턴**((key, locale) PK)을 따르는 것이 기존 데이터 흐름과 정합적이다.

## 6. 현재 장소 DB 구조 (코드로 확인된 범위)

- `mg_places`: id(PK — **타입 미확인**, 코드에서 `Number()` 변환·`place_ids bigint[]`(ai-docs/21) 정황상 bigint 추정), latitude, longitude, default_image_url, matgil_category_keys text[], is_active. 그 외 컬럼은 docs/31 §6·ai-docs/03 참조.
- `mg_place_texts`: place_id, locale, name, address, description, first_menu, treat_menu, open_time, rest_date, parking, packing, tags, translation_status — **unique(place_id, locale)**(enrich upsert onConflict로 확인).
- `mg_place_food_details`: tel, has_parking, has_packing, has_open_time, has_menu_info, has_image, has_location (placeApi.js:66).
- `mg_place_images`: image_url, thumbnail_url, sort_order (placeApi.js:67).
- **RLS: 장소 4테이블의 정책 원문이 리포에 없음(미확인)** — 신규 FK를 걸기 전 확인 필요(§22).

## 7. 현재 Auth·닉네임 구조

- `useAuth.jsx` normalizeUser(6-13행): `{ id(auth uuid), email, name: user_metadata.display_name || email 앞부분 || 'Traveller' }`. **별도 profiles 테이블 없음**(ai-docs/20의 "mg_profiles 생성 금지" 정책 유지 중 — docs/22:1383의 mg_profiles 언급은 실존 여부 미확인).
- Community 작성자 표시: `author_name` 컬럼에 **클라이언트가 지정한 snapshot 저장**(communityService.js createPost) + 닉네임 변경 시 best-effort 백필(useAuth.jsx:64-74, 실패 무시).
- **리뷰 재사용 가능성과 위험**: 같은 패턴(작성 시 author_name snapshot + 변경 시 백필)을 리뷰에 재사용할 수 있고 구현 비용이 가장 낮다. 단 이 패턴은 **사칭 가능(클라이언트 임의 지정, docs/31 ISSUE-04)**이라는 알려진 결함을 공유하게 된다. 권장: 스키마는 author_name snapshot으로 두되, `docs/2026-07-11-PLAN-auth-edge-security.md`의 `enforce_author_name` 트리거(서버측 덮어쓰기)를 리뷰 테이블에도 함께 적용하는 것을 설계 전제로 명시. 닉네임 변경 시 과거 리뷰 표시는 커뮤니티와 동일하게 백필로 갱신(일관성).

## 8. 현재 Community Storage 구조

- 버킷: `community-post-images` 1개(public, 5MB, image/* — docs/22 §9.1). **미확인: 실제 버킷 설정·정책**(§22 J).
- 업로드(communityService.js:36-62): 최대 3장·5MB·`image/*` 클라이언트 검증, 경로 `{userId}/{YYYYMMDDHHmmss}-{uuid}.{ext}`(원본 파일명 미포함), `upsert:false`, **public URL을 만들어 게시글 row의 `image_urls` jsonb 배열에 직접 저장**.
- 삭제: **없음** — 게시글은 soft delete, 이미지는 의도적으로 미삭제(docs/22:486-491 "storage.remove() 금지") → 고아 파일 누적은 Community에도 이미 존재하는 알려진 상태(docs/31 Low).
- 정책(docs/22:467-484, 문서 기준): public SELECT + authenticated 본인 폴더(`(storage.foldername(name))[1] = auth.uid()::text`) INSERT만. **DELETE 정책 부재.**
- URL 저장의 교훈: 전체 URL 저장 때문에 `normalizeCommunityImageUrls`(65-80행) 같은 방어 코드가 필요해졌다 — 리뷰 이미지는 **storage path 저장**이 더 안전하다(§14).

## 9. 현재 Courses 구조

- `CoursesPage.jsx`: PageShell + PageHeader(35-39행) → 상태 4분기(비로그인 EmptyState / 로딩 Spinner / 0건 EmptyState / 목록). 데이터는 `useSavedCourses` 훅, 카드 = CourseCard(adaptedCourse로 변환, 76-102행) + 날짜/삭제 행.
- **Saved Routes / Saved Places 탭 삽입 위치**: PageHeader 직후(39행 뒤)가 자연스럽다. 기존 상태 4분기를 "Routes 탭 콘텐츠"로 감싸고, Places 탭은 별도 상태(비로그인/로딩/0건/목록)를 갖는 구조. 탭 상태는 CoursesPage 로컬 useState('routes'|'places')로 충분 — URL `/courses` 유지 가능(쿼리스트링·서브라우트 불필요, 원하면 `?tab=` 확장 여지).
- 상태 분리: `useSavedCourses`(코스)와 신규 `useSavedPlaces`(가게) 훅을 분리하면 기존 코드 무변경에 가깝다. Community의 CommunityTabs(알약형 탭) 컴포넌트가 시각 패턴 재사용 후보.
- **재사용 가능한 가게 카드: 없음** — CourseCard는 코스 단위, NearbySheet 정류지 행은 인라인 마크업, PopularPlaceCard는 레거시(사용 금지). 신규 `SavedPlaceCard` 필요(Thumbnail + 이름 + 카테고리 라벨 + 별점(후속) 구성).
- **저장한 가게 → 상세 연결**: PlaceDetailSheet가 순수 표시 컴포넌트이므로 Map 탭 밖에서도 재사용 가능. 후보 ① CoursesPage에서 `Modal variant="sheet" fullHeight`(HomePage.jsx:258의 FilterSheet 패턴)로 PlaceDetailSheet를 열기 — **권장**. `selectedLocation` 없이 열면 거리 행은 자동 숨김(distRaw null → 60-62행 조건부). ② Map 탭으로 이동 후 열기 — 컨텍스트 전환이 커서 비권장. 데이터는 북마크 row의 place_id → 신규 `getPlaceById(placeId, locale)`(placeApi에 단건 조회 추가) 또는 목록 조회 시 places 임베드.

## 10. 현재 Kakao Maps 구조

- 로더: `loadKakaoMapSdk.js` — 모듈 캐시 프로미스, `autoload=false` + services 라이브러리, no-key/sdk-load-failed 구분. **미니 지도에서 그대로 재사용 가능**(추가 로드 없음 — 이미 로드됐으면 즉시 resolve).
- `KakaoMap.jsx`: 메인 지도 전용으로 결합돼 있음 — dragend 리스너(82-84행), mapApiRef.getCenter 노출(71-79행), 기준 위치 파란 마커(Effect 2), 코스 번호 마커+폴리라인+setBounds(Effect 3). **미니 지도로 직접 재사용은 부적합** — 필요한 것은 "좌표 1개 + 마커 1개 + 중심 고정"뿐이다.
- **`PlaceLocationMap` 신규 추출 권장**: props `{ latitude, longitude, className }`(provider 중립) — 내부에서 loadKakaoMapSdk → `new kakao.maps.Map` → CustomOverlay 마커 1개. KakaoMap.jsx의 마커 생성 코드(makeMarkerContent 계열)와 폴백 UI(185-202행) 패턴을 참고하되 파일은 분리(메인 지도 코드 무변경).
- **relayout 필요성: 있음.** Kakao 지도는 init 시점 컨테이너 크기를 측정한다. 상세 시트는 ① 높이가 드래그로 변하고(NearbySheet height transition) ② Location 섹션이 초기 화면 밖(스크롤 하단)에 있다. 대응: (a) 섹션이 뷰포트에 들어올 때 lazy 마운트(IntersectionObserver — NearbySheet 점진 로딩에 이미 같은 패턴 존재) + (b) ResizeObserver로 컨테이너 크기 변화 시 `map.relayout()` + `setCenter` 재호출. KakaoMap.jsx:189-193의 "로딩 중에도 DOM 유지" 기법도 동일 적용.
- 좌표: `place.latitude/longitude`(mg_places 원본). 코스 마커도 같은 필드 사용(KakaoMap.jsx:134-142) — 좌표 없는 장소는 지도 대신 주소만 표시하는 폴백 필요(§18 UX 상태).

## 11. 새 상세 섹션 DB 후보

음식 카테고리 선례(mg_food_categories + translations, `docs/sql-food-categories-2026-07-11.md`)를 참고하되 도메인 차이를 반영한 설계 후보:

**`mg_place_detail_sections`**
| 컬럼 | 타입 후보 | 비고 |
|---|---|---|
| section_key | text PK, check `^[a-z0-9_]+$` | 고정 기능 key: `menu`, `reviews`, `location`, `visit_info`. **rename 불허**(코드 렌더러와 1:1 연결) |
| icon_key | text not null default 'default' | CategoryIcon과 동일한 registry 연결 방식 — SVG/코드를 DB에 저장하지 않음 |
| sort_order | integer not null | |
| is_active | boolean not null | 비활성 = 탭·콘텐츠 미노출 |
| is_required | boolean not null default false | "관리자도 비활성화 불가" 표시용(예: location은 항상 노출 정책이면 true). 정책 미정이면 전부 false로 시작해도 무방 |
| created_at / updated_at / created_by / updated_by / deleted_at / deleted_by | 카테고리 테이블과 동일 감사 컬럼 | set_updated_at 트리거 재사용 |

- `section_type` 컬럼: 현재 4개 전부 기능형(코드 연결)이라 **이번에는 생략 권장**(YAGNI) — 향후 자유 콘텐츠형 섹션이 생기면 컬럼 추가는 하위 호환 변경이다. 대안으로 `default 'builtin'`으로 지금 넣는 안도 무해.
- `deleted_at`: 기능형 key는 완전 삭제 대신 **비활성화(is_active=false)** 운용 권장(§17). deleted_at은 감사 컬럼으로 유지하되 실제 삭제 플로우는 만들지 않음.

**`mg_place_detail_section_translations`**
| 컬럼 | 타입 후보 | 비고 |
|---|---|---|
| section_key | text FK → sections(section_key) on delete restrict | |
| locale | text, check btrim ≠ '' | (section_key, locale) 복합 PK |
| label | text not null | 탭 표시명 |
| empty_title | text null | 빈 상태 제목 (reviews: "No reviews yet" 계열) |
| empty_description | text null | 빈 상태 설명 |
| description | text null | 관리자 메모용 — 필수 아님, 생략 가능 |
| created_at / updated_at / created_by / updated_by | | |

- RLS/grant: 카테고리 선례 그대로 — RLS 활성 + anon/authenticated **SELECT 정책만**(`using (true)` — 비활성 행도 조회 가능해야 과거 스냅샷/설정 화면 해석 가능), grant select만 + insert/update/delete revoke. **관리자 쓰기 정책은 유보**(is_admin() 기반 — PLAN-admin-foundation 선행).
- seed: 4행 + EN/KO 번역 8행. reviews의 empty_title/empty_description은 EN "No reviews yet"/"Be the first to share…" 계열, KO "아직 리뷰가 없어요"/"첫 리뷰를 남겨보세요" 계열(문구는 구현 시 확정).
- UX 결정 필요: 현재 Menu/Visit Info는 데이터 없으면 섹션 자체를 숨긴다(Sheet:140,153). 탭 도입 후에는 **탭이 있는데 클릭 시 도착지가 없는 상황을 피해야 하므로, 활성 섹션은 항상 렌더하고 데이터 없으면 empty 문구 표시**를 권장(번역 테이블의 empty_* 가 menu/visit_info에도 쓰임). 대안(데이터 없는 섹션은 탭에서도 제외)도 가능 — 장소마다 탭 구성이 달라지는 단점.

## 12. 가게 북마크 DB 후보

**`mg_place_bookmarks`**
| 컬럼 | 타입 후보 | 비고 |
|---|---|---|
| user_id | uuid not null, FK → auth.users(id) on delete cascade | |
| place_id | (mg_places.id 타입 — **미확인**, bigint 추정) not null, FK → mg_places(id) | |
| created_at | timestamptz not null default now() | |

- **PK: 복합 (user_id, place_id) 권장.** surrogate id 대안과 비교 — 이 테이블을 다른 테이블이 참조할 계획이 없고, 토글(저장/해제) 의미상 복합 PK가 중복 저장 불가 요구를 PK 자체로 보장한다. 선례인 `mg_phrase_bookmarks`(unique(phrase_id,user_id), hard delete — phraseBookmarkService.js:12-26)와 동일한 운용.
- **soft delete 불필요** — 내용이 없는 토글 데이터. 해제 = hard delete(선례 동일).
- RLS 방향: SELECT **본인만**(`user_id = auth.uid()` — 북마크는 사적 데이터, 공개할 이유 없음), INSERT with check 본인, DELETE using 본인. anon 접근 없음.
- 후속 확장: 가게별 북마크 수 표시가 필요해지면 `mg_places` 집계 컬럼 + 트리거(phrases bookmark_count 선례) — 이번 범위 아님.

## 13. 리뷰 DB 후보

**`mg_place_reviews`**
| 컬럼 | 타입 후보 | 비고 |
|---|---|---|
| id | bigint generated always as identity PK | |
| place_id | (mg_places.id 타입) not null FK | |
| user_id | uuid not null FK → auth.users | |
| rating | smallint not null check (rating between 1 and 5) | 정수만 |
| content | text not null check (btrim ≠ '' and char_length(content) <= 2000) | 길이 상한은 구현 시 확정 |
| locale | text not null | 작성 locale snapshot |
| author_name | text not null | 닉네임 snapshot — §7의 사칭 위험 공유. **enforce_author_name 트리거 병행 적용 권장** |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | set_updated_at 트리거 |
| edited_at | timestamptz null | **Edited 판정 기준(권장)** — 아래 비교 |
| deleted_at / deleted_by | timestamptz / uuid null | soft delete |

**Edited 판정 방식 비교:**
| 방식 | 장점 | 단점 | 판정 |
|---|---|---|---|
| `updated_at > created_at` | 컬럼 추가 없음 | 시스템성 UPDATE(백필·모더레이션·마이그레이션)에도 "수정됨"으로 오탐. set_updated_at 트리거가 모든 UPDATE에 반응 | 비권장 |
| **`edited_at nullable`** | 사용자 콘텐츠 수정 시에만 앱이 명시 세팅 — 의미가 정확, null 여부로 즉시 판정, 최근 수정 시각도 표시 가능 | 앱이 세팅을 누락하면 미표시(트리거로 보강 가능: content/rating 변경 시 자동 세팅) | **권장** |
| `edit_count` | 수정 횟수 표시 가능 | 현재 요구("수정됨" 뱃지)에 과잉, 로직 추가 | 확장 필요 시 후일 추가 |

**1인 1리뷰 × soft delete 충돌 해결:**
- 단순 `unique(place_id, user_id)`는 soft delete된 행이 남아 재작성을 막는다.
- **권장: 부분 유니크 인덱스** — `create unique index ... on mg_place_reviews(place_id, user_id) where deleted_at is null`. 삭제 후 재작성은 **새 insert**(이력 보존, 모더레이션 추적 유리). upsert가 필요하면 `on conflict (place_id, user_id) where deleted_at is null` 형태로 부분 인덱스 타게팅 가능.
- 대안(삭제 행 복구/재활용): 이력이 사라지고 "삭제했는데 과거 내용이 돌아오는" UX 혼란 여지 — 비권장.

**RLS 방향:** SELECT는 anon+authenticated 공개(`deleted_at is null` 조건 포함 — 삭제 리뷰 비노출), INSERT with check `user_id = auth.uid()`, UPDATE using/with check 본인(내용 수정 + soft delete 겸용), hard DELETE 정책 없음. 컬럼 grant는 커뮤니티 카운트 교훈(docs/31 ISSUE-03)을 반영해 **rating, content, locale, updated_at, edited_at, deleted_at, deleted_by, author_name만 UPDATE 허용** 검토. 관리자 moderation(숨김·사유)은 후속 — is_hidden 컬럼 추가는 하위 호환 변경.

## 14. 리뷰 이미지 DB 후보

**저장 방식 비교:**
| 방식 | 장점 | 단점 |
|---|---|---|
| 리뷰 row에 URL 배열(jsonb) — 커뮤니티 방식 | 단순, 조인 없음, 선례 존재 | 개별 삭제·교체·순서 관리가 배열 조작, **고아 파일 추적 불가**(커뮤니티의 현재 문제), URL 저장이라 버킷 변경에 취약(normalizeCommunityImageUrls 같은 방어 코드 필요해짐), 이미지 단위 모더레이션 불가 |
| **별도 테이블 `mg_place_review_images`** | **storage_path 인벤토리 확보 → 고아 정리 배치 가능**, 개별 삭제/교체/정렬, 이미지 모더레이션 확장, FK 무결성 | 조인 1회 추가, 테이블 1개 추가 |

**권장: 별도 테이블 + storage_path 저장**(public URL이 아닌 path — URL은 표시 시점에 getPublicUrl로 파생). 요구사항의 "교체 시 고아 파일 방지"는 path 인벤토리 없이는 달성이 어렵다.

| 컬럼 | 타입 후보 |
|---|---|
| id | bigint identity PK |
| review_id | bigint not null FK → mg_place_reviews(id) on delete restrict |
| storage_path | text not null |
| sort_order | smallint not null default 0 |
| created_at | timestamptz not null default now() |

- deleted_at: 이미지 삭제는 **DB row hard delete + Storage 파일 remove(베스트 에포트)** 권장 — 이미지는 이력 보존 가치가 낮고, soft delete면 고아 관리가 복잡해진다. (리뷰 soft delete 시 이미지는 row 유지 + 비노출, 후속 정리 배치에서 함께 처리 — 구현 시 확정.)
- width/height: 레이아웃 시프트 방지용으로 유용하나 필수 아님 — 이번 범위 생략 가능.
- **최대 3장 DB 보장**: check 제약은 행 간 검증 불가 → ① 앱 검증(커뮤니티 선례) + ② insert 트리거(리뷰당 count ≥ 3이면 예외) 병행 권장. 트리거 없이 시작해도 실해는 낮음(RLS로 본인 것만 가능).
- **Storage↔DB 트랜잭션 한계**: 원자성이 없다. 권장 순서 — 업로드 성공 → DB insert, insert 실패 시 업로드분 remove(베스트 에포트); 삭제는 DB 먼저 → Storage remove(실패해도 path 인벤토리가 남아 배치 정리 가능).
- **버킷: 신규 `place-review-images` 권장.** 커뮤니티 버킷 재사용 대안과 비교 — 재사용은 버킷·정책 신설이 없다는 장점뿐이고, ① 커뮤니티는 **의도적으로 DELETE 정책이 없는데** 리뷰는 본인 삭제가 필요해 공용 버킷에 DELETE 정책을 추가하면 커뮤니티의 삭제 금지 정책까지 바뀌는 부작용, ② 도메인 혼합으로 수명주기·정리 배치가 복잡해지는 단점이 크다. 신규 버킷 정책은 커뮤니티 패턴 재사용: public SELECT + 본인 폴더(`(storage.foldername(name))[1] = auth.uid()::text`) INSERT + **본인 폴더 DELETE 추가**. 경로 규칙도 동일하게 `{userId}/{ts}-{uuid}.{ext}`(정책 표현식 재사용).
- 파일 검증: jpg/png/webp 화이트리스트(커뮤니티의 imageExt는 gif/heic도 허용 — 리뷰는 요구대로 3종 제한), 5MB 상한 재사용.

## 15. 평균 별점 집계 방식 비교

| 방식 | 장점 | 단점 | 적합 시점 |
|---|---|---|---|
| 매 요청 집계(리뷰 테이블 avg/count) | 항상 정확, 구조물 없음 | PostgREST 집계 함수는 기본 비활성일 수 있음(**미확인**) — supabase-js에서 avg를 직접 못 부르면 전체 rating을 받아 클라 계산(리뷰 수 커지면 낭비) | 초기 검증용 |
| **SQL view (`mg_place_review_stats`)** | `select * from view where place_id=` 한 줄, deleted 제외 로직 집중, 구조 단순 | view의 RLS 통과 방식 주의(security_invoker 설정 — **미확인**; 리뷰가 공개 SELECT라 실위험 낮음) | **1단계 권장** (상세 화면 단건) |
| RPC 함수 | 집계 설정 무관 확실 동작 | 프로젝트 최초 RPC 도입(현재 .rpc() 사용 0건) — 패턴 추가 비용 | view 불가 시 대안 |
| materialized view | 조회 최속 | refresh 시점 관리 필요, 실시간성 낮음 | 부적합(규모 대비 과잉) |
| **mg_places 집계 컬럼 + 트리거** | 목록·지도 카드 등 **다건 표시에 유일하게 현실적**(장소 전량 조회에 그대로 실림), 커뮤니티 like_count 선례 | 트리거 관리 + **클라이언트 UPDATE 차단(컬럼 grant) 필수**(ISSUE-03 교훈), 기존 mg_places ALTER 필요 | **2단계** (Saved Places 목록·지도 카드에 별점 표시 시) |

**단계별 권장안:** 1단계(상세 화면 단건 표시)는 **view** — 시트 열릴 때 stats 1건 조회. 2단계(Saved Places 카드·지도 카드로 확장 시) `mg_places.rating_avg numeric / rating_count int` 트리거 동기화 추가(그 시점에 view는 폐기 또는 유지 선택). **추천 점수(courseBuilder)에는 반영하지 않음** — 요구사항 기준. 0건 표시: rating_count=0이면 "0.0"이 아니라 dictionary 기반 `No reviews yet` 계열(§19).

## 16. RLS·Storage 정책 방향 요약

| 대상 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| mg_place_detail_sections / _translations | anon+auth 공개 | 유보(관리자) | 유보(관리자) | 없음 |
| mg_place_bookmarks | 본인만 | 본인 | — | 본인(hard) |
| mg_place_reviews | 공개(미삭제만) | 본인 | 본인(수정+soft delete) | 없음 |
| mg_place_review_images | 공개(부모 리뷰 미삭제 조건 검토) | 본인 리뷰 것만(부모 review.user_id 서브쿼리) | — | 본인 것만(hard) |
| Storage `place-review-images` | public | 본인 폴더 | — | **본인 폴더(신설)** |

- 전 테이블 RLS 활성 + 필요 grant만 부여(카테고리 SQL 문서의 revoke 패턴 재사용).
- 관리자 쓰기는 전부 유보 — is_admin() 도입(PLAN-admin-foundation) 후 정책 추가.
- **전제 조건: 장소 테이블·mg_saved_courses의 기존 RLS 실태 확인(§22 A/B)** — 신규 사용자 소유 테이블 3~4개를 추가하는 작업이므로, 기존 테이블의 정책 상태를 모른 채 진행하면 안 된다.

## 17. 관리자 확장 방향

3계층으로 분리 평가:

1. **전역 상세 섹션 관리**(label 번역·순서·노출·아이콘·빈 문구) — **이번 DB 구조에 반영**(§11이 그대로 관리 대상 스키마). 관리자 화면 전까지는 사용자가 service role SQL로 변경(카테고리와 동일 운용).
2. **가게별 Menu/Visit Info 원본 수정** — **후속 분리가 맞다.** 근거: 원본이 TourAPI 수집+LLM 번역 파이프라인 산출물(mg_place_texts)이라, 관리자 override를 도입하려면 "재수집·재번역 시 override 보존" 정책(override 컬럼 vs 별도 override 테이블, translation_status='manual' 활용)이 먼저 설계돼야 한다. 이번 섹션 탭 작업과 독립적이며 서두를 이유가 없다.
3. **리뷰 moderation**(숨김·이미지 숨김·신고·사유) — **후속 분리.** is_hidden/hidden_reason 컬럼과 신고 테이블은 하위 호환 추가가 가능하므로 이번 스키마에 선반영하지 않는다(커뮤니티 신고 부재와 함께 묶어 설계하는 것이 효율적).

**기능형 key 비활성화-only 방식 평가:**
- 장점: 코드 렌더러(`menu`→PlaceMenuSection 매핑)와 key가 1:1이라 삭제 시 참조 깨짐이 원천 차단됨. 실수 복구가 토글 하나. FK(translations) 정리 불필요. 과거 데이터·화면 해석 항상 가능.
- 단점: "삭제"라는 개념이 없어 목록에 영구 잔존(관리 화면에서 비활성 그룹으로 격리하면 해소). 진짜 폐기가 필요한 미래 커스텀 섹션에는 deleted_at 병행.
- **결론: 기능형 4키는 rename 불허 + 삭제 불허 + 비활성화만 허용이 안전하다.**

## 18. 프론트 컴포넌트·service 구조 후보

### 파일 후보 (신규 — 기존 코드 이동 없음)

```
src/api/placeDetailSectionApi.js            # 섹션+번역 전량 조회(카테고리 api 패턴)
src/api/placeApi.js                         # (기존) getPlaceById 단건 조회 추가 후보 — Saved Places 상세용
src/features/places/data/placeDetailSectionFallback.js   # 4섹션 정적 fallback (EN/KO)
src/features/places/hooks/usePlaceDetailSections.js      # 모듈 캐시 + fallback 훅 (아래 Provider 논의)
src/features/places/services/placeBookmarkService.js     # phraseBookmarkService 패턴
src/features/places/services/placeReviewService.js       # CRUD + stats
src/features/places/services/placeReviewImageService.js  # 업로드/삭제 (communityService 업로드 패턴 이식)
src/features/places/hooks/useSavedPlaces.js              # Courses 탭용
src/features/places/components/PlaceDetailSectionTabs.jsx
src/features/places/components/PlaceReviewsSection.jsx
src/features/places/components/PlaceLocationMap.jsx      # provider 독립 props { latitude, longitude }
src/features/places/components/SavedPlaceCard.jsx
```
- 새 도메인 폴더 `features/places/`가 적절 — 상세 확장이 explore(지도 탭)와 courses 양쪽에서 쓰이므로 explore에 넣으면 결합이 늘어난다. 기존 PlaceDetailSheet는 explore에 그대로 두고(이번 작업에서 이동 금지), 신규 섹션 컴포넌트만 places에 둔 뒤 Sheet가 import하는 구성. (Sheet 자체의 이사는 후속 정리 때 선택.)

### 섹션 설정 로드 전략 — Provider 필요성 검토
| 후보 | 평가 |
|---|---|
| 전역 Provider (FoodCategoryProvider 패턴, 앱 시작 로드) | 선례 일관성. 그러나 섹션 설정은 **PlaceDetailSheet에서만** 쓰이고, providers.jsx에는 이미 죽은 Provider 2개가 있는 상태(docs/31) — 전역 트리를 더 키울 이유가 약함 |
| **모듈 캐시 + 훅 (권장)** | `usePlaceDetailSections()`가 첫 호출 시 1회 fetch(모듈 레벨 프로미스 캐시 — loadKakaoMapSdk와 같은 기법), 이후 캐시 반환. 시트가 열릴 때만 로드되어 앱 시작 경로에 요청 추가 없음. fallback·source·error 상태는 FoodCategoryProvider와 동일 shape로 |
- 공통 설계(어느 쪽이든): **전체 locale 번역 일괄 로드**(언어 전환 시 재조회 불필요 — 카테고리와 동일), DB 실패 시 정적 fallback, **DB 성공+0행 시에도 fallback 사용 권장**(카테고리 Provider의 알려진 엣지를 반복하지 않음 — ai-docs/25 §9), 라벨 폴백 locale→en→ko→key.

### 상세 시트 데이터 로드
- 시트 열릴 때(place_id 확정 시) **병렬 조회**: ① 섹션 설정(캐시) ② 리뷰 stats ③ 본인 리뷰 존재 여부(로그인 시) ④ 북마크 상태(로그인 시) ⑤ 리뷰 목록 1페이지. Promise.all — 실패는 각자 독립 처리(전체 차단 금지).
- **PlaceDetailSheet 비대화 방지**: Sheet는 헤더(이름+하트+별점)·히어로·요약까지만 유지하고, 탭 바(PlaceDetailSectionTabs)와 섹션 4개를 자식 컴포넌트로 분리. 기존 Menu/Visit Info 마크업(139-166행)은 각각 PlaceMenuSection/PlaceVisitInfoSection으로 추출(마크업 재사용, 동작 불변).
- 탭 스크롤 스파이: 내부 스크롤 컨테이너(96행) 기준 — 섹션별 ref + IntersectionObserver(또는 onScroll + offsetTop 비교), 클릭 시 `scrollIntoView({behavior:'smooth'})`. 가로 탭 바는 `overflow-x-auto` + NearbySheet 포인터 캡처와의 간섭 테스트 필수.

### UX 상태 정의
| 기능 | 상태 | 문구 출처 |
|---|---|---|
| 섹션 설정 | loading / db / fallback / error(→fallback) / **db+0행(→fallback 권장)** | 탭 라벨·빈 상태 = **DB 번역(관리자 관리 대상)**, fallback 시 정적 데이터 |
| 북마크 | 로그인 전(하트 탭→로그인 유도 배너: PhrasesPage.jsx:113-151 패턴 재사용) / 조회 중 / 미저장 / 저장됨 / 처리 중(낙관적 업데이트+실패 롤백 — 표현 북마크 선례) / 실패(롤백+토스트) | dictionary |
| 리뷰 | 목록 loading / 0건(DB empty_title/empty_description) / 목록 / 작성 가능 / 본인 리뷰 존재(→Edit my review) / 작성·수정·삭제 중 / 실패(무음 금지 — 문구 표시) / 이미지 일부 업로드 실패(성공분 유지+실패 안내) | 빈 상태 = DB 번역, 버튼·오류 = dictionary |
| 평균 별점 | loading / 0건(`No reviews yet`) / 값 있음(예: 4.5 · 12) / 집계 실패(별점 영역 숨김 — 0.0 표기 금지) | dictionary |
| Location | 좌표 있음(미니 지도) / 좌표 없음(주소만+안내) / SDK 로딩 중 / 로드 실패(KakaoMap 폴백 패턴) / 시트 resize(relayout) | dictionary |
- **책임 구분 원칙**: 관리자가 바꿀 수 있어야 하는 문구(섹션 라벨·빈 상태)는 DB 번역, 앱 크롬(버튼·오류·로그인 유도)은 dictionary.

## 19. EN/KO 및 locale 확장 전략

- 신규 번역은 전부 **(key, locale) 행 구조**(§11 translations) — `label_en/ko/ja` 컬럼 금지(ai-docs/25 §10). 제3언어 추가 = translations에 locale 행 insert + dictionary 트리 추가뿐.
- 리뷰 content는 **사용자 데이터**(번역 대상 아님) — locale 컬럼은 작성 언어 기록·필터링용이며 커뮤니티처럼 피드를 강제 분리하지는 않음(리뷰는 가게 기준 전체 노출이 자연스러움 — 구현 시 확정할 정책으로 표기).
- `Edited`/`수정됨`, `Edit my review`, 탭 내부(Saved Routes/Saved Places), 별점 축약 표기는 dictionary 신규 키(EN/KO 대칭).
- 라벨 폴백은 카테고리와 동일: 요청 locale → en → ko → key.

## 20. Google Maps 전환 시 영향

- **이번 단계: 전환 없음.** Location 섹션은 Kakao 미니 지도.
- **provider 독립화 가능 범위**: PlaceLocationMap을 `{ latitude, longitude }` props의 중립 인터페이스로 만들면, 미래 전환 시 이 컴포넌트 내부 구현만 교체하면 된다(상세 화면 영향 최소화).
- **전환 시 실제 영향 범위(미니 지도 밖)**: ① 메인 지도 KakaoMap.jsx(CustomOverlay·Polyline·setBounds — API 전면 교체) ② SearchOverlay + kakaoPlaceSearchService(**Kakao 키워드 검색 API 의존** — Google Places API로 대체 필요, 별개 과금) ③ anchorMatchService(Kakao category_group_code CB2/FD6 하드코딩 — Google 타입 체계로 재설계) ④ loadKakaoMapSdk → Google 로더 ⑤ deploy.yml의 키 Secret 교체. 즉 지도 렌더보다 **검색·매칭 로직의 결합이 더 깊다**.
- **동시 사용(Kakao+Google)의 단점**: SDK 2개 번들·로딩 비용, 키·과금 2계통, 지도 UX(제스처·타일·줌 레벨 체계) 불일치, 로더·폴백 코드 이원화 — 미니 지도만 Google로 하는 절충안은 비권장.
- **전체 전환이 별도 프로젝트인 이유**: 위 ①~⑤ + 국내 지도 데이터 품질 차이 + 요금 구조가 프로젝트 전제를 바꿈.
- **Google Maps 가격·정책·API 제한: 외부 최신 조사 필요 항목**(이번 코드 조사로 판단 불가·미확인) — 무료 크레딧/월, Dynamic Maps·Places API 단가, 키 도메인 제한 방식 등은 전환 검토 시점에 웹 조사로 확정.

## 21. 필요한 사용자 확인 정보 (요약)

| 항목 | 영향 |
|---|---|
| A. mg_places 계열 4테이블 + mg_saved_courses의 컬럼·PK/FK 타입 | 신규 FK(place_id) 타입 확정 — bigint 추정의 검증 |
| B. 위 테이블들의 RLS 정책·grant 실태 | 신규 사용자 소유 테이블 추가의 전제(기존에 정책이 없다면 함께 보완 필요) |
| C. Storage 버킷 목록·정책 실태 | community-post-images 정책의 문서-실제 일치 확인 + 신규 버킷 설계 확정 |
| D. `set_updated_at()` 함수 존재 | 신규 테이블 트리거 재사용 가능 여부 (카테고리 SQL 실행 시 확인됐다면 생략 가능) |
| E. PostgREST 집계 활성 여부 | §15에서 view/RPC 선택에 영향 (SQL로 직접 확인 불가 — view 설계면 무관해짐) |

## 22. 읽기 전용 Supabase SQL

> 아래 쿼리는 전부 SELECT 전용이며 **데이터를 변경하지 않는다.** Supabase SQL Editor에서 실행 후 결과 표를 전달해 주시면 된다. (docs/2026-07-11-MATGIL-REQUIRED-USER-INPUTS.md의 A/B/G/J와 일부 중복 — 이미 실행하셨다면 그 결과로 갈음 가능.)

**(1) 장소·저장코스 테이블 컬럼/타입 — 왜: place_id FK 타입과 Menu/Visit Info 컬럼 실구조 확정. 예상 결과: 테이블별 컬럼 목록. 영향: FK 타입, 컬럼명 오타 방지.**
```sql
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('mg_places','mg_place_texts','mg_place_food_details','mg_place_images','mg_saved_courses')
order by table_name, ordinal_position;
```

**(2) PK/유니크/FK 제약 — 왜: mg_places PK와 mg_place_texts unique(place_id,locale) 검증. 예상: 제약 목록. 영향: 신규 FK·부분 유니크 인덱스 설계.**
```sql
select tc.table_name, tc.constraint_type, tc.constraint_name, kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('mg_places','mg_place_texts','mg_place_food_details','mg_place_images','mg_saved_courses')
order by tc.table_name, tc.constraint_type, kcu.ordinal_position;
```

**(3) 기존 RLS·grant 실태 — 왜: 신규 사용자 소유 테이블 3~4개 추가 전, 기존 테이블 정책 상태 파악(없으면 함께 보완). 예상: 테이블별 rls_enabled + 정책 행. 영향: 보완 SQL 범위.**
```sql
select c.relname, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'mg\_%' order by 1;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name like 'mg\_%' and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
```

**(4) Storage 버킷·정책 — 왜: 커뮤니티 버킷 정책의 실제 상태 확인 + 신규 리뷰 버킷 정책 초안 확정. 예상: 버킷 1행+정책 행들. 영향: 버킷 분리 결정(§14) 검증.**
```sql
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;

select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
```

**(5) set_updated_at 함수 — 왜: 신규 테이블 트리거 재사용. 예상: 1행. 영향: 없으면 함수 생성 SQL 포함 필요.**
```sql
select p.proname, p.prosecdef from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='set_updated_at';
```

**(6) 데이터 규모 참고 — 왜: 집계 방식(§15)과 페이지네이션 필요성 판단. 예상: 건수 1행.**
```sql
select
  (select count(*) from public.mg_places) as places,
  (select count(*) from public.mg_place_texts) as place_texts,
  (select count(*) from public.mg_saved_courses where deleted_at is null) as saved_courses;
```

## 23. 단계별 구현 계획

| 단계 | 내용 | 선행 조건 | 위험 | 예상 변경 범위 |
|---|---|---|---|---|
| 0 | 현행 조사 (이 문서) + §22 SQL 결과 수령 | — | — | 문서만 |
| 1 | **DB 설계 문서 작성**: sections/translations + bookmarks + reviews + review_images + RLS + 신규 버킷 정책 + seed. 실행은 사용자(카테고리 SQL 문서의 4단 구성 재사용) | §22 결과(특히 place_id 타입, RLS 실태) | RLS 실태 미확인 상태로 확정 금지 | SQL 문서 1개 |
| 2 | **상세 탭 UI**: 섹션 설정 로드(캐시+fallback), 탭 바(가로 스크롤)+세로 섹션+스크롤 스파이, 기존 Menu/Visit Info 컴포넌트 추출 재사용, Reviews 빈 상태, Location Kakao 미니 지도(relayout) | 1단계 DB 적용(fallback 덕에 미적용이어도 동작) | NearbySheet 제스처 충돌, 지도 relayout, Sheet 비대화 | PlaceDetailSheet 분해 + 신규 컴포넌트 4~5개 |
| 3 | **가게 북마크**: 상세 하트, 로그인 유도, 저장/해제(낙관적), Courses 내부 Saved Routes/Saved Places 탭 + SavedPlaceCard + 상세 열기(Modal) | 1단계(mg_place_bookmarks) | Courses 회귀(기존 코스 목록 동작 보존), getPlaceById 신설 | CoursesPage 개편 + 훅·카드 신규 |
| 4 | **리뷰·평균 별점**: 1인 1리뷰, 작성/수정/삭제, Edited 표시, stats view, 상단 평균 표시 | 1단계(reviews+view), 2단계(Reviews 섹션 자리) | author_name 사칭(트리거 병행 권장), 부분 유니크 upsert 동작 검증 | PlaceReviewsSection 실장 + service |
| 5 | **리뷰 사진**: 신규 버킷 + 업로드/삭제/교체 + 최대 3장 + 고아 대책(순서 규약) | 1단계(images 테이블+버킷 — 버킷 생성은 사용자) | Storage-DB 비원자성, 정책 오류 시 업로드 실패 | image service + 리뷰 폼 확장 |
| 6 | 관리자 기반(is_admin 등) | PLAN-admin-foundation | 별도 계획 문서 존재 | — |
| 7 | 상세 섹션 관리자 화면 | 6단계 | — | admin 라우트 |
| 8 | Menu/Visit Info 가게별 override (필요 시) | 6단계 + override 보존 정책 설계 | TourAPI 재수집과 충돌 | 별도 설계 |
| 9 | Google Maps 전환 조사·PoC | 외부 가격 조사 | §20 결합 지점 | 별도 프로젝트 |

## 24. 위험 요소와 미확인 사항

1. **기존 RLS 실태 미확인이 최대 위험** — 장소·저장코스 정책 원문이 리포에 없다. 신규 사용자 소유 테이블을 추가하는 이번 작업은 §22-(3) 결과 없이는 1단계 SQL을 확정하면 안 된다.
2. **author_name 사칭 패턴 재도입** — 커뮤니티의 알려진 결함을 리뷰가 물려받지 않도록 enforce 트리거를 설계에 포함할지 결정 필요(§7, §13).
3. **Storage-DB 비원자성** — 업로드/삭제 순서 규약 + path 인벤토리로 완화(§14). 커뮤니티처럼 URL 배열로 가면 고아 추적이 불가능해진다.
4. **NearbySheet 제스처와 탭 바 충돌** — 가로 스크롤 탭이 시트 드래그 캡처(NearbySheet.jsx:323-327)와 간섭할 수 있음. 2단계에서 실기기 확인 필수.
5. **Kakao 미니 지도 relayout** — 가변 높이 시트 내부 + 스크롤 하단 위치라 lazy init + relayout 없이는 회색 지도가 뜬다(§10).
6. **mg_places.id 타입 추정(bigint)** — FK 설계가 이 확인에 걸려 있다(§22-(1)(2)).
7. **PostgREST 집계 설정 미확인** — view 설계를 기본으로 하면 회피 가능(§15).
8. **PlaceDetailSheet 비대화** — 분해 없이 기능을 얹으면 유지보수 위험. §18 분해안 준수.
9. **Courses 회귀** — 탭 도입이 기존 저장 코스 목록·삭제 흐름을 깨지 않아야 함(기존 상태 4분기를 그대로 Routes 탭으로 이동).

## 25. 이번 조사에서 확정할 수 없는 내용

- mg_places PK·place_id FK의 실제 타입 (**미확인** — §22-(1)(2))
- 장소 4테이블·mg_saved_courses·Storage의 실제 RLS/grant/정책 (**미확인** — §22-(3)(4))
- `set_updated_at()` 존재 (**미확인** — 카테고리 SQL 실행 시 확인되었을 가능성 높음, §22-(5))
- PostgREST 집계 함수 활성 여부 (**미확인** — view 채택 시 무관)
- 리뷰 노출 정책 세부(locale 필터 여부 — §19), 섹션 빈 상태 렌더 정책(§11 UX 결정), 이미지 soft/hard delete 세부(§14) — 1단계 설계 문서에서 사용자 확인 후 확정
- Google Maps 가격·정책 (**외부 조사 필요** — 이번 범위 아님)
- 리뷰·별점 데이터 규모 전망 (운영 데이터 축적 후 재평가)
