# 51. 핫플레이스 프리셋 확장, 다국어 장소 검색 통합, DB 기반 언어 안내 모달

## 1. 작업 일시

- 작성일시: 2026-07-24 00:11 KST

---

## 2. 작업 배경

`docs/50-map-tab-minimum-rating-filter-and-bottomsheet-header-polish.md` 작성 시점(2026-07-21 23:34 KST)에는 그 문서가 다루는 모든 변경이 워킹 디렉터리에 미커밋 상태로 남아 있었다. 이후 여러 세션에 걸쳐 다음 순서로 작업이 이어졌다.

1. 50번 문서가 다루는 작업(Map 탭 최소 평점 필터, 바텀시트 버그 수정)을 그대로 커밋
2. 그와 별개로, 50번보다 더 이전 세션(49번 문서)에서 이미 끝나 있었지만 그때까지 커밋되지 않고 남아 있던 변경(UnderlineTabs 공용화 등 UI 그룹, mg-place-translate-en 그룹)을 커밋
3. Map 탭 핫플레이스 프리셋에 광장시장·잠실 추가
4. Map 탭 장소 검색을 preset·내부 DB·Kakao 통합 구조로 개선하면서, 언어 선택 모달에서 중국어를 고르면 안내 모달을 띄우는 기능을 함께 추가(최초 구현은 세션당 1회, sessionStorage 기반)
5. 사용자 브라우저 확인 결과 안내 모달이 재선택 시 다시 뜨지 않는 문제가 보고되어, 세션당 1회 제한을 완전히 제거하고 "직접 선택할 때마다 표시"로 정책을 변경
6. 중국어 문구를 프론트에 하드코딩하는 대신 Supabase의 공용 언어별 안내 테이블(`mg_locale_notices`)과 연결해, 관리자가 DB에서 문구·활성 여부·backdrop 동작을 제어할 수 있는 구조로 전환

이 문서는 3~6 단계, 즉 50번 이후 실제로 새로 진행된 작업만을 대상으로 하며, 1~2 단계(50번·49번 문서가 이미 다룬 내용)는 제외한다. 이 문서 작성 시점까지도 `git add`/`commit`/`push`는 3~6단계 중 3, 4단계에 해당하는 두 커밋까지만 수행되었고, 5·6단계(세션당 1회 제거, DB 연동)는 전부 워킹 디렉터리에 미커밋 상태로 남아 있다.

---

## 3. 기준 commit 및 조사 범위

`git log`만으로는 커밋 순서와 문서 내용 순서가 일치하지 않는다는 점을 먼저 확인해야 한다. 실제 커밋 시각 기준:

| commit | 시각(KST) | 제목 | 내용상 위치 |
|---|---|---|---|
| `14a1d92` | 2026-07-21 23:39 | Map 탭 최소 평점 필터 추가 및 바텀시트 버그 수정 | **50번 문서 본문 그 자체** — `docs/50-*.md` 파일 자체(300줄)가 이 커밋에 포함됨 |
| `1eccf37` | 2026-07-21 23:42 | Courses/Phrases 탭 UI 공용화·저장 탭 CTA·Voice Help 안내, mg-place-translate-en 백년가게 처리 | **49번 문서가 이미 다룬 작업** — 커밋 메시지에도 "docs/49에서 정리된 두 그룹을 커밋한다"고 명시. 시각상으로는 14a1d92보다 뒤지만 내용은 50번보다 앞선 세션 |
| `526b32f` | 2026-07-22 00:40 | Map 탭 핫플레이스에 광장시장·잠실 추가 | **51번 범위** |
| `cc703cc` (HEAD) | 2026-07-23 22:54 | 다국어 장소 검색 개선 + 중국어 안내 모달 추가 | **51번 범위** |

즉 `14a1d92`와 `1eccf37`은 커밋된 시각은 다르지만 둘 다 "50번 이전 또는 50번 자체" 작업이라 51번 범위에서 제외해야 하고, 시간순으로 더 늦게 커밋된 `1eccf37`을 기준점으로 잡아야 `git diff 1eccf37..HEAD`가 정확히 51번 범위(526b32f + cc703cc)와 일치한다. `526b32f` 이전 대화에서 언급된 적이 있었지만, 실제로는 `1eccf37`을 커밋 경계로 삼아야 526b32f·cc703cc 두 커밋만 정확히 걸러진다는 것을 `git show --stat`으로 직접 확인했다.

조사에 사용한 명령(전부 읽기 전용):

```
git status --short --untracked-files=all
git branch --show-current
git log --oneline --decorate --graph -30
git log --date=iso --pretty=format:"%h %ad %s" -15
git show --stat <commit>
git show --name-status <commit>
git diff 1eccf37..HEAD --stat
git diff 1eccf37..HEAD -- <file>
git diff --stat / git diff / git diff --cached
git fetch origin main (읽기 전용, push 아님)
git rev-parse HEAD origin/main
```

조사 결과, **51번 범위 = `1eccf37..HEAD`의 커밋 2개(`526b32f`, `cc703cc`) + 현재 워킹 디렉터리의 미커밋 변경 전체**로 확정했다.

---

## 4. 50번 이후 commit 이력

### `526b32f` — Map 탭 핫플레이스에 광장시장·잠실 추가 (2026-07-22 00:40:16 +0900)

| 파일 | 변경 |
|---|---|
| `.gitignore` | TourAPI 배치 산출물 데이터 파일 패턴 4줄 추가 |
| `src/features/explore/data/locations.js` | `gwangjang_market`, `jamsil` 두 항목 추가(이 시점에는 `aliases`/`kakaoSearchKeyword`/`districtKo` 없이 기본 필드만) |
| `src/shared/i18n/dictionary.js` | `location.title`(ko)을 "기준 위치 선택" → "핫플레이스"로 변경 |

### `cc703cc` — 다국어 장소 검색 개선 + 중국어 안내 모달 추가 (2026-07-23 22:54:58 +0900)

