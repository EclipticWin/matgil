# 64. 공공데이터 이미지 출처 대응 및 Traveler Picks 무한 스크롤 개선

## 1. 작업 일시

- 작성일시: 2026-07-29 AM 12:29 (KST)
- 이 문서가 다루는 모든 변경은 **현재까지 커밋되지 않은 상태**다. `git rev-parse HEAD` = `9158147c2181f16887590c96fb495f128bfa4087`이며, 아래 정리한 파일들은 전부 이 커밋 위의 working tree 변경(수정 17개 + untracked 4개)이다.

---

## 2. 기준 문서·기준 커밋·작업 범위

- 기준 문서: `docs/63-mobile-search-input-focus-horizontal-shift-fix.md`
- 기준 커밋: `9158147` (`fix: 모바일 검색 입력 포커스 시 화면 밀림 수정`) — `docs/63`이 다루는 마지막 커밋이자 현재 `HEAD`.
- 조사 범위: `9158147` 이후 **커밋 없이** working tree에 누적된 모든 변경.
- 조사 시점 저장소 상태:
  - 경로: `C:/Workspace/GitWorkspace/matgil`, 브랜치: `main`
  - `git rev-parse HEAD` = `9158147c2181f16887590c96fb495f128bfa4087` (변경 없음, 이번 세션에서 커밋한 적 없음)
  - `git status --short`: 수정(M) 17개, untracked(??) 4개(`docs/63-...md` 포함) — §15에 전체 표로 정리.

이번 문서는 `docs/63` 이후 이어진 **저작권 대응(공공데이터 이미지 출처)** 작업과, 그 과정에서 함께 진행된 **Traveler Picks Routes/Places 무한 스크롤 구현 및 오류 수정**을 하나로 묶어 정리한다. 두 작업은 대화 흐름상 순차적으로 이어졌으나 코드상으로는 상당 부분 겹치는 파일(`PublicRoutesTab.jsx`, `PublicPlacesTab.jsx`, `Thumbnail.jsx` 등)을 공유한다.

---

## 3. 작업 배경과 요구사항

대화 맥락에서 확인되는 요구사항은 다음과 같다(코드로 직접 검증되지 않는 배경 설명은 "대화상 요구사항"으로 표시한다).

- **대화상 요구사항**: 맛길이 표시하는 공공데이터 음식점 이미지가 공공누리(KOGL) 이용조건, 특히 제3유형의 변경금지 조건을 위반하지 않도록 표시 방식과 출처 안내를 정비할 것.
- **대화상 요구사항**: 이 작업은 "저작권 위험을 줄이기 위한 긴급 수정"으로 요청됨.
- **대화상 요구사항**: 이후 별도 요청으로 Traveler Picks(Routes/Places) 목록을 5개 단위 서버 페이지네이션 + 무한 스크롤로 전환.
- 진행 중 실제 화면에서 다음 두 가지 오류가 사용자에 의해 보고되었고(대화상 보고), 코드 조사로 원인을 특정해 수정했다.
  1. Routes 탭 최초 진입 시 무한 스크롤이 전혀 동작하지 않음(§11).
  2. Routes 탭에서 다음 페이지가 로딩되는 순간 화면이 최상단으로 튀는 현상(§12).

---

## 4. 공공데이터 출처 페이지 및 다국어 안내

### 4.1 신규 공개 페이지

- 페이지 컴포넌트: `src/pages/DataSourcesPage.jsx` (신규, untracked)
- 라우트 등록: `src/app/router.jsx`에 `<Route path={ROUTES.dataSources} element={<DataSourcesPage />} />` 추가 — `AppLayout`(하단 내비게이션이 있는 그룹) 바깥, `LoginPage`/`SignUpPage`와 같은 레벨에 등록되어 있어 로그인 여부와 무관하게 접근 가능하다(코드 확인).
- 라우트 상수: `src/shared/constants/routes.js`에 `dataSources: '/data-sources'` 추가(코드 확인).
- 페이지 자체는 `useNavigate()`의 `navigate(-1)`로 뒤로가기를 처리하며, 별도 인증 가드(`useAuth`/`Navigate to login` 등)가 코드에 없다 — 비로그인 상태에서도 렌더되는 구조임을 코드로 확인했다.

### 4.2 진입 링크

| 위치 | 파일 | 방식 |
|---|---|---|
| 로그인 화면 | `src/features/auth/components/LoginForm.jsx` | SNS 로그인 버튼 아래 `<Link to={ROUTES.dataSources}>{t('dataSources.loginLink')}</Link>`, `mt-6 text-center text-[0.7rem] text-ink-faint underline underline-offset-2` |
| 마이페이지 | `src/pages/MyPage.jsx` | SETTINGS 섹션의 `Language` 행 바로 아래 `<MyRow label={t('dataSources.settingsLabel')} onClick={() => navigate(ROUTES.dataSources)} />` |

두 진입점 모두 `git diff`로 확인했다(§15 표 참고).

### 4.3 세 공공데이터 공식명·URL·메타데이터

`src/shared/constants/publicDataSources.js`(신규)에 단일 소스로 관리되며, 코드에서 그대로 확인한 값은 다음과 같다.

| id | officialName | portalUrl | provider | department | registeredDate | updatedDate | licenseScope |
|---|---|---|---|---|---|---|---|
| `kto-ko` | 한국관광공사_국문 관광정보 서비스_GW | https://www.data.go.kr/data/15101578/openapi.do | 한국관광공사 | 디지털인프라팀 | 2022-06-24 | 2026-02-26 | 이용허락범위 제한 없음 |
| `kto-en` | 한국관광공사_영문 관광정보서비스_GW | https://www.data.go.kr/data/15101753/openapi.do | 한국관광공사 | 디지털인프라팀 | 2022-06-29 | 2026-02-26 | 이용허락범위 제한 없음 |
| `kto-zh` | 한국관광공사_중문 간체 관광정보서비스_GW | https://www.data.go.kr/data/15101764/openapi.do | 한국관광공사 | 디지털인프라팀 | 2022-06-29 | 2026-02-26 | 이용허락범위 제한 없음 |

- `KOGL_INFO_URL = 'https://www.kogl.or.kr/info/license.do'`도 같은 파일에 정의되어 `DataSourcesPage.jsx`의 이미지 안내 카드에서 링크로 쓰인다.
- 파일 상단 주석에 `officialName`/`provider`/`department`/`licenseScope`는 "번역하지 않고 원문 그대로 유지"하며 **"TourAPI"로 축약·의역하지 않는다**는 정책이 명시되어 있다(코드 확인). `DataSourcesPage.jsx`/`dictionary.js`/`publicDataSources.js` 전체를 대상으로 `TourAPI` 문자열을 검색한 결과 이 주석 문장(정책 설명) 외에는 존재하지 않는다.
- 세 데이터는 `PUBLIC_DATA_SOURCES` 배열을 `.map()`으로 그대로 렌더링해 **항상 셋 다 함께 표시**되며, locale에 따라 골라 보여주는 분기 코드는 없다(코드 확인).

### 4.4 데이터 가공·자동 번역 안내

`dictionary.js`의 `dataSources.processingBody`(en/ko/zh-CN)에서 실제 문구를 그대로 확인했다.

- KO: "맛길은 서비스 제공을 위해 일부 공공데이터를 저장·정규화하여 사용합니다. 공식 영문·중문 정보가 제공되지 않는 일부 항목은 국문 정보를 바탕으로 자동 번역하여 제공합니다. **자동 번역된 정보는 한국관광공사의 공식 영문·중문 번역이 아니며**, 실제 정보와 차이가 있을 수 있습니다. 중요한 방문 정보는 방문 전 해당 장소에 다시 확인해 주세요."
- EN: "…Automatically translated information is **not an official English or Chinese translation from the Korea Tourism Organization**, and may differ from the actual information. Please double-check important visit details with the place itself before you go."
- zh-CN: "…自动翻译的内容**并非韩国观光公社提供的官方英文或中文翻译**，可能与实际信息存在差异。重要的到店信息，请在出发前向该场所再次确认。"

세 언어 모두 "자동 번역 = 한국관광공사의 공식 번역이 아님"이라는 핵심 의미를 포함한다(코드 확인). Solar 등 특정 번역 엔진·모델명은 이 문구를 포함한 `dataSources.*` 전체 dictionary 키와 `DataSourcesPage.jsx`에 전혀 등장하지 않는다(전수 검색 결과).

