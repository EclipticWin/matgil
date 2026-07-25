# 52. 가게 상세 공유 기능 구현 및 하트 아이콘 크기 요청 처리

## 1. 작업 일시

- 작성일시: 2026-07-25 15:18 KST

---

## 2. 작업 배경

`docs/51-hotplace-presets-multilingual-search-and-admin-managed-locale-notices.md`는 커밋 `3fa2fa5`(2026-07-24 00:17:47 +0900, `feat: 언어 안내 모달을 mg_locale_notices DB 연동 구조로 전환`)에 문서 자체와 함께 포함되어 커밋·push되었다(`git fetch origin main` 후 `git rev-parse HEAD origin/main`이 둘 다 `3fa2fa5`로 동일, `git rev-list --left-right --count HEAD...origin/main` = `0 0`으로 확인). 즉 51번 문서가 다루는 범위는 이미 origin/main까지 완전히 반영되어 있다.

이번 세션 시작 시점, 워킹 디렉터리에는 이미 다음이 **미커밋 상태로 존재**했다 — 이번 세션 이전의 다른 세션에서 진행된 작업으로 보이며, 이번 세션은 그 변경을 그대로 둔 채 위에 새 작업만 얹었다.

- `package.json`/`package-lock.json`: `@fortawesome/*` 패키지 4종 추가
- `src/shared/components/Icon.jsx`: `ShareIcon` 컴포넌트 추가(하트는 기존 `HeartIcon` 그대로 유지, 별도 FontAwesome 하트로 교체된 것은 `PlaceDetailSheet.jsx` 쪽)
- `src/features/explore/components/PlaceDetailSheet.jsx`: 제목/통계/액션 줄 레이아웃 재구성, 북마크 하트를 커스텀 SVG(`HeartIcon`)에서 `FontAwesomeIcon`(`faHeartSolid`/`faHeartRegular`)으로 교체, 공유 아이콘(`ShareIcon`, 아직 `onClick` 없는 껍데기) 배치
- `src/shared/i18n/dictionary.js`: `placeDetail.share`(ko/en/zh-CN) 라벨 키만 선추가된 상태

이 세션은 위 상태를 그대로 물려받아 두 가지 요청을 처리했다: (1) 하트 아이콘 크기 변경 요청과 그 되돌림, (2) 가게 상세 공유 버튼의 실제 공유 기능 구현. 아래 §4~5는 이번 세션에서 실제로 수행한 작업만 다룬다.

---

## 3. 조사에 사용한 명령(전부 읽기 전용)

```
git status --porcelain
git diff HEAD --stat
git diff HEAD -- <file>
git show --stat --date=iso 3fa2fa5
git fetch origin main
git rev-parse HEAD origin/main
git rev-list --left-right --count HEAD...origin/main
npm run build
git diff --check
```

---

## 4. 하트 아이콘 크기 요청 → 되돌림 (시행착오)

사용자가 "하트는 w-7로 바꿔줘"라고 요청해, `PlaceDetailSheet.jsx`의 북마크 액션 아이콘(`FontAwesomeIcon`)의 `className`을 `h-[18px] w-[18px]` → `h-7 w-7`로 변경했다. 곧바로 사용자가 "뭐하는 짓이야 ... 방금 한 이거 취소하고 다시 이 작업 전으로 돌려놔"라고 되돌리라고 지시해, `className`을 원래 값 `h-[18px] w-[18px]`로 즉시 원복했다.

- 문제였던 지점: 아이콘을 감싸는 버튼 자체 크기가 `h-6 w-7`(24px×28px)인데 아이콘을 `h-7 w-7`(28px×28px)로 키우면 버튼보다 아이콘이 커져 하트가 잘려 보일 수 있었다 — 되돌리기 전에 이 우려를 사용자에게 안내했다.
- 최종 상태: `h-[18px] w-[18px]`(원래 값)로 완전히 복귀 — 이 세션의 순net 변경사항은 없음(diff 없음).

---

## 5. 가게 상세 공유 기능 구현

### 5.1 요청 범위

- 가게 상세 화면의 공유 버튼에 실제 공유 기능 추가
- 모바일: OS 기본 공유창(Web Share API), PC/미지원: 가게 링크 클립보드 복사 + 토스트 안내
- 좋아요 기능·UI 배치·검색·리뷰·DB 구조·51번 문서는 건드리지 않음
- git add/commit/push 금지(구현 단계 한정 지시)

### 5.2 사전 조사 결과

