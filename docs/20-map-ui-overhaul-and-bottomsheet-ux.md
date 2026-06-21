# 20. Map UI 전면 개선 및 Bottom Sheet UX 고도화

## 작업 일자

2026-06-21

---

## 이전 작업 기준

- 이전 문서: `docs/19-auth-supabase-real-and-community-mvp.md`
- `docs/19`에서 실제 Supabase Auth 연동과 Community 게시글 MVP를 완료했다.
- 이번 세션에서는 Map 탭의 UI 전면 개편(TopBar 모바일 숨김, 검색바 pill 형태, 브랜드 아이콘, 필터 아이콘 재디자인), NearbySheet 드래그/높이 UX 대폭 개선, FilterSheet 드래그 닫기, SearchOverlay 검색바 구조 정렬, 모바일 터치 드래그 수정까지 진행했다.

---

## 이번 작업 목표

1. NearbySheet — 전체 시트 드래그, 풀 높이 커버, 스크롤 우선순위 제어
2. TopBar — 모바일 숨김, 메인 영역 자동 확장
3. Map 검색바 — rounded-full pill, PinIcon(coral) 브랜드 아이콘, FunnelIcon 재디자인
4. FilterSheet — fullHeight + draggableClose (모달 단에서 구현)
5. SearchOverlay — 검색바를 메인 검색바와 동일한 내부 레이아웃으로 구조 정렬
6. Modal.jsx — 모바일 터치 드래그 닫기 수정 (DevTools 모바일 시뮬레이션 대응)

---

## 수정/생성 파일 목록

| 파일 | 유형 |
|---|---|
| `src/features/explore/components/NearbySheet.jsx` | 수정 |
| `src/features/explore/components/TodayCourseDetail.jsx` | 수정 |
| `src/shared/components/TopBar.jsx` | 수정 |
| `src/pages/HomePage.jsx` | 수정 |
| `src/shared/components/Icon.jsx` | 수정 |
| `src/features/explore/components/Modal.jsx` | 수정 |
| `src/features/explore/components/FilterSheet.jsx` | 수정 |
| `src/features/explore/components/SearchOverlay.jsx` | 수정 |

---

## 핵심 구현 내용

### 1. NearbySheet 드래그/높이 UX 전면 개선

**배경:** 이전에는 드래그 핸들(pill 스트립)에서만 드래그가 가능했고, 풀 상태에서 검색 input이 시트 위로 노출되는 문제가 있었다. badge shadow도 너무 강렬했다.

**`full` 높이 = `vh - 12px`**

```js
const FULL_TOP_OFFSET_PX = 12;
// ...
const full = vh - FULL_TOP_OFFSET_PX;
```

시트가 풀 상태가 되면 `calc(100% - 12px)`까지 올라와 상단 floating 검색 input을 덮는다. 12px의 여백만 남겨 iPhone 홈 인디케이터 등 시스템 UI에 여유를 준다.

**Capture-phase 전체 시트 드래그**

기존 방식(핸들 strip의 이벤트)을 `onPointerDownCapture` / `onPointerMoveCapture` / `onPointerUpCapture` / `onPointerCancelCapture` 로 교체해 시트 루트에 붙였다. 어디서든(코스 목록, TodayCourseDetail, PlaceDetailSheet) 드래그하면 높이가 조절된다.

```jsx
<div
  className="absolute inset-x-0 bottom-0 z-30 ..."
  onPointerDownCapture={handleSheetPointerDown}
  onPointerMoveCapture={handleSheetPointerMove}
  onPointerUpCapture={handleSheetPointerUpOrCancel}
  onPointerCancelCapture={handleSheetPointerUpOrCancel}
  onClickCapture={handleSheetClickCapture}
>
```

**7px 탭/드래그 구분 임계값 + click 억제**

```js
const DRAG_THRESHOLD = 7; // px

// gestureRef 구조
gestureRef.current = {
  startY, isDragging: false,
  scrollEl, scrollTopAtStart,
  suppressClick: false,
};

// pointerMove에서
if (Math.abs(offset) >= DRAG_THRESHOLD) {
  g.isDragging = true;
  suppressClickRef.current = true;
  sheetEl.setPointerCapture(g.pointerId);
}

// clickCapture에서
if (suppressClickRef.current) {
  suppressClickRef.current = false;
  e.stopPropagation();
  e.preventDefault();
}
```

7px 미만 이동 → 드래그 미인식 → `click` 이벤트 정상 발화.
7px 이상 → `setPointerCapture` 호출 → OS/브라우저가 스크롤 제스처를 가져가지 못함 → 드래그 완료 후 `click` 억제.

**스크롤 우선순위 로직**

풀 상태에서 내부 스크롤 컨테이너(`overflow-y-auto`)가 있을 때:

```
하향 스와이프 + scrollTop > 0 → browser scroll (content 위로 스크롤)
하향 스와이프 + scrollTop === 0 → sheet collapse
상향 스와이프 → browser scroll (content 아래로 스크롤)
```

