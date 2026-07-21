# 46. mg-place-translate-zh 자동복구(auto recovery) 및 검증 체계 강화

- 작성일시: 2026-07-19 13:19:07

---

## 1. 목적

`docs/45-mg-place-translate-en-validation-fallback-and-live-run-log.md` 작성 이후 신설된 `supabase/functions/mg-place-translate-zh/index.ts`(한국어→중국어 간체 번역 Edge Function)에서 진행된 모든 작업을 정리한다.

이 함수는 영문 함수(`mg-place-translate-en`)와 별개의 자립적(self-contained) 파일로 신규 작성되었으며, 이번 문서가 다루는 기간 동안 다음 두 축으로 반복 개선되었다.

1. **번역 품질/언어 정책 검증 강화**: 한국 고유 상호명·한국 음식 정체성이 중국어로 임의 번역되지 않도록 하는 정책과, zh-CN 행에 한국어가 잔존하지 않도록 하는 검증
2. **자동복구(auto recovery) 아키텍처 도입**: Solar/OpenAI가 형식이나 일부 문구만 어긋나게 반환했을 때 행 전체를 실패시키는 대신, 코드에서 안전하게 자동 보정한 뒤 핵심 무결성 검증만 다시 통과시키는 구조로 전환

이 문서는 이 두 축의 전체 변경 이력을, 실제 코드의 함수명·상수명을 기준으로 상세히 기록한다.

---

## 2. 배경

`mg-place-translate-zh`는 기존 `mg-place-translate-en`의 구조(프롬프트 생성, provider fallback, corrective retry, insert-only 저장, `.range()` 페이지네이션, dryRun)를 그대로 재사용하는 새 파일로 작성되었다. 그러나 실제 dryRun 결과를 사용자가 반복 검토하면서 아래와 같은 문제가 연쇄적으로 발견되었고, 그때마다 검증 로직을 보강했다.

- 초기: 한국 고유 상호명(가나, 가담, 가문 등)이 중국어 한자 의미로 임의 번역됨(加纳/家淡/家门), 한국 음식(아구찜, 짬뽕, 난자완스 등)이 유사한 중국 요리 이름으로 대체됨
- 1차 보강: `FOOD_NAME_ZH_MAP`, `NAME_BUSINESS_TYPE_ZH_MAP` 고정 사전과 `applyFixedFoodNameOverride()` 강제 치환 도입, 이름 앞에 한국어 원문을 두는 정책(이후 뒤집힘), 로마자 표기 fallback(`romanizeKoreanName` 등, 이후 완전 삭제) 도입과 폐기가 반복됨
- 2차 보강: name의 최종 정책을 "중국어 표시명（한국어 원문）" 형식으로 확정(`buildFinalName`/`validateNamePolicy`), 로마자 표기 fallback을 name에서 전면 제거
- 3차 보강: description/address/운영정보/tags에 한국어 문장·주소·태그가 그대로 남아 저장되는 문제 발견 → `containsHangul()` 기반 zh-CN 언어 정책 게이트(`validateZhLocaleTextFields`) 및 `길→吉/吉尔` 오역 차단(`findInvalidRoadSuffixIssue`) 도입
- 4차(이번 문서의 핵심): 위 검증들이 강화될수록 "숫자·요일 등 핵심 데이터는 정확한데 사소한 형식/문구 차이로 행 전체가 반복 실패"하는 사례가 늘어나, 동일 `place_id`가 API 토큰과 시간을 낭비하며 계속 재시도되는 현상이 보고됨 → 이번 작업에서 자동복구(auto recovery) 아키텍처를 도입해 문제를 해결함

---

## 3. 문제점: 기존 zh 번역 함수에서 발생했던 실패 유형 정리

자동복구 도입 전, `validateTranslation()`은 아래 각 항목을 하나라도 위반하면 **행 전체를 실패(failed) 처리**하고 있었다.

