---
Feature: Products
Doc type: UI/UX Implementation Guide
Status: active
Created: 2026-07-02
Last updated: 2026-07-02
---

# UI/UX Implementation Guide - Products Feature

This document serves as the "Source of Truth" for the visual and interactive implementation of the Products feature. Following these standards ensures 90%+ accuracy and reduces the need for manual UI fixes.

## 1. Design System & Variables

All dashboard components MUST follow the `.dashboard-theme` and use standard CSS variables.

### Key CSS Variables
- **Brand Accent (Blue)**: `var(--dash-accent)` (Standard blue used across the dashboard).
- **Backgrounds**:
  - Main Dashboard: `var(--dash-bg)`
  - Sidebar/Cards: `var(--dash-sidebar)`
  - Muted Elements: `var(--dash-muted)`
- **Text**:
  - Primary: `var(--dash-text)`
  - Muted: `var(--dash-text-muted)`

### Standard Button Classes
| Action Type | Tailwind Classes | Notes |
| :--- | :--- | :--- |
| **Primary Action** | `bg-dashboard-accent hover:opacity-90 text-white font-medium shadow-lg shadow-blue-900/30 transition-all` | Use for "Save", "Add", "Create". |
| **Secondary/Cancel**| `bg-dashboard-muted hover:bg-white/10 text-white/70 transition-colors` | Use for "Cancel" or "Back". |
| **Destructive** | `bg-red-500 hover:bg-red-600 text-white` | Only for final "Delete" actions in modals. |

---

## 2. Layout & Positioning Constraints

### Footer Overlap Prevention (Critical)
The dashboard uses a fixed bottom navigation on mobile. Content at the bottom of pages is often hidden behind it.
- **Rule**: All "Add/Edit" pages and long forms MUST have a bottom padding of at least `pb-32` (or `pb-40` for safe measure) on the main container.
- **Example**: `<div className="max-w-2xl mx-auto px-6 pt-8 pb-40 md:pb-8">...</div>`

### Z-Index Hierarchy
To ensure correct layering of modals, navigation, and tooltips:
- **Fixed Nav/Header**: `z-50`
- **Modals/Overlays**: `z-[60]` (Always set higher than the nav).
- **Tooltips/Menus**: `z-70`

### Spacing & Grid
- **Page Container**: `max-w-4xl mx-auto px-6 pt-8 pb-24` (Mobile) / `md:p-6 md:pb-6` (Desktop).
- **Card Grid**: `grid grid-cols-1 md:grid-cols-2 gap-4`.

---

## 3. Interactive Component Standards

### Visibility Toggle (Switch)
Do NOT use static buttons or simple badges for "Published/Draft" status.
- **Standard**: Use the `Switch` component from `src/components/ui/Switch.tsx`.
- **Usage**:
  ```tsx
  <Switch 
    checked={list.visibility} 
    onChange={handleToggle} 
    label={list.visibility ? "Published" : "Draft"} 
  />
  ```

### Hero Sections (Top Products / Top Picks)
- **Clickability**: The entire Hero card MUST be clickable to open details (`onProductClick`).
- **Management Mode**: When in the dashboard/management view, the "See Details" button should be replaced with a **"Manage Top Products"** button using `bg-dashboard-accent`.
- **Layout**: Square or portrait aspect ratio for product images. If in management mode, ensure a prominent button is visible for the "Manage" action.

### Cards (List Cards)
- **Click anywhere**: The entire card must have `cursor-pointer` and an `onClick` that navigates to the list detail.
- **Hover effects**: Use `whileHover={{ y: -2 }}` (Framer Motion) and border color shifts (`hover:border-white/15`).

---

## 4. Manual Fixes Checklist (Avoid these in future)
1. **Yellow Overrides**: Avoid `bg-amber-x` or `text-amber-x` for primary actions. Always use the blue `dashboard-accent`.
2. **Hidden Buttons**: Check the mobile view to ensure "Save/Cancel" buttons aren't hidden behind the floating nav.
3. **Draft States**: Ensure the "Draft" state is visually distinct (e.g., lower opacity or neutral colors) until published.
4. **Z-Index**: Ensure the "Saved" toast or modal backdrops don't flicker behind the header.

---

## 5. Visual Polish
- Use `backdrop-blur-sm` for modal backdrops.
- Use `framer-motion` for all transitions (scale, opacity).
- Icons: Standardize on `lucide-react` with a size of `16` or `18` for buttons, `24` for headers.
- Product Images: Render product pictures inside a border with `overflow-hidden border border-white/10 shadow-sm`.
- Pricing & Affiliate: Display the price and currency in a high-visibility badge layout, e.g., `text-sm font-semibold text-dashboard-accent`.
