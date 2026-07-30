# 66. 소셜 공유 Open Graph·Twitter 카드 메타데이터 및 대표 이미지 추가

## 1. 작업 일시

- 작성일시: 2026-07-31 AM 03:11 (KST)
- `git rev-parse HEAD` = `a62ba00e509775fb018d82dcb9aeac1256fad456`(`docs: overhaul bilingual project README`) — 이번 문서가 다루는 변경은 이 커밋 위의 **미커밋 working tree 변경**이다.

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/65-place-bookmark-count-fix-and-traveler-picks-guest-teaser-ux.md`
- 기준 커밋: `a62ba00`(`docs: overhaul bilingual project README`) — `git log --oneline --decorate -3` 기준 현재 `HEAD`.
- 조사 범위: `a62ba00` 이후 **커밋 없이** working tree에 쌓인 모든 변경.
- 조사 시점 저장소 상태(Git 확인):
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`, upstream: `origin/main`
  - `git status --short`: 수정(M) 1개(`index.html`) + untracked(??) 1개 디렉터리(`public/images/og/`, 내부에 `matgil_og_image.png` 1개 파일)
  - `git diff --cached --name-status`: 비어 있음 — 조사 시작 시점 staged 파일 없음.
- **README.md는 이번 조사 대상이 아니다** — `git diff --stat -- README.md`가 빈 출력이었고, `git log`상 README 개편(639줄 추가/54줄 삭제)은 이미 바로 직전 커밋 `a62ba00`으로 커밋되어 있다(Git 확인). 사용자가 제시한 "변경 후보" 중 README는 실제로는 이미 커밋된 상태이므로, 이번 작업일지와 커밋 범위에서 제외한다.

이번 문서는 **미커밋 상태로 남아 있던 두 가지 변경** — (1) `index.html`의 일반 메타데이터·Open Graph·Twitter 카드 정비, (2) 신규 대표 이미지 `public/images/og/matgil_og_image.png` 추가 — 를 정리한다.

---

## 3. 작업 배경

- **대화상 요청**: 카카오디벨로퍼스 URL 디버거와 카카오톡 공유 미리보기, 그리고 Twitter/X 등 Open Graph를 소비하는 서비스에서 맛길 배포 페이지(`https://eclipticwin.github.io/matgil/`)가 대표 이미지·제목·설명을 정상적으로 보여주도록 정적 `index.html`의 head를 정비할 것.
- 요구사항에는 문구를 임의로 새로 만들지 말 것, 실제 없는 기능을 추가하지 말 것, 한국관광공사와의 제휴·후원 관계를 암시하지 말 것, React 실행 후 JS로 메타 태그를 삽입하지 말고 정적 HTML에 직접 작성할 것이 포함되어 있었다(대화상 요청).
- 대표 이미지(`matgil_og_image.png`)는 사용자가 이미 준비해 프로젝트에 넣어둔 파일이며, 이번 작업은 그 이미지를 프로젝트에 추가하고 `index.html`에서 참조하는 것이 범위다 — 이미지 생성 자체는 이번 세션에서 다루지 않았다.

---

## 4. 기존 공유 미리보기 상태

이 절은 사용자가 실제로 보여준 카카오 URL 디버거 화면 캡처가 이 대화 안에 존재하지 않으므로, **`index.html`의 변경 전 diff(코드 확인)** 만을 근거로 작성한다. "카카오 디버거에서 실제로 어떻게 보였는지"는 사용자 서술에 근거한 배경이며, 이 문서 작성자가 직접 디버거 화면을 확인한 사실은 아니다.

`git diff`로 확인한 변경 전 `index.html`의 head는 다음과 같았다(코드 확인).

```html
<title>Matgil — Seoul Food Routes</title>
<meta property="og:type" content="website" />
<meta property="og:url" content="https://EclipticWin.github.io/matgil/" />
<meta property="og:title" content="맛길 | 서울 여행자를 위한 맛집 동선 추천" />
<meta property="og:description" content="서울의 로컬 맛집을 더 쉽게 찾고, 취향과 현재 위치에 맞는 맛집 동선을 추천받아 보세요." />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="맛길 | 서울 여행자를 위한 맛집 동선 추천" />
<meta name="twitter:description" content="서울의 로컬 맛집을 더 쉽게 찾고, 취향과 현재 위치에 맞는 맛집 동선을 추천받아 보세요." />
```

