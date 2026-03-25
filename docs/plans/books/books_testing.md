---
Feature: books
Doc type: testing
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_prd.md, books_flow.md
---

# Books — Testing Plan

Comprehensive manual and integration test scenarios for the Books feature. Mirrors the testing approach from Movies & Shows.

---

## 1. Test Environment Setup

### Prerequisites
- Strapi running with `BookList`, `RecommendedBook`, `Book_Category` collections created
- `VITE_GOOGLE_BOOKS_API_KEY` set in `.env.local`
- Test creator account available (the `test-creator` account or your own)
- Frontend dev server running (`npm run dev`)
- At least one browser on desktop and one on mobile (or DevTools mobile viewport)

### Test Data Cleanup
Before each test session, clear test book lists:
```
1. Log in to Strapi admin
2. Navigate to Book Lists → delete any test lists
3. Navigate to Recommended Books → delete any test books
```

---

## 2. Creator Dashboard — Manual Test Scenarios

### TC-D1: Category Navigation (Books Appears in Sidebar)

**Precondition:** Creator logged in, on `/recommendations`

**Steps:**
1. On desktop (≥768px): Verify Books sidebar item is visible alongside Places and Movies & Shows
2. Click "Books" in the sidebar
3. Verify navigation to `/recommendations/books`
4. Verify Books Home view loads
5. On mobile (<768px): Navigate to `/recommendations`
6. Verify "Books" category card is visible alongside Places and Movies & Shows cards
7. Tap "Books" card
8. Verify navigation to `/recommendations/books`

**Expected:** Books navigation item appears in both sidebar (desktop) and category cards (mobile). Clicking navigates correctly.

**Pass/Fail:** ___

---

### TC-D2: First Time — Empty State

**Precondition:** Creator has no book lists

**Steps:**
1. Navigate to `/recommendations/books`
2. Verify empty state message is displayed
3. Verify "+ Create Your First List" CTA button is visible

**Expected:** Clear empty state with call-to-action. No errors.

**Pass/Fail:** ___

---

### TC-D3: Create Book List

**Precondition:** Creator logged in, on Books Home

**Steps:**
1. Click "+ New List" button
2. Verify modal opens
3. Enter List Name: "Life-Changing Reads"
4. Verify slug auto-generates: "life-changing-reads"
5. Enter Description: "Books that shifted my perspective"
6. Click "Create List"
7. Verify modal closes
8. Verify new list appears in Books Home with "Draft" badge
9. Verify navigation moves to inside the new list
10. Verify empty state shown inside the list

**Expected:** List creates successfully, slug auto-generated, draft status. Navigate into list.

**Pass/Fail:** ___

---

### TC-D4: Slug Uniqueness

**Precondition:** List "Life-Changing Reads" (slug: "life-changing-reads") already exists

**Steps:**
1. Create another list with the same name "Life-Changing Reads"
2. Verify slug auto-generates as "life-changing-reads-2" (or similar unique variant)
3. Verify both lists coexist without conflict

**Expected:** Slug collision handled gracefully with auto-increment.

**Pass/Fail:** ___

---

### TC-D5: Add Book — Search and Select

**Precondition:** Creator inside a book list

**Steps:**
1. Click "+ Add Book"
2. Verify full-page overlay opens
3. Type "Atomic Habits" in search bar
4. Wait 300ms (debounce)
5. Verify Google Books results appear with: cover, title, author, publisher, year
6. Verify at least one result shows "James Clear" as author
7. Click "Select" on the Atomic Habits result
8. Verify auto-filled form appears with:
   - Large cover image displayed
   - Title: "Atomic Habits"
   - Author: "James Clear"
   - Publisher visible
   - Year visible
   - Page count visible
   - Subjects/categories listed
9. Verify "Change Selection" link is present

**Expected:** Search results populated within 1 second. Selection auto-fills all available metadata.

**Pass/Fail:** ___

---

