# UX Pattern Library — explorers.earth

**Version:** 1.0 (Pattern Audit)  
**Status:** 🔬 Extracted from codebase · Approved for system compliance  
**Scope:** Universal UX patterns matching the "One Brand, Two Expressions" philosophy  

---

## 1. Navigation

### Current Implementation
*   **Desktop Sidenav:** Collapsible layout (`Sidenav.tsx`) that updates the global layout via a `useLayoutEffect` writing to `body[data-sidebar-open="false/true"]`. This handles shifting layout bounds without forcing React DOM re-renders.
*   **Desktop Top-Bar:** Sticky header (`Header.tsx`) that dynamically hides on scroll to maximize viewport height.
*   **Public Nav:** Simple header (`Navbar.tsx` & `PublicNav.tsx`) styled for public users.
*   **Mobile bottom nav:** Screen-bottom navigation (`guest-bottom-navigation.tsx`) using icon-only triggers (`NavButton.tsx`).

### Consistency Analysis
*   🔴 **Unlabeled Nav Targets:** The `NavButton` component takes a `text` prop but never renders it, creating an icon-only interface that lacks visual descriptions.
*   🟡 **Hardcoded Offsets:** Inconsistencies exist in positioning classes. `index.css` contains hardcoded `margin-left: 256px` offsets alongside dynamic `--sidebar-width` variables.
*   🟢 **Responsive Switch:** Clean breakpoints transition navigation smoothly from vertical sidebar (desktop) to bottom tabs (mobile).

### Recommended Standard
*   Standardize the collapsible layout using custom properties.
*   Enforce label rendering inside mobile navigation elements.

### HTML Reference Example
```html
<div class="dashboard-theme flex min-h-screen">
  <!-- Sidebar Navigation -->
  <aside class="fixed top-0 bottom-0 left-0 w-[var(--sidebar-width)] bg-dashboard-sidebar transition-all duration-300 z-40">
    <nav class="flex flex-col gap-2 p-4">
      <a href="/dashboard" class="flex items-center gap-3 p-3 rounded-xl bg-dashboard-accent text-white font-medium" aria-current="page">
        <span class="w-5 h-5"><!-- SVG Icon --></span>
        <span class="text-sm">Dashboard</span>
      </a>
      <a href="/settings" class="flex items-center gap-3 p-3 rounded-xl text-dashboard-light hover:bg-dashboard-muted transition-colors">
        <span class="w-5 h-5"><!-- SVG Icon --></span>
        <span class="text-sm">Settings</span>
      </a>
    </nav>
  </aside>

  <!-- Layout Content Wrapper -->
  <main class="flex-1 ml-[var(--sidebar-width)] transition-all duration-300">
    <!-- Header Page Anchor -->
    <header class="sticky top-0 h-14 bg-dashboard-sidebar border-b border-dashboard z-30">
      <!-- Nav triggers and page header elements -->
    </header>
  </main>
</div>
```

### Usage Rules
*   Use Sidenav navigation on screens larger than `768px`.
*   Collapse sidebar widths to `64px` when users trigger the toggle. Show bottom bars on viewports under `768px`.

---

## 2. Authentication

### Current Implementation
*   manual credentials authentication forms (Formik + Yup validators) for traditional Login/Registration.
*   Third-party OAuth login workflows via Google.
*   Route wrappers (`ProtectedRoute.tsx`, `GuestRoute.tsx`) using zustand store tokens to guard pages.

### Consistency Analysis
*   🟡 **Form Inconsistencies:** Login forms write CSS properties inline, resulting in visual differences compared to dashboard layouts.
*   🟢 **Route Protection:** Clear segregation of protected and public paths.

### Recommended Standard
*   Wrap authentication screens in layout-themed containers.
*   Enforce standard credential autocompletion tags to prevent browser warnings.

### HTML Reference Example
```html
<div class="white-theme min-h-screen flex items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
    <h2 class="text-2xl font-poppins font-bold text-gray-900 text-center mb-6">Welcome Back</h2>
    
    <form class="space-y-4" action="#" method="POST">
      <!-- Google SSO CTA -->
      <button type="button" class="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
        <!-- Google Icon -->
        <span>Continue with Google</span>
      </button>

      <div class="relative flex py-2 items-center text-xs text-gray-400 uppercase">
        <div class="flex-grow border-t border-gray-200"></div>
        <span class="px-3">or</span>
        <div class="flex-grow border-t border-gray-200"></div>
      </div>

      <!-- Credentials Form Fields -->
      <div>
        <label for="email" class="block text-xs font-semibold uppercase text-gray-500 mb-1">Email Address</label>
        <input id="email" name="email" type="email" autocomplete="username" required class="w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    </form>
  </div>
</div>
```

