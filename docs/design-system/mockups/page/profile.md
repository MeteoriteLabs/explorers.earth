# Profile Setup Mockup (Option A) — Design Specification

This document provides a detailed design specification for the **Profile Setup Mockup (Option A)** of `explorers.earth`. It acts as a framework-agnostic blueprint for implementing the profile settings layout in React/Tailwind.

---

## 1. Overview & Context
* **Mockup File:** [profile.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/profile.html)
* **Design Pattern:** Option A (Glassmorphic Accordion Tabs)
* **Target Interface:** Dynamic mobile profile setup interface enabling users to customize avatars, cover banners, bio fields, social links, and privacy settings in a unified, collapsable pane.
* **Layout Target:** Designed specifically for **Mobile Screens (375px)** using device framing, scaling to desktop views using width wrappers.
* **Supported Themes:** 
  * **Forest Green (🌲 Default):** Styled using forest backgrounds, dynamic gradients, and contrasting blue elements.
  * **Classic Dark (🖤 Dark):** Muted slate backgrounds and light blue accent details.

---

## 2. Visual Hierarchy & Layout Structure
1. **Mockup Shell Header:** External mockup control dashboard for theme/device mode switches. Excluded from runtime code.
2. **Backdrop Base:** Radial lighting overlays applied onto a dark background.
3. **Integrated Cover Image Card:** Interactive container containing the avatar image, edit actions, public status, and location labels.
4. **Tab Switcher Pill:** Segmented control button toggling between major configuration sections.
5. **Glassmorphic Accordion Card:** Container grouping setting modules into collapsible sections.
6. **Save Action Button:** Full-width primary action button pinning changes.

---

## 3. Design Tokens & Color Palettes
The profile interface uses dynamic styling variables mapping to the design system:

### Theme Colors Reference Table

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Application backdrop |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Card background & secondary elements |
| `--dash-muted` | `#3C4E40` | `#222A3B` | Interactive hover backgrounds & input fields |
| `--dash-border` | `#3C4E40` | `#283147` | Layout borders |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Active buttons, focus indicators, highlight lines |
| `--blue-cta` | `#3B82F6` | `#3B82F6` | Save button normal state (interactive blue) |
| `--blue-final` | `#2563EB` | `#2563EB` | Save button hover state (final interactive dark blue) |
| `--dash-map-banner` | `linear-gradient(135deg, #1a2c1e, #0f1a10)` | `linear-gradient(135deg, #1e293b, #0f172a)` | Profile header map graphics backdrop |

---

## 4. Detailed Component Specifications

### 4.1 Page Backdrop Base
* **Gradient Style:** Overlaying radial glows onto a base linear-gradient background:
  ```css
  background: radial-gradient(circle at 80% 20%, rgba(59,130,246,0.12) 0%, transparent 60%),
              radial-gradient(circle at 20% 80%, rgba(74,222,128,0.08) 0%, transparent 60%),
              linear-gradient(135deg, var(--dash-sidebar-bg), var(--dash-bg));
  ```
* **Padding:** `0.75rem` overall spacing around content elements.

### 4.2 Integrated Cover Image Card
A unified graphic element housing the profile's media assets and credentials.
* **Cover Dimensions:** `height: 200px`, relative positioning, overflow hidden, border-radius `14px`, margin-bottom `0.75rem`.
* **Cover Gradient Background:** Gradated lighting overlay to darken media backgrounds:
  ```css
  background: linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.7) 90%), var(--dash-map-banner);
  ```
* **Navigation Overlay Button (Top-Right):**
  - Consists of an external link button inline with a hoverable tooltip box.
  - **Tooltip:** Positioned left of button (`opacity: 0`, `transform: translateY(3px)`, transition `all 0.2s`). On wrapper hover, opacity transitions to `1` and shifts to `translateY(0)`. Text reads "Navigate to Public Profile" (`font-size: 0.55rem`, color: `#cbd5e1`, background: `rgba(13,15,18,0.9)`, backdrop blur: `6px`, border: `1px solid rgba(255,255,255,0.1)`, padding: `0.25rem 0.5rem`).
  - **Button Link:** Translucent circle (`width: 26px`, `height: 26px`, background: `rgba(0,0,0,0.45)`, border: `1px solid rgba(255,255,255,0.15)`, border-radius `7px`, centering an external link SVG icon).
* **Avatar Graphic Container:**
  - Position: Centered, relative container, `z-index: 12`, margin-bottom `0.5rem`.
  - **Avatar Shape:** Circular (`width: 84px`, `height: 84px`, `border-radius: 50%`, border `3px solid var(--dash-sidebar-bg)`). Background image fetched from user media assets.
  - **Edit Badge (Pencil Icon):** Absolute positioned bottom-right overlay (`width: 24px`, `height: 24px`, background: `var(--dash-accent)`, border: `2px solid var(--dash-sidebar-bg)`, border-radius `50%`, flex centering an SVG edit pencil).
* **User Information Labels:**
  - **Display Name:** Centered text "Shivanshu Singh" (`font-size: 1.05rem`, `font-weight: 800`, text-shadow: `0 2px 4px rgba(0,0,0,0.6)`).
  - **Location Subtitle:** Centered text "Lucknow, India" (`font-size: 0.62rem`, color: `rgba(255,255,255,0.75)`, text-shadow: `0 1px 2px rgba(0,0,0,0.6)`).
* **Edit Cover Button (Bottom-Right):**
  - Absolute positioned bottom `0.75rem`, right `0.75rem`, `z-index: 10`.
  - Shape: Circle (`width: 28px`, `height: 28px`, background: `var(--dash-accent)`, border-radius: `50%`, flex centering an SVG edit pencil).