| 파일 | 변경 |
|---|---|
| `src/features/explore/data/locations.js` | 12개 preset 전체에 `districtKo` 추가, `gwangjang_market`/`jamsil`에 `aliases`/`kakaoSearchKeyword` 추가 |
| `src/features/explore/services/placeSearchService.js` | 신규 파일(298줄) — preset/내부 DB/Kakao 통합 검색 |
| `src/features/explore/components/SearchOverlay.jsx` | preset/internal-place/kakao 결과 병합, stale-response 가드, 중복 배지 로직 재작업 |
| `src/features/explore/components/LanguageModal.jsx` | `onLanguageSelected(code)` 콜백 prop 추가 |
| `src/pages/HomePage.jsx` | 중국어 안내 모달 상태·핸들러 추가(당시엔 세션당 1회, sessionStorage 기반) |
| `src/shared/i18n/dictionary.js` | `language.chineseNoticeTitle`/`chineseNoticeBodyLine1`/`chineseNoticeBodyLine2` en/ko/zh-CN 9줄 추가 |

이 커밋의 세션당 1회(sessionStorage) 정책은 이후 미커밋 작업에서 완전히 제거되었다 — §12에서 상세 설명.

### 현재 미커밋 (working tree)

| 상태 | 파일 |
|---|---|
| modified | `src/features/explore/components/Modal.jsx` |
| modified | `src/pages/HomePage.jsx` |
| modified | `src/pages/MyPage.jsx` |
| new (untracked) | `src/api/localeNoticeApi.js` |
| new (untracked) | `src/features/explore/components/LocaleInfoNotice.jsx` |
| new (untracked) | `src/features/explore/hooks/useLocaleNotice.js` |
| new (untracked) | `src/shared/hooks/useEscapeToClose.js` |

`git status`에는 나타나지 않지만 실제로 존재했다가 사라진 파일 — `src/features/explore/components/ChineseInfoNotice.jsx`, `src/shared/utils/chineseInfoNotice.js` — 은 둘 다 한 번도 `git add`된 적이 없어 git 이력 자체에 흔적이 없다(생성 후 같은 미커밋 상태에서 삭제됨). §13에서 시행착오로 설명한다.

---

## 5. 광장시장·잠실 hotplace preset 추가

`src/features/explore/data/locations.js`의 `PRESET_LOCATIONS` 배열에 항목 2개를 최종적으로 아래 값으로 추가했다(정확한 좌표는 요청받은 값 그대로, 반올림 없음).

```js
{ key: 'gwangjang_market', label: 'Gwangjang Market', labelKo: '광장시장', labelZh: '广藏市场',
  lat: 37.5701196320637, lng: 126.999798964693, type: 'area',
  aliases: ['Gwangjang'], kakaoSearchKeyword: '광장시장', districtKo: '종로구' },
{ key: 'jamsil', label: 'Jamsil', labelKo: '잠실', labelZh: '蚕室',
  lat: 37.513859279255, lng: 127.101857941447, type: 'area',
  aliases: ['잠실역', 'Jamsil Station'], kakaoSearchKeyword: '잠실역', districtKo: '송파구' },
```

- 삽입 순서: `dongdaemun, gwangjang_market, yeouido, jamsil`(요청받은 순서 그대로)
- `jamsil`의 좌표는 잠실동 중심이 아니라 잠실역(2호선) 기준 좌표 — 표시 라벨은 여전히 "잠실"/"Jamsil"/"蚕室"
- `LocationSheet.jsx`는 `PRESET_LOCATIONS.map(...)`으로 전체 배열을 그대로 순회하므로, 이 두 항목은 별도 분기 없이 리스트에 자동 노출된다
- 프리셋 선택 → `selectedLocation` 갱신 → 지도 중심 이동·`sortPlacesByDistance`·`buildRecommendedCourses`·코스 제목·저장 코스까지 기존 preset과 완전히 동일한 범용 로직을 그대로 탄다(별도 조건문 없음)
- `aliases`/`kakaoSearchKeyword`/`districtKo`는 이 커밋 시점에는 없었고, 바로 다음(§6) 다국어 검색 작업에서 추가됨 — 즉 "핫플레이스 추가"와 "검색용 메타데이터 보강"은 서로 다른 커밋에서 이뤄졌지만 최종 코드에서는 하나의 preset 객체로 합쳐져 있다
- `LocationSheet` 시트 제목: ko만 "기준 위치 선택" → "핫플레이스"로 변경(en "Choose a hot place", zh-CN "选择热门地点"은 이 범위 이전부터 이미 그 값이었음)

**커밋 포함 여부**: `526b32f`에 기본 필드(key/label/labelKo/labelZh/lat/lng/type)까지, `cc703cc`에 `aliases`/`kakaoSearchKeyword`/`districtKo`까지 나뉘어 커밋 완료.

---

## 6. 장소 검색 통합 구조

`src/features/explore/services/placeSearchService.js`(신규)가 검색 3개 출처를 하나의 결과 리스트로 병합하는 단일 진입점 `buildMergedSearchResults({ query, locale, places, kakaoResults })`을 제공한다.

1. **preset** — `searchPresets(query)`: `PRESET_LOCATIONS` 12개 전체를 대상으로 label/labelKo/labelZh/aliases 중 일치하는 항목, 동기 즉시 반환
2. **내부 DB 음식점** — `searchInternalPlaces(query, places)`: `HomePage`가 이미 들고 있는 `places` 배열(이름/한글명) 대상, 동기 즉시 반환
3. **Kakao 장소 결과** — `searchPlacesByKeyword()`(`kakaoPlaceSearchService.js`, 미수정) 호출 결과, 300ms 디바운스 후 비동기 도착

결과 객체 구조(실제 코드 기준):

```js
// preset
{ resultType: 'preset', id: 'preset:<key>', presetKey, displayName, displayAddress, lat, lng, raw }
// internal-place
{ resultType: 'internal-place', id: 'internal:<id>', internalPlaceId, displayName, displayAddress, lat, lng, raw }
// kakao
{ resultType: 'kakao', id: 'kakao:<id>', internalPlaceId?, matchedNameKo?, displayName, displayAddress, lat, lng, raw }
```

