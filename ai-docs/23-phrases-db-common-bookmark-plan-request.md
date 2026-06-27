# 23. Phrases DB 전환 및 표현 북마크 1차 구현 계획 요청

## 작성 일시

2026-06-27 KST

---

## 작업 목적

현재 `Phrases / 자주 쓰는 표현` 화면의 `Common phrases`는 프론트 하드코딩 데이터 기반으로 구성되어 있다.

이제 Common phrases 데이터를 Supabase DB로 옮기고, 로그인 사용자가 표현을 북마크할 수 있는 기반을 만들고 싶다.

이번 1차 작업의 핵심 목표는 다음과 같다.

```txt
1. 기존 하드코딩 Common phrases 데이터를 DB 기반으로 전환
2. 표현 카테고리도 DB에서 관리할 수 있는 구조로 확장
3. 한국어 표현 / 영문 발음 / 영어 뜻 / note를 DB에 저장
4. 기존 한국어 TTS 동작은 건드리지 않고 유지
5. 로그인 사용자만 표현 북마크 가능
6. 북마크 기반 인기 표현 확장 가능성을 고려
7. 향후 관리자 기능에서 카테고리/표현 추가·수정·삭제 가능하도록 설계
```

---

## 중요한 전제

이번 작업은 바로 구현하지 말고, 먼저 현재 프로젝트와 DB 상태를 분석한 뒤 구현 계획만 보고한다.

코드 수정하지 마.
Supabase SQL 실행하지 마.
DB 수정하지 마.
Storage 건드리지 마.
새 패키지 설치하지 마.
npm run build 실행하지 마.
git add / commit / push 하지 마.

---

## 반드시 먼저 확인할 문서

`docs` 폴더에서 13번 이후 문서를 모두 확인해라.

이유:

```txt
docs/13에서 Phrases TTS와 Common phrases 구조가 처음 정리되기 시작했다.
그 이후에도 Voice help, TTS 첫 클릭 무음 수정, 카테고리 스크롤, DB/기능 개선 작업이 이어졌을 수 있다.
번호가 높을수록 최신 작업 상태에 가깝다.
```

반드시 확인할 것:

```txt
docs/13 이후 모든 md 파일
특히 phrases, tts, voice help, common phrases, saved courses, filter 관련 문서
```

주의:

```txt
과거 문서와 최신 코드가 충돌하면 최신 번호 문서와 현재 코드 상태를 우선한다.
```

---

## 현재 확인된 프론트 상태

현재 Common phrases 관련 파일은 아래 구조로 보인다.

```txt
src/pages/PhrasesPage.jsx
src/features/phrases/data/phrases.js
src/features/phrases/components/PhraseCategoryTabs.jsx
src/features/phrases/components/PhraseCard.jsx
src/features/phrases/services/ttsService.js
```

현재 `phrases.js`에는 아래 데이터가 하드코딩되어 있다.

### 카테고리

```txt
waiting   / Waiting / 대기
arriving  / Getting seated / 자리 잡기
menu      / Choosing menu / 메뉴 선택
allergy   / Allergy & dietary needs / 알러지 & 식이 제한
ordering  / Ordering / 주문하기
extra     / Extra requests / 추가 요청
paying    / Paying / 계산하기
leaving   / Leaving / 퇴장하기
```

### 표현 데이터 필드

```txt
id
category
intentEn
korean
romanization
note
```

현재 `PhraseCard.jsx`는 `phrase.korean`을 화면에 표시하고, 스피커 버튼 클릭 시 아래처럼 한국어 TTS를 실행한다.

```js
speakKorean(phrase.korean);
```

---

## 현재 TTS 관련 중요한 주의사항

TTS는 이미 여러 차례 수정되어 안정화된 상태다.

특히 아래 파일은 특별한 이유 없이 건드리지 마.

```txt
src/features/phrases/services/ttsService.js
```

현재 TTS 안정화 내용:

```txt
- Google 한국어 ko-KR voice 우선 선택
- voiceschanged 기반 pre-warm
- 첫 클릭 무음 문제 방어
- Microsoft Heami가 먼저 잡히는 문제 방어
- speakKorean(text)로 한국어 문장 재생
```

이번 작업에서 원하는 것은 DB에서 가져온 한국어 표현을 기존 `speakKorean()`에 넘기는 것이다.

즉:

```txt
기존 TTS 로직 수정 금지
speakKorean(ko_text 또는 korean) 호출 방식 유지
```

---

## 현재 확인된 DB 상태

Supabase public schema에 `mg_phrases` 테이블은 이미 존재한다.

하지만 현재 데이터는 0개다.

확인 결과:

```txt
phrase_count = 0
active_phrase_count = 0
카테고리별 결과 없음
샘플 데이터 없음
중복 데이터 없음
```

현재 `mg_phrases` 컬럼:

```txt
id bigint primary key
category varchar not null
ko_text text not null
romanization text nullable
en_text text nullable
ja_text text nullable
zh_text text nullable
sort_order integer not null default 0
is_active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

현재 제약조건:

```txt
mg_phrases_pkey primary key(id)
```

현재 인덱스:

```txt
idx_mg_phrases_active on is_active
idx_mg_phrases_category on category
mg_phrases_pkey on id
```

현재 트리거:

```txt
trg_mg_phrases_updated_at
BEFORE UPDATE
EXECUTE FUNCTION set_updated_at()
```

현재 RLS:

```txt
mg_phrases RLS enabled
public read mg_phrases
SELECT to anon/authenticated
qual: is_active = true
```

---

## 중요한 DB 판단

`mg_phrases`는 버리지 말고 그대로 사용한다.

현재 프론트 하드코딩 필드와 DB 컬럼 매핑:

```txt
phrase.korean        → mg_phrases.ko_text
phrase.romanization → mg_phrases.romanization
phrase.intentEn     → mg_phrases.en_text
phrase.category     → mg_phrases.category
phrase.note         → 현재 mg_phrases에 없음. 추가 검토 필요.
```

부족한 구조:

```txt
1. 카테고리 전용 테이블 없음
2. note 컬럼 없음
3. 사용자별 표현 북마크 테이블 없음
4. 인기 표현 집계용 bookmark_count 없음
5. 관리자 추가/수정/삭제 정책 없음
```

---

## 스키마 설계 방향

1차 작업에서는 기존 `mg_phrases`를 유지하고 필요한 구조만 보강한다.

추천 방향:

```txt
1. mg_phrases는 유지
2. mg_phrase_categories 새로 생성
3. mg_phrase_bookmarks 새로 생성
4. mg_phrases에 note, bookmark_count 추가 검토
5. 기존 phrases.js 하드코딩 데이터를 DB seed로 이전
6. Common phrases는 DB 조회로 전환
7. TTS는 기존 ttsService 그대로 유지
8. 북마크 버튼 UI와 저장/해제 구현
```

---

## 권한 방향

아래 권한 방향을 기준으로 계획을 세워라.

```txt
표현 조회: 비로그인 가능
표현 TTS: 비로그인 가능
표현 북마크: 로그인 사용자만 가능
인기 표현 조회: 비로그인 가능
관리자 표현 추가/수정/삭제: 관리자만 가능
```

이번 1차 구현에서는 관리자 화면은 만들지 않는다.

다만 DB 구조는 관리자 확장을 고려해야 한다.

---

## 주의 — 다른 테이블 건드리지 말 것

현재 Supabase public schema에는 맛길 테이블 외에 `ail_*` 테이블도 섞여 있다.

이번 작업에서는 절대 `ail_*` 테이블을 건드리지 마.

```txt
ail_board_categories
ail_comments
ail_posts
ail_profiles
```

이번 작업 대상은 `mg_*` 테이블만이다.

특히 이번 작업의 주 대상:

```txt
mg_phrases
mg_phrase_categories
mg_phrase_bookmarks
```

---

## 1차 구현 목표

이번 1차 작업에서 목표로 하는 범위는 아래까지만이다.

```txt
1. DB 구조 보강 계획
2. 기존 phrases.js 데이터를 seed하는 계획
3. Common phrases를 DB 조회로 전환하는 계획
4. TTS 기존 동작 유지 계획
5. 표현 북마크 저장/해제 구현 계획
6. 북마크 상태를 Common phrases 화면에 표시하는 계획
7. 향후 인기 표현 탭으로 확장 가능한 구조 준비
```

이번 1차에서 하지 않을 것:

```txt
1. Popular phrases 탭 실제 구현
2. Bookmarked phrases 탭 실제 구현
3. 관리자 화면 구현
4. 관리자 권한 시스템 구현
5. Voice help 수정
6. TTS service 수정
7. 외부 TTS API 연동
8. 새 LLM 기능 추가
```

---

## DB 설계 후보

아래는 추천 설계다. 현재 코드/문서 분석 후 더 나은 방식이 있으면 계획에서 제안해라.

### 1. mg_phrase_categories

목적:

```txt
카테고리 id, 영어 라벨, 한국어 라벨, 정렬 순서, 활성 여부 관리
```

예상 컬럼:

```txt
id text primary key
label_en text not null
label_ko text not null
sort_order integer not null default 0
is_active boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

