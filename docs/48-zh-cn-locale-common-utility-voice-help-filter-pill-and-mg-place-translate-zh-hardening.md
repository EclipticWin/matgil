# 48. zh-CN 공통 locale 유틸/DB 다국어 연동, Voice Help·필터 칩 폭 수정, mg-place-translate-zh 검증 강화

- 작성일시: 2026-07-20 00:57:45

---

## 1. 목적

`docs/47-mg-tour-api-chs-enrich-batch-pagination-and-zh-cn-full-ui-i18n.md`(커밋 `c585d4a`) 이후 이어서 진행된, 서로 독립적인 4건의 작업을 정리한다.

1. zh-CN UI 문자열 1차 번역 이후 남아 있던 "en/ko 이분법" 구조 제거 — 공통 locale fallback 유틸 도입, 음식 카테고리·표현(phrases) DB 다국어 조회 연동, 저장한 가게/코스의 현재 locale 재조회 검증, 잔여 하드코딩 문자열 정리
2. Phrases 탭의 Voice Help(음성 도움) 화면에서 예시 결과·실제 분석 결과가 zh-CN 모드에서도 영어로 표시되던 문제 수정
3. zh-CN 음식 필터에서 항목 선택 시 버튼 폭이 미세하게 바뀌어 줄바꿈 배치가 흔들리던 문제 수정
4. `supabase/functions/mg-place-translate-zh/index.ts`의 검증 체계를 "한글 잔존 시 행 전체 실패"에서 "안전하게 자동복구 가능한 것은 코드로 정제, 핵심 무결성만 hard validation" 구조로 재구축(4회에 걸친 반복 보강)

이 문서가 다루는 기간 동안 원격 배포, 실제 Solar/OpenAI API 호출, DB 저장, git add/commit/push는 **문서화·커밋 단계 전까지** 전혀 수행하지 않았다(각 작업 세션이 매번 `npm run build`/`git diff --check`로만 검증했다).

---

## 2. 작업 1: 공통 locale 유틸 도입 및 en/ko 이분법 제거

### 2.1 배경

`docs/47`에서 zh-CN UI 딕셔너리 1차 번역은 끝났지만, 다음이 남아 있었다.

- 프로젝트 전체에 `locale === 'ko' ? A : locale === 'zh-CN' ? B : C` 형태의 개별 삼항연산자가 파일마다 흩어져 있어 이후 `ja` 등 새 locale 추가가 어려움
- `mg_food_category_translations`/`mg_phrases`/`mg_phrase_categories`에 zh-CN 데이터가 없어 음식 필터·표현 카테고리·표현 뜻이 영어로 fallback
- 프로필 편집 비밀번호 placeholder("6자 이상" 하드코딩), 지도 로드 실패 폴백("Map view" 하드코딩), 커뮤니티 작성자명 fallback("Traveller" 하드코딩) 등 잔여 하드코딩 문자열

### 2.2 수정 내용

**공통 locale 유틸(신규)**
- `src/shared/i18n/localeFallback.js` — `SUPPORTED_LOCALES`, locale별 fallback 체인(`ko→[ko,en]`, `en→[en,ko]`, `zh-CN→[zh-CN,en,ko]`, 미지정 locale→`[locale,en,ko]`), `getLocaleChain()`, `pickTranslated()`(필드 단위 선택), `pickTranslatedRow()`(locale-tagged row 배열에서 선택). 이후 파일들의 개별 삼항연산자를 전부 이 유틸 호출로 교체.