### TC-D6: Add Book — ISBN Search

**Precondition:** Creator on Add Book overlay

**Steps:**
1. Type "9780735211292" (Atomic Habits ISBN-13) in search bar
2. Wait 300ms
3. Verify Atomic Habits appears in results
4. Select it

**Expected:** ISBN search works. Correct book returned.

**Pass/Fail:** ___

---

### TC-D7: Add Book — Complete Form and Save

**Precondition:** Creator has selected a book in Add Book overlay

**Steps:**
1. With Atomic Habits selected, scroll to note field
2. Type a personal note: "This book completely changed how I think about habits."
3. Select 10-star user rating (click 10th star)
4. Verify Google Books buy link is auto-added in "Where to Find" section (if available)
5. Click "Add to Top Reads" checkbox
6. Click "Add to List"
7. Verify navigation returns to book list view
8. Verify "Atomic Habits" appears in the list with cover thumbnail, title, author
9. Verify pin/star icon indicates book is pinned (⭐ filled)

**Expected:** Book saves with all metadata. Appears in list. Pinned correctly.

**Pass/Fail:** ___

---

### TC-D8: Add Book — No Cover Available

**Precondition:** Creator on Add Book overlay

**Steps:**
1. Search for a very obscure book unlikely to have a cover image
2. Select a result with no cover image
3. Verify fallback placeholder image is shown in the form
4. Save the book
5. Verify book row shows fallback placeholder cover thumbnail in list

**Expected:** Fallback placeholder image used throughout. No broken image icons.

**Pass/Fail:** ___

---

### TC-D9: Add Book — Multiple Authors

**Precondition:** Creator on Add Book overlay

**Steps:**
1. Search for "Good Omens Gaiman Pratchett"
2. Select a result with multiple authors
3. Verify both "Neil Gaiman" and "Terry Pratchett" appear in the author field
4. Save the book
5. Verify in book list row: first author shown + "et al." or all authors comma-separated

**Expected:** Multiple authors stored and displayed correctly.

**Pass/Fail:** ___

---

### TC-D10: Edit Book

**Precondition:** At least one book exists in a list

**Steps:**
1. Click ⋮ menu on a book row → "Edit"
2. Verify full-page overlay opens with pre-filled data:
   - Note field shows previously saved note
   - Star rating shows previously selected stars
   - Buy links show previously saved links
3. Change the note to: "Updated recommendation note."
4. Change rating to 4 stars
5. Click "Save"
6. Verify changes reflected in list view (note preview updated)

**Expected:** Edit loads pre-filled data. Changes save correctly.

**Pass/Fail:** ___

---

### TC-D11: Delete Book

**Precondition:** At least one book exists in a list

**Steps:**
1. Click ⋮ menu on a book row → "Delete"
2. Verify confirmation dialog appears with book title
3. Cancel → verify book still in list
4. Open ⋮ menu → "Delete" again
5. Confirm deletion
6. Verify book removed from list view

**Expected:** Cancel does not delete. Confirm removes book from list.

**Pass/Fail:** ___

---

### TC-D12: Pin / Unpin Book

**Precondition:** Book exists in list, is NOT pinned

**Steps:**
1. Click ⭐ (empty star) on a book row
2. Verify star icon fills/glows (pinned state)
3. Navigate to Books Home
4. Verify book appears in Top Reads strip
5. Navigate back into the list
6. Click ⭐ (filled star) on the same book row
7. Verify star empties (unpinned)
8. Navigate to Books Home
9. Verify book no longer in Top Reads strip

**Expected:** Pin toggle works in both directions. Top Reads updates in real-time.

**Pass/Fail:** ___

---

### TC-D13: Pin Limit (15 Max)

**Precondition:** Creator has exactly 15 books pinned

**Steps:**
1. Attempt to pin a 16th book
2. Verify error/info message: "You've reached the maximum of 15 Top Reads. Unpin a book first."
3. Verify star toggle does not fire the pin mutation