코드로 확인되는 구체적인 문제점(코드 확인):

- `og:image`가 아예 없음 — 공유 카드에 이미지가 뜰 자리가 없다.
- `og:site_name`이 없음.
- `og:url` 값의 도메인 표기가 `https://EclipticWin.github.io/...`로 대문자 오탈자 — 실제 배포 도메인(`eclipticwin.github.io`, 소문자)과 대소문자가 다르다.
- `meta name="description"`과 `link rel="canonical"`이 아예 없었다.
- `twitter:card`가 `summary`(작은 카드)였고 `twitter:image`도 없어, Twitter/X에서도 큰 이미지 미리보기가 뜰 수 없는 구조였다.
- 제목·설명 문구("맛길 | 서울 여행자를 위한 맛집 동선 추천", "서울의 로컬 맛집을 더 쉽게 찾고...")가 다국어 지원, Traveler Picks, 실전 한국어 표현 등 현재 서비스의 핵심 기능을 반영하지 못하고 있었다.

"공유 카드에 텍스트만 나타나고 시각적으로 비어 보인다"는 서술은 위 `og:image` 부재 사실로부터 합리적으로 추론되는 결과이며, 실제 카카오톡 화면 캡처로 확인된 사실은 아니다.

---

## 5. 대표 OG 이미지 추가

- 파일: `public/images/og/matgil_og_image.png`
- Git 상태: **신규 파일(untracked)** — `git status --short` 확인 결과 `?? public/images/og/`로, 이번 세션 이전에는 저장소에 존재하지 않았다.
- 형식 검증(코드/빌드 산출물 확인, 두 가지 방법으로 교차 확인):
  - `file public/images/og/matgil_og_image.png` → `PNG image data, 1731 x 909, 8-bit/color RGB, non-interlaced`
  - PNG `IHDR` 청크를 직접 16진수로 읽어 폭·높이 필드(`0000 06c3` = 1731, `0000 038d` = 909)를 재확인 — `file` 명령 결과와 정확히 일치.
  - 파일 크기: 1,477,021 바이트(약 1.4MB).
- Vite의 `public/` 디렉터리 파일은 빌드 시 그대로 `dist/` 루트에 복사되므로(코드 확인, `vite.config.js`에 별도 `publicDir` 재설정 없음 — 기본값 `public` 그대로), `public/images/og/matgil_og_image.png` → `dist/images/og/matgil_og_image.png`로 복사된다. production `base`가 `/matgil/`이어도 `public` 파일의 상대 경로 자체는 그대로 유지되므로 배포 후 URL은 `https://eclipticwin.github.io/matgil/images/og/matgil_og_image.png`가 된다 — 이 경로가 실제로 열리는지는 배포 후에만 확인 가능하다(§16).
- 이미지 생성 과정(디자인 반복, 시행착오 등)은 이번 세션에서 다루지 않았으므로 기록하지 않는다 — 이미 완성된 파일을 프로젝트에 추가한 것만이 이번 변경이다.

---

## 6. 일반 메타데이터

`git diff -- index.html`로 확인한 변경 후 값(코드 확인).

| 항목 | 최종 값 |
|---|---|
| `<title>` | `맛길 Matgil \| 서울 여행자를 위한 다국어 맛집 동선 추천` |
| `meta name="description"` | `서울의 맛집을 찾고, 취향과 기준 위치에 맞는 도보 맛집 동선을 추천받아 보세요. 실전 한국어 표현과 Traveler Picks도 함께 제공합니다.` |
| `link rel="canonical"` | `https://eclipticwin.github.io/matgil/` |

- 세 항목 모두 working `index.html`에서 정확히 1개씩만 존재함을 grep(`grep -c`)으로 확인했다(§14).
- 이전 값(`Matgil — Seoul Food Routes`, description·canonical 없음)은 완전히 교체되었고, 남아 있는 구버전 잔여물은 없다(diff 전문 대조 확인).

