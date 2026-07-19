# 47. mg-tour-api-chs-enrich 배치 페이지네이션 추가 및 zh-CN 전체 UI 번역/로케일 fallback 작업

- 작성일시: 2026-07-19 21:33:05

---

## 1. 목적

이번 세션에서 진행된, 서로 독립적인 두 작업을 정리한다.

1. `supabase/functions/mg-tour-api-chs-enrich/index.ts`가 SAFE_MAPPINGS 56건을 한 번에 처리하다 HTTP 546이 발생하는 문제를, 요청 body의 `startIndex`/`limit`로 배치 처리하도록 수정
2. 앱에 이미 존재하던 `zh-CN`(중문 간체) locale 선택지가 UI 문구는 전부 영어로 fallback되던 문제를, `DICTIONARY['zh-CN']` 전체 번역 및 프로젝트 전역의 하드코딩된 `locale === 'ko' ? 한국어 : 영어` 분기 수정으로 해결

이 두 작업은 서로 다른 레이어(Edge Function / 프런트엔드 i18n)의 별개 작업이며, 같은 세션에서 연속으로 수행되어 하나의 문서로 정리한다.

---

## 2. 작업 1: mg-tour-api-chs-enrich 배치 페이지네이션

### 2.1 배경

`mg-tour-api-chs-enrich`는 `docs/46`이 다루는 `mg-place-translate-zh`와 달리 LLM을 호출하지 않고, 공식 TourAPI(ChsService2)에서 이미 오프라인으로 확정된 56건의 `SAFE_MAPPINGS`를 그대로 가져와 저장하는 함수다. 그런데도 56건을 한 번의 요청에서 전부 순회하면 HTTP 546이 발생한다는 문제가 보고되었다(Edge Function 실행시간 제한으로 추정 — `docs/46` 7절이 `mg-place-translate-zh`의 `limit=50` 실행에서 관측한 것과 동일한 계열의 증상이나, 함수 자체는 서로 다르다).

### 2.2 수정 내용

- 요청 body 파라미터 추가: `startIndex`(기본 0), `limit`(기본 5, 최대 10으로 clamp)
- `SAFE_MAPPINGS` 전체를 순회하는 대신 `const selectedMappings = SAFE_MAPPINGS.slice(startIndex, startIndex + limit)`로 잘라 그 배치만 처리
- `startIndex < 0` 또는 `limit < 1`이면 400 응답
- 응답에 `totalTargetCount: 56`, `startIndex`, `limit`, `requestedCount`(`selectedMappings.length`), `nextStartIndex`(`startIndex + selectedMappings.length`), `hasMore`(`nextStartIndex < SAFE_MAPPINGS.length`) 필드 추가
- `mg_api_fetch_logs.request_params.mappingCount`를 `SAFE_MAPPINGS.length`(56 고정)가 아니라 이번 배치의 `selectedMappings.length`로 기록하도록 변경
- API 호출, 중문 표시명 추출, DB insert/upsert, 중복 매핑 방지, dryRun 로직, SAFE_MAPPINGS 56건 목록, 수동 저장 제외(place_id=460/contentId=3576599), review 21건 제외 정책은 전혀 변경하지 않음

### 2.3 테스트

이 세션에서 직접 수행한 것(실제 배포·실행은 수행하지 않음):

- **esbuild 구문 검사**: 전체 파일에 대해 `esbuild.transformSync(src, {loader:'ts', target:'es2022'})`로 문법 오류 없음 확인
- **순수 페이지네이션 로직 테스트**: `serve(async (req: Request)` 이전 부분을 esbuild로 CommonJS 변환 후 Node에서 `require()`하여 실제 56건 `SAFE_MAPPINGS` 배열을 대상으로 검증
  - `startIndex=0, limit=5` → `requestedCount=5, nextStartIndex=5, hasMore=true`
  - `startIndex=55, limit=5` → `requestedCount=1, nextStartIndex=56, hasMore=false`
  - `startIndex=56, limit=5` → `requestedCount=0, hasMore=false`
  - `startIndex=-1` / `limit=0` → 에러 처리
  - `limit=20` → 10으로 clamp되어 `requestedCount=10`
  - `dryRun=true`일 때 DB 수정 없음은 `processMapping()`이 실제 insert/upsert 호출 전에 `return`하는 기존 로직을 그대로 유지했음을 코드로 확인