* **Bottom Accent Border:**
  - Position: Absolute bottom `0`, left/right `0`.
  - Styling: Horizontal linear gradient (`height: 2px`, `background: linear-gradient(90deg, #4ade80, #3B82F6)`).

### 4.3 Segmented Tab Switcher Pill
* **Container:** Background: solid white, border-radius `24px`, padding `2px`, width fit-content, centered horizontally (`margin: 0 auto 0.75rem`).
* **Buttons:** Font size `0.7rem`, `font-weight: 600`, padding `0.3rem 0.85rem`, border-radius `20px`, border-free, background: solid white, text: black.
* **Active State:** Background switches to `var(--dash-accent)` and text switches to white.

### 4.4 Glassmorphic Accordion Card Wrapper
A parent wrapper container grouping settings drawers into a clean element:
* **Wrapper:** Border: `1px solid var(--dash-border)`, border-radius `16px`, padding `4px`, background `rgba(0, 0, 0, 0.15)`, margin-bottom `0.75rem`.
* **Card Style (Glassmorphism):** Apply `glass-card` styling variables:
  ```css
  background: rgba(255, 255, 255, 0.05) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  ```

#### Drawer 1: Bio (Expanded by Default)
* **Trigger Element:** Full-width header trigger (`acc-trigger`) with text "Bio" and chevron label (`▼` / `▲`).
* **Content:** Flex-column listing input elements:
  - **Inputs Layout:** Form field container (`margin-bottom: 0.75rem`).
  - **Labels:** Text size `0.65rem`, color `rgba(255, 255, 255, 0.55)`, display: block.
  - **Inputs:** Class `mini-input` (`width: 100%`, background `rgba(255,255,255,0.06)`, border `1px solid var(--dash-border)`, border-radius `10px`, padding `0.4rem 0.75rem`, text size `0.72rem`, color: white).
  - *Values Captured:* Display Name (`Shivanshu Singh`), Bio (`Travel curator & foodie based in India 🌍`), Location (`Lucknow, India`).

#### Drawer 2: Social Links (Collapsed by Default)
* **Trigger Element:** Accordion button trigger toggling view.
* **Content:** Vertical layout grouping media profile links:
  - **Social Row Container:** Flex row, `gap: 0.5rem`, background `rgba(255,255,255,0.05)`, border-radius `10px`, padding `0.4rem 0.6rem`, margin-bottom `0.35rem`.
  - **Icon Element:** Centered graphic container (`width: 24px`, `height: 24px`, border-radius `6px`, vertical centering) containing custom background colors to represent platforms:
    - Instagram: Brand red/pink (`#e1306c`)
    - Twitter: Twitter blue (`#1DA1F2`)
    - Spotify: Spotify green (`#1DB954`)
  - **URL Metadata:** URL text string (`font-size: 0.62rem`, color `rgba(255, 255, 255, 0.4)`, flex: 1).

#### Drawer 3: Feed (Collapsed by Default)
* **Trigger Element:** Accordion button trigger toggling view.
* **Content:** Vertical settings row container toggling dashboard features.
  - **Row Layout:** Flex alignment (`display: flex`, `justify-content: space-between`, `align-items: center`, padding `0.5rem 0`, border-bottom `1px solid rgba(255,255,255,0.05)`). Last row hides border.
  - **Setting Info Columns:** Vertical stack:
    - Headline: Setting name (`font-size: 0.72rem`, `font-weight: 500`, color: `#e2e8f0`).
    - Description: Subtext details (`font-size: 0.58rem`, color `rgba(255,255,255,0.45)`, margin-top `0.1rem`).
  - **Interactive Toggle Switch:**
    - Container class `mini-switch` (`width: 36px`, `height: 20px`, border-radius `99px`, relative, background: `var(--dash-accent)`, transition properties).
    - Slider Knob: Absolute circle overlay (`width: 14px`, `height: 14px`, border-radius `50%`, background: solid white, top `3px`, left `3px`, transition transform).
    - **Active (On) Switch State:** Knob shifts right (`transform: translateX(16px)`), background stays `--dash-accent`.
    - **Inactive (Off) Switch State (`off`):** Knob shifts left (`transform: translateX(0)`), background changes to `--dash-muted` (`background: var(--dash-muted)`).

### 4.5 Save Action Button
* **Styling Class:** `dash-blue-btn` (`width: 100%`, border-free, background `var(--blue-cta)`, text: white, padding `0.65rem`, border-radius `10px`, `font-weight: 600`, font size `0.75rem`).
* **Transitions:** Smooth transition to hover color `var(--blue-final)` (`#2563EB`).

---

## 5. State Management & Interactive Logic
The mockup implements basic client-side JavaScript event listeners to demonstrate interactive behaviors:

### 5.1 Segmented Control Pill Toggling
Monitors clicks on tab selector pills, resetting other buttons and toggling the active visual state class.

### 5.2 Accordion Drawer Opening
Toggles block visibility of content panels when accordion header buttons are pressed:
```javascript
trigger.addEventListener('click', () => {
  const content = item.querySelector('.acc-content');
  const chevron = trigger.querySelector('.chevron');
  if (content.style.display === 'block') {
    content.style.display = 'none';
    chevron.textContent = '▼';
  } else {
    content.style.display = 'block';
    chevron.textContent = '▲';
  }
});
```

### 5.3 Switch Action Handlers
Toggles the `.off` class on the slider container to update the status background and position the slider knob.
```javascript
switchButton.addEventListener('click', () => {
  switchButton.classList.toggle('off');
});
```
