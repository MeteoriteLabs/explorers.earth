---
Feature: books
Doc type: flow
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_prd.md
---

# Books — User Flow

## Creator Flows (Dashboard)

### Flow 1: First Time Entering Books
1. Creator logs in → lands on dashboard
2. Desktop: sidebar shows Places (existing) + Movies & Shows (existing) + Books (new)
   - Mobile: category cards grid shows all three category cards
3. Creator clicks "Books"
4. Books Home view loads → empty state shown
   - Message: "No book lists yet. Create your first list to start recommending books."
5. Prominent "+ Create Your First List" button displayed

### Flow 2: Create Book List
1. Creator clicks "+ New List" (or first-time CTA)
2. Modal opens with fields:
   - List Name (required text input)
   - Description (optional textarea)
   - Cover Image upload (optional file picker)
3. Slug auto-generates from List Name
   - Example: "Life-Changing Reads" → "life-changing-reads"
4. Creator can manually edit slug
5. Creator clicks "Create List"
6. **System Actions:**
   - Creates BookList in Strapi
   - Sets Visibility: false (draft by default)
7. **Navigation:** Creator is navigated inside the new list (empty state)
8. **State Change:** List appears in Books Home with "Draft" status badge

### Flow 3: Add Book to List
1. Creator is inside a book list
2. Creator clicks "+ Add Book"
3. Full-page overlay opens
   - Route: `/:listId/new-book`

#### 3a. Search Step
   1. Creator types in Google Books search bar (debounced 300ms)
   2. Results appear with details:
      - Cover thumbnail
      - Title + Subtitle (if any)
      - Author(s)
      - Publisher + Year
      - Subjects/Categories
      - Page count
      - Google rating (if available)
   3. Creator clicks "Select" on desired result

#### 3b. Detail Form Step
   1. Auto-filled card displays:
      - Large cover image
      - Title, author(s), publisher, year, subjects, page count
      - Google Books rating (if available)
      - "Change Selection" link (back to search)
   2. Personal note field (Tiptap rich text)
   3. User Rating (interactive 1-5 star selector)
   4. Where to Buy section:
      - Auto-populated Google Books buy link (if available)
      - Creator can manually add additional links (Amazon, library, etc.)
   5. "Add to Top Reads" checkbox
   6. Manual Photo Upload (optional, multi-upload directly to S3)
   7. Creator clicks "Add to List"

4. **System Actions:**
   - Creates RecommendedBook in Strapi with all metadata
   - Uploads media files if provided
   - Updates media_details field
   - If "Add to Top Reads" checked:
     - Sets is_pinned=true
     - Assigns next available pin_order
5. **Navigation:** Back to list view
6. **State Change:** New book appears in the list

### Flow 4: Edit Book
1. Creator clicks ⋮ menu on a book row → "Edit"
2. Full-page overlay opens with pre-filled data
   - Route: `/:listId/:bookId/edit`
3. Creator can update:
   - Personal note
   - User rating
   - Buy links
   - Pin status
   - Media files
4. Creator clicks "Save"
5. **System Actions:** Updates RecommendedBook in Strapi
6. **Navigation:** Back to list view

### Flow 5: Delete Book
1. Creator clicks ⋮ menu on a book row → "Delete"
2. Confirmation dialog appears:
   - Message: "Delete [Book Title] from this list?"