---

## 7. Open Graph 메타데이터

`index.html`(정적 소스)과 `dist/index.html`(빌드 산출물) 양쪽에서 동일하게 존재함을 확인했다(코드 확인 + 빌드 산출물 확인).

| 속성 | 값 |
|---|---|
| `og:url` | `https://eclipticwin.github.io/matgil/` |
| `og:type` | `website` |
| `og:title` | `맛길 Matgil \| 서울 여행자를 위한 다국어 맛집 동선 추천` |
| `og:description` | `서울의 맛집을 찾고, 취향과 기준 위치에 맞는 도보 맛집 동선을 추천받아 보세요. 실전 한국어 표현과 Traveler Picks도 함께 제공합니다.` |
| `og:image` | `https://eclipticwin.github.io/matgil/images/og/matgil_og_image.png` |
| `og:image:secure_url` | 위와 동일 |
| `og:image:type` | `image/png` |
| `og:image:width` | `1731` |
| `og:image:height` | `909` |
| `og:image:alt` | `맛길의 지도 기반 맛집 동선 추천, Traveler Picks, AI 음성 도움 화면` |
| `og:site_name` | `맛길 Matgil` |
| `og:locale` | `ko_KR` |
| `og:locale:alternate` | `en_US` |
| `og:locale:alternate` | `zh_CN`(같은 property가 두 번 — OG 스펙상 `locale:alternate`는 여러 개 허용되는 반복 속성이라 정상) |

- `og:image:width`/`height`는 §5에서 실측한 1731×909와 정확히 일치한다(코드 확인).
- 모든 태그가 `property` 속성을 쓰며, React 번들이 실행되기 전 정적 `index.html`에 직접 작성되어 있다 — `src/`의 어떤 JS 코드도 `<meta>`를 동적으로 주입하지 않는다(grep으로 `document.head`/`createElement('meta')` 류의 코드가 없음을 확인).
- `og:image`는 `/images/...`나 `/matgil/images/...` 같은 상대 경로가 아니라 `https://` 절대 URL이다(코드 확인).
- `og:title`/`og:description`/`og:image`/`og:url`/`og:site_name` 각각 정확히 1개씩만 존재함을 `dist/index.html`에서 grep으로 확인했다(§14).

---

## 8. Twitter/X 카드 메타데이터

| 속성 | 값 |
|---|---|
| `twitter:card` | `summary_large_image` |
| `twitter:title` | `맛길 Matgil \| 서울 여행자를 위한 다국어 맛집 동선 추천` |
| `twitter:description` | `서울의 맛집을 찾고, 취향과 기준 위치에 맞는 도보 맛집 동선을 추천받아 보세요. 실전 한국어 표현과 Traveler Picks도 함께 제공합니다.` |
| `twitter:image` | `https://eclipticwin.github.io/matgil/images/og/matgil_og_image.png` |
| `twitter:image:alt` | `맛길의 지도 기반 맛집 동선 추천, Traveler Picks, AI 음성 도움 화면` |

- 모두 `name` 속성을 사용한다(코드 확인).
- `twitter:site`/`twitter:creator`는 저장소 어디에도 맛길의 공식 Twitter/X 계정 핸들이 확인되지 않아 추가하지 않았다(의도적 누락).
- 이전 `twitter:card="summary"`(작은 카드) → `summary_large_image`로 전환되어, Open Graph를 그대로 따르지 않는 서비스에서도 큰 이미지 카드가 뜰 수 있는 최소 조건(카드 타입 + 이미지 + 대체텍스트)을 갖췄다 — 실제 렌더링은 배포 후에만 확인 가능(§16).

---

## 9. GitHub Pages 이미지 경로

