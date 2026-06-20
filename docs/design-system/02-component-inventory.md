# Component Inventory — explorers.earth

**Version:** 1.0 (Audit Draft)  
**Status:** 🔬 Audited from codebase · Pending refactoring approval  
**Theme Model:** One brand, two expressions (Dashboard Dark/Green vs. Public Light/Blue)  

---

## Foundations

### Typography
*   **Purpose:** Establishes hierarchy, readability, and brand character across all text surfaces.
*   **Current Variants:**
    *   *Poppins:* The primary brand face. Used for dashboard headings, labels, and all primary UI text.
    *   *Inter:* The secondary font face, imported but has near-zero usage in the actual layouts.
    *   *System UI Fallback:* `system-ui, sans-serif` for when font files fail to load.
*   **States:** Static. Text size scales down responsively based on viewport sizes (e.g., in `.dt-heading`).
*   **Accessibility Concerns:**
    *   `font-weight: 300` (Light Poppins) is used for dashboard subtext (`.dt-subtext`), which can be illegible at small sizes under low contrast.
    *   Poppins weight `900` (font-black) is declared in headers but not included in the Google Fonts import string, causing browsers to synthesize an organic faux-bold layout with inconsistent tracking.
*   **Dependencies:** Google Fonts CDN import.
*   **Similar Components:** N/A.
*   **Duplication Opportunities:** Clean up the Inter import string if it is indeed unused, reducing page loading costs.
*   **Reusability Score:** 8/10 (highly standardized classes like `.dt-heading`, `.dt-label`, but not applied globally to the public landing page).
*   **Technical Debt:** Set `body { font-family: var(--font-primary); }` globally; currently the public side inherits system defaults unless explicitly overridden locally.

### Colors
*   **Purpose:** Defines visual identity, accentuates interactive states, and handles surface separation across dark-green dashboard and off-white public interfaces.
*   **Current Variants:**
    *   *Evergreen Green:* Raw HSL in `:root` and hardcoded HEX variables in `.dashboard-theme` (`#2E4032`, `#223126`).
    *   *Interactive Blue:* Two separate blues used for CTAs — `#3498DB` (Flat UI Blue) on the dashboard and `#3B82F6` (Tailwind Blue-500) on the public side.
    *   *Neutrals:* Mixed cool mist (`#E3EEF1`) and warm beige (`#F3EFE5`).
*   **States:** Dark mode overrides (`.dashboard-theme-dark` mapping to slate/charcoal neutrals).
*   **Accessibility Concerns:** Contrast on dashboard borders and muted texts (`#3C4E40` on `#223126` or `#2E4032`) hover near WCAG AA limits.
*   **Dependencies:** Scoped classes (`.dashboard-theme`, `.dashboard-theme-dark`, `.white-theme`).
*   **Similar Components:** N/A.
*   **Duplication Opportunities:** Highly duplicated. Colors are declared as HSL variables under `:root` and separately as CSS variables or inline HEX strings within dashboard themes and individual components.
*   **Reusability Score:** 5/10 (needs full tokenization).
*   **Technical Debt:** Unify action color to `#3B82F6` and centralize semantic palettes inside a single `:root` variables block.

### Icons
*   **Purpose:** Provides micro-affordance and graphic representation for links, status tags, and action buttons.
*   **Current Variants:**
    *   *ThemedIcon wrapper:* A `<span>` wrapper setting class names (`icon-primary`, `icon-secondary`, `icon-accent`, `icon-muted`) to drive SVG stroke and fill colors.
    *   *Raw SVGs:* Standard SVGs stored in `src/assets/icons/` (CrossIcon, UpArrow, Down, Location, Profile, VerticalKebab, etc.).
*   **States:** Active/Hover (often styled by parent hover bindings or CSS variables).
*   **Accessibility Concerns:** SVGs lack default `aria-label` or `role="img"` properties, making them invisible or confusing to screen readers.
*   **Dependencies:** None.
*   **Similar Components:** Lucide React icons are used interchangeably (e.g., `ChevronDown` in lowercase accordion vs. custom SVG `Down` in uppercase accordions).
*   **Duplication Opportunities:** Replace all custom arrow/chevron SVGs with Lucide React or standardize on a single source of icons to avoid mixing weights and styles.
*   **Reusability Score:** 6/10 (wrappers exist but are applied inconsistently).
*   **Technical Debt:** Mix of local SVG files and Lucide React. Icons are often wrapped inside buttons without descriptive tooltips.

