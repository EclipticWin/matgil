<a id="english"></a>

[English](#english) | [한국어](#한국어)

# Matgil 맛길 — Multilingual Seoul Food Route Guide

Live Demo: [https://EclipticWin.github.io/matgil/](https://EclipticWin.github.io/matgil/)

## Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [User Flows](#user-flows)
- [Route Recommendation Logic](#route-recommendation-logic)
- [AI Features](#ai-features)
- [Multilingual and Public Data](#multilingual-and-public-data)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [Build and Deployment](#build-and-deployment)
- [Main Routes](#main-routes)
- [Documentation](#documentation)

## Project Overview

Matgil is a mobile-first web application for international travelers exploring restaurants in Seoul. A traveler can choose the current location, a Seoul hot-place preset, or a searched area, place, or restaurant as a reference location; apply food-type and minimum-rating preferences; and receive walking food routes containing up to three nearby stops.

The reference location defines the center of the recommendation area. It is not necessarily the first restaurant or a physical starting point. Matgil also combines restaurant details, reviews, saving and sharing, practical Korean phrases, AI-assisted voice help, public traveler picks, and a restaurant-linked photo community in one interface.

The interface and internal restaurant text support Korean, English, and Simplified Chinese.

## Key Features

- **Map-based route discovery:** use browser geolocation, Seoul hot-place presets, map position, or Kakao search for an area, landmark, or restaurant.
- **Preference filters:** select up to three food types and a minimum user-review rating.
- **Code-based food routes:** view recommended walking routes containing up to three restaurant stops, numbered map markers, stop order, route details, restaurant details, and revised recommendations after changing conditions.
- **Restaurant details:** view localized names and addresses, descriptions, representative and available menus, hours, closing days, parking, takeout, food categories, map position, average rating, review count, and public save count when data is available.
- **Reviews and saves:** save or unsave restaurants and routes; write, edit, or delete a rating and review; attach review photos; share a restaurant through the Web Share API or a copied link.
- **Traveler Picks:** browse public routes and restaurants by popularity or recency, open details, save or unsave an item, and open a route on the map.
- **Practical phrases:** browse common and popular Korean expressions by situation, play Korean text-to-speech, save expressions, and revisit them from My Page.
- **Voice Help:** recognize speech in the browser, explain its meaning, suggest a context-appropriate reply, and provide Korean pronunciation and TTS when applicable.
- **Community:** browse posts by category, create posts with up to three photos, optionally connect a restaurant, comment, like, and edit or delete your own posts.
- **Personal activity:** manage a nickname and language, saved routes, saved restaurants, saved phrases, personal posts, liked posts, activity counts, sign-out, password changes, and account management.

The fixed bottom navigation contains **Map**, **Picks**, **Phrases**, **Community**, and **My Page**.

## User Flows

### Route recommendation

1. Choose a reference location.
2. Search for an area, place, or restaurant when needed.
3. Select up to three food types and a minimum rating.
4. Generate a food route with the client-side recommendation logic.
5. Review up to three stops and their visit order on the map.
6. Open route or restaurant details.
7. Save the route or restaurant, share a restaurant, or write a review where available.
8. Change the conditions and request another recommendation when needed.

If fewer than three matching restaurants are available, the route may contain fewer stops.

### Voice Help

1. Select the spoken language where the current UI offers a choice.
2. Speak through the browser microphone.
3. The browser Speech Recognition API converts speech to text.
4. The `mg-voice-help` Supabase Edge Function receives the transcript, UI language, and spoken-language code.
5. The function determines the reply-language direction and calls Solar first.
6. OpenAI may be called if the Solar request is unavailable, fails, times out, or returns an invalid response.
7. The interface displays the original utterance, its meaning, a suggested reply, and the meaning of that reply.
8. Korean pronunciation and Korean TTS are available when the suggested reply is Korean.

English or Simplified Chinese speech can produce a Korean reply. Korean speech produces a meaning and reply in the current UI language. The server fixes the original transcript and language labels rather than allowing the LLM to rewrite them.

### Traveler Picks

1. Choose the public routes or restaurants tab.
2. Choose popular or latest ordering.
3. Browse public items and open a public route or restaurant detail.
4. Save or unsave an item, or view a route on the map.
5. Return from a detail page to the previous tab and sort state.

Guests can read the first five items in each feed. If more items exist, the app renders a fixed skeleton sign-in teaser: it receives no next-ranked route or restaurant and exposes no real title, image, address, rating, or save count. Its button goes directly to the login screen, then returns to the same Picks tab and sort. Signed-in users continue through five-item infinite scrolling within the configured client feed limit.

### Community

1. Browse posts by category or popularity and open their comments.
2. Sign in to like, comment, or write.
3. Attach photos and optionally search for and connect a restaurant.
4. View the connected restaurant using its localized name and address, then open its detail page.
5. Edit or soft-delete your own posts.

## Route Recommendation Logic

Food routes are created by deterministic client code in `src/features/explore/data/courseBuilder.js`, not by generative AI or an LLM.

The implementation:

- loads active internal restaurants and their localized text through Supabase;
- merges user-review statistics used by the minimum-rating filter;
- filters by the selected food types and minimum rating;
- sorts candidates by distance from the reference location;
- considers nearby candidates first and progressively expands the search range when results are insufficient;
- prioritizes a restaurant explicitly selected from search in the first route when it matches the active filters;
- evaluates stop combinations using inter-stop walking proximity, category diversity, a cafe-inclusion bonus, restaurant-data completeness, first-stop access from the reference location, and a penalty for weak uncategorized data;
- prefers route combinations with shorter inter-stop walking distances;
- uses internal `place_id` values to keep route stops connected to localized restaurant records.

Distance calculations, filtering, route ordering, map display, public-feed sorting, pagination, counts, authentication, and database authorization do not use AI.

## AI Features

Matgil uses AI in two bounded areas:

- **Voice Help:** the `mg-voice-help` Edge Function uses Solar, a Korean LLM, as the primary provider for utterance meaning and suggested replies. OpenAI is used only when it is configured and the Solar request fails or returns an invalid response eligible for fallback.
- **Multilingual data enrichment:** `mg-place-translate-en` and `mg-place-translate-zh` enrich missing English and Simplified Chinese restaurant text from Korean source records. The English enrichment path can use Solar and OpenAI; the Chinese enrichment path uses Solar. Accepted generated rows are marked separately from source translations.

The translation functions validate response shape and source preservation before saving. Checks cover null handling, type and menu-item counts, address numbers, business-hour and closing-day time/day tokens, and preservation of the Korean source name. Failed validation is retried only through the implemented correction/fallback paths and is not saved as an accepted translation.

AI does not generate routes, calculate distances, filter restaurants, draw maps, sort Traveler Picks, implement infinite scrolling, aggregate saves or reviews, authenticate users, collect public data, or enforce database access.

## Multilingual and Public Data

### Languages and localized records

Supported UI languages are:

- Korean
- English
- Simplified Chinese

Restaurant text rows for different languages are connected to the same internal `place_id`. Official multilingual source records are preferred. Machine-enriched records use a separate translation status and are inserted without overwriting an existing official or previously accepted language row. Saved routes and Traveler Picks preserve snapshots for continuity but batch-load current-language restaurant records for display, so they are not permanently fixed to the language used at save time.

Korean-to-English or Korean-to-Chinese machine enrichment is not an official translation supplied or reviewed by the Korea Tourism Organization.

### Public restaurant data

The restaurant dataset uses Korean, English, and Simplified Chinese tourism information from the Public Data Portal:

- `한국관광공사_국문 관광정보 서비스_GW`
- `한국관광공사_영문 관광정보서비스_GW`
- `한국관광공사_중문 간체 관광정보서비스_GW`

The ingestion Edge Functions normalize restaurant records, retain source-response data used by the pipeline, connect multilingual entries to internal place identifiers, and store them in Supabase. The public `/data-sources` screen is available without login and links to the official source listings. Use of public data does not imply sponsorship, endorsement, or partnership with the data provider.

### Image policy

Some restaurant records use original image URLs supplied with the public data. Those sources may include images under Korea Open Government License Type 1 or Type 3 terms. Because Type 3 prohibits modification, Matgil uses a conservative display policy for public-data images: no cropping, filters, or overlaid text; the complete image is shown with `object-contain`; and a failed or missing image is rendered as a separate placeholder.

Source and usage-condition links are available from restaurant and route views through the public data-sources screen. User-uploaded review and community images are stored and rendered separately through Supabase Storage.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | React 18, Vite 5, JavaScript, Tailwind CSS 3, React Router 6 |
| Maps and search | Kakao Maps JavaScript SDK, Kakao Places API |
| Backend and data | Supabase PostgreSQL, RPC, Row Level Security, Storage, Edge Functions |
| Authentication | Supabase Auth, email/password, Google OAuth 2.0, Facebook OAuth 2.0 |
| AI | Solar LLM, OpenAI API |
| Public data | Public Data Portal and the three Korea Tourism Organization tourism-information services listed above |
| Deployment | GitHub Pages, GitHub Actions |

The development workflow documented in this repository uses VS Code, Claude Code, ChatGPT, and Codex. These are development tools, not runtime dependencies.

## System Architecture

- **React/Vite client:** renders the mobile UI and runs the route recommendation logic.
- **Kakao Maps JavaScript SDK and Places API:** display the map, geocode map positions, and search general areas, landmarks, and restaurants.
- **Supabase Auth:** manages email and social authentication plus browser sessions.
- **Supabase PostgreSQL and RPC:** store restaurants, language records, phrases, saved data, reviews, community content, and the public Traveler Picks feed and counts.
- **Row Level Security:** controls access to user-owned save and authoring records. Public feeds and aggregate counts use RPCs, with supporting SQL and verification records available in `docs`.
- **Supabase Storage:** stores review photos and community post images in separate buckets.
- **Supabase Edge Functions:** perform public-data ingestion, multilingual enrichment, Voice Help processing, and account deletion that requires server-side privileges.
- **Solar and OpenAI:** support Voice Help and multilingual enrichment only.
- **Korea Tourism Organization public data:** supplies base restaurant information and available official multilingual records before normalization into Supabase.

There is no separate traditional application server in the repository.

## Project Structure

```text
.
├─ .github/workflows/       GitHub Pages build and deployment workflow
├─ docs/                    Implementation logs, data design, diagnostics, fixes, and verification notes
├─ public/                  Static assets and GitHub Pages SPA 404 fallback
├─ src/
│  ├─ api/                  Restaurant, category, locale-notice, and detail-section queries
│  ├─ app/                  Providers, router, and application shell
│  ├─ features/
│  │  ├─ auth/              Supabase authentication and login-required flows
│  │  ├─ community/         Posts, comments, likes, images, and linked restaurants
│  │  ├─ courses/           Saved routes, public feeds, route cards, and route localization
│  │  ├─ explore/           Map, search, filters, details, and route recommendation logic
│  │  ├─ phrases/           Phrase browsing, bookmarks, speech recognition, TTS, and Voice Help
│  │  ├─ places/            Restaurant bookmarks, reviews, review images, and detail UI
│  │  ├─ profile/           Profile editing, personal posts, liked posts, and account management
│  │  └─ navigation/        Five-item bottom navigation
│  ├─ pages/                Route-level screens
│  ├─ shared/               Reusable UI, routes, i18n, hooks, and utilities
│  ├─ index.css             Tailwind layers and application styling
│  └─ main.jsx              React entry point
└─ supabase/functions/      Deno Edge Functions for AI, ingestion, enrichment, and account deletion
```

## Getting Started

No Node version is declared in `package.json` or a version file. The deployment workflow currently builds with Node 20.

```bash
npm install
npm run dev
```

Vite uses `/` during development, so open the local URL printed by Vite without a `/matgil/` prefix.

Available scripts:

```bash
npm run dev
npm run build
npm run preview
```

The repository does not define `lint` or `test` scripts.

## Environment Variables

There is no committed `.env.example`. Create a local `.env` without committing real credentials.

### Browser build

| Variable | Required | Purpose |
|---|---:|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL used by the browser client |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous client key; data access remains subject to Supabase policies |
| `VITE_KAKAO_MAP_JS_KEY` | Yes for maps/search | Kakao Maps JavaScript SDK key |

Only the anonymous key belongs in browser configuration. Never expose AI keys or the Supabase service-role key through a `VITE_` variable.

### Supabase Edge Function secrets

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes for functions that access Supabase | Server-side Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for privileged ingestion, enrichment, and account deletion | Privileged server credential; never expose to the browser |
| `SOLAR_API_KEY` | Required for Solar-backed functions | Primary Voice Help provider and translation/enrichment provider |
| `OPENAI_API_KEY` | Optional fallback; required to enable fallback | Voice Help fallback and English enrichment provider path |
| `TOUR_KOR_API_SERVICE_KEY` | Yes for `mg-tour-seed` | Korean public tourism API service key |
| `TOUR_ENG_API_SERVICE_KEY` | Yes for `mg-tour-en-enrich` | English public tourism API service key |
| `TOUR_CHS_API_SERVICE_KEY` | Yes for `mg-tour-api-chs-enrich` | Simplified Chinese public tourism API service key |
| `ADMIN_SEED_TOKEN` | Yes for protected ingestion/enrichment calls | Shared request token checked by administrative batch functions |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are normally provided as Supabase project secrets. For Voice Help, Solar is attempted first; OpenAI is used only when configured and an eligible Solar failure occurs.

## Build and Deployment

```bash
npm run build
npm run preview
```

`vite.config.js` uses `/` for development and `/matgil/` for production builds. Static assets that need the deployment prefix use Vite's `BASE_URL`.

`.github/workflows/deploy.yml` runs on pushes to `main` or manual dispatch, installs dependencies with `npm ci`, builds with Node 20, uploads `dist`, and deploys it with the official GitHub Pages actions. The deployed site URL recorded in the repository metadata is `https://EclipticWin.github.io/matgil/`.

The app uses `BrowserRouter` with a production basename derived from `/matgil/`. `public/404.html` redirects direct deep links and refreshes into an encoded query, and a synchronous script in `index.html` restores the original path before React Router starts. This provides SPA refresh handling on GitHub Pages without a server rewrite.

## Main Routes

Route authentication below describes page access. Public pages can still contain actions that prompt for login.

| Route | Purpose | Authentication |
|---|---|---|
| `/` | Map, reference location, filters, recommendations, and route details | Public; saving/review actions require login |
| `/explore` | Traveler Picks public routes and restaurants | First five public; login for further pages and saving |
| `/explore/routes/:publicRouteKey` | Public route detail and map handoff | Public; saving requires login |
| `/phrases` | Common phrases, popular phrases, TTS, and Voice Help | Public; saving a phrase requires login |
| `/community` | Community posts, comments, likes, photos, and linked restaurants | Public reading; writing, liking, and commenting require login |
| `/my` | Profile, personal activity, settings, and account management | Login required |
| `/login` | Email, Google, and Facebook login | Public |
| `/signup` | Email sign-up and nickname setup | Public |
| `/places/:placeId` | Full restaurant detail | Public; saving and review writing require login |
| `/places/:placeId/reviews` | Restaurant review list and editor | Public reading; writing/editing requires login |
| `/saved-courses/:id` | A saved route detail | Owner login required |
| `/my/saved-routes` | Current user's saved routes | Login required |
| `/my/saved-places` | Current user's saved restaurants | Login required |
| `/my/saved-phrases` | Current user's saved expressions | Login required |
| `/data-sources` | Public-data and image-source disclosure | Public |

`/courses` remains only as a compatibility redirect to `/explore`; it is not a bottom-navigation destination.

## Authentication and Data Access

Supabase Auth provides email/password, Google, and Facebook sign-in. Login-required actions normally open one shared explanation modal and carry a safe internal return path to the login screen. The Traveler Picks skeleton teaser goes directly to login because the teaser already explains the requirement. Email login restores the carried React Router state; OAuth stores the safe return path in `sessionStorage` across the external redirect.

When the original location is an ephemeral map overlay, the app returns to a stable map route and reconstructs relevant map/place state where supported. Protected actions such as save, like, comment, or write are not automatically replayed after login; the user performs the action again.

User-owned data is queried and mutated with the current Supabase session and is designed to operate with Row Level Security. Public feed RPCs return representative public route/restaurant information, aggregate save counts, total counts, and the caller's saved state instead of exposing full private bookmark lists or user lists. Restaurant detail and route-stop cards use the same `get_place_bookmark_count` public RPC for a consistent save total.

Saved routes preserve ordered stops, structured place IDs and metrics, an anchor/reference snapshot, preference keys, and a route snapshot. An order-independent signature prevents an active duplicate save for the same user and set of restaurants. Current-language restaurant rows are merged back into saved and public snapshots for display.

## Supported Scope and Limitations

- Restaurant discovery and public-data ingestion are focused on Seoul.
- The mobile-first layout is centered in a `22.5rem` (360 px) application frame on larger screens, with a fixed bottom navigation and map/bottom-sheet interactions.
- Korean, English, and Simplified Chinese are supported. Japanese is not currently a supported UI language.
- Official multilingual coverage varies by source. Machine-enriched text is separate from official Korea Tourism Organization translations and should be treated accordingly.
- Hours, closing days, menus, parking, and other visit details can change; confirm important information with the restaurant.
- Browser Speech Recognition and Speech Synthesis availability and quality vary by browser and device.
- General Kakao search results may not match an internal restaurant record and therefore may keep a Korean Kakao place name or lack the internal multilingual detail set.
- Locale fallbacks are used when a requested translation is missing; some English address displays may use a district-level fallback.

## Documentation

- [`docs/`](docs/) — numbered implementation logs covering feature work, data design, root-cause analysis, regression fixes, verification results, remaining limitations, and follow-up work.
- [`docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`](docs/31-MATGIL-FINAL-PROJECT-AUDIT.md) — project audit at that development milestone.
- [`docs/40-voice-help-solar-primary-openai-fallback-implementation-log.md`](docs/40-voice-help-solar-primary-openai-fallback-implementation-log.md) — Solar-first Voice Help and OpenAI fallback implementation.
- [`docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md`](docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md) — Traveler Picks feed and saved-page implementation.
- [`docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md`](docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md) — public-data attribution, image handling, and feed pagination.
- [`docs/65-place-bookmark-count-fix-and-traveler-picks-guest-teaser-ux.md`](docs/65-place-bookmark-count-fix-and-traveler-picks-guest-teaser-ux.md) — unified restaurant save counts and the guest teaser behavior.

## License

No repository-level software license has been specified. Public-data records, public-data images, and user-uploaded content remain subject to their respective source and usage terms.

---

<a id="한국어"></a>

[English](#english) | [한국어](#한국어)

# 맛길(Matgil) — 외국인 여행자를 위한 서울 다국어 맛집 동선 안내 서비스

배포 서비스: [https://EclipticWin.github.io/matgil/](https://EclipticWin.github.io/matgil/)

## 목차

- [프로젝트 소개](#프로젝트-소개)
- [주요 기능](#주요-기능)
- [주요 사용자 흐름](#주요-사용자-흐름)
- [동선 추천 방식](#동선-추천-방식)
- [AI 활용 기능](#ai-활용-기능)
- [다국어·공공데이터](#다국어공공데이터)
- [기술 스택](#기술-스택)
- [시스템 구조](#시스템-구조)
- [로컬 실행](#로컬-실행)
- [빌드·배포](#빌드배포)
- [주요 라우트](#주요-라우트)
- [관련 문서](#관련-문서)

## 프로젝트 소개

맛길은 서울의 음식점을 탐색하는 외국인 여행자를 위한 모바일 중심 웹 애플리케이션입니다. 현재 위치, 서울 핫플레이스 프리셋, 검색한 지역·장소·음식점을 기준 위치로 선택하고 음식 종류와 최소 평점 조건을 적용해 주변 음식점을 최대 3곳으로 구성한 도보 맛집 동선을 추천받을 수 있습니다.

기준 위치는 추천 범위를 정하는 중심점이며, 반드시 첫 번째 방문 음식점이나 물리적인 출발점이 되는 것은 아닙니다. 음식점 상세, 리뷰, 저장과 공유, 실전 한국어 표현, AI 음성 도움, 공개 Traveler Picks, 음식점과 사진을 연결하는 커뮤니티도 하나의 화면 체계에서 제공합니다.

UI와 내부 음식점 텍스트는 한국어, 영어, 중국어 간체를 지원합니다.

## 주요 기능

- **지도 기반 동선 탐색:** 브라우저 현재 위치, 서울 핫플레이스 프리셋, 지도 위치 또는 Kakao 검색을 이용해 지역·명소·음식점을 기준 위치로 설정합니다.
- **조건 필터:** 음식 종류를 최대 3개까지 선택하고 사용자 리뷰의 최소 평점을 지정합니다.
- **코드 기반 맛집 동선:** 최대 3곳의 음식점, 번호가 표시된 지도 마커, 방문 순서, 동선 상세, 음식점 상세를 확인하고 조건을 바꿔 다시 추천받습니다.
- **음식점 상세:** 데이터가 존재하는 경우 다국어 이름과 주소, 설명, 대표 메뉴와 취급 메뉴, 영업시간, 휴무일, 주차, 포장, 음식 카테고리, 지도 위치, 평균 평점, 리뷰 수, 공개 저장 수를 표시합니다.
- **리뷰와 저장:** 음식점과 동선을 저장하거나 해제하고, 별점과 리뷰를 작성·수정·삭제하며, 리뷰 사진을 첨부하고, Web Share API 또는 링크 복사로 음식점을 공유합니다.
- **Traveler Picks:** 다른 이용자가 공개한 동선과 음식점을 인기순·최신순으로 탐색하고 상세 확인, 저장·해제, 지도에서 보기를 이용합니다.
- **실전 표현:** 상황별 일반·인기 한국어 표현을 탐색하고 한국어 TTS를 재생하며 표현을 저장한 뒤 마이페이지에서 다시 확인합니다.
- **AI 음성 도움:** 브라우저에서 발화를 인식하고 의미와 상황별 예상 답변을 제공하며, 적용 가능한 경우 한국어 발음 표기와 TTS를 제공합니다.
- **커뮤니티:** 카테고리별 게시글을 탐색하고, 사진을 최대 3장 첨부한 글을 작성하며, 음식점을 선택적으로 연결하고, 댓글·좋아요·본인 글 수정과 삭제를 이용합니다.
- **개인 활동:** 닉네임과 언어, 저장한 동선·음식점·표현, 내 게시글, 좋아요한 게시글, 활동 수치, 로그아웃, 비밀번호 변경, 계정 관리를 제공합니다.

고정 하단 메뉴는 **Map**, **Picks**, **Phrases**, **Community**, **My Page**로 구성됩니다.

## 주요 사용자 흐름

### 동선 추천

1. 기준 위치를 선택합니다.
2. 필요한 경우 지역·장소·음식점을 검색합니다.
3. 음식 종류를 최대 3개까지 선택하고 최소 평점을 지정합니다.
4. 클라이언트의 코드 기반 추천 로직으로 맛집 동선을 구성합니다.
5. 지도에서 최대 3곳의 방문 순서를 확인합니다.
6. 동선 상세 또는 음식점 상세를 확인합니다.
7. 가능한 화면에서 동선·음식점을 저장하고, 음식점을 공유하거나 리뷰를 작성합니다.
8. 필요하면 조건을 변경해 다시 추천받습니다.

선택 조건에 맞는 음식점이 부족하면 동선의 장소 수는 3곳보다 적을 수 있습니다.

### Voice Help

1. 현재 UI에서 선택 항목을 제공하는 경우 발화 언어를 선택합니다.
2. 브라우저 마이크로 말합니다.
3. 브라우저 Speech Recognition API가 음성을 텍스트로 변환합니다.
4. `mg-voice-help` Supabase Edge Function이 인식 원문, UI 언어, 발화 언어 코드를 받습니다.
5. 함수가 답변 언어 방향을 결정하고 Solar를 먼저 호출합니다.
6. Solar 요청이 실패하거나 폴백 대상의 유효하지 않은 응답을 반환하면 설정된 OpenAI를 호출할 수 있습니다.
7. 화면에 인식 원문, 발화 의미, 예상 답변과 예상 답변의 의미를 표시합니다.
8. 예상 답변이 한국어이면 한국어 발음 표기와 TTS를 제공합니다.

영어 또는 중국어 간체 발화에서는 한국어 예상 답변을 제공할 수 있습니다. 한국어 발화에서는 현재 UI 언어에 맞는 의미와 예상 답변을 제공합니다. 서버가 원문과 언어 레이블을 고정하므로 LLM이 인식 원문을 임의로 다시 작성하지 않습니다.

### Traveler Picks

1. 공개 동선 또는 Traveler Picks의 가게 목록 탭을 선택합니다.
2. 인기순 또는 최신순을 선택합니다.
3. 공개 항목을 탐색하고 공개 동선 또는 음식점 상세를 엽니다.
4. 항목을 저장·해제하거나 동선을 지도에서 확인합니다.
5. 상세 화면에서 이전 탭과 정렬 상태로 돌아갑니다.

비로그인 사용자는 각 피드의 최초 5개 항목을 볼 수 있습니다. 전체 항목이 더 있으면 고정 스켈레톤 로그인 티저를 표시합니다. 이 티저는 실제 다음 순위 동선이나 가게 정보를 전달받지 않으며 실제 제목·이미지·주소·평점·저장 수를 노출하지 않습니다. 버튼은 로그인 안내 모달을 거치지 않고 로그인 화면으로 이동한 뒤 기존 Picks 탭과 정렬 상태로 돌아옵니다. 로그인 사용자는 설정된 피드 한도 안에서 5개 단위 무한 스크롤을 이용합니다.

### 커뮤니티

1. 카테고리 또는 인기순으로 게시글을 탐색하고 댓글을 엽니다.
2. 좋아요·댓글·글쓰기를 위해 로그인합니다.
3. 사진을 첨부하고 필요한 경우 음식점을 검색해 연결합니다.
4. 현재 언어의 이름과 주소로 연결된 음식점을 확인하고 상세 화면으로 이동합니다.
5. 본인 게시글을 수정하거나 soft delete 방식으로 삭제합니다.

## 동선 추천 방식

맛집 동선은 생성형 AI나 LLM이 아니라 `src/features/explore/data/courseBuilder.js`의 결정적 클라이언트 코드로 구성합니다.

현재 구현은 다음 방식으로 동작합니다.

- Supabase에서 활성 내부 음식점과 현재 언어 텍스트를 불러옵니다.
- 최소 평점 필터에 사용할 사용자 리뷰 통계를 결합합니다.
- 선택한 음식 종류와 최소 평점으로 후보를 필터링합니다.
- 기준 위치와의 거리순으로 후보를 정렬합니다.
- 가까운 후보를 우선 사용하고, 후보가 부족하면 탐색 범위를 점진적으로 확장합니다.
- 검색 결과에서 사용자가 음식점을 직접 선택했고 해당 음식점이 필터를 통과하면 첫 번째 동선에 우선 포함합니다.
- 음식점 사이 이동 거리, 음식 종류 다양성, 카페 포함 보너스, 음식점 정보 충실도, 첫 장소의 기준 위치 접근성, 분류 정보가 약한 `other` 데이터 감점을 조합해 후보를 평가합니다.
- 음식점 사이의 도보 이동 거리가 짧은 조합을 우선합니다.
- 내부 `place_id`로 동선 장소와 언어별 음식점 레코드를 연결합니다.

거리 계산, 장소 필터링, 방문 순서 구성, 지도 표시, Traveler Picks 정렬, 페이지네이션, 집계, 인증, 데이터베이스 권한 제어에는 AI를 사용하지 않습니다.

## AI 활용 기능

맛길은 제한된 두 영역에서 AI를 사용합니다.

- **Voice Help:** `mg-voice-help` Edge Function은 국내 LLM인 Solar를 발화 의미 분석과 예상 답변의 기본 제공자로 사용합니다. OpenAI는 설정되어 있고 Solar 요청이 실패하거나 폴백 대상의 유효하지 않은 응답을 반환한 경우에만 보조로 사용됩니다.
- **다국어 데이터 보강:** `mg-place-translate-en`과 `mg-place-translate-zh`는 한국어 원본 레코드를 바탕으로 부족한 영어·중국어 간체 음식점 텍스트를 보강합니다. 영어 보강 경로는 Solar와 OpenAI를 사용할 수 있고, 중국어 보강 경로는 Solar를 사용합니다. 승인된 자동 생성 행은 공식 출처 번역과 다른 상태로 기록합니다.

번역 함수는 저장 전에 응답 구조와 원문 보존 여부를 검증합니다. null 처리, 자료형과 메뉴 항목 수, 주소 숫자, 영업시간·휴무일의 시간과 요일 토큰, 한국어 원문 이름 보존 등을 확인합니다. 검증 실패 결과는 구현된 보정·폴백 경로에서만 재시도하며 승인된 번역으로 저장하지 않습니다.

AI는 동선 추천, 거리 계산, 음식점 필터링, 지도 표시, Traveler Picks 정렬, 무한 스크롤, 저장·리뷰 집계, 사용자 인증, 공공데이터 수집 자체, 데이터베이스 접근 권한 제어를 수행하지 않습니다.

## 다국어·공공데이터

### 지원 언어와 언어별 레코드

현재 UI 지원 언어는 다음과 같습니다.

- 한국어
- 영어
- 중국어 간체

언어별 음식점 텍스트 행은 동일한 내부 `place_id`에 연결됩니다. 공식 다국어 출처 데이터가 있으면 우선 사용합니다. 자동 보강 행은 별도의 번역 상태로 관리하며 기존 공식 또는 승인된 언어 행을 덮어쓰지 않고 삽입합니다. 저장한 동선과 Traveler Picks는 연속성을 위해 snapshot을 보존하지만, 화면에서는 현재 언어의 음식점 레코드를 일괄 조회해 결합하므로 저장 당시 언어에 영구적으로 고정되지 않습니다.

한국어 원문을 바탕으로 자동 보강한 영어·중국어 간체 정보는 한국관광공사가 제공하거나 검수한 공식 번역이 아닙니다.

### 음식점 공공데이터

음식점 데이터셋은 공공데이터포털의 국문·영문·중문 간체 관광정보를 활용합니다.

- `한국관광공사_국문 관광정보 서비스_GW`
- `한국관광공사_영문 관광정보서비스_GW`
- `한국관광공사_중문 간체 관광정보서비스_GW`

수집용 Edge Function은 음식점 레코드를 정규화하고 처리 과정에서 사용한 원본 응답 데이터를 보존하며, 다국어 항목을 내부 장소 식별자에 연결해 Supabase에 저장합니다. 로그인 없이 접근 가능한 공개 `/data-sources` 화면에서 공식 출처 링크를 확인할 수 있습니다. 공공데이터 활용은 데이터 제공기관과의 제휴·후원·보증을 의미하지 않습니다.

### 이미지 정책

일부 음식점은 공공데이터에 포함된 원본 이미지 URL을 사용합니다. 해당 출처에는 공공누리 제1유형 또는 제3유형 이미지가 포함될 수 있습니다. 맛길은 제3유형의 변경금지 조건을 고려해 공공데이터 이미지에 크롭·필터·문구 합성을 적용하지 않고, `object-contain`으로 원본 전체를 표시합니다. 이미지가 없거나 불러오지 못한 경우에는 실제 이미지와 구분되는 placeholder를 표시합니다.

음식점과 동선 화면에서 공공데이터 출처 화면으로 이동해 출처와 이용조건 링크를 확인할 수 있습니다. 사용자가 업로드한 리뷰·커뮤니티 이미지는 공공데이터 이미지와 분리해 Supabase Storage에서 저장하고 표시합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 18, Vite 5, JavaScript, Tailwind CSS 3, React Router 6 |
| 지도와 검색 | Kakao Maps JavaScript SDK, Kakao Places API |
| Backend와 데이터 | Supabase PostgreSQL, RPC, Row Level Security, Storage, Edge Functions |
| 인증 | Supabase Auth, 이메일/비밀번호, Google OAuth 2.0, Facebook OAuth 2.0 |
| AI | Solar LLM, OpenAI API |
| 공공데이터 | 공공데이터포털과 위에 명시한 한국관광공사 관광정보 서비스 3종 |
| 배포 | GitHub Pages, GitHub Actions |

개발 과정에서는 VS Code, Claude Code, ChatGPT, Codex를 활용했습니다. 이 도구들은 애플리케이션의 런타임 의존성이 아닙니다.

## 시스템 구조

- **React/Vite 클라이언트:** 모바일 UI를 렌더링하고 동선 추천 로직을 실행합니다.
- **Kakao Maps JavaScript SDK와 Places API:** 지도를 표시하고 지도 위치를 지오코딩하며 일반 지역·명소·음식점을 검색합니다.
- **Supabase Auth:** 이메일·소셜 인증과 브라우저 세션을 관리합니다.
- **Supabase PostgreSQL과 RPC:** 음식점, 언어별 레코드, 표현, 저장 데이터, 리뷰, 커뮤니티, 공개 Traveler Picks 피드와 집계를 처리합니다.
- **Row Level Security:** 사용자 소유 저장·작성 데이터의 접근을 제어합니다. 공개 피드와 공개 집계는 RPC를 사용하며, 관련 SQL과 검증 기록 일부는 `docs`에서 확인할 수 있습니다.
- **Supabase Storage:** 리뷰 사진과 커뮤니티 게시글 이미지를 서로 다른 버킷에 저장합니다.
- **Supabase Edge Functions:** 공공데이터 수집, 다국어 보강, Voice Help 처리, 서버 권한이 필요한 계정 삭제를 수행합니다.
- **Solar와 OpenAI:** Voice Help와 다국어 보강에만 사용합니다.
- **한국관광공사 공공데이터:** Supabase 정규화 이전의 음식점 기본 정보와 제공 가능한 공식 다국어 레코드를 공급합니다.

저장소에는 별도의 전통적인 애플리케이션 서버가 없습니다.

## 프로젝트 구조

```text
.
├─ .github/workflows/       GitHub Pages 빌드와 배포 워크플로
├─ docs/                    구현 기록, 데이터 설계, 오류 분석, 수정과 검증 문서
├─ public/                  정적 자산과 GitHub Pages SPA 404 폴백
├─ src/
│  ├─ api/                  음식점·카테고리·언어 안내·상세 영역 조회
│  ├─ app/                  제공자, 라우터, 애플리케이션 셸
│  ├─ features/
│  │  ├─ auth/              Supabase 인증과 로그인 필요 흐름
│  │  ├─ community/         게시글, 댓글, 좋아요, 이미지, 연결된 음식점
│  │  ├─ courses/           저장 동선, 공개 피드, 동선 카드, 동선 다국어 처리
│  │  ├─ explore/           지도, 검색, 필터, 상세, 동선 추천 로직
│  │  ├─ phrases/           표현 탐색, 저장, 음성 인식, TTS, Voice Help
│  │  ├─ places/            음식점 저장, 리뷰, 리뷰 이미지, 상세 UI
│  │  ├─ profile/           프로필 수정, 내 게시글, 좋아요한 글, 계정 관리
│  │  └─ navigation/        5개 하단 메뉴
│  ├─ pages/                라우트 단위 화면
│  ├─ shared/               공통 UI, 라우트, i18n, 훅, 유틸리티
│  ├─ index.css             Tailwind 레이어와 애플리케이션 스타일
│  └─ main.jsx              React 진입점
└─ supabase/functions/      AI·수집·보강·계정 삭제용 Deno Edge Function
```

## 로컬 실행

`package.json`이나 버전 파일에는 Node 버전이 선언되어 있지 않습니다. 현재 배포 워크플로는 Node 20으로 빌드합니다.

```bash
npm install
npm run dev
```

개발 환경의 Vite base는 `/`이므로 Vite가 출력하는 로컬 URL을 `/matgil/` 접두 경로 없이 엽니다.

사용 가능한 스크립트는 다음과 같습니다.

```bash
npm run dev
npm run build
npm run preview
```

저장소에는 `lint` 또는 `test` 스크립트가 정의되어 있지 않습니다.

## 환경변수

커밋된 `.env.example`은 없습니다. 실제 자격 증명을 커밋하지 않는 로컬 `.env`를 생성해 사용합니다.

### 브라우저 빌드

| 변수 | 필수 여부 | 용도 |
|---|---:|---|
| `VITE_SUPABASE_URL` | 필수 | 브라우저 클라이언트가 사용하는 Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | 필수 | Supabase anonymous client key이며 데이터 접근에는 Supabase 정책이 적용됨 |
| `VITE_KAKAO_MAP_JS_KEY` | 지도/검색에 필수 | Kakao Maps JavaScript SDK key |

브라우저 설정에는 anon key만 사용합니다. AI key나 Supabase service role key를 `VITE_` 환경변수로 노출하면 안 됩니다.

### Supabase Edge Function secret

| 변수 | 필수 여부 | 용도 |
|---|---:|---|
| `SUPABASE_URL` | Supabase에 접근하는 함수에 필수 | 서버 측 Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 권한이 필요한 수집·보강·계정 삭제에 필수 | 브라우저에 노출하면 안 되는 서버 권한 자격 증명 |
| `SOLAR_API_KEY` | Solar 기반 함수에 필수 | Voice Help 기본 제공자와 번역·보강 제공자 |
| `OPENAI_API_KEY` | 폴백 활성화에는 필수인 선택값 | Voice Help 폴백과 영어 보강 제공자 경로 |
| `TOUR_KOR_API_SERVICE_KEY` | `mg-tour-seed`에 필수 | 국문 관광정보 API service key |
| `TOUR_ENG_API_SERVICE_KEY` | `mg-tour-en-enrich`에 필수 | 영문 관광정보 API service key |
| `TOUR_CHS_API_SERVICE_KEY` | `mg-tour-api-chs-enrich`에 필수 | 중문 간체 관광정보 API service key |
| `ADMIN_SEED_TOKEN` | 보호된 수집·보강 호출에 필수 | 관리자 일괄 처리 함수가 확인하는 공유 요청 토큰 |

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 일반적으로 Supabase 프로젝트 secret으로 제공됩니다. Voice Help는 Solar를 먼저 시도하고, OpenAI가 설정되어 있으며 Solar에서 폴백 대상 실패가 발생한 경우에만 OpenAI를 사용합니다.

## 빌드·배포

```bash
npm run build
npm run preview
```

`vite.config.js`는 개발 환경에서 `/`, production 빌드에서 `/matgil/`을 사용합니다. 배포 접두 경로가 필요한 정적 자산은 Vite의 `BASE_URL`을 이용합니다.

`.github/workflows/deploy.yml`은 `main` push 또는 수동 실행 시 Node 20에서 `npm ci`와 빌드를 수행하고 `dist`를 공식 GitHub Pages action으로 배포합니다. 저장소 메타데이터에 기록된 배포 URL은 `https://EclipticWin.github.io/matgil/`입니다.

애플리케이션은 production `/matgil/`에서 파생한 basename과 `BrowserRouter`를 사용합니다. `public/404.html`이 직접 접근한 내부 경로나 새로고침 URL을 조회 문자열 형태로 리디렉션하고, `index.html`의 동기 스크립트가 React Router 실행 전에 원래 경로를 복원합니다. 서버 rewrite 없이 GitHub Pages의 SPA 새로고침을 처리하는 구조입니다.

## 주요 라우트

아래 인증 표시는 화면 접근 기준입니다. 공개 화면 내부에도 로그인이 필요한 행동이 있을 수 있습니다.

| 라우트 | 용도 | 인증 |
|---|---|---|
| `/` | 지도, 기준 위치, 필터, 추천, 동선 상세 | 공개, 저장·리뷰 행동은 로그인 필요 |
| `/explore` | Traveler Picks의 공개 동선과 가게 목록 | 최초 5개 공개, 추가 조회와 저장은 로그인 필요 |
| `/explore/routes/:publicRouteKey` | 공개 동선 상세와 지도 연결 | 공개, 저장은 로그인 필요 |
| `/phrases` | 일반·인기 표현, TTS, Voice Help | 공개, 표현 저장은 로그인 필요 |
| `/community` | 커뮤니티 게시글, 댓글, 좋아요, 사진, 연결 음식점 | 읽기 공개, 작성·좋아요·댓글은 로그인 필요 |
| `/my` | 프로필, 개인 활동, 설정, 계정 관리 | 로그인 필요 |
| `/login` | 이메일·Google·Facebook 로그인 | 공개 |
| `/signup` | 이메일 회원가입과 닉네임 설정 | 공개 |
| `/places/:placeId` | 음식점 전체 상세 | 공개, 저장·리뷰 작성은 로그인 필요 |
| `/places/:placeId/reviews` | 음식점 리뷰 목록과 작성·편집 화면 | 읽기 공개, 작성·수정은 로그인 필요 |
| `/saved-courses/:id` | 저장한 동선 상세 | 소유자 로그인 필요 |
| `/my/saved-routes` | 현재 사용자의 저장한 동선 | 로그인 필요 |
| `/my/saved-places` | 현재 사용자의 저장한 음식점 | 로그인 필요 |
| `/my/saved-phrases` | 현재 사용자의 저장한 표현 | 로그인 필요 |
| `/data-sources` | 공공데이터와 이미지 출처 안내 | 공개 |

`/courses`는 `/explore`로 이동하는 호환용 리디렉션으로만 남아 있으며 현재 하단 메뉴 목적지가 아닙니다.

## 인증·데이터 접근

Supabase Auth가 이메일/비밀번호, Google, Facebook 로그인을 제공합니다. 로그인 필요 행동은 일반적으로 하나의 공통 안내 모달을 열고 안전한 내부 복귀 경로를 로그인 화면으로 전달합니다. Traveler Picks의 스켈레톤 티저는 자체 안내가 있으므로 곧바로 로그인 화면으로 이동합니다. 이메일 로그인은 전달된 React Router state로 복귀하고, OAuth는 외부 리디렉션 동안 안전한 복귀 경로를 `sessionStorage`에 보관합니다.

원래 화면이 일시적인 지도 오버레이이면 안정적인 Map 라우트로 돌아간 뒤 지원되는 범위에서 지도·음식점 상태를 재구성합니다. 저장·좋아요·댓글·글쓰기 같은 보호된 행동은 로그인 후 자동 재실행하지 않으며 사용자가 다시 수행합니다.

사용자 소유 데이터는 현재 Supabase 세션으로 조회·변경하며 Row Level Security와 함께 동작하도록 구성되어 있습니다. 공개 피드 RPC는 개인 저장 목록이나 사용자 목록 전체가 아니라 대표 공개 동선·가게 정보, 저장 수, 전체 수, 현재 사용자의 저장 상태를 반환합니다. 음식점 상세와 동선 내 음식점 카드는 동일한 `get_place_bookmark_count` 공개 RPC를 사용해 저장 수 기준을 맞춥니다.

저장한 동선은 방문 순서, 구조화된 장소 ID와 지표, 기준 위치 snapshot, 선택 조건 key, 동선 snapshot을 보존합니다. 방문 순서와 무관한 중복 판정값으로 동일 사용자가 같은 음식점 집합을 활성 상태로 중복 저장하지 못하게 합니다. 저장·공개 snapshot에는 현재 언어 음식점 행을 다시 결합해 표시합니다.

## 지원 범위와 한계

- 음식점 탐색과 공공데이터 수집 범위는 서울 중심입니다.
- 모바일 우선 레이아웃이며 큰 화면에서는 `22.5rem`(360 px) 애플리케이션 프레임을 중앙에 표시합니다. 고정 하단 메뉴와 지도·bottom sheet 인터랙션을 중심으로 설계되어 있습니다.
- 한국어, 영어, 중국어 간체를 지원합니다. 일본어는 현재 지원 UI 언어가 아닙니다.
- 공식 다국어 정보의 범위는 출처에 따라 다릅니다. 자동 보강 텍스트는 한국관광공사의 공식 번역과 별도이며 그에 맞게 해석해야 합니다.
- 영업시간, 휴무일, 메뉴, 주차 등 방문 정보는 바뀔 수 있으므로 중요한 정보는 실제 음식점에서 다시 확인해야 합니다.
- 브라우저 Speech Recognition과 Speech Synthesis의 지원 범위와 품질은 브라우저·기기에 따라 달라집니다.
- Kakao 일반 검색 결과가 내부 음식점 레코드와 일치하지 않으면 Kakao의 한국어 장소명이 유지되거나 내부 다국어 상세 정보가 제공되지 않을 수 있습니다.
- 요청 언어의 번역이 없으면 locale 폴백을 사용하며, 일부 영어 주소는 district 수준의 대체 표시를 사용할 수 있습니다.

## 관련 문서

- [`docs/`](docs/) — 기능 구현, 데이터 설계, 오류 원인 분석, 회귀 수정, 검증 결과, 남은 한계와 후속 과제를 기록한 번호 기반 작업일지.
- [`docs/31-MATGIL-FINAL-PROJECT-AUDIT.md`](docs/31-MATGIL-FINAL-PROJECT-AUDIT.md) — 해당 개발 시점의 프로젝트 감사 문서.
- [`docs/40-voice-help-solar-primary-openai-fallback-implementation-log.md`](docs/40-voice-help-solar-primary-openai-fallback-implementation-log.md) — Solar 우선 Voice Help와 OpenAI 폴백 구현 기록.
- [`docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md`](docs/57-traveler-picks-public-route-place-ranking-saved-pages-and-ui-polish.md) — Traveler Picks 피드와 저장 화면 구현 기록.
- [`docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md`](docs/64-public-data-image-attribution-and-traveler-picks-infinite-scroll-fix.md) — 공공데이터 출처, 이미지 처리, 피드 페이지네이션 기록.
- [`docs/65-place-bookmark-count-fix-and-traveler-picks-guest-teaser-ux.md`](docs/65-place-bookmark-count-fix-and-traveler-picks-guest-teaser-ux.md) — 음식점 저장 수 통합과 비로그인 티저 동작 기록.

## 라이선스

저장소 수준의 소프트웨어 라이선스는 별도로 명시되어 있지 않습니다. 공공데이터 레코드, 공공데이터 이미지, 사용자 업로드 콘텐츠에는 각각의 출처와 이용조건이 적용됩니다.