**리팩터링(삼항연산자 제거, 동작은 en/ko 기존과 동일 + zh-CN 정상 지원)**
- `src/api/placeApi.js` — `normalizePlace()`의 로컬 fallback 배열을 `pickTranslatedRow()`로 교체
- `src/features/courses/utils/courseDisplay.js`/`courseMetrics.js` — 위치 라벨·코스 제목·서울 구 표기·코스 소요시간 단위 등 모든 3분기 삼항연산자를 `pickTranslated()` 호출로 교체(`ANCHOR_LABEL_KO`/`ANCHOR_LABEL_ZH` 두 맵을 `ANCHOR_LABEL_TRANSLATIONS` 하나로 통합)
- `src/features/explore/components/LocationSheet.jsx`/`NearbySheet.jsx`/`PlaceDetailSheet.jsx`/`TodayCourseDetail.jsx`, `src/features/phrases/components/PhraseCategoryTabs.jsx`, `src/features/community/components/CommunityTabs.jsx`/`PostComposer.jsx` — 라벨 3분기를 `pickTranslated()`로 교체
- `src/features/auth/components/LoginForm.jsx`, `src/pages/SignUpPage.jsx` — `mapAuthError()`의 ko/zh-CN 개별 if 블록을 `AUTH_ERROR_TRANSLATIONS` 테이블 + `pickTranslated()`로 통합(en은 Supabase 원문 그대로 반환하는 기존 동작 유지)
- `src/features/explore/context/FoodCategoryProvider.jsx`, `src/features/places/hooks/usePlaceDetailSections.js` — 기존 `translations[locale] ?? translations.en ?? translations.ko` 고정 체인을 `pickTranslated()` 기반으로 교체(DB에 어떤 locale이 들어와도 자동 대응)

**음식 카테고리 DB 연동**
- 프론트는 이미 `mg_food_category_translations`를 범용 구조로 조회하도록 되어 있어 코드 변경은 위 리팩터링만으로 충분했다. `docs/sql-zh-cn-food-categories-2026-07-19.md`(신규) — 18개 카테고리에 `locale='zh-CN'` label upsert SQL(en/ko 무변경, `ON CONFLICT` 안전 재실행). **DB에는 아직 실행하지 않았다.**

**표현(phrases)/표현 카테고리 DB 연동**
- `src/features/phrases/services/phraseService.js` — `fetchPhraseCategories()`에 `label_zh` select 추가, `fetchPhrasesByCategory`/`fetchPopularPhrases`에 `zh_text` select 추가, `normalizePhrase(row, locale, bookmarkedIds)`로 시그니처 변경(뜻 필드를 `intentEn`→`meaning`으로 개명, `pickTranslated({en, 'zh-CN'}, locale)`로 결정 — `ko`는 항목이 없어 en으로 자연스럽게 fallback, 기존 ko 동작 그대로 유지)
- `src/features/phrases/components/PhraseCard.jsx` — `phrase.intentEn` → `phrase.meaning`
- `src/pages/PhrasesPage.jsx` — `locale`을 `normalizePhrase()` 호출 3곳에 전달, 관련 `useEffect` 의존성 배열에 `locale` 추가(언어 전환 시 재조회)
- `docs/sql-zh-cn-phrases-2026-07-19.md`(신규) — `mg_phrase_categories.label_zh`(8건)/`mg_phrases.zh_text`(85건)를 `UPDATE ... WHERE 컬럼 IS NULL`로만 채우는 안전 SQL(phrase_key/id/category/sort_order/ko_text/en_text/note 무변경 보장). **DB에는 아직 실행하지 않았다.**

**저장한 가게/코스**
- 코드 확인 결과 `fetchSavedPlaces({userId, locale})` → `getPlacesByIds(placeIds, locale)` → `normalizePlace()`(위 `pickTranslatedRow` 적용), `SavedCourseDetailPage`의 `getPlacesByIds`+`mergeSavedStopWithLocalizedPlace`+`getSavedCourseDisplayTitle` 구조가 **이미** 현재 locale로 재조회하도록 되어 있어 별도 코드 수정 없이 검증만 수행했다(자세한 내용은 §5 참고).

**잔여 하드코딩 문자열**
- `src/features/profile/components/EditProfileSheet.jsx` — `placeholder="6자 이상"` → `t('my.newPasswordPlaceholder')`
- `src/features/explore/components/KakaoMap.jsx` — 지도 로드 실패 폴백 `"Map view"` → `t('nearby.mapUnavailable')`
- `src/features/community/components/CommentBottomSheet.jsx`/`PostCommentSection.jsx`/`PostCard.jsx` — 작성자명 없을 때 하드코딩 `'Traveller'` → `t('community.travellerFallback')`(ReviewCard.jsx의 "Deleted user" 센티널 패턴과 동일하게, 서비스 계층은 locale-neutral 값을 반환하고 렌더링 시점에 번역)
- `src/shared/i18n/dictionary.js` — 신규 키 6개(`search.guide`, `community.replyToPlaceholder`, `replyingToLabel`, `travellerFallback`, `my.newPasswordPlaceholder`, `nearby.mapUnavailable`) en/ko/zh-CN 전부 추가