### 4.5 EN/KO/zh-CN dictionary 대칭

`dataSources` 네임스페이스는 세 로케일 모두 다음 20개 키를 동일하게 갖는다(코드 확인): `pageTitle`, `loginLink`, `settingsLabel`, `imageSourceLink`, `intro`, `usedDataTitle`, `fieldProvider`, `fieldDepartment`, `fieldRegistered`, `fieldUpdated`, `fieldLicenseScope`, `viewSource`, `processingTitle`, `processingBody`, `imageTitle`, `imageBody`, `koglLinkLabel`, `attributionTitle`, `attributionBody` — en/ko/zh-CN 세 블록에서 키 이름이 정확히 일치한다.

---

## 5. 공공데이터 이미지 표시 정책

### 5.1 최종 이미지 이용조건 안내 문구

`dictionary.js`의 `dataSources.imageBody` 값을 그대로 옮긴다(코드 확인, 세 언어 모두 §4의 diff에서 확인됨).

**KO(최종)**
> 서비스에 표시되는 일부 음식점 이미지는 위 공공데이터에서 제공된 원본 이미지 URL을 사용합니다. 해당 공공데이터에는 공공누리 제1유형 또는 제3유형 이미지가 포함될 수 있습니다. 맛길은 공공데이터 이미지 이용 시 제3유형의 변경금지 조건을 고려하여, 이미지를 크롭하거나 필터·문구를 합성하지 않고 원본의 전체 내용이 보이도록 축소하여 표시합니다. 이미지 출처와 이용조건은 각 가게 정보 화면의 이미지 아래에 연결된 링크에서 확인할 수 있습니다. 공공누리 제3유형은 출처표시가 필요하며 변경 및 2차적 저작물 작성이 허용되지 않습니다.

**EN(최종)**
> Some restaurant images shown in the service use original image URLs provided by the public data above. This public data may include images under KOGL Type 1 or Type 3. Considering Type 3's no-modification condition, Matgil does not crop images or add filters or text to them, and instead scales them down so the original content is shown in full. You can check the image source and terms of use via the link below the image on each place's information screen. KOGL Type 3 requires attribution and does not allow modification or derivative works.

**zh-CN(최종)**
> 服务中显示的部分餐厅图片使用了上述公共数据提供的原始图片链接。该公共数据可能包含韩国公共著作物许可证(KOGL)第1类型或第3类型的图片。考虑到第3类型的禁止修改条件，Matgil在使用公共数据图片时不会进行裁剪，也不会合成滤镜或文字，而是在保持原始内容完整可见的前提下进行缩小显示。图片来源与使用条件，可在各店铺信息页面中图片下方的链接查看。KOGL第3类型要求标注来源，且不允许进行修改或二次创作。

세 언어 모두 다음을 확인했다(코드 확인).
- "모든 이미지를 제3유형으로 간주한다" 또는 "유형을 구분할 수 없다"는 취지의 문구는 **없다** — 대신 "제3유형의 변경금지 조건을 고려하여"라는, 조건을 보수적으로 준수한다는 취지만 담겨 있다.
- `original 4:3 ratio`, `4:3 frame` 같은 비율을 확정하는 표현은 **없다** — "원본의 전체 내용이 보이도록 축소하여 표시"라는 표현만 사용한다.
- "저작권을 준수했다/적법하다"는 식의 법적 단정 문구는 **없다**.
- 제휴·후원·보증 관계를 암시하는 문구는 **없다**.

### 5.2 이미지 표시 방식 변경 범위

`src/shared/components/Thumbnail.jsx`(공용 컴포넌트) 및 이를 호출하는 활성 화면 6곳을 diff로 확인했다.

**`Thumbnail.jsx` 변경(코드 확인)**
- 실제 이미지(`src` 존재) 분기: `object-cover` → `object-contain`, `h-full w-full` 그대로 유지.
- 이 분기는 `rounded` prop을 아예 받지 않도록 변경(`cn('shrink-0 overflow-hidden', className)` — 이전에는 `rounded`가 세 번째 인자로 들어가 있었음) → 실제 이미지는 항상 직각.
- 이 분기의 기본 배경색(`bg-white`)도 제거 — 호출부의 `className`이 각 화면에 맞는 배경 토큰을 직접 지정하도록 위임(§6.3 참고).
- placeholder(이미지 없음) 분기는 `rounded` prop을 그대로 받아 기존 `rounded-2xl` 기본값을 유지 — 단, 6개 활성 호출부는 모두 `rounded=""`를 명시적으로 넘겨 placeholder도 직각으로 통일했다.

**활성 호출부 6곳(모두 diff로 className 변경 확인)**

| 파일 | 위치 | 변경 전 | 변경 후 |
|---|---|---|---|
| `PlaceDetailSheet.jsx` | 가게 상세 대표 이미지 | `h-44 w-full` | `aspect-[4/3] w-full bg-paper-soft` + `rounded=""` |
| `TodayCourseDetail.jsx` | Map 동선 상세 stop | `h-14 w-14 shrink-0` | `aspect-[4/3] w-14 shrink-0 bg-paper-soft` + `rounded=""` |
| `PublicCourseDetailPage.jsx` | Picks 공개 동선 상세 stop | `h-14 w-14 shrink-0` | `aspect-[4/3] w-14 shrink-0 bg-paper-soft` + `rounded=""` |
| `SavedCourseDetailPage.jsx` | 저장 동선 상세 stop | `h-14 w-14 shrink-0` | `aspect-[4/3] w-14 shrink-0 bg-paper-soft` + `rounded=""` |
| `PublicPlaceCard.jsx` | Traveler Picks Places 카드 | `h-[4.5rem] w-[4.5rem] shrink-0` | `aspect-[4/3] w-[4.5rem] shrink-0 bg-white` + `rounded=""` |
| `SavedPlaceCard.jsx` | 저장한 가게 카드 | `h-[4.5rem] w-[4.5rem] shrink-0` | `aspect-[4/3] w-[4.5rem] shrink-0 bg-white` + `rounded=""` |

- 배경 토큰은 각 화면의 실제 배경과 맞췄다: 가게 상세/동선 상세 3곳은 페이지 루트(또는 NearbySheet 바텀시트)의 `bg-paper-soft`, Places/저장한 가게 카드는 흰색 `Card` 컴포넌트 안에 있어 `bg-white`.
- border, shadow, filter, gradient, 텍스트 합성은 6곳 어디에도 추가되지 않았다(diff 확인).
- Traveler Picks Places 카드 자체(`Card` 컴포넌트, `rounded-3xl`)의 라운드는 그대로이며, `Thumbnail`이 카드 내부 `p-3` 패딩 안에 있어 카드 모서리와 맞닿지 않는다 — 카드 전체 직각화는 없었다(코드 확인).

### 5.3 제외된 사용자 이미지

`object-cover`/`rounded-*`가 남아 있는 사용자 이미지 관련 컴포넌트를 grep으로 확인했다 — 이번 작업에서 전혀 수정되지 않았다(`git diff --name-status`에 포함되지 않음).

- `src/features/community/components/PostCard.jsx`, `PostComposer.jsx` — Community 게시글/작성 이미지
- `src/features/places/components/ReviewCard.jsx`, `ReviewComposer.jsx` — 리뷰 사진
- `src/features/profile/components/LikedPostsView.jsx`, `MyPostsView.jsx` — Community 목록 썸네일

이들은 모두 `Thumbnail.jsx`를 사용하지 않는 별도의 `<img>` + `object-cover` 구조이며, 사용자 업로드 이미지(공공데이터가 아님)이므로 이번 작업 대상에서 제외되었다.

---

## 6. 가게 상세 이미지·출처 UI 보정

`src/features/explore/components/PlaceDetailSheet.jsx`의 최종 diff를 기준으로 작성한다(§4의 diff 원문 참고). 이 화면은 Map 탭 바텀시트(`NearbySheet.jsx`)와 `PlaceDetailPage.jsx`(Traveler Picks Places 상세, 저장한 가게 상세 포함) 양쪽에서 공용으로 쓰인다.

### 6.1 최종 구조

```jsx
<div className="pt-2.5 pb-4">
  <Thumbnail
    src={place.imageUrl}
    tint={place.tint ?? '#FFE3D4'}
    rounded=""
    className="aspect-[4/3] w-full bg-paper-soft"
  />
</div>
```

