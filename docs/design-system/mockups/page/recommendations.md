# Recommendations Hub Mockup (Option A) — Design Specification

This document provides a detailed design specification for the **Recommendations Hub Mockup (Option A)** of `explorers.earth`. It acts as a framework-agnostic blueprint for implementation in React/Tailwind.

---

## 1. Overview & Context
* **Mockup File:** [recommendations.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/recommendations.html)
* **Design Pattern:** Option A (Animated Immersive Cards)
* **Target Interface:** Recommendations list dashboard designed specifically for mobile users to navigate between curated lists of interest (Places, Music, Movies, Books, Games, and Guides).
* **Layout Target:** Designed specifically for **Mobile Screens (375px)**. Features a top metadata header in the mockup to verify status, including a dedicated "Mobile Only" tag.
* **Supported Themes:** 
  * **Forest Green (🌲 Default):** Uses rich organic colors (`#2E4032`).
  * **Classic Dark (🖤 Dark):** Uses high-contrast dark tones (`#0F1419`).

---

## 2. Visual Hierarchy & Layout Structure
1. **Mockup Shell Header:** Static preview metadata header with theme selection triggers. Excluded from final runtime builds.
2. **Page Header:** High-impact bold title and description panel defining layout goals.
3. **Category Cards Grid:** A vertical stack of immersive, animated card items with platform-specific gradient styles.

---

## 3. Design Tokens & Color Palettes
The dashboard uses dynamic CSS variables mapping layout components to the system:

### Theme Colors Reference Table

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Application backdrop |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Mockup shell header controls background |
| `--dash-muted` | `#3C4E40` | `#222A3B` | Mockup button hover background |
| `--dash-border` | `#3C4E40` | `#283147` | Layout separators |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Active controls highlight |

---

## 4. Detailed Component Specifications

### 4.1 Page Header Panel
* **Title Headline:** Bold text "RECOMMENDATIONS" (`font-size: 1.3rem`, `font-weight: 900`, uppercase letter spacing `-0.02em`, `font-family: 'Poppins'`).
* **Sub-headline Description:** Secondary text (`font-size: 0.72rem`, color: `rgba(255,255,255,0.45)`, margin-top `0.2rem`).
* **Sizing/Padding:** Padding wrapper `1.5rem` top, `1rem` horizontal, `0.75rem` bottom.

### 4.2 Category Cards Inventory (`cat-card`)
A stack of custom layout cards housing categories. Each card is defined below:

```
+-----------------------------------------------------------------+
|  [CATEGORY TITLE] (Colored Text Accent)                         |
|  [Category description goes here in white text]                 |
|                                                                 |
|  (Gradient Backdrop: Custom Category Theme)                     |
+-----------------------------------------------------------------+
```

#### Card Visual Design Specifications
* **Dimensions:** `height: 90px`, border-radius `16px`, overflow hidden, relative positioning, margin-bottom `0.75rem`.
* **Transitions:** Smooth, hardware-accelerated transitions for hover states:
  - Sizing curve: `transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease`.
  - Background overlay curve: `transition: filter 0.2s ease`.
* **Hover State Behaviors:**
  - Card offsets upwards: `transform: translateY(-2px)`.
  - Drop shadow glows: `box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4)`.
  - Gradient backdrop brightens: `filter: brightness(1.15)`.
* **Backdrop Element (`cat-bg`):** Absolute container overlaying `inset: 0` space, styled with specific linear gradients (detailed in section 4.3).
* **Content Container (`cat-content`):**
  - Absolute container overlaying `inset: 0`, padding `0.8rem 1rem`, flex layout (`display: flex`, `align-items: center`).
  - Text protection: Left-aligned linear gradient overlay ensures legibility:
    `background: linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 80%)`.
* **Typography:**
  - Header: `font-size: 1.25rem`, `font-weight: 900`, uppercase, tracking `-0.02em`. Color maps to specific theme accents.
  - Subtext: `font-size: 0.6rem`, color: `rgba(255, 255, 255, 0.65)`, margin-top `0.2rem`, line-height `1.3`, `max-width: 170px`.

---

## 4.3 Category Theme Definitions

Each category card uses a distinct linear gradient and title color to build visual hierarchy.

| Category | Gradient Backdrop (`cat-bg`) | Title Color | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Places** | `linear-gradient(135deg, #1a2e1e, #0f4020)` | `#4ade80` (Green-400) | Geographic curated locations |
| **Music** | `linear-gradient(135deg, #1e1b4b, #2d1f5e)` | `#a855f7` (Purple-400) | Shared playlists & local tunes |
| **Movies & Shows** | `linear-gradient(135deg, #0f1e3d, #1e3a5f)` | `#3b82f6` (Blue-500) | Watch lists and theater picks |
| **Books** | `linear-gradient(135deg, #2a1f0a, #4a3010)` | `#f97316` (Orange-500) | Literary picks and reviews |
| **Games** | `linear-gradient(135deg, #2d0f3d, #4a1060)` | `#ec4899` (Pink-500) | Video games backlog and reviews |
| **Guides** | `linear-gradient(135deg, #1b3b24, #0d2b18)` | `#4ade80` (Green-400) | Detailed travel itineraries |

---

## 5. Accessibility (A11y) & UX Considerations
* **Semantic Markups:** Implement categories as interactive standard layout lists (`<ul>`/`<li>` structure) or link-based buttons rather than nested raw `<div>` tags to improve screen reader page flow.
* **Text Contrast:** Uses a dark background overlay (`rgba(0,0,0,0.75)`) on the left half of the card to guarantee that white subtext maintains a contrast ratio of > 4.5:1, satisfying WCAG AA requirements on all colorful gradients.
* **Keyboard Triggers:** Each card should act as a keyboard-focusable link target, displaying active focus indicators (`focus-visible:ring-2`) when traversed.
