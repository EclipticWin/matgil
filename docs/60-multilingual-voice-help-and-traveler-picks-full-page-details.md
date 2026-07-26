# 60. 다국어 음성 도움 발화 언어 처리, 여행자픽 공개 동선·가게 전체 화면 상세

## 1. 작업 일시

- 작성일시: 2026-07-27 05:08 KST

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/59-saved-phrases-community-place-link-og-metadata-and-follow-up-ui-polish.md`
- 기준 커밋: `001e659` (`feat: 저장한 표현·커뮤니티 위치 연결 및 공유 메타데이터 추가`) — `git log --oneline -10` 확인 결과 이 문서 작성 시점까지 HEAD가 여전히 `001e659`이며, 그 이후 새 커밋은 없다. 즉 이 문서가 다루는 모든 작업은 전부 워킹 디렉터리에 미커밋 상태로 쌓여 있던 변경이다.
- 작업 범위는 다음 세 가지로 한정한다.
  1. AI 음성 도움(Voice Help) 다국어 발화 언어 처리
  2. 여행자픽 공개 동선(Traveler Picks Routes) 전체 화면 상세
  3. 여행자픽 공개 가게(Traveler Picks Places) 전체 화면 상세

---

## 3. 작업 배경

`docs/59` 이후 별도의 세 세션에 걸쳐 위 세 기능이 순서대로 구현됐다. 세 작업 모두 서로 다른 화면(Phrases 탭의 음성 도움, Explore 탭의 공개 동선 목록, 같은 탭의 공개 가게 목록)을 다루지만, 이 문서 작성 시점까지 하나도 커밋되지 않은 채 같은 워킹 디렉터리에 남아 있었다. 그 사이 이 세 작업과 전혀 무관한 기존 미커밋 변경(일본어 "준비 중" 안내, `PlaceDetailSheet.jsx`/`placeBookmarkService.js`의 가게 저장 수 조회 리팩터링)도 같은 워킹 디렉터리에 섞여 있어, 이번 문서·커밋 작업의 핵심은 "이 세 작업만 정확히 골라 문서화하고 커밋하는 것"이었다.

이 저장소에는 Git worktree가 둘 이상 존재한다(`C:/Workspace/GitWorkspace/matgil`(main), `.claude/worktrees/sprightly-pondering-owl`). 이번 작업 전체에서 `.claude/worktrees` 하위는 전혀 건드리지 않았다.

---

## 4. 이번 문서에서 제외한 항목

`git status --short`로 확인한 현재 워킹 디렉터리 변경 중 아래는 이번 문서·이번 커밋 범위에 **포함하지 않는다.** 아래 파일들은 읽기 전용으로만 대조했을 뿐, 내용을 수정하거나 삭제·복원하지 않았다.

- **일본어("준비 중") 안내 관련 변경** — `src/features/explore/components/LanguageModal.jsx`, `src/features/explore/data/exploreOptions.js`(`COMING_SOON_LANGUAGES`), `src/features/explore/components/JapaneseComingSoonModal.jsx`(신규, 미추적), `src/pages/HomePage.jsx`/`src/pages/MyPage.jsx`의 일본어 안내 연동 부분. 오래전에 이미 완료된 별도 작업이며 이번 세 작업과 무관하다는 지시에 따라 완전히 제외했다.
- **`src/features/explore/components/PlaceDetailSheet.jsx`** — `fetchPlaceBookmarkStatsBatch([place.id])`를 `fetchPlaceBookmarkCount(place.id)`(신규 RPC `get_place_bookmark_count` 기반)로 바꾸는 리팩터링과 import 정렬. 이번 세 작업 중 어느 것도 이 변경을 필요로 하지 않고, 이 세션에서 작성하거나 검증한 적이 없는 코드라 제외했다.
- **`src/features/places/services/placeBookmarkService.js`** — 위와 짝을 이루는 `fetchPlaceBookmarkCount()` 신규 함수 추가분. 같은 이유로 제외했다.
- **`.claude/worktrees/`** — 항상 제외.

---

## 5. AI 음성 도움 발화 언어 명시

### 5.1 변경 전 흐름 / 문제 원인

`src/features/phrases/services/speechRecognitionService.js`의 `startListening()`은 `recognition.lang`을 전혀 지정하지 않았다(주석: `// No lang set — accepts Korean and English input`). Web Speech API는 `lang` 미지정 시 브라우저/시스템 언어를 추측하므로, 한국어 로케일 환경에서 중국어 발화("你好")가 한국어 로마자 표기("니하오")로 오인식되는 문제가 있었다.

