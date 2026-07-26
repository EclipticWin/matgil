# 54. 하트 아이콘 앱 전체 통일 및 Phrases Voice help UI 미세 조정

## 1. 작업 일시

- 작성일시: 2026-07-26 11:25 KST

---

## 2. 작업 배경

`docs/53-login-required-return-flow-and-unified-auth-prompt-modal.md`는 커밋 `939c970`(로그인 필요 기능 복귀 흐름 도입 및 공용 중앙 로그인 모달 통일)에 문서와 함께 포함되어 커밋·push되었다. 이 문서는 그 이후 **같은 세션 안에서 연속으로 진행된** 다음 작업들을 다룬다. 이 문서 작성 시점까지 `939c970` 이후로는 어떤 `git add`/`commit`/`push`도 수행되지 않아, 아래 전 작업이 워킹 디렉터리에 미커밋 상태로 남아 있다.

1. 앱 전체 하트 아이콘(즐겨찾기·좋아요·북마크 용도)을 가게 상세 기준으로 통일
2. Community 게시글 카드 하단 통계 행의 정렬·간격을 여러 차례에 걸쳐 미세 조정
3. Phrases 표현 카드의 TTS 스피커 버튼 크기 축소
4. Phrases Voice help 안내 아이콘 교체 시도(Lucide `Astroid`) 및 되돌림
5. Phrases Voice help 안내 문장의 정렬 수정

---

## 3. 조사에 사용한 명령(전부 읽기 전용)

```
git log --oneline
git status --porcelain
git diff --stat HEAD
git diff HEAD -- <file>
git diff --check
npm run build
grep -rn "Heart|heart|♥|♡" src
grep -rn "Astroid|lucide-react" src
```

---

## 4. 하트 아이콘 앱 전체 통일

### 4.1 기준 확인

Map 탭 가게 상세(`PlaceDetailSheet.jsx`)의 하트가 기준: `FontAwesomeIcon icon={isBookmarked ? faHeartSolid : faHeartRegular}`(`@fortawesome/free-solid-svg-icons`/`free-regular-svg-icons`), `h-[18px] w-[18px]`, 색상은 버튼의 `text-coral`/`text-ink-faint`로 상속.

### 4.2 앱 전체 하트 사용처 조사 결과

`Icon.jsx`의 커스텀 SVG `HeartIcon`(가게 상세와 다른 실루엣)이 8곳, 문자 하트(`♥`) 직접 렌더링이 3곳에서 발견됨:

| 화면 | 기존 구현 |
|---|---|
| `PhraseCard.jsx`(Phrases 저장) | `HeartIcon` |
| `PostCard.jsx`(Community 게시글 좋아요) | `HeartIcon` |
| `CommentBottomSheet.jsx`(Community 댓글 좋아요) | `HeartIcon` |
| `SavedPlaceCard.jsx`(Courses 저장 장소 언세이브) | `HeartIcon` |
| `RecommendationCard.jsx`(추천 코스 스탑 북마크) | `HeartIcon` |
| `PopularPlaceCard.jsx`(인기 장소 북마크) | `HeartIcon` |
| `BookmarkPage.jsx`(빈 상태 아이콘) | `HeartIcon` |
| `SavedPlacesTab.jsx`(빈 상태 아이콘) | `HeartIcon` |
| `PlaceDetailSheet.jsx`(저장 수 통계) | 문자 `♥` |
| `MyPostsView.jsx`(마이페이지 내 게시글 통계) | 문자 `♥` |
| `LikedPostsView.jsx`(마이페이지 좋아요한 게시글 통계) | 문자 `♥` |

**의도적으로 제외한 곳**: `courseDisplay.js`의 `formatPlaceRatingSaveLine()` — `"★ 4.6 (2) · ♥ 3"` 형태의 동선/코스 스탯 **plain-string 포맷터**. 아이콘 컴포넌트로 바꾸려면 호출부 전체(동선·코스 카드)를 JSX로 재구성해야 해 "동선 추천을 건드리지 마"라는 요청 범위를 벗어난다고 판단해 그대로 두었다.

### 4.3 공용 컴포넌트 신설

**신규** `src/shared/components/FavoriteHeartIcon.jsx` — `{active, size=18, className, ...rest}`만 받는 순수 시각 컴포넌트. `active`면 `faHeartSolid`, 아니면 `faHeartRegular`. 클릭 handler·API·로그인 처리는 각 화면에 그대로 둠(공용 컴포넌트에 넣지 않음).

11곳 전부(위 표 + `PlaceDetailSheet`의 액션 버튼 자체) 이 컴포넌트로 교체하고, `Icon.jsx`의 이제 미사용이 된 `HeartIcon` 함수는 삭제했다.

---

## 5. Community 게시글 카드 하단 통계 행 — 반복 조정 히스토리

여러 차례에 걸쳐 세부 요청이 들어와 `PostCard.jsx`의 footer가 다음 순서로 바뀌었다.

