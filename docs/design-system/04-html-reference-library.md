# HTML Reference Library — explorers.earth

**Version:** 1.0 (Canonical Reference)  
**Status:** 🔬 Framework-Agnostic Blueprint  

---

## 1. Buttons

### Purpose
Triggers actions, handles form submissions, and navigates layouts.

### Description
The primary action driver. Inside the dashboard, buttons map to dark forest variants (`bg-dashboard-accent`, `hover:brightness-110`). On public pages, they map to light editorial styles with bright interactive actions (`bg-[hsl(var(--blue-cta))]`, `hover:bg-[hsl(var(--blue-final))]`).

### Usage Rules
*   Use `type="button"` for general actions to prevent default form submits.
*   Use `type="submit"` only inside `<form>` elements when triggering standard submissions.
*   Set `disabled` dynamically to halt interactions during form loading states.

### Do's and Don'ts
*   ✅ **Do** add a visual loader/spinner during asynchronous operations.
*   ✅ **Do** use `aria-label` when rendering icon-only buttons.
*   ❌ **Don't** use a raw `<div>` with an `onClick` action when a standard `<button>` element is available.
*   ❌ **Don't** hide keyboard focus indicators (`outline-none`).

### Accessibility Notes
*   Ensure focus transitions remain visible: use `focus-visible:ring-2` to add outline rings for keyboard navigators.
*   Icon buttons must specify an explicit `aria-label` description of their actions.

### Responsive Behavior
Full-width behavior (`w-full`) is applied on mobile viewports (< 768px). Standard auto-widths are restored on larger screens.

### HTML Example
```html
<!-- Primary Dashboard Action Button -->
<button type="button" class="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold font-poppins rounded-md text-white bg-dashboard-accent hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent/60 transition-all duration-200">
  <span>Submit Settings</span>
</button>

<!-- Loading State Button -->
<button type="button" disabled class="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold font-poppins rounded-md text-white bg-dashboard-accent/50 cursor-not-allowed">
  <!-- Spinner Icon -->
  <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
  </svg>
  <span>Saving...</span>
</button>
```

### Suggested CSS Classes
*   Dashboard Primary: `bg-dashboard-accent hover:brightness-110 text-white`
*   Dashboard Secondary/Ghost: `text-dashboard-accent hover:bg-dashboard-muted/40`
*   Public Primary: `bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white`
*   Disabled State: `cursor-not-allowed opacity-50`

### Common Implementation Mistakes
*   Nesting interactive text links directly inside button containers.
*   Bypassing loading spinners, allowing users to trigger duplicate requests.

---

## 2. Text Input Fields

### Purpose
Captures plain text values within forms.

### Description
The base input field. It features placeholder styling, hover outline rings, and accessible focus outlines.

### Usage Rules
*   Always associate inputs with a sibling `<label>` tag using matching `for` and `id` values.
*   Use helper texts to clarify valid values.

### Do's and Don'ts
*   ✅ **Do** use `id` values that align with corresponding form labels.
*   ✅ **Do** style placeholders to be lighter than active text values.
*   ❌ **Don't** hide forms fields without including screen-reader descriptions.

### Accessibility Notes
*   Always include `id` and `label` connections.
*   Use `aria-invalid="true"` when form entries fail validation rules.

### Responsive Behavior
Inputs span 100% width on small screens and adapt to grid structures on desktop viewports.

### HTML Example
```html
<div class="flex flex-col gap-2 w-full">
  <label for="profileName" class="text-sm font-semibold text-dashboard font-poppins">Full Name</label>
  <input id="profileName" name="profileName" type="text" placeholder="e.g. Jane Doe" 
         class="w-full px-3 py-2 bg-dashboard-muted border border-dashboard rounded-md text-sm text-dashboard placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-dashboard-accent hover:border-dashboard-accent transition-colors duration-150" />
</div>
```

### Suggested CSS Classes
*   Dashboard Field: `bg-dashboard-muted border-dashboard text-dashboard`
*   Placeholder Style: `placeholder:text-white/40`
*   Focus Outline Ring: `focus:ring-2 focus:ring-dashboard-accent`

### Common Implementation Mistakes
*   Using placeholder strings as substitutes for visible input labels.
*   Removing default input outlines without providing an alternative focus indicator.

---

## 3. Password Input Fields

### Purpose
Captures secure password values with inline feedback.

### Description
Includes an overlay button to toggle password visibility. It integrates with real-time strength indicators to guide user choices.

### Usage Rules
*   Always disable credentials autocomplete during password creation steps.
*   Provide clear toggling controls for showing or hiding password values.