### 5.2 변경 후 흐름

```js
export function startListening({ language, onResult, onError }) {
  ...
  recognition.lang = language || 'ko-KR';
  ...
}
```
`continuous`/`interimResults`, `onresult`/`onerror`/`onend` 이벤트 처리는 그대로 유지했다. `language` 인자가 없을 때만 `ko-KR`로 폴백하며, 이는 새 호출부를 위한 기본값이지 "ko-KR이 모든 호출자에게 좋은 추측"이라는 뜻은 아니다 — 저장소 전체 검색 결과 `startListening` 호출부는 `VoiceHelpPlaceholder.jsx` 단 한 곳뿐이며, 이 호출부는 매번 언어를 명시적으로 전달한다.

`src/features/phrases/components/VoiceHelpPlaceholder.jsx`에 발화 언어 선택 상태를 추가했다.

```js
const SPEECH_LANGUAGE_OPTIONS = {
  ko: [{ code: 'ko-KR', labelKey: 'phrases.speakKorean' }],
  en: [
    { code: 'en-US', labelKey: 'phrases.speakEnglish' },
    { code: 'ko-KR', labelKey: 'phrases.speakKorean' },
  ],
  'zh-CN': [
    { code: 'zh-CN', labelKey: 'phrases.speakChinese' },
    { code: 'ko-KR', labelKey: 'phrases.speakKorean' },
  ],
};
const DEFAULT_SPEECH_LANGUAGE = { ko: 'ko-KR', en: 'en-US', 'zh-CN': 'zh-CN' };
```
- `ko` UI locale: `ko-KR` 고정, 별도 선택 UI 없음(기존 화면 그대로 유지).
- `en`/`zh-CN` UI locale: 마이크 버튼 바로 위에 작은 세그먼트 버튼으로 발화 언어(자국어 또는 한국어)를 선택 가능.
- **locale 변경 시 발화 언어 기본값 초기화**:
```js
useEffect(() => {
  setSpeechLanguage(DEFAULT_SPEECH_LANGUAGE[locale] ?? 'ko-KR');
}, [locale]);
```
- 녹음/처리 중(`isListening || isProcessing`)에는 발화 언어 버튼이 `disabled` 처리되어 조작할 수 없다.
- `startListening({ language: speechLanguage, onResult, onError })`로 선택된 언어를 그대로 전달.

### 5.3 수정하지 않은 범위

- `continuous`/`interimResults`, 마이크 버튼 자체의 시작/중지 로직, `isSpeechRecognitionSupported()` 등은 그대로다.
- 자동 언어 감지 기능은 추가하지 않았다 — 사용자가 명시적으로 고른 언어만 사용한다.

---

## 6. Voice Help 응답 구조 일반화 및 원문 보존

### 6.1 변경 전 구조 / 문제 원인

`supabase/functions/mg-voice-help/index.ts`의 기존 응답 필드(`originalPhrase`, `detectedLanguage`, `meaning`, `suggestedReplyKo`, `suggestedReplyRomanization`, `suggestedReplyMeaning`, `note`)는 "추천 답변은 항상 한국어"라는 전제로 설계되어 있었다. 이 구조로는 한국어 점원의 말을 듣고 중국어/영어로 답해야 하는 방향(사용자가 선택한 언어 → 한국어가 아니라, 한국어 → 사용자가 선택한 언어인 경우)을 표현할 수 없었다. 또한 LLM이 `originalPhrase`를 되돌려주는 구조라, 모델이 중국어/영어 원문을 한글 독음으로, 또는 한국어 원문을 로마자로 "번역"해 버릴 위험이 있었다.

### 6.2 변경 후 구조

응답 필드를 방향 중립적으로 재설계했다.

```
originalPhrase, sourceLanguage, meaning, meaningLanguage,
suggestedReply, suggestedReplyLanguage, suggestedReplyPronunciation,
suggestedReplyMeaning, note
```

**원문·언어 라벨은 서버가 강제로 결정하고, LLM에는 애초에 그 필드를 요청하지 않는다.**

