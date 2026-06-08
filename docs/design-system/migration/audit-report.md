# Design System Audit Report

**Version:** 1.0  
**Status:** 🔬 Complete Audit  
**Code Base Scanned:** `src/` (explorers-earth)  

---

## 1. Design System Compliance Score: 54% (Grade: D+)

| Category | Score | Primary Reason for Score |
|---|---|---|
| **Typography** | 70% | Fonts imported correctly, but body text defaults are missing on public pages. |
| **Colors** | 55% | Mixed HSL/HEX variables and multiple action blues (`#3498DB` vs `#3B82F6`). |
| **Spacing & Grid** | 60% | Form gaps are inconsistent; hardcoded sidebar offsets bypass CSS variables. |
| **Component Reuse** | 45% | Duplicated accordions, switches, username inputs, and modal portals. |
| **Accessibility (A11y)** | 35% | Global `* { outline: none !important }` reset hides all keyboard focus outlines. |
| **Interaction Patterns** | 60% | Mixed Sonner hook usage and different vertical/horizontal mobile modal scroll layouts. |

*   **Overall Average:** **54%** — The codebase is functional but has significant styling inconsistency and technical debt.

---

## 2. Duplicate Components

We identified the following major component duplication areas:

### 2.1 Accordions
*   `src/components/ui/Accordian.tsx` (Uppercase & typo): Self-contained dashboard accordion utilizing Framer Motion with scroll-to-bottom capabilities.
*   `src/components/ui/accordion.tsx` (Lowercase): Composable accordion list (`AccordionItem`, `AccordionTrigger`, `AccordionContent`) using React Context but hardcoding custom black/gray themes.

### 2.2 Toggle Switches
*   `src/components/ui/Switch.tsx`: Clickable div/button container displaying switch tracks with optional loading states.
*   `src/components/ui/SwitchButton.tsx`: Memoized label/checkbox input that checks theme classes in the DOM context.

### 2.3 Username Inputs
*   `src/components/ui/UsernameInput.tsx`: Formik field containing live query validation checks and suggestions.
*   `src/components/ui/OnboardingUsernameInput.tsx`: Custom username field duplicating `UsernameInput.tsx` logic but hardcoding dashboard style sheets.

### 2.4 Modal Backdrops
*   Custom portals (`Modal.tsx`, `ConfirmationModal.tsx`, `UnsavedChangesModal.tsx`, `LanguageModal.tsx`) re-implement their own backdrop containers, click handlers, and transition animations rather than sharing a standard wrapper.

---

## 3. Duplicate Tokens

*   **Brand Interactive Blue:** Both `#3498DB` (dashboard color) and `#3B82F6` (public CTA) serve as action brand colors, causing perceptible UI differences.
*   **Evergreen Forest Green:** Values are declared as HSL values under `:root` and separately as CSS variables or inline HEX strings within dashboard themes and individual components.
*   **Draft/Publish Status colors:** `--status-published` and `--status-draft` variables are duplicated under `:root` and `.dashboard-theme` selectors.

---

## 4. CSS Technical Debt

*   🔴 **DOM Queries in Render:** The core `Button.tsx` queries active DOM selectors (`document.querySelector(".white-theme")`) during render to map variables. This breaks React server-side rendering (SSR) and hydration safety.
*   🔴 **Hardcoded Offsets:** Sidenav toggle adjustments hardcode margin margins to `256px` in `.dashboard-content` rather than referencing the `--sidebar-width` CSS variable.
*   🟡 **Raw Styles:** CSS styles in `NoImagePlaceCard.tsx` and custom lists bypass spacing variables to write absolute styles.
*   🟡 **Quill Editor Style Overrides:** Rich-text overrides are appended directly inside `index.css` without modular separation.

---

## 5. Accessibility (A11y) Issues

*   🔴 **Focus Suppression:** The reset rule `* { outline: none !important }` removes keyboard outlines globally, breaking accessibility.
*   🔴 **Unlabeled Nav Targets:** The mobile bottom navbar triggers (`NavButton.tsx`) receive a `text` label prop but do not render it.
*   🟡 **Keyboard Focus Traps:** Modals and vertical drawers do not trap keyboard tab cycles inside the overlay window.
*   🟡 **ARIA Semantic Gaps:** Custom switches and dropdown controls lack corresponding ARIA roles (`role="switch"`, `role="listbox"`, `aria-expanded`).

---

## 6. Inconsistent Interaction Patterns

*   **Notification Bypasses:** Several components import the raw `toast` component directly from `sonner`, bypassing the spam prevention layer in `useToast.ts`.
*   **Confirmation button order:** Button order varies on mobile and desktop confirmation screens, which can lead to accidental cancellations.
*   **Search Debounce Rates:** Categories input boxes run query validations immediately, while search songs debounce inputs for 300ms.
