---
Feature: People
Doc type: UI/UX Implementation Guide
Status: active
Created: 2026-07-05
Last updated: 2026-07-05
---

# UI/UX Implementation Guide - People Feature

This document serves as the "Source of Truth" for the visual and interactive implementation of the People (Person Recommendations) feature. Following these standards ensures 90%+ accuracy and maintains design consistency across the explorers.earth dashboard and public profile pages.

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
- **Rule**: All "Add/Edit Person" pages and long forms MUST have a bottom padding of at least `pb-32` (or `pb-40` for safe measure) on the main container.
- **Example**: `<div className="max-w-2xl mx-auto px-6 pt-8 pb-40 md:pb-8">...</div>`

### Z-Index Hierarchy
To ensure correct layering of modals, navigation, and tooltips:
- **Fixed Nav/Header**: `z-50`
- **Modals/Overlays**: `z-[60]` (Always set higher than the nav).
- **Tooltips/Menus**: `z-70`

### Spacing & Grid
- **Page Container**: `max-w-4xl mx-auto px-6 pt-8 pb-24` (Mobile) / `md:p-6 md:pb-6` (Desktop).
- **Card Grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

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

### Profile Cards & Avatars
- **Avatars**: Circular shape (`rounded-full`), with a subtle border: `border border-white/10`. Hover state should zoom slightly: `group-hover:scale-105 transition-transform duration-300`.
- **Hover effects**: Use `whileHover={{ y: -2 }}` (Framer Motion) and border color shifts (`hover:border-white/15`).
- **Platform Badges**: Display platform-specific icons (Instagram, LinkedIn, X, GitHub) as small round badges overlapping the avatar bottom-right corner, or adjacent to the name.

### Hero Sections (Top People / Top Picks)
- **Clickability**: The entire Hero card MUST be clickable to open details (`onPersonClick`).
- **Management Mode**: When in the dashboard view, the "See Details" button should be replaced with a **"Manage Top Picks"** button using `bg-dashboard-accent`.
- **Layout**: Circular or rounded profile picture on the left, name/headline/social handles in the center, and creator endorsement on the right.

### List Cards
- **Click anywhere**: The entire card must have `cursor-pointer` and an `onClick` that navigates to the list detail page.

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
- Social Brands: Use SVGs or specialized icon mappings for external platforms (Instagram, LinkedIn, YouTube, X, GitHub) rather than generic link icons.