```ts
function buildPrompt(input, sourceLanguage, targetLanguageCode) {
  ...
  // originalPhrase, sourceLanguage 등은 JSON 스키마에 아예 없음 —
  // 모델이 "다시 쓸" 기회 자체를 주지 않는다.
  return `...
Return this exact JSON structure:
{
  "meaning": "...",
  "suggestedReply": "...",
  "suggestedReplyPronunciation": "...",
  "suggestedReplyMeaning": "...",
  "note": "..."
}`;
}
```
```ts
async function analyzeVoiceHelp(input) {
  const sourceLanguage = input.sourceLanguage;
  const targetLanguageCode = resolveTargetLanguageCode(sourceLanguage, input.userLanguage);
  const contentResult = await analyzeWithSolar(...) ?? await analyzeWithOpenAI(...);
  return {
    originalPhrase: input.transcript,      // 서버가 강제
    sourceLanguage,                        // 서버가 강제
    meaning: contentResult.meaning,
    meaningLanguage: targetLanguageCode,   // 서버가 강제
    suggestedReply: contentResult.suggestedReply,
    suggestedReplyLanguage: targetLanguageCode, // 서버가 강제
    suggestedReplyPronunciation: contentResult.suggestedReplyPronunciation,
    suggestedReplyMeaning: contentResult.suggestedReplyMeaning,
    note: contentResult.note,
  };
}
```
`resolveTargetLanguageCode(sourceLanguage, userLanguage)`: 발화 언어가 한국어면 `meaning`/`suggestedReply`는 사용자의 앱 언어로, 발화 언어가 사용자의 앱 언어와 같으면 한국어로 — 이 방향 판단도 LLM에 맡기지 않고 서버가 결정론적으로 계산한다.

`sourceLanguage`는 프론트가 보낸 값을 그대로 신뢰하지 않고 서버가 검증한다.
```ts
const ALLOWED_SOURCE_LANGUAGES = ["ko-KR", "en-US", "zh-CN"];
function normalizeSourceLanguage(raw, userLanguage) {
  if (ALLOWED_SOURCE_LANGUAGES.includes(raw)) return raw;
  return USER_LANGUAGE_TO_SOURCE[userLanguage] ?? "ko-KR";
}
```

`suggestedReplyPronunciation`은 `suggestedReplyLanguage === 'ko'`일 때만 의미가 있고, 그 외에는 빈 문자열이 정상이다(필수 검증 대상에서 제외, `meaning`/`suggestedReply`/`suggestedReplyMeaning`만 필수 문자열로 검증).

### 6.3 프론트 반영

`VoiceHelpPlaceholder.jsx`의 예시 카드·실제 결과 카드가 전부 새 필드명(`display.originalPhrase`/`display.meaning`/`display.suggestedReply`/`display.suggestedReplyLanguage`/`display.suggestedReplyPronunciation`/`display.suggestedReplyMeaning`)만 사용하도록 교체했다. **한국어 TTS 버튼은 `suggestedReplyLanguage === 'ko'`일 때만 표시**된다.
```jsx
{isDone && displayReplyIsKorean && (
  <button onClick={() => speakKorean(result.suggestedReply)}>...</button>
)}
```
비한국어 추천 답변은 텍스트로만 표시되고 `speakKorean()`이 호출되지 않는다 — 잘못된 언어를 한국어 TTS로 잘못 읽는 사고를 막는다.

### 6.4 재사용한 기존 구조 / 수정하지 않은 범위

- Solar 우선 호출 → 실패 시 OpenAI fallback(각 최대 1회, 합 ≤2회) 구조, API 키/모델명(`solar-pro`/`gpt-4o-mini`)/타임아웃(10초)은 그대로 유지했다.
- `isSpeechRecognitionSupported()`, 오류 코드 분기(`not-allowed`/그 외), 빈 transcript 처리는 그대로다.
- 새 다국어 TTS 서비스는 만들지 않았다 — 한국어가 아닌 추천 답변은 텍스트만 표시.

### 6.5 브라우저별 한계 / 미검증

