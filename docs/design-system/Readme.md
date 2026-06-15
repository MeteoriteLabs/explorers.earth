# Design System Mockups Reference Library

This folder contains high-fidelity HTML/CSS mockups representing finalized visual designs and components for explorers.earth. These mockups are framework-agnostic blueprints used to update and align the applications' user interface.

## Folder Structure

```
design-system/
├── Readme.md (This file)
└── mockups/
    ├── components/    # Reusable UI component mockups (e.g., button.html, searchbar.html)
    └── page/          # Full-page layout mockups (e.g., homepage.html, settings.html)
```

## Mockups Index

### Pages
*   [homepage.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/homepage.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/homepage.md)) - **Option A (Polished Existing Design)**: Command center showing profile card, satellite map banner, stats, sub-tabs, search bar, and recommendation list items.
*   [recommendations.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/recommendations.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/recommendations.md)) - **Option A (Animated Immersive Cards)**: Category list page containing cards for Places, Music, Movies, Books, Games, and Guides. Designed specifically for **mobile screens**.
*   [profile.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/profile.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/profile.md)) - **Option A (Glassmorphic Accordion Tabs)**: Dynamic profile setup dashboard with responsive theme toggling, expandable accordions, tab switcher pill, and balanced glassmorphic input styling. Designed specifically for **mobile screens**.
*   [settings.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/settings.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/settings.md)) - **Option D (Command Palette Search style)**: Flat lists with quick search, connected account states, active subscription status, and a billing tab with radial usage gauges (Validity, Songs, AI Guides) and cycle toggling. Designed specifically for **mobile screens**.
*   [movie_game_book.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/movie_game_book.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/movie_game_book.md)) - **Option D (Two-step curated lists)**: Movies, Books, Games category pages featuring dashboard hero cover picks, list aggregation cards, and an interactive list details walkthrough view. Designed specifically for **mobile screens**.
*   [places.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/places.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/places.md)) - **Option A (Responsive Places Dashboard)**: Places curation dashboard featuring responsive layouts: a Mobile Two-Step flow with thumbnail grid/curated place cards, and a Desktop view with a sticky circular city carousel, centered tabs, and side-by-side management panels.
*   [guides.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/guides.html) ([Design Spec](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/guides.md)) - **Featured Guides & Dashboard**: Travel guides layout featuring a responsive visibility/add row, a featured guide hero cover banner, inline filters, and grid-based guide cards.



### Components
*   *(None finalized yet)*

## Guidelines for Updating Mockups
1. **No Application UI Changes First**: Design and finalize proposals in mockups before implementing them in the main React application UI.
2. **Standalone HTML Files**: Each component or page must be self-contained (using inline styles or `<style>` blocks) to make them easily previewable in any browser.
3. **Approved Tokens Only**: All mockups must strictly map layout padding/margins/gaps to the 4px baseline scale and use only approved colors (e.g. approved interactive blue `#3B82F6` instead of deprecated `#3498DB`), keeping inline with [AI Agent Design Contract & Review Checklist](file:///d:/Project/explorers.earth/docs/design-system/ai-agent-rules.md).
