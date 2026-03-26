---
Feature: games
Doc type: UI/UX Implementation Guide
Status: active
Created: 2026-03-26
Last updated: 2026-03-26
---

# UI/UX Implementation Guide - Games Feature

This document serves as the "Source of Truth" for the visual and interactive implementation of the Games feature. Following these standards ensures 90%+ accuracy and reduces the need for manual UI fixes.

> [!IMPORTANT]
> This guide is identical to the Books and Movies & Shows UI guides. All three categories use exactly the same CSS variables, component standards, and layout rules.

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

### Hero Sections (Top Picks)
- **Clickability**: The entire Hero card MUST be clickable to open details (`onGameClick`).
- **Management Mode**: When in the dashboard/management view, the "See Details" button should be replaced with a **"Manage Top Picks"** button using `bg-dashboard-accent`.
- **Layout**: Portrait aspect ratio for game covers (same as book covers and movie posters).

### Cards (List Cards)
- **Click anywhere**: The entire card must have `cursor-pointer` and an `onClick` that navigates to the list detail.
- **Hover effects**: Use `whileHover={{ y: -2 }}` (Framer Motion) and border color shifts (`hover:border-white/15`).

### Platform Chips
- Display platform names as compact, truncated chips
- Max 3 platforms shown in cards; full list in detail modal
- Overflow: show "+N more" indicator if there are more than 3

---

## 4. Game-Specific UI Notes

### Cover Art Aspect Ratio
- Game covers from IGDB are **portrait (3:4 ratio)**, same as book covers and movie posters
- Use `aspect-[3/4]` or equivalent on cover containers
- Use `object-cover` for image fill

### Rating Display
- **IGDB rating** (0-100 scale): Divide by 10 and show as "8.7" with a star icon
- **User rating** (1-10): Show as filled/empty stars consistent with Movies & Shows
- Prefer `user_rating` badge display in compact cards; show both in detail modal
- Badge style: semi-transparent dark pill, bottom-right of cover

### Platform Display in Cards
```tsx
// Compact platform list in cover cards
const displayPlatforms = platforms.slice(0, 3);
const remaining = platforms.length - 3;

{displayPlatforms.map(p => (
  <span key={p.id} className="platform-chip">{shortenPlatform(p.name)}</span>
))}
{remaining > 0 && <span className="platform-chip">+{remaining}</span>}
```

Platform name shortening helper:
```typescript
export function shortenPlatform(name: string): string {
  const shorthands: Record<string, string> = {
    'PC (Microsoft Windows)': 'PC',
    'PlayStation 5': 'PS5',
    'PlayStation 4': 'PS4',
    'PlayStation 3': 'PS3',
    'Xbox Series X|S': 'Xbox SX',
    'Xbox One': 'Xbox One',
    'Nintendo Switch': 'Switch',
    'iOS': 'iOS',
    'Android': 'Android',
    'Mac': 'Mac',
    'Linux': 'Linux',
  };
  return shorthands[name] ?? name.replace('(Microsoft Windows)', '').trim();
}
```

---

## 5. Manual Fixes Checklist (Avoid these in future)
1. **Yellow Overrides**: Avoid `bg-amber-x` or `text-amber-x` for primary actions. Always use the blue `dashboard-accent`.
2. **Hidden Buttons**: Check the mobile view to ensure "Save/Cancel" buttons aren't hidden behind the floating nav.
3. **Draft States**: Ensure the "Draft" state is visually distinct (e.g., lower opacity or neutral colors) until published.
4. **Z-Index**: Ensure the "Saved" toast or modal backdrops don't flicker behind the header.
5. **Platform overflow**: Always handle the case where a game has 10+ platforms (show "+N more" chip).

---

## 6. Visual Polish
- Use `backdrop-blur-sm` for modal backdrops.
- Use `framer-motion` for all transitions (scale, opacity).
- Icons: Standardize on `lucide-react` with a size of `16` or `18` for buttons, `24` for headers.
- Game icon suggestion: `Gamepad2` from `lucide-react` for the category icon in sidebar/cards.