### 2.3 테스트

- `pickTranslated`/`getLocaleChain`/`normalizePlace`/`normalizePhrase`를 esbuild+Node로 직접 실행해, 리팩터링 전과 동일한 en/ko 출력 + 정상 zh-CN 출력을 확인
- 딕셔너리 290개 키 en/ko/zh-CN 완전 일치(스크립트 검증)
- `npm run build` 성공, `git diff --check` 통과

### 2.4 남은 것

- `docs/sql-zh-cn-food-categories-2026-07-19.md`/`docs/sql-zh-cn-phrases-2026-07-19.md`는 **아직 실행되지 않았다** — 사용자가 Supabase SQL Editor에서 직접 실행해야 실제로 음식 필터·표현 카테고리·표현 뜻이 zh-CN으로 표시된다(실행 전까지는 en으로 안전하게 fallback).
- `mg_phrase_categories`/`mg_phrases` 실 데이터에 label_zh/zh_text가 채워지기 전까지 표현 탭은 en으로 fallback된다(코드 결함이 아니라 데이터 미채움 상태).

---

## 3. 작업 2: Voice Help(음성 도움) zh-CN 영어 잔존 수정

### 3.1 배경

Phrases 탭의 Voice Help 화면에서 예시 카드의 뜻(meaning)이 zh-CN 모드에서도 항상 영어("You need to pay before eating.")로 하드코딩되어 있었고, 실제 음성 분석 요청도 `userLanguage`(=현재 locale)를 Edge Function에 전달하고는 있었지만, 프롬프트가 `userLanguage` 원본 코드값(`"zh-CN"` 같은 BCP-47 코드 문자열)을 그대로 LLM에 넘겨 모델이 "어떤 언어로 답해야 하는지"를 명확히 인식하지 못해 영어로 응답하는 경우가 있었다.

### 3.2 수정 내용

- `src/features/phrases/components/VoiceHelpPlaceholder.jsx` — 예시 카드의 `meaning`을 `EXAMPLE_MEANING_BY_LOCALE`(ko/en/zh-CN) + `pickTranslated()`로 교체. 추천 답변의 뜻(`suggestedReplyMeaning`)을 신규 표시(`EXAMPLE_REPLY_MEANING_BY_LOCALE`는 en/zh-CN만 정의 — ko는 원문을 그대로 읽을 수 있어 렌더링 자체를 생략). 하드코딩 에러 문구 3곳을 이미 존재하던 `t('phrases.voiceFailed'/'voiceDenied'/'voiceError')`로 교체.
- `supabase/functions/mg-voice-help/index.ts` — `LOCALE_LANGUAGE_NAMES`(ko→Korean, en→English, zh-CN→Simplified Chinese) + `resolveLanguageName()` 추가, 프롬프트가 원본 로케일 코드 대신 이 언어명을 사용하도록 수정. 응답에 `suggestedReplyMeaning`(추천 답변의 뜻, 사용자 언어로) 필드를 **선택적**(누락돼도 검증 실패 없이 빈 문자열 기본값)으로 추가해 기존 응답 계약과 호환성을 유지했다.

### 3.3 테스트

- `resolveLanguageName`/`buildPrompt`/`normalizeAnalyzeResult`(신규 필드 포함/누락 양쪽)를 esbuild+Node로 직접 실행해 확인
- `npm run build` 성공, `git diff --check` 통과
- 실제 Solar/OpenAI 호출 및 배포는 수행하지 않아, 프롬프트 변경이 실제 모델 응답 언어를 어느 정도까지 개선하는지는 배포 후 확인이 필요하다.

---

## 4. 작업 3: zh-CN 음식 필터 칩 폭 변화 수정

### 4.1 배경

`FilterSheet.jsx`의 `Pill`(음식 필터 칩) 컴포넌트가 선택 여부에 따라 `border-[1.5px] border-ink/10`(비선택)과 border 클래스 없음(선택)을 오갔다. padding/font-weight는 두 상태에서 이미 동일했지만 border만 1.5px(좌우 합산 3px) 차이가 있어, 선택 시 버튼이 미세하게 좁아졌고 zh-CN처럼 한 줄에 딱 맞게 배치된 항목에서 이 몇 px 차이가 줄바꿈 위치를 바꾸는 원인이었다.

