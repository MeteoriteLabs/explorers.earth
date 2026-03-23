---
Feature: movies-and-shows
Doc type: flow
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_prd.md
---

# Movies & Shows User Flow

## Creator Flows (Dashboard)

### Flow 1: First Time Entering Movies
1. Creator logs in → lands on dashboard
2. Desktop: sidebar shows Places (existing) + Movies & Shows (new)
   - Mobile: category cards grid shows Places card + Movies & Shows card
3. Creator clicks "Movies & Shows"
4. Movies Home view loads → empty state shown
   - Message: "No movie lists yet. Create your first list to start recommending movies and shows."
5. Prominent "+ Create Your First List" button displayed

### Flow 2: Create Movie List
1. Creator clicks "+ New List" (or first-time CTA)
2. Modal opens with fields:
   - List Name (required text input)
   - Description (optional textarea)
   - Cover Image upload (optional file picker)
3. Slug auto-generates from List Name
   - Example: "Mind-Bending Sci-Fi" → "mind-bending-sci-fi"
4. Creator can manually edit slug
5. Creator clicks "Create List"
6. **System Actions:**
   - Creates MovieList in Strapi
   - Sets Visibility: false (draft by default)
7. **Navigation:** Creator is navigated inside the new list (empty state)
8. **State Change:** List appears in Movies Home with "Draft" status badge

### Flow 3: Add Movie to List
1. Creator is inside a movie list
2. Creator clicks "+ Add Movie"
3. Full-page overlay opens
   - Route: `/:listId/new-movie`

#### 3a. Search Step
   1. Creator types in TMDB search bar (debounced 300ms)
   2. Results appear with details:
      - Poster thumbnail
      - Title
      - Year
      - Director/creator
      - Genres
      - Rating
      - Runtime
   3. Results differentiate movies vs TV shows (with indicators)
   4. Creator clicks "Select" on desired result

#### 3b. Detail Form Step
   1. Auto-filled card displays:
      - Large poster image
      - Title, year, rating, genres, director, runtime
      - Change Selection link (back to search)
   2. Personal note field (Tiptap rich text block)
   3. User Rating (interactive 1-5 star selector)
   4. Where to Watch section:
      - Auto-populated streaming platforms from TMDB
      - Toggleable chips for each platform
   5. "Add to Top Picks" checkbox
   6. Manual Snapshot Upload (optional, multi-upload directly to S3)
   7. Creator clicks "Add to List"

4. **System Actions:**
   - Creates RecommendedMovie in Strapi with all metadata
   - Uploads media files if provided
   - Updates media_details field
   - If "Add to Top Picks" checked:
     - Sets is_pinned=true
     - Assigns next available pin_order
5. **Navigation:** Back to list view
6. **State Change:** New movie appears in the list

### Flow 4: Edit Movie
1. Creator clicks ⋮ menu on a movie row → "Edit"
2. Full-page overlay opens with pre-filled data
   - Route: `/:listId/:movieId/edit`
3. Creator can update:
   - Personal note
   - Where to watch platforms
   - Pin status
   - Media files
4. Creator clicks "Save"
5. **System Actions:** Updates RecommendedMovie in Strapi
6. **Navigation:** Back to list view

### Flow 5: Delete Movie
1. Creator clicks ⋮ menu on a movie row → "Delete"
2. Confirmation dialog appears:
   - Message: "Delete [Movie Title] from this list?"