- Safari/iOS의 `webkitSpeechRecognition` 지원 편차, `recognition.lang`을 실제로 얼마나 엄격히 따르는지는 브라우저 엔진에 달려 있어 완전한 보장은 못 한다.
- 사용자가 고른 발화 언어와 실제 말한 언어가 다르면 여전히 오인식될 수 있다(자동 언어 감지를 의도적으로 추가하지 않았으므로 예정된 한계).
- **이 문서 작성 시점 기준, 실제 브라우저에서 발화 테스트는 아직 수행되지 않았다**(§16 참고). `npm run build` 성공은 코드가 문법적으로 정상 빌드된다는 것만 보장하며 음성 인식 정확도를 검증하지 않는다.

---

## 7. 여행자픽 공개 동선 전체 화면 상세

### 7.1 변경 전 흐름 / 문제

`PublicRoutesTab.jsx`의 카드 클릭은 곧바로 `navigate(ROUTES.home, { state: { savedCourse: {...} } })`로 Map 탭(`/`)에 스냅샷을 넘겨, `HomePage` → `NearbySheet`(`initialCourse`) → `TodayCourseDetail`이 Bottom Sheet로 여는 구조였다. 별도의 "공개 동선 상세" 화면은 존재하지 않았다.

### 7.2 변경 후 흐름 / 신규 라우트

`src/shared/constants/routes.js`:
```js
publicCourseDetail: (publicRouteKey) => `/explore/routes/${encodeURIComponent(publicRouteKey)}`,
publicCourseDetailPattern: '/explore/routes/:publicRouteKey',
```
`publicCourseDetail()`은 실제 URL 생성용(키를 `encodeURIComponent`), `publicCourseDetailPattern`은 라우터 등록 전용 리터럴 패턴이다 — `encodeURIComponent(':publicRouteKey')`처럼 콜론까지 인코딩해 라우트 매칭이 깨지는 실수를 피하기 위해 둘을 분리했다.

`src/app/router.jsx`: `AppLayout` 밖(하단 내비게이션 없는 전체 화면), `*` 와일드카드보다 앞에 등록.
```jsx
<Route path={ROUTES.savedCourseDetail(':id')} element={<SavedCourseDetailPage />} />
<Route path={ROUTES.publicCourseDetailPattern} element={<PublicCourseDetailPage />} />
<Route path={ROUTES.placeDetail(':placeId')} element={<PlaceDetailPage />} />
...
<Route path="*" element={<Navigate to={ROUTES.home} replace />} />
```

`PublicRoutesTab.jsx`의 카드 클릭 핸들러 교체:
```js
function handleViewDetail(row, localizedStops) {
  const snapshot = row.course_snapshot ?? {};
  navigate(ROUTES.publicCourseDetail(row.public_route_key), {
    state: {
      publicCourse: { ...row, course_snapshot: { ...snapshot, stops: localizedStops }, stops: localizedStops },
      sort,
    },
  });
}
```
`ROUTES.home`/`state.savedCourse`는 이 클릭 경로에서 완전히 제거했다(전수 검색으로 확인, §17).

`src/pages/PublicCourseDetailPage.jsx`(신규) — `SavedCourseDetailPage.jsx`의 시각 구조(coral 헤더, 기준 위치·거리·시간, ROUTE STOPS 점선 타임라인, sticky 하단 CTA)를 그대로 재사용하되, `SavedCourseDetailPage` 자체를 재사용하지 않았다(로그인 전용 가드, `mg_saved_courses.id` 기반 조회를 그대로 쓰면 비로그인·공개 데이터를 표현할 수 없어서).

### 7.3 공개 동선 한 건 조회

`src/features/courses/services/publicFeedService.js`에 `fetchPublicCourseByKey(publicRouteKey)`를 추가했다.
```js
export async function fetchPublicCourseByKey(publicRouteKey) {
  if (!publicRouteKey) return null;
  const [popular, latest] = await Promise.all([
    fetchPublicCourseFeed({ sort: 'popular', limit: MAX_PUBLIC_FEED_ITEMS, offset: 0 }),
    fetchPublicCourseFeed({ sort: 'latest', limit: MAX_PUBLIC_FEED_ITEMS, offset: 0 }),
  ]);
  return [...popular, ...latest].find((row) => row.public_route_key === publicRouteKey) ?? null;
}
```
전용 by-key RPC가 존재하지 않아, 기존 `get_public_course_feed` RPC를 popular/latest 각 150건(`MAX_PUBLIC_FEED_ITEMS`)씩 호출해 그 안에서 key를 찾는 임시 방식이다. **승인된 한계**: 두 창 밖에 있는(매우 오래되고 인기 없는) 공개 동선은 여전히 유효해도 "찾을 수 없음"으로 표시될 수 있다. 이 한계와 향후 정식 RPC 제안은 `docs/sql-public-course-detail-rpc-2026-07-27.md`에 별도 문서화했으며, **실제 SQL은 실행하지 않았다.**