### Usage Rules
*   Form containers must support Google OAuth authentication blocks.
*   Forms must declare `autoComplete="username"` and `autoComplete="current-password"` for secure password fills.

---

## 3. Forms

### Current Implementation
*   Driven by Formik wrappers (`ProfileForm.tsx`, `Register.tsx`) with nested `<Field>` nodes and Yup schema mappings.
*   Components like `PasswordInput` and `PhoneInputWithCountry` bind to Formik validation trees.

### Consistency Analysis
*   🔴 **Spacing Divergence:** Form spacing lacks standard tokens (ranging between 8px and 24px across different sections).
*   🟡 **Input Autocomplete:** Browser warnings occur because standard form autofill variables are missing from inputs.

### Recommended Standard
*   Adopt standard form layout variables:
    ```css
    --form-field-gap: 8px;   /* Gap between label and input field */
    --form-group-gap: 16px;  /* Gap between field groupings */
    --form-section-gap: 24px;/* Gap between major form sections */
    ```

### HTML Reference Example
```html
<form class="dashboard-theme flex flex-col gap-[var(--form-section-gap)]">
  <!-- Form Section -->
  <fieldset class="flex flex-col gap-[var(--form-group-gap)] border-none p-0 m-0">
    <legend class="text-sm font-bold text-dashboard mb-2">Personal Settings</legend>
    
    <!-- Field Group -->
    <div class="flex flex-col gap-[var(--form-field-gap)]">
      <label for="fullName" class="dt-label">Full Name</label>
      <input id="fullName" name="fullName" type="text" class="dt-input" placeholder="e.g. John Doe" />
    </div>
  </fieldset>
</form>
```

### Usage Rules
*   Wrap input controls in a `<label>` block with correct `htmlFor` identifiers.
*   Use `dt-input` base styles for forms rendered inside the dashboard.

---

## 4. Validation

### Current Implementation
*   Debounced API verification checks (`useUsernameValidation`) showing feedback on username inputs.
*   Interactive strength indicators on `PasswordInput.tsx`.
*   Yup validation alerts rendering inline below text fields.

### Consistency Analysis
*   🔴 **Feedback Triggers:** Validation behavior is inconsistent; some fields validate immediately, while others trigger warnings only on blur.
*   🟡 **Success Markers:** Checkmarks and valid indicator outlines are displayed on usernames but missing on standard profile elements.

### Recommended Standard
*   Standardize debounce intervals at 300ms for async validation checks.
*   Render errors inline immediately below the input.

### HTML Reference Example
```html
<div class="flex flex-col gap-1">
  <label for="username" class="dt-label text-red-500">Username</label>
  <div class="relative">
    <input id="username" name="username" type="text" class="dt-input border-red-500 focus:ring-red-500" value="invalid_name!" />
    <!-- Validation Icon -->
    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">⚠️</span>
  </div>
  <!-- Error Text -->
  <p class="text-xs text-red-400 font-poppins" aria-live="polite">
    Username contains invalid characters.
  </p>
</div>
```

### Usage Rules
*   Render invalid states with red borders (`--color-status-danger`).
*   Render valid inputs with green borders (`--color-status-success`).
*   Include `aria-live="polite"` on message containers to ensure screen readers announce updates.

---

## 5. Loading States

### Current Implementation
*   **EarthLoader:** Full-screen circular earth animation loaded with contextual messages.
*   **RouteLoader:** Full-page loader overlaid on route change intervals.
*   **ButtonSpinner:** Loading spinner SVG displayed inside buttons (`Button.tsx`) to prevent double-clicks.
*   **Card Skeletons:** Styled placeholders (`GuideCardSkeleton.tsx`, `RecommendationCardSkeleton.tsx`) that display during content queries.

### Consistency Analysis
*   🟡 **Spinner Inconsistencies:** Loaders use different sizes, stroke weights, and colors depending on where they are declared.
*   🟢 **Shimmer Skeletons:** Skeleton screens match card aspects and layouts.

### Recommended Standard
*   Unify loaders into a few patterns: a primary spinner, a skeleton grid, and a full-screen transition loader.

### HTML Reference Example
```html
<!-- Shimmer Skeleton Card -->
<div class="w-full aspect-square rounded-xl bg-dashboard-muted overflow-hidden relative">
  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"
       style="animation: shimmer 1.5s infinite;"></div>
</div>

<style>
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
</style>
```

### Usage Rules
*   Use button loading indicators (`isLoading`) to prevent double form submissions.
*   Use skeleton screens for initial data fetches.
*   Limit full-screen loading overlays to major authentication or initial setup processes.