- 실제 이미지와 placeholder 모두 좌우 padding 없이 렌더되어 앱 프레임 폭 전체를 사용한다 — 이전에는 실제 이미지가 있을 때만 좌우 padding을 없애는 조건부 구조였으나, 최종적으로는 이미지 유무와 무관하게 항상 동일한 `pt-2.5 pb-4` 래퍼 하나로 통일됐다(현재 코드 기준).
- 제목·평점·하트·공유가 있는 상단 줄(`px-5 pb-1.5`)과 이미지 아래 subtitle/주소/설명 섹션(`px-5 pb-4`)은 좌우 padding(`px-5`)을 그대로 유지한다(diff 확인 — 이 두 섹션의 className은 변경되지 않았다).
- 이미지 모서리는 `rounded=""`로 직각.
- `object-contain`이라 원본 비율이 4:3과 다르면 영역 내부에 상하 또는 좌우 여백(letterbox)이 생길 수 있다 — 이는 크롭을 피하기 위해 승인된 표시 특성이며, 실제 브라우저에서 각 이미지의 정확한 여백 크기를 계측하지는 않았다.

### 6.2 위·아래 외부 여백 대칭

주석(코드에 그대로 있음)에 따르면: 이미지 위쪽 통계 줄과의 간격은 `pb-1.5`(이름 블록의 하단 padding, 6px) + `pt-2.5`(이미지 래퍼의 상단 padding, 10px) = 16px이고, 이미지 래퍼 자신의 `pb-4`(16px)가 이미지 아래 subtitle 섹션과의 간격을 동일하게 16px로 맞춘다. 이미지 자체의 높이·비율·배경·full-width 구조는 이 여백 추가로 바뀌지 않았다(diff 확인).

### 6.3 배경색

`Thumbnail`의 실제 이미지 분기 배경을 하드코딩된 `bg-white`에서 제거하고, `PlaceDetailSheet.jsx` 호출부가 `bg-paper-soft`를 명시했다. `PlaceDetailPage.jsx`(`<div className="h-full bg-paper-soft">`)와 `NearbySheet.jsx`의 바텀시트(`bg-paper-soft`) 양쪽 컨텍스트의 실제 배경과 동일한 토큰임을 코드로 확인했다.

### 6.4 출처 링크 위치 변경 흐름 (시간 순서)

이 부분은 한 번에 최종 형태로 구현되지 않았다. 대화 흐름상 다음 순서로 바뀌었다(중간 단계는 현재 diff에 남아있지 않으며, 이번 문서 작성 시점의 대화 맥락 근거로만 기록한다).

1. **1차**: 대표 이미지 바로 아래에 `PublicDataAttribution`을 배치(오른쪽 정렬, 공용 컴포넌트 기본값).
2. **2차**: 사용자 요청에 따라 이미지 바로 아래 링크를 제거하고, 가게 상세 **최하단**(Location/Visit Info/푸드 타입 배지 다음)으로 이동. 정렬은 여전히 공용 컴포넌트 기본값(오른쪽).
3. **3차(최종)**: 같은 최하단 위치를 유지한 채 **가게 상세에서만** 왼쪽 정렬로 재변경.

**최종 코드(diff로 확인)**:

```jsx
{place.imageUrl && (
  <div className="border-t border-ink/5 px-5 py-4">
    <PublicDataAttribution className="!text-left" />
  </div>
)}
```

- 위치: 카테고리(푸드 타입) 태그 섹션 바로 다음, `border-t border-ink/5`(다른 섹션과 같은 톤의 구분선) 안.
- 표시 조건: `place.imageUrl`이 있을 때만 — placeholder만 있는 가게는 안내할 실제 이미지 출처가 없으므로 표시하지 않는다(기존 조건 유지, 코드 확인).
- 정렬: `PublicDataAttribution` 자체의 기본 정렬은 `block w-full text-right`(오른쪽)이며, 가게 상세 호출부에서만 `className="!text-left"`로 override한다. 단순 `text-left` 클래스는 컴파일된 CSS에서 `.text-right`가 나중에 정의되어 있어 효과가 없어(빌드 산출물로 확인) `!important` 수정자를 사용했다. 이 override는 이 호출부 `className`에만 있어 다른 화면의 `PublicDataAttribution`에는 영향이 없다(§8 참고).

### 6.5 푸드 타입 배지 영역 여백

```jsx
{uniqueChips.length > 0 && (
  <div className="border-t border-ink/5 px-5 py-4">
    <div className="flex flex-wrap gap-2">{/* 배지들 */}</div>
  </div>
)}
```

- 배지 영역 자체는 원래도 `py-4`(상하 각 16px)로 상하 대칭이었다. 다만 예전에는 이 다음에 고정 `<div className="h-5" />`(20px) 스페이서가 항상 붙어 있어, 배지~페이지 끝까지의 총 여백(16+20=36px)이 배지 위쪽 여백(16px)보다 훨씬 커 보였다.
- 최종적으로 이 `h-5` 스페이서는 "카테고리 태그도, 대표 이미지도 없는" 드문 경우에만 조건부로 남기고, 일반적인 경우에는 §6.4의 출처 링크 섹션(자체 `py-4`)이 그 자리를 대신한다(코드 확인, 아래 §6.6 참고).

### 6.6 최종 마지막 섹션 구조

```jsx
{uniqueChips.length === 0 && !place.imageUrl && <div className="h-5" />}
```

이 조건부 스페이서가 코드에 그대로 남아 있음을 확인했다 — 두 섹션(배지, 출처 링크)이 모두 렌더되지 않는 예외적인 경우에만 기존 여백을 대신 채운다.

---

## 7. 동선 상세 및 목록 이미지 UI 보정

대상: `TodayCourseDetail.jsx`(Map 동선 상세), `PublicCourseDetailPage.jsx`(Picks 공개 동선 상세), `SavedCourseDetailPage.jsx`(저장 동선 상세). 세 파일의 diff가 사실상 동일한 패턴이다(§4 diff 참고).

- stop 썸네일: `aspect-[4/3] w-14 shrink-0 bg-paper-soft` + `rounded=""` — 실제 이미지와 placeholder 모두 직각, 동일한 4:3 영역.
- stop 이미지는 삭제되지 않았고, `<Thumbnail src={stop.imageUrl} .../>` 호출 자체는 그대로 유지된다(diff 확인).
- stop을 감싸는 카드(`rounded-2xl border border-ink/5 bg-white/45 px-3 py-3`)의 라운드는 그대로다 — `Thumbnail`이 이 카드의 `px-3 py-3` 패딩 안에 있어 카드 모서리와 맞닿지 않는다.
- 출처 링크 `<PublicDataAttribution className="mt-4" />`(TodayCourseDetail)/`className="mt-4"`(나머지 둘)가 stop 목록 바로 다음에 추가됐다 — **가게 상세와 달리 이동 없이 목록 아래, 오른쪽 정렬(공용 컴포넌트 기본값) 그대로**다(diff 확인, `!text-left` 같은 override 없음).
- 원본 이미지가 940×705(정확히 4:3)라는 사실은 이번 대화(현재 세션이 아닌 이전 세션)에서 확인됐다고 다뤄졌으나, **이 문서 작성 시점에 그 수치를 직접 재계측하지는 않았다** — 4:3 영역과 실제 렌더 결과가 픽셀 단위로 정확히 일치하는지는 브라우저 계측 없이 코드 구조(`aspect-[4/3]` + `object-contain`)만으로 판단한 것이며, 확정적으로 표현하지 않는다.

---

## 8. 공용 이미지 출처 링크 컴포넌트

`src/shared/components/PublicDataAttribution.jsx`(신규, untracked)

```jsx
<Link
  to={ROUTES.dataSources}
  className={cn('block w-full text-right text-[0.68rem] text-ink-faint underline underline-offset-2', className)}
>
  {t('dataSources.imageSourceLink')}
</Link>
```

- 기본 정렬은 오른쪽(`text-right`), 글자 크기 `text-[0.68rem]`, 색상 `text-ink-faint`, 밑줄.
- `/data-sources`로 이동하며, 이 라우트는 §4.1에서 확인했듯 로그인 없이 접근 가능하다.
- **실제 사용처 전수(코드 확인, `import PublicDataAttribution` grep 결과)**:

| 파일 | 위치 | 정렬 |
|---|---|---|
| `PlaceDetailSheet.jsx` | 가게 상세 최하단 | `!text-left`로 국소 override(왼쪽) |
| `TodayCourseDetail.jsx` | Map 동선 상세 목록 아래 | 기본값(오른쪽) |
| `PublicCourseDetailPage.jsx` | Picks 공개 동선 상세 목록 아래 | 기본값(오른쪽) |
| `SavedCourseDetailPage.jsx` | 저장 동선 상세 목록 아래 | 기본값(오른쪽) |
| `PublicPlacesTab.jsx` | Traveler Picks Places 목록 최하단 | 기본값(오른쪽), 단 전용 footer wrapper 사용(§10) |
| `SavedPlacesTab.jsx` | 저장한 가게 목록 최하단 | 기본값(오른쪽) |

- `PublicRoutesTab.jsx`(Traveler Picks Routes 목록)에는 `PublicDataAttribution`이 없다 — Routes 카드는 음식점 사진이 아니라 번호가 매겨진 스톱 경로(`CourseStopPath`)만 표시하므로 이미지 출처를 안내할 대상이 없다(코드 확인, `grep`으로 `PublicDataAttribution`/`imageUrl`이 `PublicRoutesTab.jsx`에 없음을 확인).
- 컴포넌트 자체(`text-right` 기본값)는 이번 문서가 다루는 전체 변경 동안 **한 번도 왼쪽으로 재변경되지 않았다** — 가게 상세만 호출부 `className`으로 override한다(§6.4).

---

## 9. Traveler Picks 5개 단위 서버 페이지네이션

### 9.1 기존부터 RPC 기반이었던 구조

`src/features/courses/services/publicFeedService.js`의 `fetchPublicCourseFeed`/`fetchPublicPlaceFeed`는 이번 작업 이전부터 `supabase.rpc('get_public_course_feed'/'get_public_place_feed', { p_sort, p_limit, p_offset })`를 호출하는 구조였다(이번 diff에 이 파일 자체는 포함되지 않음 — `git diff --name-status`에 없음, 즉 **수정되지 않았다**). 즉 일반 `.from().select().range()`가 아니라 처음부터 RPC의 `p_limit`/`p_offset` 인자로 서버 페이지네이션을 하는 구조였다.

**대화상 확인된 RPC 세부 정보** (이 세션에서 직접 SQL을 조회하지 않았으므로, 사용자가 Supabase에서 확인해 전달한 내용으로 기록한다 — 저장소 안에 실제 `CREATE FUNCTION` 정의는 존재하지 않는다):
- `get_public_course_feed`: Popular 정렬 `save_count desc → latest_saved_at desc → public_route_key`, Latest 정렬 `latest_saved_at desc → public_route_key`.
- `get_public_place_feed`: Popular 정렬 `save_count desc → latest_saved_at desc → place_id`, Latest 정렬 `latest_saved_at desc → place_id`.
- 두 RPC 모두 `STABLE SECURITY DEFINER`, `total_count` 반환, 비로그인 `safe_limit` 최대 5, 로그인 `safe_limit` 최대 50.

### 9.2 페이지 크기: 10 → 5 통합

`git diff`로 직접 확인한 변경:

```diff
- const LOGGED_IN_PAGE_SIZE = 10;
- const GUEST_LIMIT = 5;
+ import { MAX_PUBLIC_FEED_ITEMS, PUBLIC_FEED_PAGE_SIZE } from '../constants/publicFeed.js';
```

`src/features/courses/constants/publicFeed.js`에 신규 상수를 추가했다.

```js
export const PUBLIC_FEED_PAGE_SIZE = 5;
```

- Routes(`PublicRoutesTab.jsx`)와 Places(`PublicPlacesTab.jsx`) 둘 다 기존 로컬 상수(`LOGGED_IN_PAGE_SIZE=10`, `GUEST_LIMIT=5`)를 제거하고 이 단일 상수를 최초 요청(`offset:0`)과 추가 요청(`Math.min(PUBLIC_FEED_PAGE_SIZE, remaining)`) 모두에 사용한다(diff 확인). 로그인 여부와 무관하게 항상 5개씩 요청한다.
- `MAX_PUBLIC_FEED_ITEMS = 150`은 이전과 동일하게 유지(코드 확인, 값 변경 없음).
- 비로그인 사용자는 RPC 서버 측 `safe_limit`(대화상 확인, 최대 5) 정책과 프론트 로그인 가드(`handleLoadMore()`가 `!user`면 `openAuthPrompt` 후 즉시 반환)가 겹쳐, 최초 5개까지만 노출되고 추가 요청은 발생하지 않는다.

### 9.3 "더 보기" 버튼 제거와 IntersectionObserver

두 탭 모두 다음과 같이 바뀌었다(diff 확인).

```diff
- <button type="button" onClick={handleLoadMore} disabled={loadingMore} ...>
-   {loadingMore ? <Spinner .../> : t('publicFeed.loadMore')}
- </button>
+ <div ref={setSentinelNode} className="mt-1 flex justify-center py-1">
+   {loadingMore && <Spinner className="h-4 w-4 border-ink/20 border-t-ink/50" />}
+ </div>
```

- 기존 공용 `src/shared/components/Spinner.jsx`를 그대로 재사용(새 스피너 구현 없음, `className`만 전달).
- `t('publicFeed.loadMore')` 문구(버튼 라벨)는 더 이상 이 위치에서 쓰이지 않지만, dictionary 키 자체를 삭제하지는 않았다(diff에 `dictionary.js`의 `publicFeed.loadMore` 삭제 내역 없음).
- sentinel은 `useState`로 관리되는 콜백 ref(`const [sentinelNode, setSentinelNode] = useState(null)`, `<div ref={setSentinelNode}>`)이며, 이 설계 이유는 §11에서 다룬다.

### 9.4 각 탭의 독립 state와 공통 가드

두 탭 모두 다음 state/ref를 각자 독립적으로 유지한다(diff 확인, 두 파일 모두 동일한 이름).

- state: `rows`(Routes)/`places`(Places), `offset`, `totalCount`, `loading`, `loadingMore`, `loadMoreError`
- ref: `sortRef`(stale-sort 응답 가드), `fetchingRef`(동시 요청 방지), `sentinelNode`(state), `handleLoadMoreRef`, `hasMoreRef`, `userRef`

```js
if (sortRef.current !== requestedSort) return; // stale sort 응답 폐기
```

```js
if (fetchingRef.current) return; // 동시 요청 방지
```

- Routes dedupe key: `public_route_key`(`dedupeRows()`), Places dedupe key: `place_id`(`seen` Set) — 둘 다 diff 이전부터 있던 로직 그대로 유지.
- offset은 dedupe 이후 배열 길이가 아니라 **RPC가 실제로 반환한 raw 응답 길이**로 누적한다: `setOffset((prev) => prev + data.length)`(Routes)/`setOffset((prev) => prev + rows.length)`(Places) — `rows`/`data`는 dedupe 전의 원본 응답 변수다(코드 확인).
- Popular/Latest 전환 시 각 탭의 초기 로딩 `useEffect`(의존성 배열에 `sort` 포함)가 `offset:0`부터 다시 조회한다 — 이 effect 자체의 구조는 이번 변경 전후로 유지되었다(diff 확인, `useEffect(..., [sort, user?.id, reloadTick, ...])`).
- `ExplorePage.jsx`는 Routes/Places 컴포넌트를 unmount하지 않고 `className={tab === 'routes' ? 'mt-4' : 'hidden'}`로 항상 마운트 상태를 유지한다(diff 확인 — 이 패턴 자체는 변경 전부터 있었고, 이번엔 `active={tab === 'routes'}`/`active={tab === 'places'}` prop만 추가됐다).
- `active` prop을 각 탭의 observer effect가 확인해, 숨겨진 탭에서는 `if (!active || !sentinelNode) return undefined;`로 observer를 만들지 않거나 기존 observer를 disconnect한다(코드 확인).

### 9.5 Places 렌더 순서

```jsx
<div className="flex flex-col gap-3">
  {places.map(...)}
  {hasMore && <div ref={setSentinelNode}>{loadingMore && <Spinner/>}</div>}
  {loadMoreError && <p>...}
</div>
<div className="pt-4 -mb-2">
  <PublicDataAttribution />
</div>
```

카드 → sentinel/spinner → 오류 문구 → 출처 링크 순서를 diff로 확인했다(§10에서 여백 계산을 자세히 다룬다).

---

## 10. Places 출처 링크와 로딩 UI 여백 보정

### 10.1 중간 구현(현재 코드에는 없음)