- `vite.config.js`(코드 확인, 이번 세션에서 수정하지 않음): `base: command === 'build' ? '/matgil/' : '/'` — production 빌드의 base는 `/matgil/`.
- `public/` 디렉터리 파일은 Vite가 base와 무관하게 `dist/` 루트 상대 경로 그대로 복사하므로, `public/images/og/matgil_og_image.png` → `dist/images/og/matgil_og_image.png`(§14의 빌드 결과로 확인).
- 배포 후 공개 URL은 GitHub Pages가 이 저장소를 `https://eclipticwin.github.io/matgil/` 아래에 서빙하는 구조와 결합해 `https://eclipticwin.github.io/matgil/images/og/matgil_og_image.png`가 된다 — `og:image`/`twitter:image`에 이 완전한 URL을 그대로 사용했다(코드 확인, §6~§8).

---

## 10. 기존 SPA 처리 보존

- `index.html` 하단의 GitHub Pages SPA 복원 스크립트(`window.history.replaceState`를 이용해 `public/404.html`의 리다이렉트를 원래 경로로 되돌리는 즉시실행함수)는 위치·내용 모두 수정하지 않았다(`git diff`상 head 상단 메타 태그 블록만 변경, 스크립트 블록은 diff에 나타나지 않음).
- `charset`, `viewport` 메타 태그도 수정 전과 동일하게 유지된다(diff 확인, 두 줄 모두 변경분에 포함되지 않음).
- favicon: 이번 조사 결과 이 프로젝트에는 애초에 favicon 파일이나 `<link rel="icon">` 태그가 존재하지 않았다(코드 확인, `public/` 하위에 `*.ico`/`favicon*` 파일 없음) — "기존 favicon을 유지"할 대상 자체가 없어, 이번에도 새로 추가하지 않았다(범위 밖 판단).
- `public/404.html` 자체는 이번 세션에서 수정하지 않았다(`git status`에 나타나지 않음).

---

## 11. 변경하지 않은 항목

- `README.md` — 이미 `a62ba00`으로 커밋된 상태라 이번 범위에서 완전히 제외(§2).
- `vite.config.js`, `package.json`, GitHub Actions 워크플로 — `git status`에 나타나지 않아 미수정 확인.
- React Router 각 화면별 동적 OG 메타데이터 — 이번 요청 범위 밖으로 명시되어 손대지 않았다. 이번 변경은 배포 사이트 루트(정적 `index.html`)의 기본 공유 미리보기만 다룬다.
- `public/images/og/matgil_og_image.png` 파일 자체 — 추가만 했을 뿐 내용을 다시 만들거나 수정하지 않았다.

---

## 12. 변경 파일 종합

`git status --short`와 `git diff`로 실제 확인된 파일만 정리한다.

| 파일 | 신규/수정 | 역할 | 주요 변경 | 관련 절 |
|---|---|---|---|---|
| `index.html` | 수정 | 배포 사이트 루트 정적 head | title/description/canonical 추가, 구버전 OG·Twitter 태그를 최종값으로 교체, `og:image*`·`og:site_name`·`og:locale*`·`twitter:image*` 신규 추가 | §6, §7, §8, §10 |
| `public/images/og/matgil_og_image.png` | 신규 | 소셜 공유 대표 이미지 | 1731×909 PNG, `dist/images/og/`로 그대로 복사되어 배포됨 | §5, §9 |
| `docs/66-social-share-open-graph-metadata-and-og-image.md` | 신규 | 이 작업일지 | — | — |

`dist/`는 `.gitignore`에 등록되어 있고(코드 확인) 원래부터 추적 대상이 아니므로 이 표와 커밋 대상 모두에서 제외한다. `README.md`는 실제 diff가 없어(§2) 이 표에서 제외한다.

### 참고 — 커밋 대상에서 제외한 기존 미추적 파일

| 파일 | 이유 |
|---|---|
| `docs/작업일지 전문(숫자 클수록 최신).zip` | 사용자가 별도 보관 중인 기존 zip, 이번 작업과 무관 |

---

## 13. 빌드·검사

### 13.1 빌드 결과(빌드 산출물 확인)

- `npm run build`: 성공(231 modules transformed).
  - CSS 압축 경고 1건(`Expected identifier but found "-"`, `-: T.Z;`)이 이번에도 동일하게 발생 — 이전 여러 라운드(docs/64, docs/65)에서 반복 관찰된 것과 위치·문구가 동일해 이번 변경과 무관한 기존 경고로 판단한다. **빌드 실패가 아니라 경고이며, 빌드는 exit 0으로 종료되었다.**