향후 다국어 확장을 고려하면 아래 방식도 검토해라.

```txt
label_ja text nullable
label_zh text nullable
```

또는 장기적으로는 번역 테이블 분리도 가능하지만, 1차에서는 과도하게 복잡하게 만들지 마.

---

### 2. mg_phrases 보강

현재 mg_phrases에 있는 컬럼:

```txt
category
ko_text
romanization
en_text
ja_text
zh_text
sort_order
is_active
```

추가 검토할 컬럼:

```txt
note text nullable
bookmark_count integer not null default 0
```

주의:

```txt
bookmark_count는 인기 표현 조회를 위해 필요하다.
하지만 사용자별 북마크 정보는 mg_phrase_bookmarks에 저장한다.
```

---

### 3. mg_phrase_bookmarks

목적:

```txt
로그인 사용자가 특정 표현을 북마크했는지 저장
```

예상 컬럼:

```txt
id bigint primary key generated by default as identity
phrase_id bigint not null references public.mg_phrases(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
created_at timestamptz not null default now()
```

필수 unique:

```txt
unique (phrase_id, user_id)
```

RLS 방향:

```txt
SELECT: 로그인 사용자는 자기 북마크만 조회
INSERT: 로그인 사용자는 자기 user_id로만 삽입
DELETE: 로그인 사용자는 자기 북마크만 삭제
```

인기 표현을 위해 `mg_phrase_bookmarks`를 public read로 열지 마.

이유:

```txt
사용자별 북마크 테이블을 public read로 열면 user_id 노출 위험이 있다.
```

인기 표현은 `mg_phrases.bookmark_count`를 public read 하는 방식이 더 안전하다.

---

### 4. bookmark_count 트리거

인기 표현 확장을 위해 `bookmark_count`를 고려한다.

방향:

```txt
mg_phrase_bookmarks insert 시 mg_phrases.bookmark_count + 1
mg_phrase_bookmarks delete 시 mg_phrases.bookmark_count - 1
```

단, 이번 1차에서는 Popular 탭을 만들지 않아도 된다.

그래도 DB 구조를 만들 때 `bookmark_count`까지 넣으면 2차에서 편하다.

---

## 기존 phrases.js seed 계획

현재 `src/features/phrases/data/phrases.js`의 `PHRASE_CATEGORIES`, `PHRASES` 데이터를 DB로 이전해야 한다.

seed 대상:

```txt
PHRASE_CATEGORIES → mg_phrase_categories
PHRASES → mg_phrases
```

매핑:

```txt
PHRASE_CATEGORIES.id      → mg_phrase_categories.id
PHRASE_CATEGORIES.label   → mg_phrase_categories.label_en
PHRASE_CATEGORIES.labelKo → mg_phrase_categories.label_ko

PHRASES.category      → mg_phrases.category
PHRASES.korean        → mg_phrases.ko_text
PHRASES.romanization  → mg_phrases.romanization
PHRASES.intentEn      → mg_phrases.en_text
PHRASES.note          → mg_phrases.note
PHRASES 순서           → mg_phrases.sort_order
```

