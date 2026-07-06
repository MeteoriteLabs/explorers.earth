---
Feature: person
Doc type: flow
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_prd.md
---

# People — User Flows

## Creator Flows (Dashboard)

### Flow 1: First Time Entering People Category
1. Creator logs in → lands on dashboard.
2. Desktop: sidebar shows Places + Movies & Shows + Books + Products + People (new).
   - Mobile: category grid shows "People" card.
3. Creator clicks "People".
4. People Home view loads → empty state shown.
   - Message: "No lists yet. Create your first list of people to start recommending profiles."
5. Prominent "+ Create Your First List" button displayed.

### Flow 2: Create Person List
1. Creator clicks "+ New List".
2. Modal opens with fields:
   - List Name (required text input)
   - Description (optional textarea)
   - Cover Image (optional file picker)
3. Slug auto-generates from List Name (e.g., "Top Product Designers" → "top-product-designers").
4. Creator can manually edit slug.
5. Creator clicks "Create List".
6. **System Actions:**
   - Creates PersonList in Strapi.
   - Sets Visibility: false (draft by default).
7. **Navigation:** Creator is navigated inside the new list (empty state).
8. **State Change:** List appears in People Home with "Draft" status badge.

### Flow 3: Add Person to List
1. Creator is inside a person list.
2. Creator clicks "+ Add Person".
3. Full-page overlay opens at path: `/:listId/new-person`.

#### 3a. Profile URL Scraper Step
1. Creator enters or pastes a social media profile link (Instagram or LinkedIn).
   - Example: `https://linkedin.com/in/janedoe` or `https://instagram.com/janedoe`
2. Creator clicks "Fetch Profile".
3. **System Actions:**
   - Backend scraper attempts to retrieve public Open Graph metadata.
4. **Scraper Outcome:**
   - **Success (Pre-fill)**: Form automatically pre-fills Name, Username/Handle, Headline/Bio, Primary Platform (enum), and fetches the avatar thumbnail.
   - **Failure (Manual Entry Fallback)**: If blocked or rate-limited, system shows a brief toast: *"Could not fetch profile details automatically. Please enter details manually below."* and expands all empty fields.

#### 3b. Detail Form Step
1. Form fields displayed:
   - Circular Avatar (scraped, editable via manual file upload to S3).
   - Name (required).
   - Username/Handle (optional).
   - Headline/Title (optional, e.g. "Lead UX Designer @ Figma").
   - Location (optional, e.g. "Austin, TX").
   - Primary Platform (required, enum selector).
   - Industry Sector (required, selection maps to `People_Category` like "Designers", "Founders").
   - Personal Endorsement Note (rich text, Tiptap).
   - Endorsement Score / Rating (optional 1-10 slider).
   - Social URLs Accordion (add secondary links: LinkedIn, Instagram, X, GitHub, Website, YouTube).
   - Portfolio / Work Screenshots (drag-and-drop S3 upload, up to 10 images).
   - "Add to Top Picks" checkbox.
2. Creator clicks "Add to List".
3. **System Actions:**
   - Creates `RecommendedPerson` in Strapi.
   - Downloads the scraped avatar image and uploads it to S3, saving the path in `avatar_path`.
   - If "Add to Top Picks" checked, sets `isPinned: true` and assigns next available `pinOrder`.
4. **Navigation:** Back to list view.

### Flow 4: Edit Person
1. Creator clicks ⋮ menu on a person row → "Edit".
2. Full-page overlay opens with pre-filled fields.
3. Creator updates note, rating, tags, platform URLs, or uploads new portfolio screenshots.
4. Creator clicks "Save".
5. **System Actions:** Updates `RecommendedPerson` in Strapi, handles any new S3 uploads.
6. **Navigation:** Back to list view.

### Flow 5: Reorder People in List
1. Creator is inside the list view (Sort set to "Custom").
2. Creator holds the drag handle (≡) on a person's row.
3. Drags row to desired position and drops it.
4. **System Actions:** Batch-updates `display_order` for affected profiles.

### Flow 6: Pin / Unpin Top Picks
1. Creator toggles the star (⭐) icon on a person's row.
2. **Toggle Logic:**
   - Unpinned → Pinned: sets `isPinned = true`, assigns next available `pinOrder`.
   - Pinned → Unpinned: sets `isPinned = false`, resets `pinOrder = null`.
   - Limit check: Max 15 pinned items. If exceeded, shows warning toast.

### Flow 7: Manage List Settings & QR Codes
1. Creator clicks the "Manage" tab inside a list.
2. **Manage tab displays:**
   - Shareable list URL: `explorers.earth/[username]/people/[list-slug]`.
   - Copy Link button.
   - QR code widget with PNG download action.
   - Visibility toggle (Draft / Published Switch).
   - Edit Name/Description/Slug.
   - Delete List button (requires confirmation).

---

## Visitor Flows (Public Page)

### Flow 8: Browse Curated Network
1. Visitor navigates to `/:username/people`.
2. **Page loads with:**
   - Header: "[Creator]'s Network · [count] people recommended".
   - Top Picks Showcase (cinematic hero row or swipe deck featuring pinned profiles).
   - Curated list rows showing circular profile avatars with names, headlines, and primary platform logos.
   - Industry Sectors browse buttons at the bottom.
3. Visitor actions:
   - Tapping primary platform logo: redirects directly to their external profile.
   - Tapping profile card: opens slide-up modal with detailed endorsement.

### Flow 9: View Endorsement Details Modal
1. Visitor taps a person's card.
2. **Detail Modal slides up containing:**
   - Large avatar, name, location, and headline.
   - Clickable brand buttons for all configured social profiles (Instagram, LinkedIn, X, GitHub, Website).
   - Sector badge + custom tags (skills).
   - Creator's endorsement note (rich text formatting).
   - Rating score out of 10.
   - Work/Portfolio image carousel (if uploaded).
   - Close button or swipe-down to dismiss on mobile.

### Flow 10: Browse Sector Grid
1. Visitor taps a sector button (e.g. "Designers").
2. Grid page opens at `/:username/people/sector/designers`.
3. Displays a grid layout of all profiles categorized under that sector across the creator's public lists.