대화 흐름상, 처음에는 다음과 같이 구현됐던 것으로 확인된다(현재 `git diff`는 `HEAD` 대비 최종 상태만 보여주므로, 이 중간 단계 자체는 diff로 재현되지 않고 대화 맥락으로만 기록한다).

- `<PublicDataAttribution className="mt-1 mb-4" />`를 카드 목록과 같은 `flex flex-col gap-3` 컨테이너 **안에** 배치.
- 위쪽 간격을 `gap-3(12px) + mt-1(4px) = 16px`, 아래쪽 간격을 `mb-4(16px)`로 계산해 "대칭"이라고 판단.

이 계산은 `flex-col` 컨테이너 자기 자신의 경계까지만 따진 것이었고, 실제 화면에 보이는 하단 경계에는 이 컨테이너 바깥의 `ExplorePage.jsx`(`PageShell` 사용)의 `pb-6`(24px)까지 추가로 포함되어, 실제 아래쪽 여백은 `16+24=40px`로 위쪽(16px)보다 훨씬 컸다 — 사용자가 실기기에서 이 비대칭을 직접 지적했다.

### 10.2 최종 구현

`PublicPlacesTab.jsx` 최종 diff(§9.3~9.5의 diff와 동일 파일):

```jsx
return (
  <>
    <div className="flex flex-col gap-3">
      {/* 카드, sentinel/spinner, 오류 문구 */}
    </div>

    <div className="pt-4 -mb-2">
      <PublicDataAttribution />
    </div>
  </>
);
```

- `PublicDataAttribution`을 `flex flex-col gap-3` 컨테이너 **밖으로** 꺼내 별도 fragment 형제로 분리했다(diff 확인 — 반환문이 단일 `<div>`에서 `<>...</>` fragment로 바뀜).
- 새 wrapper `className="pt-4 -mb-2"`:
  - `pt-4`(16px) — 카드/센티널 목록과의 위쪽 간격을 직접 지정(더 이상 부모 `gap-3`+링크 자신의 `mt-1` 조합에 의존하지 않음).
  - `-mb-2`(-8px, Tailwind 기본 음수 마진 유틸리티) — `PageShell`의 `pb-6`(24px)과 합쳐 정확히 `24-8=16px`이 되도록 보정. `PageShell.jsx` 자체는 수정하지 않았다(`git diff --name-status`에 `PageShell.jsx` 없음).
  - 코드 내 주석에 이 계산 근거(`gap-3+mt-1/mb-4` 방식이 왜 틀렸는지, `-mb-2`가 왜 정확한지)가 그대로 남아 있다(diff 확인).
- 이 wrapper는 `PublicPlacesTab.jsx`의 이 사용처에만 있으며, `PublicDataAttribution.jsx` 컴포넌트 자체나 다른 화면(§8 표의 나머지 5곳)에는 영향이 없다(diff 확인 — `PublicDataAttribution.jsx` 파일 자체의 diff에 이 변경이 없음).

### 10.3 spinner 여백

sentinel/spinner wrapper(`<div ref={setSentinelNode} className="mt-1 flex justify-center py-1">`)는 Routes/Places 양쪽에서 동일한 class 문자열을 사용한다(diff 확인, 두 파일에서 완전히 동일).

- `mt-1`(4px) — 이전 "더 보기" 버튼이 쓰던 것과 같은 값으로, 부모 `gap-3`(12px)과 합쳐 카드~sentinel 간격을 16px로 유지.
- `py-1` — spinner가 보일 때 상하 여백을 대칭으로 준다(spinner가 없을 때도 이 padding은 그대로 유지되어 sentinel 높이가 급격히 바뀌지 않는다).
- 새로운 색상 토큰은 추가되지 않았다 — `Spinner` 자체의 `border-ink/20 border-t-ink/50`은 이전 버튼 내부 spinner와 동일한 값이다(diff 비교로 확인).

---

## 11. Routes 최초 진입 무한 스크롤 미동작 수정

### 11.1 증상 (대화상 보고)

Traveler Picks 최초 진입 시 기본 활성 탭인 Routes에서 5위 이후 자동 로딩이 전혀 되지 않고, Places 탭으로 이동했다가 Routes로 돌아오면 그제야 동작했다.

### 11.2 확인된 원인 (코드 분석 근거)

`PublicRoutesTab.jsx`에는 다른 곳에는 없는 세 번째 early-return 분기가 있다.

```jsx
if (localizedPlacesLoading && allStopIdsKey && localizedPlacesById.size === 0) {
  return <div className="flex justify-center py-16"><Spinner .../></div>;
}
```

(위는 §12에서 다루는 수정 이후의 조건이며, 수정 전에는 `localizedPlacesById.size === 0` 조건 없이 `if (localizedPlacesLoading && allStopIdsKey)`였다.)

- 초기 fetch가 `.then()`(rows/offset/totalCount 세팅)과 `.finally()`(loading=false)로 별도 마이크로태스크 두 번에 걸쳐 진행되는 동안, 별도의 현지화 배치 effect가 `localizedPlacesLoading=true`를 세팅한다.
- sentinel이 실제로 DOM에 마운트되는 렌더(모든 early-return을 통과하는 렌더)와, 당시 observer effect의 의존성 배열(`[active, hasMore, loading]`, 수정 전)이 "바뀌었다"고 인식하는 렌더가 서로 어긋나 있어, effect가 sentinel이 실제로 존재하게 된 렌더에서 재실행되지 않았다.
- 탭을 전환하면 `active`가 바뀌어 effect가 다시 실행되고, 그 시점에는 이미 sentinel이 마운트돼 있어(숨겨진 상태로도 DOM엔 남아있음) 그제야 연결됐다.

### 11.3 최종 수정 (diff 확인)

```diff
- const sentinelRef = useRef(null);
+ const [sentinelNode, setSentinelNode] = useState(null);
```

```diff
  useEffect(() => {
-   if (!active) return undefined;
-   const sentinel = sentinelRef.current;
-   if (!sentinel) return undefined;
+   if (!active || !sentinelNode) return undefined;
    const observer = new IntersectionObserver(
      (entries) => { ... },
      { root: null, rootMargin: '160px 0px', threshold: 0 },
    );
-   observer.observe(sentinel);
+   observer.observe(sentinelNode);
    return () => observer.disconnect();
- }, [active, hasMore, loading]);
+ }, [active, sentinelNode]);
```

```diff
- <div ref={sentinelRef} className="mt-1 flex justify-center py-1">
+ <div ref={setSentinelNode} className="mt-1 flex justify-center py-1">
```

- sentinel DOM 노드를 일반 `useRef`가 아니라 `useState` 기반 콜백 ref로 관리해, sentinel이 실제로 mount/unmount되는 정확한 순간에 effect가 재실행되도록 했다 — `loading`/`localizedPlacesLoading` 등 중간 상태 조합을 추론할 필요가 없어졌다.
- `root: null`(브라우저 viewport)은 그대로 유지했다 — 코드 주석에 "중첩 스크롤 조상이 있어도 root:null은 조상의 스크롤 오프셋이 반영된 실제 렌더 위치를 기준으로 교차를 계산한다"는 판단 근거가 남아 있다. **이 판단은 IntersectionObserver 스펙에 대한 코드 분석 근거이며, 실제 브라우저에서 계측한 결과는 아니다.**
- 같은 콜백 ref 패턴이 `PublicPlacesTab.jsx`에도 동일하게 적용됐다(diff 확인) — Places는 이 정확한 버그(세 번째 early-return)를 갖고 있지 않지만, 두 탭의 observer lifecycle을 동일하게 유지하기 위한 목적으로 함께 적용됐다(코드 주석에 명시).

---

## 12. Routes 추가 로딩 최상단 점프 원인과 최종 수정

### 12.1 증상 (대화상 보고)

Routes에서 다음 5개가 로딩되는 순간 화면이 목록 최상단으로 튀어 오르고, 다시 아래로 스크롤하면 6위 이후 데이터 자체는 정상적으로 존재했다.

### 12.2 초기의 불완전한 원인 추정 (시행착오로 분리)

대화 초반에는 "Routes/Places 탭의 `hidden`(display:none) 전환과, 두 탭이 공유하는 `<main>` 스크롤 컨테이너의 높이 clamp"가 원인으로 추정되었다 — 탭을 전환하면 숨겨지는 쪽이 `display:none`이 되어 공유 스크롤 컨테이너의 스크롤 가능 높이가 급격히 줄고, 이때 브라우저가 `scrollTop`을 강제로 낮은 값으로 clamp한 뒤 되돌리지 않는다는 이론이었다. `root: null` observer가 원인일 가능성도 함께 검토되었다.