3. Creator confirms deletion
4. **System Actions:**
   - Deletes RecommendedBook from Strapi
   - Deletes associated media files
   - If book was pinned: removes pin (other pins' order unaffected)
5. **Navigation:** List view refreshes

### Flow 6: Reorder Books in List
1. Creator is in list view
   - Sort setting must be "Custom"
2. Creator presses and holds drag handle (≡) on a book row
3. Drags row to desired position
4. Drops row
5. **System Actions:** Batch-updates display_order for affected books

### Flow 7: Pin / Unpin Book
1. Creator clicks ⭐ icon on a book row
2. **Toggle Logic:**
   - If unpinned → pinned:
     - is_pinned=true
     - pin_order=next available
     - Star icon fills/glows
   - If pinned → unpinned:
     - is_pinned=false
     - pin_order=null
     - Star icon empties
3. **Limit Check:**
   - If pin limit reached (15 maximum) and creator tries to pin:
     - Message shown: "You've reached the maximum of 15 Top Reads. Unpin a book first."
4. **Navigation:** Top Reads strip on Books Home updates in real-time

### Flow 8: Manage Top Reads
1. Creator clicks "Manage" on the Top Reads strip (Books Home)
   - Alternative: navigates to Top Reads manager directly
2. **Top Reads Manager view displays:**
   - Customizable display name field (default: "Top Reads")
   - Counter: "4/15 reads used"
   - Draggable list of all pinned books:
     - Cover thumbnail
     - Title
     - Author(s)
     - Source list name
     - × button to unpin each
   - "Add from your lists" button
3. Creator actions:
   - **Drag to reorder:** System updates pin_order
   - **Unpin (×):** Removes from Top Reads (book stays in its list)
   - **Add from lists:** Picker opens showing all books across all lists with checkboxes
4. **Display name change:** Saves on blur or explicit save button

### Flow 9: Publish / Unpublish List
1. Creator toggles the publish switch on a list card or inside list view
2. **State Changes:**
   - Published (on): Visibility=true → List appears on public page
   - Draft (off): Visibility=false → List hidden from public page
3. **First-time publish behavior:**
   - Brief confirmation shown with preview of how the list will appear
   - Buttons: "Keep as Draft" / "Publish Now"
4. **Unpublish behavior:** Immediate toggle, no confirmation needed

### Flow 10: Manage List (Sharing & Settings)
1. Creator clicks "Manage" tab inside a list
2. **Manage tab displays:**
   - Shareable URL: `explorers.earth/[username]/books/[slug]`
     - Copy button with toast confirmation
   - QR code (generated from URL)
     - Download option as PNG
   - Edit list settings section:
     - Name field
     - Description field
     - Cover image upload
     - Slug field (editable)
   - Public page order: position number or drag handle
   - Delete list button
3. Creator actions:
   - **Copy link:** Goes to clipboard, shows toast confirmation
   - **QR code:** Can be downloaded as PNG
   - **Edit settings:** Save updates Strapi
   - **Delete:**
     - Confirmation modal: "This will delete the list and all X books in it. This action cannot be undone."
     - Deletes list and all associated books

### Flow 11: Move Book to Another List
1. Creator clicks ⋮ menu on a book row → "Move to..."
2. Picker modal shows all other book lists (excluding current list)
3. Creator selects target list
4. **System Actions:** Updates the book's book_list relation to the new list
5. **Navigation:** Book disappears from current list, appears in target list

---

## Visitor Flows (Public Page)

### Flow 12: Browse Books Page
1. Visitor navigates to `/:username/books`
2. **Page loads with:**
   - Header: "[Creator]'s Books · [count] books"
   - Top Reads carousel row (if creator has pinned books)
   - Published list carousel rows in creator-defined order
   - Subject browse section at bottom
3. Visitor scrolls vertically through rows
4. Visitor scrolls horizontally within a row to see more covers
5. **Card appearance:**
   - Book cover image
   - Rating badge (bottom-right, from user_rating or google_rating)
   - Title below cover
   - Author below title (first author or "First Author et al.")

### Flow 13: View Book Details
1. Visitor taps a book cover card (from carousel or grid)
2. **Detail modal slides up from bottom with:**
   - Drag bar at top
   - Large cover image
   - Title, subtitle (if any)
   - Author(s) — full list
   - Publisher, publication year
   - Page count
   - Subjects (chip tags)
   - Google rating + user rating (1-5 glowing yellow stars)
   - Creator's note (formatted via Tiptap)
   - Where to Buy section:
     - Buy link badges (tappable, open in new tab)
   - Creator's photos (horizontal scroll, if any uploaded)
   - "From: [list name] →" link
   - Share button
3. **Visitor interactions:**
   - Swipe down to dismiss (threshold: 100px)
   - Tap × to close
   - Tap buy link badge → opens external page in new tab
   - Tap "From: [list name]" → navigates to full list page
   - Tap Share → native share API or copy link option

### Flow 14: Browse Full List
1. Visitor taps list heading (e.g., "Business Essentials >") on the carousel page
2. **Navigation:** to `/:username/books/:listSlug`
3. **Page displays:**
   - "← [Creator]'s Books" back link
   - List name as heading
   - List description (if any)
   - Book count
   - Cover grid:
     - 3 columns (mobile)
     - 5-6 columns (desktop)
4. Visitor scrolls through grid
5. Tapping a cover → detail modal (Flow 13)
6. Back link → returns to main books page

### Flow 15: Browse by Subject
1. Visitor scrolls to "Browse by Subject" section on main books page
2. **Subject cards display:**
   - Book cover image as background (representative book from that subject)
   - Subject name
   - Book count
   - Grid: 2 columns (mobile) / 4 columns (desktop)
   - Only subjects with ≥1 book in published lists are shown
3. Visitor taps a subject card (e.g., "Business & Economics")
4. **Navigation:** to `/:username/books/subject/:subjectSlug`
5. **Page displays:**
   - "← [Creator]'s Books" back link
   - Subject name as heading
   - Book count
   - Cover grid showing ALL books with that subject across ALL published lists
6. Tapping a cover → detail modal (Flow 13)

---

## Edge Case Flows

### Edge: Empty States

**No book lists:**
- Books Home shows "No book lists yet" message
- Prominent "+ Create Your First List" CTA button displayed

**Empty list (no books):**
- List view shows "No books in this list yet. Add your first book!"
- CTA button to add first book

**No pinned books:**
- Top Reads strip not shown on Books Home
- Top Reads strip not shown on public page

**Single book in a list:**
- Carousel row shows one cover
- Cover aligned left (not centered)

**No cover image from Google Books:**
- Fallback placeholder image shown (generic book cover graphic)
- Book title displayed as text overlay

### Edge: Google Books search returns no results
- Message shown: "No results found for '[query]'. Try searching by ISBN or a different title."
- Displayed below the search input field

### Edge: Same book in multiple lists
- **Allowed:** Same volume_id can be in different lists (not in same list twice)
- **Subject page deduplication:** Book appears once (deduplicated by volume_id)
- **Detail modal context:** "From:" shows the list the visitor was browsing when they tapped the cover

### Edge: Buy links unavailable
- Google Books buyLink not always present. If absent, show empty "Where to Buy" section with message: "No purchase links added yet."
- Creator can manually add links in the edit flow

### Edge: Long author list
- Cards: show first author + "et al." if more than 2 authors
- Detail modal: show all authors, comma-separated

### Edge: Very long book title
- Cards: title truncated at 2 lines with ellipsis
- Detail modal: full title displayed

### Edge: Creator has 15+ lists
- Books Home: scrollable list of all lists (no limit enforced)
- Public page: shows published lists in creator-defined order
- Long pages: carousel rows are lazy-loaded for performance
