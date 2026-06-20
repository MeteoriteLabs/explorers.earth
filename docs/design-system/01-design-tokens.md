# Design Tokens — explorers.earth
**Version:** 1.0 (Extraction Draft)
**Status:** 🔬 Extracted from codebase · Pending formal approval
**Brand Philosophy:** One brand, two expressions · Curated/Personal + Grounded/Aspirational
**Reference:** Airbnb (premium editorial quality that feels human)

---

> **How to read this document**
> Each token section contains:
> - **Current Implementation** — what exists in the codebase today
> - **Appears In** — where this value is used
> - **Problems Found** — inconsistencies, drift, or risks
> - **Recommended Standard** — the normalized token to adopt
> - **Migration Impact** — effort required to adopt (🟢 Low · 🟡 Medium · 🔴 High)

---

## 1. Brand Colors (Primitive Palette)

*Raw color values. Never used directly in components — only referenced by semantic tokens.*

### 1.1 Evergreen Scale — The Brand Anchor

The brand's nature identity. Forest green signals trustworthiness, groundedness, and the natural world.

| Token Name | Value | Notes |
|---|---|---|
| `--color-evergreen-900` | `#1B3B1A` | `hsl(107 48% 16%)` — deepest brand anchor |
| `--color-evergreen-700` | `#2E4032` | Dashboard primary background |
| `--color-evergreen-600` | `#223126` | Sidebar / elevated surfaces |
| `--color-evergreen-500` | `#375C3B` | `hsl(107 35% 26%)` — landing hover state |
| `--color-evergreen-400` | `#3C4E40` | Muted fills, inactive tabs, borders |

**Current Implementation:**
```css
/* In :root */
--evergreen: 107 48% 16%;
--light-evergreen: 107 35% 26%;

/* In .dashboard-theme */
--dash-bg: #2E4032;
--dash-sidebar-bg: #223126;
--dash-muted: #3C4E40;
```

**Appears In:** `index.css` (`:root`, `.dashboard-theme`), `Sidenav.tsx`, `Header.tsx`, `Modal.tsx`

**Problems Found:**
- 🔴 Values exist in TWO systems: the `:root` HSL system AND the `.dashboard-theme` hex system. Same color defined twice, inconsistently.
- 🟡 `#2E4032` (dashboard bg) has no corresponding `:root` variable — only inside `.dashboard-theme`.
- 🟡 No named scale exists; values are scattered as ad-hoc hex codes.

**Recommended Standard:** Adopt a unified primitive scale using CSS hex values. HSL representations in `:root` should reference the primitives.

**Migration Impact:** 🟡 Medium — requires updating `.dashboard-theme` to reference primitive tokens.

---

### 1.2 Blue Scale — The Interactive Color

The action/CTA identity. Two blues currently exist with a subtle but real difference.

| Token Name | Value | Source | Used For |
|---|---|---|---|
| `--color-blue-500` | `#3498DB` | Flat UI palette | Dashboard accent, interactive states |
| `--color-blue-600` | `#2980B9` | Flat UI hover | Dashboard interactive hover |
| `--color-blue-400` | `#60A5FA` | Tailwind blue-400 | Dark mode dashboard accent |
| `--color-blue-cta` | `#3B82F6` | Tailwind blue-500 | Public surface CTAs |
| `--color-blue-cta-hover` | `#2563EB` | Tailwind blue-600 | Public CTA hover |

**Current Implementation:**
```css
/* Dashboard */
--dash-accent: #3498DB;

/* Public surface (in :root) */
--blue-cta: 218 91% 60%;       /* #3B82F6 — Tailwind Blue-500 */
--blue-final: 221 83% 53%;     /* #2563EB — Tailwind Blue-600 */
--hover-blue: 214 88% 68%;     /* #60A5FA — Tailwind Blue-400 */
```

**Problems Found:**
- 🔴 **Two different blues as the "interactive color"**: `#3498DB` (dashboard) vs `#3B82F6` (public). Perceptibly different under the "one brand" model.
- 🟡 `--hover-blue` resolves to `#60A5FA` — same as `--dash-accent` in dark mode. Coincidental overlap, not intentional.

**Recommended Standard:** Unify to a single blue primitive scale:
```css
--color-blue-400: #60A5FA;   /* light/dark accessible variant */
--color-blue-500: #3B82F6;   /* PRIMARY — replace #3498DB */
--color-blue-600: #2563EB;   /* hover state */
--color-blue-700: #1D4ED8;   /* pressed state */
```

