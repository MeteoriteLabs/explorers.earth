# Design System Migration Plan

**Version:** 1.0  
**Status:** 🔬 Approved Roadmap  
**Target:** Gradual alignment with design system standards without breaking platform stability  

---

## 1. Priority Matrix

| Priority | Category | Task | Impact / Benefit |
|---|---|---|---|
| **🔴 P0** | Accessibility | Restore keyboard outlines (`* { outline: none !important }` removal) | Compliance & standard navigation usability |
| **🔴 P0** | SSR Guard | Remove DOM querying (`document.querySelector`) inside `Button.tsx` render | SSR safety, hydration, and rendering speed |
| **🔴 P0** | Accessibility | Fix `NavButton` text label rendering in bottom navigation | Mobile navigation usability |
| **🟡 P1** | Component Unification | Merge `Accordian.tsx` and `accordion.tsx` into a single accordion | Code reuse, consistent dashboard/playlist style |
| **🟡 P1** | Component Unification | Unify `Switch.tsx` and `SwitchButton.tsx` toggles | Input accessibility, clean codebase |
| **🟡 P1** | Component Unification | Unify `OnboardingUsernameInput.tsx` and `UsernameInput.tsx` | Simplify username forms and validations |
| **🟢 P2** | Token Unification | Standardize interactive brand blue to `#3B82F6` across all views | Visual brand consistency |
| **🟢 P2** | Patterns | Standardize modal backdrop wraps and enforce Sonner hook checks | Unified toast alerts, clean modal styling |
| **🔵 P3** | Technical Debt | Refactor hardcoded sidebar margins (`256px`) in layout files | Cleaner styling rules |
| **🔵 P4** | Optimization | Clean up unused `Inter` font files and update the Poppins weight scale | Faster network loading speeds |

---

## 2. Low-Risk vs. High-Risk Division

### 🟢 Low-Risk Refactoring (Safe to implement in parallel)
*   **Token Definition Cleanups:** Centralizing CSS variables in `index.css` to unify the evergreen green scale.
*   **Asset Cleanups:** Removing unused font files (e.g. Inter) from Google Fonts imports.
*   **Toast Alert Fixes:** Auditing and replacing direct `sonner` imports with the `useToast` hook.
*   **Label Text fixes:** Rendering the label text inside `NavButton.tsx` without touching page routing logic.

### 🔴 High-Risk Refactoring (Requires isolated branches & testing)
*   **SSR Button Refactor:** Removing DOM queries from the button render method and passing the context via layout variables or props.
*   **Accordion and Switch Unification:** Replacing all lowercase accordion and SwitchButton instances. Requires testing playlists and settings tables.
*   **Modal Backdrop Refactoring:** Consolidating portal backdrops and animations. Requires checking form submissions and Maps focus locks.
*   **Keyboard Outline Restorations:** Removing the `* { outline: none !important }` reset and testing all interactive items for visible outlines.

---

## 3. Incremental Checklist Roadmap

### Phase 0: Accessibility and Server Safety (P0)
*   [ ] **P0.1: Keyboard Outline Restoration**
    *   Remove `* { outline: none !important }` from `index.css`.
    *   Apply `focus-visible:ring-2 focus-visible:ring-dashboard-accent` to `Button.tsx` and `input.tsx`.
*   [ ] **P0.2: SSR Render Fix in Buttons**
    *   Remove DOM selectors (`document.querySelector(".white-theme")`) from `Button.tsx`.
    *   Pass the theme context (`theme`) as a prop or fetch it from context.
*   [ ] **P0.3: Fix Mobile Nav Labels**
    *   Update `NavButton.tsx` to render the `text` label inside the button layout.

### Phase 1: Component Consolidation (P1)
*   [ ] **P1.1: Accordion Unification**
    *   Consolidate `Accordian.tsx` and `accordion.tsx` into a single component in `src/components/ui/accordion.tsx`.
    *   Replace all instances in playlists and dashboards with the unified component.
*   [ ] **P1.2: Switch Unification**
    *   Consolidate `Switch.tsx` and `SwitchButton.tsx` into a single component in `src/components/ui/switch.tsx` using a native checkbox.
    *   Replace all instances in settings panels and dashboard tables.
*   [ ] **P1.3: Username Input Unification**
    *   Consolidate `OnboardingUsernameInput.tsx` and `UsernameInput.tsx` into `src/components/ui/UsernameInput.tsx`.
    *   Support both dark and light modes via a unified `theme` prop.

### Phase 2: Design Token Alignment (P2)
*   [ ] **P2.1: Brand Blue standard**
    *   Update all instances of `#3498DB` to `#3B82F6` in the dashboard stylesheet.
    *   Verify accessible contrast on all buttons and tags.
*   [ ] **P2.2: Modal Backdrop Refactor**
    *   Create a reusable backdrop portal wrapper.
    *   Update `ConfirmationModal.tsx` and other modals to inherit from `Modal.tsx`.
*   [ ] **P2.3: Enforce useToast Hook**
    *   Audit components and replace direct `sonner` imports with the `useToast` hook.

### Phase 3: Layout and Assets Cleanup (P3 - P4)
*   [ ] **P3.1: Sidebar Offsets**
    *   Refactor hardcoded `256px` margins in `index.css` to use the `--sidebar-width` CSS variable.
*   [ ] **P4.1: Font Imports**
    *   Update Google Fonts import string to remove Inter and add Poppins weight `900`.