### 4.2 수정 내용

- `src/features/explore/components/FilterSheet.jsx` — 두 상태 모두 `border-[1.5px]`를 항상 적용하고 선택 시에는 `border-transparent`로 색만 투명하게 바꿔, 시각적으로는 기존과 동일하지만 박스 모델상 너비는 항상 같게 했다. `box-border`(명시적 `box-sizing: border-box`)와 `[font-synthesis:none]`(향후 굵기 조건이 다시 생기더라도 브라우저가 CJK 글리프를 가짜로 굵게 합성해 폭이 흔들리는 것을 방지)을 방어적으로 추가했다. `flex flex-wrap gap-2` 컨테이너 구조와 항목 배열 순서는 변경하지 않았다.

### 4.3 테스트

- `npm run build` 성공, 빌드된 CSS에 `box-sizing:border-box`/`font-synthesis:none` 정상 컴파일 확인, `git diff --check` 통과

---

## 5. 작업 4: mg-place-translate-zh 검증/자동복구 체계 재구축

### 5.1 배경

`docs/46`이 이미 유사한 이름의 자동복구 작업을 기록하고 있었으나, 이번 세션에서 실제 코드(`supabase/functions/mg-place-translate-zh/index.ts`)를 직접 확인한 결과 그 문서가 설명한 자동복구 아키텍처(`resolveMenuItemTranslation`/`buildSafeChineseDescription`/`sanitizeTranslatedAddress` 등)는 실제로는 존재하지 않았고, 실제 파일은 "프롬프트 + 1회 보정 재시도"만 있는 훨씬 단순한 구조였다. 사용자가 실제 1차 전체 순회 결과(ko 1,633건 중 zh-CN 861건 성공/772건 실패, 실패 원인 1위 address·2위 name 한글 잔존)를 제시하며 이 실제 코드를 기준으로 자동복구를 새로 구축해 달라고 요청했다. 이후 3차례에 걸쳐 발견된 개별 결함을 추가로 보강했다.

### 5.2 1차: 자동복구 아키텍처 전면 도입

- **주소**: `sanitizeTranslatedAddress()` — 서울/자치구를 로마자화 전에 먼저 중국어로 고정 치환(`SEOUL_CITY_ZH_MAP`+`SEOUL_DISTRICT_ZH_MAP` 공유, `applyFixedSeoulReplacements()`), 남은 도로명/동은 표준 로마자 표기법(`romanizeSyllable`/`romanizeHangulWord`)으로 로마자화하되 도로 접미사(대로/로/길/동)는 하이픈 표기(`romanizeAddressUnit()` — 예: Teheran-ro, Dadong-gil), "길"은 숫자 뒤에서만 街로, "층"은 楼로 특별 처리
- **상호명**: `recoverName()` — 본점/지점/점→总店/分店/店, `[백년가게]`/`（백년가게）`/`(백년가게)` 세 괄호 스타일 모두 百年老店으로 치환, 그래도 남는 한글은 로마자 fallback(임의 한자 생성 금지), 일반명(`GENERIC_BAD_NAMES`)으로 뭉개지면 원문 전체를 재구성
- **메뉴(first_menu/treat_menu)**: `recoverMenuField()`+`resolveMenuItemTranslation()` — 원본 배열의 개수·순서를 절대 기준으로 재조립, `FIXED_FOOD_NAME_MAP`(순대국 등, 긴 표현 우선) 우선 적용, 모르는 메뉴는 안전한 5개 카테고리(`MENU_FALLBACK_CATEGORY_KEYWORDS`)로 fallback
- **parking/packing**: `recoverAvailabilityField()` — 원본 한국어 기준 가능→可/불가능→不可/일부·부분→部分可/그 외→请咨询
- **description**: `recoverDescription()`+`buildSafeDescription()` — 한글이 남으면 최종 name+address+대표 메뉴로 사실 나열형 문장 재생성
- **hard validation 신규 추가**: 요일 검사(`preservesWeekdays`), 자치구·서울 표기 검사(`validateFixedDistrictMapping`/`validateSeoulCityMapping` — 기존에는 주소 숫자만 확인하고 자치구 이름 자체는 검사하지 않았음), 번체자 검사(`findTraditionalCharacterIssue`), 괄호 균형 검사(`findBracketImbalanceIssue`)
- **응답에 `failureBreakdown` 추가**(`{name, address, treat_menu, description, parking, numberMismatch, other}`), `startAfterPlaceId` 재처리 기능은 무변경