### Do's and Don'ts
*   ✅ **Do** include `autocomplete="new-password"` to prevent autofill collision.
*   ❌ **Don't** change the password value when toggling visibility.

### Accessibility Notes
*   Set the button element's `aria-label` description dynamically when visibility toggles.
*   Include `tabIndex="-1"` on show/hide triggers to keep key selectors clean.

### Responsive Behavior
Matches standard form columns, scaling dynamically across all screens.

### HTML Example
```html
<div class="flex flex-col gap-2 w-full">
  <label for="userPassword" class="text-sm font-semibold text-dashboard font-poppins">New Password</label>
  <div class="relative">
    <input id="userPassword" name="userPassword" type="password" autocomplete="new-password" placeholder="••••••••" 
           class="w-full pl-3 pr-12 py-2 bg-dashboard-muted border border-dashboard rounded-md text-sm text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent transition-colors" />
    <!-- Toggle Visibility Button -->
    <button type="button" aria-label="Show password" class="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors duration-150">
      👁️
    </button>
  </div>
  <!-- Strength Meter Indicator -->
  <div class="flex gap-1.5 mt-2">
    <div class="h-1 flex-1 bg-green-500 rounded-full"></div>
    <div class="h-1 flex-1 bg-green-500 rounded-full"></div>
    <div class="h-1 flex-1 bg-green-500 rounded-full"></div>
    <div class="h-1 flex-1 bg-gray-600 rounded-full"></div>
  </div>
</div>
```

### Suggested CSS Classes
*   Interactive Container: `relative`
*   Eye button overlay positioning: `absolute right-3 top-1/2 -translate-y-1/2`
*   Strength Bar Filled: `bg-green-500` / Empty: `bg-gray-600`

### Common Implementation Mistakes
*   Forgetting to set `type="button"` on the toggle trigger, which causes accidental form submissions.

---

## 4. Username Field (With Suggestions)

### Purpose
Handles live username verification and lists alternative options if the preferred username is taken.

### Description
Includes loading indicators for active query checks, along with interactive suggestions if a username is unavailable.

### Usage Rules
*   Run validation queries dynamically after typing pauses.
*   Announce input validity and list username suggestions.

### Do's and Don'ts
*   ✅ **Do** convert user keystrokes to lowercase automatically.
*   ✅ **Do** allow users to select from alternative suggestions.

### Accessibility Notes
*   List alternative suggestions in a container marked with `aria-live="polite"`.

### Responsive Behavior
Suggestions wrap onto multiple rows on small screens.

### HTML Example
```html
<div class="flex flex-col gap-2 w-full">
  <label for="usernameInput" class="text-sm font-semibold text-dashboard font-poppins">Choose Username</label>
  <div class="relative">
    <input id="usernameInput" name="username" type="text" value="john" class="w-full pl-3 pr-10 py-2 bg-dashboard-muted border border-red-500 rounded-md text-sm text-dashboard focus:outline-none" />
    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">✕</span>
  </div>
  <!-- Error Text -->
  <p class="text-xs text-red-400 font-poppins">This username is already taken.</p>
  
  <!-- Alternatives suggestions -->
  <div class="mt-2" aria-live="polite">
    <p class="text-xs text-white/60 mb-1">Available alternatives:</p>
    <div class="flex flex-wrap gap-1.5">
      <button type="button" class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium">john_123</button>
      <button type="button" class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors font-medium">john_earth</button>
    </div>
  </div>
</div>
```

### Suggested CSS Classes
*   Error border state: `border-red-500 focus:ring-red-500`
*   Suggestions pill design: `bg-blue-600 text-white text-xs hover:bg-blue-700 rounded`

### Common Implementation Mistakes
*   Overwhelming API servers by sending validation requests on every keystroke rather than debouncing inputs.

---

## 5. Toggle Switch

### Purpose
Toggles binary settings immediately.

### Description
A slider-style toggle switch. It is constructed using a hidden native input checkbox to maintain correct focus and keyboard controls.

### Usage Rules
*   Ensure toggle labels are clearly visible.
*   Use native inputs to handle default state management.

### Do's and Don'ts
*   ✅ **Do** style active outlines so keyboard focus states are obvious.
*   ❌ **Don't** use clickable generic divisions that lack keyboard accessibility.

### Accessibility Notes
*   The track wrapper should toggle the `aria-checked` status of the hidden input.
*   Apply the `role="switch"` attribute for assistive technology compatibility.

### Responsive Behavior
Maintains a compact layout across both mobile and desktop screens.