| 실패 유형 | 실제 발생 사례 |
|---|---|
| 메뉴 배열 길이 불일치 | 원본 `splitMenuItems()` 결과 개수(예: 3개)와 모델이 반환한 `first_menu_items`/`treat_menu_items` 배열 길이(예: 2개)가 다름 |
| 메뉴 괄호 형식 오류 | 모델이 `중국어 설명（한국어 원문）` 형식을 정확히 지키지 않고 괄호를 생략하거나 다른 형식으로 반환 |
| 메뉴 괄호 밖 한글 잔존 | `고추韩式辣椒糖醋肉（고추탕수육）`처럼 괄호 앞 중국어 설명 부분에 한글이 섞여 나옴 |
| 메뉴 원문 괄호 일부만 보존 | 여러 한국어 메뉴명이 콤마로 묶인 긴 원문 중 일부만 괄호 안에 들어감 |
| description 한글 잔존 | `가나돈까스의집은(는) 首尔 江南区...에 위치한 음식점입니다.`처럼 한국어 문장 구조·조사가 중국어 단어와 섞여 나옴 |
| description 고정 음식명 누락 | 원문 description에 `보쌈`이 언급되어 있으나 번역 결과에 `韩式菜包肉`가 없음 |
| address 한글 잔존 | `首尔 松坡区 宋伊路19吉尔 3号`, `보국문로`처럼 도로명/동 이름 일부가 번역되지 않고 한글로 남음 |
| parking/packing/tags 한글 잔존 | `가능`, `사진 있음` 등 원문 값이 그대로 남거나 일부만 번역됨 |
| open_time/rest_date 한글 잔존 | 시간 숫자와 요일은 정확한데 `브레이크타임`, `라스트오더`, `전화문의 요망` 같은 부수 표현만 한국어로 남음 |
| 기타 validation 실패 사례 | `吉`/`吉尔`로 `길`이 오역됨, `麵`/`飯`/`館` 등 번체자 사용, `송파구` 원문이 `江南区`로 출력되는 자치구 오매핑, 상호명이 `加纳`/`家淡`/`家门`처럼 임의 한자로 번역됨 |

이 중 **메뉴/description/address/parking/packing/tags/open_time/rest_date의 한글·형식 문제**는 실제로는 숫자·요일·자치구 등 핵심 정보가 정확한 "거의 성공한" 번역인 경우가 대부분이었다. 그런데도 행 전체가 실패 처리되어 다음 배치 실행에서 동일 `place_id`가 다시 대상이 되고, Solar/OpenAI를 다시 호출해 토큰과 시간을 소모하는 문제가 반복적으로 보고되었다.

---

## 4. 수정 내용

### 4.1 자동복구(auto recovery) 대상 vs Hard Validation 대상

이번 작업의 핵심은 실패 유형을 **"코드에서 안전하게 자동복구 가능한 것"**과 **"실제 데이터 훼손 위험이 있어 반드시 실패 처리해야 하는 것"**으로 분리한 것이다.

| 자동복구(Auto Recovery) | Hard Validation (그대로 유지) |
|---|---|
| menu (배열 길이, 괄호 형식, 괄호 밖 한글) | JSON 구조 오류 (`isRawModelOutputShape`) |
| description (한글 잔존, 고정 음식명 누락) | non-null 원본의 null 정책 (`MUST_NOT_BECOME_NULL_KEYS`) |
| address (도로명/동 이름 한글만 로마자 변환) | 주소 숫자 변경 (`hasExactlySameNumberTokens`) |
| parking / packing (한글 잔존) | 서울/자치구 변경 (`validateSeoulCityMapping`, `validateFixedDistrictMapping`) |
| tags (한글 잔존) | 요일 변경 (`preservesDaysAndTimes`) |
| open_time / rest_date (알려진 한국어 부수 표현만) | 시간 숫자 변경 (`preservesDaysAndTimes`) |
| | name 정책 위반 (`validateNamePolicy`) |
| | 번체자 사용 (`findTraditionalCharacterIssue`) |
| | `길→吉/吉尔` 오역 (`findInvalidRoadSuffixIssue`) |
| | 자동복구 후에도 남는 언어 정책 오류 (`validateZhLocaleTextFields` 최종 재확인) |

자동복구는 **"모델 재호출 없이 코드만으로"** 이루어지며, 자동복구된 결과 역시 반드시 Hard Validation을 다시 통과해야만 저장이 승인된다. 즉 자동복구는 검증을 느슨하게 만드는 것이 아니라, 검증에 들어가기 전 입력을 정제하는 전처리 단계다.

### 4.2 각 함수별 역할

#### 메뉴 관련