`PublicCourseDetailPage`는 `location.state.publicCourse`가 있으면 즉시 첫 화면에 쓰고 fetch를 생략하며, 없을 때(URL 직접 접근/새로고침)만 `fetchPublicCourseByKey()`를 호출한다.

### 7.4 로딩·오류·not found

- 로딩: `SavedCourseDetailPage`와 동일한 중앙 Spinner.
- not found(`fetchPublicCourseByKey`가 `null` 반환): 안내 문구 + "여행자픽으로 돌아가기" 버튼만(재시도 없음).
- 오류(RPC 실패로 throw): 안내 문구 + "다시 시도"(재조회) + "여행자픽으로 돌아가기" 버튼.
- 비로그인: 별도 분기 없이 정상 조회·표시, 로그인 페이지로 리다이렉트하지 않는다.

---

## 8. 공개 동선 카드 전체 클릭 및 접근성

`PublicCourseCard.jsx`를 재구성했다.
- 카드 최상위를 `<div role="button" tabIndex={0} onClick={onViewDetail} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewDetail(); } }}>`로 감쌌다 — 이미지·제목·기준 위치·통계·`CourseStopPath`·빈 여백을 전부 포함.
- 기존에 별도 `<button onClick={onViewDetail}>`이던 정보 영역은 일반 `<div>`로, "동선 상세 보기" 문구는 비인터랙티브 `<span>`으로 바꿔 클릭 핸들러 중복 실행을 없앴다.
- 하트 버튼:
```jsx
<button
  onClick={(e) => { e.stopPropagation(); onToggleHeart(); }}
  onKeyDown={(e) => e.stopPropagation()}
  ...
>
```
click과 keydown 모두 전파를 차단한다 — click만 막으면 하트에 포커스된 채 Enter/Space를 눌렀을 때 keydown이 그대로 부모 카드까지 버블링되어 상세 이동이 함께 발생하는 버그가 있어, keydown도 별도로 막았다.
- `<button>` 안에 `<button>`을 중첩하지 않았다(하트는 `div[role=button]`의 자식일 뿐, 실제 `<button>` 태그끼리 중첩된 적은 없다).

---

## 9. 공개 동선 저장 여부·Remove·View map

- **저장 여부**: 공개 row의 `is_saved`/`my_saved_course_id`를 사용하되, `canRemove = !!user && isSaved && mySavedCourseId != null`로 제한 — `is_saved`인데 삭제할 row id가 없는 이상 상태에서는 Remove를 숨기고 View map 단독 CTA로 처리한다.
- **하단 CTA**: 저장한 사용자는 `Remove`(왼쪽, 중립) + `View map`(오른쪽, coral) 1:1, 그 외(비로그인/미저장)는 `View map` 전체 폭 단독.
- **Remove**: 기존 `RemoveSavedCourseConfirmModal` + `softDeleteSavedCourse({ userId, courseId: mySavedCourseId })`를 그대로 재사용. 성공 시 `row` state를 `{is_saved:false, my_saved_course_id:null, save_count: -1}`로 낙관적 갱신하고 토스트만 잠깐 보여준 뒤 **페이지에 그대로 머문다**(`SavedCourseDetailPage`처럼 `/explore`로 자동 이동하지 않음). 실패 시 상태 유지 + 모달 내 오류 표시.
- **View map**: 클릭 시에만 기존 `navigate(ROUTES.home, { state: { savedCourse: {...} } })` 채널을 그대로 사용 — `HomePage`/`NearbySheet`의 기존 처리 경로를 새로 복제하지 않았다.

---

## 10. 여행자픽 공개 가게 전체 화면 상세

### 10.1 변경 전 흐름 / 문제