**이 두 추정은 모두 최종 직접 원인이 아니었다** — 이후 Routes 탭을 벗어나지 않고(탭 전환 없이) 스크롤만으로 다음 페이지를 로딩해도 점프가 계속 재현되는 것이 확인되어, 탭 전환에 의존하지 않는 별도의 원인이 있음이 드러났다.

### 12.3 최종 확인된 원인 (코드 분석 근거)

- 추가 페이지가 append되면 `rows`가 바뀌고, 이를 바탕으로 계산되는 `allStopIdsKey`(현재 화면의 모든 stop id를 정렬·중복제거해 이어붙인 문자열)도 바뀐다.
- 이 키를 감시하는 현지화 배치 effect가 다시 실행되며, 수정 전 코드는 매번 다음을 호출했다.

```js
setLocalizedPlacesLoading(true);
setLocalizedPlacesById(new Map()); // 기존 1~5위 현지화 데이터까지 통째로 삭제
```

- 그 직후 `if (localizedPlacesLoading && allStopIdsKey) return <전체 spinner>`(수정 전 조건, `size===0` 없음)가 발동해, 카드 5개 이상 높이였던 목록 전체가 `py-16` spinner 하나로 대체됐다.
- 목록 높이가 순간적으로 붕괴하면서 실제 스크롤 컨테이너가 기존 `scrollTop`을 유지할 수 없어 위쪽으로 clamp됐고, 현지화가 다시 끝나 카드가 돌아와도 `scrollTop`은 이미 이동한 뒤였다.

### 12.4 최종 수정 (diff 확인, §11.3과 같은 파일의 다른 부분)

```diff
+ const localizedLocaleRef = useRef(locale);
+ const localizedPlacesByIdRef = useRef(new Map());

  useEffect(() => {
+   const localeChanged = localizedLocaleRef.current !== locale;
+   localizedLocaleRef.current = locale;

    if (!allStopIdsKey) {
+     localizedPlacesByIdRef.current = new Map();
      setLocalizedPlacesById(new Map());
      setLocalizedPlacesLoading(false);
-     return;
+     return undefined;
    }
+
+   if (localeChanged) {
+     localizedPlacesByIdRef.current = new Map();
+     setLocalizedPlacesById(new Map());
+   }
+
+   const missingIds = allStopIdsKey.split(',').map(Number)
+     .filter((id) => !localizedPlacesByIdRef.current.has(id));
+
+   if (missingIds.length === 0) {
+     setLocalizedPlacesLoading(false);
+     return undefined;
+   }

    let cancelled = false;
    setLocalizedPlacesLoading(true);
-   setLocalizedPlacesById(new Map());
-   getPlacesByIds(allStopIdsKey.split(',').map(Number), locale)
+   getPlacesByIds(missingIds, locale)
      .then((places) => {
        if (cancelled) return;
-       setLocalizedPlacesById(new Map(places.map((p) => [p.id, p])));
+       setLocalizedPlacesById((prev) => {
+         const next = new Map(prev);
+         places.forEach((p) => next.set(p.id, p));
+         localizedPlacesByIdRef.current = next;
+         return next;
+       });
      })
-     .catch(() => { if (!cancelled) setLocalizedPlacesById(new Map()); })
+     .catch(() => { /* 기존 캐시 유지, 새 id만 실패로 남김 */ })
      .finally(() => { if (!cancelled) setLocalizedPlacesLoading(false); });
    return () => { cancelled = true; };
  }, [allStopIdsKey, locale]);
```

핵심 변경 요약(모두 diff로 확인):
1. **locale이 실제로 바뀐 경우에만** 현지화 Map을 초기화한다(`localizedLocaleRef`로 이전 locale 추적). `rows`만 늘어난(같은 locale) 경우에는 기존 Map을 유지한다.
2. **`localizedPlacesById`에 아직 없는 stop id만** (`missingIds`) `getPlacesByIds()`로 조회한다 — 이미 조회된 1~5위 id는 재조회하지 않는다.
3. 조회 결과는 기존 Map에 `.set()`으로 **병합**한다(교체가 아님).
4. 실패 시에도 Map을 통째로 비우지 않고 기존 캐시를 그대로 둔다.
5. 전체 spinner early-return 조건에 `&& localizedPlacesById.size === 0`을 추가해, **캐시된 현지화 데이터가 하나도 없는 최초 1회에만** 전체 spinner를 허용하고, 이후 증분 로딩에서는 목록을 절대 숨기지 않는다(§11.2의 코드 인용 참고).
6. 새로 append된 카드는 `mergeSavedStopWithLocalizedPlace(savedStop, localizedPlace)`의 fallback(`courseDisplay.js:769`, `if (!localizedPlace) return savedStop;`)에 의해 현지화가 끝나기 전에도 원본 snapshot 텍스트로 즉시 렌더된다(코드 확인) — 목록 전체를 숨길 필요가 없어졌다.

이 과정에서 카드 `key`(`public_route_key`), observer 관련 `sentinelNode`/`active`/`hasMoreRef`/`userRef`/`fetchingRef`/`handleLoadMoreRef`, `PUBLIC_FEED_PAGE_SIZE`, raw 응답 길이 기반 offset 누적, `total_count`, `dedupeRows`, stale-sort 가드는 모두 변경되지 않았다(diff에 해당 부분 변경 없음).

### 12.5 Places 탭 비교

`PublicPlacesTab.jsx`를 같은 관점으로 조사했다.

- `mergeFeedRows()`는 `handleLoadMore()` 내부에서 **그 페이지의 rows만** 인자로 호출되고, 결과는 `setPlaces((prev) => [...prev, ...])`로 append된다 — Routes처럼 전체를 교체하는 구조가 아니다.
- `loading`/`loadError`/`places.length===0` early-return은 `sort`/`user`/`reloadTick`에 묶인 초기 로딩 effect에서만 값이 바뀌고, 페이지 append(`handleLoadMore`)는 이 세 state를 바꾸지 않는다 — 목록 전체가 숨겨지는 경로가 없다.
- 따라서 Routes와 같은 "전체 목록이 spinner로 교체되는" 위험은 확인되지 않아 **수정하지 않았다**.
- 다만 조사 중 별개의 잠재적 문제를 발견했다: `mergeFeedRows` 내부의 `setStatsById(stats)`가 매 페이지 호출마다 **그 페이지 place id만 담긴 새 Map으로 전체를 교체**한다(코드 확인). 이 때문에 페이지 2를 불러오면 페이지 1의 리뷰 통계(`reviewStats`)가 화면에서 사라질 가능성이 있다 — 다만 이는 "스크롤 점프"가 아니라 리뷰 통계가 조용히 비는 별개의 증상이라 이번 작업 범위 밖으로 판단해 수정하지 않았다. 실기기에서 이 증상이 재현되는지는 확인되지 않았다.

---

## 13. 변경하지 않은 항목과 제외 범위

- Supabase RPC(`get_public_course_feed`, `get_public_place_feed` 등) SQL, 테이블, 정책 — 이번 세션에서 SQL을 실행하지 않았고, 저장소에 SQL 정의 파일도 없다.
- `publicFeedService.js`의 함수 시그니처(`fetchPublicCourseFeed`/`fetchPublicPlaceFeed`의 `{sort, limit, offset}`) — `git diff --name-status`에 이 파일이 없어 수정되지 않았음을 확인.
- Traveler Picks 카드 디자인(`PublicCourseCard.jsx`, `PublicPlaceCard.jsx`의 레이아웃/색상), 정렬 로직(Popular/Latest 자체) — 이미지 관련 className 한 줄(§5.2 표)을 제외하면 변경되지 않았다.
- Community 사용자 업로드 이미지, 리뷰 이미지, 프로필, QR, 로고 — §5.3에서 확인.
- `AppLayout.jsx`, `PageShell.jsx` — 이름을 직접 수정한 흔적이 `git diff --name-status`에 없다. §10.2의 `-mb-2` 보정은 `PageShell`의 `pb-6` 값을 계산에 반영했을 뿐, 파일 자체는 건드리지 않았다.
- `TourAPI`, 제휴·후원·보증 관련 새 문구 — 전수 grep 결과 사용자 화면 문구에는 등장하지 않는다(§4.3).

---

## 14. 실기기·화면 검증 결과