1. **정렬 원인 진단**: `{post.likes}`/`{post.comments}`가 wrapper 없는 raw 텍스트 노드로 SVG와 나란히 있어, 텍스트의 기본 line-height 박스와 아이콘의 실제 렌더 높이가 달라 수직 중심이 어긋나 보였음. → 숫자를 `<span className="leading-none">`으로 감싸고 아이콘에 `shrink-0` 추가.
2. **그룹 사이 간격 변천**: 초기 `gap-[1.125rem]`(18px, 그룹 내부 `gap-1.5`와 다른 값) → 세 간격 통일 요청으로 `gap-1.5`(6px, 내부와 동일) → "여전히 좁아 보인다" 요청으로 `gap-2`(8px, 그룹 사이만) → "2배로" 요청으로 `gap-4`(16px) → "정확히 70%" 요청으로 임시 `gap-[11.2px]`(arbitrary value) → "하드코딩된 임의값을 쓰고 싶지 않다"는 요청으로 최종 **`gap-3`(12px, Tailwind 표준)**. 이 과정 내내 하트↔하트 수, 댓글 아이콘↔댓글 수 내부 간격(`gap-1.5`)은 한 번도 건드리지 않았다.
3. **하트/댓글 아이콘 크기 조정**: FontAwesome 하트 글리프가 `CommentIcon`(손그림 SVG, 내부 여백 있음)보다 같은 숫자 `size`에서 시각적으로 더 커 보여, 하트만 `size={17}`→`size={15}`로 축소(댓글 아이콘 `size={17}`은 그대로 유지). 댓글 좋아요(`CommentBottomSheet.jsx`)도 동일 원칙으로 `size={13}`→`size={11}`.
4. **작성일시 앞 의미 없는 `·` 제거**: `{post.from} · {post.ago}`에서 `post.from`이 `p.country || ''`(대부분 빈 문자열)이라 `· 2026.07.12 23:41` 형태로 앞에 점만 남는 버그를 발견 — `{post.from ? `${post.from} · ${post.ago}` : post.ago}`로 조건부 렌더링해 해결. `MyPostsView.jsx`/`LikedPostsView.jsx`는 이 패턴을 쓰지 않는 별도 컴포넌트라 영향 없음을 확인.

최종 상태: 하트 아이콘(`size=15`) — `gap-1.5` — 하트 수 — (부모 `gap-3`) — 댓글 아이콘(`size=17`) — `gap-1.5` — 댓글 수. 카드 왼쪽 정렬·좋아요/댓글 클릭 로직·`stopPropagation`은 전 과정에서 한 번도 변경하지 않았다.

---

## 6. Phrases 스피커 버튼 축소

`PhraseCard.jsx`의 TTS 재생 버튼: `h-11 w-11 rounded-2xl bg-coral`(44px) + `SpeakerIcon size={32}` → **`h-10 w-10`(40px, 약 91%) + `size={28}`(약 87.5%)**로 버튼·아이콘을 함께 축소(버튼만 또는 아이콘만 줄이지 않음). `rounded-2xl`·`bg-coral`·클릭 handler·재생 상태 로직은 변경 없음.

---

## 7. Voice help 안내 아이콘 — Astroid 시도 및 되돌림

### 7.1 최초 교체 시도

`VoiceHelpPlaceholder.jsx`의 AI 기능 설명 아이콘(기존 `AiSparklesIcon`, `Icon.jsx`의 커스텀 SVG, `size={17}`)이 "너무 작아 보인다"는 이유로 Lucide React의 `Astroid`로 교체 요청이 들어왔다.

- `lucide-react`가 프로젝트에 설치돼 있지 않음을 `package.json`/`node_modules`로 확인.
- `Astroid`가 실제 존재하는 아이콘인지 불확실해 웹 검색으로 확인 — lucide-react v1.12.0에서 실제 추가된 아이콘임을 확인.
- 새 의존성 설치 여부를 사용자에게 직접 확인(`AskUserQuestion`) 후 승인받아 `npm install lucide-react`(`^1.26.0`) 실행.
- `<AiSparklesIcon size={17} .../>` → `<Astroid size={20} className="shrink-0 text-coral" aria-hidden="true" />`로 교체, 간격도 `gap-1.5`→`gap-1`로 축소.

### 7.2 되돌림

실제 화면 확인 결과 `Astroid`가 "현재 디자인과 어울리지 않는다"는 피드백을 받아, `git diff`로 Astroid 교체 **직전의 정확한 구현**(추측 없이)을 확인한 뒤 `AiSparklesIcon`으로 완전히 복원했다. 복원하면서:

- 아이콘 크기만 요청대로 **기존의 정확히 2배**(`size={17}` → `size={34}`)로 확대.
- 간격은 복원된 `gap-1.5`(6px) 기준 약 70%에 해당하는 Tailwind 표준값인 **`gap-1`(4px)**로 축소.
- `lucide-react` import/사용 코드는 완전히 제거(`grep` 재확인 결과 `Astroid`/`lucide-react` 참조 없음).
- **`lucide-react` 패키지 자체(`package.json`/`package-lock.json`)는 제거하지 않고 그대로 둠** — 요청 범위가 코드 복원에 한정돼 패키지 삭제까지는 하지 않았고, 현재는 코드 어디서도 사용되지 않는 미사용 의존성으로 남아 있음(후속 과제로 기록).

---

## 8. Voice help 안내 문장 정렬 수정

아이콘이 2배로 커지면서 `Turn your speech...` 설명 문장이 부모의 `text-center`를 상속해 두 줄의 왼쪽 시작점이 서로 달라 보이는 문제가 보고됨.

- 부모 `<div>`(아이콘+문장 묶음 전체, `flex max-w-xs items-start justify-center gap-1 text-center ...`)의 중앙 배치는 그대로 두고, `<p>` 요소에만 `className="text-left"`를 추가해 문장 내부 정렬만 왼쪽으로 override.
- 별도 width 클래스나 `translate`/`margin` 보정은 추가하지 않음 — flex 아이템의 기본 shrink-to-fit 폭 계산이 이미 하나의 안정된 박스를 만든 뒤 그 안에서 줄바꿈하므로, `text-left` 하나로 충분할 것으로 판단(실기기 미확인, §10 참고).

---

## 9. 변경 파일 종합

| 파일 | 비고 |
|---|---|
| `src/shared/components/FavoriteHeartIcon.jsx` | 신규 — 공용 하트 아이콘 |
| `src/shared/components/Icon.jsx` | 미사용 `HeartIcon` 제거 |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 액션 하트 + 저장 수 통계 하트 |
| `src/features/phrases/components/PhraseCard.jsx` | 하트 교체 + 스피커 버튼 축소 |
| `src/features/phrases/components/VoiceHelpPlaceholder.jsx` | Astroid 시도→되돌림, 아이콘 2배, 간격, 문장 정렬 |
| `src/features/community/components/PostCard.jsx` | 하트 교체, 통계 행 정렬·간격, 날짜 `·` 버그 수정 |
| `src/features/community/components/CommentBottomSheet.jsx` | 댓글 좋아요 하트 교체·크기 축소 |
| `src/features/places/components/SavedPlaceCard.jsx` | 하트 교체 |
| `src/features/recommendation/components/RecommendationCard.jsx` | 하트 교체 |
| `src/features/popular/components/PopularPlaceCard.jsx` | 하트 교체 |
| `src/pages/BookmarkPage.jsx` | 빈 상태 하트 교체 |
| `src/features/courses/components/SavedPlacesTab.jsx` | 빈 상태 하트 교체 |
| `src/features/profile/components/MyPostsView.jsx` | 통계 하트 교체 |
| `src/features/profile/components/LikedPostsView.jsx` | 통계 하트 교체 |
| `package.json` / `package-lock.json` | `lucide-react` 설치(현재 코드에서 미사용 — §11 후속 과제) |

`authRedirect.js`, `useAuthPrompt.jsx`, `App.jsx`, `LoginPage.jsx`, `LoginForm.jsx`, `shareUtils.js`, `Modal.jsx`, `courseDisplay.js`, DB/Supabase, `docs/51` — 이번 작업 전체에서 전혀 수정하지 않았다.

---

## 10. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공, 209 modules(Astroid 되돌림 후 lucide-react 미참조 상태로 모듈 수 원복 확인). 기존 CSS 압축 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 통과(CRLF 안내만 존재) |
| `HeartIcon`/`♥`/`♡` 잔존 검색 | `courseDisplay.js`의 의도적으로 남긴 텍스트 포맷터 외 전부 `FavoriteHeartIcon`으로 교체 확인 |
| `Astroid`/`lucide-react` 코드 잔존 검색 | `src/` 전체 결과 없음(패키지 자체는 설치 상태로 남음) |

### 미검증(승인된 한계)

이 환경에는 브라우저 자동화 도구가 없어, 아래는 코드/CSS 스펙 추론으로만 확인했고 실제 렌더링은 확인하지 못했다.

- Community 통계 행의 최종 `gap-3` 간격이 시각적으로 자연스러운지
- Phrases 스피커 버튼 축소 후 카드 행 높이·정렬
- Voice help `AiSparklesIcon` 2배 확대 시 아이콘이 잘리지 않는지, `text-left` 적용 후 두 줄이 실제로 같은 좌측 기준선에 맞는지

---

## 11. 후속 과제

- 위 §10 미검증 항목 전체에 대한 실기기 확인
- `lucide-react`는 현재 코드에서 전혀 사용되지 않는 채로 `package.json`에 남아 있음 — 필요 시 `npm uninstall lucide-react`로 정리
- Voice help 문장 정렬이 실기기에서 여전히 어색하면 `<p>`에 표준 width/max-width 클래스 추가 검토