주의:

```txt
기존 mg_phrases는 데이터 0개이므로 seed insert가 가능하다.
하지만 중복 방지를 위해 upsert 또는 conflict-safe insert를 고려한다.
```

---

## 프론트 구현 방향

1차 구현에서 프론트는 아래처럼 바꾼다.

### 현재

```txt
PhrasesPage.jsx
→ PHRASE_CATEGORIES, PHRASES import
→ category state로 PHRASES.filter
→ PhraseCategoryTabs 렌더
→ PhraseCard 렌더
```

### 변경 후

```txt
PhrasesPage.jsx
→ Supabase에서 categories 조회
→ Supabase에서 phrases 조회
→ active category 기준으로 필터 또는 쿼리
→ PhraseCategoryTabs 렌더
→ PhraseCard 렌더
```

추천 서비스 파일:

```txt
src/features/phrases/services/phraseService.js
```

예상 함수:

```js
fetchPhraseCategories()
fetchPhrasesByCategory(category)
fetchAllActivePhrases()
fetchMyPhraseBookmarks(userId)
togglePhraseBookmark({ phraseId, userId })
```

또는 북마크는 별도 파일로 분리 가능:

```txt
src/features/phrases/services/phraseBookmarkService.js
```

---

## PhraseCard 변경 방향

`PhraseCard`는 기존 UI/TTS 안정성을 최대한 유지한다.

변경 전:

```txt
phrase.korean
phrase.romanization
phrase.intentEn
phrase.note
```

DB 조회 후 화면에서 사용할 normalized shape:

```txt
phrase.id
phrase.category
phrase.korean
phrase.romanization
phrase.intentEn
phrase.note
phrase.bookmarkCount
phrase.isBookmarked
```

서비스 레이어에서 DB row를 이 shape로 normalize해라.

중요:

```txt
PhraseCard 안에서는 계속 speakKorean(phrase.korean)을 호출한다.
ttsService.js는 건드리지 않는다.
```

북마크 버튼은 PhraseCard 안에 추가할 수 있다.

주의:

```txt
스피커 버튼과 북마크 버튼 클릭 이벤트가 서로 충돌하지 않게 e.stopPropagation 처리
```

---

## 로그인/비로그인 처리

표현 조회와 TTS는 비로그인도 가능해야 한다.

북마크만 로그인 필요.

동작:

```txt
비로그인:
- 표현 목록 조회 가능
- TTS 가능
- 북마크 버튼은 비활성/로그인 유도/숨김 중 하나로 결정
- 사용자가 북마크 클릭 시 로그인 안내 또는 로그인 페이지 이동

로그인:
- 내가 북마크한 표현 표시
- 북마크 추가/해제 가능
```

이번 1차에서는 너무 큰 UI 확장을 하지 말고 Common phrases 화면 안에서 북마크 상태만 표시하는 방식으로 충분하다.

---

## i18n / 다국어 확장 고려

현재 앱은 한국어/영어 전환이 중심이다.

하지만 향후 중국어, 일본어 등 추가 확장을 고려해야 한다.

DB에는 이미 `ja_text`, `zh_text`가 있다.

1차에서는 화면 표시 기준:

```txt
현재 locale = en → en_text
현재 locale = ko → en_text를 intent 의미로 유지해도 됨. 단 UI 라벨은 KO.
```

주의:

```txt
ko_text는 TTS용 한국어 문장이다.
romanization은 외국인이 읽을 발음 표기다.
en_text는 의미 설명이다.
ja_text / zh_text는 향후 확장용으로 둔다.
```

장기 확장 후보:

```txt
ja_text, zh_text를 실제 화면 의미 설명으로 사용
카테고리 label_ja, label_zh 추가
locale별 phrase translations 테이블 분리
```