**`resolveMenuItemTranslation(originalItem, modelItem)`**
메뉴 항목 하나(원본 한국어 문자열 `originalItem`, 같은 인덱스의 모델 번역 `modelItem`)를 받아 최종 텍스트를 절대 실패 없이 반환한다.
1. `applyFixedFoodNameOverride(originalItem)`가 값을 반환하면(즉 `FOOD_NAME_ZH_MAP`에 매칭되는 고정 음식이면) 모델 결과와 무관하게 그 값을 그대로 사용한다.
2. 고정 음식이 아니면, 모델 번역이 (a) 비어있지 않고 (b) 정확히 `（${originalItem}）`로 끝나며 (c) 그 앞부분(중국어 설명)이 비어있지 않고 (d) 한글을 포함하지 않을 때만 신뢰해서 그대로 사용한다.
3. 위 조건을 하나라도 만족하지 못하면 `classifyMenuFallbackCategory(originalItem)`이 반환한 카테고리명과 원문을 조합해 `카테고리（원문）` 형식의 안전한 기본값을 생성한다.

**`classifyMenuFallbackCategory(originalItem)`**
`MENU_FALLBACK_CATEGORY_KEYWORDS`(면/국수/냉면/칼국수/짬뽕/자장 → 韩式面食, 밥/덮밥/볶음밥/죽 → 韩式米饭料理, 탕/국/찌개/전골 → 韩式汤类料理, 고기/갈비/불고기/삼겹살/곱창/막창 → 韩式肉类料理, 해물/회/생선/아구/낙지/주꾸미/조개 → 韩式海鲜料理)를 순서대로 검사해 매칭되는 키워드가 원문에 있으면 해당 카테고리를, 없으면 `韩国料理`를 반환한다. 구체적인 특정 요리 이름을 추측하지 않고 **정직하게 넓은 카테고리만** 제시하는 것이 이 함수의 핵심 설계 의도다.

**`assembleMenuItemsField(original, translatedItems)`**
`first_menu`/`treat_menu` 하나를 조립하는 최상위 함수. `original`이 `null`이면 `null`을 반환하고, 그렇지 않으면 `splitMenuItems(original)`로 얻은 원본 배열의 **개수와 순서를 절대 기준**으로 삼아, 각 인덱스마다 `resolveMenuItemTranslation(originalItems[i], modelItems[i])`를 호출해 `" / "`로 합친 문자열을 반환한다. 모델 배열이 짧으면 없는 인덱스는 `modelItem`이 `undefined`가 되어 자동으로 fallback 처리되고, 모델 배열이 길면 원본 개수를 초과하는 인덱스는 애초에 `.map()` 대상에 포함되지 않아 버려진다. 이 함수는 과거의 `validateMenuItemsField()`(검증 전용, 실패 시 `{ok:false}` 반환)를 완전히 대체하며, **어떤 경우에도 실패를 반환하지 않는다.**

#### description 관련

**`buildSafeChineseDescription(row, workingAddress, finalFirstMenu, finalTreatMenu)`**
한국어 원문 문장을 절대 복사하지 않고 완전히 새로 중국어 문장을 조립한다. `workingAddress`(이미 `sanitizeTranslatedAddress()`로 정제된 주소), `finalFirstMenu`/`finalTreatMenu`(이미 `assembleMenuItemsField()`로 조립된 메뉴)에서 `extractMenuChineseDisplayName()`으로 대표 메뉴의 중국어 부분만 뽑아 4가지 템플릿(주소+메뉴 모두 있음/주소만/메뉴만/둘 다 없음) 중 하나로 문장을 생성한 뒤, `collectRequiredFixedFoodTermsForDescription(row.description)`이 반환한 고정 음식 키워드 중 아직 문장에 없는 것을 `相关菜品包括...。` 형태로 덧붙인다.

**`collectRequiredFixedFoodTermsForDescription(originalDescription)`**
`validateFixedFoodNames()`와 동일한 longest-match 로직(`isSubsumedByLongerFixedTerm()` 재사용)을 쓰되, 검증 대신 **필요한 중국어 키워드 목록을 수집**하는 함수다. 예를 들어 원문에 `고추탕수육`이 있으면 `탕수육`의 키워드는 요구하지 않고 `고추탕수육`의 키워드(`韩式辣椒糖醋肉`)만 목록에 넣는다.

**`extractMenuChineseDisplayName(finalMenuValue)`**
조립된 메뉴 문자열의 첫 항목에서 마지막 `（원문）` 부분만 잘라내고 앞의 중국어 설명만 반환한다(`buildSafeChineseDescription()`에서 대표 메뉴 이름을 뽑는 데 사용).