- **`npm run build`**: 성공(기존에 알려진 CSS 경고 외 신규 오류 없음)
- **`git diff --check`**: 통과

### 2.4 결과

56건을 한 번에 처리하다 HTTP 546이 발생하던 문제를, 클라이언트가 `startIndex`/`limit`로 작은 배치(기본 5건, 최대 10건)를 반복 요청해 전체를 커버할 수 있는 구조로 전환했다. `nextStartIndex`/`hasMore`를 응답에 포함해 클라이언트가 다음 요청의 `startIndex`를 계산할 수 있게 했다.

---

## 3. 작업 2: zh-CN 전체 UI 번역 및 로케일 fallback

### 3.1 배경

이전 세션에서 `LANGUAGES`에 `zh-CN` 항목을 추가하고 `DICTIONARY['zh-CN'] = DICTIONARY.en`으로 임시 alias만 걸어두었는데, 그 결과 zh-CN을 선택해도 음식점 데이터(이미 DB에 zh-CN 텍스트가 있을 경우)만 중국어로 보이고 앱 UI 문구 전체는 영어로 표시되는 문제가 있었다.

### 3.2 수정 내용

#### 3.2.1 딕셔너리 전면 번역

- `src/shared/i18n/dictionary.js`: `DICTIONARY['zh-CN'] = DICTIONARY.en` 별칭을 제거하고, en과 동일한 키/중첩 구조(287개 키, en/ko/zh-CN 완전 일치)로 실제 중국어 간체 번역본을 작성. 모든 `{location}`/`{count}`/`{n}`/`{value}`/`{dist}`/`{theme}`/`{area}`/`{name}` placeholder와 `null` 값은 en과 동일하게 유지
- 신규 키 3개(`search.guide`, `community.replyToPlaceholder`, `community.replyingToLabel`) 추가: en/ko/zh-CN 전부에 반영

#### 3.2.2 데이터 우선순위(zh-CN → en → ko)

- `src/api/placeApi.js`: `normalizePlace()`의 로케일 fallback을 로케일별 체인(`LOCALE_FALLBACK_CHAIN`: en→`en,ko`/ko→`ko,en`/zh-CN→`zh-CN,en,ko`)으로 재작성. en/ko 결과는 기존과 동일, zh-CN만 3단계 fallback 적용
- `src/shared/utils/formatDate.js`: 날짜 포맷 로케일에 `zh-CN` Intl 로케일 추가(`ko-KR`/`en-US` 2택 → 맵 방식 3택)
- `src/features/places/data/placeDetailSectionFallback.js`: 기존에 이미 `translations[locale] ?? translations.en ?? translations.ko` 형태의 범용 fallback 구조였으므로 `zh-CN` 번역만 추가

#### 3.2.3 하드코딩된 `locale === 'ko' ? 한국어 : 영어` 분기 수정

- `SearchOverlay.jsx`: 빈 검색 안내문을 `search.guide` 키로 교체, Kakao 검색 결과에 대해 DB 매칭 우선 표시하는 로직(`isEnglish` → `isNonKorean`, `locale !== 'ko'`)을 zh-CN까지 확장
- `TopBar.jsx`: 브랜드명 표시를 `t('brand.name')`으로 교체(브랜드명은 zh-CN에서도 "Matgil" 유지 — 허용된 예외)
- `PlaceDetailSheet.jsx`, `TodayCourseDetail.jsx`, `NearbySheet.jsx`, `LocationSheet.jsx`: 위치 라벨 표시를 ko/zh-CN/en 3분기로 확장
- `PhraseCategoryTabs.jsx`, `CommunityTabs.jsx`, `PostComposer.jsx`: 카테고리 라벨 3분기 확장 + 데이터 파일(`phrases.js`, `communityConstants.js`, `communityPosts.js`, `PhrasesPage.jsx`)에 `labelZh` 필드 추가
- `CommentBottomSheet.jsx`: 답글 관련 하드코딩 템플릿 문자열을 `t('community.replyToPlaceholder'/'replyingToLabel', {name})` 호출로 교체
- `LoginForm.jsx`, `SignUpPage.jsx`: `mapAuthError()`에 `AUTH_ERROR_ZH` 매핑 분기 추가(en/ko 동작 불변), 이미 dictionary에 존재하지만 사용되지 않던 `t()` 키(`signup.passMismatch`/`passShort`/`successMsg`/`backToLogin`)로 하드코딩된 평문 리터럴을 교체
- `courseDisplay.js`: 프리셋 위치 라벨(`labelZh`), 코스 제목 템플릿(`ZH_TITLE_TEMPLATES`), 서울 구 단위 지역명(`translateSeoulDistrictZh`), "선택 안 함"/"맛집" 등 리터럴 fallback 7곳에 zh-CN 분기 추가. 영문 주소 로마자 변환(`formatKoreanAddressToEnglish`)은 `locale === 'en'`에서만 시도하도록 제한해, zh-CN은 대신 번역된 구 단위 중국어 지명으로 자연스럽게 fallback되도록 함
- `courseMetrics.js`: 코스 소요시간 단위(분/시간)에 "分钟/小时" zh-CN 분기 추가
- `locations.js`, `seoulDistricts.js`: 프리셋 장소명 10곳(`labelZh`), 서울 25개 구 이름(`SEOUL_DISTRICT_ZH`)에 중국어 표기 추가