**Expected:** 16th pin blocked with clear message.

**Pass/Fail:** ___

---

### TC-D14: Reorder Books in List

**Precondition:** At least 3 books exist in a list, Sort set to "Custom"

**Steps:**
1. Note the current order of books (Book A, Book B, Book C)
2. Drag Book C by its drag handle to the first position
3. Release drop
4. Verify list now shows: Book C, Book A, Book B
5. Refresh the page
6. Verify order persists after refresh

**Expected:** Drag-and-drop works. Order persists via Strapi mutation.

**Pass/Fail:** ___

---

### TC-D15: Top Reads Manager

**Precondition:** At least 3 books are pinned across lists

**Steps:**
1. From Books Home, click "Manage" on Top Reads strip
2. Verify Top Reads Manager opens at `/recommendations/books/top-reads`
3. Verify counter shows "X/15 reads used"
4. Verify all pinned books are listed with cover, title, author, source list
5. Change the display name to "Books That Changed My Life"
6. Drag one book to a different position
7. Click × on another book to unpin
8. Navigate to public page
9. Verify display name updated. Verify order reflects changes. Verify unpinned book is gone.

**Expected:** Top Reads Manager shows all pinned books. Display name, reorder, and unpin all work.

**Pass/Fail:** ___

---

### TC-D16: Publish / Unpublish List

**Precondition:** Book list exists with at least 1 book, currently Draft

**Steps:**
1. Toggle the Visibility switch to Published on the list card
2. Verify toggle state changes immediately
3. Navigate to `/:username/books` (public page)
4. Verify the list appears as a carousel row
5. Toggle back to Draft
6. Refresh public page
7. Verify list no longer appears on public page

**Expected:** Publish toggle works. Public page reflects immediately.

**Pass/Fail:** ___

---

### TC-D17: Manage Tab — Share URL and QR Code

**Precondition:** Creator inside a book list

**Steps:**
1. Click "Manage" tab
2. Verify shareable URL is displayed: `explorers.earth/{username}/books/{slug}`
3. Click copy button
4. Verify toast confirmation appears
5. Paste in new tab (or notepad) — verify correct URL
6. Verify QR code is rendered
7. Verify QR code encodes the shareable URL (scan or inspect)

**Expected:** URL correct, copy works, QR code renders correctly.

**Pass/Fail:** ___

---

### TC-D18: Move Book to Another List

**Precondition:** 2+ book lists exist, book exists in List A

**Steps:**
1. Click ⋮ on a book row → "Move to..."
2. Verify picker shows all other lists (not the current list)
3. Select List B
4. Verify book disappears from List A
5. Navigate to List B
6. Verify book appears in List B

**Expected:** Book moved between lists correctly.

**Pass/Fail:** ___

---

### TC-D19: Delete List (with Confirmation)

**Precondition:** Creator inside a book list

**Steps:**
1. Navigate to Manage tab
2. Click "Delete List" button
3. Verify confirmation modal: "This will delete the list and all X books in it."
4. Cancel → verify list still exists
5. Click Delete again → confirm
6. Verify redirect to Books Home
7. Verify deleted list no longer appears

**Expected:** List and all books deleted. Cancel works. Redirect to home.

**Pass/Fail:** ___

---

## 3. Public Page — Manual Test Scenarios

### TC-P1: Public Books Page Loads

**Precondition:** Creator has at least 1 published list with books

**Steps:**
1. Navigate to `/{username}/books` (logged out)
2. Verify page loads without errors
3. Verify header: "[Creator Name]'s Books · [N] books"
4. Verify at least one carousel row is rendered

**Expected:** Public page accessible. Correct header. Carousel rows visible.

**Pass/Fail:** ___

---

### TC-P2: Top Reads Carousel Row

**Precondition:** Creator has at least 1 pinned book