### 5.3 2차 보강 (사용자가 재확인 후 발견한 결함)

1. **주소 자동복구 순서 버그** — `sanitizeTranslatedAddress()`가 로마자화를 먼저 하고 있어 "서울특별시 강남구"가 "Seoulteukbyeolsi Gangnam-gu"가 된 뒤 자치구 hard failure로 바뀔 뿐 실제로는 고쳐지지 않았다 → 서울/자치구 고정 치환을 로마자화보다 먼저 적용하도록 순서 수정(`SEOUL_DISTRICT_ZH_MAP`을 치환·검증 양쪽에서 공유, 중복 선언 없음)
2. **tags 자동복구 누락** — `recoverTags()` 신규 추가, 원본 tags 기준 6개 고정 매핑(음식점/restaurant→餐厅 등), 모르는 태그는 제외
3. **parking/packing 영어값 통과 금지** — "Not available" 등 한글만 없으면 통과하던 것을 可/不可/部分可/请咨询 4개 중국어 값과 정확히 일치할 때만 신뢰하도록 강화
4. **open_time/rest_date 자동복구 추가** — `OPERATING_SCHEDULE_TERM_MAP`(연중무휴/브레이크타임/라스트오더/전화문의/공휴일/설날/추석/평일/주말/휴무/매주+요일), `preservesWeekdays()`가 周일/星期 두 표기를 모두 인정하도록 수정(`WEEKDAY_ZH_VARIANTS`)
5. **description source=null 버그** — source가 null이면 무조건 translated를 그대로 반환하던 조기 반환 제거
6. **번체자 자동 간체화** — 발견 시 즉시 hard failure하던 것을, 대응표에 있는 문자는 검증 전에 자동 치환(`convertTraditionalToSimplified`)하도록 변경, 대응표 밖의 잔존만 여전히 실패
7. **normalizeZh() 이상 규칙 제거** — 실제 상호명을 훼손할 수 있는 `.replace(/Dodam仁寺/g, "Dodam")`과 no-op `.replace(/Central City店/g, "Central City店")` 삭제
8. **괄호 오류 자동복구** — `applyKnownNameSuffixFixes()`가 치환 후에도 `[`/`]` 개수가 안 맞으면 고립된 대괄호만 제거

### 5.4 3차 보강 — 숫자·요일 "정확히 동일" 검증

- `preservesTimeTokens()`를 "포함 여부" 확인에서 `hasSameNumberTokens()`(주소와 동일한, 모든 숫자 토큰의 개수·값이 정확히 같아야 함) 위임으로 교체 — 이전에는 "11:00~21:00" 원문에 번역이 "11:00~21:00 / 22:00"처럼 시간을 추가해도 통과했다
- `preservesWeekdays()`를 "요일별 개수가 원문과 정확히 같은가"로 재작성(`WEEKDAY_ZH_CANONICAL` 역매핑 추가) — 누락뿐 아니라 원문에 없는 요일이 추가된 경우도 hard failure
- `containsHanCharacter()` 신규 추가, `resolveMenuItemTranslation()`/`recoverDescription()`에 "한글 없음"뿐 아니라 "한자를 하나 이상 포함"도 요구하도록 강화 — 모델이 영어("Pork cutlet", "This restaurant is located...")로 반환해도 한글이 없다는 이유만으로 통과하던 문제 차단. name/address는 공식 상호명·로마자 도로명 fallback을 허용해야 하므로 이 검증을 적용하지 않음

### 5.5 4차 보강 — open_time/rest_date 영어 전용 저장 방지

