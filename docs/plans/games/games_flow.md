---
Feature: games
Doc type: flow
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_prd.md
---

# Games — User Flow

## Creator Flows (Dashboard)

### Flow 1: First Time Entering Games
1. Creator logs in → lands on dashboard
2. Desktop: sidebar shows Places + Movies & Shows + Books + Games (new)
   - Mobile: category cards grid shows all four category cards
3. Creator clicks "Games"
4. Games Home view loads → empty state shown
   - Message: "No game lists yet. Create your first list to start recommending games."
5. Prominent "+ Create Your First List" button displayed

### Flow 2: Create Game List
1. Creator clicks "+ New List" (or first-time CTA)
2. Modal opens with fields:
   - List Name (required text input)
   - Description (optional textarea)
   - Cover Image upload (optional file picker)
3. Slug auto-generates from List Name
   - Example: "All-Time Favorites" → "all-time-favorites"
4. Creator can manually edit slug
5. Creator clicks "Create List"
6. **System Actions:**
   - Creates GameList in Strapi
   - Sets Visibility: false (draft by default)
7. **Navigation:** Creator is navigated inside the new list (empty state)
8. **State Change:** List appears in Games Home with "Draft" status badge

### Flow 3: Add Game to List
1. Creator is inside a game list
2. Creator clicks "+ Add Game"
3. Full-page overlay opens
   - Route: `/:listId/new-game`

#### 3a. Search Step
   1. Creator types in IGDB search bar (debounced 300ms)
   2. Results appear via Strapi proxy → IGDB with details:
      - Cover art thumbnail
      - Title
      - Release year
      - Developer
      - Platforms (chips)
      - Genres (chips)
      - IGDB rating (if available)
   3. Creator clicks "Select" on desired result

#### 3b. Detail Form Step
   1. Auto-filled card displays:
      - Large cover art image
      - Title
      - Release year + Genres + Platforms
      - Developer + Publisher
      - Game modes
      - IGDB rating (displayed as x/10)
      - Summary (truncated, expandable)
      - "Change Selection" link (back to search)
   2. Personal note field (Tiptap rich text)
   3. User Rating (interactive 1-10 star selector, matching Movies & Shows and Books)
   4. "Add to Top Picks" checkbox
   5. Manual Photo Upload (optional, multi-upload directly to S3)
   6. Creator clicks "Add to List"

4. **System Actions:**
   - Creates RecommendedGame in Strapi with all IGDB metadata
   - Uploads media files if provided
   - Updates media_details field
   - If "Add to Top Picks" checked:
     - Sets is_pinned=true
     - Assigns next available pin_order
5. **Navigation:** Back to list view
6. **State Change:** New game appears in the list

### Flow 4: Edit Game
1. Creator clicks ⋮ menu on a game row → "Edit"
2. Full-page overlay opens with pre-filled data
   - Route: `/:listId/:gameId/edit`
3. Creator can update:
   - Personal note
   - User rating
   - Pin status
   - Media files
4. Creator clicks "Save"
5. **System Actions:** Updates RecommendedGame in Strapi
6. **Navigation:** Back to list view

### Flow 5: Delete Game
1. Creator clicks ⋮ menu on a game row → "Delete"
2. Confirmation dialog appears:
   - Message: "Delete [Game Title] from this list?"