`PublicPlacesTab.handleOpen(place)`는 다음과 같았다(전수 조사로 확인, 사용자가 예상한 `initialPlaceId` 직접 전달과는 다른 실제 메커니즘):
```js
function handleOpen(place) {
  setLastPlaceView({ placeId: place.id });
  const singleStopCourse = { title: place.name || '', anchor_label: '', stops: [{ ...place, tint: '#FFE3D4' }], accent: '#F8481F' };
  navigate(ROUTES.home, { state: { savedCourse: singleStopCourse } });
}
```
가짜 1-stop 코스를 만들어 Map 탭으로 보내는 동시에 `setLastPlaceView()`로 `lastPlaceView.js`의 1회성 저장소에 `placeId`를 기록 — `HomePage`가 새로 마운트되며 이 값을 `consumeLastPlaceView()`로 읽어 `initialPlaceId`를 채우고, `NearbySheet`가 `initialCourse`(가짜 코스)에서 해당 stop을 찾아 `PlaceDetailSheet`를 Bottom Sheet로 직접 열었다.

### 10.2 변경 후 흐름

```js
function handleViewDetail(place) {
  navigate(ROUTES.placeDetail(place.id), {
    state: {
      place,
      fromPublicFeed: true,
      returnTo: { pathname: ROUTES.explore, tab: 'places', sort },
    },
  });
}
```
`setLastPlaceView()` 호출과 가짜 1-stop 코스 생성 코드를 전부 제거했다. `place`는 `mergeFeedRows()`가 이미 `getPlacesByIds(placeIds, locale)`로 병합해 둔 실제 place 객체이므로 그대로 `state.place`에 실었다.

**새 Place 상세 페이지는 만들지 않았다** — 기존 `PlaceDetailPage.jsx`(`/places/:placeId`, `PlaceDetailSheet`를 전체 화면으로 감싸는 기존 페이지)를 그대로 재사용했다. 이 페이지의 `getPlaceById(placeId, locale)` 재조회 로직, `state.place`를 첫 화면 fallback으로만 쓰는 기존 로직은 **한 줄도 바꾸지 않았다** — `state.place`가 있으면 즉시 표시하고, `getPlaceById` fetch가 항상 실행되어 최신값으로 덮어쓴다(locale 변경 시에도 재실행).

### 10.3 공개 가게 카드 전체 클릭 / 하트

`PublicPlaceCard.jsx`는 **수정하지 않았다** — 실제 코드를 확인한 결과 이미 `<Card as="div" role="button" tabIndex={0} onClick={() => onOpen(place)} onKeyDown={Enter/Space 처리}>` 구조로 카드 전체 클릭·키보드 접근이 구현되어 있었다. 또한 이 카드에는 하트 저장/해제 버튼 자체가 없다(컴포넌트 자체 주석: "the existing bookmark heart on the place detail page is the only way to save from this flow now") — 가게 저장은 `PlaceDetailSheet.jsx`의 `handleBookmarkClick`(개인 북마크)로만 이루어지며 이 파일은 건드리지 않았다.

---

## 11. 공개 가게 상세의 뒤로가기·Places 탭 복원

`src/pages/PlaceDetailPage.jsx`의 `handleBack()`에 조건 분기만 추가했다.
```js
function handleBack() {
  if (state?.returnTo?.pathname) {
    navigate(state.returnTo.pathname, { state: { tab: state.returnTo.tab, sort: state.returnTo.sort } });
    return;
  }
  if (window.history.length > 1) navigate(-1);
  else navigate(ROUTES.explore);
}
```
`state.returnTo`는 `PublicPlacesTab.handleViewDetail`만 설정하므로, 그 외 모든 기존 진입 경로(저장한 동선 stop 클릭, 커뮤니티 글 장소 링크, 공유 링크 등 — 전수 검색으로 확인, §17)는 기존 `navigate(-1)`/`ROUTES.explore` 동작을 그대로 유지한다.

`ExplorePage.jsx`는 §7의 공개 동선 상세 작업에서 이미 `location.state?.tab ?? 'routes'` / `location.state?.sort ?? 'popular'`를 초기값으로 읽도록 구현되어 있어, `tab: 'places'`를 넘기는 것만으로 추가 코드 없이 그대로 동작했다(중복 구현 없음).

---

## 12. 라우팅 및 상태 전달

