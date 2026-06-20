# Public Places Mockup — Design Specification

This document details the visual guidelines and component guidelines for the **Public Places Recommendations page** of `explorers.earth`. It maps the visual treatments from the HTML mockup to React component guidelines.

---

## 1. Overview & Context
* **Mockup File:** [public_places.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_places.html)
* **Target Interface:** Framework-agnostic blueprint for the public places recommendation page.
* **Layout Sizing:** Optimized for dual states:
  * **Phone view (📱 375px device wrapper):** Overlapping stacked mobile cards, swipe indicator dots, and compact lists.
  * **Full desktop view (🖥️ 1024px container):** Large featured hero slideshow, sidebar thumbnail buttons, and larger place card layouts.
* **Navigation Flow:** Two-step details flow. Step 1 displays lists in scrollable carousels. Step 2 shows a grid of places inside a clicked list.

---

## 2. Visual Hierarchy & Design Tokens
* **Base backdrop:** Dark slate `#0d1117` with light contrast borders `rgba(255,255,255,0.08)`.
* **Theme Support:** Forest Green (🌲 Default) and Classic Dark (🖤 Dark). Toggles adjust variables:
  * `green`: `--theme-border-color: #10b981`, `--evergreen-glow: rgba(16, 185, 129, 0.2)`
  * `dark`: `--theme-border-color: #3b82f6`, `--evergreen-glow: rgba(59, 130, 246, 0.2)`

---

## 3. Step 1: Places Dashboard Specifications

### 3.1 Featured Hero Picks (Eiffel Tower, Senso-ji, Uluwatu)
* **Desktop Layout:** Image covers the backdrop. Overlaying gradients darken the bottom and left edges:
  ```css
  background: linear-gradient(to top, black 15%, rgba(0,0,0,0.3) 60%, transparent 100%),
              linear-gradient(to right, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.2) 70%, transparent 100%);
  ```
  Large header title (`font-size: 2.25rem`, `font-weight: 900`). Right-bottom thumbnails row displays 16:9 buttons. Active slide has a white highlight outline.
* **Mobile Layout:** Stacked cards overlay. Active card has scale 1 and z-index 10. Subsequent cards cascade offset to the right:
  * Center active: `transform: translateX(0) scale(1)`, `opacity: 1`, `z-index: 10`.
  * Next (behind right): `transform: translateX(12%) scale(0.9)`, `opacity: 0.8`, `z-index: 5`.
  * Next-Next (behind further right): `transform: translateX(24%) scale(0.8)`, `opacity: 0.4`, `z-index: 4`.

### 3.2 Curated Location Lists
* **List Row Header:** Bold list title (`font-size: 0.95rem`) with "See All ➔" links on the right.
* **Horizontal Scroll:** Scrolls place cards horizontally, hiding scrollbars.
* **Place Recommendation Card:** Card dimensions are `135px x 155px` (mobile) or `155px x 180px` (desktop):
  * Linear gradient shading overlay: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 85%)` on background image.
  * Top-Left: Translucent dark circle (`width: 26px`, `height: 26px`, border `1px solid rgba(255,255,255,0.2)`) containing a white 45-degree arrow direction board icon.
  * Bottom: Place title (bold, text-shadow) and rating details `★ 4.7 (12k)`.

---

## 4. Step 2: Location Grid & Place Details Modal

### 4.1 Step 2 Grid View
* **Navigation Header:** Displays a small "Back" button with a left arrow directly above the active location name.
* **Grid:** Displays all place recommendation cards inside the list in a 2-column (mobile) or 3-column (desktop) layout.

### 4.2 Place Details Modal
* **Shroud Overlay:** Shroud covers the screen (`background: rgba(0,0,0,0.85)`, backdrop-filter `10px`).
* **Modal Card Box:** Centered box showing backdrop image, title, rating, category, address line, description, and redirection buttons.

---

## 5. Step 3: Full-Screen Map View & Hero Map Integration

### 5.1 Iterating Hero Map Slide
* **Slide Integration:** The Interactive Satellite Map is integrated directly as the 4th slide (`Slide 3` / `Card 3`) inside the auto-rotating hero slideshow stack.
* **Behavior:** It auto-iterates in the same manner as the other featured location slides. Even if no specific featured locations are present, this map slide is always present in the header.
* **Interactive Pins:** Displays clickable location pin markers on the satellite map view which show hover labels and launch the Place details modal when clicked.
* **Hero CTA:** When the Map slide is active, the details box action button updates to `Open Full Map` and launches the full-screen interactive Map view.


### 5.2 Floating View Toggle (FAB)
* **Pill FAB:** Centered floating button (`bottom: 1.5rem`, `left: 50%`) with background color `#3b82f6` and text size `0.75rem`. Toggles layout state between:
  * **Map View:** Replaces lists with full-viewport interactive map. Icon switches to a list symbol, and label updates to `List View`.
  * **List View:** Returns to standard aggregation dashboard with featured hero slideshow. Icon switches to map symbol, and label updates to `Map View`.

### 5.3 Full-Screen Map View
* **Region Selector Top Bar:** Absolute header row displaying regions (All Regions, Paris Essentials, Tokyo Favorites). Clicking tags repositions map center and filters location data.
* **Collapsible Bottom Tray:** Sliding tray container (`transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)`) housing:
  * Drag Handle bar at top center.
  * Category inline pill tags row filtering active pins and cards.
  * Horizontal scrolling place recommendation cards representing filtered targets.

