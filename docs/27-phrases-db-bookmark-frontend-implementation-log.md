# 27. Phrases DB 전환 및 표현 북마크 1차 프론트 구현 기록

## 작업 일자

2026-06-27

---

## 이전 작업 기준

- 이전 문서: `docs/26-frontend-refactor-phase1-result.md` — 프론트엔드 공통 로직 및 컴포넌트 분리 (2026-06-27)
- 계획 문서: `ai-docs/23-phrases-db-common-bookmark-plan-request.md`
- DB SQL 문서: `docs/sql-phrases-db-common-bookmark-2026-06-27.md`
- TTS/표현 구조 초기 정리: `docs/13-phrases-tts-and-voice-help-fixes.md`
- Voice help 실제 구현 + TTS 안정화: `docs/14-voice-help-implementation-and-tts-improvements.md`

---

## 작업 배경

`Phrases / 자주 쓰는 표현` 화면의 Common phrases는 `src/features/phrases/data/phrases.js`에 하드코딩된 데이터(카테고리 8개, 표현 85개) 기반으로 동작하고 있었습니다.

이번 1차 작업의 목적은 아래와 같습니다.

```
1. Common phrases 데이터를 DB에서 불러오기
2. 카테고리도 DB에서 관리하기
3. 한국어 표현, 영문 발음, 영어 뜻, note를 DB에 저장하기
4. 스피커 버튼은 기존처럼 한국어 TTS 유지하기
5. 로그인 사용자가 표현을 북마크할 수 있게 하기
6. 나중에 Bookmarked phrases / Popular phrases 탭으로 확장하기
7. 나중에 관리자 기능으로 카테고리/표현 추가·수정·삭제 가능하게 확장하기
8. 향후 일본어/중국어 등 다국어 확장 가능성을 고려하기
```

---

## DB 작업 완료 상태

**Claude Code는 SQL을 실행하지 않았습니다.**
사용자가 Supabase SQL Editor에서 직접 실행하고 결과를 확인했습니다.

### 완료된 테이블 구조

#### mg_phrase_categories

