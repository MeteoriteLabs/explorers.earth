# Homepage Mockup (Option A) — Design Specification

This document provides a detailed design specification for the **Homepage Mockup (Option A)** of `explorers.earth`. It acts as a framework-agnostic blueprint for implementation in React/Tailwind.

---

## 1. Overview & Context
* **Mockup File:** [homepage.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/homepage.html)
* **Design Pattern:** Option A (Polished Existing Design)
* **Target Interface:** Command center layout containing user profile information, dynamic category tabs, quick search, quick actions, and structured lists of recommendations.
* **Layout Modes:** Supports interactive toggling between **Phone View** (375px viewport simulating a mobile application container) and **Full Responsive View** (desktop layout centering a 600px phone frame).
* **Supported Themes:** 
  * **Forest Green (🌲 Default):** Curated earth-tone theme with custom gradients and subtle green shades.
  * **Classic Dark (🖤 Dark):** Sleek, high-contrast dark theme.

---

## 2. Visual Hierarchy & Layout Structure
The homepage is structured vertically within a unified container:
1. **Preview Master Header (Mockup Shell):** Metadata and interactive mockup controls (Device Toggle and Theme Toggle). Excluded from final app implementation.
2. **User Greeting:** A welcoming header welcoming the user with an active handle (`Welcome back, alex_explorer 👋`).
3. **User Profile Card:** An image-free container that uses interactive map graphics and badge grids.
4. **Interactive Category Tab Strip:** A scrollable tab bar containing semantic categories.
5. **Action Bar:** A row containing search inputs, a dynamic Add Button, and a share button.
6. **Recommendation List:** A list displaying active/draft curated collections with state-matching visual boundaries.

---

## 3. Design Tokens & Color Palettes
The design utilizes a curated palette mapped to CSS variables to support dynamic theme switching.

### Theme Colors Reference Table

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Application backdrop |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Card background & secondary elements |
| `--dash-muted` | `#3C4E40` | `#222A3B` | Interactive hover backgrounds |
| `--dash-border` | `#3C4E40` | `#283147` | Div boundaries & layout borders |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Active buttons, focus indicators, highlight lines |
| `--dash-container-bg`| `#2E4032` | `#0F1419` | Inner dashboard container background |
| `--dash-tab-bg` | `#1a2620` | `#121620` | Scrollable tab strip background |
| `--dash-search-bg` | `#223126` | `#161B26` | Inputs and controls backdrop |
| `--dash-map-banner` | `linear-gradient(135deg, #1a2c1e, #0f1a10)` | `linear-gradient(135deg, #1e293b, #0f172a)` | Profile header map graphics backdrop |
| `--status-pub` | `#4ade80` | `#4ade80` | Published status highlights (Green) |
| `--status-draft` | `#f87171` | `#f87171` | Draft/Private status highlights (Red) |

---

## 4. Detailed Component Specifications

### 4.1 Welcoming Header
* **Text Style:** `font-size: 1.1rem`, `font-weight: 800`, `font-family: 'Poppins'`.
* **Alignment:** Centered, padding `1.25rem` top, `1rem` horizontal, `0.5rem` bottom.
* **Colors:** Fixed white text (`#FFFFFF`) against base dashboard background.

### 4.2 Profile Card (Immersive Map Banner & Stats Grid)
An integrated block showing user presence, metrics, and location metadata.

#### A. Interactive Map Banner
* **Dimensions:** `height: 120px`, relative positioning, overflow hidden.
* **Background:** `--dash-map-banner` gradient overlay.
* **Map Grid Overlay:** Simulated latitude/longitude lines built using CSS background-images:
  ```css
  background-image: linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
  ```
* **Visual Map Markers (Dots):** Custom absolute-positioned circles simulating geographic recommendations:
  - Base dimensions: `10px` width/height, `50%` border radius, `2px` solid white border.
  - Active Blue Marker (Position: Top 35%, Left 25%): Accent color glow via `box-shadow: 0 0 8px var(--dash-accent)`.
  - Published Green Marker (Position: Top 55%, Left 60%): Green indicator with match glow (`#4ade80`).
  - Draft Orange Marker (Position: Top 25%, Left 75%): Orange indicator (`#f97316`).
* **Overlay Share Profile Button:**
  - Position: Absolute top `0.5rem`, right `0.5rem`, `z-index: 10`.
  - Styling: Translucent background `rgba(13,15,18,0.7)` with `backdrop-filter: blur(6px)`. Border `1px solid rgba(255,255,255,0.15)`, border-radius `20px`, padding `0.25rem 0.65rem`.
  - Elements: Left-aligned text "SHARE" (`font-size: 0.58rem`, `font-weight: 700`, uppercase, `0.04em` tracking). Right-aligned SVG share icon.

#### B. Profile Metrics Info Row
* **Name Header:** Centered text "Alex Explorer" (`font-size: 0.9rem`, `font-weight: 700`, margin bottom `0.6rem`).
* **Stats Row:** Flex layout (`display: flex`, `gap: 0.5rem`).
* **Stat Badges:** 3 equal-width boxes (`flex: 1`) styled with background `--dash-sidebar-bg`, border `--dash-border`, border-radius `12px`, padding `0.5rem 0.75rem`.
  - **Metric Number:** Large text (`font-size: 1.1rem`, `font-weight: 800`, color: white).
  - **Metric Label:** Subtext (`font-size: 0.6rem`, color: `rgba(255,255,255,0.5)`, uppercase, `white-space: nowrap`).
  - *Metrics Tracked:* Active Lists (`12`), Recommendations (`87`), Views (`2.3k`).