---

## 6. Empty States

### Current Implementation
*   Basic templates centered in listings, rendering an icon followed by explanatory text (e.g. `playlist-table.tsx` empty states).

### Consistency Analysis
*   🔴 **Inline Implementation:** Empty states are coded manually inside page layouts, resulting in inconsistent sizing, text styling, and layout structures.

### Recommended Standard
*   Create a standardized empty state container containing an icon, title, description, and an optional action CTA.

### HTML Reference Example
```html
<div class="flex flex-col items-center justify-center py-12 px-6 text-center max-w-sm mx-auto">
  <div class="w-16 h-16 bg-dashboard-muted rounded-full flex items-center justify-center mb-4 text-dashboard-light">
    <!-- Icon component here -->
    📂
  </div>
  <h3 class="text-base font-semibold text-dashboard-light mb-1">No recommendation lists found</h3>
  <p class="text-xs text-dashboard-muted mb-4">You haven't added any cities to your recommendation catalog yet.</p>
  <button class="bg-dashboard-accent text-white px-4 py-2 rounded-xl text-sm font-medium">Add New City</button>
</div>
```

### Usage Rules
*   Render empty states whenever list fetches return empty arrays.
*   Provide a clear action button pointing to the primary next step.

---

## 7. Error States

### Current Implementation
*   App-wide boundary page `ErrorBoundary.tsx`.
*   Inline validation warnings and failed query alerts displayed via `sonner` toasts.

### Consistency Analysis
*   🟢 **Boundary Guarding:** Clean error boundary isolation prevents complete layout crashes.
*   🟡 **Validation Errors:** Error containers vary in spacing and label coloring.

### Recommended Standard
*   Standardize critical page failures using an isolated banner block.

### HTML Reference Example
```html
<div class="dashboard-theme flex flex-col items-center justify-center p-6 border border-dashboard-danger bg-dashboard-danger/10 rounded-xl max-w-md mx-auto">
  <span class="text-3xl mb-3">⚠️</span>
  <h3 class="text-base font-bold text-dashboard mb-1">Failed to load recommendations</h3>
  <p class="text-xs text-dashboard-light text-center mb-4">We encountered a connection issue while fetching this dashboard list.</p>
  <button type="button" class="px-4 py-2 bg-dashboard-accent text-white text-xs font-semibold rounded-md hover:opacity-90">
    Try Again
  </button>
</div>
```

### Usage Rules
*   Do not overlay raw stack traces in user layouts.
*   Keep messages friendly, short, and actionable.

---

## 8. Success Feedback

### Current Implementation
*   Green boundary checks, success icons inside check containers, and success alerts via `toast.success`.

### Consistency Analysis
*   🟢 **Toasts:** Success operations consistently use green check badges on user actions.

### Recommended Standard
*   Trigger success events using the `toastSuccess` helper in `useToast.ts`.

### HTML Reference Example
```html
<div class="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl">
  <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span class="text-sm font-medium">Settings updated successfully!</span>
</div>
```

### Usage Rules
*   Provide immediate success confirmation upon save, publish, or upload actions.

---

## 9. Confirmation Dialogs

### Current Implementation
*   Custom backdrop and container modals (`ConfirmationModal.tsx`, `UnsavedChangesModal.tsx`).

### Consistency Analysis
*   🔴 **Visual Discrepancies:** Modals vary in backdrop opacity and border radius.
*   🔴 **Mobile Sizing:** Button orders vary across mobile and desktop interfaces, which can lead to accidental cancellations.

### Recommended Standard
*   Standardize confirmation modals with responsive button ordering.
*   Order buttons consistently: Destructive action on the right (desktop), cancel on the left.

### HTML Reference Example
```html
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
  <div class="w-full max-w-md bg-dashboard-sidebar border border-dashboard rounded-2xl overflow-hidden shadow-2xl flex flex-col">
    <!-- Header -->
    <div class="p-6">
      <h3 class="text-lg font-bold text-dashboard mb-2">Delete Recommendation?</h3>
      <p class="text-sm text-dashboard-light">This action is permanent and cannot be undone.</p>
    </div>
    
    <!-- Footer actions -->
    <div class="bg-dashboard-muted/20 border-t border-dashboard p-4 flex flex-col sm:flex-row justify-end gap-3">
      <!-- Mobile: Delete (Top), Cancel (Bottom) -->
      <!-- Desktop: Cancel (Left), Delete (Right) -->
      <button class="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium hover:bg-dashboard-muted/50 text-dashboard-light sm:order-1 order-2">
        Cancel
      </button>
      <button class="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium bg-dashboard-danger text-white hover:opacity-90 sm:order-2 order-1">
        Delete
      </button>
    </div>
  </div>
</div>
```

