# Public Music Page Mockup — Design Specification

This document details the visual guidelines and component specifications for the **Public Music Recommendation and Queue page** of `explorers.earth`. It defines layout structures, responsive view states, theme-supported CSS variables, and interaction guidelines.

---

## 1. Overview & Context
* **Mockup File:** [public_music.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_music.html)
* **Target Interface:** Route `/:username/music` — guest-facing interface allowing users to view what is playing, add requests to the queue, and browse host playlists.
* **Layout Sizing:** Highly responsive page switching between two presentation states:
  * **Phone view (📱 375px device wrapper):** Stacked mobile cards with swipe navigation dots, compact search box, and a single-column layout with vertical accordions.
  * **Full desktop view (🖥️ 1024px container):** Full-width Now Playing hero banner with overlaid queue thumbnails on the right, large search panel, and full-width list sections.

---

## 2. Visual Hierarchy & Design Tokens
* **Base Backdrop:** `#0d0f12` (Slate Black).
* **Font Families:** `'Poppins'` (headers, badges, UI elements) and `'Inter'` (standard text details).
* **Theme Styling:** Supports Classic Dark (🖤 dark theme) and Forest Green (🌲 green theme) using variables:
  * **Classic Dark Theme:**
    * `--primary: #3b82f6` (blue)
    * `--primary-glow: rgba(59,130,246,0.20)`
    * `--acc-icon-bg: rgba(59,130,246,0.12)`
  * **Forest Green Theme:**
    * `--primary: #10b981` (green)
    * `--primary-glow: rgba(16,185,129,0.20)`
    * `--acc-icon-bg: rgba(16,185,129,0.12)`
* **Surface Containers:** Background `#111111` (`--surface`) and secondary background `#1a1a1a` (`--surface-2`) with thin borders `rgba(255,255,255,0.10)`.

---

## 3. Key Components & Layout Sections

### 3.1 Search & Song Request Panel
* **Purpose:** Located at the top of the content stream, allowing guests to search and add tracks.
* **Sizing & Borders:** Card container with border-radius `14px` and padding `1rem`.
* **Input Elements:** 
  * Absolute search icon overlays inside input area (`#374151` border).
  * Request limit label shows remaining quota with a pulsating green live indicator dot:
    ```css
    box-shadow: 0 0 5px var(--accent-green);
    animation: pulse 1.6s ease-in-out infinite;
    ```

### 3.2 Now Playing Hero Card (Phone View)
* **Layout:** A stacked cards interface utilizing absolute positioning to overlap current and next queued items:
  * **Active Card:** `transform: translateX(0) scale(1)`, `opacity: 1`, `z-index: 10`.
  * **Next Card (Up Next):** `transform: translateX(10%) scale(0.91)`, `opacity: 0.8`, `z-index: 5`.
  * **Next-Next Card (#2):** `transform: translateX(20%) scale(0.82)`, `opacity: 0.45`, `z-index: 4`.
  * **Hidden (Other cards):** `transform: translateX(40%) scale(0.7)`, `opacity: 0`, `z-index: 1`.
* **Card Details:** Video thumbnail as background, dark gradient overlay (`linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)`), status badge, song title (truncated with ellipsis), and artist name.
* **Equalizer Indicator:** Only active card displays CSS animated equalizer bars (`eq-bar` with alternate-direction scale transformations).
* **Navigation:** Dot indicators row (`swipe-dot`) beneath the stack. Auto-advances every 5 seconds.

### 3.3 Now Playing Hero Banner (Desktop View)
* **Layout:** Replaces the mobile stacked cards with a full-width 400px tall horizontal hero banner.
* **Visual Styling:** Covers the background with the current song's album art, utilizing linear gradients to shade content areas:
  ```css
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 55%, transparent 100%),
              linear-gradient(to right, rgba(0,0,0,0.80) 30%, rgba(0,0,0,0.20) 70%, transparent 100%);
  ```
* **Song Overlay:** Positioned bottom-left, showing badge, large song title (`font-size: 2rem`), artist, and visual equalizer.
* **Queue Strip:** Positioned bottom-right, displaying up to 4 thumbnail cards for upcoming queued songs. The active item has an opacity change and border highlight.

### 3.4 Collapsible Accordion Sections
* **Layout:** Accordion containers stacked with `0.65rem` gaps.
* **Order & Defaults:**
  1. **Queue** (Expanded by default, displays current upcoming playlist queue)
  2. **Recently Played** (Collapsed, shows history of played songs with "+ Add" button)
  3. **Playlists** (Collapsed, details curated playlists)
  4. **Play on Your Device** (Collapsed, bottom section housing Youtube player placeholder)
* **Visuals:** Left-side icon with themed background (`var(--acc-icon-bg)`) and color (`var(--primary)`). Right-side chevron rotating 180 degrees (`.open`) when expanded.
* **Song Rows:** Row elements with thumbnail cover or svg musical note placeholder, song title, artist, and action buttons (`+ Queue`, `+ Add`).

---

## 4. Interaction Guidelines & State Actions

### 4.1 Playlist Tabs
* Nested tabs in the Playlists accordion. Allows guests to switch between distinct categories (e.g., Chill Vibes, Party Mix, Classics). Modifies active styles on the tab pill.

### 4.2 Play on Your Device Player
* Youtube embed slot shown at the very bottom. Hosts guest playback iframe when enabled by the stream owner.