`SearchOverlay.jsx`는 `results = useMemo(() => buildMergedSearchResults(...), [...])`로 세 출처를 한 배열로 렌더링하고, 클릭 시 `entry.resultType`에 따라 분기해 `onSelect()`(`HomePage.handleSearchSelect`)에 넘긴다. `HomePage.handleSearchSelect(loc)`는 `loc.internalPlaceId != null`이면 `places.find(p => p.id === loc.internalPlaceId)`로 anchor를 직접 확정하고, 그렇지 않고 `loc.source === 'search' && loc.categoryGroupCode`인 경우에만 기존 `findAnchorPlace()`(카테고리+150m+이름, **미수정**)로 폴백한다 — internal-place/이미 매칭된 Kakao 결과는 fuzzy 매칭을 다시 타지 않는다.

---

## 7. 다국어 preset 검색과 prefix 변환

preset 검색어(`getPresetSearchTerms`)는 `label`/`labelKo`/`labelZh`/`aliases`를 모두 대상으로 하며, exact(3점) > prefix(2점) > contains(1점) 순으로 점수를 매겨 정렬한다(`scoreTermMatch`, `searchPresets`).

Kakao에 실제로 보낼 검색어를 고르는 `resolveKakaoSearchKeyword(query)`는 이와 별도의, 더 보수적인 로직이다.

- 최소 길이 가드: 라틴 문자 3자, CJK(한글/한자/가나 포함) 2자 미만이면 변환 자체를 시도하지 않음(`MIN_LATIN_KEYWORD_LENGTH=3`, `MIN_CJK_KEYWORD_LENGTH=2`)
- exact match 우선: 정규화한 쿼리가 어떤 preset 검색어와 정확히 같으면(대소문자/공백 무시) 그 preset의 `kakaoSearchKeyword`(없으면 `labelKo`)로 변환
- 그 다음 prefix match: 정확히 1개 preset의 검색어만 그 쿼리로 시작하면 변환. 2개 이상이 동시에 해당하면(예: "seo"가 Seongsu와 Seoul City Hall 둘 다의 prefix) **변환하지 않고 원래 쿼리 그대로 유지**
- 부분 문자열(contains) 매칭은 이 변환 단계에서 절대 사용하지 않음 — "시장"이 "광장시장" 안에 있다고 변환을 트리거하거나, "역"이 "잠실역"의 뒤쪽과 우연히 겹치는 식의 오탐을 막기 위함
- 임의의 외국어 문자열을 통째로 번역하는 기능이 아니라, **PRESET_LOCATIONS에 등록된 12개 preset의 alias 범위 안에서만** 변환이 일어난다

실제 지원 확인된 예(당시 검증용 Node 스크립트로 확인, 스크립트 자체는 저장하지 않음):

| 입력 | 변환 결과 | 비고 |
|---|---|---|
| `gwangja` | 광장시장 검색어로 변환 | prefix 매칭 |
| `gwangjang` | 광장시장 검색어로 변환 | prefix 매칭 |
| `广藏市` | 광장시장 검색어로 변환 | CJK 최소 2자 통과 |
| `广藏市场` | 광장시장 검색어로 변환 | exact 매칭 |
| `jam` | 잠실역 검색어로 변환 | prefix 매칭 |
| `seong` | 성수 관련 검색어로 변환 | prefix 매칭 |
| `jong` | 종로 관련 검색어로 변환 | prefix 매칭 |
| `seo` | **변환 안 됨**(원문 그대로 Kakao 전송) | Seongsu/Seoul City Hall 양쪽에 걸치는 모호한 prefix — 안전장치가 작동한 사례 |

---

## 8. stale response 방지

`SearchOverlay.jsx`는 preset/internal-place는 동기, Kakao만 비동기이므로 두 종류의 시간차 문제를 모두 방어한다.

- **디바운스**: 쿼리 입력마다 300ms `setTimeout` 후에만 Kakao를 호출(`timerRef`로 이전 타이머 clear)
- **request sequence ref**: `requestSeqRef.current`를 쿼리 변경/재오픈마다 증가시키고, Kakao 응답이 도착했을 때 `requestSeqRef.current === mySeq`인 경우에만 `kakaoState`에 반영 — 빠르게 입력하거나 지운 뒤 늦게 도착한 이전 응답은 버려짐
- **userQuery 매칭**: `kakaoState = { userQuery, data }`로 저장해, 렌더링 시점에 `kakaoState.userQuery === trimmedQuery`일 때만 그 데이터를 사용(`kakaoRaw`) — 시퀀스가 우연히 맞아도 쿼리 자체가 다르면 사용하지 않는 이중 방어
- **동기/비동기 병합**: preset·internal-place 결과는 `useMemo`로 매 렌더 즉시 계산되어, Kakao 응답이 느리거나 아직 안 와도(`searching===true`) 화면에 먼저 표시된다

---

## 9. 검색 결과 병합 및 dedupe

초기 구현의 문제: preset 이름을 포함(substring)하기만 해도 Kakao 결과를 중복으로 간주해 제거 — "광장시장 동문", "광장시장 서문", "광장시장 전골목" 같은 실제로는 서로 다른 Kakao 결과가 "광장시장"이라는 이름을 포함한다는 이유만으로 사라졌고, "잠실역 2호선"/"잠실역 8호선"도 마찬가지로 "잠실역" preset alias에 의해 사라졌다.

최종 dedupe 조건(`kakaoMatchesPreset`)은 다음 **둘 다** 충족해야 preset과 동일한 결과로 보고 제거한다.

1. 이름 완전 일치(exact) — `normalizeSearchText(kakaoResult.place_name) === normalizeSearchText(term)`, `term`은 preset의 label/labelKo/labelZh/aliases 중 하나
2. 거리 300m 이내(`PRESET_DEDUPE_RADIUS_KM = 0.3`, `calcDistanceKm()`)

부분 이름 일치(`includes`/`startsWith` 방향 어느 쪽으로도)는 최종 dedupe 로직에서 전혀 사용하지 않는다 — "광장시장 동문" 등은 이름이 정확히 같지 않으므로 이제 정상적으로 검색 결과에 남는다.