### Usage Rules
*   Place destructive confirmation buttons on the right for desktop screens, and stack them with the primary action on top for mobile.
*   Close overlays if users click on the backdrop, unless a form submission is in progress.

---

## 10. Search

### Current Implementation
*   Combobox searchable inputs (`Dropdown.tsx`), Youtube search panels (`search-songs.tsx`), and landing queries.

### Consistency Analysis
*   🟡 **Debounce Handling:** Some search forms dispatch requests immediately on keypress, while others use a custom debounce timer.

### Recommended Standard
*   Use a debounced input structure with loading indicator wheels and a clear action button.

### HTML Reference Example
```html
<div class="relative w-full">
  <input type="search" class="w-full pl-10 pr-10 py-2.5 bg-dashboard-muted border border-dashboard rounded-xl text-sm text-dashboard placeholder:text-dashboard-muted focus:ring-2 focus:ring-dashboard-accent outline-none" placeholder="Search recommendations..." />
  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-dashboard-muted">🔍</span>
  <!-- Clear button / Loader -->
  <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-dashboard-muted hover:text-dashboard">✕</button>
</div>
```

### Usage Rules
*   Debounce search inputs (200-300ms) on API queries to prevent network spam.
*   Always render a clear button when the input value is not empty.

---

## 11. Filtering

### Current Implementation
*   Scrolling horizontal list categories (pills) that toggle active feeds.
*   Dashboard navigation chips and categories selection lists.

### Consistency Analysis
*   🟡 **Component Overlap:** The platform uses `CircularTabs.tsx` (icons) and `Tab.tsx` (text pills) interchangeably for identical filtering tasks.

### Recommended Standard
*   Standardize horizontally scrollable filters with active styling states.

### HTML Reference Example
```html
<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
  <!-- View all -->
  <button class="px-4 py-2 text-xs font-semibold rounded-2xl bg-dashboard-accent text-white border border-dashboard-accent whitespace-nowrap">
    All Categories
  </button>
  <!-- Category Item -->
  <button class="px-4 py-2 text-xs font-semibold rounded-2xl bg-dashboard-sidebar text-dashboard-light border border-dashboard hover:border-dashboard-accent whitespace-nowrap">
    Food & Drinks
  </button>
</div>
```

### Usage Rules
*   Category filters should support horizontal touch scrolling (`overflow-x-auto`) on mobile viewports.
*   Mark active category items with the dashboard accent background color.

---

## 12. Tables

### Current Implementation
*   Songs list (`playlist-table.tsx`) built using grid items with custom drag-and-drop handles.

### Consistency Analysis
*   🟢 **Row Dragging:** Smooth reordering animations using native event listeners.

### Recommended Standard
*   Structure data listings using accessible markup.

### HTML Reference Example
```html
<div class="w-full overflow-x-auto border border-dashboard rounded-xl bg-dashboard-sidebar">
  <table class="w-full text-left border-collapse">
    <thead>
      <tr class="border-b border-dashboard bg-dashboard-muted/30">
        <th class="p-4 text-xs font-semibold text-dashboard-muted">Title</th>
        <th class="p-4 text-xs font-semibold text-dashboard-muted">Artist</th>
        <th class="p-4 text-xs font-semibold text-dashboard-muted text-right">Duration</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-dashboard">
      <tr class="hover:bg-dashboard-muted/20 transition-colors">
        <td class="p-4 text-sm text-dashboard">Bohemian Rhapsody</td>
        <td class="p-4 text-sm text-dashboard-light">Queen</td>
        <td class="p-4 text-sm text-dashboard-light text-right">5:55</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Usage Rules
*   Define layout columns clearly.
*   Rows should support hover state highlights (`hover:bg-dashboard-muted/20`).

---

## 13. Pagination

### Current Implementation
*   Bottom list navigation button controls in `PlaylistTable` ("Previous", "Next", and a text indicator of the current page offset).

### Consistency Analysis
*   🔴 **Duplicate Setup:** Pagination logic is written inline within pages rather than using a shared footer component.

### Recommended Standard
*   Standardize simple pagination controls.

### HTML Reference Example
```html
<nav class="flex items-center justify-between border-t border-dashboard px-4 py-3 sm:px-6 mt-4" aria-label="Pagination">
  <div class="flex flex-1 justify-between sm:justify-end gap-3 items-center">
    <button class="px-4 py-2 border border-dashboard bg-dashboard-sidebar text-xs font-medium text-dashboard-light hover:bg-dashboard-muted rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled>
      Previous
    </button>
    <span class="text-xs text-dashboard-muted">Page 1 of 5</span>
    <button class="px-4 py-2 border border-dashboard bg-dashboard-sidebar text-xs font-medium text-dashboard-light hover:bg-dashboard-muted rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
      Next
    </button>
  </div>