- **가게 상세 URL이 이미 존재**: `ROUTES.placeDetail(placeId)` = `/places/:placeId` → `PlaceDetailPage.jsx`가 이미 라우팅돼 있었고, 로그인 여부와 무관하게 공개 접근 가능. `getPlaceById(id, locale)`로 조회해 없으면 `<Navigate to={ROUTES.courses} replace />`로 안전하게 빠지는 로직이 이미 구현돼 있었다(리뷰 페이지 딥링크와 동일 패턴). → **딥링크 복원 로직을 새로 만들 필요가 없었다.**
- **locale 안내 모달 자동 트리거 없음 확인**: `HomePage.jsx`의 `localeNotice`는 `LanguageModal`의 선택 클릭 이벤트(`handleLanguageSelected`)에서만 조회되며, `locale`을 감시하는 effect가 전혀 없다 — `/places/:id` 진입이 이 모달을 유발할 경로 자체가 없음을 확인했다.
- **전용 토스트 컴포넌트 없음**: `MyPage.jsx`(`toast` state, 3초 후 자동 소거), `FilterSheet.jsx`(`catLimitHit`, 2초) 모두 로컬 state + `setTimeout` 패턴을 각자 구현하고 있었다. 기존 공용 토스트가 없어 같은 로컬 패턴을 따랐다.
- **clipboard 유틸 없음**: 코드베이스 전체에서 `navigator.clipboard`/`writeText`/`execCommand('copy')` 사용 이력 없음 확인 — 새로 작성.
- **`t()` 보간 확인**: `LocaleProvider.jsx`의 `interpolate()`가 `{key}` 형태를 지원 — `t('placeDetail.shareText', { name: place.name })` 형태로 그대로 사용 가능.
- **basename 확인**: `vite.config.js`의 `base`가 dev `/`, build `/matgil/`. `App.jsx`는 `import.meta.env.BASE_URL`에서 `basename`을 뽑아 `BrowserRouter`에 넘김(HashRouter 아님, 실제 경로 기반 라우팅).

### 5.3 신규 파일 — `src/shared/utils/shareUtils.js`

```js
export function buildPlaceShareUrl(placeId) {
  const base = import.meta.env.BASE_URL ?? '/';
  const basename = base === '/' ? '' : base.replace(/\/$/, '');
  return `${window.location.origin}${basename}${ROUTES.placeDetail(placeId)}`;
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
```

- 도메인/배포 경로 하드코딩 없음 — `window.location.origin` + Vite `BASE_URL` 기반
- locale은 URL에 넣지 않음 — locale은 URL이 아니라 `localStorage`(`matgil_locale`)/`user_metadata`로 복원되는 기존 정책을 그대로 따름
- `copyToClipboard`는 async Clipboard API 우선, 실패 시 레거시 `execCommand('copy')` textarea 폴백 — 둘 다 실패하면 `false` 반환(throw하지 않음, 호출부가 성공/실패 토스트를 분기)

### 5.4 `PlaceDetailSheet.jsx` 변경

- `sharing`(중복 클릭 방지 boolean), `shareToast`(문자열, 3초 후 자동 소거 — `photoWarning` 배너와 동일한 `useEffect` 패턴 재사용) state 추가
- `handleShareClick()`:
  - 클릭 핸들러 안에서 **동기적으로** `navigator.share(...)` 호출(별도 `setTimeout` 없음 — 브라우저가 사용자 제스처 직후 호출만 허용하는 제약 대응)
  - `title`=`place.name`, `text`=`t('placeDetail.shareText', { name: place.name })`, `url`=`buildPlaceShareUrl(place.id)`
  - `err.name === 'AbortError'`(사용자 취소)는 토스트/console 없이 조용히 종료, 클립보드 폴백도 시도하지 않음
  - 그 외 실패 또는 `navigator.share` 자체 미지원 → `copyToClipboard(shareUrl)` 실행, 성공/실패에 따라 `placeDetail.shareCopied`/`placeDetail.shareCopyFailed` 토스트 표시, 실패 시 `console.warn`만(에러를 삼키지 않되 사용자에게는 토스트로만 안내)
- 공유 버튼 JSX: 기존 `type="button"`/`aria-label={t('placeDetail.share')}`/아이콘(`ShareIcon size={18}`)/크기(`h-6 w-6`)/위치는 그대로 두고 `onClick={handleShareClick}`만 추가
- 루트 컨테이너에 `relative` 추가(기존 `flex h-full flex-col`에 위치 지정 컨텍스트만 부여, 크기·간격 변경 없음) — 하단 토스트 오버레이(`pointer-events-none`, `absolute inset-x-0 bottom-4`)가 기존 레이아웃을 밀지 않고 겹쳐 뜨도록 하기 위함

### 5.5 `dictionary.js` 추가 키(ko/en/zh-CN 각 3개, `placeDetail.share` 라벨 바로 아래)