---

## 10. 내부 DB 음식점 검색

`searchInternalPlaces(query, places)`:

- 대상 필드: `place.name`(현재 locale로 번역된 이름), `place.nameKo`(한국어 이름) 둘 다에 대해 exact>prefix>contains 채점
- 최소 쿼리 길이: 2자(`MIN_INTERNAL_QUERY_LENGTH = 2`) — 1글자만으로 약 1,633개 장소 전체를 훑는 것을 방지
- 최대 결과 수: 5개(`MAX_INTERNAL_RESULTS`)
- 좌표(`latitude`/`longitude`) 또는 이름이 없는 place는 처음부터 후보에서 제외
- 결과의 `internalPlaceId`는 `HomePage.handleSearchSelect()`에서 `places.find(p => p.id === internalPlaceId)`로 anchor를 **직접** 확정하는 데 쓰임 — 카테고리/거리/이름 기반 fuzzy 매칭(`findAnchorPlace`)을 다시 타지 않음
- Kakao 결과 중 내부 DB 장소와 매칭되는 것(`findAnchorPlace(kakaoResult, places)`)은 이름/주소를 내부 DB 값으로 표시하고, 이미 internal-place 결과로 나온 것과 같은 place면 중복 제거(`usedInternalIds`)

**미검증**: 이 항목은 실제 브라우저에서 한글/영문/중문 다양한 내부 DB 음식점 이름으로 직접 검색해보지 못했다 — 코드 로직만 확인한 상태다.

---

## 11. preset 주소 fallback

**문제**: 기존 `resolvePresetDisplayAddress()`는 Kakao 결과 중 preset과 이름이 정확히 일치하는 대표 결과가 있을 때만 그 주소를 표시했다. 광장시장은 Kakao에 "광장시장"이라는 정확히 같은 이름의 결과가 존재해 주소가 나왔지만, 성수·종로·홍대·강남 등은 Kakao에 정확히 같은 이름의 결과가 없어(예: "성수역 2호선"은 있어도 "성수"라는 정확한 이름은 없음) 주소가 계속 비어 있었다.

**수정**: 12개 preset 전체에 `districtKo`(서울 행정구 이름) 필드를 추가하고, `formatPresetFallbackAddress(preset, locale)`을 신규 도입했다.

```js
function formatPresetFallbackAddress(preset, locale) {
  if (!preset.districtKo) return null;
  if (locale === 'ko') return `서울 ${preset.districtKo}`;
  const districtEn = SEOUL_DISTRICT_EN[preset.districtKo];
  return districtEn ? `Seoul · ${districtEn}` : null;
}
```

`resolvePresetDisplayAddress()`의 최종 우선순위:

1. 이름 완전 일치 + 300m 이내 Kakao 대표 결과가 있으면 그 결과의 실제 주소(ko는 원문 그대로, en/zh-CN은 `formatSeoulDistrictAddress()`로 구 단위 영문 변환)
2. 없으면 `formatPresetFallbackAddress()` — ko는 `서울 {구}`, en/zh-CN은 기존 `SEOUL_DISTRICT_EN` 테이블을 재사용한 `Seoul · {District}` 형식(zh-CN 전용 새 행정구역 번역 테이블은 추가하지 않음)

최종 코드(`placeSearchService.js`)에 그대로 남아 있음을 재확인했다.

---

## 12. locale 안내 모달 UX — 정책 변경 과정과 최종 형태

### 시행착오 — 세션당 1회(sessionStorage)

`cc703cc` 커밋 시점의 최초 구현은 언어 선택 모달에서 zh-CN을 처음 고를 때만 안내 모달을 띄우고, `sessionStorage`에 `matgil_zh_info_notice_seen` 키를 저장해 같은 세션에서는 이후 다시 zh-CN을 골라도 뜨지 않도록 했다. 사용자가 재선택 시 다시 뜨지 않는 문제를 지적해, 이 세션당 1회 게이트는 **완전히 제거**되었다.

### 최종 정책

- ko → zh-CN, zh-CN → en → zh-CN, zh-CN → ko → zh-CN, 이미 zh-CN인 상태에서 zh-CN을 다시 선택 — 모든 경우에 **매번** 다시 조회하고 활성 안내가 있으면 매번 표시
- 앱 최초 로드, zh-CN 상태에서 새로고침, locale 상태 복원, 컴포넌트 재렌더링, 페이지 이동 — 이 중 어느 것도 안내 모달을 자동으로 띄우지 않음(오직 `LanguageModal`의 선택 버튼 클릭 이벤트에서만 조회)
- `sessionStorage`/`localStorage`는 이 안내 기능에서 완전히 미사용(확인 방법은 §20)

### 다시 한번, 왜 중국어 전용에서 공용 구조로 갔는지

애초 세션당 1회 로직 자체를 없앤 것과 별개로, "중국어만" 하드코딩된 조건(`code === 'zh-CN'`)도 함께 제거하고 DB 행 존재 여부가 노출을 결정하는 구조(§13)로 바꿨다 — 이 두 변경은 같은 미커밋 작업 안에서 순차적으로 이뤄졌다.

---

## 13. 중국어 전용에서 공용 locale notice로 전환

### 컴포넌트

- `src/features/explore/components/ChineseInfoNotice.jsx` — **시행착오**. `t('language.chineseNotice...')`로 dictionary 문구를 직접 읽는, zh-CN에 종속된 컴포넌트로 잠깐 존재했으나 한 번도 `git add`되지 않은 채로 삭제됨. git 이력에 전혀 남아 있지 않다(§4 참고).
- `src/features/explore/components/LocaleInfoNotice.jsx`(신규, 최종) — `{ title, message, onClose }` 3개 prop만 받는 순수 프레젠테이션 컴포넌트. locale이나 dictionary를 전혀 참조하지 않는다.