| 목적 | 라우트 | state 채널 |
|---|---|---|
| 공개 동선 상세 진입 | `ROUTES.publicCourseDetail(key)` | `state.publicCourse` |
| 공개 가게 상세 진입 | `ROUTES.placeDetail(place.id)` | `state.place`, `state.fromPublicFeed`, `state.returnTo` |
| 동선/가게 상세 → Map 탭 | `ROUTES.home` (View map 클릭 시에만) | `state.savedCourse`(기존 채널 재사용) |
| 상세 → 여행자픽 복귀 | `ROUTES.explore` | `state.tab`, `state.sort` |

`state.savedCourse`(Map 이동)와 `state.publicCourse`/`state.place`(상세 진입)는 서로 다른 키로 명확히 분리되어 있어, 상세 진입 자체가 Map 이동을 유발하는 경로는 존재하지 않는다.

---

## 13. locale별 데이터 재조회·병합

- 공개 동선 상세: `getPlacesByIds(ids, locale)` 1회, `fetchPlaceReviewStatsBatch` 1회, `fetchPlaceBookmarkStatsBatch` 1회 — `SavedCourseDetailPage`와 동일한 3-batch 패턴. `mergeSavedStopWithLocalizedPlace()`로 병합, 제목은 `normalizeSavedCourseForDisplay()`(내부에서 `getSavedCourseDisplayTitle` 호출), 기준 위치는 목록 카드와 동일한 `getPublicCourseAnchorDisplay()` 재사용.
- 공개 가게 상세: `PlaceDetailPage`의 기존 `getPlaceById(placeId, locale)`가 locale이 바뀔 때마다 재실행되어 이름·주소·설명·메뉴·방문 정보를 현재 언어로 갱신한다 — 공개 피드 snapshot 텍스트가 화면에 고정되지 않는다.

---

## 14. 기존 Map Bottom Sheet 흐름과의 분리

- `NearbySheet.jsx`, `PlaceDetailSheet.jsx`, `HomePage.jsx`의 Map 탭 처리, `lastPlaceView.js`, `TodayCourseDetail.jsx` — 이번 세 작업 전체에서 **전혀 수정하지 않았다**.
- `SavedPlacesTab.jsx`(마이페이지 "저장한 가게")는 여전히 `navigate(ROUTES.home, { state: { savedCourse: singleStopCourse } })` 패턴을 그대로 쓰고 있음을 확인했고 손대지 않았다 — 저장한 가게 페이지의 진입 방식은 이번 변경과 무관하게 그대로다.
- `PlaceReviewsPage.handleBack()`은 원래부터 `navigate(-1)` 기반이라, 전체 화면 `PlaceDetailPage`(공개 피드 경유 포함) → 리뷰 → 뒤로가기 시 다시 전체 화면 `PlaceDetailPage`로 돌아온다 — 코드 변경 없이 기존 메커니즘으로 성립.

---

## 15. 성능·보안·회귀 영향

- **성능**: 공개 동선 상세의 장소 데이터는 배치 3회로 고정(스탑 수와 무관). `fetchPublicCourseByKey()`는 최대 300행(150×2)을 한 번에 가져와 새로고침/직접 URL 접근 시에만 발생 — 일반 카드 클릭 경로에서는 호출되지 않는다.
- **보안**: 이번 변경 어디에도 service role key/anon key/비밀번호/테스트 계정 정보를 남기지 않았다. `softDeleteSavedCourse`는 기존 그대로 soft delete만 수행한다.
- **회귀**: `handleOpen`/`setLastPlaceView` 호출은 `PublicPlacesTab.jsx`에서 완전히 제거되었고 `SavedPlacesTab.jsx`/`PlaceDetailSheet.jsx`의 동일 함수 호출은 그대로 유지됨을 검색으로 확인했다(§17).

---

## 16. 사용자 브라우저 확인 결과

사용자가 직접 브라우저에서 확인한 내용(이 세션이 자체적으로 재현한 것이 아니라 사용자 보고에 근거):

- 여행자픽 공개 동선 카드를 누르면 전체 화면 동선 상세(`PublicCourseDetailPage`)가 정상적으로 열린다.
- 공개 동선 상세 UI가 의도한 대로(coral 헤더, ROUTE STOPS, 하단 CTA) 표시된다.
- 여행자픽 공개 가게 카드를 누르면 Map Bottom Sheet가 아니라 전체 화면 `PlaceDetailPage`가 정상적으로 열린다.