> **Approved Standard:** Unify to `#3B82F6` (Tailwind Blue-500) as the single brand blue. This replaces the Flat UI Blue `#3498DB` dashboard accent, achieving brand consistency across both public and dashboard expressions.


**Migration Impact:** 🟡 Medium — `--dash-accent` value change; requires visual QA.

---

### 1.3 Neutral Scale

| Token Name | Value | Notes |
|---|---|---|
| `--color-neutral-50` | `#F9F9F6` | Soft off-white, editorial backgrounds |
| `--color-neutral-100` | `#F3EFE5` | Warm beige, section backgrounds |
| `--color-neutral-200` | `#E3EEF1` | Cool mist, alternate sections |
| `--color-neutral-300` | `#F3F4F6` | Light gray, hover states |
| `--color-neutral-400` | `#D1D5DB` | Text light, muted UI |
| `--color-neutral-700` | `#374151` | Body text |
| `--color-neutral-800` | `#1F2937` | Charcoal — primary dark text |
| `--color-neutral-900` | `#1A1A1A` | Deep charcoal — maximum contrast |
| `--color-neutral-950` | `#0F1419` | Near black — dark mode bg |

**Current Implementation:**
```css
--soft-off-white: 60 14% 98%;    /* #F9F9F6 */
--warm-beige: 39 29% 94%;        /* #F3EFE5 */
--cool-mist: 195 28% 91%;        /* #E3EEF1 */
--light-gray: 214 32% 97%;       /* #F3F4F6 */
--charcoal: 220 13% 18%;         /* #1F2937 */
--deep-charcoal: 0 0% 10%;       /* #1A1A1A */
```

**Problems Found:**
- 🟡 Mix of warm and cool neutrals without a governing rule for which to use when.
- 🟢 Dark mode neutrals (`#0F1419`, `#1A1F2E`) are well-chosen.

**Migration Impact:** 🟢 Low — naming only, no value changes needed.

---

### 1.4 Status Colors

| Token Name | Value | Semantic Meaning |
|---|---|---|
| `--color-status-success` | `hsl(142 69% 58%)` | Published, success, green states |
| `--color-status-danger` | `#EF4444` | Draft, error, destructive |
| `--color-status-danger-hover` | `#DC2626` | Danger hover |
| `--color-status-warning` | `#F59E0B` | Amber — ratings, warnings |

**Problems Found:**
- 🔴 `--status-published` and `--status-draft` are defined identically in BOTH `:root` AND `.dashboard-theme`. Duplication.
- 🟡 No `warning` semantic token — amber is a raw color only.

**Migration Impact:** 🟢 Low — deduplicate to single `:root` definition.

---

## 2. Semantic Colors

### 2.1 Dashboard Surface

| Semantic Token | Value | Purpose |
|---|---|---|
| `--dash-bg` | `#2E4032` | Page background |
| `--dash-sidebar-bg` | `#223126` | Sidebar, modals, elevated surfaces |
| `--dash-muted` | `#3C4E40` | Inactive tabs, form backgrounds, chips |
| `--dash-border` | `#3C4E40` | All borders |
| `--dash-accent` | `#3498DB` → proposed `#3B82F6` | Interactive elements, active states |
| `--dash-text` | `#FFFFFF` | Primary text |
| `--dash-text-muted` | `rgba(255,255,255,0.5)` | Secondary text |
| `--dash-danger` | `#EF4444` | Error, delete, destructive |

**Dark Mode Overrides** (`.dashboard-theme-dark`):
| Token | Light | Dark |
|---|---|---|
| `--dash-bg` | `#2E4032` | `#0F1419` |
| `--dash-sidebar-bg` | `#223126` | `#1A1F2E` |
| `--dash-accent` | `#3498DB` | `#60A5FA` |
| `--dash-muted` | `#3C4E40` | `#1E293B` |
| `--dash-border` | `#3C4E40` | `#334155` |

**Problems Found:**
- 🟡 `--dash-border` and `--dash-muted` are identical (`#3C4E40`). No visual differentiation between "fill" and "border" at the token level.
- 🟡 `--dash-text-light` and `--dash-text` both resolve to `#FFFFFF` in the light dashboard theme.

---

### 2.2 Public Surface

| Semantic Token | Value | Purpose |
|---|---|---|
| `--public-bg-primary` | `#F9F9F6` | Page base background |
| `--public-bg-warm` | `#F3EFE5` | Editorial section backgrounds |
| `--public-bg-cool` | `#E3EEF1` | Alternate section backgrounds |
| `--public-text-primary` | `#1F2937` | Body text |
| `--public-cta` | `#3B82F6` | Primary CTAs |
| `--public-cta-hover` | `#2563EB` | CTA hover |
| `--public-brand` | `#1B3B1A` | Brand color, nav highlights |