하지만 1차에서는 과도하게 복잡하게 만들지 마.

---

## 향후 2차 작업 후보

1차가 완료되고 테스트 후 진행할 후보를 문서에 계획으로 남겨라.

```txt
1. Bookmarked phrases 탭 추가
   - 사용자가 북마크한 표현만 모아보기

2. Popular phrases 탭 추가
   - bookmark_count 기준 인기 표현 Top 10 표시
   - Top 10 이후 더보기는 로그인 유도

3. 표현 검색 기능
   - ko_text / romanization / en_text 기준 검색

4. 관리자 표현 관리
   - 관리자만 카테고리 추가/수정/삭제
   - 관리자만 표현 추가/수정/삭제
   - 관리자 role 구조 정리 필요

5. 다국어 확장
   - 일본어/중국어 의미 설명 추가
   - 카테고리 라벨 다국어화
   - locale별 phrase translation 구조 검토

6. Voice help와 Common phrases 연계
   - Voice help 결과에서 관련 표현 추천
   - 자주 쓰는 표현으로 바로 저장/북마크

7. 표현 사용/재생 통계
   - TTS 재생 횟수 또는 클릭 수 집계
   - 인기 표현을 북마크 수뿐 아니라 사용량 기반으로 개선
```

---

## 놓치지 말아야 할 향후 확장 아이디어

사용자가 원한 청사진은 아래와 같다. 1차에서 모두 만들 필요는 없지만 문서에 향후 확장으로 남겨라.

```txt
- 표현 즐겨찾기/북마크
- 북마크한 표현 모아보기
- 많이 북마크된 인기 표현 보기
- 인기 표현 Top 10 노출
- Top 10 이후 더보기는 로그인 유도
- 카테고리도 DB에서 관리
- 관리자 기능에서 카테고리 추가/수정/삭제
- 관리자 기능에서 표현 추가/수정/삭제
- 향후 일본어/중국어 등 다국어 확장
- TTS는 한국어 표현을 읽어주는 기능으로 유지
```

---

## UI 주의

기존 Phrases 화면 톤을 유지한다.

```txt
cream/beige 배경
coral 포인트
부드러운 카드
카테고리 가로 스크롤 유지
PC에서는 카테고리 스크롤바 접근성 유지
스피커 버튼 위치/크기 급격히 변경하지 않기
```

input/textarea focus 상태에서 빨간색/coral border나 ring을 절대 쓰지 마.

```txt
focus:border-stone-400
focus:ring-stone-200
focus:outline-none
```

이번 작업에서 input/textarea를 추가하지 않는다면 해당 사항 없음.

---

## 절대 건드리지 말 것

```txt
ttsService.js 안정화 로직
VoiceHelpPlaceholder.jsx
speechRecognitionService.js
supabase/functions/mg-voice-help/index.ts
PC 소개/QR 영역
MyPage
Community 이미지 업로드/뷰어
Saved Courses
Map/Courses 추천 코스 로직
ail_* 테이블
git add / commit / push
```

---

## 계획 보고 형식

아래 형식으로만 보고해.

```txt
Phrases DB 전환 및 북마크 1차 구현 계획

1. docs/13 이후 문서 확인 결과
2. 현재 Phrases 관련 코드 구조
3. 현재 DB 상태 분석
4. mg_phrases 유지/보강 계획
5. 새로 만들 DB 테이블/컬럼 계획
6. RLS 정책 계획
7. 기존 phrases.js 데이터 seed 계획
8. 프론트 DB 조회 전환 계획
9. TTS 유지 방식
10. 북마크 UI/동작 계획
11. 다국어 확장 고려 사항
12. 1차 구현 범위
13. 2차 이후 작업 후보
14. 위험 요소와 방지책
15. 수정/생성 예정 파일
16. 이번 작업에서 하지 않을 것

아직 코드는 수정하지 않았고, DB도 수정하지 않았고, Supabase SQL도 실행하지 않았고, 커밋/푸시도 하지 않았다.
승인하면 이 계획대로 단계별로 구현하겠다.
```
