# 13. Phrases 탭 개선 및 TTS / 가로 스크롤 오류 수정

## 작업 일자

2026-06-18

---

## 이전 작업 기준

- 이전 문서: `docs/12-ui-cleanup-and-course-progressive-load.md`
- 이번 작업은 Phrases 탭 전면 개선 + 발생한 두 가지 기술적 버그 수정 기록

---

## 이번 작업 목표

1. Phrases 페이지를 `Common phrases` / `Voice help` 두 탭 구조로 개선
2. Common phrases 표현 데이터를 카테고리 8개 / 85개 이상으로 확장
3. Allergy & dietary needs 카테고리 추가
4. Web Speech API 기반 한국어 TTS 동작 복구
5. Voice help placeholder UI 추가
6. 카테고리 가로 스크롤 문제 수정

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `src/pages/PhrasesPage.jsx` | 수정 |
| `src/features/phrases/data/phrases.js` | 전면 교체 |
| `src/features/phrases/components/PhraseCategoryTabs.jsx` | 수정 |
| `src/features/phrases/components/PhraseCard.jsx` | 수정 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | 신규 생성 |
| `src/features/phrases/services/ttsService.js` | 수정 |
| `src/shared/components/Icon.jsx` | 수정 (MicIcon 추가) |

---

## Phrases 페이지 구조 변경

### 이전

- 페이지 제목 `Useful phrases`
- 카테고리 탭 1개 레벨 (Getting seated / Ordering / During the meal / Paying)
- TTS 버튼만 존재

### 이후

- 페이지 제목 `Phrases`
- 상단에 세그먼트 탭 2개: `Common phrases` (기본 활성), `Voice help`
- `Common phrases`: 카테고리 가로 스크롤 탭 + 표현 카드 목록 + 스피커 버튼 TTS
- `Voice help`: 실제 음성인식/LLM 연결 없이 placeholder UI만 제공

```jsx
// PhrasesPage.jsx — 상단 탭 상태
const [activeTab, setActiveTab] = useState('common'); // 'common' | 'voice'
const [category, setCategory] = useState('waiting');
```

---

## 표현 데이터 확장

### 변경 전

- 카테고리 4개 (arriving / ordering / during / paying)
- 표현 11개
- 필드: `id`, `category`, `ko`, `ro`, `en`

### 변경 후

- 카테고리 8개

| id | label |
|---|---|
| `waiting` | Waiting |
| `arriving` | Getting seated |
| `menu` | Choosing menu |
| `allergy` | Allergy & dietary needs |
| `ordering` | Ordering |
| `extra` | Extra requests |
| `paying` | Paying |
| `leaving` | Leaving |

- 표현 총 85개 (카테고리당 최소 10개, allergy는 15개)
- 필드 변경:

| 기존 | 변경 |
|---|---|
| `ko` | `korean` |
| `ro` | `romanization` |
| `en` | `intentEn` |
| (없음) | `note` (선택, 빈 문자열 허용) |

- Allergy & dietary needs: 글루텐·돼지·소·닭·해산물·조개류·땅콩·달걀·유제품 9종 확인 표현 + 알레르기 고지 + 채식 옵션 포함
- 한국어 표현은 TTS로 읽기 자연스럽고 실제 식당에서 쓸 수 있는 문장으로 작성

---

## Voice help placeholder UI

`src/features/phrases/components/VoiceHelpPlaceholder.jsx` 신규 생성.

- 중앙 큰 원형 마이크 버튼 (coral 배경, 흰색 MicIcon, `disabled`)
- `Tap and speak.` 한 줄 안내
- 하단 `Example result` 카드: 선불입니다 → 의미 → 추천 응답 하드코딩 예시
- 이모지 없음, 외부 아이콘 패키지 없음
- `MicIcon`은 `Icon.jsx`에 inline SVG로 추가 (기존 `Svg` 헬퍼 패턴 사용)
- 실제 음성인식, LLM, 외부 API 연결 없음