</nav>
```

### Usage Rules
*   Display pagination triggers when static page counts exceed 10 records.

---

## 14. Infinite Scrolling

### Current Implementation
*   `IntersectionObserver` triggers inside `PublicHome.tsx` and `Recommendations.tsx` that fetch additions when scroll margins are met.

### Consistency Analysis
*   🟡 **Redundant Listeners:** Observers are initialized from scratch inside each component, duplication logic.

### Recommended Standard
*   Centralize infinite scroll configurations using a reusable custom React hook:
    ```tsx
    export const useInfiniteScroll = (callback: () => void, hasMore: boolean) => { ... }
    ```

### HTML Reference Example
```html
<!-- Scroll list items container -->
<div class="grid gap-4">
  <div class="dt-surface p-4"><!-- Item --></div>
  <!-- ... -->
  
  <!-- Target element observed by scroll hook -->
  <div id="infinite-scroll-trigger" class="h-10 flex items-center justify-center text-xs text-dashboard-muted">
    <!-- Render loader if loading, otherwise keep empty -->
    <span>Loading more items...</span>
  </div>
</div>
```

### Usage Rules
*   Place the target div directly below the item container.
*   Only query the next page when the threshold marker is fully visible in the viewport.

---

## 15. Media Upload

### Current Implementation
*   Profile picture adjustment grids (`ImageCropper.tsx`), upload forms (`VerificationFileUpload.tsx`) with drop area triggers.

### Consistency Analysis
*   🟡 **Validation Errors:** Error rules and loading progress visuals differ.

### Recommended Standard
*   Provide a clear upload interface showing progress indicators.

### HTML Reference Example
```html
<div class="w-full flex flex-col gap-3">
  <!-- Drag-and-Drop Area -->
  <div class="border-2 border-dashed border-dashboard hover:border-dashboard-accent bg-dashboard-muted/10 hover:bg-dashboard-muted/20 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all">
    <span class="text-3xl mb-2">📤</span>
    <p class="text-sm font-semibold text-dashboard">Click to upload or drag files here</p>
    <p class="text-xs text-dashboard-muted mt-1">PDF, JPG, PNG up to 10MB</p>
    <input type="file" class="hidden" />
  </div>

  <!-- Upload Progress Item -->
  <div class="p-3 bg-dashboard-muted border border-dashboard rounded-xl flex items-center justify-between">
    <div class="flex-1 min-w-0 mr-3">
      <div class="flex justify-between text-xs text-dashboard-light mb-1">
        <span class="truncate">id_verification.pdf</span>
        <span>45%</span>
      </div>
      <div class="w-full bg-dashboard-sidebar h-1.5 rounded-full overflow-hidden">
        <div class="bg-dashboard-accent h-full" style="width: 45%"></div>
      </div>
    </div>
    <button type="button" class="text-dashboard-muted hover:text-dashboard">✕</button>
  </div>
</div>
```

### Usage Rules
*   Verify file sizes and extensions before initiating uploads.
*   Always render loading and progress indicators during upload actions.

---

## 16. Notifications

### Current Implementation
*   `sonner` toast system wrapper `useToast.ts` managing active toasts using a global ID map to prevent duplicate alerts.

### Consistency Analysis
*   🔴 **Bypassing the Hook:** Some pages import the raw `toast` component directly from `sonner`, bypassing the duplicate check tracking and causing duplicated spam messages.

### Recommended Standard
*   Adopt `useToast()` as the single standard for dispatching user notifications.

### HTML Reference Example
```html
<!-- Toast rendered by Sonner container -->
<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  <div class="bg-dashboard-sidebar border border-dashboard rounded-xl shadow-2xl p-4 flex items-center gap-3 max-w-sm">
    <span class="text-green-500">✓</span>
    <div class="flex-1">
      <p class="text-sm text-dashboard font-medium">Link Copied</p>
      <p class="text-xs text-dashboard-muted">Share link copied to your clipboard.</p>
    </div>
    <button type="button" class="text-dashboard-muted hover:text-dashboard">✕</button>
  </div>
</div>
```

### Usage Rules
*   Dismiss notification toasts automatically after 4 seconds (5 seconds for error events).
*   Limit active notification sheets to 3 visible overlays.