이 절은 사용자가 명시적으로 "고쳐졌다" 또는 실제 화면으로 확인했다고 전달한 항목만 실기기 검증 완료로 기록한다. 그 외는 코드 분석 근거로만 판단했음을 명시한다.

- Routes 최초 진입 무한 스크롤 동작, Routes 다음 페이지 로딩 시 최상단 점프 해소, Places 무한 스크롤 동작, 5개 단위 추가 표시 — **사용자가 이번 대화에서 문제 재현·수정 요청을 이어가며 확인한 내용에 기반하되, 마지막 수정(§12.4) 이후의 재현 결과가 이 대화 내에서 별도로 보고되지는 않았다.** 즉 §11의 수정(최초 미동작)과 §12의 첫 번째 수정 시도까지는 사용자가 문제를 재현·보고했지만, §12.4의 최종 수정 이후 실기기 재확인 결과는 이 문서 작성 시점 기준 확인되지 않았다.
- 가게 상세 이미지·placeholder UI, 동선 상세 이미지·placeholder UI, 가게 상세 출처 링크 위치, Places 출처 링크 여백 — 이전 대화에서 사용자가 여백 비대칭(§10.1) 등 구체적인 시각적 문제를 지적해 추가 수정으로 이어진 바 있으나, 최종 수정 이후 다시 "확인됐다"는 명시적 보고는 이 문서 작성 시점 기준 확인되지 않았다.

**따라서 이 문서는 §11·§12.4·§6·§7·§10의 코드 변경이 실제 브라우저에서 의도대로 동작함을 완료로 단정하지 않는다.** 실제 브라우저·실기기에서의 최종 확인은 후속 과제로 남는다(§18).

---

## 15. 변경 파일 종합

`git diff --name-status`와 untracked 목록을 기준으로 실제 확인된 파일만 정리한다.

| 파일 | 신규/수정 | 담당 기능 | 관련 절 |
|---|---|---|---|
| `src/pages/DataSourcesPage.jsx` | 신규(untracked) | 공공데이터 출처 공개 페이지 | §4 |
| `src/shared/constants/publicDataSources.js` | 신규(untracked) | 세 데이터 공식명·URL·메타데이터 단일 소스 | §4.3 |
| `src/shared/components/PublicDataAttribution.jsx` | 신규(untracked) | 공용 이미지 출처 링크 | §8 |
| `src/app/router.jsx` | 수정 | `/data-sources` 라우트 등록 | §4.1 |
| `src/shared/constants/routes.js` | 수정 | `ROUTES.dataSources` 상수 추가 | §4.1 |
| `src/features/auth/components/LoginForm.jsx` | 수정 | 로그인 화면 출처 링크 | §4.2 |
| `src/pages/MyPage.jsx` | 수정 | 마이페이지 Settings 출처 링크 | §4.2 |
| `src/shared/i18n/dictionary.js` | 수정 | `dataSources.*` en/ko/zh-CN 20키 추가 | §4.4, §4.5, §5.1 |
| `src/shared/components/Thumbnail.jsx` | 수정 | 실제 이미지 object-contain·직각화, placeholder 직각 옵션 | §5.2 |
| `src/features/explore/components/PlaceDetailSheet.jsx` | 수정 | 가게 상세 대표 이미지 full-width·직각·배경·출처 링크 위치·정렬, 푸드 타입 여백 | §6 |
| `src/features/explore/components/TodayCourseDetail.jsx` | 수정 | Map 동선 상세 stop 이미지·출처 링크 | §7 |
| `src/pages/PublicCourseDetailPage.jsx` | 수정 | Picks 공개 동선 상세 stop 이미지·출처 링크 | §7 |
| `src/pages/SavedCourseDetailPage.jsx` | 수정 | 저장 동선 상세 stop 이미지·출처 링크 | §7 |
| `src/features/courses/components/PublicPlaceCard.jsx` | 수정 | Picks Places 카드 이미지 | §5.2 |
| `src/features/places/components/SavedPlaceCard.jsx` | 수정 | 저장한 가게 카드 이미지 | §5.2 |
| `src/features/courses/components/SavedPlacesTab.jsx` | 수정 | 저장한 가게 목록 하단 출처 링크 | §8 |
| `src/features/courses/constants/publicFeed.js` | 수정 | `PUBLIC_FEED_PAGE_SIZE=5` 신규, 기존 `MAX_PUBLIC_FEED_ITEMS` 문서화 갱신 | §9.2 |
| `src/features/courses/components/PublicRoutesTab.jsx` | 수정 | 5개 단위 무한 스크롤, sentinel 콜백 ref, 현지화 캐시 병합, 최초 미동작·점프 수정 | §9~§12 |
| `src/features/courses/components/PublicPlacesTab.jsx` | 수정 | 5개 단위 무한 스크롤, sentinel 콜백 ref, 출처 링크 footer 여백 | §9~§10 |
| `src/pages/ExplorePage.jsx` | 수정 | Routes/Places에 `active` prop 전달 | §9.4 |
| `docs/63-mobile-search-input-focus-horizontal-shift-fix.md` | untracked(기존 문서, 이번 작업 대상 아님) | 기준 문서 | §2 |

총 20개 코드/설정 파일(신규 3 + 수정 17) + 문서 파일 1개(기존, 미수정)가 현재 working tree에 존재한다.

### 참고 파일 (이번 diff에서 변경되지 않음)

| 파일 | 이번 작업과의 관계 |
|---|---|
| `src/features/courses/services/publicFeedService.js` | RPC 호출부(`fetchPublicCourseFeed`/`fetchPublicPlaceFeed`) — 시그니처·구현 변경 없음(§9.1, §13) |
| `src/shared/components/PageShell.jsx` | `pb-6` 값이 §10.2의 `-mb-2` 계산 근거로 쓰였으나 파일 자체는 미수정 |
| `src/shared/components/AppLayout.jsx` | 실제 스크롤 컨테이너(`<main overflow-y-auto>`) — observer root 판단 근거(§11.3)로만 참조, 미수정 |
| `src/features/courses/utils/courseDisplay.js` | `mergeSavedStopWithLocalizedPlace()` fallback 동작을 확인하는 데 참조(§12.4) — 미수정 |
| `src/features/community/components/PostCard.jsx`, `PostComposer.jsx`, `src/features/places/components/ReviewCard.jsx`, `ReviewComposer.jsx`, `src/features/profile/components/LikedPostsView.jsx`, `MyPostsView.jsx` | Community/리뷰 이미지 — 제외 대상 확인용(§5.3), 미수정 |

---

## 16. 빌드·검사

이 문서 작성 시점, 현재 working tree 전체를 기준으로 다시 실행한 결과다.

- `npm run build`: 성공(228 modules transformed, 5초대). 산출물: `dist/assets/index-*.css`(40.50 kB), `dist/assets/index-*.js`(803.16 kB).
  - CSS 압축 경고 1건 발생: `Expected identifier but found "-"` (`-: T.Z;`, `<stdin>:2332:2`). 이 경고는 이번 세션의 이전 여러 라운드에서도 동일하게 관찰된 것으로, 이번 문서가 다루는 변경들과 무관한 기존 경고로 판단한다(매 라운드 빌드 로그에서 위치·문구가 사실상 동일하게 반복 발생).
- `git diff --check`: 통과(exit 0). 출력은 각 수정 파일의 "LF will be replaced by CRLF" 경고뿐이며, 공백/충돌 마커 오류는 없다.
- 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 전수 검색: `src/**/*.{js,jsx}` 대상으로 없음을 확인.
- 이번 문서 작성 과정에서 `docs/64` 파일 1개(이 문서 자체) 외의 코드 파일은 수정하지 않았다 — `Write`/`Edit` 도구 호출 이력상 이 문서 파일에만 쓰기가 발생했다.

---

## 17. 현재 상태 및 후속

- 브랜치: `main`, `HEAD`: `9158147c2181f16887590c96fb495f128bfa4087`(기준 커밋과 동일, 변경 없음).
- 이번 문서가 다루는 모든 코드 변경(§15의 신규 3 + 수정 17)은 **아직 커밋되지 않은 working tree 상태**다.
- 이 신규 문서(`docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md`) 역시 **미커밋(untracked) 상태**다.
- 기준 문서 `docs/63-mobile-search-input-focus-horizontal-shift-fix.md`도 `git status --short` 확인 결과 여전히 `??`(untracked) 상태다 — 아직 한 번도 커밋되지 않았다.
- 이번 세션에서 `git add`/`git commit`/`git push`는 전혀 수행하지 않았다.
- 다음 단계는 사용자가 실제 화면(특히 §14에서 최종 미확인으로 남긴 항목들)을 확인한 뒤, 코드와 이 작업일지를 함께 commit·push하는 것이다. 커밋 메시지는 제안만 하며 이번 세션에서 실행하지 않는다.
  - 제안(실행 안 함): `fix: 공공데이터 이미지 출처 대응 및 Traveler Picks 무한 스크롤 개선`