| 키 | en | ko | zh-CN |
|---|---|---|---|
| `shareText` | Check out {name} on Matgil. | 맛길에서 {name} 정보를 확인해 보세요. | 在 Matgil 查看{name}的信息。 |
| `shareCopied` | Link copied. | 링크가 복사되었습니다. | 链接已复制。 |
| `shareCopyFailed` | Could not copy the link. | 링크를 복사하지 못했습니다. | 无法复制链接。 |

---

## 6. 변경 파일 종합

| 파일 | 구분 | 비고 |
|---|---|---|
| `src/shared/utils/shareUtils.js` | new / uncommitted | `buildPlaceShareUrl`, `copyToClipboard` — 이번 세션 작성 |
| `src/features/explore/components/PlaceDetailSheet.jsx` | uncommitted | 이번 세션: 공유 핸들러/토스트/`onClick` 배선 추가. 세션 이전부터 있던 부분: 하트 FontAwesome 전환, 통계·액션 줄 레이아웃 재구성(§2) |
| `src/shared/i18n/dictionary.js` | uncommitted | 이번 세션: `shareText`/`shareCopied`/`shareCopyFailed` 9줄. 세션 이전부터 있던 부분: `share` 라벨 3줄 |
| `package.json` / `package-lock.json` | uncommitted | 세션 이전부터 있던 부분(`@fortawesome/*` 4종) — 이번 세션에서 변경 없음 |
| `src/shared/components/Icon.jsx` | uncommitted | 세션 이전부터 있던 부분(`ShareIcon` 추가) — 이번 세션에서 변경 없음 |

---

## 7. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run build` | 성공, 206 modules. 기존에 알려진 CSS 압축 경고 1건 + 500KB 청크 경고 1건 외 신규 오류 없음 |
| `git diff --check` | 통과(CRLF 안내만 존재, 실제 whitespace 오류 없음) |
| 미사용 import/state | 없음 — `buildPlaceShareUrl`/`copyToClipboard` 모두 사용, `sharing`/`shareToast` 모두 참조됨 |
| `navigator.share` feature detection | `if (navigator.share)`로 분기, 미지원 시 즉시 클립보드 폴백 경로로 진입 |
| `AbortError` 무시 | 확인 — 취소 시 토스트/클립보드 폴백 모두 스킵 |
| 공유 URL에 placeId 포함 | 확인 — `ROUTES.placeDetail(place.id)` 경유 |
| base path 유지 | 확인 — `import.meta.env.BASE_URL` 기반, dev(`/`)·GitHub Pages(`/matgil/`) 모두 대응 |
| 좋아요·리뷰·검색·DB 관련 diff | 없음 — `git diff --stat` 결과가 위 §6 표의 파일로 한정됨을 확인 |

### 미검증(승인된 한계)

- 이 세션에는 브라우저 자동화 도구(Playwright 등)가 설치돼 있지 않아, 다음은 코드 리뷰로만 확인했고 실제 브라우저/디바이스 동작 확인은 하지 못했다.
  - 공유 URL을 새 탭/시크릿 창에 붙여넣었을 때 해당 가게 상세가 실제로 열리는지
  - Android Chrome / iOS Safari에서 시스템 공유창이 실제로 뜨는지, 취소 후 재시도가 되는지
  - PC 브라우저에서 클립보드 복사 및 토스트가 실제로 보이는지
- 위 항목은 기존에 이미 동작이 검증된 `/places/:placeId` 딥링크 경로(리뷰 페이지 딥링크와 동일 패턴)를 그대로 재사용하므로 논리상 문제가 없을 것으로 판단하지만, 최종 확인은 사용자의 실제 브라우저 테스트가 필요하다.

---

## 8. git 상태 (이 문서 커밋 직전 기준)

- current branch: `main`
- HEAD(커밋 전): `3fa2fa5`(§2) — origin/main과 동일(0 0)
- 이 문서 작성 시점까지 `git add`/`commit`/`push`는 수행하지 않음
- 이 문서 작성 직후, 사용자 지시에 따라 위 §6의 모든 변경(이번 세션분 + 세션 이전부터 있던 미커밋분 전부)과 이 문서를 함께 커밋 후 push 진행 예정

---

## 9. 후속 과제

- 공유 URL 새 창 복원, Android/iOS Web Share, PC 클립보드 폴백의 실제 브라우저·디바이스 수동 검증
- 하트 아이콘 FontAwesome 전환 및 통계·액션 줄 레이아웃 재구성(세션 이전 작업분)에 대한 별도 작업일지 여부는 사용자 확인 필요 — 이번 문서에서는 현재 코드 상태 기록으로만 다룸