---

## TTS 오류 수정 기록

### 증상

- 스피커 버튼 클릭 시 콘솔에 `speakKorean called`, `calling synth.speak()`, `started`, `ended` 로그가 모두 정상 출력
- 클릭 이벤트 연결이나 함수 호출 자체는 문제 없었음
- 그러나 실제 한국어 음성이 전혀 들리지 않았음

### 원인 분석 과정

1. `isTTSSupported()` 가드가 `play()` 함수 내에 남아 있어 일부 환경에서 early return → 제거
2. Chrome에서 `cancel()` 직후 `speak()` 호출 시 엔진이 깨지는 버그 → `speaking || pending` 상태일 때만 `cancel()` 호출하도록 수정 + `setTimeout 50ms` delay 추가
3. 브라우저 콘솔에서 직접 테스트 결과:
   - `Microsoft Heami - Korean (Korean)` voice: `onstart` / `onend` 이벤트는 발화되지만 **실제 소리가 나지 않음**
   - `Google 한국어` voice를 직접 지정: **한국어 음성 정상 재생**

### 최종 원인

**voice 선택 문제.** `lang.startsWith('ko')`로 첫 번째 한국어 voice를 잡았는데, 브라우저가 `Microsoft Heami`를 먼저 반환했고, 이 voice는 이벤트는 발화하지만 실제 오디오를 출력하지 않았음. 클릭 이벤트나 Web Speech API 자체 문제가 아니었음.

### 최종 해결 — `ttsService.js`의 `getKoreanVoice()` 우선순위 수정

```js
function getKoreanVoice() {
  const voices = window.speechSynthesis.getVoices();

  // 1순위: Google 한국어 (lang=ko-KR, name에 Google + 한국어 모두 포함)
  const p1 = voices.find(
    (v) => v.lang === 'ko-KR' && v.name.includes('Google') && v.name.includes('한국어'),
  );
  if (p1) return p1;

  // 2순위: ko-KR이면서 name에 Google 포함
  const p2 = voices.find((v) => v.lang === 'ko-KR' && v.name.includes('Google'));
  if (p2) return p2;

  // 3순위: ko-KR이면서 name에 한국어 포함
  const p3 = voices.find((v) => v.lang === 'ko-KR' && v.name.includes('한국어'));
  if (p3) return p3;

  // 4순위: ko-KR 아무거나
  const p4 = voices.find((v) => v.lang === 'ko-KR');
  if (p4) return p4;

  // 5순위: lang이 ko로 시작하는 아무거나
  return voices.find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? null;
}
```

`Microsoft Heami`는 이 우선순위에서 `Google 한국어`가 있는 한 절대 먼저 선택되지 않음.

### 기타 ttsService.js 변경 사항

- `let currentUtterance = null` 모듈 스코프에 유지
- `utterance.voice = selectedVoice` 명시 지정
- `utterance.lang = 'ko-KR'`, `rate = 0.9`, `volume = 1`, `pitch = 1`
- `onstart` / `onend` / `onerror` 핸들러 + 디버그 로그 추가

### PhraseCard.jsx 변경 사항

- `speakKorean(phrase.korean)` — 필드명 `korean`으로 일치
- `e.preventDefault()` + `e.stopPropagation()` 처리
- `phrase.korean` 존재 확인 후 호출
- `button type="button"` 명시
- `isTTSSupported()` 가드를 `play()` 내에서 완전 제거 — `speakKorean()` 내부에서 처리

### 최종 확인

- 콘솔: `[TTS DEBUG] selected voice: Google 한국어 ko-KR`
- 실제 한국어 음성 재생 정상 동작

---

## 카테고리 가로 스크롤 오류 수정 기록

### 증상

- 카테고리 버튼이 화면 오른쪽으로 이어져 있었지만 실제 좌우 스와이프 스크롤이 되지 않았음
- 첫 3개 카테고리만 선택 가능하고 나머지에 접근 불가

