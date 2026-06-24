# Travel Guides Mockup — Design Specification

This document details the visual guidelines, design tokens, and component blueprints for the **Travel Guides Dashboard**. It maps layout parameters and behaviors from the HTML mockup to React components.

---

## 1. Overview & Context
* **Mockup File:** [guides.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/guides.html)
* **Target Interface:** A curation and management dashboard for user travel itineraries and guides.
* **Layout Sizing:** Responsive support. Optimized for phone screens (**375px** width in `device-view`) and larger desktop resolutions (**768px+** content area in `full-view`).

---

## 2. Visual Hierarchy & Design Tokens
The page relies on the standard explorers.earth design tokens:

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Main page background |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Header & filter background |
| `--dash-border` | `#3C4E40` | `#283147` | Borders & grid dividers |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Switch active background |
| `--green-highlight` | `#4ADE80` | `#4ADE80` | Published status indicator |

---

## 3. Component & Layout Specifications

### 3.1 Responsive Header & Visibility Row
* **Desktop View (`full-view`)**: 
  - Standard flex row layout (`display: flex`, `justify-content: space-between`).
  - Left side contains the public visibility label and switch toggle.
  - Right side contains a standalone `Create Guide` button (pill-shaped with `#3B82F6` background).
* **Mobile View (`device-view`)**:
  - Full-width split button with `border-radius: 20px`.
  - Left half is the `Create Guide` action button.
  - Right half is a dropdown trigger chevron. Clicking it opens a absolute-positioned glass card panel showing the public visibility switch to optimize mobile screen space.

### 3.2 Featured Guide Hero Section
* **Background**: A high-contrast travel photograph overlayed with a dark vertical gradient:
  `background: linear-gradient(180deg, rgba(13,15,18,0.1) 0%, rgba(13,15,18,0.95) 90%), url(...)`
* **Badge**: Yellow-accent indicator (`#fbbf24`) styled with a solid vertical bar.
* **Title & Subtext**: 
  - Title text (`font-size: 1.4rem`, `font-weight: 900`).
  - Info line (`font-size: 0.58rem`, `color: rgba(255,255,255,0.65)`).
* **Inset Thumbnail**: A small cover review thumbnail in the bottom-right corner (`width: 64px`, `height: 44px`, `border: 1.5px solid white`).

### 3.3 Search & Filter Layout
* **Search Input**: Flex-growing dark input capsule with search magnifying glass icon.
* **Filters Drawer/Panel**:
  - Clicking the filter button toggles the panel.
  - **Desktop**: Displays as an inline grid panel (`grid-template-columns: repeat(auto-fit, minmax(110px, 1fr))`) below the search bar.
  - **Mobile**: Displays as a sliding sidebar drawer (`width: 280px`) from the left with an overlay backdrop (`background: rgba(0,0,0,0.6)`).

### 3.4 Guide Grid Cards
* **Layout Grid**:
  - In mobile view (`device-view`), the grid uses responsive auto-fill (`repeat(auto-fill, minmax(160px, 1fr))`) to adapt dynamically (typically rendering 2 columns on mobile viewports).
  - In desktop view (`full-view`), the grid displays exactly **3 columns** (`repeat(3, 1fr)`).
* **Normal Cards**:
  - Thumbnail cover header (`height: 100px`) with a card visibility tag in the top-left (green for `Public`, red/orange for `Draft`).
  - Three-dot option button in top-right. Click action displays absolute dropdown menu (`Make Public/Draft`, `Edit`, `Delete`).
  - Bottom area contains guide title, rating, duration, and pill-shaped location tag badges.
* **Dotted Add Card**:
  - Interactive placeholder styled with dashed border (`2.2px dashed rgba(255, 255, 255, 0.12)`) and light hover color overlays to encourage new guide creation.

