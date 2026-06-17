# Matgil 맛길 — Seoul Food Routes

A mobile-first web app that helps travellers in Seoul build a **food-crawl route**:
pick an area → pick your cravings → get a recommended walking course, plus useful
Korean phrases (with text-to-speech), popular spots, bookmarks and a profile.

Built with **Vite + React (JavaScript) + Tailwind CSS** and **react-router-dom**.
It renders as a centered mobile frame (max-width `22.5rem`, 360px base) on any screen.

## Run

```bash
npm install
npm run dev      # start dev server (Vite prints the URL)
npm run build    # production build
npm run preview  # preview the build
```

## Folder structure

```txt
src/
  app/            App.jsx (thin shell), router.jsx, providers.jsx
  pages/          one component per screen (Login, Home, Area, Preference,
                  Loading, Result, Courses, CourseDetail, Phrases, Community,
                  Popular, Bookmark, My)
  features/       feature-scoped components / data / services / hooks
    auth/         LoginForm, mockAuthService, useAuth
    area/         AreaSelector, mockAreas
    preference/   PreferenceSelector, preferenceOptions
    recommendation/ RecommendationCard, RecommendationSummary,
                  mockRecommendations, recommendationService, useRecommendation
    phrases/      PhraseCard, PhraseCategoryTabs, phrases, ttsService
    courses/      CourseCard, courses (hand-picked eating routes)
    community/    PostCard, CommunityTabs, communityPosts
    popular/      PopularPlaceCard, mockPopularPlaces
    navigation/   BottomNavigation
  shared/         cross-cutting building blocks
    components/   AppLayout, Header, Button, Card, EmptyState, StepIndicator,
                  Icon, Thumbnail
    constants/    routes.js
    utils/        classNames.js
    hooks/        useBookmarks
  index.css       Tailwind layers + design-token-driven base styles
  main.jsx        React entry
```

## Navigation map

Bottom-tab pages (wrapped by `AppLayout`, which renders `BottomNavigation`):

- **Map** → `HomePage` (start the recommendation flow; also previews Popular)
- **Courses** → `CoursesPage` (동선코스 — hand-picked eating routes)
- **Phrases** → `PhrasesPage`
- **Community** → `CommunityPage` (커뮤니티 — traveller tips & reviews)
- **You** → `MyPage` (Saved spots reachable from the “Saved places” stat)

Full-screen flow (no bottom nav): **Login**, the recommendation wizard
**Area → Preference → Loading → Result**, and **CourseDetail** (`/courses/:id`).
`PopularPage` and `BookmarkPage` stay routed (reachable from Home / My) but are
no longer in the bottom bar.