**Problems Found:**
- 🔴 Public nav background `#2a2a2a` is a raw orphan hex in `PublicNav.tsx` — not related to any token.
- 🔴 Public surface has NO token system — all values are inline `hsl(var(--charcoal))` syntax.

---

## 3. Typography

### 3.1 Font Families

| Token | Value | Status |
|---|---|---|
| `--font-primary` | `'Poppins', system-ui, sans-serif` | ✅ Dominant — used everywhere |
| `--font-secondary` | `'Inter', system-ui, sans-serif` | ⚠️ Imported but essentially unused |

**Problems Found:**
- 🟡 Inter is imported (network cost) but near-zero usage found. Remove unless a use case is defined.
- 🟡 `font-family: Poppins` is set on `.dashboard-theme` but NOT on `body` — public surface inherits browser defaults unless explicitly set.

**Recommended:** Set `body { font-family: var(--font-primary); }` globally.
**Migration Impact:** 🟢 Low.

---

### 3.2 Type Scale

| Token | Size | Tailwind | Primary Usage |
|---|---|---|---|
| `--text-xs` | 12px | `text-xs` | Captions, tags, nav labels, subtext |
| `--text-sm` | 14px | `text-sm` | Body, form labels, list items, sidebar items |
| `--text-base` | 16px | `text-base` | Inputs, standard body |
| `--text-lg` | 18px | `text-lg` | Section headings, song titles |
| `--text-xl` | 20px | `text-xl` | Modal headings (= `--dash-heading-size`) |
| `--text-2xl` | 24px | `text-2xl` | Page headings, hero elements |
| `--text-3xl` | 30px | `text-3xl` | Large hero text (infrequent) |

**Dashboard Tokens (formalized):**
```css
--dash-heading-size:  20px;  --dash-heading-weight:  700;
--dash-label-size:    14px;  --dash-label-weight:    500;
--dash-input-size:    16px;  --dash-input-weight:    400;
--dash-subtext-size:  12px;  --dash-subtext-weight:  300; /* → fix to 400 */
--dash-button-size:   14px;  --dash-button-weight:   400; /* → fix to 600 */
```

**Problems Found:**
- 🔴 **Button weight is `400` (normal)** — same as body text. Interactive elements need `600` for affordance.
- 🟡 Public surface has no formal type scale.
- 🟡 `font-black` (900) used in Header.tsx but not imported from Google Fonts.

**Migration Impact:** 🟡 Medium — button weight change is visible across all dashboard buttons.

---

### 3.3 Font Weights

| Token | Weight | Tailwind | Used For |
|---|---|---|---|
| `--weight-regular` | 400 | `font-normal` | Body text, inputs |
| `--weight-medium` | 500 | `font-medium` | Labels, nav items |
| `--weight-semibold` | 600 | `font-semibold` | Buttons, strong labels |
| `--weight-bold` | 700 | `font-bold` | Headings |
| `--weight-black` | 900 | `font-black` | Hero/display text |

**Problems Found:**
- 🔴 Poppins 900 used but NOT in Google Fonts import string. Browser synthesizes it inconsistently.

**Fix:** Update import: `...Poppins:wght@400;500;600;700;900...`
**Migration Impact:** 🟢 Low.

---

### 3.4 Letter Spacing

| Token | Value | Usage |
|---|---|---|
| `--tracking-tighter` | `-0.02em` | Hero headings, overlay titles |
| `--tracking-normal` | `0` | Body text |
| `--tracking-wide` | `0.10em` | Uppercase form labels |

---

## 4. Spacing Scale

*4px base unit. The following values are actively used in the codebase:*

| Token | px | rem | Tailwind | Usage |
|---|---|---|---|---|
| `--space-1` | 4px | 0.25rem | `gap-1`, `p-1` | Tags, micro elements |
| `--space-1.5` | 6px | 0.375rem | `gap-1.5` | Icon+label pairs |
| `--space-2` | 8px | 0.5rem | `gap-2`, `p-2` | Small padding |
| `--space-2.5` | 10px | 0.625rem | `py-2.5` | Nav items, small buttons |
| `--space-3` | 12px | 0.75rem | `p-3`, `gap-3` | Card padding, inputs |
| `--space-4` | 16px | 1rem | `p-4`, `gap-4` | Standard padding |
| `--space-5` | 20px | 1.25rem | `p-5` | Modal sections |
| `--space-6` | 24px | 1.5rem | `p-6`, `gap-6` | Card grids, sections |
| `--space-8` | 32px | 2rem | `p-8` | Overlay sections |

