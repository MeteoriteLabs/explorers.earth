# Design System Folder Architecture & Governance

**Version:** 1.0  
**Status:** 🔬 Governance Approved  
**Target:** Optimizing documentation for both human developers and AI coding agents  

---

## 📂 Proposed Folder Structure

This architecture groups the design system documents into modular, clear directories to keep rules distinct and prevent document bloat.

```text
docs/design-system/
├── 00-folder-architecture.md   # Index & Architecture (This file)
├── design.md                   # Brand philosophy & UX Principles
├── ai-agent-rules.md           # Instructions for AI coding assistants
│
├── tokens/
│   ├── brand-colors.md         #Approved HEX values and primitive scales
│   ├── semantic-colors.md      # Contextual colors (Dashboard green vs Public blue)
│   └── layout-tokens.md        # Spacing, radius, z-index, and typography sizes
│
├── foundations/
│   ├── typography.md           # Poppins/Inter font-face rules & typography scale
│   ├── layout-grid.md          # Breakpoints, page wrappers, and container scales
│   └── iconography.md          # SVGs, Lucide-react guidelines, and themed wrappers
│
├── components/
│   ├── buttons.md              # Standard Button and NavButton states
│   ├── inputs.md               # Base, password, username, phone, & currency inputs
│   ├── toggles.md              # Checkboxes and Toggle switches
│   └── badges.md               # Pills, tags, and status trackers
│
├── patterns/
│   ├── navigation.md           # Side navbars, sticky headers, and mobile bottom bars
│   ├── forms-validation.md     # Spacing standards, Yup integrations, and async verifiers
│   ├── state-overlays.md       # Loading, empty, and validation success states
│   └── list-managers.md        # Tables, paginators, and infinite scroll observers
│
├── examples-html/
│   ├── buttons.html            # Blueprints for primary/loading states
│   ├── inputs.html             # Blueprints for inputs with helper text
│   ├── cards.html              # Blueprints for image and gradient cards
│   ├── modals.html             # Blueprints for modals and confirmation alerts
│   └── lists.html              # Blueprints for grids and table items
│
├── decisions/
│   ├── ADR-001-brand-blue.md   # approved brand blue unification to #3B82F6
│   └── ADR-002-modal-portal.md # Standardization of modal dialog portaling
│
└── migration/
    ├── audit-report.md         # initial code audits and duplication tracking
    └── migration-plan.md       # Priority migration steps (P0 to P4)
```

---

## 📋 File & Folder Specifications

### Core Files

#### `docs/design-system/00-folder-architecture.md` (This file)
*   **Purpose:** Serves as the master index, navigation guide, and roadmap for the entire design system documentation.
*   **Owner:** Lead Frontend Architect.
*   **Dependencies:** None.
*   **Update Process:** Updated only when directories are refactored or new folders are introduced.
*   **AI Usage Expectations:** Read-Only. AI agents must load this file first to locate relevant tokens, components, or blueprints.

#### `docs/design-system/design.md`
*   **Purpose:** Explains the "One Brand, Two Expressions" philosophy (editorial public view vs. functional dashboard theme).
*   **Owner:** Lead Product Designer.
*   **Dependencies:** None.
*   **Update Process:** Updated during product design reviews.
*   **AI Usage Expectations:** Read-Only. Used by AI agents to match the color theme (light off-white vs. dark evergreen) depending on the feature's scope.

#### `docs/design-system/ai-agent-rules.md`
*   **Purpose:** Houses strict instructions for AI coding assistants to prevent style drift and enforce code consistency.
*   **Owner:** Lead Frontend Architect & Devops Team.
*   **Dependencies:** `design.md`, `tokens/`, and `examples-html/`.
*   **Update Process:** Updated when new component patterns are finalized.
*   **AI Usage Expectations:** Read-Only. **Must be appended to the system instructions** (e.g. `CLAUDE.md` / `instructions.md`) to guide code creation.

---

### `/tokens` (Primitive Scales)

#### `tokens/brand-colors.md`
*   **Purpose:** Houses primitive color palettes (Evergreen, Blue, Neutrals) in HEX format.
*   **Owner:** Lead Product Designer.
*   **Dependencies:** `src/index.css`.
*   **Update Process:** Modified only when brand colors are formally updated.
*   **AI Usage Expectations:** Read-Only. AI assistants must reference this file to select colors rather than hardcoding HEX values.

#### `tokens/semantic-colors.md`
*   **Purpose:** Maps primitive colors to semantic names (e.g., `--dash-accent`, `--public-bg-primary`) depending on active themes.
*   **Owner:** Frontend Architect.
*   **Dependencies:** `brand-colors.md`, `src/index.css`.
*   **Update Process:** Modified when semantic mappings change.
*   **AI Usage Expectations:** Read-Only. AI assistants must use semantic names instead of raw colors in component styling.

