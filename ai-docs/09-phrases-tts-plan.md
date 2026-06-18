Phrases 탭 개선 작업을 하기 전에, 구현 지시용 ai-docs 문서를 먼저 만들어줘.

문서 생성 위치:

* `ai-docs/09-phrases-tts-and-voice-help-plan.md`

중요:

* 지금은 문서만 생성해줘.
* 코드 수정하지 마.
* 구현하지 마.
* Supabase DB 작업하지 마.
* Edge Function 수정하지 마.
* 외부 TTS API 붙이지 마.
* LLM 연결하지 마.
* 음성 입력 기능 구현하지 마.
* 이 문서는 다음 구현 세션에서 참고할 계획/지시 문서다.

문서 목적:
Phrases 탭을 외국인 관광객이 한국 식당에서 바로 쓸 수 있는 기능으로 개선하기 위한 구현 지침을 정리한다.

큰 방향:

* 페이지 제목은 `Phrases`
* 페이지 내부에 상단 탭 2개를 둔다.

  1. `Common phrases`
  2. `Voice help`
* 기본 선택 탭은 `Common phrases`
* `Common phrases`는 상황별 자주 쓰는 표현 목록 + 한국어 TTS
* `Voice help`는 추후 확장 기능으로, 식당 직원이 한국어로 말한 내용을 영어로 이해하도록 돕는 화면 틀
* 단, 이번 MVP에서는 실제 음성 입력/LLM 연결은 하지 않는다.
* Voice help는 UI placeholder만 고려한다.

현재 상태 분석에 포함할 파일:

* `src/pages/PhrasesPage.jsx`
* `src/features/phrases/data/phrases.js`
* `src/features/phrases/components/PhraseCategoryTabs.jsx`
* `src/features/phrases/components/PhraseCard.jsx`
* TTS 유틸이 이미 있는지 확인

문서에 포함할 내용:

1. 현재 상태

* 표현 데이터가 어디에 하드코딩되어 있는지
* 현재 카테고리 구조
* 현재 PhraseCard가 사용하는 필드
* 스피커 버튼이 실제 TTS를 실행하는지 여부
* 카테고리 탭 가로 스크롤 문제
* shadow/glow가 과한 UI 요소

2. 목표 화면 구조

* `Phrases` 페이지
* 상단 탭:

  * `Common phrases`
  * `Voice help`
* `Common phrases` 기본 활성화
* `Voice help`는 MVP에서는 실제 분석 기능 없이 틀만 제공

3. Common phrases 데이터 구조 제안
   표현 데이터는 MVP에서는 DB로 옮기지 않고 `phrases.js` 하드코딩 유지.

각 표현은 아래 필드를 갖도록 제안:

* `id`
* `category`
* `intentEn`
* `korean`
* `romanization`
* `note`

예시:

```js
{
  id: 'waiting-01',
  category: 'waiting',
  intentEn: 'Is there a wait?',
  korean: '웨이팅 있나요?',
  romanization: 'We-i-ting innayo?',
  note: 'Use this when you arrive at a busy restaurant.'
}
```

4. Common phrases 카테고리
   아래 카테고리로 정리한다.
   각 카테고리당 최소 10개 표현을 제안한다.

* Waiting / 웨이팅
* Getting seated / 입장·자리 안내
* Choosing menu / 메뉴 고르기
* Allergy & dietary needs / 알레르기·식이 제한
* Ordering / 주문하기
* Extra requests / 추가 요청
* Paying / 결제하기
* Leaving / 퇴장·마무리

5. 반드시 포함할 표현

Waiting:

* Is there a wait?
* How long is the wait?
* Can I put my name on the waiting list?
* I am one person.
* We are two people.
* We have a child.
* Can you call us when it is our turn?
* Please call my name.
* Can I wait outside?
* I will come back soon.

Getting seated:

* Table for one, please.
* Table for two, please.
* We have a child.
* Do you have a table?
* Can we sit here?
* Can we sit by the window?
* I have a reservation.
* We do not have a reservation.
* Can we sit separately?
* Can we sit together?

Choosing menu:

* Do you have an English menu?
* What do you recommend?
* What is the most popular menu?
* Is this spicy?
* Can you make it less spicy?
* Does this have meat?
* Does this have seafood?
* Is this for one person?
* Is this enough for two people?
* What is this dish?

Allergy & dietary needs:

* Is this gluten-free?
* Does this contain pork?
* Does this contain beef?
* Does this contain chicken?
* Does this contain seafood?
* Does this contain shellfish?
* Does this contain peanuts?
* Does this contain eggs?
* Does this contain dairy?
* I have a nut allergy.
* I have a seafood allergy.
* I cannot eat pork.
* I am vegetarian.
* Is there a vegetarian option?
* Please make it without this ingredient.

Ordering:

* I will have this one.
* Please give me one of this.
* Please give me two of this.
* We will order now.
* Please give us water.
* Please give us side dishes.
* Can we order more?
* Please give me the same thing.
* Please make it less spicy.
* That is all for now.

Extra requests:

* Can I get more kimchi?
* Can I get more rice?
* Can I get a fork?
* Can I get scissors?
* Can I get a spoon?
* Can you pack this to go?
* Please do not make it spicy.
* Can I get more napkins?
* Can I get a small plate?
* Can I get the sauce on the side?

Paying:

* Can I pay now?
* Can I pay by card?
* Can I split the bill?
* Please give me the receipt.
* Where do I pay?
* Is it prepaid?
* Do I pay first?
* Can I pay separately?
* Can I use a foreign card?
* Please check the bill.

Leaving:

* Thank you.
* It was delicious.
* We are leaving now.
* Can you pack the leftovers?
* Goodbye.
* Thank you for the meal.
* Everything was great.
* Have a nice day.
* We enjoyed it.
* See you next time.

각 표현은 문서에서 표 형태로 정리해줘.
표 컬럼:

* English meaning
* Korean phrase
* Romanization
* Usage note

한국어 표현은 실제 식당에서 자연스럽게 쓸 수 있게 다듬어줘.
너무 길거나 어색한 문장은 피하고, TTS로 읽기 좋은 문장으로 정리해줘.

6. TTS 구현 방향

* Web Speech API 사용
* `SpeechSynthesisUtterance`
* `utterance.lang = 'ko-KR'`
* 스피커 버튼 클릭 시 `korean` 필드를 읽음
* 기존 재생 중이면 중복 재생 방지
* Web Speech API 미지원 환경에서는 앱이 깨지지 않게 처리
* 외부 API 키 사용하지 않음
* 음성 파일 사용하지 않음

7. Voice help 탭 계획
   MVP에서는 실제 구현하지 않고 UI 틀만 고려.

목표:

* 식당 직원이 한국어로 말했을 때 사용자가 의미를 영어로 확인하는 기능
* 예: 직원이 “선불입니다”라고 말함
* 사용자가 녹음 버튼을 누름
* 나중에 음성 인식 + LLM 분석으로 영어 의미 표시

현재 MVP 범위:

* 실제 음성 인식 구현 안 함
* 실제 LLM 연결 안 함
* UI placeholder만 가능

  * 중앙의 큰 마이크/녹음 버튼
  * 아래 결과 표시 카드
  * 안내 문구
  * 예시 placeholder

8. UI 개선 지침

* 카테고리 탭은 가로 스크롤 가능해야 함
* 카테고리 탭 shadow 제거 또는 약화
* 스피커 버튼 shadow 제거 또는 약화
* 과한 glow 제거
* coral은 선택 상태와 주요 액션에만 제한적으로 사용
* 전체 톤은 기존 Matgil UI 유지
* 모바일 화면에서 카테고리 탭이 잘리지 않아야 함

9. 이번 MVP에서 하지 않을 것

* 표현 데이터 DB 저장
* 로그인 기반 표현 즐겨찾기
* 하트 즐겨찾기 기능
* 외부 TTS API
* 음성 파일 업로드
* 실제 음성 입력 분석
* 실제 LLM 연결
* 자동 번역 API
* 관리자 표현 관리 화면

10. 이후 확장 후보

* 표현 즐겨찾기
* 표현 검색
* Voice help 실제 음성 인식
* 한국어 STT 결과를 LLM으로 영어 해석
* 직원 말에 대한 추천 응답 생성
* Supabase 표현 테이블
* 다국어 UI 확장

문서 스타일:

* 기존 ai-docs 문서처럼 구현자가 바로 참고할 수 있게 작성
* 표를 적극적으로 사용
* 코드 예시는 필요한 만큼만
* 문서 작성 후 생성한 파일명과 핵심 요약만 보고해줘.