**Steps:**
1. Navigate to `/{username}/books`
2. Verify Top Reads row appears FIRST before other lists
3. Verify row heading matches creator's custom name (e.g., "Books That Changed My Life") or default "Top Reads"
4. Verify correct books appear in correct pin_order
5. Horizontal scroll through the row

**Expected:** Top Reads appears first. Custom heading respected. Books in correct order. Scrollable.

**Pass/Fail:** ___

---

### TC-P3: List Carousel Rows Display

**Precondition:** Creator has 2+ published lists with books

**Steps:**
1. Navigate to `/{username}/books`
2. Verify each published list appears as a separate carousel row
3. Verify rows are in creator-defined display_order
4. Verify each row has: list name heading, ">" link, book count, horizontal cover cards
5. Horizontally scroll each row

**Expected:** Each list is a row. Order correct. Scrollable. Heading links visible.

**Pass/Fail:** ___

---

### TC-P4: Book Cover Card

**Precondition:** Public books page loaded

**Steps:**
1. Inspect a book cover card in a carousel
2. Verify cover image displays (or fallback placeholder if no cover)
3. Verify book title below cover (truncated if long)
4. Verify author below title (first author or "et al.")
5. Verify rating badge in bottom-right corner
6. Hover over card (desktop) — verify 1.05x scale animation
7. Tap/click card → verify detail modal opens

**Expected:** Card shows all elements. Hover animation works. Tap opens modal.

**Pass/Fail:** ___

---

### TC-P5: Book Detail Modal

**Precondition:** Tapped a book cover card

**Steps:**
1. Verify modal slides up from bottom
2. Verify drag bar at top (mobile)
3. Verify close button (×) visible
4. Verify large cover image
5. Verify title, subtitle (if any), author(s) (full list)
6. Verify publisher, year, page count
7. Verify subjects as chip tags
8. Verify creator's note section (formatted)
9. Verify creator's star rating (1-5 glowing yellow stars)
10. Verify Google rating displayed (if available)
11. Verify "Where to Find" section with buy link badges (if any)
12. Verify "From the list: [list name] →" link
13. Verify Share button
14. Swipe down → verify modal closes
15. Tap × → verify modal closes
16. Tap buy link badge → verify opens in new tab

**Expected:** All detail sections render correctly. Close gestures work. Buy links work.

**Pass/Fail:** ___

---

### TC-P6: Public List Grid Page

**Precondition:** Public books page loaded

**Steps:**
1. Click list heading ">" link in a carousel row
2. Verify navigation to `/{username}/books/{listSlug}`
3. Verify "← [Creator]'s Books" back link
4. Verify list name as page heading
5. Verify list description below heading (if set)
6. Verify book count
7. Verify cover grid layout:
   - 3 columns on mobile
   - 5+ columns on desktop
8. Tap a book cover → verify detail modal opens
9. Click back link → verify return to main books page

**Expected:** Grid page loads correctly. Back navigation works. Modal opens from grid.

**Pass/Fail:** ___

---

### TC-P7: Subject Browse Section

**Precondition:** Creator has books with different subjects

**Steps:**
1. Navigate to `/{username}/books`
2. Scroll to bottom
3. Verify "Browse by Subject" section header
4. Verify subject cards are displayed:
   - Book cover image as background
   - Subject name text
   - Book count
5. Verify 2-column grid on mobile, 4-column on desktop
6. Verify only subjects with ≥1 book shown (no empty subjects)

**Expected:** Subject cards display with correct subjects, counts, and cover backgrounds.

**Pass/Fail:** ___

---

### TC-P8: Subject Page

**Precondition:** Subject browse section visible

**Steps:**
1. Tap a subject card (e.g., "Self-Help")
2. Verify navigation to `/{username}/books/subject/self-help`
3. Verify subject name as heading
4. Verify book count
5. Verify cover grid shows ALL books with that subject from ALL published lists
6. Verify no duplicate books (same volume_id appears only once)
7. Tap a book → verify detail modal opens
8. Click back link → verify return to main books page