### 시도한 방법들 (효과 없었음)

| 시도 | 결과 |
|---|---|
| `overflow-x-auto` 단일 flex 컨테이너 | 스크롤 안 됨 |
| `-mx-5 + px-5` 로 PageShell 밖으로 빼기 | 오른쪽 화면 침범 문제 발생 |
| `w-max` 내부 div + `overflow-x-auto` 외부 div | 스크롤 안 됨 |
| `touch-pan-x` 추가 | 스크롤 안 됨 |

### 최종 해결

**`PhrasesPage.jsx` 래퍼 수정:**

```jsx
// 변경 전
<div className="mt-4">

// 변경 후
<div className="mt-4 min-w-0 max-w-full overflow-hidden">
```

**`PhraseCategoryTabs.jsx` 구조 변경:**

```jsx
// 외부 스크롤 컨테이너
<div className="no-scrollbar w-full max-w-full touch-pan-x overflow-x-auto overscroll-x-contain pb-1">
  // 내부 콘텐츠 — 버튼 전체 폭만큼 늘어남
  <div className="flex min-w-max gap-2">
    <button className="h-9 shrink-0 whitespace-nowrap ...">
```

### 핵심 원리

- **부모 래퍼 `overflow-hidden`**: 페이지 여백 침범을 막는 클리핑 경계. 내부 스크롤 컨테이너의 가로 스크롤 자체는 막지 않음
- **`min-w-max`**: `min-width: max-content` — 버튼 합산 폭만큼 내부 div가 늘어나도록 보장. `w-max`(width 고정)와 달리 부모 제약과 무관하게 콘텐츠 폭 이상을 보장
- **`whitespace-nowrap`**: 버튼 라벨이 한 줄 유지
- **`overscroll-x-contain`**: 스크롤 체이닝 차단 — 탭 스크롤이 끝에 도달해도 페이지 전체가 따라 스크롤되지 않음
- **`-mx-5` 미사용**: PageShell 여백 안에서 자연스럽게 처리

### 최종 확인

- 오른쪽 화면 침범 없음
- 8개 카테고리 모두 가로 스크롤로 접근 가능

---

## UI 정리

- 스피커 아이콘 크기: `size={32}` (기존 18 → 최종 32)
- Voice help 마이크 버튼: `h-40 w-40` (160px), `MicIcon size={60}`
- 카테고리 탭 활성 상태: `shadow-coral` 제거 → `bg-coral text-white`만 유지
- 스피커 버튼: `shadow-coral` 제거 → coral 배경만 유지

---

## 동작 확인

- Common phrases / Voice help 탭 전환 정상 ✓
- Common phrases 카테고리 가로 스크롤 정상 ✓
- 8개 카테고리 모두 접근 가능 ✓
- 스피커 버튼 클릭 시 한국어 TTS 재생 ✓
- selected voice가 `Google 한국어 ko-KR`로 선택됨 ✓
- Voice help는 placeholder UI만 표시 ✓
- 실제 음성인식/LLM 연결 없음 ✓
- 외부 TTS API 없음 ✓
- 외부 패키지 설치 없음 ✓
- `npm run build` 통과 ✓

---

## 아직 하지 않은 것

- 실제 음성 인식 (Web Speech API SpeechRecognition)
- LLM 연결 (Supabase Edge Function)
- 음성 입력 결과 분석
- 상황별 추천 응답 생성
- 표현 검색
- 표현 즐겨찾기
- 표현 데이터 DB 저장
- 관리자 표현 관리 화면

---

## 다음 작업 후보

- Voice help 실제 음성 인식 구현
- Supabase Edge Function으로 LLM 연결
- 한국어/영어 음성 입력 분석
- 상황별 추천 응답 생성
- Phrases 검색 기능
- 표현 즐겨찾기 (로그인 기반)
