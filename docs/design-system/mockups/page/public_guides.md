# Public Travel Guides Mockup — Design Specification

This document details the visual guidelines and component specifications for the **Public Travel Guides page** of `explorers.earth`. It details layout styling, typography, theme-supported CSS variables, and the synchronous filter interactions to translate the mockup into structured components.

---

## 1. Overview & Context
* **Mockup File:** [public_guides.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_guides.html)
* **Target Interface:** Blueprint for public-facing travel itineraries and theme-based guides lists.
* **Layout Sizing:** Fully responsive with two view modes:
  * **Phone view (📱 375px device wrapper):** Single column guide cards, mobile slide-out filter drawer, compact search bar, and hero content.
  * **Full desktop view (🖥️ 1024px container):** Multiple column guide cards, inline sliding search-filter dashboard panel, and expanded Hero banner.

---

## 2. Visual Hierarchy & Design Tokens
* **Base Backdrop:** `#0d1117` (Slate Black).
* **Font Families:** `'Poppins'` (primary headers, UI controls) and `'Inter'` (secondary text details).
* **Theme Styling:** Supports Forest Green (🌲 default/evergreen theme) and Classic Dark (🖤 dark theme) using variables:
  * Green Theme (default): `--dash-sidebar-bg: #1a2332`, `--dash-accent: #3b82f6`
  * Dark Theme: `--dash-sidebar-bg: #111622`, `--dash-accent: #3b82f6`
* **Card Border Color:** `rgba(255, 255, 255, 0.06)` with thin highlights.
* **Card Hover Accent:** `rgba(255, 255, 255, 0.15)` on borders with smooth `0.25s` transition translations.

---

## 3. Key Components

### 3.1 Featured Guide Hero
* **Layout:** Centered or left-aligned text with a background image overlay (`background: linear-gradient(180deg, rgba(13,15,18,0.15) 0%, rgba(13,15,18,0.95) 90%), url(...)`).
* **Visual Anchor:** Gold accent bar dot indicator next to uppercase "Featured Guide" label (`#fbbf24`).
* **Sizing:** Responsive heights (`min-height: 260px`).
* **Typography:** Title uses `font-size: 1.4rem` (mobile) to `1.85rem` (desktop), `font-weight: 900`, line height `1.15`.

### 3.2 Search & Filters Bar
* **Layout:** Flex row (`gap: 0.4rem`) with a search text box filling the space and a square toggler button for filters.
* **Search Box:** `height: 36px`, rounded `12px` border, translucent background (`rgba(255, 255, 255, 0.04)`).
* **Active Indicator:** Blue dot (`#3b82f6`, absolute position top-right of filter button) which toggles visible when filters are applied.

### 3.3 Desktop Filter Panel
* **Visibility:** Revealed below search/filter bar only in Desktop mode when toggled active.
* **Layout:** CSS Grid with 4 equal columns (`grid-template-cols: repeat(4, 1fr)`) containing fields: Guide Type, Category, Duration, Budget.
* **Field Styling:** Select dropdowns with background `rgba(0, 0, 0, 0.2)` and border `rgba(255, 255, 255, 0.08)`.

### 3.4 Guide Card Component
* **Sizing:** Standard card container layout with a cover image height of `110px`.
* **Details Section:**
  * Title: Bold white text (`font-size: 0.72rem` to `0.82rem`), clamped at 2 lines max using `-webkit-line-clamp`.
  * Meta text: Displays Rating, Duration, and Type (`★ 4.9 · 7 Days · Itinerary`) in `0.58rem` size.
  * Tag badges: Row of tags with background `rgba(255, 255, 255, 0.06)` and text size `0.52rem`.

---

## 4. Drawers & Overlays

### 4.1 Mobile Filter Drawer
* **Backdrop Shroud:** Cover overlay with background `rgba(0,0,0,0.6)` triggering with smooth opacity transition.
* **Sidebar Panel:** Width `280px` sliding from left to right (`transform: translateX(-100%)` to `translateX(0)`).
* **Content:** Houses vertically stacked dropdown selector fields for filter properties.

### 4.2 Detail Modal
* **Shroud Backdrop:** Blur filters enabled (`backdrop-filter: blur(10px)`).
* **Card Details Container:** Displays a large cover image fade-overlaying into the dark slate card container. Shows ratings, duration, tag category details, and descriptive copy along with action CTA.

---

## 5. Interaction & Sync Rules
* **Filter Synchronization:** Desktop and mobile dropdowns sync states continuously. Modifying filters in one view mode (e.g. mobile drawer selectors) updates corresponding desktop selectors via event listeners (`syncFilters()`), preventing inconsistencies when toggling viewport modes.