### Spacing
*   **Purpose:** Establishes consistency in layout structure, grid offsets, and element padding.
*   **Current Variants:**
    *   *Layout Constants:* CSS variables (`--sidebar-width`, `--header-height-mobile`, `--header-height-desktop`).
    *   *Utility Layout Offsets:* Classes like `.action-bar-offset` and `.sticky-top-offset` matching headers and sidebars.
*   **States:** Collapsed vs. Expanded sidebars (modifying `--sidebar-width` between `256px` and `64px`).
*   **Accessibility Concerns:** Inconsistent padding scales on forms can lead to crowded layouts on mobile viewports.
*   **Dependencies:** Driven by JS variables and React contexts.
*   **Similar Components:** N/A.
*   **Duplication Opportunities:** Standardize card grids and form gaps (currently ranges from 8px to 24px with no uniform rule).
*   **Reusability Score:** 7/10 (CSS variables are utilized well in layout calculations, but margins are sometimes hardcoded to `256px` regardless).
*   **Technical Debt:** Clean up hardcoded margins (e.g. `margin-left: 256px` in `.dashboard-content` when `--sidebar-width` is already available).

---

## Primitive Components

### Buttons
*   **Purpose:** Triggers actions, submits forms, and navigates.
*   **Current Variants:**
    *   *Button.tsx:* The centralized button. Supports 20+ variants (`primary`, `secondary`, `gradient`, `tag`, `menu`, `success`, `icon`, `ghost`, `danger`, `dashAccent`, etc.) and sizes (`none`, `xsmall`, `small`, `medium`, `large`).
    *   *NavButton.tsx:* Custom button optimized for mobile bottom navigation.
*   **States:** Idle, Hover, Active, Disabled, Loading (renders custom spinner).
*   **Accessibility Concerns:**
    *   `focus:outline-none` is applied to `Button.tsx`, which strips outline focus rings on keyboard navigation.
    *   `NavButton.tsx` receives a `text: string` prop but fails to render it, leaving the button completely unlabeled for visual users.
*   **Dependencies:** None.
*   **Similar Components:** Inline buttons are present in several dashboard cards.
*   **Duplication Opportunities:** NavButton can be merged into Button using the `icon` or `vertical` configuration.
*   **Reusability Score:** 8/10 (Button.tsx is highly reusable, but bloated with too many variants).
*   **Technical Debt:** The button component checks the DOM during render (`document.querySelector(".white-theme")`) to map dashboard themes. This is a severe React anti-pattern that breaks SSR and hydration.

### Inputs
*   **Purpose:** Collects alphanumeric inputs from users.
*   **Current Variants:**
    *   `input.tsx`: A lightweight Shadcn-like base input.
    *   `PasswordInput.tsx`: Custom input with visibility toggle, validation metrics, and strength meter.
    *   `UsernameInput.tsx`: Formik-connected input with custom debounce validation and suggestions.
    *   `OnboardingUsernameInput.tsx`: Onboarding-specific username input.
    *   `PhoneInputWithCountry.tsx`: Standardized phone number validation component using `libphonenumber-js`.
    *   `CurrencyAmountInput.tsx`: Select component for currency code coupled with formatted amount entry.
*   **States:** Normal, Focus, Hover, Disabled, Invalid (Error border), Valid (Success border).
*   **Accessibility Concerns:**
    *   `disabled` overlay in `UsernameInput.tsx` catches pointer actions without proper keyboard focus indicators.
    *   Input elements often lack explicit `<label>` bindings or `aria-describedby` links pointing to error logs.
*   **Dependencies:** Formik (for validation inputs), React-Select, React-Currency-Input-Field, libphonenumber-js.
*   **Similar Components:** Base `input.tsx` vs custom text fields in features.
*   **Duplication Opportunities:** `OnboardingUsernameInput.tsx` and `UsernameInput.tsx` share 90% of their logic. They should be unified.
*   **Reusability Score:** 7/10 (Inputs are feature-rich, but coupled to third-party form libraries or design contexts).
*   **Technical Debt:** Direct Formik dependencies limit inputs from being used in stateless React Hook Form configurations.

### Checkboxes
*   **Purpose:** Toggles multi-selection options.
*   **Current Variants:**
    *   `checkbox.tsx`: Custom button that toggles status and renders a Lucide `Check` icon when true.
