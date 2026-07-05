---
Feature: person
Doc type: testing
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_prd.md, person_flow.md
---

# People — Testing Plan

Comprehensive manual and integration test scenarios for the People (Person Recommendations) feature.

---

## 1. Test Environment Setup

### Prerequisites
- Strapi running with `PersonList`, `RecommendedPerson`, and `Person_Category` collections created.
- Scraper endpoint `GET /api/people/scrape-profile` active.
- S3 upload credentials configured (for avatar downloading and portfolio screenshot hosting).
- Test creator account available.
- Frontend dev server running (`npm run dev`).
- Browser DevTools open to monitor GraphQL / network requests.

### Test Data Cleanup
Before starting a test suite run:
1. Log in to Strapi admin.
2. Navigate to **Person Lists** → delete any test lists.
3. Navigate to **Recommended People** → delete any test recommendations.

---

## 2. Creator Dashboard — Manual Test Scenarios

### TC-D1: Category Navigation (People Appears in Sidebar)
- **Precondition**: Creator logged in.
- **Steps**:
  1. On desktop (≥768px): Verify "People" sidebar item is visible.
  2. Click "People" in the sidebar → Verify navigation to `/dashboard/people`.
  3. Verify People Home view loads.
  4. On mobile (<768px): Go to dashboard landing `/dashboard` → Verify "People" card is visible.
  5. Tap "People" card → Verify navigation to `/dashboard/people`.

**Expected**: People navigation item appears and resolves correctly on both mobile and desktop.

**Pass/Fail**: ___

---

### TC-D2: Create Person List
- **Precondition**: Creator logged in, on People Home page.
- **Steps**:
  1. Click "+ New List".
  2. Verify modal opens.
  3. Enter List Name: "Top Design Mentors".
  4. Verify slug auto-generates: "top-design-mentors".
  5. Enter Description: "Curated list of designers who inspire me".
  6. Click "Create List" → Verify navigation inside the new list.
  7. Verify new list appears in People Home with a "Draft" badge.

**Expected**: List creation resolves instantly, auto-slug is correct, redirect occurs.

**Pass/Fail**: ___

---

### TC-D3: Add Person — Scraper Success (Auto-populate)
- **Precondition**: Creator is inside a person list.
- **Steps**:
  1. Click "+ Add Person".
  2. Paste a public LinkedIn profile URL (e.g. `https://linkedin.com/in/someprofile`).
  3. Click "Fetch Profile".
  4. Verify Name, Handle, Title/Headline, Primary Platform, and Avatar are populated from the scraped data.
  5. Add an endorsement note in the Tiptap editor.
  6. Set a rating of "9" on the endorsement slider.
  7. Click "Add to List".
  8. Verify redirect to the list view, and the new profile row displays the correct details and S3 avatar URL.

**Expected**: Pre-fills the fields. Saving works and avatar is successfully stored on S3.

**Pass/Fail**: ___

---

### TC-D4: Add Person — Scraper Failure (Manual Fallback)
- **Precondition**: Creator is inside the "+ Add Person" overlay.
- **Steps**:
  1. Paste a private or invalid URL (or disconnect the internet to force scraper failure).
  2. Click "Fetch Profile".
  3. Verify a warning toast displays: *"Could not fetch profile details automatically. Please enter details manually."*
  4. Verify all form fields (Name, Handle, Headline, Location, Sector) remain editable and empty.
  5. Manually enter:
     - Name: "Alex Designer"
     - Handle: "@alexd"
     - Headline: "Freelance Brand Expert"
     - Location: "London, UK"
     - Platform: `instagram`
     - Sector: `Designers`
  6. Upload a profile image file using the Avatar file selector.
  7. Click "Add to List".

**Expected**: Scraper failure does not block the user. The manual upload path creates the profile successfully.

**Pass/Fail**: ___

---

### TC-D5: Manage People in List — Reordering & Pinning
- **Precondition**: Creator has added 3 people to a list.
- **Steps**:
  1. Drag row 3 to row 1 using the grab handle (≡).
  2. Refresh the page → Verify the ordering remains as modified.
  3. Toggle the Star (⭐) icon on profile 1 and 2.
  4. Verify they appear under the "Top Picks" summary in the dashboard header.
  5. Attempt to pin 16 people → Verify warning toast blocks pinning at 15.

**Expected**: Drag-and-drop saves sorting index. Pinning limits function correctly.

**Pass/Fail**: ___

---

## 3. Public Profile — Manual Test Scenarios

### TC-P1: Public People Landing Page
- **Precondition**: List is published (Visibility = true).
- **Steps**:
  1. Open a new private browser window.
  2. Navigate to `/:username/people`.
  3. Verify the page header displays the profile name and total recommendations count.
  4. Verify Top Picks section displays pinned profiles at the top.
  5. Verify lists display as horizontal scrollable rows with circular avatar cards.

**Expected**: Public page loads and formats correctly. Draft lists are hidden.

**Pass/Fail**: ___

---

### TC-P2: Person Endorsement Detail Modal
- **Precondition**: Public page loaded.
- **Steps**:
  1. Tap on a circular person profile card.
  2. Verify slide-up overlay slides into view with `backdrop-blur-sm` backdrop.
  3. Verify profile image, name, headline, location, rating badge, and tags are correctly rendered.
  4. Verify the creator's endorsement note displays rich text formats.
  5. Click on the LinkedIn icon badge → Verify it opens the person's LinkedIn profile in a new tab.
  6. Swipe down on the modal (on mobile view) or click the close (×) button → Verify modal dismisses.

**Expected**: Detail modal displays all metadata and enables smooth dismissing.

**Pass/Fail**: ___

---

## 4. Integration & Security Scenarios

### TC-I1: S3 Self-Hosting Validation
- **Steps**:
  1. Inspect the DOM source for a public person card avatar.
  2. Verify that the image `src` points to our S3 bucket endpoint (`{s3-bucket-url}/people/avatar/...`) instead of Instagram or LinkedIn's direct CDN domains.

**Expected**: All profile avatars are hosted on S3 to prevent broken images.

**Pass/Fail**: ___