#### address 관련

**`sanitizeTranslatedAddress(translatedAddress)`**
주소 문자열에서 `HANGUL_RUN_RE`(전역 플래그 사용, 연속된 한글 구간 전체를 찾음)로 잔존 한글 구간을 찾아 각각 `romanizeHangulForAddress()`로 치환한다. 한글이 아예 없으면 그대로 반환한다. 숫자·중국어·기존 로마자·구두점은 전혀 건드리지 않는다.

**`romanizeHangulForAddress(run, precededByDigit)`**
한글 구간 하나(`run`)를 로마자로 변환한다. `precededByDigit`(직전 문자가 숫자인지)가 true이고 `run`이 정확히 `길`이면 `街`, `층`이면 `楼`로 치환한다(둘 다 로마자가 아니라 중국어로 치환). 그 외에는 `ADDRESS_SUFFIX_ROMANIZATIONS`(`대로`→`daero`, `로`→`ro`, `동`→`dong`, `가`→`ga`, 긴 접미사부터 검사)로 어간+접미사를 하이픈으로 연결한 로마자를 만든다(예: `한강대로`→`Hangang-daero`). 어느 접미사에도 해당하지 않으면 전체를 `romanizeAddressSyllable()`로 음절 단위 로마자 변환 후 첫 글자만 대문자화한다. 이 로마자 변환 코드(`ADDRESS_ROMAN_INITIALS`/`ADDRESS_ROMAN_MEDIALS`/`ADDRESS_ROMAN_FINALS`)는 **address 전용으로 새로 작성된 것**이며, name에서는 절대 사용되지 않는다(name의 로마자 fallback은 별도 작업에서 완전히 삭제됨 — 4.7절 참고).

#### 운영정보(open_time/rest_date) 관련

**`replaceKnownScheduleTerms(value)`**
`OPERATING_SCHEDULE_TERM_MAP`(전화문의 요망/브레이크타임/라스트오더/매주 요일 7종/단독 요일 7종/연중무휴/명절·설날·추석·공휴일/평일·주말·점심·저녁/상시·수시·변동·유동적/휴무·휴점·영업·운영 등, 긴 표현을 배열 앞쪽에 배치)을 순서대로 `split/join`(정규식 아님, `설·추석 연휴`의 `·` 같은 특수문자 이스케이프 불필요)으로 전역 치환하는 순수 함수.

**`sanitizeChineseOperatingSchedule(originalValue, translatedValue)`**
`translatedValue`가 `null`이면 `null`을, 한글이 없으면 그대로 반환한다. 한글이 있으면 `replaceKnownScheduleTerms()`로 치환한 뒤, `hasExactlySameNumberTokens(translatedValue, replaced)`와 `preservesDaysAndTimes(translatedValue, replaced)`로 **치환 전후 숫자·요일이 완전히 같은지** 방어적으로 재확인한다. 조금이라도 달라지면(이론상 일어나지 않아야 하지만) 치환 결과를 버리고 원래 `translatedValue`를 그대로 반환해, 최종 `preservesDaysAndTimes(row.open_time, restored.open_time)` 같은 기존 hard validation이 그 값을 보고 실패를 결정하게 한다.

#### parking/packing/tags 관련

**`sanitizeOperatingInfoValue(originalValue, translatedValue)`** / **`sanitizeTags(originalTags, translatedTags)`**
`OPERATING_INFO_ZH_MAP`(가능/불가능/가능(일부 메뉴)/일부 가능/전화문의)과 `TAG_ZH_MAP`(음식점/사진 있음/위치 있음/메뉴 정보 있음/주차 가능/포장 가능)을 이용해, 한글이 남은 값을 **원본 한국어 값 기준으로** 매핑한다. 매핑되지 않는 값은 parking/packing은 `请咨询`으로, tags는 해당 태그만 배열에서 제외한다.

#### 최종 게이트

**`validateTranslation(row, raw)`**
모든 로직을 하나로 묶는 함수로, 아래 4.3절의 파이프라인 순서로 재작성되었다. 자동복구 단계는 절대 실패를 반환하지 않고, 마지막 단계에서만 실패 가능한 hard validation을 수행한다.

### 4.3 Validation 파이프라인의 변화

**기존 (자동복구 도입 이전)**