*   **States:** Checked, Unchecked, Disabled.
*   **Accessibility Concerns:** Being built as a `<button>` without a native checkbox role or input attributes means screen readers do not recognize it as a checkbox unless explicit ARIA attributes are attached.
*   **Dependencies:** Lucide React (`Check`).
*   **Similar Components:** Native HTML checkboxes in forms.
*   **Duplication Opportunities:** Standardize native `<input type="checkbox">` styled wrappers to ensure form compatibility.
*   **Reusability Score:** 9/10 (Stateless component).
*   **Technical Debt:** Lack of support for native form submission (requires external state mapping to register values).

### Badges
*   **Purpose:** Displays tags, categories, metadata, and publish statuses.
*   **Current Variants:**
    *   `badge.tsx`: Simple container badge with four style variants (`default`, `secondary`, `destructive`, `outline`).
    *   *Inline Badges:* Custom pill labels for ratings, "Public/Draft" indicators, and day count meters on grids.
*   **States:** Static.
*   **Accessibility Concerns:** Relying solely on color (green/slate) for Draft vs. Public states can impact color-blind users.
*   **Dependencies:** None.
*   **Similar Components:** Rating tag pills, location tag badges inside cards.
*   **Duplication Opportunities:** Standardize all card tags and metadata pills to use the `badge.tsx` primitive.
*   **Reusability Score:** 9/10 (Simple markup).
*   **Technical Debt:** Hardcoded padding and styling in inline components overrides badge.tsx tokens.

### Switches
*   **Purpose:** Toggles binary settings immediately.
*   **Current Variants:**
    *   `Switch.tsx`: Interactive div/button containing a toggle knob with optional loading spinner.
    *   `SwitchButton.tsx`: Memoized label/checkbox input that checks theme settings.
*   **States:** Checked, Unchecked, Loading, Disabled.
*   **Accessibility Concerns:**
    *   `Switch.tsx` uses a clickable wrapper containing a `<button>`. Nesting buttons in clickable divs causes keyboard navigation focus duplication.
    *   `SwitchButton.tsx` uses a hidden input but does not display keyboard focus rings.
*   **Dependencies:** `DashboardThemeContext`.
*   **Similar Components:** Toggle buttons inside forms.
*   **Duplication Opportunities:** High duplication. These two components perform identical actions but use completely different structures (button vs. label input) and styles.
*   **Reusability Score:** 6/10 (theme bindings limit portability).
*   **Technical Debt:** Both components should be consolidated. `SwitchButton` relies on theme classes querying the DOM class list when context is unavailable.

---

## Composite Components

### Cards
*   **Purpose:** Previews content (places, guides, playlists, people) inside dashboards and recommendation feeds.
*   **Current Variants:**
    *   `Card.tsx`: The primary image-focused item card. Supports types: `default`, `menuCard`, `map`, and `suggestion`. Handles kebab menus and tags.
    *   `NoImagePlaceCard.tsx`: Category-colored fallback card with an integrated action button.
    *   `PlaylistCard.tsx`: Dedicated minimal music grid item.
    *   `AccountSetupCard.tsx`: Horizontal multi-step task tracker.
    *   `GuideCardSkeleton.tsx` & `RecommendationCardSkeleton.tsx`: Grid placeholder loading states.
*   **States:** Normal, Hover (Framer-motion scale-ups), Focus, Active.
*   **Accessibility Concerns:** Cards are missing standard link boundaries, resulting in multiple interactive overlays (like kebab menus and category pills) nested inside the main clickable card parent.
*   **Dependencies:** Framer Motion, i18next, Lucide React.
*   **Similar Components:** List item cards in features.
*   **Duplication Opportunities:** Fallbacks and skeletons are defined across multiple files.
*   **Reusability Score:** 7/10 (Complex internal mappings).
*   **Technical Debt:** Image fallbacks and category styles are hardcoded with absolute values, bypassing CSS variable scales.

### Modals
*   **Purpose:** Displays isolated overlays for settings, details, confirmations, and uploads.
*   **Current Variants:**
    *   `Modal.tsx`: Portal-backed modal wrapper.
    *   `ConfirmationModal.tsx`: Alert sheet containing actions.
    *   `UnsavedChangesModal.tsx`: Confirmation wrapper warning users before leaving edited pages.
    *   `UsernameChangeConfirmationModal.tsx`: Modal specific to setting changes.
    *   *Feature Modals:* `CircularPlacesModal.tsx`, `LanguageModal.tsx`, `ShareModal.tsx`, `AddLocationModal.tsx`, `QRModal.tsx`.