- `recoverScheduleField()`의 시그니처를 `(translated)` → `(source, translated)`로 변경. translated가 한글 없이 한자를 포함하면 그대로 신뢰하고, 그 외(영어·로마자 전용 또는 한글 잔존)에는 모델 출력을 버리고 **source(한국어 원문) 전체**에 `OPERATING_SCHEDULE_TERM_MAP`을 적용해 중국어 값을 새로 만든다 — 이전에는 open_time/rest_date에 자동복구 개념 자체는 있었지만 번역문 자체를 기준으로만 치환해, 모델이 "Open year-round"/"Every Sunday"처럼 완전히 영어로 반환하면 한글이 없어 그대로 zh-CN 행에 저장될 수 있었다. `applyAutoRecovery()`의 호출부도 `row.open_time`/`row.rest_date`를 함께 넘기도록 수정. source 치환 후에도 사전에 없는 한글이 남으면 임의로 로마자화하지 않고 기존 hard failure로 남긴다.

### 5.6 테스트 (4회 전체 누적, esbuild+Node 순수 함수 테스트, 실제 API 호출 없음)

- 서울특별시 강남구 테헤란로 123 → 首尔特别市江南区 Teheran-ro 123(숫자 완전 동일) / 서울 중구 다동길 24-12 → 首尔中区 Dadong-gil 24-12
- 한/영 혼합 tags → 고정 매핑만 남고 미지 태그 제외 / "Not available"(source=불가능) → 不可
- 매주 월요일 휴무 → 每周周一 休息 / 星期日도 일요일 보존 인정 / 없던 요일이 추가되면 실패
- source description=null + translated 한글 → 중립 중국어 문장 생성
- 雪濃湯 → 雪浓汤 자동 치환 / Insa Dodam仁寺唠谈 훼손되지 않음 / Central City店 그대로
- 百年老店] 같은 결과 생성 안 됨(3가지 괄호 스타일 모두 정상 치환)
- 11:00~21:00 → 11:00~21:00 통과, 11:00~21:00 / 22:00 추가 시 실패
- menu "Pork cutlet"/description "This restaurant is located..." → 영어값 채택되지 않고 원본 기준 fallback, "韩式炸猪排"/"该餐厅位于首尔。"는 유지
- source=연중무휴, translated=Open year-round → 全年无休 / source=매주 일요일, translated=Every Sunday → 每周周日 / source=평일 11:00~21:00 / 브레이크타임 15:00~17:00, translated=Weekdays.../Break time... → 工作日 11:00~21:00 / 休息时间 15:00~17:00
- `npm run build` 매 보강마다 성공(신규 오류 없음), `git diff --check` 매번 통과, 중복 top-level 선언 없음 확인

### 5.7 남은 것

- 이 함수는 `mg_place_texts`에 zh-CN 행이 **없는** place만 조회해 insert한다 — 이미 저장된 기존 `translation_status='machine'` 행의 영어·번체자·괄호 오류는 이번 검증 강화를 재실행해도 **수정되지 않는다.** 기존 행을 다시 읽어 update하는 기능은 이번 작업 범위에 포함하지 않았다.
- 실제 Solar API로 772건 재처리 시 이번에 강화된 자동복구가 실패율을 얼마나 낮추는지는 실제 배포 후 확인이 필요하다(이번 세션은 순수 함수 단위 테스트만 수행).

---

## 6. 전체 검증 요약

| 항목 | 결과 |
|---|---|
| `npm run build` | 매 작업마다 성공(기존에 알려진 CSS 경고 외 신규 오류 없음) |
| `git diff --check` | 매 작업마다 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| 실제 Supabase/Solar/OpenAI API 호출 | 수행하지 않음 |
| DB 저장·마이그레이션 실행 | 수행하지 않음(SQL 문서 2건은 작성만 하고 미실행) |
| 배포(`supabase functions deploy`) | 수행하지 않음 |
| git add/commit/push | 이 문서 작성 전까지 수행하지 않음 |

---

## 7. 사용자가 직접 해야 할 일

1. `docs/sql-zh-cn-food-categories-2026-07-19.md` — Supabase SQL Editor에서 실행(음식 필터 zh-CN 표시)
2. `docs/sql-zh-cn-phrases-2026-07-19.md` — Supabase SQL Editor에서 실행(표현 카테고리/뜻 zh-CN 표시)
3. `mg-voice-help` 함수 배포(`npx supabase functions deploy mg-voice-help`) — 이번 세션은 배포하지 않음
4. `mg-place-translate-zh` 함수 배포 후 실제 재처리 실행 — 배포 전 `docs/46`에 기록된 것과 마찬가지로 `SOLAR_API_KEY`/`OPENAI_API_KEY` 등록 여부 확인 필요