```
모델 출력
  → Validation (숫자/요일/한글/형식 등 전부 한 번에 확인)
    → 하나라도 실패
      → 행 전체 실패 (failed)
        → 다음 배치 실행에서 동일 place_id 재시도
```

**현재 (자동복구 도입 이후)**

```
모델 출력(raw)
  → 1. JSON 구조 검사 (isRawModelOutputShape) — 실패 시 즉시 hard failure
  → 2. 메뉴 자동조립 (assembleMenuItemsField) — 항상 성공
  → 3. name 코드 생성 (buildFinalName, raw.name 무시) — 항상 성공
  → 4. null 원복 (restoreNullsFromSource)
  → 5. address 자동복구 (sanitizeTranslatedAddress)
  → 6. description 자동복구 (buildSafeChineseDescription, 조건부)
  → 7. address 자동복구 재적용 (동일 함수, 순서상 재확인)
  → 8. parking/packing/tags 자동복구 (sanitizeOperatingInfoValue, sanitizeTags)
  → 9. open_time 자동복구 (sanitizeChineseOperatingSchedule)
  → 10. rest_date 자동복구 (sanitizeChineseOperatingSchedule)
  → 11. 핵심 Validation 재실행
        (name 정책 / null 보존 / 주소 숫자 / 서울 / 자치구 /
         고정 음식명(방어적) / 번체자 / 요일·시간 /
         zh-CN 한글 잔존(방어적) / 길→吉·吉尔)
    → 전부 통과 → 저장 승인 (ok: true)
    → 하나라도 실패 → Hard Failure (ok: false) → corrective retry 또는 실패 기록
```

가장 중요한 차이는, **자동복구로 해결 가능한 문제는 애초에 "실패"라는 상태에 도달하지 않는다**는 점이다. 검증은 사라진 것이 아니라, 자동복구된 값을 대상으로 그대로 다시 실행된다.

### 4.4 description 자동생성 정책

- 원본 한국어 문장을 절대 그대로 복사하지 않는다 — 항상 새로 조립한다.
- 결과는 100% 중국어 문장이어야 한다.
- `workingAddress`(자동복구된 주소)를 문장에 사용할 수 있다.
- 조립된 `first_menu`/`treat_menu`의 첫 항목에서 뽑은 대표 메뉴 중국어 이름을 사용할 수 있다.
- `FOOD_NAME_ZH_MAP` 기준으로 원문에 있는 고정 음식명은 반드시 결과 문장에 포함되도록 보장한다(`collectRequiredFixedFoodTermsForDescription`).
- 전문성/인기/역사/전통 등 원문에 없는 과장된 표현을 생성하지 않는다(프롬프트의 `[Description]` 규칙으로 모델에게도 동일하게 지시, 자동생성 시에도 템플릿에 그런 문구를 넣지 않음).
- 존재하지 않는 정보를 새로 만들어내지 않는다 — 주소/메뉴/고정 키워드가 전혀 없으면 `该餐厅是一家韩国餐厅。`라는 최소한의 사실만 담은 문장으로 대체한다.

### 4.5 menu fallback 정책

- `FOOD_NAME_ZH_MAP` 고정 매핑이 최우선이며 모델 출력과 무관하게 강제 적용된다(`applyFixedFoodNameOverride`, 이번 작업에서 변경하지 않음).
- 고정 음식이 아니고 모델 결과가 형식·한글 조건을 모두 만족하면 모델 결과를 그대로 사용한다.
- 조건을 만족하지 못하면 `classifyMenuFallbackCategory()`의 카테고리 기반 fallback을 사용한다(구체적인 오역 대신 정직한 넓은 카테고리).
- 모델 배열이 원본보다 짧으면 부족한 인덱스는 fallback으로 채운다.
- 모델 배열이 원본보다 길면 초과 항목은 버린다.
- 결과적으로 최종 메뉴 항목 개수는 **원본 `splitMenuItems()` 개수와 100% 일치**하도록 `assembleMenuItemsField()`가 원본 배열을 기준으로 순회하며 보장한다.

### 4.6 address 자동복구 정책