### HTML Example
```html
<label class="relative inline-flex items-center gap-3 cursor-pointer group">
  <!-- Hidden native input checkbox -->
  <input type="checkbox" role="switch" class="sr-only" checked />
  
  <!-- Custom Switch Track -->
  <div class="w-11 h-6 rounded-full bg-dashboard-accent transition-colors duration-300 focus-within:ring-2 focus-within:ring-offset-2">
    <!-- Sliding Toggle Knob -->
    <div class="w-5 h-5 bg-white rounded-full shadow-md mt-0.5 ml-0.5 transition-transform duration-300 transform translate-x-5"></div>
  </div>
  <span class="text-sm font-medium text-dashboard">Publish List</span>
</label>
```

### Suggested CSS Classes
*   Standard Switch Track: `w-11 h-6 rounded-full transition-colors`
*   Knob Translation (Off): `translate-x-0` / (On): `translate-x-5`
*   Hidden Access Class: `sr-only`

### Common Implementation Mistakes
*   Removing default input selectors from tab focus sequences.

---

## 6. Checkbox

### Purpose
Allows multi-selection options inside forms.

### Description
A custom checkbox. Uses an accessible native checkbox wrapper rather than a simple button tag to support standard form workflows.

### Usage Rules
*   Use native checkbox properties to handle checking behaviors.
*   Wrap indicators and text labels in a single interactive container.

### Do's and Don'ts
*   ✅ **Do** style focus indicators on custom check boxes.
*   ❌ **Don't** use button elements without attaching corresponding input controls.

### Accessibility Notes
*   Support focus outlining when users select input tags via keyboard tab controls.

### Responsive Behavior
Checkboxes are set to static dimensions to prevent layout displacement.

### HTML Example
```html
<label class="flex items-center gap-3 cursor-pointer select-none">
  <div class="relative">
    <input type="checkbox" class="sr-only" />
    <!-- Styled Box border -->
    <div class="w-5 h-5 rounded border border-dashboard bg-dashboard-muted hover:border-dashboard-accent flex items-center justify-center transition-colors">
      <!-- Check Icon (visible when checked) -->
      <span class="text-xs text-white">✓</span>
    </div>
  </div>
  <span class="text-sm text-dashboard-light">Accept terms</span>
</label>
```

### Suggested CSS Classes
*   Checkbox Container Box: `w-5 h-5 rounded border bg-dashboard-muted`
*   Focused State Indicator: `focus-within:ring-2 focus-within:ring-dashboard-accent`

### Common Implementation Mistakes
*   Omitting default outlines on checkboxes, which leaves keyboard users without a visual focus indicator.

---

## 7. Badge / Metadata Pills

### Purpose
Highlights statuses, day counts, and category tags.

### Description
Small layout labels with custom colors mapped to specific statuses (e.g. green for "Public" and gray/slate for "Draft").

### Usage Rules
*   Use badges only for static information display.
*   Choose standard colors that represent specific statuses consistently.

### Do's and Don'ts
*   ✅ **Do** maintain a consistent border-radius style.
*   ❌ **Don't** add click triggers directly on badged elements unless they are tag selectors.

### Accessibility Notes
*   Verify that text contrast matches standard guidelines on all badge backgrounds.

### Responsive Behavior
Labels adapt to text sizes and wrap cleanly on small screens.

### HTML Example
```html
<!-- Success/Active Status Badge -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  Public
</span>

<!-- Muted/Draft Status Badge -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
  Draft
</span>
```

### Suggested CSS Classes
*   Badge Base: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border`
*   Public Alert Color: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
*   Draft Style: `bg-gray-500/10 text-gray-400 border-gray-500/20`

### Common Implementation Mistakes
*   Using badge layouts as navigation tabs or action buttons without attaching the proper role attributes.

---

## 8. Cards

### Purpose
Displays location previews, ratings, and actions.

### Description
An image-focused layout card. Falls back to category gradients when location images are missing.

### Usage Rules
*   Wrap cards in standard semantic lists or grid panels.
*   Include category fallbacks if image data fails to load.

### Do's and Don'ts
*   ✅ **Do** use responsive image aspect ratios.
*   ❌ **Don't** layer multiple clickable elements within the card without handling event bubbling.

### Accessibility Notes
*   Use `aria-haspopup="menu"` on kebab menu triggers.
*   Ensure screen readers announce image alternative text descriptions.

### Responsive Behavior
Adapts to screen sizes (16:9 on desktop, square layouts on mobile cards).

### HTML Example
```html
<article class="relative w-full aspect-[4/3] rounded-xl overflow-hidden shadow-lg group cursor-pointer">
  <!-- Card Image -->
  <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800" alt="Scenic view of Paris" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
  
  <!-- Overlay Gradient -->
  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
  
  <!-- Category Badge (Top Left) -->
  <div class="absolute top-2 left-2 px-2 py-1 bg-black/40 backdrop-blur-sm rounded text-[10px] text-white font-medium uppercase tracking-wider">
    Food & Drinks
  </div>

  <!-- Content Info (Bottom Position) -->
  <div class="absolute bottom-0 left-0 right-0 p-4 text-white">
    <h3 class="text-sm font-semibold truncate">Chez Mon Ami</h3>
    <div class="flex items-center gap-1.5 mt-1">
      <span class="text-yellow-400 text-xs">★</span>
      <span class="text-xs font-semibold">4.8</span>
      <span class="text-[10px] text-white/60">(142 reviews)</span>
    </div>
  </div>