3. Creator confirms deletion
4. **System Actions:**
   - Deletes RecommendedGame from Strapi
   - Deletes associated media files
   - If game was pinned: removes pin (other pins' order unaffected)
5. **Navigation:** List view refreshes

### Flow 6: Reorder Games in List
1. Creator is in list view
   - Sort setting must be "Custom"
2. Creator presses and holds drag handle (≡) on a game row
3. Drags row to desired position
4. Drops row
5. **System Actions:** Batch-updates display_order for affected games

### Flow 7: Pin / Unpin Game
1. Creator clicks ⭐ icon on a game row
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
     - Message shown: "You've reached the maximum of 15 Top Picks. Unpin a game first."
4. **Navigation:** Top Picks strip on Games Home updates in real-time

### Flow 8: Manage Top Picks
1. Creator clicks "Manage" on the Top Picks strip (Games Home)
   - Alternative: navigates to Top Picks manager directly
2. **Top Picks Manager view displays:**
   - Customizable display name field (default: "Top Picks")
   - Counter: "4/15 picks used"
   - Draggable list of all pinned games:
     - Cover art thumbnail
     - Title
     - Release year
     - Platforms chips
     - Source list name
     - × button to unpin each
   - "Add from your lists" button
3. Creator actions:
   - **Drag to reorder:** System updates pin_order
   - **Unpin (×):** Removes from Top Picks (game stays in its list)
   - **Add from lists:** Picker opens showing all games across all lists with checkboxes
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
   - Shareable URL: `explorers.earth/[username]/games/[slug]`
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
     - Confirmation modal: "This will delete the list and all X games in it. This action cannot be undone."
     - Deletes list and all associated games

### Flow 11: Move Game to Another List
1. Creator clicks ⋮ menu on a game row → "Move to..."
2. Picker modal shows all other game lists (excluding current list)
3. Creator selects target list
4. **System Actions:** Updates the game's game_list relation to the new list
5. **Navigation:** Game disappears from current list, appears in target list

---

## Visitor Flows (Public Page)

### Flow 12: Browse Games Page
1. Visitor navigates to `/:username/games`
2. **Page loads with:**
   - Header: "[Creator]'s Games · [count] games"
   - Top Picks carousel row (if creator has pinned games)
   - Published list carousel rows in creator-defined order
   - Genre browse section at bottom
3. Visitor scrolls vertically through rows
4. Visitor scrolls horizontally within a row to see more covers
5. **Card appearance:**
   - Game cover art (portrait aspect ratio)
   - Rating badge (bottom-right, from user_rating or igdb_rating/10)
   - Title below cover
   - Platform chips below title (compact, max 3 shown)

### Flow 13: View Game Details
1. Visitor taps a game cover card (from carousel or grid)
2. **Detail modal slides up from bottom with:**
   - Drag bar at top
   - Large cover art image
   - Title
   - Release year
   - Platforms (chip tags, all shown)
   - Developer · Publisher
   - Genres (chip tags)
   - Game modes (chip tags: Single player, Multiplayer, Co-op)
   - IGDB rating (displayed as x.x/10) + user rating (1-10 stars)
   - Creator's note (formatted via Tiptap)
   - Screenshots section (horizontal scroll of IGDB screenshots, if stored)
   - Creator's photos (horizontal scroll, if any uploaded)
   - "From: [list name] →" link
   - IGDB link (small, secondary)
   - Share button
3. **Visitor interactions:**
   - Swipe down to dismiss (threshold: 100px)
   - Tap × to close
   - Tap "From: [list name]" → navigates to full list page
   - Tap Share → native share API or copy link option

### Flow 14: Browse Full List
1. Visitor taps list heading (e.g., "Indie Gems >") on the carousel page
2. **Navigation:** to `/:username/games/:listSlug`
3. **Page displays:**
   - "← [Creator]'s Games" back link
   - List name as heading
   - List description (if any)
   - Game count
   - Cover grid:
     - 3 columns (mobile)
     - 5-6 columns (desktop)
4. Visitor scrolls through grid
5. Tapping a cover → detail modal (Flow 13)
6. Back link → returns to main games page

### Flow 15: Browse by Genre
1. Visitor scrolls to "Browse by Genre" section on main games page
2. **Genre cards display:**
   - Game cover art as background (representative game from that genre)
   - Genre name
   - Game count
   - Grid: 2 columns (mobile) / 4 columns (desktop)
   - Only genres with ≥1 game in published lists are shown
3. Visitor taps a genre card (e.g., "Role-playing (RPG)")
4. **Navigation:** to `/:username/games/genre/:genreSlug`
5. **Page displays:**
   - "← [Creator]'s Games" back link
   - Genre name as heading
   - Game count
   - Cover grid showing ALL games with that genre across ALL published lists
6. Tapping a cover → detail modal (Flow 13)

---

## Edge Case Flows

### Edge: Empty States

**No game lists:**
- Games Home shows "No game lists yet" message
- Prominent "+ Create Your First List" CTA button displayed

**Empty list (no games):**
- List view shows "No games in this list yet. Add your first game!"
- CTA button to add first game

**No pinned games:**
- Top Picks strip not shown on Games Home
- Top Picks strip not shown on public page

**Single game in a list:**
- Carousel row shows one cover
- Cover aligned left (not centered)

**No cover art from IGDB:**
- Fallback placeholder image shown (generic game controller graphic)
- Game title displayed as text overlay

### Edge: IGDB Search Returns No Results
- Message shown: "No games found for '[query]'. Try a different title or check the spelling."
- Displayed below the search input field

### Edge: Strapi Proxy Unavailable
- Search shows: "Search temporarily unavailable. Please try again."
- Creator can still manage existing saved games (Strapi GraphQL unaffected)

### Edge: Same Game in Multiple Lists
- **Allowed:** Same igdb_id can be in different lists (not in same list twice)
- **Genre page deduplication:** Game appears once (deduplicated by igdb_id)
- **Detail modal context:** "From:" shows the list the visitor was browsing when they tapped

### Edge: Long Platform List
- Cards: show first 2-3 most relevant platforms + "+" count if more (e.g., "+4")
- Detail modal: all platforms shown as chip row (wraps to multiple lines if needed)

### Edge: Very Long Game Title
- Cards: title truncated at 2 lines with ellipsis
- Detail modal: full title displayed

### Edge: Creator Has 15+ Lists
- Games Home: scrollable list of all lists (no limit enforced)
- Public page: shows published lists in creator-defined order
- Long pages: carousel rows are lazy-loaded for performance

### Edge: IGDB Rating Missing
- `total_rating` is null for many games (especially newer or less-known titles)
- Fallback: show user_rating star badge if user_rating exists
- Fallback: if neither exists, show no rating badge

### Edge: Game Without Screenshots
- Screenshots section hidden in detail modal
- Creator photos section shown if creator uploaded any