### 4.3 Category Tab Strip
A horizontal scrollbar for selecting active recommendation types.
* **Container:** Background `--dash-tab-bg`, border-radius `28px`, padding `3px`, flex layout, overflow-x auto with hidden scrollbars.
* **Interactive Tabs:** Button pills styled with `border-radius: 24px`, padding `0.3rem 0.65rem`, `font-size: 0.6rem`, `font-weight: 600`, `white-space: nowrap`, transparent background.
* **Active Tab State:** Styled with background `--dash-accent`, text: white, `font-weight: 700`.
* **Supported Categories & Emojis:**
  1. 📍 Places (Active by default)
  2. 🎬 Movies
  3. 📚 Books
  4. 🎮 Games
  5. 🎵 Music
  6. 📖 Guides

### 4.4 Action Row
Consists of search inputs and main call-to-actions placed inline:
1. **Search Bar:** Mapped to background `--dash-search-bg`, border `--dash-border`, border-radius `12px`, padding `0.35rem 0.55rem`, height `34px`, flex layout, aligning search SVG icon and a dynamic placeholder text.
2. **Dynamic Add Button:**
   - Base design: Border-free, border-radius `12px`, height `34px`, padding `0.45rem 0.65rem`, `font-size: 0.6rem`, `font-weight: 700`, transition filters.
   - Dynamic Theming: Adapts background color and text label when categories switch:
     - **Places / Movies:** Background: Blue CTA (`#3B82F6`), Text: White. Label: `+ Add Places` / `+ Add Movies`.
     - **Books:** Background: Orange CTA (`#F97316`), Text: White. Label: `+ Add Books`.
     - **Games:** Background: Pink CTA (`#EC4899`), Text: White. Label: `+ Add Games`.
     - **Music:** Background: Purple CTA (`#A855F7`), Text: White. Label: `+ Add Music`.
     - **Guides:** Background: Green Accent (`#4ADE80`), Text: Dark (`#0d0f12`). Label: `+ Add Guides`.
3. **Icon-Only Share Button:** Custom container (`width: 34px`, `height: 34px`, border-radius `12px`, background `--dash-search-bg`, border `--dash-border`, flex centering, containing share SVG). Includes hover transitions mapping to background `--dash-muted`.

### 4.5 Recommendation List Items
Display container rendering vertical lists. Item specifications:
* **Layout Structure:** Flex row, `gap: 0.75rem`, background `--dash-sidebar-bg`, border `1px solid var(--dash-border)`, border-radius `16px`, padding `0.75rem`, margin-bottom `0.5rem`, transition hover to `border-color: var(--dash-accent)`.
* **State Avatar Indicator:** Left-aligned container representing status:
  - Outer border: `3px solid` matching status color (`--status-pub` for published, `--status-draft` for drafts).
  - Shape: Circular (`width: 56px`, `height: 56px`, `border-radius: 50%`).
  - Center element: Centered large emoji on background `--dash-muted`.
* **Item Description:** Vertical text column:
  - Header: Title `font-size: 0.78rem`, `font-weight: 700`, color: white.
  - Subtext: Count and colored dot status indicator (`font-size: 0.62rem`, color: `rgba(255,255,255,0.45)`, with status label colored to `--status-pub` or `--status-draft`).

---

## 5. State Management & Interactive Logic
The mockup implements basic client-side JavaScript handlers to demonstrate application mechanics:

### 5.1 Tab Switching Engine (`handleHomeTabClick`)
```javascript
function handleHomeTabClick(btn, category) {
  // 1. Reset active buttons in layout list
  container.querySelectorAll('.home-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // 2. Dynamically update search input placeholder text
  document.querySelector('.home-search-placeholder').textContent = `Search ${category}, lists…`;

  // 3. Shift background/foreground colors and label of "Add Button" to match active category
  // 4. Trigger list re-render (populating new mock items from index)
  renderCategoryList(category);
}
```

### 5.2 Content Rendering (`renderCategoryList`)
Constructs elements by referencing a mock dictionary matching the active category. Each item defines an emoji, a title, a sub-description, and a status string (`pub` / `draft`). 

### 5.3 Theme Switcher (`setTheme`)
* Target selector: `document.documentElement` (registers variables globally).
* Operation: Loops through the selected theme's properties and maps values to matching CSS variables.

---

## 6. Responsiveness & Preview Shell Controls
* **Phone View (`device-view`):** Locks dimensions to `375px` width and `720px` height. Surrounds container with a dark frame (`12px` solid `#1e293b`), rounded boundaries (`border-radius: 40px`), and shadows. The inner frame sets `overflow-y: auto` and hides native webkit scrollbars.
* **Desktop Full View (`full-view`):** Scales the container to `100%` width, wrapping contents inside a center-focused `max-w-[600px]` column with custom layout padding.

---

## 7. Accessibility (A11y) & Usability Compliance
* **Keyboard Focus Navigation:** All custom button elements are constructed using standard `<button>` tags rather than interactive divs to preserve tab indexing.
* **Layout Contrast:** Status badge text uses background transparency (`bg-emerald-500/10`) layered with high-contrast text colors (`text-emerald-400`) to guarantee legibility.
* **Tab-index Cleanup:** Hidden scrollable horizontal elements use standard overflow wrappers to keep tab interactions natural.