*   **States:** Open, Closed.
*   **Accessibility Concerns:**
    *   `* { outline: none !important }` globally overrides keyboard focus outlines.
    *   Most modals do not lock keyboard focus inside the portal container (Focus Trap is missing).
*   **Dependencies:** React-DOM (Portals), Framer Motion.
*   **Similar Components:** Bottom sheets on mobile.
*   **Duplication Opportunities:** Highly duplicated. Most confirmation modals recreate their own portals, backdrops, and animation bindings from scratch instead of reusing `Modal.tsx`.
*   **Reusability Score:** 5/10 (Lack of a unified layout base).
*   **Technical Debt:** Standard confirmation screens use hardcoded backgrounds and buttons rather than shared components.

### Dropdowns
*   **Purpose:** Allows selection from structured option lists.
*   **Current Variants:**
    *   `Dropdown.tsx`: Searchable category combobox.
    *   `CountryCodeDropdown.tsx`: Dedicated phone-calling code selector.
*   **States:** Closed, Open (scroll container list), Focused, Hover item, Selected item.
*   **Accessibility Concerns:** Custom select inputs lack appropriate keyboard navigation (arrow key down/up selection) and ARIA attributes (`aria-haspopup`, `aria-expanded`).
*   **Dependencies:** CSS scroll-behavior configs.
*   **Similar Components:** React-select instances in forms.
*   **Duplication Opportunities:** Dropdown is coupled to the profile page's `KeyValuePair` type. Standardizing a generic select primitive would allow unifying these options.
*   **Reusability Score:** 6/10 (limited by typing and hardcoded classes).
*   **Technical Debt:** Inline SVGs and class setups bypass layout tokens.

### Tabs
*   **Purpose:** Toggles between separate views under a shared dashboard section.
*   **Current Variants:**
    *   `Tab.tsx`: Standard static component mapping labels to layout nodes.
    *   `tabs.tsx`: Shadcn-like composite layout (`TabsList`, `TabsTrigger`, `TabsContent`).
    *   `CircularTabs.tsx`: Animated circular layout with icons.
*   **States:** Active, Inactive, Hover.
*   **Accessibility Concerns:**
    *   `tabs.tsx` uses custom `<button>` structures, but does not bind them to standard tab ARIA roles (`role="tablist"`, `role="tab"`).
    *   Focus states on tab switches are missing.
*   **Dependencies:** React (`cloneElement`), Framer Motion.
*   **Similar Components:** Pill navigation elements.
*   **Duplication Opportunities:** `Tab.tsx` and `tabs.tsx` share purposes. `tabs.tsx` is more flexible but utilizes `React.cloneElement` to inject state, which is fragile.
*   **Reusability Score:** 7/10.
*   **Technical Debt:** Tab lists hardcode white and dark-green layouts (`type="public"` checks), adding visual maintenance overhead.

### Accordions
*   **Purpose:** Toggles vertical expansion of content sections.
*   **Current Variants:**
    *   `Accordian.tsx` (uppercase spelling error): Self-contained accordion built with Framer Motion, featuring smooth scroll-to-bottom behavior.
    *   `accordion.tsx` (lowercase): Composite accordion API (`AccordionItem`, `AccordionTrigger`, `AccordionContent`) utilizing React Context.
*   **States:** Expanded, Collapsed, Hover, Active.
*   **Accessibility Concerns:** Keyboard access is limited in custom setups.
*   **Dependencies:** Framer Motion, Lucide React (`ChevronDown`), custom Arrow SVGs.
*   **Similar Components:** Expandable lists in dashboards.
*   **Duplication Opportunities:** Both accordion systems should be unified. The uppercase `Accordian.tsx` is tailored for the dashboard theme, while the lowercase `accordion.tsx` is built for playlist management and hardcodes gray/black styles.
*   **Reusability Score:** 6/10.
*   **Technical Debt:** Duplicated names with different capitalization, distinct design treatments, and separate layout APIs.

---

## Complex Patterns