---

## 18. 승인된 한계와 후속 과제

- §14에서 밝힌 대로, 이 문서가 다루는 최종 수정 이후의 실제 브라우저 재현 확인은 이 문서 작성 시점 기준 완료로 단정할 수 없다.
- §9.1의 RPC 정렬 기준·`STABLE SECURITY DEFINER`·`safe_limit` 값은 사용자가 Supabase에서 직접 확인해 전달한 정보이며, 이 세션에서 SQL로 재검증하지 않았다.
- §7에서 언급한 원본 이미지 940×705 검증은 이전 세션의 결과로 다뤄졌을 뿐, 이 문서 작성 시점에 재계측하지 않았다 — `aspect-[4/3]` + `object-contain` 구조가 실제 브라우저 렌더링에서 크롭 없이 정확히 축소되는지는 코드 구조 근거일 뿐 픽셀 계측 근거가 아니다.
- §12.5에서 발견한 `PublicPlacesTab.jsx`의 `statsById` 전체 교체(페이지 append 시 이전 페이지 리뷰 통계가 사라질 가능성)는 이번 작업 범위 밖으로 판단해 수정하지 않았다 — 후속 과제로 남긴다.
- `publicFeed.loadMore`(더 이상 UI에 쓰이지 않는 "더 보기" 버튼 라벨) dictionary 키는 삭제하지 않고 남아 있다 — 필요 시 정리 대상.

---

## 19. 추가 작업 — Map 추천 동선 바텀시트 안내 문구

`docs/64` 최초 작성 이후, 같은 미커밋 작업 범위 안에서 이어서 진행한 추가 작업이다. 위 §1~§18은 이 절 추가로 인해 전혀 수정되지 않았다.

### 19.1 배경과 요구사항

- **대화상 요구사항**: Map 탭의 추천 동선 바텀시트에 처음 진입한 사용자가 "현재 기준 위치 주변의 맛집 동선을 추천하는 화면"임을 바로 이해할 수 있도록, 제목(`Eat near {location}` 등) 바로 아래·`TODAY'S PICKS` 라벨 바로 위에 다국어 안내 문구를 추가할 것.
- **대화상 요구사항**: 문구는 "기준 위치에서 출발한다"가 아니라 "기준 위치 주변을 추천한다"는 의미만 담아야 하며, 기존 dictionary에 이미 있는 "기준 위치" 관련 키(`courseDetail.anchorLocationLabel`, EN "Starting point"/zh-CN "起点")는 출발점 의미라 이번 문구에는 재사용하지 않기로 했다(코드 조사로 확인된 판단 근거).

### 19.2 실제 바텀시트 컴포넌트와 렌더 위치

- 컴포넌트: `src/features/explore/components/NearbySheet.jsx`.
- 삽입 위치: `t('nearby.header', ...)`를 렌더하는 `<h2>` 바로 다음, 같은 부모 `<div className="shrink-0 cursor-grab touch-none px-5 pb-3.5 pt-1.5">` 안(코드 확인).
- 이 `<div>`는 `{courses && courses.length > 0 ? (...) : isLoading ? (...) : (...)}` 3분기(목록/로딩/빈 결과) **바깥**에 위치한 고정 헤더라서, 기준 위치명·추천 결과 유무·로딩 상태와 무관하게 항상 같은 자리에 정확히 한 번만 렌더된다(코드 확인) — 이 컴포넌트에 별도 오류 상태 분기는 없다.
- `selectedCourse`가 있을 때(동선 상세)와 `selectedPlace`가 있을 때(가게 상세)는 이 `<div>` 자체가 렌더되는 분기 밖이므로, 동선 상세·가게 상세·Traveler Picks 화면에는 영향이 없다(코드 확인, 해당 화면들의 파일은 이번 작업에서 수정되지 않았다).

### 19.3 dictionary 키와 최종 문구

`src/shared/i18n/dictionary.js`의 `nearby` 네임스페이스에 `header` 바로 다음 순서로 `recommendationLocationHint` 키를 en/ko/zh-CN 세 블록 모두에 추가했다(코드 확인).

| locale | 값 |
|---|---|
| en | `We recommend food routes near your selected location.` |
| ko | `기준 위치 주변의 맛집 동선을 추천해요.` |
| zh-CN | `为您推荐所选位置周边的美食路线。` |

세 문구 모두 "start"/"departure"/"출발"/"시작"/"起点"/"出发" 등 출발점·시작점을 뜻하는 단어가 없음을 직접 확인했다.

### 19.4 최종 JSX와 스타일 (사용자 조정 반영)

```jsx
<div className="shrink-0 cursor-grab touch-none px-5 pb-3.5 pt-1.5">
  <h2 className="select-none font-display text-[1.375rem] font-bold tracking-tight text-ink">
    {t('nearby.header', { location: locationLabel })}
  </h2>
  <p className="text-xs text-ink-faint">
    {t('nearby.recommendationLocationHint')}
  </p>
</div>
```

- `text-xs`, `text-ink-faint` — 제목보다 작고 연한 보조 설명 톤. 새 아이콘·배경·border·badge는 추가하지 않았다.
- **최초 구현 시에는 `<p>`에 `mt-1`(제목과의 간격)을 추가했으나, 사용자가 실제 화면에서 확인한 뒤 직접 제거했다** — 현재 `git diff` 기준 `<p>`의 className은 `text-xs text-ink-faint`뿐이며 `mt-1`은 없다(코드 확인). 이 제거는 화면 확인을 거친 의도적 조정이므로, 이번 절 추가 작업에서 다시 넣지 않았다.
- `TODAY'S PICKS`와의 기존 간격(제목 컨테이너의 `pb-3.5` + 스크롤 영역의 `pt-1` = 18px, §19.2 인접 코드의 기존 주석 근거)은 이 문구 추가/조정과 무관하게 그대로다 — 두 padding 모두 내용물의 높이와 무관한 고정값이기 때문이다.
- 문구 자체에 `{location}` 같은 변수 삽입이 없어 위치명 길이에 따른 폭 변화가 없고, 고정 문장이 `px-5` 안에서 일반 블록 텍스트로 자연스럽게 줄바꿈되므로 두 줄이 되어도 가로 overflow가 생기지 않는 구조다(코드 구조 근거 — 실제 브라우저에서 두 줄 줄바꿈을 픽셀 단위로 계측하지는 않았다).

### 19.5 NearbySheet.jsx의 그 외 diff (이번 절과 무관한 변경)

`git diff -- src/features/explore/components/NearbySheet.jsx`를 전체 확인한 결과, §19.2~19.4의 변경 외에 다음과 같은 정리성 변경이 같은 파일에 함께 있다 — 이번 작업에서 직접 작성한 것이 아니라 편집기의 import 자동 정렬/포맷터에 의한 것으로 보이는 코드 스타일 변경이며, 동작에 영향을 주는 로직 변경은 아니다(코드 확인).
- 파일 상단 `import` 순서가 알파벳 순으로 재정렬됨.
- `.catch(() => {});` → `.catch(() => { });`(공백 추가).
- GPS 버튼 색상 삼항 연산자의 들여쓰기 변경.

이 변경들은 사용자 지시에 따라 되돌리거나 추가로 손대지 않았다.

### 19.6 검증

- `npm run build`: 성공(228 modules). 기존과 동일한 CSS 압축 경고 1건 외 오류 없음.
- `git diff --check`: 통과.
- `nearby.recommendationLocationHint` 키가 en/ko/zh-CN 세 블록에 정확히 1회씩, `NearbySheet.jsx`에서 1회만 호출됨을 grep으로 확인.
- 실제 브라우저·실기기에서의 최종 육안 확인(두 줄 줄바꿈 시 overflow 여부, 실제 여백 느낌 등)은 사용자가 화면에서 `mt-1` 제거를 결정한 것으로 미루어 최소한 그 부분은 실기기 확인을 거친 것으로 보이나, 이 문서 작성 시점에 그 확인 내용을 코드로 재검증하지는 못했다.