`findScrollParent()` 헬퍼로 `pointerdown` 시점의 스크롤 조상을 캐싱하고, 이동 방향과 `scrollTopAtStart` 조합으로 분기한다.

**TodayCourseDetail 정류장 번호 badge shadow 수정**

```jsx
// 변경 전: shadow-coral (너무 강렬)
// 변경 후:
className="... shadow-[0_2px_6px_rgba(248,72,31,0.18)]"
```

---

### 2. Map TopBar 모바일 숨김

```jsx
// TopBar.jsx
<header className="hidden h-[3.25rem] shrink-0 items-center justify-center ... lg:flex">
```

`hidden lg:flex` — 모바일/태블릿에서 TopBar가 사라지고, Flex 컨테이너가 자동으로 map 영역을 전체 높이로 확장한다. PC 데스크탑(lg+)에서만 표시.

---

### 3. Map 검색바 pill 형태 + 브랜드 아이콘 + 필터 재디자인

**pill 검색바**

```jsx
// HomePage.jsx
<div className="flex h-[3.25rem] items-center gap-1 rounded-full bg-white px-3 shadow-soft">
  <button className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
    <PinIcon size={18} className="shrink-0 text-coral" />
    <span className="truncate text-[0.95rem] font-medium text-ink-faint">
      Search dishes, places…
    </span>
  </button>
  <button className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft">
    <FunnelIcon size={18} />
    {/* badge */}
  </button>
</div>
```

`rounded-2xl` → `rounded-full`로 pill 모양. 왼쪽 아이콘은 `SearchIcon` 대신 `PinIcon(coral)`으로 브랜드 아이덴티티 표현. 필터 버튼에서 `bg-coral` 배경과 `shadow` 제거 — 흰 바 위에 아이콘만 남겨 더 가볍게.

**FunnelIcon 재디자인 (슬라이더)**

```jsx
// Icon.jsx — 3개 수평 트랙 + 계단식 knob 배치
export function FunnelIcon(p) {
  return (
    <Svg vb="0 0 20 20" {...p}>
      <line x1="2" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="6" cy="5" r="2.5" fill="currentColor" />
      <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="10" r="2.5" fill="currentColor" />
      <line x1="2" y1="15" x2="18" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="15" r="2.5" fill="currentColor" />
    </Svg>
  );
}
```

---

### 4. Modal.jsx — fullHeight + draggableClose

`Modal` 컴포넌트에 두 가지 prop을 추가해 FilterSheet에만 적용했다.

**fullHeight**

```jsx
// FilterSheet이 상단 floating 검색 input을 완전히 덮도록
style={fullHeight ? { height: 'calc(100% - 12px)' } : undefined}
```

NearbySheet의 `full = vh - 12px`와 동일한 오프셋. CSS 클래스(`max-h-[84%]`) 대신 inline style을 사용해 동적 vh 계산 없이도 정확히 맞춘다.

**draggableClose (PC 포인터 이벤트)**

FilterSheet 전용 드래그-닫기. NearbySheet의 3-snap 드래그와 달리, 단순히 아래로 끌어내려 닫는 1-방향 gesture다.

```
pointerdown → gestureRef 기록
pointermove → 7px 임계 초과 + 하향 + scrollTop=0 → setPointerCapture → 시트 translateY
pointerup → 80px 초과 → onClose() / 미만 → spring-back (0.25s ease)
```

scroll 우선순위: `scrollEl && scrollTopAtStart > 0` → gestureRef 초기화 → browser scroll 양보.

**HomePage.jsx 연결**

```jsx
<Modal open={sheet === 'filters'} onClose={() => setSheet(null)}
       variant="sheet" fullHeight draggableClose>
  <FilterSheet ... />
</Modal>
```

`LocationSheet`, `LanguageModal` 등 다른 Modal 인스턴스는 영향 없음.

**FilterSheet Show results 버튼 shadow 수정**

```jsx
className="h-[3.25rem] w-full rounded-[0.9375rem] bg-coral text-base font-bold text-white
           shadow-[0_2px_6px_rgba(248,72,31,0.18)]"
```

`TodayCourseDetail` badge와 동일한 연한 shadow로 통일.

---

### 5. SearchOverlay 검색바 구조 정렬

**문제:** SearchOverlay의 `<input>` 왼쪽 여백이 메인 검색바의 placeholder와 정렬되지 않았다. `ml-1` 임시 보정 → 두 바의 내부 레이아웃 규칙을 통일하는 구조적 수정으로 교체.

**메인 검색바 레이아웃 기준**

```
[container px-3 gap-1]
  [button flex-1 px-1 gap-2.5: PinIcon + span]
  [filter h-10 w-10]
```

유효 PinIcon 왼쪽 여백: 12px(px-3) + 4px(px-1) = **16px**
PinIcon → placeholder 간격: **10px** (gap-2.5)