```jsx
export default function LocaleInfoNotice({ title, message, onClose }) {
  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1.5 pt-5">
        <h2 className="font-display text-[1.15rem] font-bold tracking-tight text-ink">{title}</h2>
        <button type="button" aria-label="Close" onClick={onClose} className="shrink-0 p-1 text-ink-soft"><CloseIcon /></button>
      </div>
      <div className="px-5 pb-6 pt-1">
        <p className="whitespace-pre-line text-[0.85rem] leading-relaxed text-ink-soft">{message}</p>
      </div>
    </>
  );
}
```

DB의 `message` 컬럼에 담긴 `\n` 줄바꿈은 `message.split('\n')`으로 배열을 만들지 않고 `whitespace-pre-line` CSS만으로 그대로 렌더링한다. X 버튼 디자인·`aria-label="Close"`는 기존 그대로 유지했다.

### 상태

- `showChineseInfoNotice`(boolean) — **제거**
- `localeNotice`(객체 또는 `null`) — **최종**. `null`이면 모달 닫힘, DB에서 조회된 `{ locale, noticeKey, title, message, dismissOnBackdrop }` 객체면 모달 표시. show/title/message/backdrop을 따로 분리한 여러 state 대신 이 하나의 객체 state로 관리한다.

### 향후 확장성

`ja`(일본어) 등 새 locale의 안내가 필요해지면 프론트 코드를 전혀 수정하지 않고 `mg_locale_notices`에 행만 하나 추가하면 자동으로 같은 방식이 적용된다 — locale별 조건문이 코드 어디에도 없기 때문이다.

---

## 14. Modal backdrop 처리

`src/features/explore/components/Modal.jsx`의 `variant="center"` 분기는 원래 다음과 같은 구조였다.

```jsx
<div className="absolute inset-0 flex items-center justify-center p-7">
  <div className="modal-center ...">{children}</div>
</div>
```

이 중앙 정렬용 `absolute inset-0` wrapper가 실제 backdrop(`<button aria-label="Close" className="modal-back absolute inset-0 ...">`) 위에 그대로 겹쳐, 바깥 어두운 영역을 클릭해도 이 wrapper가 클릭을 가로채면서 아무 핸들러가 없어 닫히지 않는 문제가 있었다.

최종 수정은 전역 기본값을 바꾸지 않고 옵트인 prop을 추가하는 방식이다.

```jsx
export default function Modal({ open, onClose, variant = 'sheet', fullHeight = false, draggableClose = false, dismissOnBackdrop = false, children }) {
  ...
  <div
    className="absolute inset-0 flex items-center justify-center p-7"
    onClick={dismissOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
  >
    <div className="modal-center ...">{children}</div>
  </div>
}
```

- 기본값 `false` — 기존 center 모달(`AuthRequiredModal`, `DeleteReviewConfirmModal`, `DeleteAccountView`)은 prop을 넘기지 않으므로 동작이 전혀 바뀌지 않음
- `e.target === e.currentTarget` 체크로 내부 패널(`modal-center` 카드) 클릭은 wrapper까지 이벤트가 버블링돼도 무시 — 패널 안 클릭으로 닫히지 않음
- X 버튼 닫기는 각 컨텐츠 컴포넌트(`LanguageModal`, `LocaleInfoNotice`)가 각자 `onClose`를 호출하는 기존 방식 그대로
- ESC는 `Modal.jsx` 자체에는 원래도 어떤 variant에도 내장돼 있지 않다 — 대신 신규 공용 훅 `src/shared/hooks/useEscapeToClose.js`(`active`가 true인 동안만 `window`에 keydown 리스너를 걸고, `onClose`는 항상-최신 ref로 참조)를 `HomePage`/`MyPage`가 각각 `localeNotice` 표시 여부에 걸어 사용
- `variant="sheet"`(FilterSheet, LocationSheet 등)는 이 변경의 영향을 받지 않는다 — 애초에 시트 자체가 화면 하단 일부만 덮으므로 배경 클릭은 원래부터 정상 동작
- `dismissOnBackdrop`이 실제로 적용된 곳은 `HomePage`/`MyPage`의 언어 선택 모달(하드코딩 `true`)과 locale notice 모달(`localeNotice?.dismissOnBackdrop ?? false`, DB 값) 2×2 = 4곳뿐이며, 그 외 위험한 확인/삭제 모달에는 전혀 적용하지 않았다

이 변경은 **현재까지 100% 미커밋 상태**다(`git diff 14a1d92..HEAD -- Modal.jsx`가 빈 결과 — 즉 지금까지 커밋된 어떤 커밋에도 `dismissOnBackdrop` 관련 코드가 없다).

---

## 15. Supabase `mg_locale_notices` 구조

이 세션에서 SQL을 직접 실행하지 않았다(요청받은 대로 DB 변경 금지). 아래는 이전 세션에서 이미 구성되어 사용자가 확정해 전달한 실제 운영 DB 구조를 그대로 기록한 것이며, 저장소 안에는 이 테이블을 만드는 마이그레이션 SQL 파일이 존재하지 않는다(Supabase SQL Editor에서 직접 실행된 것으로 보임).

### `public.mg_locale_notices`

| 컬럼 | 설명 |
|---|---|
| `id` | PK |
| `locale` | 언어 코드(`zh-CN` 등) |
| `notice_key` | 안내 종류 구분 키(현재 `search_data_notice`) |
| `is_enabled` | 활성 여부 — 일반 사용자에게 노출할지 |
| `title` | 안내 제목 |
| `message` | 안내 본문(`\n` 줄바꿈 포함 가능) |
| `dismiss_on_backdrop` | 바깥 클릭으로 닫히는지 여부 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각(자동 갱신, §16) |

제약: PK, `UNIQUE(locale, notice_key)`(같은 locale·같은 안내 종류는 한 행만), 빈 문자열 방지 CHECK 제약, RLS 활성화.

**현재 데이터** 1행: `locale='zh-CN'`, `notice_key='search_data_notice'`, `is_enabled=true`, `dismiss_on_backdrop=true`, `title='中文信息提示'`, `message`는 아래 2줄(`\n` 구분):

```
目前正在逐步补充中文地点信息。
若未能搜索到您想找的地点，请使用英文字母输入地点名称进行搜索。
```