```sql
CREATE TABLE public.mg_phrase_categories (
  id          text        PRIMARY KEY,   -- 카테고리 slug ('waiting', 'ordering' 등)
  label_en    text        NOT NULL,
  label_ko    text        NOT NULL,
  label_ja    text,                      -- 향후 일본어 확장용 (nullable)
  label_zh    text,                      -- 향후 중국어 확장용 (nullable)
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**seed 완료: 8건**

| id | label_en | label_ko |
|---|---|---|
| waiting | Waiting | 대기 |
| arriving | Getting seated | 자리 잡기 |
| menu | Choosing menu | 메뉴 선택 |
| allergy | Allergy & dietary needs | 알러지 & 식이 제한 |
| ordering | Ordering | 주문하기 |
| extra | Extra requests | 추가 요청 |
| paying | Paying | 계산하기 |
| leaving | Leaving | 퇴장하기 |

> **중요:** `id`는 SERIAL이 아닌 TEXT입니다. `'waiting'` 같은 문자열이 PK입니다. 프론트에서 fetchPhrasesByCategory(category) 파라미터와 직접 매핑됩니다.

#### mg_phrases (ALTER)

기존 테이블에 아래 컬럼 추가 + FK 추가:

```sql
phrase_key   text UNIQUE (WHERE phrase_key IS NOT NULL)  -- 프로그래밍 식별자
note         text                                         -- 추가 설명
bookmark_count integer NOT NULL DEFAULT 0 CHECK (>= 0)   -- 북마크 집계
category     FK → mg_phrase_categories.id               -- 기존 TEXT 컬럼에 FK 추가
```

**seed 완료: 85건**

카테고리별 표현 수:
- allergy: 15건 / arriving: 10건 / extra: 10건 / leaving: 10건
- menu: 10건 / ordering: 10건 / paying: 10건 / waiting: 10건

> `mg_phrases_id_seq`는 MAX(id) = 85 기준으로 재설정 완료 (`setval` 결과: 85)

#### mg_phrase_bookmarks (CREATE)

```sql
CREATE TABLE public.mg_phrase_bookmarks (
  id         bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase_id  integer NOT NULL REFERENCES public.mg_phrases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phrase_id)
);
```

**현재 0건** (프론트 북마크 테스트 전)

### RLS 및 정책 완료

| 테이블 | 정책 |
|---|---|
| mg_phrase_categories | public read (모든 사용자 조회 가능) |
| mg_phrases | public read (모든 사용자 조회 가능) |
| mg_phrase_bookmarks | authenticated select own / insert own / delete own |

### 트리거 완료

| 트리거 | 내용 |
|---|---|
| trg_mg_phrase_categories_updated_at | UPDATE 시 updated_at 자동 갱신 |
| trg_mg_phrases_updated_at | UPDATE 시 updated_at 자동 갱신 (기존 유지) |
| trg_phrase_bookmark_count | mg_phrase_bookmarks INSERT/DELETE 시 mg_phrases.bookmark_count 자동 증감 (SECURITY DEFINER) |

### 기타 검증 완료

```
phrase_key partial unique index — 정상
fk_mg_phrases_category (mg_phrases.category → mg_phrase_categories.id) — 정상
trg_phrase_bookmark_count 트리거 함수 — 정상 생성
```

### 아직 실행하지 않은 검증

```
SQL 문서 8-8. 수동 북마크 테스트 — 사용자가 프론트 화면에서 북마크 버튼으로 직접 테스트 예정
```

---

## 프론트 구현 목표

```
1. PhrasesPage에서 카테고리 목록을 mg_phrase_categories에서 조회
2. 선택된 카테고리의 표현을 mg_phrases에서 조회
3. DB row를 화면 표시용 shape로 normalize
4. PhraseCard에서 기존 speakKorean(phrase.korean) 호출 유지
5. 로그인 사용자의 북마크 목록 조회
6. 표현 북마크 추가/해제
7. 비로그인 사용자가 북마크 클릭 시 로그인 안내 배너 표시 (3초 자동 해제)
8. Optimistic update 적용 (실패 시 롤백)
9. 요청 중 중복 클릭 방지 (bookmarking state)
10. bookmarkCount가 1 이상이면 하트 버튼 아래 숫자 표시
11. 로딩/에러 상태 문구 추가
```

---

## 수정/생성 파일

> ⚠️ 아래는 완료 보고 기준이 아닌 **실제 `git diff` 기준**으로 확인된 내용입니다.

### 신규 생성 (untracked)

#### `src/features/phrases/services/phraseService.js`

```js
// 주요 함수
fetchPhraseCategories()     // mg_phrase_categories → { id, label, labelKo }[]
fetchPhrasesByCategory(category)  // mg_phrases WHERE category = ? AND is_active = true
normalizePhrase(row, bookmarkedIds)  // DB row → 화면용 shape
```

`normalizePhrase` 반환 shape:
```js
{
  id,
  phraseKey,    // phrase_key
  category,
  korean,       // ko_text (← speakKorean() 호환 핵심)
  romanization, // romanization ?? ''
  intentEn,     // en_text ?? ''
  note,         // note ?? ''
  bookmarkCount,// bookmark_count ?? 0
  isBookmarked, // bookmarkedIds.includes(row.id)
}
```

#### `src/features/phrases/services/phraseBookmarkService.js`

```js
fetchMyPhraseBookmarks(userId)              // → phrase_id[]
addPhraseBookmark({ phraseId, userId })     // INSERT
removePhraseBookmark({ phraseId, userId })  // DELETE
```

### 수정 (git diff 확인)

#### `src/features/phrases/components/PhraseCard.jsx`

변경 내용:
- `onBookmark` prop 추가 (없으면 북마크 버튼 미렌더링)
- `bookmarking` state 추가 (요청 중 중복 클릭 방지)
- `HeartIcon` import 추가
- 스피커 버튼과 북마크 버튼을 `flex` 컨테이너로 묶음
- 북마크 버튼: `isBookmarked`이면 `text-coral`, 아니면 `text-ink-faint`
- `bookmarkCount > 0`이면 하트 버튼 아래 숫자 표시
- 두 버튼 모두 `e.stopPropagation()` 적용

#### `src/pages/PhrasesPage.jsx`

변경 내용:
- `PHRASES` import 제거 (정적 데이터 직접 표시 방식 폐기)
- `useEffect`, `useCallback` 추가
- `useAuth()` 추가 → `user` 획득
- `categories` state 추가 (초기값 `PHRASE_CATEGORIES`, DB 로드 후 교체)
- `phrases` state 추가 (DB에서 normalized rows)
- `loading`, `loadFailed` state 추가
- `loginBanner` state 추가 (3초 자동 해제)
- 마운트 시 `fetchPhraseCategories()` 호출, 실패 시 정적 `PHRASE_CATEGORIES` 유지
- `category`/`user`/`activeTab` 변경 시 `fetchPhrasesByCategory()` + `fetchMyPhraseBookmarks()` 병렬 호출
- `handleBookmark`: 비로그인 → 배너, 로그인 → optimistic update + DB 반영 + 실패 시 롤백
- `PhraseCard`에 `onBookmark={handleBookmark}` 전달

#### `src/shared/i18n/dictionary.js`

EN 및 KO `phrases` 네임스페이스에 아래 키 추가:

```js
// EN
bookmark: 'Save phrase'
bookmarkRemove: 'Remove saved phrase'
bookmarked: 'Saved'
loginToBookmark: 'Log in to save phrases.'
loadError: 'Could not load phrases.'