**Expected:** Subject page loads all matching books across all lists. Deduplication applied.

**Pass/Fail:** ___

---

### TC-P9: Empty States (Public)

**Precondition:** Creator has NO published lists / No pinned books

**Steps:**
1. Navigate to `/{username}/books`
2. Verify empty state message displayed
3. Verify No Top Reads row shown if no pinned books
4. Verify No subject browse section if no published lists

**Expected:** Graceful empty states. No broken components.

**Pass/Fail:** ___

---

### TC-P10: Google Books Attribution

**Precondition:** Public books page loaded with books

**Steps:**
1. Scroll to footer of the public books page
2. Verify "Powered by Google" or "Book data provided by Google Books" attribution text/badge

**Expected:** Attribution badge visible per Google Books requirements.

**Pass/Fail:** ___

---

## 4. Google Books Service — Integration Tests

### TC-API1: Search Returns Results

**Steps:**
```typescript
import { searchBooks } from '@/services/googleBooksService';

const results = await searchBooks('Atomic Habits');
console.assert(results.length > 0, 'Should return results');
console.assert(results[0].volumeInfo.title !== undefined, 'Should have title');
console.assert(results[0].volumeInfo.authors !== undefined, 'Should have authors');
```

**Expected:** Returns non-empty result array with title and authors.

---

### TC-API2: Volume Details Fetch

**Steps:**
```typescript
const detail = await getVolumeDetails('XfFvDwAAQBAJ'); // Atomic Habits ID
console.assert(detail.id === 'XfFvDwAAQBAJ');
console.assert(detail.volumeInfo.title === 'Atomic Habits');
```

**Expected:** Correct volume returned.

---

### TC-API3: Cover URL HTTPS Upgrade

**Steps:**
```typescript
const httpUrl = 'http://books.google.com/books/content?id=test&zoom=1';
const result = upgradeToHttps(httpUrl);
console.assert(result.startsWith('https://'), 'Should be HTTPS');
```

**Expected:** HTTP upgraded to HTTPS.

---

### TC-API4: ISBN Search

**Steps:**
```typescript
const results = await searchBooks('9780735211292');
// Should use q=isbn:9780735211292 internally
console.assert(results.some(r => r.volumeInfo.title === 'Atomic Habits'));
```

**Expected:** ISBN search returns correct book.

---

### TC-API5: Empty Search Results Handled

**Steps:**
```typescript
const results = await searchBooks('xyzxyzxyz12345678randomgarbage');
console.assert(Array.isArray(results), 'Should return empty array, not throw');
console.assert(results.length === 0, 'Should be empty');
```

**Expected:** Empty array returned, no exception thrown.

---

### TC-API6: Data Mapping Transforms Correctly

**Steps:**
```typescript
import { transformGoogleBooksResult } from '@/features/Books/utils/bookHelpers';

const mockItem = { id: 'abc', volumeInfo: { title: 'Test Book', publishedDate: '2020-05-15', ... }, saleInfo: {} };
const mapped = transformGoogleBooksResult(mockItem);
console.assert(mapped.volume_id === 'abc');
console.assert(mapped.year === '2020');
console.assert(mapped.cover_url?.startsWith('https://'));
```

**Expected:** All fields mapped correctly and HTTPS-upgraded.

---

## 5. Cross-Cutting Test Scenarios

### TC-X1: No Regression — Places Feature

**Steps:**
1. Navigate to `/recommendations` (Places dashboard)
2. Verify Places loads normally
3. Verify sidebar shows Places as active
4. Verify existing place lists display
5. Add a place to a list (abbreviated — just verify form opens)

**Expected:** Places feature entirely unaffected. No visual or functional regressions.

**Pass/Fail:** ___

---

### TC-X2: No Regression — Movies & Shows Feature

