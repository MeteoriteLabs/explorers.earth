# Public Profile Mockup — Design Specification

This document provides a detailed design specification for the **Public Profile Mockup** of `explorers.earth`. It maps the visual guidelines and component design tokens directly from [public_profile.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_profile.html) into specifications for implementation.

---

## 1. Overview & Context
* **Mockup File:** [public_profile.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/public_profile.html)
* **Target Interface:** Immersive public user page presenting user profile pictures, cover banner scenery, social media integration shortcuts, custom biography descriptions, and a navigation hub using sub-tabs for recommendations, gallery, and business information.
* **Layout Sizing:** Optimized for both mobile viewports (**375px** device wrapper) and desktop scaling (**1024px** maximum width).
* **Theme Support:** Forest Green (🌲 Emerald accent) and Classic Dark (🖤 Blue accent) models.

---

## 2. Visual Hierarchy & Layout Structure
1. **Mockup Controller Header:** Master switches for view mode (device vs full) and theme variables. Toggled on client-side test frameworks only.
2. **Sticky Public Header:** High-contrast bar showing website branding logo and share actions.
3. **Immersive Cover Photo Backdrop:** Graphic element wrapping custom masking blurs and cinematic gradient shades.
4. **Profile Identity Card:** Centered profile picture overlaying cover photos, listing name, location, quick social contacts, and bio.
5. **Sub-Tabs Section:** Toggle pill controls containing "Recommendations", "Gallery", and "Business".
6. **Active Panel Viewport:** Render list details based on selected tab:
   * **Recommendations Tab:** High-fidelity animated category buttons mapping to Places, Music, Movies & Shows, Books, and Games recommendations.
   * **Gallery Tab:** 3-column square thumbnail image showcase.
   * **Business Tab:** Mapped details containing business name, address, overview, and quick-dial links.

---

## 3. Design Tokens & Color Palettes
Theme states map dynamically to CSS configuration properties:

| Variable Token | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose |
| :--- | :--- | :--- | :--- |
| `--theme-border-color` | `#10b981` | `#3b82f6` | Avatar border outline accent |
| `--evergreen` | `135deg, #10B981, #047857` | `135deg, #3B82F6, #1D4ED8` | Active category card glows |

---

## 4. Component Details & Specifications

### 4.1 Sticky Public Header
* **Dimensions:** `height: 56px`, sticky placement, border-bottom `1px solid rgba(255,255,255,0.1)`.
* **Colors:** Translucent overlay `rgba(42, 42, 42, 0.9)`, backdrop filter blur `8px`.
* **Logo text:** Left-aligned `explorers.earth` brand label (`font-size: 1.25rem`, `font-weight: 800`).
* **Header Actions:** Right-aligned buttons containing inline SVGs for Share and Copy Link controls.

### 4.2 Immersive Cover Photo Backdrop
* **Dimensions:** Mobile `height: 280px`, Desktop scale `height: 360px`, relative positioning.
* **Cover Media:** Scaled scenery picture (`object-fit: cover`, `transform: scale(1.05)`).
* **Blur mask effect:** Frosted mask element positioned bottom:
  ```css
  backdrop-filter: blur(8px);
  mask-image: linear-gradient(to top, black 30%, transparent 100%);
  ```

### 4.3 Profile Identity Details
* **Avatar picture:** Circular container (`width: 110px`, `height: 110px`, border `4px solid var(--theme-border-color)`), elevated by shadow layers.
* **Location label:** Subtitle text (`font-size: 0.72rem`, color `rgba(255,255,255,0.85)`).
* **Social links row:** Centered grid showing circular brand buttons (Instagram, WhatsApp, SMS, Web Link, YouTube, Spotify, Gmail). SVGs display color fades (`color: rgba(255,255,255,0.7)`, hover: `color: white`).

### 4.4 Recommendations Category Cards
Group of category rows wrapping micro-animations:
* **Places (Emerald Theme):** Dark green base (`#0d1e15`) overlaying mountain landscape silhouette, with dynamic bird vector shapes flying across cards (`animation: flyBird 12s linear infinite`).
* **Music (Purple Theme):** Deep violet base (`#140d1e`) containing a rotating vinyl record outline overlay (`animation: rotateRecord 20s linear infinite`) and interactive bouncing equalizer pillars.
* **Movies & Shows (Blue Theme):** Midnight base (`#0d1424`) wrapping an overlaying film reel SVG shape and a vertical sweep scanline animation.
* **Books (Orange Theme):** Burnt orange base (`#1f140e`) nesting a 3D book cover illustration with turning pages (`animation: flipBookPage 5s ease-in-out infinite`).
* **Games (Pink Theme):** Deep plum base (`#220d1c`) showcasing game controller outlines and horizontal glitching scanlines.

---

## 5. Interaction Logic & State Management

### 5.1 Tab Switching Controls
Toggles visibility classes on active panels when sub-tab elements are clicked:
```javascript
function switchTab(tabId) {
  document.querySelectorAll('.tab-nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  
  document.getElementById('tab-' + tabId).classList.add('active');
  document.getElementById('panel-' + tabId).classList.add('active');
}
```

### 5.2 Flashlight Hover Effect
Monitors mouse pointer coordinates on cards, drawing radial gradient glows representing the category color:
```javascript
card.addEventListener('mousemove', e => {
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  aura.style.background = `radial-gradient(150px circle at ${x}px ${y}px, ${glowColor}, transparent 80%)`;
});
```