3. Creator confirms deletion
4. **System Actions:**
   - Deletes RecommendedMovie from Strapi
   - Deletes associated media files
   - If movie was pinned: removes pin (other pins' order unaffected)
5. **Navigation:** List view refreshes

### Flow 6: Reorder Movies in List
1. Creator is in list view
   - Sort setting must be "Custom"
2. Creator presses and holds drag handle (≡) on a movie row
3. Drags row to desired position
4. Drops row
5. **System Actions:** Batch-updates display_order for affected movies

### Flow 7: Pin / Unpin Movie
1. Creator clicks ⭐ icon on a movie row
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
     - Message shown: "You've reached the maximum of 15 Top Picks. Unpin a movie first."
4. **Navigation:** Top Picks strip on Movies Home updates in real-time

### Flow 8: Manage Top Picks
1. Creator clicks "Manage" on the Top Picks strip (Movies Home)
   - Alternative: navigates to Top Picks manager directly
2. **Top Picks Manager view displays:**
   - Customizable display name field (default: "Top Picks")
   - Counter: "4/15 picks used"
   - Draggable list of all pinned movies:
     - Poster thumbnail
     - Title
     - Source list name
     - × button to unpin each
   - "Add from your lists" button
3. Creator actions:
   - **Drag to reorder:** System updates pin_order
   - **Unpin (×):** Removes from Top Picks (movie stays in its list)
   - **Add from lists:** Picker opens showing all movies across all lists with checkboxes
4. **Display name change:** Saves on blur or explicit save button

### Flow 9: Publish / Unpublish List
1. Creator toggles the publish switch
   - Located on list card in Movies Home or at top of list view
2. **State Changes:**
   - Published (on): Visibility=true → List appears on public page
   - Draft (off): Visibility=false → List hidden from public page
3. **First-time publish behavior:**
   - Brief preview shown of how list will appear as carousel row on public page
   - Buttons: "Keep as Draft" / "Publish Now"
4. **Unpublish behavior:** Immediate toggle, no confirmation needed

### Flow 10: Manage List (Sharing & Settings)
1. Creator clicks "Manage" tab inside a list
2. **Manage tab displays:**
   - Shareable URL: `explorers.earth/[username]/movies/[slug]`
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
   - **Edit settings:** Modal opens with fields, save updates Strapi
   - **Delete:**
     - Confirmation modal: "This will delete the list and all X movies in it. This action cannot be undone."
     - Deletes list and all associated movies

### Flow 11: Move Movie to Another List
1. Creator clicks ⋮ menu on a movie row → "Move to..."
2. Picker modal shows all other movie lists (excluding current list)
3. Creator selects target list
4. **System Actions:** Updates the movie's movie_list relation to the new list
5. **Navigation:** Movie disappears from current list, appears in target list

---

## Visitor Flows (Public Page)

### Flow 12: Browse Movies Page
1. Visitor navigates to `/:username/movies`
2. **Page loads with:**
   - Header: "[Creator]'s Movies · [count] movies"
   - Top Picks carousel row (if creator has pinned movies)
   - Published list carousel rows in creator-defined order
   - Genre browse section at bottom
3. Visitor scrolls vertically through rows
4. Visitor scrolls horizontally within a row to see more posters
5. **Card appearance:**
   - Poster image
   - Rating badge (bottom-right)
   - Title below poster
   - TV shows display "Series" badge (top-left)

### Flow 13: View Movie Details
1. Visitor taps a movie poster card (from carousel or grid)
2. **Detail modal slides up from bottom with:**
   - Drag bar at top
   - Large poster image
   - Title, year, rating, genres, director, runtime
   - "Series" indicator + season count (TV shows only)
   - Creator's note (visually highlighted block formatted via Tiptap)
   - Creator's rating (1-5 glowing yellow stars)
   - Where to Watch section:
     - Streaming platform badges (tappable)
     - Tapping badge opens streaming service in new tab
   - Creator's photos (horizontal scroll, if any)
   - "From: [list name] →" link
   - Share button
3. **Visitor interactions:**
   - Swipe down to dismiss (threshold: 100px)
   - Tap × to close
   - Tap streaming badge → opens streaming service in new tab
   - Tap "From: [list name]" → navigates to full list page
   - Tap Share → native share API or copy link option

### Flow 14: Browse Full List
1. Visitor taps list heading (e.g., "Mind-Bending Sci-Fi >") on the carousel page
2. **Navigation:** to `/:username/movies/:listSlug`
3. **Page displays:**
   - "← [Creator]'s Movies" back link
   - List name as heading
   - List description (if any)
   - Movie count
   - Poster grid:
     - 3 columns (mobile)
     - 5-6 columns (desktop)
4. Visitor scrolls through grid
5. Tapping a poster → detail modal (Flow 13)
6. Back link → returns to main movies page

### Flow 15: Browse by Genre
1. Visitor scrolls to "Browse by Genre" section on main movies page
2. **Genre cards display:**
   - Backdrop image
   - Genre name
   - Movie count
   - Grid: 2 columns (mobile) / 4 columns (desktop)
   - Only genres with ≥1 movie in published lists are shown
3. Visitor taps a genre card (e.g., "Sci-Fi")
4. **Navigation:** to `/:username/movies/genre/:genreSlug`
5. **Page displays:**
   - "← [Creator]'s Movies" back link
   - Genre name as heading
   - Movie count
   - Poster grid showing ALL movies in that genre across ALL published lists
6. Tapping a poster → detail modal (Flow 13)

---

## Edge Case Flows

### Edge: Empty States

**No movie lists:**
- Movies Home shows "No movie lists yet" message
- Prominent "+ Create Your First List" CTA button displayed

**Empty list (no movies):**
- List view shows "No movies in this list yet. Add your first movie!"
- CTA button to add first movie

**No pinned movies:**
- Top Picks strip not shown on Movies Home
- Top Picks strip not shown on public page

**Single movie in a list:**
- Carousel row shows one poster
- Poster aligned left (not centered)

**Single list published:**
- Public page shows one carousel row
- Genre section displayed if movies span multiple genres

**Very long list name:**
- Truncated with ellipsis on carousel row heading
- Full name displayed on list page

**No poster from TMDB:**
- Fallback placeholder image shown
- Movie title displayed as text overlay

### Edge: Creator has 15+ lists
- Movies Home: scrollable list of all lists (no limit enforced)
- Public page: shows published lists in creator-defined order
- Long pages: carousel rows are lazy-loaded for performance optimization

### Edge: TMDB search returns no results
- Message shown: "No results found for '[query]'. Try a different search term."
- Displayed below the search input field

### Edge: Movie exists in multiple lists
- **Allowed:** Same TMDB ID can be in different lists (not in same list twice)
- **Genre page deduplication:** Movie appears once (deduplicated by tmdb_id)
- **Detail modal context:** "From:" shows the list the visitor was browsing when they tapped the poster

### Edge: Streaming platforms change
- **Storage:** Watch provider data stored at save time (not auto-updated)
- **Manual updates:** Creator can edit watch providers via Flow 4 (Edit Movie)
- **Broken deep links:** If a streaming service link breaks, visitor sees the platform badge but may reach generic page or 404 on streaming service. Acceptable for v1.
