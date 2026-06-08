# AI Agent Design Contract & Review Checklist

**Version:** 1.0  
**Status:** 🔬 Active Governance Contract  
**Target:** Enforce visual consistency, prevent design drift, and eliminate technical debt.  

---

## 📜 AI Developer Design Contract

Any AI Coding Assistant (including Antigravity, Claude, Cursor, and Codex) modifying or creating user interfaces in `explorers.earth` must strictly adhere to the following rules:

### 1. Never Invent New Colors
*   **Rule:** Do not introduce arbitrary HEX, HSL, or RGB strings in inline code, Tailwind classes, or style variables.
*   **Action:** Only reference semantic tokens from [Design Tokens](file:///D:/Project/explorers.earth/docs/design-system/01-design-tokens.md) (e.g., `--dash-accent`, `bg-dashboard-muted`).
*   **Approved Interactive Blue:** Always map to `#3B82F6` (Tailwind Blue-500) and its scale. The legacy blue `#3498DB` is deprecated.

### 2. Never Invent New Spacing Values
*   **Rule:** Layout padding, margins, and gaps must strictly map to the 4px baseline scale.
*   **Action:** Use standard Tailwind units (`gap-1`, `gap-2`, `gap-4`, `gap-6`, etc.). Do not use arbitrary Tailwind spacing values like `p-[17px]` or `mt-[3px]`.

### 3. Reuse Existing Components
*   **Rule:** Check [Component Inventory](file:///D:/Project/explorers.earth/docs/design-system/02-component-inventory.md) before writing new markup.
*   **Action:** If a Button, Input, PasswordInput, Modal, Card, or Switch exists, you **MUST** import and reuse it. Never create a local duplicate component.

### 4. Prefer Composition Over Duplication
*   **Rule:** If a component requires visual modification, use configurable props rather than duplicating the entire component structure.
*   **Action:** Extend the original component's interface or wrap it inside a higher-order component.

### 5. Follow HTML Reference Examples
*   **Rule:** Custom markup structures must align with [HTML Reference Library](file:///D:/Project/explorers.earth/docs/design-system/04-html-reference-library.md) blueprints.
*   **Action:** Keep structural tags, focus classes, and ARIA attributes consistent with the reference examples.

### 6. Do Not Bypass Hooks
*   **Rule:** Never import raw packages directly if a custom hook or wrapper already exists.
*   **Action:** Always use the custom `useToast.ts` hook rather than calling `toast` from `sonner` directly. This ensures duplicate/spam toast notifications are handled correctly.

### 7. Respect Accessibility (A11y) Standards
*   **Rule:** Do not build keyboard-inaccessible layouts.
*   **Action:** Never use `outline-none` on buttons or inputs without providing equivalent focus indicators. Custom controls must include standard ARIA attributes (`aria-expanded`, `role="dialog"`, etc.).

### 8. Ask Before Proposing Visual Changes
*   **Rule:** Do not introduce new design concepts without user approval.
*   **Action:** If a task requires a layout concept that is not documented in [design.md](file:///D:/Project/explorers.earth/docs/design-system/design.md), halt execution and ask the user how to proceed.

---

## 📋 Pre-Commit Design Review Checklist

Before finalizing any UI changes, the AI developer must execute the following checklist and confirm all criteria are met:

### Phase 1: Code Scans & Token Verification
*   [ ] **Zero Inline Hex Codes:** Verify that no new raw color strings (`#HEX`, `rgb()`, `hsl()`) have been added to files.
*   [ ] **Token Compliance:** Confirm all padding, margin, gap, and rounded classes map to design tokens.
*   [ ] **No DOM Queries in Render:** Ensure no `document.querySelector` operations are run during component rendering loops.

### Phase 2: Component & Pattern Reusability
*   [ ] **Toast Hook Enforcement:** Verify that all new notifications use `useToast` rather than importing directly from `sonner`.
*   [ ] **Modal Consistency:** Confirm that confirmation dialogs do not define their own backdrops, but instead reuse a shared portal component.
*   [ ] **No Component Duplication:** Confirm that no new accordions, switches, or username fields have been introduced.

### Phase 3: Accessibility (A11y) & Responsiveness
*   [ ] **Visible Keyboard Focus:** Verify that custom components show outline rings when navigated via keyboard.
*   [ ] **Explicit ARIA Roles:** Confirm custom switches use `role="switch"`, modals use `role="dialog"`, and dropdown lists use `role="listbox"`.
*   [ ] **Unlabeled Navigation Fixed:** Ensure all navigation triggers (`NavButton.tsx`) render descriptive text labels.
*   [ ] **Viewport Scale checks:** Verify forms stack vertically on screens smaller than 640px, and that the navigation layout adapts correctly below 768px.