이 안내가 다루는 범위는 음식점(`mg_places`)만이 아니라 preset·검색 전반의 일반 장소 정보를 포함한다.

---

## 16. 관리자 권한과 RLS

### `updated_at` 자동 갱신

`set_mg_locale_notices_updated_at()` 트리거 함수 — `BEFORE UPDATE`로 걸려 있어 `created_at`은 유지한 채 `updated_at`만 매 수정 시 현재 시각으로 갱신한다.

### 관리자 판별 구조

`mg_user_profiles`에 role/is_admin 컬럼이 없어, 별도 관리자 전용 테이블을 신설했다.

- `public.mg_admin_users` — `user_id UUID PK`, `auth.users(id)` FK `ON DELETE CASCADE`, `created_at`. RLS 적용.
- `public.is_mg_admin(...)` — `SECURITY DEFINER`, `search_path` 고정, `authenticated` role에 EXECUTE 권한. `mg_admin_users`에 현재 사용자 UUID가 존재하는지만 검사하므로, 관리자 추가·교체는 이 테이블에 행을 추가/삭제하는 것만으로 가능(코드 배포 불필요).

### `mg_locale_notices`의 RLS 정책 5개

| 정책명 | 대상 | 동작 |
|---|---|---|
| Public can read enabled locale notices | anon, authenticated | `is_enabled = true`인 행만 SELECT |
| MG admins can read all locale notices | authenticated(관리자) | `is_mg_admin()`이 참이면 전체 SELECT(`is_enabled` 무관) |
| MG admins can insert locale notices | authenticated(관리자) | INSERT |
| MG admins can update locale notices | authenticated(관리자) | UPDATE |
| MG admins can delete locale notices | authenticated(관리자) | DELETE |

일반 사용자용 SELECT는 위 두 정책이 **OR**로 결합돼 적용된다 — "활성 행만 보이는 일반 사용자" 정책과 "전체가 보이는 관리자" 정책이 동시에 존재해, 관리자는 비활성 행도 볼 수 있고 일반 사용자는 활성 행만 보게 된다. 이 세션에서는 이 정책들의 SQL을 직접 실행하지 않았고, 사용자가 확정해 전달한 정책명·구조를 그대로 기록했다.

---

## 17. 프론트 DB 연결

### `src/api/localeNoticeApi.js`(신규)

```js
export async function getActiveLocaleNotice(locale, noticeKey = 'search_data_notice') {
  const { data, error } = await supabase
    .from('mg_locale_notices')
    .select('locale, notice_key, title, message, dismiss_on_backdrop')
    .eq('locale', locale)
    .eq('notice_key', noticeKey)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.title || !data.message) return null;
  return { locale: data.locale, noticeKey: data.notice_key, title: data.title, message: data.message, dismissOnBackdrop: data.dismiss_on_backdrop ?? false };
}
```

- `maybeSingle()` 사용 — 이미 `placeApi.js`/`placeBookmarkService.js` 등 기존 코드베이스에 쓰이던 스타일을 그대로 따름(supabase-js 2.108.2에서 정상 지원 확인)
- DB의 snake_case(`notice_key`, `dismiss_on_backdrop`)를 API 경계에서 camelCase(`noticeKey`, `dismissOnBackdrop`)로 정규화 — 컴포넌트까지 snake_case가 퍼지지 않음
- `title`/`message`가 없으면(빈 문자열 등 유효하지 않으면) `null` 반환 — 빈 모달이 뜨는 상황 자체를 API 경계에서 차단
- Supabase 오류는 그대로 `throw` — 오류를 숨기지 않고 호출부(훅)에서 fail-closed 처리

### `src/features/explore/hooks/useLocaleNotice.js`(신규)

```js
export function useLocaleNotice(noticeKey = 'search_data_notice') {
  const [notice, setNotice] = useState(null);
  const requestSeqRef = useRef(0);

  const handleLanguageSelected = useCallback(async (locale) => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await getActiveLocaleNotice(locale, noticeKey);
      if (requestSeqRef.current === seq) setNotice(result);
    } catch (error) {
      console.warn('[useLocaleNotice] failed to load locale notice', error);
      if (requestSeqRef.current === seq) setNotice(null);
    }
  }, [noticeKey]);

  const closeNotice = useCallback(() => setNotice(null), []);
  return { notice, handleLanguageSelected, closeNotice };
}
```

- `requestSeqRef`로 stale response 방지: zh-CN 선택 직후 곧바로 en을 선택하면 각각 별도 시퀀스 번호를 받고, 나중에 도착한 응답이 아니라 **가장 최근에 발급된 시퀀스와 일치하는 응답만** 반영된다 — 늦게 도착한 이전 언어의 응답이 최신 선택을 덮어쓰지 않는다
- DB 행 없음(`is_enabled=false` 포함, RLS로 안 보임)이면 `getActiveLocaleNotice`가 `null` 반환 → `notice`도 `null` → 모달 미표시
- Supabase 오류 시 `console.warn`만 남기고 `notice`를 `null`로 — 빈 모달이나 오류 화면 없이 조용히 실패
- dictionary의 `chineseNotice*` 키는 이 어디에서도 fallback으로 참조하지 않음(§20에서 grep 결과로 재확인)
- 훅은 `sheet`/`langOpen` 같은 페이지 고유의 언어 모달 열림 상태를 전혀 알지 못한다 — 페이지가 먼저 그 상태를 닫고 나서 훅의 `handleLanguageSelected`를 호출하는 구조로 분리

---

## 18. HomePage·MyPage 연결

두 페이지 모두 동일한 패턴이다.

```js
const { notice: localeNotice, handleLanguageSelected: loadLocaleNotice, closeNotice: closeLocaleNotice } = useLocaleNotice();
useEscapeToClose(!!localeNotice, closeLocaleNotice);

async function handleLanguageSelected(code) {
  setSheet(null);            // HomePage: setSheet(null) / MyPage: setLangOpen(false)
  await loadLocaleNotice(code);
}
```