#### `tokens/layout-tokens.md`
*   **Purpose:** Defines spacing rules (4px base), border radiuses, z-index layers, and typography scales.
*   **Owner:** Frontend Architect.
*   **Dependencies:** `src/index.css`.
*   **Update Process:** Updated during layout redesigns.
*   **AI Usage Expectations:** Read-Only. Used to ensure dialog elements are layered within standard bounds (e.g. z-index layers).

---

### `/foundations` (Global Base Styles)

#### `foundations/typography.md`
*   **Purpose:** Specifies typography rules, including Poppins (primary) and Inter (fallback), weights, line heights, and styling helper classes.
*   **Owner:** Lead Product Designer.
*   **Dependencies:** `tokens/layout-tokens.md`.
*   **Update Process:** Modified during typography layout adjustments.
*   **AI Usage Expectations:** Read-Only. AI assistants must use these font sizes and weights to maintain readable hierarchy.

#### `foundations/layout-grid.md`
*   **Purpose:** Documents breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`), container widths, and page layout dimensions.
*   **Owner:** Frontend Architect.
*   **Dependencies:** `tokens/layout-tokens.md`.
*   **Update Process:** Modified when grid standards are updated.
*   **AI Usage Expectations:** Read-Only. AI assistants must use these breakpoints to build responsive layouts.

#### `foundations/iconography.md`
*   **Purpose:** Outlines guidelines for Lucide React icons, custom SVG files, and the `ThemedIcon` wrapper.
*   **Owner:** Product Designer.
*   **Dependencies:** `src/components/ui/ThemedIcon.tsx`.
*   **Update Process:** Updated when new SVG icons are added to the asset repository.
*   **AI Usage Expectations:** Read-Only. AI assistants must wrap SVGs with the standard `ThemedIcon` element.

---

### `/components` (Component Specifications)

#### `components/*.md` (e.g., `buttons.md`, `inputs.md`, `toggles.md`)
*   **Purpose:** Documents the design behavior, states, and accessibility rules for each component.
*   **Owner:** Lead Frontend Architect & QA Team.
*   **Dependencies:** `tokens/`, `foundations/`, and corresponding code assets.
*   **Update Process:** Updated when component behaviors are updated or new states are introduced.
*   **AI Usage Expectations:** Read-Only. AI assistants must check component rules to ensure they implement correct states and accessibility tags.

---

### `/patterns` (UX Patterns & Flow Workflows)

#### `patterns/*.md` (e.g., `navigation.md`, `forms-validation.md`)
*   **Purpose:** Documents page layouts, form flows, validation rules, and scroll list managers.
*   **Owner:** Product Designer & Frontend Architect.
*   **Dependencies:** `components/` and api client frameworks.
*   **Update Process:** Updated when visual patterns are updated or new query workflows are introduced.
*   **AI Usage Expectations:** Read-Only. AI assistants must follow these structural patterns when building page features.

---

### `/examples-html` (Canonical Reference Visuals)

#### `examples-html/*.html` (e.g., `buttons.html`, `modals.html`)
*   **Purpose:** Framework-agnostic HTML blueprints representing the code standards for key components.
*   **Owner:** Lead Frontend Architect.
*   **Dependencies:** `src/index.css`.
*   **Update Process:** Updated only when changes to visual markup are approved.
*   **AI Usage Expectations:** Read-Only. **CRITICAL:** AI assistants must copy these markup layouts when writing code to keep elements visually and semantically consistent.

---

### `/decisions` (Architectural Decisions Records)

#### `decisions/ADR-*.md`
*   **Purpose:** Records key technical and design decisions (e.g., standardizing the brand accent color on `#3B82F6`).
*   **Owner:** Architecture Board (PM, Tech Lead, Design Lead).
*   **Dependencies:** None.
*   **Update Process:** Static once approved. New decisions must write a new ADR file (incrementing the serial prefix).
*   **AI Usage Expectations:** Read-Only. Provides context on design decisions so AI assistants understand why specific patterns are used.

---

### `/migration` (Migration Guides & Checkers)

#### `migration/audit-report.md`
*   **Purpose:** Details technical debt, component duplication hotspots, and accessibility concerns.
*   **Owner:** Technical Lead.
*   **Dependencies:** `migration-plan.md`.
*   **Update Process:** Updated periodically during codebase audits.
*   **AI Usage Expectations:** Read-Write. AI assistants can write to this file to log technical debt discovered during code updates.

#### `migration/migration-plan.md`
*   **Purpose:** Coordinates the refactoring roadmap, tracking migration priorities from P0 (Critical) to P4 (Optimization).
*   **Owner:** Technical Lead & Project Manager.
*   **Dependencies:** `audit-report.md`.
*   **Update Process:** Updated during sprint planning as items are completed.
*   **AI Usage Expectations:** Read-Write. AI assistants read this to identify refactoring tasks, and update status checkboxes (`[ ]` to `[x]`) upon code updates.