- **한글로 남아있는 구간만** `sanitizeTranslatedAddress()`/`romanizeHangulForAddress()`로 로마자 변환한다 — 이미 번역된 중국어나 숫자는 건드리지 않는다.
- 숫자는 `hasExactlySameNumberTokens()`가 최종적으로 재확인하며, 자동복구 로직 자체도 숫자를 파싱해 재조립하지 않고 정규식으로 한글 구간만 골라낸다.
- 서울/자치구 중국어 표기는 `validateSeoulCityMapping()`/`validateFixedDistrictMapping()`이 그대로 검증하며, 자동복구가 이 값을 생성하거나 대신 채워주지 않는다(도시/자치구 자체가 틀리거나 없는 경우는 여전히 hard failure).
- `길`은 숫자 뒤에 단독으로 오면 `街`로 치환한다(로마자가 아니라 중국어).
- `대로`/`로`/`동`/`가` 접미사는 어간을 로마자로 바꾸고 하이픈으로 연결한 형태(`daero`/`ro`/`dong`/`ga`)로 처리한다(긴 접미사 `대로`를 짧은 `로`보다 먼저 검사).
- name의 로마자 정책과는 완전히 분리되어 있다 — `ADDRESS_ROMAN_INITIALS`/`ADDRESS_ROMAN_MEDIALS`/`ADDRESS_ROMAN_FINALS`/`romanizeAddressSyllable()`은 이번 작업에서 address 전용으로 새로 작성된 코드이며, name에서는 절대 참조되지 않는다. name은 `buildFinalName()`/`validateNamePolicy()`가 담당하며 항상 중국어 표시명（한국어 원문）형식만 허용한다(이번 작업에서 변경하지 않음).

### 4.7 영업시간(open_time/rest_date) 자동복구 정책

- `replaceKnownScheduleTerms()`가 `OPERATING_SCHEDULE_TERM_MAP`에 등록된 알려진 한국어 표현만 치환한다 — 의미를 모르는 문구는 절대 추측 번역하지 않고 그대로 남긴다.
- `sanitizeChineseOperatingSchedule()`이 치환 전후 숫자 토큰(`hasExactlySameNumberTokens`)과 요일·시간(`preservesDaysAndTimes`)이 완전히 같은지 재확인한다.
- 숫자·요일이 자동복구 과정에서 조금이라도 변경되면 치환 결과를 버리고 원래 모델 출력을 그대로 사용한다(이 경우 최종 hard validation에서 실패가 결정됨).
- 자동복구 이후에도 기존 `preservesDaysAndTimes(row.open_time, restored.open_time)` / `preservesDaysAndTimes(row.rest_date, restored.rest_date)` hard validation이 그대로 다시 실행되어, 요일/시간이 실제로 바뀌거나 누락되거나 추가되면 여전히 실패 처리된다.

---

## 5. 테스트

이 세션에서 직접 수행한 것은 다음과 같다(실제 API 호출·DB 저장은 포함되지 않음).

- **esbuild 구문 검사**: 매 수정마다 전체 파일에 대해 `esbuild.transformSync(src, {loader:'ts', target:'es2022'})`로 TypeScript 문법 오류 여부 확인
- **순수 함수 테스트**: `serve(async (req: Request)` 이전 부분을 esbuild로 CommonJS 변환 후 Node에서 `require()`하여, 아래 항목들을 매 턴 검증
  - 메뉴 관련: `resolveMenuItemTranslation`/`assembleMenuItemsField`의 고정 치환·fallback·배열 길이 부족/초과 처리
  - description 관련: `buildSafeChineseDescription`의 4가지 템플릿, `collectRequiredFixedFoodTermsForDescription`의 longest-match
  - address 관련: `sanitizeTranslatedAddress`/`romanizeHangulForAddress`의 대로/로/동/가/길/층 처리, 숫자 보존
  - open_time/rest_date: `replaceKnownScheduleTerms`/`sanitizeChineseOperatingSchedule`의 12개 사례(브레이크타임/라스트오더 복합 문자열, 매주 일요일 휴무, 연중무휴, 전화문의 요망, 설·추석 연휴, 평일/주말, 시간·요일 변경 시 hard-fail 유지, 의미불명 잔존 한글 실패, null 유지, 이미 완전 중국어인 경우 무변경, 숫자 토큰 동일성)
  - name 정책: `가나돈까스의집`/`가락골마산아구찜`/`가막골흑염소요리전문점` 업종 매칭, `가담`/`가문` → `韩国餐厅` fallback, `Gadam（가담）`/`家淡（가담）`/`家门（가문）` 등 실패 유지
  - 번체자 차단: `麵`/`飯`/`館` 발견 시 실패
  - Hard failure 회귀 테스트: JSON 구조 오류, non-null → null, 주소 숫자 변경, 자치구 오변경, 요일/시간 변경이 자동복구 이후에도 여전히 실패로 유지되는지 확인