```jsx
<Modal open={sheet === 'language'} onClose={() => setSheet(null)} variant="center" dismissOnBackdrop>
  <LanguageModal onClose={() => setSheet(null)} onLanguageSelected={handleLanguageSelected} />
</Modal>

<Modal open={!!localeNotice} onClose={closeLocaleNotice} variant="center" dismissOnBackdrop={localeNotice?.dismissOnBackdrop ?? false}>
  {localeNotice && <LocaleInfoNotice title={localeNotice.title} message={localeNotice.message} onClose={closeLocaleNotice} />}
</Modal>
```

- `code === 'zh-CN'` 같은 locale 전용 분기는 완전히 제거 — 어떤 코드가 선택되든 동일하게 조회
- ko/en 선택: DB에 해당 locale 행이 없으므로 `null` 반환 → 미표시
- zh-CN 선택: `is_enabled=true` 행이 있으므로 표시
- 향후 `ja` 행이 추가되면 두 페이지 모두 코드 수정 없이 자동으로 같은 방식이 적용됨
- 반복 선택마다 매번 새로 조회 — 세션 게이트 없음
- 새로고침/앱 로드/locale 복원 시 `locale`을 감시하는 effect가 전혀 없으므로 자동 조회·자동 표시 없음
- `dismissOnBackdrop`은 언어 선택 모달은 하드코딩 `true`(기존 요구사항 유지), locale notice 모달은 DB의 `dismiss_on_backdrop` 값을 그대로 사용(`null` 방어로 기본값 `false`)
- `MyPage`는 이전까지 자신만의 `langOpen`/`LanguageModal` 인스턴스가 있었지만 `onLanguageSelected` 콜백이 전혀 연결돼 있지 않아, MyPage에서 언어를 바꿔도 안내 모달이 뜰 수 없는 구조였다 — 이번에 HomePage와 동일한 배선을 추가해 두 진입점 모두에서 동작하도록 했다

---

## 19. 실제 브라우저 검증

아래 항목은 사용자가 실제 브라우저에서 직접 확인 완료한 것으로 전달받았다 — **브라우저 수동 검증 완료**.

- zh-CN 선택 → DB 제목·본문(中文信息提示 등)으로 안내 모달 표시
- 안내 닫고 다시 zh-CN 선택 → 다시 표시
- ko/en 선택 → 안내 모달 미표시
- zh-CN 상태에서 새로고침 → 안내 모달 자동 미표시
- `is_enabled=false`로 임시 변경 → zh-CN 선택해도 미표시(확인 후 `true`로 복구)
- DB 제목/본문을 임시 테스트 문구로 변경 → 코드 재빌드 없이 변경된 문구가 그대로 표시(확인 후 원래 중국어 문구로 복구)
- `dismiss_on_backdrop=false`로 임시 변경 → 바깥 클릭으로 안 닫힘, X 버튼으로는 닫힘(확인 후 `true`로 복구)
- `dismiss_on_backdrop=true` 복구 후 → 바깥 클릭으로 닫힘 확인
- 위 모든 임시 변경은 검증 후 최종 원래 값(zh-CN / search_data_notice / is_enabled=true / dismiss_on_backdrop=true / 원문 제목·본문)으로 복구됨

이 문서 작성을 담당한 이번 세션 자체는 문서 작성만 수행했으며 별도의 브라우저 조작을 하지 않았다.

---

## 20. 승인된 현재 한계

- 내부 DB(`mg_places`)에 중국어 텍스트가 등록된 음식점은 중국어로 검색 가능
- `PRESET_LOCATIONS`에 등록된 12개 핫플레이스는 중국어 별칭(`labelZh`)으로 검색 가능
- 그 외 DB/preset 범위 밖의 순수 Kakao 장소는 중국어 검색이 보장되지 않음(Kakao API 자체가 중국어 키워드를 이해하지 못함 — docs/47에 이미 문서화된 한계)
- 매칭되지 않는 Kakao 결과는 이름이 한국어 그대로 노출되고, 주소만 en/zh-CN에서 영어 행정구역(district) 표기로 폴백됨
- 이번에 DB로 연결한 안내 모달은 이 한계를 감추는 게 아니라 사용자에게 명시적으로 알리는 운영 안전장치이며, 근본적인 해결은 중국어 데이터 자체를 보강하는 것

---

## 21. 변경 파일 종합

| 파일 | 구분 | 비고 |
|---|---|---|
| `.gitignore` | committed | TourAPI 산출물 패턴 (`526b32f`) |
| `src/features/explore/data/locations.js` | committed | 광장시장·잠실 추가(`526b32f`), districtKo/aliases/kakaoSearchKeyword(`cc703cc`) |
| `src/shared/i18n/dictionary.js` | committed | `location.title`(`526b32f`), `language.chineseNotice*` 3키×3locale(`cc703cc`, 현재 미사용으로 남음) |
| `src/features/explore/services/placeSearchService.js` | committed | 신규(`cc703cc`) |
| `src/features/explore/components/SearchOverlay.jsx` | committed | preset/internal/kakao 병합(`cc703cc`) |
| `src/features/explore/components/LanguageModal.jsx` | committed | `onLanguageSelected` prop(`cc703cc`) |
| `src/pages/HomePage.jsx` | committed + uncommitted | 검색 연결·안내 모달 최초 배선(`cc703cc`) → DB 연동/공용 훅으로 교체(미커밋) |
| `src/features/explore/components/Modal.jsx` | uncommitted | `dismissOnBackdrop` prop 전체 |
| `src/pages/MyPage.jsx` | uncommitted | 언어 모달에 `onLanguageSelected` 연결 + locale notice 모달 신규 배선 |
| `src/api/localeNoticeApi.js` | new / uncommitted | `getActiveLocaleNotice()` |
| `src/features/explore/hooks/useLocaleNotice.js` | new / uncommitted | 공용 훅 |
| `src/features/explore/components/LocaleInfoNotice.jsx` | new / uncommitted | 공용 프레젠테이션 컴포넌트 |
| `src/shared/hooks/useEscapeToClose.js` | new / uncommitted | 공용 ESC 훅 |
| `src/features/explore/components/ChineseInfoNotice.jsx` | deleted / 커밋 이력 없음 | 시행착오, git에 한 번도 add된 적 없음 |
| `src/shared/utils/chineseInfoNotice.js` | deleted / 커밋 이력 없음 | 시행착오(세션당 1회 sessionStorage 헬퍼), git에 한 번도 add된 적 없음 |