### Navigation
*   **Purpose:** Navigates users across main pages, sidebars, and panels.
*   **Current Patterns:**
    *   `Sidenav.tsx`: Collapsible sidebar managing active paths.
    *   `Header.tsx`: Sticky dashboard top-bar with auto-scroll hiding.
    *   `Navbar.tsx` & `PublicNav.tsx`: Public interface headers.
    *   `guest-bottom-navigation.tsx`: Mobile tab navigation layout.
*   **States:** Collapsed, Expanded, Hidden on scroll, Active page indicators.
*   **Accessibility Concerns:** Keyboard accessibility in responsive sidebars is incomplete, as focus isn't trapped when pages are opened on mobile viewports.
*   **Dependencies:** React Router, Framer Motion.
*   **Technical Debt:** Heavy usage of inline offsets to track sidebar widths. PublicNav uses hardcoded values (`#2a2a2a`) that bypass token scales.

### Forms
*   **Purpose:** Facilitates user profiles, onboarding, and auth details.
*   **Current Patterns:**
    *   `ProfileForm.tsx`: Multi-field form for category selections, phone numbers, and username updates.
    *   `OnBoarding.tsx`: Specialized multi-step onboarding wizard.
    *   Auth Forms (`Login.tsx`, `Register.tsx`, `ForgotPassword.tsx`): Traditional registration layouts.
*   **States:** Dirty, Pristine, Submitting, Valid, Invalid.
*   **Accessibility Concerns:** Input validation logs are not announced to screen readers.
*   **Dependencies:** Formik, Yup, React-i18next.
*   **Technical Debt:** Form flows integrate custom validator helpers which duplicate error checks.

### Dashboards
*   **Purpose:** Central workspace for platform recommendations and media files.
*   **Current Patterns:**
    *   `MusicDashboard.tsx`: Media playlist grids, player widgets, and table layouts.
    *   `RecommendationsHub.tsx`: Main map-based and suggestion card layouts.
*   **States:** Loading grid, Empty state, Grid vs. List views.
*   **Accessibility Concerns:** Nested click targets in dashboard items complicate navigation flow.
*   **Dependencies:** Framer Motion, Youtube Player widgets.
*   **Technical Debt:** Huge files (e.g. `MusicDashboard.tsx` is 52 KB) containing inline layout code, pagination logic, and state management that should be extracted.

### Media Uploads
*   **Purpose:** Manages profile image changes and verification files.
*   **Current Patterns:**
    *   `ImageCropper.tsx`: Portal overlay displaying cropping bounds.
    *   `VerificationFileUpload.tsx`: Drag-and-drop region with progress indicators.
*   **States:** Empty, Dragging, Selected, Uploading, Success, Error.
*   **Accessibility Concerns:** Missing clear alternative text descriptors on upload buttons.
*   **Dependencies:** React Crop plugins.
*   **Technical Debt:** Custom components implement their own upload logic, leading to duplicate API endpoints.

### Search Flows
*   **Purpose:** Filters, queries, and shows recommendations or maps.
*   **Current Patterns:**
    *   `search-songs.tsx`: Custom search with filtering inputs.
    *   `InteractiveMap.tsx`: Google Maps location searching.
*   **States:** Typing, Pending, Success, Empty results.
*   **Accessibility Concerns:** Dynamic lists do not announce updates to screen readers.
*   **Dependencies:** Google Maps APIs, YouTube APIs.
*   **Technical Debt:** Search forms duplicate key inputs and query logic, complicating consistency.

---

## Technical Debt Summary & Migration Priorities

1.  **Deduplicate Accordions (`Accordian.tsx` vs `accordion.tsx`):** Unify to a single composite API styled through CSS tokens.
2.  **Consolidate Switches (`Switch.tsx` vs `SwitchButton.tsx`):** Unify to a single native-backed toggle switch.
3.  **Deduplicate Usernames (`OnboardingUsernameInput` vs `UsernameInput`):** Unify under a single configurable input component.
4.  **Refactor Modal Backdrops:** Extract backdrop wrapper into `Modal.tsx` and reuse it across confirmation variants.
5.  **Remove SSR Antipatterns:** Remove DOM queries (`document.querySelector`) inside component rendering functions (e.g., in `Button.tsx`).
6.  **Accessibility Remediation:** Restore outline focus rings by removing `* { outline: none !important }` and bind correct ARIA roles to custom controls.