**미확인**: AI 음성 도움의 실제 발화 테스트(§5.5 참고 — 이 문서 작성 시점 새벽이라 아직 수행되지 않음). `npm run build` 성공은 코드가 정상적으로 빌드된다는 것만 의미하며, 실제 음성 인식 정확도·언어별 동작을 검증한 것이 아니다.

---

## 17. 변경 파일 종합

| 파일 | 구분 | 비고 |
|---|---|---|
| `src/features/phrases/services/speechRecognitionService.js` | 수정 | `startListening({ language, ... })`, `recognition.lang` 명시 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | 수정 | 발화 언어 선택 UI/상태, 새 응답 필드 렌더링, 한국어 전용 TTS 버튼 |
| `supabase/functions/mg-voice-help/index.ts` | 수정 | `sourceLanguage` 입력 검증, 일반화된 응답 필드, 원문/언어 라벨 서버 강제 |
| `src/shared/i18n/dictionary.js` | 수정 | `phrases.speakingLanguage`/`speakKorean`/`speakEnglish`/`speakChinese`, `publicFeed.detailLabel`/`notFound`/`backToExplore` (en/ko/zh-CN) |
| `src/shared/constants/routes.js` | 수정 | `publicCourseDetail()`/`publicCourseDetailPattern` |
| `src/app/router.jsx` | 수정 | `PublicCourseDetailPage` 라우트 등록 |
| `src/features/courses/services/publicFeedService.js` | 수정 | `fetchPublicCourseByKey()` 추가 |
| `src/features/courses/components/PublicRoutesTab.jsx` | 수정 | `handleViewDetail`로 교체(전체 화면 상세로 이동) |
| `src/features/courses/components/PublicCourseCard.jsx` | 수정 | 카드 전체 클릭/키보드 접근성, 하트 click·keydown 전파 차단 |
| `src/pages/ExplorePage.jsx` | 수정 | `location.state.tab`/`sort` 복원 |
| `src/pages/PublicCourseDetailPage.jsx` | 신규 | 공개 동선 전체 화면 상세 |
| `src/features/courses/components/PublicPlacesTab.jsx` | 수정 | `handleViewDetail`로 교체(전체 화면 `PlaceDetailPage`로 이동), `setLastPlaceView`/가짜 1-stop 코스 제거 |
| `src/pages/PlaceDetailPage.jsx` | 수정 | `handleBack()`의 `state.returnTo` 분기 추가 |
| `docs/sql-public-course-detail-rpc-2026-07-27.md` | 신규 | 공개 동선 by-key RPC 제안 문서(SQL 미실행) |
| `docs/60-...md`(이 문서) | 신규 | 작업일지 |

---

## 18. 빌드 및 검사 결과

- `npm run build`: 성공. 기존부터 있던 CSS 압축 경고 1건(`communityService.js` 타임스탬프 정규식 유래, 무관) 외 신규 오류 없음.
- `git diff --check`: 통과 — CRLF 안내만 존재, 실제 whitespace 오류 없음.

---

## 19. git 상태 및 커밋 정보

이 섹션은 커밋·push 수행 후 최종 보고에서 채운다.

---

## 20. 승인된 한계와 후속 과제

- `fetchPublicCourseByKey()`가 popular/latest 상위 150건 밖의 공개 동선을 "찾을 수 없음"으로 오판할 수 있는 한계 — 정식 해결책은 `docs/sql-public-course-detail-rpc-2026-07-27.md`에 제안만 해두었고 SQL은 실행하지 않았다.
- `PlaceDetailSheet.jsx`가 Map 탭·전체 화면 두 host에 공용으로 쓰여, 전체 화면 경로에서 리뷰 페이지로 갔다 올 때 `setLastPlaceView()` 기록이 소비되지 않고 남아 있다가 이후 무관하게 Map 탭에 처음 진입할 때 우연히 소비될 가능성 — 이번 세 작업 이전부터 있던 구조적 특성이며 새로 생기거나 악화되지 않았다.
- 여행자픽 상세 화면들의 뒤로가기에서 목록 스크롤 위치 복원은 구현하지 않았다(탭/정렬 복원만 구현).
- AI 음성 도움의 실제 발화 테스트는 이 문서 작성 시점까지 수행되지 않았다.
- 실제 브라우저 조작 검증은 §16에 기재된 세 항목(사용자 직접 확인)을 제외하고 이 세션에서 재현하지 못했다.