// KO
bookmark: '표현 저장'
bookmarkRemove: '저장 해제'
bookmarked: '저장됨'
loginToBookmark: '로그인 후 표현을 저장할 수 있습니다.'
loadError: '표현을 불러오지 못했습니다.'
```

---

## 구현 내용

### DB 로딩 흐름

```
[마운트]
  fetchPhraseCategories()
    → setCategories(dbCategories)
    → 실패 시 PHRASE_CATEGORIES 유지 (정적 fallback)

[카테고리/로그인 상태 변경]
  Promise.all([
    fetchPhrasesByCategory(category),
    user ? fetchMyPhraseBookmarks(user.id) : []
  ])
    → rows.map(row => normalizePhrase(row, bookmarkedIds))
    → setPhrases(...)
    → 실패 시 setLoadFailed(true)
```

### 북마크 흐름

```
[비로그인 클릭]
  setLoginBanner(true) → 3초 후 false

[로그인 클릭]
  target = phrases.find(p.id === phraseId)
  wasBookmarked = target.isBookmarked

  1. Optimistic update (즉시 화면 반영)
  2. try:
     wasBookmarked ? removePhraseBookmark() : addPhraseBookmark()
  3. catch:
     롤백 (isBookmarked/bookmarkCount 원래 값으로 복구)
