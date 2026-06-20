# Settings Mockup (Option D) — Design Specification

This document provides a detailed design specification for the **Settings Mockup (Option D)** of `explorers.earth`. It acts as a framework-agnostic blueprint for implementation in React/Tailwind.

---

## 1. Overview & Context
* **Mockup File:** [settings.html](file:///d:/Project/explorers.earth/docs/design-system/mockups/page/settings.html)
* **Design Pattern:** Option D (Command Palette Search style layout)
* **Target Interface:** Advanced mobile settings panel featuring dual Account and Billing tabs. Integrates flat lists, quick search palettes, connection badges, usage dashboard circles, subscription cards, and interactive cycle controls.
* **Layout Target:** Designed specifically for **Mobile Screens (375px)** using device wrappers, expanding into full-width centered views on desktop layouts.
* **Supported Themes:** 
  * **Forest Green (🌲 Default):** Styled using deep forest colors (`#2E4032`) and interactive blue controls.
  * **Classic Dark (🖤 Dark):** Slate base color structures (`#0F1419`) with bright blue accents.

---

## 2. Visual Hierarchy & Layout Structure
1. **Mockup Shell Header:** Static layout controls for preview modes (Device/Full) and theme switches. Excluded from runtime application code.
2. **Settings Header:** Sibling text heading and tab control pill toggling panes.
3. **Pane A: Account Settings:**
   - Command palette search bar.
   - Quick Access setting lists (Password, Language, Tab visibility).
   - Connected third-party accounts (Google).
   - Danger Zone actions.
4. **Pane B: Billing & Subscriptions (Initially Hidden):**
   - Usage Dashboard: Horizontal carousel showing circular usage status gauges.
   - Current Plan: Status card indicating billing metrics.
   - Browse Plans: Comparative tiered plan options with active yearly/monthly price toggles.

---

## 3. Design Tokens & Color Palettes
The interface maps styling attributes to the global design tokens variable list:

### Theme Colors Reference Table

| Token Variable | Forest Green (🌲 Default) | Classic Dark (🖤 Dark) | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `--dash-bg` | `#2E4032` | `#0F1419` | Main page background |
| `--dash-sidebar-bg` | `#223126` | `#161B26` | Menu container backdrops & secondary rows |
| `--dash-muted` | `#3C4E40` | `#222A3B` | Interactive hover highlights & input fields |
| `--dash-border` | `#3C4E40` | `#283147` | Grid and list separators |
| `--dash-accent` | `#3B82F6` | `#60A5FA` | Highlight lines, search borders, active pills |
| `--blue-cta` | `#3B82F6` | `#3B82F6` | Plan upgrade buttons normal state |
| `--blue-final` | `#2563EB` | `#2563EB` | Plan upgrade buttons hover state |
| `--dash-search-bg` | `#223126` | `#161B26` | Search input backdrop |

---

## 4. Detailed Component Specifications

### 4.1 Page Header Panel
* **Title Headline:** Standard text "Settings" (`font-size: 1.1rem`, `font-weight: 800`, color: white, margin-bottom `0.75rem`).
* **Segmented Tab Switcher (`tabs-pill`):**
  - Container: Background: solid white, border-radius `24px`, padding `2px`, width fit-content, centered horizontally (`margin: 0 auto 0.75rem`).
  - Buttons: Font size `0.7rem`, `font-weight: 600`, padding `0.3rem 0.85rem`, border-radius `20px`, border-free, background: solid white, text: black.
  - Active Tab State: Background: `var(--dash-accent)`, text: white.
  - Tabs: Account (Active by default), Billing.

### 4.2 Segment Headers (`sec-lbl`)
* **Styling Rules:** Small text uppercase labels (`font-size: 0.6rem`, `font-weight: 700`, letter-spacing `0.08em`, color `rgba(255,255,255,0.3)`).
* **Spacing:** Padding top `0.5rem`, margin-bottom `0.5rem`.

---

## 4.3 Account Tab Pane Components

### A. Command Palette Search Bar
* **Container:** Background `var(--dash-search-bg)`, border `1px solid var(--dash-accent)` (provides focus accent), border-radius `12px`, padding `0.5rem 0.75rem`, display flex, items centered, gap `0.5rem`, margin-bottom `0.75rem`.
* **Elements:** Left-aligned search SVG icon (colored to `--dash-accent`). Right-aligned placeholder text reading "Search settings…" (`font-size: 0.72rem`, color `rgba(255,255,255,0.4)`).

### B. Quick Access Menu Stack
* **Container Wrapper:** Background `--dash-sidebar-bg`, border `1px solid var(--dash-border)`, border-radius `12px`, overflow hidden, margin-bottom `0.5rem`.
* **Setting Option Row:**
  - Layout: Flex row, items centered, gap `0.5rem`, padding `0.6rem 0.75rem`, border-bottom `1px solid rgba(255,255,255,0.05)`, cursor pointer. Last row hides border.
  - **Left Icon:** Standard emoji (e.g. 🔒 Change Password, 🌐 Language, 👁️ Tab Visibility) set to `font-size: 0.85rem`.
  - **Middle Info Column:** Flex-1 width. Top text is title (`font-size: 0.73rem`, `font-weight: 600`, color: white). Bottom text is description details (`font-size: 0.6rem`, color `rgba(255,255,255,0.4)`).
  - **Right Chevron:** Small right arrow SVG (stroke `rgba(255,255,255,0.3)`).

### C. Connected Accounts Section
* **Row Design:** Single container (`background: var(--dash-sidebar-bg)`, border `1px solid var(--dash-border)`, border-radius `12px`, padding `0.6rem 0.75rem`, display flex, items centered, gap `0.5rem`, margin-bottom `0.5rem`).
* **Left Icon:** Link emoji 🔗.
* **Label:** Title text "Google Account" (`font-size: 0.73rem`, `font-weight: 600`, color: white, flex: 1).
* **Right Connection Badge:** Green status pill (`font-size: 0.6rem`, `font-weight: 700`, color: `#4ade80`, background: `rgba(74,222,128,0.1)`, padding `0.15rem 0.5rem`, border-radius `20px`).

### D. Danger Zone Section
* **Container Wrapper:** Warning background (`rgba(248,113,113,0.06)`), border `1px solid rgba(248,113,113,0.2)`, border-radius `12px`, overflow hidden.
* **Action Row:** Flex alignment, cursor pointer, padding `0.6rem 0.75rem`, border-bottom `1px solid rgba(248,113,113,0.1)`. Last row hides border.
* **Typography:** Left action label is red text (`font-size: 0.73rem`, color `#f87171`). Deactivate is standard weight, Delete is bold (`font-weight: 700`).
* **Icons:** Red chevron arrow SVG on the right.

---

## 4.4 Billing Tab Pane Components (initially hidden)

### A. Usage Dashboard Carousel
* **Container:** Horizontal flexbox alignment (`display: flex`, `gap: 0.4rem`, overflow-x auto, scroll-hide helper).
* **Usage Radial Gauge Card:**
  - Base Card Design: Glass card container (`padding: 0.6rem`, border-radius `14px`, border `1px solid rgba(255,255,255,0.08)`, flex layout, flex-direction column, gap `0.5rem`, min-width `105px`).
  - **Card Header Row:** Flex alignment, items centered, width 100%. Left side houses a platform-specific colored category icon (e.g. blue clock for Validity, cyan music note for Songs, green lightbulb for AI Guides). Right side houses the uppercase category label (`font-size: 0.5rem`, color `rgba(255,255,255,0.4)`).
  - **Card Data Row:** Flex alignment, items centered, gap `0.5rem`.
    - **SVG Progress Ring:** Relative positioning, width/height `36px`. Renders an outer tracking circle and an inner stroke progress line rotated `-90deg` (transforms math coordinate starting points to top position):
      ```html
      <svg width="36" height="36" style="transform:rotate(-90deg);">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3.2"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="[COLOR]" stroke-width="3.2" stroke-dasharray="88" stroke-dashoffset="[MATH_VAL]" stroke-linecap="round"/>
      </svg>
      ```
      *Sizing mathematics:* Radius 14 results in a circumference of `88` pixels (`2 * pi * 14`). The `stroke-dashoffset` controls progress visibility.
      - Center Text Label: Absolute centered overlay text (`font-size: 0.52rem`, `font-weight: 800`, color: white).
    - **Usage Info Column:** Vertical layout. Headline displays used metrics in bold text (`font-size: 0.85rem`). Subtext displays limit values (`font-size: 0.52rem`, color: `rgba(255,255,255,0.45)`).

#### Usage Card Items Details

| Card Type | Icon Color | Progress Ring Color | Ring Math | Center text | Used Info Headline | Limit Info Subtext |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Validity** | Blue (`#3b82f6`) | Blue (`#3b82f6`) | Dashoffset: `20.2` (77% filled) | `77%` | `23d` | `Jul 4` |
| **Songs** | Cyan (`#06b6d4`) | Cyan (`#06b6d4`) | Dashoffset: `87.1` (1% filled) | `1%` | `1` (Limit: `/100`) | `reqs used` |
| **AI Guides**| Green (`#10b981`) | Green (`#10b981`) | Dashoffset: `88` (0% filled) | `0%` | `0` (Limit: `/5`) | `gen'd` |

### B. Current Plan Panel
* **Plan Card:** Glass card container (`padding: 0.8rem`, margin-bottom `0.5rem`).
* **Header Row:** Flex alignment, items centered. Left label: "Active Plan" (`font-size: 0.6rem`, uppercase). Right badge: "PRO" pill (`font-size: 0.55rem`, `font-weight: 800`, color: `#3B82F6`, background `rgba(59,130,246,0.15)`, padding `0.15rem 0.45rem`, border-radius `4px`).
* **Details Column:** Title "Pro Plan Subscription" (`font-size: 0.82rem`, `font-weight: 700`). Subtitle price metrics `$8.00 / month · Billed annually` (`font-size: 0.62rem`, color `rgba(255,255,255,0.45)`).
* **Auto-renewal Banner:** Green information banner (`font-size: 0.6rem`, color `#4ade80`, background `rgba(74,222,128,0.06)`, border `1px solid rgba(74,222,128,0.15)`, border-radius `8px`, padding `0.4rem 0.6rem`, display flex, items centered, gap `0.35rem`). Text: "✓ Renews automatically on January 15, 2027".

### C. Browse Plans Panel
* **Cycle Billing Switcher Pill:** Segmented control button stack toggling cycle models between "Yearly" and "Monthly".
* **Plan Tiers Stack:**
  1. **Free Tier:** Glass card (`border: 1px solid rgba(255,255,255,0.05)`, padding `0.75rem`). Left details show title "Free" (`font-size: 0.78rem`, bold) inline with price "$0/mo", and description details. Right button displays "Downgrade" (gray border style).
  2. **Pro Tier (Active):** High-contrast highlight card (`border: 2px solid var(--dash-accent)`, relative overflow). Top-right corner displays a solid blue "Current" indicator. Left details show title "Pro" inline with dynamic price variable (`$8/mo*` or `$10/mo`). Right label displays "Active Plan" in a blue highlight box.
  3. **Agency Tier:** Glass card layout. Left details show title "Agency" inline with dynamic price variable (`$29/mo` or `$35/mo`). Right button displays "Upgrade" in a solid blue CTA button layout.
* **Price Footnote:** Text footer (`font-size: 0.55rem`, color `rgba(255,255,255,0.35)`, text-align: center) reading dynamic cycle comments.

---

## 5. State Management & Interactive Logic
The mockup implements basic client-side JavaScript handlers to demonstrate interactive behaviors:

### 5.1 Settings Pane Switcher (`switchSettingsTab`)
Hides or displays the target panels based on selection, updating the tab pill button active styles.
```javascript
window.switchSettingsTab = function(btn, tabName) {
  if (tabName === 'account') {
    accountPane.style.display = 'block';
    billingPane.style.display = 'none';
  } else {
    accountPane.style.display = 'none';
    billingPane.style.display = 'flex';
  }
}
```

### 5.2 Cycle Pricing Switcher (`switchPlanBillingCycle`)
Switches the text price indicators and footnote details in the browse list based on yearly vs monthly cycle selections:

| Cycle | Pro Price Label | Agency Price Label | Footnote Comment |
| :--- | :--- | :--- | :--- |
| **Yearly** | `$8/mo*` | `$29/mo` | `* Pro is billed annually. Prices exclude local taxes.` |
| **Monthly** | `$10/mo` | `$35/mo` | `Prices exclude local taxes.` |