- `git diff --check`: 통과(exit 0) — 출력은 `index.html`의 "LF will be replaced by CRLF" 경고뿐, 공백·충돌 마커 오류 없음.
- 충돌 마커(`<<<<<<<`/`=======`/`>>>>>>>`) 검색: `index.html`, 이 문서 전체에서 0건.

### 13.2 dist 산출물 확인

- `dist/index.html` 생성 확인.
- `dist/index.html`에서 grep으로 확인한 중복 여부(모두 정확히 1개):
  - `<title>` 1개, `meta name="description"` 1개, `link rel="canonical"` 1개
  - `property="og:title"` 1개, `property="og:description"` 1개, `property="og:image"`(정확히 이 속성값) 1개, `property="og:url"` 1개, `property="og:site_name"` 1개
  - GitHub Pages SPA 복원 스크립트(`<script type="text/javascript">` 블록, `window.history.replaceState` 호출) 각 1개
- `dist/images/og/matgil_og_image.png` 생성 확인 — 파일명 대소문자까지 원본과 일치, 파일 크기가 원본(1,477,021 바이트)과 동일해 무손실로 복사되었음을 확인.

---

## 14. 배포 후 검증 절차

다음은 **아직 완료로 단정할 수 없으며**, 실제 push 및 GitHub Pages 배포 이후에만 확인 가능하다.

1. GitHub Actions의 Pages 배포 워크플로 성공 확인
2. 브라우저에서 `https://eclipticwin.github.io/matgil/images/og/matgil_og_image.png`가 직접 열리는지 확인
3. 카카오디벨로퍼스 OG 캐시 초기화 도구에서 `https://eclipticwin.github.io/matgil/` 캐시 삭제
4. 같은 도구에서 이미지 URL(`.../images/og/matgil_og_image.png`)도 별도로 캐시 삭제
5. URL 디버거에서 페이지 URL을 다시 디버그
6. `og:image`, `og:site_name`, 이미지 가로·세로 크기까지 전체 항목 확인
7. 기존 카카오톡 채팅방이 아닌 새 채팅방 또는 새 메시지에서 공유 미리보기 재확인

이 문서 작성 시점 기준으로 "운영 페이지에 새 메타 태그가 이미 반영됨", "카카오톡 미리보기에 이미지가 이미 정상 표시됨", "Twitter/X 큰 카드가 이미 정상 표시됨", "카카오 캐시 초기화가 이미 완료됨" 중 어느 것도 사실로 확인되지 않았다 — 전부 §16의 커밋·푸시 이후 별도 확인이 필요한 항목이다.

---

## 15. 현재 상태

- 브랜치: `main`, 조사 시점 `HEAD`: `a62ba00e509775fb018d82dcb9aeac1256fad456`.
- §12의 수정 1개 + 신규 1개 코드/자산 파일과 이 문서(신규)는 이 문서 작성 시점까지 **미커밋 working tree 상태**였다(이후 커밋·푸시 진행, 결과는 최종 보고에 기재).

---

## 16. 승인된 한계와 후속 확인

- §4: "카카오 디버거에서 og:image/og:site_name이 비어 보였다"는 서술은 `index.html`의 변경 전 코드로부터 합리적으로 추론한 것이며, 실제 디버거 화면 캡처로 재확인한 사실은 아니다.
- §9, §14: 배포된 이미지 URL이 실제로 200 OK로 열리는지, 카카오톡·Twitter/X 실제 공유 미리보기가 의도대로 렌더링되는지는 이 문서 작성 시점 기준 확인되지 않았다.
- §10: favicon이 애초에 없던 프로젝트라는 사실 자체는 이번에 처음 확인된 것이며, 이 문서 작성 시점 기준 favicon 추가는 범위 밖으로 남겨둔다 — 필요 시 별도 요청으로 진행해야 한다.
- React Router 화면별 동적 OG 메타데이터는 여전히 다루지 않은 상태로 남아 있다(§11) — 필요 시 후속 작업으로 검토할 수 있다.
