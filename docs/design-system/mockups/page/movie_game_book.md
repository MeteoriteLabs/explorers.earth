# Movies, Games & Books Recommendations Mockup — Design Specification
 
This document details the visual guidelines and component blueprints for the **Media Recommendations Dashboard (Movies, Games & Books)**. It maps exact visual treatments from the HTML mockup to React component guidelines.
 
---
 
## 1. Overview & Context
* **Mockup File:** [movie_game_book.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/movie_game_book.html)
* **Target Interface:** A unified media category recommendation dashboard supporting two interactive states:
  - **Step 1 (Category Dashboard):** Curved header, visibility switcher, featured hero, and list cards.
  - **Step 2 (List View details):** Navigation header, toggle actions, alerts notice bar, curated media items grid.
* **Layout Sizing:** Optimized for mobile viewports (**375px** width). Supports responsive scaling container toggles.

---

## 2. Visual Hierarchy & Design Tokens
The page adapts dynamically to global theme variables:

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Application base background |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Viewport header background |
| `--dash-border` | `#3C4E40` | `#283147` | Borders & dividing lines |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Switch active backgrounds |

---

## 3. Step 1: Movies & Shows Dashboard Specifications

### 3.1 Featured Hero Card (Interstellar)
* **Backdrop**: Space astronaut scenery styled with bottom overlays:
  `background: linear-gradient(180deg, rgba(13,15,18,0.15) 0%, rgba(13,15,18,0.95) 90%), url(...)`
* **Top Pick Bar**: Thick yellow-gold line accent (`#fbbf24`) with bold uppercase label.
* **Title text**: Interstellar title text (`font-size: 1.85rem`, `font-weight: 900`).
* **Description subtext**: Clamp descriptions to maximum `2 lines` (`display: -webkit-box; -webkit-line-clamp: 2`).

### 3.2 Curated List Grid Cards
* **mymovie Card**:
  - Outlined border card containing title `mymovie` (`font-size: 0.8rem`), poster thumbnail, and stats summary (`1 movie • ★ 1 pinned`).
  - Active mini-switch indicator in the top right.
* **Add new list Card**:
  - Dotted border card (`2.2px dashed`) wrapping a central plus button and label text.
  - Transitions to highlight theme accent and opacity on hover.

---

## 4. Step 2: mymovie Curated List View Specifications

### 4.1 Controls & Navigation Row
* **Back Button**: A text link styled with an arrow vector directly above the list name (font size `0.55rem`), which triggers stepping back to Step 1.
* **Tabs-Pill Switcher**:
  - Rounded white container containing "Recommendations" and "Manage" pills.
  - Active button has background color `--dash-accent` and white text.

### 4.2 Top Picks Notice Bar
* **Visuals**: Gold alert banner (`background: rgba(251,191,36,0.06)`, `border: 1px solid rgba(251,191,36,0.25)`) with a star icon.

### 4.3 Curated List Card
* **Structure**: Flex container mapping poster picture on the left, titles & details in the middle, and star + option items triggers on the right.