단순 조사 목적으로만 읽은 파일(`anchorMatchService.js`, `kakaoPlaceSearchService.js`, `FoodCategoryProvider.jsx`, `supabase.js` 등)은 변경이 없으므로 이 표에서 제외했다.

---

## 22. DB 변경 표

| 객체 | 종류 | 주요 내용 |
|---|---|---|
| `mg_locale_notices` | table | 언어·안내종류별 활성/제목/본문/backdrop 설정. `UNIQUE(locale, notice_key)`, 빈 문자열 방지 CHECK, RLS 활성화 |
| `mg_admin_users` | table | 관리자 계정 목록. `user_id UUID PK` → `auth.users` FK `ON DELETE CASCADE` |
| `is_mg_admin` | function | `SECURITY DEFINER`, `mg_admin_users` 존재 여부로 관리자 판별, `authenticated`에 EXECUTE 권한 |
| `set_mg_locale_notices_updated_at` | function | `updated_at` 자동 갱신 |
| (이름 미확인) trigger | trigger | 위 함수를 `mg_locale_notices`에 `BEFORE UPDATE`로 연결 |
| RLS 정책 5개 | policy | 공개 조회(활성 행만) + 관리자 조회/추가/수정/삭제 |

이번 세션에서는 이 표의 어떤 객체도 SQL로 생성·수정하지 않았다 — 전부 이전 세션에서 이미 구성된 상태를 사용자로부터 전달받아 기록한 것이다. 트리거 자체의 실제 이름은 이번 세션에서 직접 조회로 재확인하지 못했다.

---

## 23. git 상태 (문서 작성 직전 기준)

- current branch: `main`
- HEAD: `cc703cc`(다국어 장소 검색 개선 + 중국어 안내 모달 추가)
- 50번 이후 커밋 목록(51번 범위): `526b32f`, `cc703cc`
- modified: 3개(`Modal.jsx`, `HomePage.jsx`, `MyPage.jsx`)
- untracked(신규): 4개(`localeNoticeApi.js`, `LocaleInfoNotice.jsx`, `useLocaleNotice.js`, `useEscapeToClose.js`) — `.claude/worktrees/` 제외
- deleted: 0(git이 추적한 적 없는 두 파일은 상태에 아예 나타나지 않음)
- staged: 없음(`git diff --cached` 결과 없음)
- push 여부: `git fetch origin main` 실행 후 `git rev-parse HEAD origin/main`이 둘 다 `cc703cc`로 동일, `git rev-list --left-right --count HEAD...origin/main` 결과 `0 0` — **`cc703cc`까지는 origin/main에 push되어 있음을 확인**. 그 이후의 모든 미커밋 변경은 당연히 push되지 않은 상태.

---

## 24. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build`(가장 최근 관련 세션 기준) | 성공, 201 modules. 기존에 알려진 CSS 압축 경고 1건 + 500KB 청크 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 이번 문서 작성 시점 재실행 — 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| `rg "mg_chinese_notice\|ChineseNoticeApi" src` | 결과 없음 |
| `rg "mg_locale_notices" src` | `localeNoticeApi.js`와 관련 주석에서만 발견, 올바른 위치 확인 |
| `rg "code === 'zh-CN'"` 류 패턴 | 결과 없음(중국어 전용 노출 분기 완전 제거 확인) |
| sessionStorage/localStorage | 안내 관련 코드 전체에서 미사용 확인(`rg "sessionStorage\|localStorage"` 대상 파일 결과 없음) |
| dictionary `chineseNotice*` 키 | 값은 유지, 참조하는 코드 0건(§17에서 fallback 미사용으로 별도 확인) |
| 검색 관련 파일(`SearchOverlay.jsx`, `placeSearchService.js`, `anchorMatchService.js`, `locations.js`, `places/*`) | 이번 DB 연동 작업에서 `git diff --stat` 결과 없음 — 완전 미변경 |

---

## 25. DB·배포·git 작업 여부

- Supabase SQL 실행: 이번 문서 작성 세션에서는 없음(§15~16의 DB 구조는 이전 세션에서 이미 구성된 것을 기록만 함)
- 스키마 변경: 이번 세션 없음
- Edge Function 배포: 없음
- 원격 배포: 없음
- `git add`/`commit`/`push`: 이번 문서 작성 세션에서 전혀 수행하지 않음 — §4의 미커밋 변경 전체가 여전히 워킹 디렉터리에 남아 있다

---

## 26. 후속 과제

아래는 완료된 작업이 아니라 앞으로 남은 과제로만 기록한다.

- 공식 중국어 데이터 57건 상태 확인
- 리뷰 21건 수동 매칭
- 공식 표현 분석
- zh-CN 번역 5건 시험 진행 후 품질 검증
- 품질 검증 통과 후 대량 번역 진행
- 내부 DB 검색 테스트용 음식점 3건 선정 및 실제 브라우저 검증
- 관리자 UI(§27) 구현
- 일본어(`ja`) locale/notice 행 추가 및 동작 확인

---

## 27. 관리자 UI 미구현

현재 완료된 것: `mg_locale_notices` 테이블, RLS 5개 정책, `mg_admin_users`/`is_mg_admin` 관리자 판별 구조, 프론트의 DB 연동(§17~18).

아직 미구현: **실제 관리자 페이지 자체**(`src/pages`에 admin 관련 페이지 없음, 이번 조사로 재확인). 현재는 Supabase Table Editor와 SQL Editor로 직접 관리하고 있다.

향후 관리자 UI가 갖춰야 할 것:

- locale 안내 목록 조회
- 활성화(`is_enabled`) 토글
- 제목/본문 편집
- `dismiss_on_backdrop` 설정
- 새 locale(예: 일본어) 안내 추가
- 관리자 계정 관리(`mg_admin_users` 추가/삭제)
