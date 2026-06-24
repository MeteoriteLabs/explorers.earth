# Places Curation Dashboard Mockup — Design Specification

This document details the visual guidelines, design tokens, responsive layout structures, and interactive states for the **Places Curation Dashboard**. It maps layout parameters from the mockup design to the React codebases.

---

## 1. Overview & Context
* **Mockup File:** [places.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/places.html)
* **Target Interface:** A unified dashboard supporting a **Two-Step Flow** on both mobile and desktop screens:
  - **Step 1 (Locations)**: Directory showing the location lists (with Paris, Tokyo, Bali) and a featured Hero Cover card.
  - **Step 2 (Curated List Details)**: Detailed recommendation list (Pizzeria Popolare, etc.) and list management tools (Manage/My QR postcard).
* **Theme Support**: Adapts dynamically to Forest Green (default 🌲) and Classic Dark (🖤) themes.

---

## 2. Visual Hierarchy & Design Tokens
The dashboard layouts adapt dynamically via CSS custom properties referencing normalized design tokens:

| Token Name | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose / UI Surface |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Main viewport background |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Elevation surfaces (header, popovers, accordions) |
| `--dash-border` | `#3C4E40` | `#283147` | Layout lines, dividers, and card outlines |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Interactive active tags, buttons, switches |
| `--dash-muted` | `#3C4E40` | `#1E293B` | Fill states, inactive pills, chips |
| `--status-pub` | `#4ade80` | `#4ade80` | Published / Public active color indicator |
| `--status-draft` | `#f87171` | `#f87171` | Draft / Private active color indicator |

---

## 3. Step 1: Locations Directory Specifications

### 3.1 Responsive Action Bars
* **Desktop Screen (Full View)**:
  - Flexbox container displaying a `Public Visibility` panel on the left (with switch and HSL color indicators) and a `+ Add Location` button on the right (not full width).
* **Mobile Screen (Phone View)**:
  - Stretched full-width split action button (`Add Location` label on left, chevron on right). Clicking the chevron displays a drop-down visibility drawer.

### 3.2 Featured Hero Card (Paris Essentials)
* **Backdrop**: Scenic rooftop image backdrop with a gradient bottom overlay.
* **Top Pick Accent**: Bold yellow-gold stats line (`#fbbf24`).
* **Trigger Action**: Clicking `View Top Picks` transitions the dashboard to Step 2.

### 3.3 Locations Grid Cards
* **Grid Sizing**:
  - Desktop: 3-column responsive grid with a `1rem` gap.
  - Mobile: 2-column grid with a `0.5rem` gap.
* **Content**: Name, draft/pub indicator badge synced with a switch, 3 small thumbnails, and total place count.
* **Add Location Card**: Dashed border card wrapping a plus symbol.

---

## 4. Step 2: Location Detail Curation Specifications

### 4.1 Header and Navigation
* **Back link**: Text-based `Back` anchor with a left arrow chevron, styled with a font size of `0.55rem`, situated directly above the active location name.
* **Title & Toggle**: Align location name on left and a `Published` toggle switch on right.
* **Segmented Tabs Control**: Pills switching between `Recommendations` and `Manage`.

### 4.2 Recommendations Content
* **Add Place button**: Stretched full-width button (width `100%`) in both desktop and mobile viewports, positioned directly above the places grid.
* **Places Cards Grid**:
  - Desktop: 3-column responsive grid.
  - Mobile: 2-column grid.
  - Place Cards: Custom image background, top-left glassmorphic direction icon, top-right menu trigger, bottom title, rating star, and reviews count.


### 4.3 Manage Content
* **Unified Layout**: On both mobile (phone view) and desktop (full view), the Manage tab features a unified stacked layout contained inside a rounded border box.
* **Unified Outline Container**: A bordered container wrapper (`.acc-wrapper`) with a thin border (`--dash-border`), custom padding, and centered at a max-width of `600px` on desktop.
* **Manage Accordion**: Contains a header titled `Manage` (bold Poppins) and exactly three full-width outline buttons:
  - `Delete`: Gray/white outline border, trash icon.
  - `Edit`: Gray/white outline border, edit/pencil icon.
  - `Published`: Dynamic green outline border and check/eye icon when active (toggles to dynamic salmon/red offline style if the list is in Draft mode). Clicking this button toggles the list visibility state.
* **My QR Accordion**: Blue border color (`var(--dash-accent)`), containing:
  - **My QR Postcard Sticker**: 
    - White border wrapper (`1.5px solid white`).
    - Black header: `My Recommendations` (white text, font size `0.7rem`, bold, letter-spacing `0.2px`).
    - Background: City thumbnail image backdrop (`180px` height) with a white QR container overlay in the center.
    - Center logo overlay: Black pill with white `Explorers` title.
    - Footer overlay: `Travel like a local` badge.
  - **Horizontal Actions Row**: Three custom action icons with vertical text labels aligned horizontally below the postcard QR:
    - `Share Link`: Share/nodes icon.
    - `Copy Link`: Chain link icon (copies link to clipboard).
    - `Download QR`: Down arrow tray icon.
* **Smooth Animation**: Interactive chevrons (`.chevron-icon` SVG) rotate smoothly by 180 degrees using CSS transform properties when toggling accordion states.

---

## 5. Interaction Checklist
- [x] **Theme Switcher**: Modifies document CSS root variables (`setTheme()`) between Green and Dark.
- [x] **View Switcher**: Toggles responsive wrapper styles (`setViewMode()`) between `device-view` and `full-view`.
- [x] **Two-step Router**: Handles step transitions on both desktop and mobile views (`goToStep1()` / `goToStep2()`).
- [x] **Tabs Segmenter**: Switches active tab contents in both views.
- [x] **Accordions Toggle**: Toggles visibility of settings and QR panels in mobile view.
- [x] **Synced Switch Toggles**: Interlinking visibility switches to ensure labels synchronize accurately (e.g. `Draft` vs. `Pub`).