</article>
```

### Suggested CSS Classes
*   Image Scale Transition: `transition-transform duration-300 group-hover:scale-105`
*   Bottom positioning: `absolute bottom-0 left-0 right-0 p-4`

### Common Implementation Mistakes
*   Forgetting to include alternative text on card images.

---

## 9. Modals

### Purpose
Shows temporary focus dialog overlays.

### Description
Portal-backed dialog overlays. Darkens the page backdrop and displays focused settings or confirmation options.

### Usage Rules
*   Always structure modals using React portals for proper layout insertion.
*   Allow users to close modals by clicking on the backdrop or pressing the Escape key.

### Do's and Don'ts
*   ✅ **Do** lock page scrolling when modal views are active.
*   ❌ **Don't** implement nested modals when single overlays are sufficient.

### Accessibility Notes
*   Set `role="dialog"` and `aria-modal="true"` on the modal wrapper.
*   Include descriptive `aria-labelledby` targets pointing to the modal title.

### Responsive Behavior
Modals are full-width on mobile viewports and scale to centered card designs on desktop screens.

### HTML Example
```html
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <div class="relative w-full max-w-md bg-dashboard-sidebar border border-dashboard rounded-2xl overflow-hidden shadow-2xl flex flex-col">
    <!-- Close Action -->
    <button type="button" aria-label="Close modal" class="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10">
      ✕
    </button>
    
    <!-- Header -->
    <div class="p-6">
      <h2 id="modalTitle" class="text-lg font-bold text-dashboard mb-2">Edit Location Details</h2>
      <p class="text-xs text-dashboard-muted">Update the display details for this recommendation list.</p>
    </div>

    <!-- Scrollable Content -->
    <div class="px-6 py-2 overflow-y-auto max-h-[60vh] flex flex-col gap-4">
      <!-- Input fields go here -->
    </div>

    <!-- Footer Actions -->
    <div class="p-4 bg-dashboard-muted/20 border-t border-dashboard flex justify-end gap-3">
      <button class="px-4 py-2 text-xs font-semibold rounded-md text-dashboard-light hover:bg-dashboard-muted">Cancel</button>
      <button class="px-4 py-2 text-xs font-semibold rounded-md bg-dashboard-accent text-white">Save Changes</button>
    </div>
  </div>
</div>
```

### Suggested CSS Classes
*   Page Backdrop Overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm`
*   Header positioning: `p-6` / Actions: `bg-dashboard-muted/20 border-t border-dashboard p-4`

### Common Implementation Mistakes
*   Failing to lock focus inside the modal, allowing keyboard users to tab to background elements.

---

## 10. Dropdowns & Search Select

### Purpose
Allows searchable selection from a list of categories.

### Description
A searchable category select menu. Features dynamic dropdown filtering and list scroll states.

### Usage Rules
*   Show matches dynamically as the user types.
*   Include "No results found" fallbacks for failed queries.

### Do's and Don'ts
*   ✅ **Do** clear input values when users trigger the selector dropdown.
*   ❌ **Don't** overflow lists outside of standard viewports.

### Accessibility Notes
*   Add `aria-expanded="false/true"` to the input trigger.
*   Add `role="listbox"` to the options selection box.

### Responsive Behavior
Dropdown lists adapt to input widths on all screens.

