# Public Movie, Book & Game Mockup — Design Specification

This document provides a design specification for the **Public Media Recommendations Mockup (Movies, Books & Games)** of `explorers.earth`. It details the layout behaviors and visual tokens represented in [public_movie_game_book.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_movie_game_book.html).

---

## 1. Overview & Context
* **Mockup File:** [public_movie_game_book.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_movie_game_book.html)
* **Target Interface:** Framework-agnostic blueprint for the public media recommendations pages (Movies, Books, Games).
* **Layout Sizing:** Optimized for dual states:
  * **Phone view (📱 375px wrapper):** Features overlapping stacked mobile cards, simple swipe indicators, and compact list rows.
  * **Full desktop view (🖥️ 1024px container):** Features a large featured hero slideshow, sidebar thumbnail controls, and larger poster layouts.
* **Category Variations:** Support unified structure for **Movies & Shows** (e.g. lists, durations, ratings), **Books** (pages, subjects), and **Games** (completion time, genre).

---

## 2. Visual Hierarchy & Design Tokens
* **Base backdrop:** Dark slate `#0d1117` with light contrast borders `rgba(255,255,255,0.08)`.
* **Category pill bar:** Segmented pills matching active states with `#3b82f6` backdrop fills.
* **Top Picks Hero Banner:** Primary visual anchor (dynamic cover photo, bottom gradients, metadata).
* **List Row scrollables:** Horizontal galleries displaying recommendation cards.
* **Browse Categories grid:** Quick filters by genre/subject.
* **Details Modal Dialog:** Immersive modal overlay containing backdrops and synopses.

---

## 3. Component Specifications

### 3.1 Featured Hero Carousel (Desktop)
* **Backdrop media:** Covers the container, auto-rotating slides, overlaying left and bottom shadow transitions:
  ```css
  background: linear-gradient(to top, black 15%, rgba(0,0,0,0.3) 60%, transparent 100%),
              linear-gradient(to right, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.2) 70%, transparent 100%);
  ```
* **Title text:** Large headline text (`font-size: 2.25rem`, `font-weight: 900`).
* **Synopses subtext:** Line-clamp overview text to `3 lines` max.
* **Thumbnail sidebar (Right):** Displays horizontal aspect-ratio `16:9` preview buttons. Active item shows a white border highlight.

### 3.2 Stacked Hero Cards (Mobile)
A cascading overlay stack mimicking smooth swipe gestures:
* **Active (Center) card:** `transform: translateX(0) scale(1)`, `opacity: 1`, `z-index: 10`.
* **Next card (Behind right):** `transform: translateX(12%) scale(0.9)`, `opacity: 0.8`, `z-index: 5`.
* **Next-Next card (Behind further right):** `transform: translateX(24%) scale(0.8)`, `opacity: 0.4`, `z-index: 4`.
* **Hidden Left card:** `transform: translateX(-110%) scale(0.9)`, `opacity: 0`, `z-index: 1`.

### 3.3 Curated List Row scrollables
* **Header:** Flex line mapping category titles left, and "See All ➔" links right.
* **Scroll list:** Flex-row alignment (`overflow-x: auto`, hidden scrollbars).
* **Poster Card:** Vertical item layout:
  * Aspect ratio `2/3`, rounded corners `10px`, border `1px solid rgba(255,255,255,0.08)`.
  * Top-right rating badge: Translucent black background (`rgba(0,0,0,0.75)`) displaying a gold star.
  * Title text: Trimmed with text ellipsis (`white-space: nowrap`, `text-overflow: ellipsis`).

### 3.4 Details Modal Dialog
* **Backdrop shroud:** Portal element filling viewport (`background: rgba(0,0,0,0.85)`, backdrop-blur `10px`).
* **Card Box:** Centered card, top backdrop photo, bottom detailed description panel, and streaming platform redirect actions.

---

## 4. Interactive Logic & Auto-Rotates

### 4.1 Slides Showcase Loop
Auto-iterates the active slideshow index and updates active visual classes every `6 seconds`:
```javascript
setInterval(() => {
  let nextIdx = (activeHeroIndex + 1) % 3;
  switchHeroActive(nextIdx);
}, 6000);
```

### 4.2 Details Modal triggers
Opens the dialogue box, populates fields, and focuses close triggers:
```javascript
function openDetails(title, year, rating, runtime, genres, image, overview) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-rate-val').textContent = rating;
  ...
  document.getElementById('detail-modal').classList.add('active');
}
```