```

### cancel 처리

카테고리 전환 등 컴포넌트 언마운트 전에 이전 요청 결과를 무시하기 위해 `cancelled` flag를 useEffect cleanup에서 `true`로 설정합니다.

---

## TTS 유지 방식

이번 작업에서 **ttsService.js는 수정하지 않았습니다.**

ttsService.js는 아래 이유로 안정화된 상태이며 절대 건드리지 않아야 합니다:

```
- Google 한국어 ko-KR voice 우선 선택
- voiceschanged 이벤트로 pre-warm 처리
- 첫 클릭 무음 방어 로직 포함
- docs/14에서 두 차례 수정 후 안정화
```

DB에서 가져온 `ko_text` 필드를 `normalizePhrase()`에서 `phrase.korean`으로 매핑하므로, 기존 `speakKorean(phrase.korean)` 호출 구조가 변경 없이 유지됩니다.

---

## 비로그인/로그인 처리

| 상황 | 동작 |
|---|---|
| 비로그인 | Common phrases 표시 O, 북마크 버튼 표시 O, 클릭 시 로그인 안내 배너 |
| 로그인 | Common phrases 표시 O, 본인 북마크 상태 로드, 북마크 추가/해제 가능 |
| 로그인 후 카테고리 전환 | fetchMyPhraseBookmarks 재호출하여 isBookmarked 상태 갱신 |

---

## i18n 추가 사항

`src/shared/i18n/dictionary.js`의 `phrases` 네임스페이스에 5개 키가 추가되었습니다.

현재 `bookmark`, `bookmarkRemove`, `bookmarked` 키는 PhraseCard의 `aria-label`에 활용 가능하도록 추가되어 있으나, 화면에 직접 노출되는 텍스트는 `loginToBookmark`(로그인 안내 배너)와 `loadError`(에러 메시지)입니다.

---

## 빌드 결과

```
vite v5.4.21 building for production...
✓ 171 modules transformed.
✓ built in 4.70s
컴파일 오류: 0건
```

기존부터 있던 경고 (이번 작업과 무관):
- CSS minification 경고 (`-: T.Z`): Tailwind 처리 경고, 기존부터 존재
- chunk size 경고 (548 kB): 기존부터 존재

> ⚠️ 빌드는 성공했으나, **사용자가 아직 화면에서 직접 테스트하지 않았습니다.**

---

## 아직 화면 테스트하지 못한 항목

```
1. 비로그인 상태에서 Common phrases가 DB 데이터로 정상 표시되는지
2. 비로그인 상태에서 카테고리 전환이 정상인지
3. 비로그인 상태에서 스피커 버튼 TTS가 정상인지
4. 비로그인 상태에서 북마크 클릭 시 로그인 안내 배너가 나오는지
5. 로그인 후 기존 북마크 상태가 정상 조회되는지
6. 로그인 후 북마크 추가가 되는지
7. 로그인 후 북마크 해제가 되는지
8. 북마크 추가 시 mg_phrase_bookmarks에 행이 생기는지
9. 북마크 해제 시 mg_phrase_bookmarks 행이 삭제되는지
10. bookmark_count가 INSERT/DELETE 트리거로 증가/감소하는지
11. Voice help 탭이 기존처럼 정상 동작하는지
12. 새로고침 후 북마크 상태가 유지되는지
13. 한국어/영어 locale 전환 시 카테고리 라벨과 추가 문구가 깨지지 않는지
```

---

## 화면 테스트 체크리스트

```
[ ] 1. Phrases 탭 진입 → Common phrases 카테고리 8개 표시 확인
[ ] 2. 카테고리 클릭 → 해당 카테고리 표현 10~15개 표시 확인
[ ] 3. 스피커 버튼 클릭 → 한국어 TTS 재생 확인
[ ] 4. (비로그인) 하트 버튼 클릭 → coral-tint 배너 "Log in to save phrases." 표시 후 3초 소멸
[ ] 5. 로그인 후 Phrases 탭 진입 → 기존 북마크 하트 채워짐 확인
[ ] 6. (로그인) 하트 버튼 클릭 → 즉시 채워짐 (optimistic), Supabase에 행 생성 확인
[ ] 7. (로그인) 다시 하트 버튼 클릭 → 즉시 비워짐 (optimistic), Supabase에 행 삭제 확인
[ ] 8. bookmark_count 숫자가 하트 아래 표시되는지 확인
[ ] 9. Voice help 탭 → 기존 음성 인식 흐름 정상 동작 확인
[ ] 10. 카테고리 탭 가로 스크롤 정상 동작 확인
[ ] 11. 한국어/영어 전환 → 카테고리 라벨 및 로그인 안내 문구 정상 전환 확인
[ ] 12. 새로고침 후 북마크 상태 유지 확인
```

---

## Supabase 확인 쿼리

테스트 완료 후 아래 쿼리로 DB 반영 여부를 확인해 주세요.

```sql
-- 북마크 목록 확인
SELECT *
FROM public.mg_phrase_bookmarks
ORDER BY created_at DESC
LIMIT 20;