### HTML Example
```html
<div class="relative w-full">
  <label for="categoryInput" class="text-sm font-semibold text-dashboard font-poppins">Select Category</label>
  <div class="relative mt-1">
    <input id="categoryInput" type="text" placeholder="Search categories..." aria-expanded="true" aria-controls="optionsList" 
           class="w-full pl-3 pr-10 py-2 bg-dashboard-muted border border-dashboard rounded-md text-sm text-dashboard outline-none focus:ring-2 focus:ring-dashboard-accent" />
    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-dashboard-light">▼</span>
  </div>

  <!-- Options Menu Box -->
  <ul id="optionsList" role="listbox" class="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-dashboard-sidebar border border-dashboard rounded-md shadow-lg py-1">
    <li role="option" aria-selected="true" class="px-4 py-2 text-sm text-white bg-dashboard-accent cursor-pointer">
      Food & Drinks
    </li>
    <li role="option" aria-selected="false" class="px-4 py-2 text-sm text-dashboard-light hover:bg-dashboard-muted cursor-pointer">
      Lodging
    </li>
  </ul>
</div>
```

### Suggested CSS Classes
*   Options Box Scroll: `absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-dashboard-sidebar`
*   Selected List Item: `bg-dashboard-accent text-white`

### Common Implementation Mistakes
*   Using generic lists without correct ARIA options markup.

---

## 11. Tabs

### Purpose
Toggles between separate dashboard views.

### Description
Interactive navigation pills that display target content views based on selection.

### Usage Rules
*   Use simple text pills for standard category selections.
*   Use circular icon tabs to differentiate major features.

### Do's and Don'ts
*   ✅ **Do** style active tabs clearly.
*   ❌ **Don't** use tabs for site-wide navigation (use links instead).

### Accessibility Notes
*   Apply the `role="tablist"` and `role="tab"` attributes.
*   Track selection status using `aria-selected="true"`.

### Responsive Behavior
Tab rows wrap or enable horizontal scrolling on small screens to prevent layout breakages.

### HTML Example
```html
<!-- Tab list wrapper -->
<div class="flex border-b border-dashboard w-full overflow-x-auto scrollbar-hide" role="tablist">
  <button role="tab" aria-selected="true" aria-controls="viewPanel" 
          class="px-4 py-2.5 text-sm font-semibold font-poppins text-dashboard-accent border-b-2 border-dashboard-accent whitespace-nowrap outline-none">
    Places
  </button>
  <button role="tab" aria-selected="false" aria-controls="viewPanel" 
          class="px-4 py-2.5 text-sm font-semibold font-poppins text-dashboard-light hover:text-dashboard whitespace-nowrap outline-none">
    People
  </button>
</div>
```

### Suggested CSS Classes
*   Selected Tab Trigger: `text-dashboard-accent border-b-2 border-dashboard-accent`
*   Category wrapper layout: `flex border-b border-dashboard overflow-x-auto`

### Common Implementation Mistakes
*   Using tabs without associated content panels (`role="tabpanel"`).

---

## 12. Accordions

### Purpose
Toggles the visibility of collapsable content sections.

### Description
Expandable lists that animate open using smooth height transitions.

### Usage Rules
*   Ensure header tags are clickable triggers.
*   Support smooth toggle height shifts.

### Do's and Don'ts
*   ✅ **Do** include indicator icons that rotate when expanded.
*   ❌ **Don't** nest accordions multiple levels deep.

### Accessibility Notes
*   Use `aria-expanded="false/true"` to represent state changes.
*   Link headers to content areas using matching `id` and `aria-controls` bindings.

### Responsive Behavior
Maintains a clean layout across all screens.

### HTML Example
```html
<div class="border border-dashboard bg-dashboard-sidebar rounded-xl overflow-hidden">
  <!-- Accordion Trigger Header -->
  <h3>
    <button type="button" aria-expanded="true" aria-controls="accordionBody" 
            class="w-full flex justify-between items-center px-5 py-4 text-dashboard font-poppins font-semibold hover:bg-dashboard-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent/30">
      <span>Frequently Asked Questions</span>
      <span class="transform rotate-180 transition-transform duration-200 text-dashboard-light">▼</span>
    </button>
  </h3>
  
  <!-- Accordion Content Panel -->
  <div id="accordionBody" role="region" class="border-t border-dashboard bg-dashboard-sidebar px-5 py-4 transition-all duration-300">
    <p class="text-sm text-dashboard-light leading-relaxed font-poppins">
      You can add recommendations by clicking the Add Place button on your dashboard.
    </p>
  </div>
</div>
```

### Suggested CSS Classes
*   Accordion Container: `border border-dashboard bg-dashboard-sidebar rounded-xl`
*   Header trigger: `w-full flex justify-between items-center`
*   Chevron Rotation on Open: `rotate-180` / Closed: `rotate-0`

### Common Implementation Mistakes
*   Using inline style height changes that break browser layout calculations.