- **`npm run build`**: 매 수정마다 성공(기존에 알려진 CSS 경고 2건 외 신규 오류 없음)
- **`git diff --check`**: 매 수정마다 통과

사용자가 별도로 직접 수행하고 이 세션에 보고한 내용(이 세션이 직접 확인한 사실 아님):

- **실제 Supabase 배포**
- **실제 데이터 저장 성공**
- **`limit=30`으로 저장 실행 시 안정적으로 성공**
- **`limit=50`으로 실행 시 HTTP 546 발생** — 정확한 원인은 확인되지 않았으나 Edge Function 실행시간 제한 가능성이 추정되며, 이는 번역 검증 로직과는 별개의 인프라/실행 환경 문제로 파악됨

---

## 6. 결과

- 초기에는 검증 실패가 반복되어 동일 `place_id`가 계속 재시도되는 문제가 있었다(메뉴 형식, description 한글, address 한글, 운영정보 한글 등으로 인한 반복 실패).
- 자동복구 로직(`assembleMenuItemsField`, `buildSafeChineseDescription`, `sanitizeTranslatedAddress`, `sanitizeOperatingInfoValue`, `sanitizeTags`, `sanitizeChineseOperatingSchedule`) 도입 이후, 이런 유형의 언어 정책 오류는 저장 전에 코드 수준에서 자동 수정되도록 설계되었다.
- 핵심 데이터 무결성(숫자, 서울/자치구, 요일·시간, non-null 정책, name 정책, 번체자, `길→吉/吉尟` 오역)은 기존 hard validation으로 계속 보호되며, 이번 작업에서 완화되거나 제거되지 않았다.
- 사용자가 보고한 실제 운영 결과 기준으로, `limit=30` 단위 저장 실행은 안정적으로 성공했다.
- `limit=50` 실행 시 HTTP 546이 발생했으며, 이는 Edge Function 실행시간 제한으로 추정되는 별도의 인프라 문제로, 이번 문서가 다루는 번역 검증/자동복구 로직의 결함으로 확인된 것은 아니다.

---

## 7. 향후 과제

- `limit=50`에서의 HTTP 546 원인을 정확히 규명하고, 필요 시 배치 크기 상한이나 실행 방식(예: 더 작은 단위 반복 실행)을 조정하는 방안 검토
- 자동복구가 실제 운영 데이터에 적용된 이후의 zh-CN `en_count`/`machine_count`/`source_count` 등 실제 저장 통계를 다음 작업일지에서 추적
- `MENU_FALLBACK_CATEGORY_KEYWORDS`/`OPERATING_SCHEDULE_TERM_MAP` 등 고정 사전에 아직 다루지 않는 표현이 실제 운영 중 추가로 발견되면, 사례별 프롬프트 수정이 아니라 이번과 동일하게 고정 사전 확장 방식으로 대응
- 영문 함수(`mg-place-translate-en`)에도 유사한 자동복구 구조 도입 여부는 별도 논의 필요(이번 작업 범위에 포함되지 않았으며, 영문 함수는 전혀 수정되지 않음)

---

## 8. 핵심 성과 요약

`mg-place-translate-zh`의 검증 구조를 "모델 출력이 조금이라도 어긋나면 행 전체 실패"에서 "안전하게 자동복구 가능한 형식/언어 문제는 코드로 교정한 뒤 핵심 데이터 무결성만 재검증"하는 구조로 전환했다. 메뉴 배열 조립(`assembleMenuItemsField`), description 재생성(`buildSafeChineseDescription`), 주소 한글 로마자 변환(`sanitizeTranslatedAddress`), 운영정보/태그 고정 치환(`sanitizeOperatingInfoValue`/`sanitizeTags`), 영업시간 표현 치환(`sanitizeChineseOperatingSchedule`)이라는 5개 영역의 전용 자동복구 로직을 추가하면서도, 숫자·요일·시간·서울/자치구·name 정책·번체자·`吉/吉尟` 오역 등 데이터 무결성에 직결되는 검증은 단 하나도 완화하지 않았다. 이를 통해 동일 `place_id`가 사소한 형식 차이로 반복 실패해 API 토큰과 시간을 낭비하던 문제를 코드 수준에서 해결했다.