-- bookmark_count 증감 확인
SELECT
  id,
  phrase_key,
  ko_text,
  bookmark_count
FROM public.mg_phrases
WHERE bookmark_count > 0
ORDER BY bookmark_count DESC, id;
```

**기대 결과:**

```
북마크 추가 후:
  → mg_phrase_bookmarks에 해당 user_id / phrase_id 행 생성
  → mg_phrases.bookmark_count 증가 (트리거 동작)

북마크 해제 후:
  → mg_phrase_bookmarks에서 해당 행 삭제
  → mg_phrases.bookmark_count 감소 (트리거 동작)
```

---

## 건드리지 않은 파일

아래는 `git diff` 기준으로 이번 작업에서 수정하지 않은 것이 확인된 파일입니다.

| 파일 | 확인 |
|---|---|
| `src/features/phrases/services/ttsService.js` | ✅ 미수정 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | ✅ 미수정 |
| `src/features/phrases/services/speechRecognitionService.js` | ✅ 미수정 |
| `supabase/functions/mg-voice-help/index.ts` | ✅ 미수정 |
| `src/features/phrases/data/phrases.js` | ✅ 미수정 (Phase 1에서 삭제하지 않음) |

> `phrases.js`는 Phase 1에서 삭제하지 않았습니다. `PhrasesPage.jsx`에서 `PHRASE_CATEGORIES`를 초기 fallback 값으로 import합니다. DB 카테고리 로드 성공 시 대체됩니다.

---

## 주의사항

### ttsService.js는 절대 수정하지 마세요

`docs/14`에서 두 차례 수정 후 안정화된 상태입니다. Google ko-KR 우선 선택, voiceschanged pre-warm, 첫 클릭 무음 방어 로직이 모두 포함되어 있습니다. DB에서 가져온 `ko_text`를 `phrase.korean`으로 normalize하는 방식으로 ttsService 호출 구조를 그대로 유지하고 있습니다.

### VoiceHelpPlaceholder.jsx / speechRecognitionService.js / mg-voice-help/index.ts

Voice help 기능 전체 흐름(`VoiceHelpPlaceholder → speechRecognitionService → Edge Function`)은 이미 구현 완료된 기능입니다. 이번 작업과 무관하므로 건드리지 마세요.

### ail_* 테이블

커뮤니티(ail_board_categories, ail_comments, ail_posts, ail_profiles)는 이번 작업 대상이 아닙니다. 절대 수정하지 마세요.

### mg_phrases.id 시퀀스

seed 후 `setval`로 85로 재설정이 완료되었습니다. 이후 INSERT 시 86부터 자동 부여됩니다.

### phrases.js 삭제 시점

`src/features/phrases/data/phrases.js`는 Phase 1에서 삭제하지 않았습니다. 삭제는 DB 로딩이 안정화된 이후 별도 작업에서 진행합니다.

---

## 다음 작업 후보

```
1. (최우선) 화면 테스트 후 버그 수정
2. Bookmarked phrases 탭 추가 (로그인 사용자만 표시)
3. Popular phrases 탭 추가 (bookmark_count 기준 정렬)
4. Popular phrases Top 10 무료 표시 + 이후 로그인 유도
5. 표현 검색 기능
6. src/features/phrases/data/phrases.js 삭제 (DB 안정화 후)
7. 관리자 카테고리/표현 관리 기능
8. 일본어/중국어 표현 뜻 추가 (label_ja, label_zh 컬럼 이미 준비됨)
9. Voice help 결과와 Common phrases 연결
10. TTS 재생 횟수 또는 표현 사용 통계 추가
```