**Fixed Layout Constants:**
| Token | Value | Usage |
|---|---|---|
| `--header-height-mobile` | `64px` | Mobile header, sticky top offset |
| `--header-height-desktop` | `54px` | Desktop header height |
| `--sidebar-width-expanded` | `256px` | Open sidebar width |
| `--sidebar-width-collapsed` | `64px` | Collapsed icon-only sidebar |

**Form Spacing Standards:**
```css
--form-field-gap:   8px;   /* label → input gap */
--form-group-gap:   16px;  /* between field groups */
--form-section-gap: 24px;  /* between form sections */
```

**Problems Found:**
- 🟡 `margin: 256px` hardcoded in `.dashboard-content` despite `--sidebar-width` CSS variable existing.
- 🟡 Form gaps vary 2px–24px across modals without a standard.

**Migration Impact:** 🟡 Medium.

---

## 5. Border Radius Scale

| Token | Value | Tailwind Approx | Usage |
|---|---|---|---|
| `--radius-xs` | 4px | `rounded` | Chips, badges, tight elements |
| `--radius-sm` | 8px | `rounded-lg` | Buttons, inputs, small surfaces |
| `--radius-md` | 12px | `rounded-xl` | Cards, panels, image containers |
| `--radius-lg` | 16px | `rounded-2xl` | Modals, bottom sheets |
| `--radius-xl` | 24px | `rounded-3xl` | Pill tabs, segmented controls |
| `--radius-full` | 9999px | `rounded-full` | Avatars, toggle thumbs, icon buttons |

**Current Dashboard Tokens:**
```css
--dash-radius-sm: 4px;
--dash-radius-md: 8px;
--dash-radius-lg: 14px;
```

**Problems Found:**
- 🔴 **`rounded-md` (Tailwind = 6px) ≠ `--dash-radius-md` (8px)**. The token and the utility class are misaligned by one Tailwind step. Components using `rounded-md` are actually using 6px, not the 8px the token specifies.
- 🟡 `--dash-radius-lg: 14px` is a non-standard value (not matching any Tailwind step).

**Recommended Standard:** Use explicit px values mapped to tokens above. Stop using Tailwind `rounded-*` class names to implement token values.

**Migration Impact:** 🟡 Medium — visual QA required.

---

## 6. Shadows & Elevation

| Token | Value | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.12)` | Barely lifted elements |
| `--shadow-sm` | `0 4px 6px -1px rgba(0,0,0,0.15), 0 2px 4px -1px rgba(0,0,0,0.10)` | Standard cards |
| `--shadow-md` | `0 4px 16px -4px rgba(0,0,0,0.40), 0 2px 6px -2px rgba(0,0,0,0.30)` | Elevated panels, dropdowns |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.40), 0 4px 6px -2px rgba(0,0,0,0.30)` | Card hover state |
| `--shadow-focus` | `0 0 0 3px rgba(59,130,246,0.20)` | Input focus ring |
| `--shadow-glow` | `0 4px 16px rgba(0,0,0,0.30), 0 0 20px rgba(59,130,246,0.50)` | Accent CTA glow |

**Currently:** Only `shadow-dashboard-elevated` is tokenized (= `--shadow-md`). Everything else is inline.

**Problems Found:**
- 🔴 All shadows except one are hardcoded inline — scattered across Profile.tsx, Favorites.tsx, index.css.
- 🟡 Focus shadow uses `#3498DB` (dashboard blue) in some places, `rgba(59,130,246)` (public blue) in others.

**Migration Impact:** 🔴 High — systematic find-and-replace required.

---

## 7. Z-Index Hierarchy

| Token | Value | Layer | Used For |
|---|---|---|---|
| `--z-base` | 0 | Document flow | Normal elements |
| `--z-raised` | 1 | Raised | EarthLoader internals |
| `--z-card` | 10 | Card | Card overlays |
| `--z-sticky` | 40 | Sticky | Sidebar (Tailwind `z-40`) |
| `--z-fixed` | 50 | Fixed | Bottom navbars |
| `--z-header` | 100 | Header | Dashboard header |
| `--z-dropdown` | 110 | Dropdown | Menus, tooltips |
| `--z-overlay` | 200 | Overlay | Add-place overlay backdrop |
| `--z-modal` | 9999 | Modal | Portal modals, Google Maps autocomplete |
| `--z-critical` | 10000 | Critical | TipTap editor, rich text overlays |

> **Rule:** Nothing above `10000`. If you need to beat 10000, fix the stacking context instead.