**SearchOverlay 수정 후**

```jsx
<div className="flex h-[3.25rem] items-center gap-1 rounded-full bg-ink/[0.07] px-3">
  {/* PinIcon + input을 동일한 wrapper로 묶음 */}
  <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
    <PinIcon size={18} className="shrink-0 text-coral" />
    <input ... className="flex-1 ..." />
  </div>
  <button className="flex h-9 w-9 shrink-0 ..."><CloseIcon /></button>
  <button className="relative flex h-10 w-10 shrink-0 ..."><FunnelIcon /></button>
</div>
```

`div(pl-1 gap-2.5)` wrapper가 메인 바의 `button(px-1 gap-2.5)` wrapper와 동일한 규칙을 제공한다. `ml-1` 제거.

| | container | left offset | icon→text gap |
|---|---|---|---|
| 메인 검색바 | px-3 gap-1 | px-1 (4px) | gap-2.5 (10px) |
| SearchOverlay | px-3 gap-1 | pl-1 (4px) | gap-2.5 (10px) |

---

### 6. Modal.jsx 모바일 터치 드래그 수정

**문제:** PC 마우스 드래그는 동작하나, Chrome DevTools 모바일 시뮬레이션에서 `draggableClose`가 작동하지 않았다.

**근본 원인:** 모바일에서 React 합성 이벤트(`onPointerMoveCapture`)는 passive 리스너로 등록된다. 브라우저가 터치 제스처를 스크롤로 판단하면 `pointercancel`을 발화해 우리 핸들러를 중단시킨다. `setPointerCapture`를 호출하기 전에 이미 브라우저가 제스처를 가져간다.

**해결:** native `addEventListener`로 `touchmove`를 `{ passive: false }`로 등록해 `e.preventDefault()`로 브라우저 스크롤을 직접 차단.

```js
// Modal.jsx — useEffect 내부
el.addEventListener('touchmove', onTouchMove, { passive: false });
// passive:false → e.preventDefault() 가능 → 브라우저 스크롤 인터셉트
```

**`isTouchActiveRef` — 포인터 이벤트 중복 처리 방지**

모바일에서 touch 이벤트와 pointer 이벤트가 동시에 발화된다. 터치 핸들러가 활성화 중일 때 포인터 핸들러를 건너뛰도록 플래그를 사용한다.

```js
// touchstart
isTouchActiveRef.current = true;

// touchend
isTouchActiveRef.current = false;

// pointer handlers
function handlePointerDown(e) {
  if (!draggableClose || isTouchActiveRef.current) return;
  // ...
}
```

**`onCloseRef` — stale closure 방지**

`useEffect` 의존성 배열에 `onClose`를 넣으면 함수 레퍼런스가 바뀔 때마다 리스너를 재등록해야 한다. ref 패턴으로 해결:

```js
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose; // 매 렌더 동기 업데이트 (useEffect 불필요)

// 터치 핸들러에서 항상 최신값 사용
onCloseRef.current();
```

**스크롤 우선순위 (터치 버전)**

포인터 버전과 동일한 로직을 터치 이벤트로 재구현:

```
touchstart → scrollEl + scrollTopAtStart 캐싱
touchmove + 하향 7px+ + scrollTop=0 → e.preventDefault() + translateY
touchmove + 하향 + scrollTop > 0 → touchGestureRef 초기화 → browser scroll
touchmove + 상향 → touchGestureRef 초기화 → browser scroll
touchend + offset > 80px → onClose()
touchend + offset ≤ 80px → spring-back
```

**`select-none` 추가**

드래그 중 텍스트 선택 방지:

```jsx
className={`modal-sheet ... select-none ...`}
```

---

## 트레이드오프 / 결정 기록

| 결정 | 선택 | 이유 |
|---|---|---|
| fullHeight inline style vs Tailwind class | inline style `height: calc(100% - 12px)` | dynamic vh 계산 없이 정확히 맞추려면 CSS calc가 필요; 한 곳에만 적용되므로 class 추가 불필요 |
| draggableClose 적용 범위 | FilterSheet만 | NearbySheet는 별도 3-snap 시스템; LocationSheet/LanguageModal은 드래그 닫기 불필요 |
| 모바일 터치: pointer vs touch 이벤트 | 두 가지 병행 | pointer → PC/마우스, touch → 모바일; `isTouchActiveRef`로 중복 방지 |
| FunnelIcon 디자인 | 수평 슬라이더 3개 + stagger knob | 깔때기(funnel) 모양보다 필터 sliders UI가 현대적이고 가독성 좋음 |
| SearchOverlay PinIcon 정렬 | `ml-1` 제거 → wrapper div | 임시 오프셋은 두 바의 구조 불일치를 숨길 뿐; 동일한 내부 레이아웃 규칙 사용이 유지보수 안전 |