**Steps:**
1. Navigate to `/recommendations/movies` (Movies dashboard)
2. Verify Movies & Shows loads normally
3. Verify sidebar shows Movies & Shows as active
4. Verify existing movie lists display
5. Navigate to a public movies page

**Expected:** Movies & Shows feature entirely unaffected.

**Pass/Fail:** ___

---

### TC-X3: Loading Skeletons

**Steps:**
1. Throttle network to "Slow 3G" in DevTools
2. Navigate to `/{username}/books`
3. Verify skeleton placeholders appear while data loads
4. Verify skeletons replace with actual content after load

**Expected:** Skeletons shown during load. Smooth transition to content.

**Pass/Fail:** ___

---

### TC-X4: Responsive Layout — Mobile

**Steps (using DevTools iPhone SE viewport):**
1. Verify Books category card appears in 2 or 3 column grid (not truncated)
2. Verify carousel row scrolls horizontally with touch
3. Verify 3-column cover grid on list/subject pages
4. Verify detail modal is fullscreen on mobile
5. Verify swipe-down-to-dismiss works in detail modal

**Expected:** All components adapt correctly to mobile viewport.

**Pass/Fail:** ___

---

### TC-X5: Responsive Layout — Desktop

**Steps (≥1200px viewport):**
1. Verify sidebar is visible with all 3 categories (Places, Movies, Books)
2. Verify carousel rows show 5+ book covers
3. Verify cover grid shows 5-6 columns on list/subject pages
4. Verify detail modal renders as wide panel or full modal (per implementation)

**Expected:** Desktop layout uses available space optimally.

**Pass/Fail:** ___

---

## 6. Test Matrix Summary

| Category | Scenarios | Priority |
|---|---|---|
| Dashboard — Navigation | TC-D1, TC-D2 | P0 — Must pass |
| Dashboard — List CRUD | TC-D3, TC-D4, TC-D19 | P0 — Must pass |
| Dashboard — Add Book | TC-D5, TC-D6, TC-D7, TC-D8, TC-D9 | P0 — Must pass |
| Dashboard — Book CRUD | TC-D10, TC-D11 | P0 — Must pass |
| Dashboard — Pins | TC-D12, TC-D13, TC-D15 | P1 — Should pass |
| Dashboard — Reorder | TC-D14 | P1 — Should pass |
| Dashboard — Publish | TC-D16 | P0 — Must pass |
| Dashboard — Share | TC-D17 | P1 — Should pass |
| Dashboard — Move | TC-D18 | P2 — Nice to have |
| Public — Page Load | TC-P1, TC-P2, TC-P3 | P0 — Must pass |
| Public — Cards & Modal | TC-P4, TC-P5 | P0 — Must pass |
| Public — List/Subject Pages | TC-P6, TC-P7, TC-P8 | P0 — Must pass |
| Public — Empty States | TC-P9 | P1 — Should pass |
| Public — Attribution | TC-P10 | P1 — Should pass |
| API Integration | TC-API1 through TC-API6 | P1 — Should pass |
| Regression | TC-X1, TC-X2 | P0 — Must pass |
| Cross-Cutting | TC-X3, TC-X4, TC-X5 | P1 — Should pass |

---

## 7. Known Limitations (v1 — Acceptable)

1. **Google Books cover quality** — Some books have no cover, low-res covers, or watermarked thumbnails. Fallback placeholder is the mitigation.
2. **Subject specificity** — Google Books subjects can be very granular (e.g., "Authors, American — 20th century"). Raw subjects stored and displayed as-is. No normalization in v1.
3. **Buy links limited** — Google Play Books link only (if available). Creator must manually add Amazon/library links.
4. **No reading status** — Creator cannot mark "Read" / "Currently Reading" / "Want to Read". Deferred to v2.
5. **No individual book URLs** — Sharing is list-level only. Individual book URLs with SEO deferred to v2.
6. **Metadata staleness** — Stored data from Google Books may become stale. No auto-refresh in v1.