**Problems Found:**
- 🔴 Values 10001–10004 are inline in `Profile.tsx` — escalating z-index battles, an anti-pattern.
- 🔴 `z-index: 10002 !important` in `index.css` for Google Maps — not tokenized.

**Migration Impact:** 🔴 High — Profile.tsx requires stacking context refactor.

---

## 8. Motion & Animation

### 8.1 Duration Tokens

| Token | Value | Usage |
|---|---|---|
| `--duration-instant` | 100ms | Button tap |
| `--duration-fast` | 160ms | Micro-interactions (`--dash-transition`) |
| `--duration-normal` | 200ms | Most hovers, `transition-colors` |
| `--duration-moderate` | 300ms | Sidebar, layout transitions |
| `--duration-slow` | 500ms | Page entry animations |
| `--duration-ambient` | 1800ms | Skeleton shimmer |
| `--duration-hero` | 6000–15000ms | Float, gradient shift |

**Problems Found:**
- 🔴 No duration tokens exist. All values are inline magic numbers.
- 🟡 Two spring stiffness values (120, 200) used with no documented rationale.

### 8.2 Easing Tokens

| Token | Value | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Layout transitions (Material standard) |
| `--ease-out` | `ease-out` | Hover/focus transitions |
| `--ease-in-out` | `ease-in-out` | Ambient animations |
| `--ease-linear` | `linear` | Scroll ticker, continuous motion |

**Framer Motion Presets (document in constants file):**
```tsx
export const SPRING_GENTLE = { type: "spring", stiffness: 120, damping: 14 };  // Icon hovers
export const SPRING_SNAPPY = { type: "spring", stiffness: 200, damping: 18 };  // Card scale
export const FADE_DROPDOWN = { duration: 0.2, ease: "easeOut" };               // Menus
```

**Migration Impact:** 🟡 Medium — CSS easy to replace; Framer needs a constants file.

---

## 9. Breakpoints

| Token | Value | Tailwind | Key Behavior |
|---|---|---|---|
| `--bp-sm` | 640px | `sm:` | Form layout changes, timeline adjustments |
| `--bp-md` | 768px | `md:` | **Primary hinge** — sidebar, header height, card grids |
| `--bp-lg` | 1024px | `lg:` | Wide layouts, overlay content width |
| `--bp-xl` | 1280px | `xl:` | (Rarely used) |

**Migration Impact:** 🟢 Low — Tailwind breakpoints are consistent.

---

## 10. Container Widths

| Token | Value | Usage |
|---|---|---|
| `--container-xs` | 360px | Minimum modal width |
| `--container-sm` | 520px | Narrow overlay content |
| `--container-md` | 640px | Standard overlay content |
| `--container-lg` | 760px | Wide overlay content |
| `--container-xl` | 800px | Maximum modal width |
| `--container-page` | 1280px | Page content max-width |

**Migration Impact:** 🟢 Low — document as standard.

---

## Priority Migration Queue

| Priority | Category | Issue | Impact |
|---|---|---|---|
| 🔴 P0 | Accessibility | `* { outline: none !important }` removes ALL browser focus rings | A11y regression |
| 🔴 P0 | Z-Index | Inline z-index 10001–10004 in Profile.tsx — escalation pattern | Maintainability |
| 🔴 P0 | Shadows | All box-shadows inline; only one tokenized | Consistency |
| 🔴 P1 | Blue Accent | Two different blues: `#3498DB` (dash) vs `#3B82F6` (public) | Brand coherence |
| 🔴 P1 | Button Weight | `--dash-button-weight: 400` — buttons look like body text | UX clarity |
| 🟡 P2 | Font Import | Poppins 900 used but not imported; Inter imported but unused | Performance |
| 🟡 P2 | Color Duplication | `--status-published/draft` defined in two places | Maintainability |
| 🟡 P2 | Motion | All durations are inline magic numbers — AI agent drift risk | Governance |
| 🟡 P3 | Border Radius | Tailwind class / token mismatch (`rounded-md` ≠ `--dash-radius-md`) | Consistency |
| 🟡 P3 | Sidebar Width | `margin: 256px` hardcoded despite `--sidebar-width` var existing | Token adoption |
| 🟢 P4 | Typography | Public surface has no formal type scale | Documentation |
| 🟢 P4 | Container | No shared container width tokens | Documentation |

---

*Next: `02-component-inventory.md` — Component catalog with variant semantics and usage guidance.*
*Next: `03-ai-agent-governance.md` — CLAUDE.md design extension and component authoring rules.*