### 3.3 zh-CN에서 영어(또는 원문)로 남는 예외

- **브랜드명**: "Matgil" — 요청에 따라 유지
- **외부 데이터(Kakao)**: SearchOverlay에서 DB 매칭에 실패한 검색 결과의 구 단위 주소는 영문 표기(`formatSeoulDistrictAddress`)로 fallback — 이 변환 로직 자체가 en 전용이며, Kakao 원문은 항상 한국어이므로 zh-CN에 대한 별도 변환기를 새로 만들지 않음(로마자 표기 규칙과 달리 기계적 변환 규칙이 없음)
- **DB 기반 미번역 데이터**: 표현(phrases) 실제 문구, 음식 카테고리 라벨(`FoodCategoryProvider`), DB에서 성공적으로 로드되는 표현 카테고리는 DB 테이블에 `label_zh` 컬럼이 없어 en으로 fallback — DB/Edge Function 수정 범위 밖이라 손대지 않음. 이미 범용 로케일 fallback 구조(`translations[locale] ?? en ?? ko`, `getCategoryLabel()`)이므로 향후 DB에 zh-CN 데이터가 추가되면 코드 수정 없이 자동 반영됨

### 3.4 테스트

- `npm run build`: 성공(기존 CSS 경고 1건 외 신규 오류 없음)
- 수정한 24개 파일 전체 esbuild 구문 검사 통과
- `git diff --check`: 통과(개행 문자 관련 경고만 있고 실제 오류 없음)
- `dictionary.js`의 en/ko/zh-CN 287개 키 구조·중첩·placeholder·null 완전 일치를 스크립트로 검증
- Vite dev 서버를 임시로 띄워 수정한 파일 전체가 200으로 정상 트랜스파일/서빙되는지 확인 후 서버 종료
- 브라우저 자동화 도구가 이 환경에 없어, 언어 모달에서 zh-CN을 실제로 선택해 화면을 눈으로 확인하는 것은 수행하지 못함

### 3.5 결과

zh-CN 선택 시 앱의 거의 모든 화면(언어 선택 모달/지도 검색창/검색 오버레이/필터 모달/장소 상세/코스 상세/저장한 코스·장소/표현/커뮤니티/로그인/회원가입/마이페이지/회원 탈퇴/하단 내비게이션/빈 상태·에러·로딩 문구)이 실제 중국어 간체로 표시되도록 전환했다. en/ko 기존 동작은 모든 분기에서 원래 로직과 동일하게 유지된다.

---

## 4. 향후 과제

- (작업 1) `startIndex`/`limit` 배치 방식이 실제 운영 환경에서 546 없이 56건 전체를 안정적으로 커버하는지 실제 배포 후 확인 필요(이번 세션은 배포·실행을 수행하지 않음)
- (작업 2) DB 기반 콘텐츠(표현 실제 문구, 음식 카테고리 등)에 `label_zh`/`zh-CN` 번역이 추가될 경우, 기존 코드가 이미 범용 fallback 구조라 별도 코드 수정 없이 반영되는지 확인
- (작업 2) 브라우저에서 zh-CN 선택 후 실제 화면(특히 코스 상세의 지역명/제목, 로그인·회원가입 에러 메시지)을 육안으로 확인하는 절차가 아직 남아있음
