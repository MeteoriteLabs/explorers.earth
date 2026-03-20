---
Feature: movies-and-shows
Doc type: testing
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_prd.md, movies_and_shows_flow.md
---

# Movies & Shows Testing

## Manual Test Scenarios

All test cases include priority levels where P0=blocker, P1=critical, P2=important, P3=nice-to-have.

### Creator Dashboard Tests

#### Category Navigation

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-001 | Desktop sidebar shows Places and Movies categories | User logged in, desktop view (≥768px) | 1. Navigate to dashboard<br/>2. Observe left sidebar | Sidebar displays two category buttons: "Places" and "Movies" with appropriate icons | P0 |
| TC-002 | Mobile shows category cards grid | User logged in, mobile view (<768px) | 1. Navigate to dashboard<br/>2. Observe top of page | Category cards displayed in grid layout: "Places" and "Movies" with appropriate icons and labels | P0 |
| TC-003 | Clicking Movies opens Movies Home | User logged in, on dashboard | 1. Click "Movies" in sidebar (desktop) or category card (mobile)<br/>2. Observe page load | Movies Home page loads with list of movie lists and Movies Home header visible | P0 |
| TC-004 | Sidebar active state updates when switching categories | User logged in, desktop view | 1. Click "Movies" in sidebar<br/>2. Click "Places" in sidebar<br/>3. Click "Movies" again<br/>4. Observe active state | Active state (highlighting/styling) correctly follows the clicked category at each step | P1 |
| TC-005 | Existing Places dashboard unchanged and functional | User logged in, has existing Places data | 1. Click "Places" in navigation<br/>2. Verify all existing Places features work (create list, add place, etc.) | Places dashboard renders and functions exactly as before the Movies feature was added | P0 |

#### Movie List Management

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-010 | Create new movie list with name only | User on Movies Home page | 1. Click "Create List" button<br/>2. Enter list name "Test List"<br/>3. Click "Create" | New list created and appears in Movies Home with name "Test List", empty movie count shown as 0 | P0 |
| TC-011 | Create new movie list with name + description + cover image | User on Movies Home page | 1. Click "Create List" button<br/>2. Enter name "Sci-Fi Classics"<br/>3. Enter description "Great science fiction films"<br/>4. Upload cover image<br/>5. Click "Create" | List created with all metadata stored; cover image displays on Movies Home list card | P1 |
| TC-012 | Slug auto-generates from list name | User on Movies Home page | 1. Click "Create List"<br/>2. Enter name "My Favorite Films"<br/>3. Open list edit page<br/>4. Check slug field | Slug automatically populated as "my-favorite-films" or similar URL-friendly version | P1 |
| TC-013 | Duplicate slug gets auto-appended number | User has list named "Classics" | 1. Create new list named "Classics"<br/>2. Check slug in edit page | Slug becomes "classics-2" or similar; no error shown, auto-resolution handled | P2 |
| TC-014 | Edit list name, description, cover, slug | User has existing movie list | 1. Open list settings/edit<br/>2. Change name to "Updated Name"<br/>3. Change description<br/>4. Change cover image<br/>5. Change slug to "custom-slug"<br/>6. Save | All fields update correctly and persist; Movies Home card reflects changes | P1 |
| TC-015 | Delete list with confirmation | User has existing movie list with movies | 1. Open list settings<br/>2. Click "Delete List"<br/>3. Confirmation dialog appears<br/>4. Click "Confirm Delete" | List and all its movies are deleted; Movies Home refreshes and list no longer appears | P1 |
| TC-016 | Delete list cascades to delete all movies in it | User has list with 5+ movies | 1. Delete the list via TC-015 steps<br/>2. Verify in database/backend logs | All movies associated with the deleted list are removed from Strapi | P1 |
| TC-017 | Movies Home shows correct movie count per list | User has 3 lists with 2, 5, and 12 movies respectively | 1. Navigate to Movies Home<br/>2. Observe count badges on list cards | Each list card shows accurate count: "2 movies", "5 movies", "12 movies" | P1 |
| TC-018 | Movies Home shows correct pin count per list | User has list with 5 movies, 3 pinned | 1. Pin 3 movies in a list<br/>2. Navigate to Movies Home<br/>3. Observe pin icon badge | Pin count badge appears and shows "3 pinned" or similar indicator | P2 |
| TC-019 | Empty state shown when no lists exist | User has no movie lists | 1. Navigate to Movies Home<br/>2. Observe page state | Empty state message displayed (e.g., "No lists yet. Create your first movie list!") with "Create List" CTA button | P1 |

#### Add Movie

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-020 | TMDB search returns results as user types | User on Add Movie page with search input focused | 1. Type "The Matrix" in search<br/>2. Observe results appear in dropdown | Results dropdown shows matching movies from TMDB; results update as each character is typed (debounced) | P0 |
| TC-021 | Search results show poster, title, year, director, genres, rating | TMDB search results displayed | 1. Complete TC-020 steps<br/>2. Observe search result items | Each result card displays: poster image, title, release year, director name(s), genre tags, rating/stars | P0 |
| TC-022 | Select movie auto-fills detail card | User has search results displayed | 1. Click on a search result<br/>2. Observe form below search | Detail card auto-populates with: poster (if available), title, year, director, genres, rating, where to watch section | P0 |
| TC-023 | "Change Selection" button returns to search | User has a movie selected in detail card | 1. Click "Change Selection" button<br/>2. Observe UI state | Search input cleared and returns to empty search state; user can perform new search | P1 |
| TC-024 | Submit with note saves movie to Strapi | User has movie selected and note entered | 1. Enter note text (e.g., "Amazing cinematography")<br/>2. Click "Add Movie"<br/>3. Verify in database | Movie saved to Strapi with tmdb_id, title, year, director, genres, rating, note, where_to_watch, and list association | P0 |
| TC-025 | Submit without note saves movie to Strapi | User has movie selected, no note entered | 1. Leave note field empty<br/>2. Click "Add Movie"<br/>3. Verify in database | Movie saved successfully with empty/null note field; no validation error | P0 |
| TC-026 | Where to Watch auto-populated from TMDB | TMDB movie has watch provider data | 1. Search and select movie with watch providers (e.g., Netflix, Prime Video)<br/>2. Observe Where to Watch section | Where to Watch section auto-populates with available streaming providers from TMDB | P1 |
| TC-027 | Where to Watch platforms toggleable | User has Where to Watch section with multiple providers | 1. See checkboxes/toggles for each provider<br/>2. Uncheck one provider<br/>3. Save movie<br/>4. Edit movie<br/>5. Observe provider state | Unchecked providers are not saved; upon re-opening, only checked providers are selected | P2 |
| TC-028 | "Add to Top Picks" checkbox works | User on Add Movie form | 1. Select a movie<br/>2. Check "Add to Top Picks" checkbox<br/>3. Click "Add Movie"<br/>4. Verify in Top Picks manager | Movie appears in Top Picks manager and counts towards the 15-pin limit | P1 |
| TC-029 | Media upload works (device upload) | User on Add Movie form with movie selected | 1. Click image upload button<br/>2. Select image from device<br/>3. Upload completes<br/>4. Verify in detail view | Image uploaded successfully; preview shows in Add Movie form; persists when movie is saved | P1 |
| TC-030 | Duplicate movie in same list blocked | User has list with movie "The Matrix" already added | 1. Search for "The Matrix"<br/>2. Select it<br/>3. Click "Add Movie" | Error message shown: "This movie is already in this list"; add blocked | P1 |
| TC-031 | Same movie in different lists allowed | User has list A with "The Matrix" | 1. Navigate to list B (different list)<br/>2. Add "The Matrix"<br/>3. Click "Add Movie" | Movie added successfully to list B; no duplicate error shown | P1 |
| TC-032 | TMDB search handles no results gracefully | User searches for nonsense string | 1. Type "xyzabc12345" in search<br/>2. Wait for search results | "No results found" message displayed; no error state; search input remains active for retry | P1 |
| TC-033 | TMDB search differentiates movies vs TV shows | User searches for "The Office" (exists as TV show and movie) | 1. Type "The Office"<br/>2. Observe search results | Results include both movies and TV shows; TV shows clearly marked as "Series" or with badge | P1 |
| TC-034 | Navigate back without saving doesn't create movie | User on Add Movie page with movie selected but not submitted | 1. Select movie from search<br/>2. Click back/close without submitting<br/>3. Return to list view | Movie is not added to list; no changes persisted | P1 |

#### Movie Management

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-040 | Edit movie note | User has list with a movie | 1. Open list<br/>2. Click movie card/edit icon<br/>3. Change note text<br/>4. Save changes | Note updated in Strapi; change persists when page reloads | P0 |
| TC-041 | Delete movie with confirmation | User has list with a movie | 1. Open list<br/>2. Click movie menu/delete icon<br/>3. Confirmation dialog appears<br/>4. Click "Confirm Delete" | Movie deleted from Strapi; removed from list view immediately | P0 |
| TC-042 | Move movie to another list | User has 2 lists with movies | 1. Open first list<br/>2. Click movie menu<br/>3. Select "Move to List"<br/>4. Choose destination list | Movie moved to destination list; removed from source list; both lists update | P1 |
| TC-043 | Drag-to-reorder movies within list | User has list with 3+ movies | 1. Open list view<br/>2. Drag movie card to new position<br/>3. Release<br/>4. Refresh page | Movie order updates immediately; order persists after page reload | P1 |
| TC-044 | Sort presets work (Custom, Rating, Year, Recently added) | User has list with 5+ movies of varying years and ratings | 1. Open list sort menu<br/>2. Click "Custom" (no sort)<br/>3. Click "Rating" (high to low)<br/>4. Click "Year" (newest first)<br/>5. Click "Recently added"<br/>6. Observe order each time | Movies re-sort correctly with each preset; custom order from TC-043 preserved when returning to "Custom" | P2 |
| TC-045 | Pin/unpin movie via star toggle | User has list with a movie | 1. Click star/pin icon on movie card<br/>2. Star/pin becomes highlighted/filled<br/>3. Click again<br/>4. Star becomes empty | Star state toggles; movie appears/disappears from Top Picks section; count updates | P0 |
| TC-046 | Pin limit (15) enforced with message | User has 15 pinned movies | 1. Pin movie #15<br/>2. Verify 15/15 in counter<br/>3. Try to pin movie #16<br/>4. Click pin on movie #16 | Pin button disabled or toast message shown: "Maximum 15 movies can be pinned. Unpin one to add another." | P1 |

#### Publish

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-050 | Toggle list to Published | User has draft movie list | 1. Open list settings<br/>2. Toggle "Publish" switch on<br/>3. Observe list status | List status changes to "Published"; switch shows enabled state; change persists | P0 |
| TC-051 | Toggle list to Draft | User has published movie list | 1. Open list settings<br/>2. Toggle "Publish" switch off<br/>3. Observe list status | List status changes to "Draft"; switch shows disabled state; change persists | P0 |
| TC-052 | Published list appears on public page | User publishes a movie list | 1. Complete TC-050 steps<br/>2. Open public movies page (/:username/movies)<br/>3. Observe list | Published list appears as a carousel row with all its movies | P0 |
| TC-053 | Draft list hidden from public page | User has draft list and published list | 1. Navigate to public movies page<br/>2. Observe list display | Draft list is hidden; only published list appears | P0 |
| TC-054 | First publish shows preview | User publishes a list for the first time | 1. Toggle publish on for new list<br/>2. Observe modal/preview | Preview modal or popup shown displaying how the list will appear on public page; option to proceed or cancel | P2 |

#### Top Picks

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-060 | Top Picks manager shows all pinned movies | User has 8 pinned movies across lists | 1. Open Top Picks manager<br/>2. Observe list of pinned movies | All 8 pinned movies displayed in manager; each shows movie title, list name, and unpin button | P0 |
| TC-061 | Drag-to-reorder pinned movies | User has 5+ pinned movies | 1. Open Top Picks manager<br/>2. Drag movie to new position<br/>3. Release<br/>4. Refresh page | Movie order in Top Picks updates immediately; order persists after refresh | P1 |
| TC-062 | Unpin from Top Picks manager | User has pinned movies in manager | 1. Open Top Picks manager<br/>2. Click unpin button on a movie<br/>3. Observe removal | Movie immediately removed from Top Picks manager; star icon unpinned in list view; counter decrements | P1 |
| TC-063 | "Add from your lists" picker works | User has unpinned movies in lists | 1. Open Top Picks manager<br/>2. Click "Add from your lists" (if visible)<br/>3. Select unpinned movie<br/>4. Click add | Selected movie pinned and appears at bottom of Top Picks list; counter increments; list view star toggles | P1 |
| TC-064 | Custom display name saves and shows on public page | User on Top Picks manager | 1. Enter custom name for Top Picks (e.g., "My Must-Watch")<br/>2. Save<br/>3. Navigate to public movies page<br/>4. Observe carousel header | Custom name displayed as carousel row title on public page; default shows "Top Picks" if not customized | P1 |
| TC-065 | Counter shows correct X/15 | User has 7 pinned movies, limit is 15 | 1. Open Top Picks manager<br/>2. Observe pin counter badge<br/>3. Pin another movie<br/>4. Observe counter update | Counter displays "7/15"; after pinning, shows "8/15"; counter always current and accurate | P2 |

#### Manage Tab

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-070 | Shareable URL displayed correctly | User on list Manage tab | 1. Open list edit/manage page<br/>2. Look for Shareable URL section<br/>3. Observe URL field | URL displayed shows: creator-username/movies/list-slug (e.g., john-doe/movies/sci-fi-classics) | P0 |
| TC-071 | Copy link to clipboard works | User on list Manage tab with URL visible | 1. Click "Copy" button next to shareable URL<br/>2. Toast/confirmation shown<br/>3. Paste in text editor | URL copied to clipboard; confirmation toast appears; pasted content matches URL | P1 |
| TC-072 | QR code generates correctly | User on list Manage tab | 1. Observe QR code section<br/>2. Scan QR code with phone camera<br/>3. Follow link | QR code renders; scan opens public list page in mobile browser; link is correct | P1 |
| TC-073 | QR code downloadable as PNG | User on list Manage tab | 1. Click "Download QR" button<br/>2. PNG file downloads to device<br/>3. Open downloaded PNG<br/>4. Verify image shows QR code | PNG downloads with filename like "list-name-qr.png"; image displays QR code; code is scannable | P2 |

### Visitor Public Page Tests

#### Movies Page

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-100 | Public movies page loads at /:username/movies | Creator has at least one published movie list | 1. Navigate to /:username/movies<br/>2. Observe page load | Page loads successfully; creator's movies displayed; no 404 error | P0 |
| TC-101 | Header shows creator name and movie count | Creator has published movies | 1. Open public movies page<br/>2. Observe page header | Header displays creator name and total movie count (e.g., "John's Movies • 47 movies") | P1 |
| TC-102 | Top Picks carousel row appears first | Creator has pinned movies and published lists | 1. Open public movies page<br/>2. Observe carousel order | Top Picks carousel appears at top of page before other list carousels | P0 |
| TC-103 | Published lists appear as carousel rows | Creator has 3 published lists | 1. Open public movies page<br/>2. Count carousel rows | Each published list appears as its own carousel row; draft lists not shown | P0 |
| TC-104 | Lists appear in creator-defined order | Creator has ordered lists in dashboard | 1. Reorder lists in dashboard (drag)<br/>2. Open public movies page<br/>3. Observe carousel order | Public page carousels appear in exact same order as dashboard; reordering reflected immediately | P1 |
| TC-105 | Poster cards show poster + rating badge + title | Movies in carousel displayed | 1. Observe movie cards in carousel<br/>2. Look at each card | Each card shows: poster image, title, rating badge (stars or number) | P0 |
| TC-106 | TV shows display "Series" badge | Creator has TV shows in lists | 1. Open public movies page<br/>2. Look for TV show entries | TV shows marked with "Series" badge or label; distinct from movies | P1 |
| TC-107 | Horizontal scroll works in carousel rows | Carousel has more movies than visible | 1. Open public movies page<br/>2. Scroll carousel horizontally (drag on desktop, swipe on mobile)<br/>3. Verify new cards appear | Carousel scrolls smoothly; new movie cards appear on scroll; no jumping or jank | P0 |
| TC-108 | Genre browse section shows at bottom | Creator has movies with genres | 1. Scroll to bottom of movies page<br/>2. Observe genre section | Genre browse section visible with genre cards showing: genre name, movie count, backdrop image (optional) | P1 |
| TC-109 | Empty state for creator with no published movies | Creator has no published lists | 1. Navigate to /:username/movies<br/>2. Observe page | Empty state message shown (e.g., "No movies yet"); no broken carousel rows | P1 |
| TC-110 | Partial overflow on last card hints at scrollability | Carousel has movies extending past visible area | 1. Open public movies page<br/>2. Observe rightmost visible card in carousel | Last visible card shows partial overflow of next card (right edge cut off); suggests horizontal scroll capability | P2 |

#### Detail Modal

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-120 | Tap poster opens detail modal | Movie poster card visible on public page | 1. Click/tap movie poster card<br/>2. Observe modal open | Modal opens with smooth animation; backdrop dims or overlays; modal shows movie details | P0 |
| TC-121 | Modal shows all metadata (poster, title, year, rating, genres, director, runtime) | Detail modal open with movie | 1. Observe all fields in modal<br/>2. Verify completeness | Modal displays: poster image, title, release year, rating (stars/number), genre tags, director name(s), runtime (mins) | P0 |
| TC-122 | Creator's note displayed and visually highlighted | Movie has creator note | 1. Open detail modal for movie with note<br/>2. Observe note section | Note displayed in modal; visually distinct section (e.g., boxed, different background, quote style); labeled as creator comment | P0 |
| TC-123 | Where to Watch badges shown | Movie has watch providers | 1. Open detail modal for movie with providers<br/>2. Observe Where to Watch section | Streaming service badges displayed (Netflix, Prime Video, etc.) with correct logos/names | P1 |
| TC-124 | Watch badges are clickable and open streaming service | Streaming badges visible in modal | 1. Click a streaming service badge<br/>2. Observe action | Link opens streaming service search/title page in new tab (e.g., Netflix app or web search) | P1 |
| TC-125 | Creator's photos shown if uploaded | Movie has media uploaded | 1. Open detail modal for movie with photos<br/>2. Scroll through media section | Creator's media displayed in carousel/gallery below main details; photos clickable for fullscreen view | P2 |
| TC-126 | Source list link shown and navigates correctly | Movie belongs to a published list | 1. Open detail modal<br/>2. Look for source list link<br/>3. Click it | Link shown (e.g., "From: Sci-Fi Classics"); click navigates to list page (/:username/movies/:listSlug) | P1 |
| TC-127 | Share button works | Detail modal open | 1. Click "Share" button in modal<br/>2. Observe share options | Share sheet/dialog appears; options to copy link, share to social media, or generate QR (platform-dependent) | P1 |
| TC-128 | Swipe-down to dismiss on mobile | Detail modal open on mobile | 1. Swipe modal down<br/>2. Observe dismissal | Modal closes with smooth animation; swipe-down gesture recognized and dismisses modal | P0 |
| TC-129 | Close button (×) works | Detail modal open | 1. Click × button in top-right corner<br/>2. Observe dismissal | Modal closes; backdrop returns to normal; user back to carousel view | P0 |
| TC-130 | TV show shows season count | Detail modal open for TV show | 1. Click TV show poster<br/>2. Observe TV-specific fields | Modal shows "Seasons: X" or similar field; distinct from movie runtime | P1 |

#### List Page

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-140 | Tap list heading navigates to list page | List carousel visible on movies page | 1. Click list title/heading in carousel row<br/>2. Observe navigation | Page navigates to list detail page (/:username/movies/:listSlug) | P0 |
| TC-141 | List name and description shown | List page loaded | 1. Open list page<br/>2. Observe header/details | List name displayed as page title; description shown below (if provided) | P1 |
| TC-142 | Poster grid renders correctly (3-col mobile, 5-6 col desktop) | List page with movies displayed | 1. View on mobile (375px-390px)<br/>2. Observe column count<br/>3. Resize to desktop (1440px)<br/>4. Observe column count | Mobile: 3-column grid; desktop: 5-6 column grid; responsive breakpoint at ~768px | P0 |
| TC-143 | Tap poster in grid opens detail modal | Movie posters visible in grid | 1. Click any poster in grid<br/>2. Observe modal | Detail modal opens with movie information (same as TC-120) | P0 |
| TC-144 | Back link returns to main movies page | List page open | 1. Click "Back" or "← Movies" link<br/>2. Observe navigation | Navigates back to /:username/movies (main movies page) | P1 |
| TC-145 | URL is shareable (/:username/movies/:listSlug) | List page loaded | 1. Copy page URL<br/>2. Share with another user<br/>3. Other user opens URL<br/>4. Verify content | URL shows /:username/movies/:listSlug format; accessible to anyone; renders same content | P1 |

#### Genre Page

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-150 | Tap genre card navigates to genre page | Genre browse section visible at bottom | 1. Click a genre card (e.g., "Action")<br/>2. Observe navigation | Page navigates to genre page (/:username/movies/genres/:genreSlug or similar) | P0 |
| TC-151 | Genre page shows movies across all lists | Genre page loaded (e.g., "Action") | 1. Open genre page<br/>2. Observe movie grid | Movies from all published lists with "Action" genre shown in single grid | P0 |
| TC-152 | Poster grid renders correctly | Genre page with movies displayed | 1. View on mobile and desktop (per TC-142)<br/>2. Verify responsive grid | 3-col mobile, 5-6 col desktop grid layout consistent with TC-142 | P0 |
| TC-153 | Duplicate movies deduplicated by tmdb_id | Multiple lists have same movie with "Action" genre | 1. Open genre page<br/>2. Observe movie count | Each unique movie appears only once in grid (deduplicated by tmdb_id); no duplicates shown | P1 |
| TC-154 | Back link returns to main movies page | Genre page open | 1. Click "Back" or "← Movies" link<br/>2. Observe navigation | Navigates back to /:username/movies | P1 |
| TC-155 | Only genres with movies in published lists shown | Creator has unpublished lists with genres | 1. Open movies page<br/>2. Check genre section | Only genres that appear in at least one published list shown; no empty genres | P1 |
| TC-156 | Genre card shows correct count | Genre cards visible in browse section | 1. Observe count on genre card (e.g., "Action • 12")<br/>2. Open genre page<br/>3. Count displayed movies | Count on card matches number of unique movies in genre across all published lists | P2 |
| TC-157 | Genre card has backdrop image | Genre cards in browse section | 1. Observe genre card styling<br/>2. Look for background image | Genre card displays backdrop image from one of the movies in that genre; styled as card background | P2 |

### Cross-Cutting Tests

#### Responsive Design

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-200 | Dashboard sidebar renders at ≥768px | User on dashboard, desktop view | 1. Set viewport to 768px width<br/>2. Observe sidebar<br/>3. Increase to 1024px<br/>4. Observe sidebar | Sidebar visible at 768px and above; not visible below 768px | P0 |
| TC-201 | Category cards render at <768px | User on dashboard, mobile view | 1. Set viewport to 767px width<br/>2. Observe category display<br/>3. Decrease to 375px<br/>4. Observe layout | Category cards (not sidebar) displayed in grid/vertical stack layout on <768px; responsive at all mobile sizes | P0 |
| TC-202 | Poster grids are 3-col mobile, 5-6 col desktop | Public movies/list/genre pages on various sizes | 1. Set viewport to 375px<br/>2. Verify 3-col<br/>3. Set to 768px<br/>4. Verify 4-5 col<br/>5. Set to 1440px<br/>6. Verify 5-6 col | Grid columns adjust correctly at each breakpoint; no overflow or layout shift | P1 |
| TC-203 | Genre cards are 2-col mobile, 4-col desktop | Genre browse section visible | 1. Set viewport to 375px<br/>2. Count genre columns<br/>3. Set to 1440px<br/>4. Count genre columns | 2-column layout on mobile; 4-column layout on desktop; responsive adjustment at ~768px | P1 |
| TC-204 | Detail modal is full-width bottom sheet on mobile | Detail modal open on mobile | 1. Set viewport to 390px<br/>2. Open detail modal<br/>3. Observe presentation<br/>4. Set to 1024px<br/>5. Observe modal style | Mobile: full-width bottom sheet that slides up from bottom; desktop: centered modal with padding | P1 |
| TC-205 | Add movie form scrollable on small screens | Add movie form open on mobile | 1. Set viewport to 375px<br/>2. Open Add Movie form (search + detail card)<br/>3. Scroll form up/down | Form remains usable; no content hidden; vertical scroll available for all inputs and buttons | P1 |

#### Loading States

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-210 | Skeleton loaders during data fetch on Movies Home | User navigates to Movies Home | 1. Open Movies Home (fast connection throttled to slow)<br/>2. Observe initial render | Skeleton/placeholder loaders shown for list cards; content progressively loaded and replaced | P1 |
| TC-211 | Skeleton loaders during carousel row loading | Public movies page loading | 1. Throttle connection to slow<br/>2. Open public movies page<br/>3. Observe carousel rows | Each carousel row shows skeleton placeholders for movie cards; replaced as data loads | P1 |
| TC-212 | Search loading indicator during TMDB search | User typing in TMDB search on Add Movie page | 1. Type in search input<br/>2. Observe loading state before results appear | Loading spinner, "Searching..." text, or pulse animation shown; cleared when results appear or after debounce | P1 |

#### Error States

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-220 | TMDB API error shows user-friendly message | TMDB API unavailable or rate-limited | 1. Attempt TMDB search when API down<br/>2. Observe error handling | User-friendly error message shown (e.g., "Unable to search movies right now. Please try again later."); no technical error codes | P1 |
| TC-221 | Network error during save shows retry option | Network interrupted during "Add Movie" submission | 1. Submit movie to add<br/>2. Interrupt network during save<br/>3. Observe error handling | Error toast/message shown with "Retry" button; clicking retry re-attempts save | P1 |
| TC-222 | Missing poster image shows fallback | Movie has no poster image from TMDB | 1. Search and select movie with no poster<br/>2. View in Add Movie detail card<br/>3. View on public page in carousel<br/>4. Open detail modal | Fallback image (generic film icon, placeholder) displayed; no broken image; dimensions consistent with posters | P1 |

#### Regression

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-230 | Places dashboard fully functional after changes | User has existing Places data | 1. Navigate to Places category<br/>2. Test create/edit/delete place list<br/>3. Test add/edit/delete place<br/>4. Test publish/unpublish | All Places features work identically to before Movies feature was added; no performance degradation | P0 |
| TC-231 | Places public page fully functional after changes | Creator has published Places lists | 1. Navigate to public places page (/:username)<br/>2. Verify all Places features<br/>3. Tap place card, navigate lists, etc. | Public Places page renders correctly; all interactions work; no layout or navigation issues | P0 |
| TC-232 | No broken routes or navigation | User navigating across app | 1. Test navigation between all major routes:<br/>   - Movies Home<br/>   - Movie List page<br/>   - Public Movies page<br/>   - Places (dashboard and public)<br/>   - Profile, Settings, Guides, Analytics<br/>2. Use browser back/forward | All routes load correctly; back/forward navigation works; no 404 errors or missing pages | P0 |
| TC-233 | Authentication flow unaffected | User logs in/out | 1. Log out<br/>2. Log in with various methods (if applicable)<br/>3. Verify authenticated state<br/>4. Access protected pages | Login/logout works; authentication tokens valid; protected pages accessible when logged in, redirect when not | P0 |
| TC-234 | Other features (Guides, Analytics, Settings, Profile) unaffected | User accesses other features | 1. Navigate to Guides, Analytics, Settings, Profile<br/>2. Test basic functionality in each<br/>3. Verify no errors or visual issues | All features render and function normally; no regressions; no styling conflicts from Movies CSS | P0 |

#### i18n

| ID | Description | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-240 | All new UI text uses translation keys | New Movies components and pages created | 1. Review all new .tsx/.jsx files<br/>2. Search for hardcoded strings<br/>3. Verify translation key usage | No hardcoded English text found; all user-facing strings use i18n translation keys (t("key.path")) | P1 |
| TC-241 | No hardcoded strings in new components | All Movies feature components | 1. Grep for common translation functions in new code<br/>2. Verify 100% coverage<br/>3. Test in multiple languages if possible | All text properly internationalized; switching language changes all Movies UI text correctly | P1 |

---

## Browser/Device Testing Matrix

### Browsers

| Browser | Desktop | Mobile |
|---|---|---|
| Chrome (latest) | Yes | Yes (Android) |
| Safari (latest) | Yes | Yes (iOS) |
| Firefox (latest) | Yes | No (low priority) |
| Edge (latest) | Yes | No (low priority) |

### Screen Sizes

| Screen Size | Device Type | Example |
|---|---|---|
| 375px | Small mobile | iPhone SE |
| 390px | Standard mobile | iPhone 14, Galaxy S22 |
| 768px | Tablet / breakpoint | iPad, Galaxy Tab |
| 1024px | Small desktop | MacBook Air, Small monitor |
| 1440px | Standard desktop | Standard monitor, 14" laptop |

---

## Performance Benchmarks

These are target performance goals, not hard requirements. Actual performance should be measured post-launch and optimized iteratively.

| Metric | Target | Notes |
|---|---|---|
| Movies page initial load (FCP) | < 2 seconds | First Contentful Paint; includes network, parsing, rendering |
| TMDB search results appear | < 500ms | After debounce (typically 300ms debounce + 200ms response) |
| Carousel scroll (fps) | 60 fps | Smooth scrolling; no jank or stuttering on modern devices |
| Detail modal open animation | < 300ms | Smooth transition from card to modal |
| Poster image lazy loading | On scroll | Images outside viewport load only when scrolled into view |

---

## Test Data Requirements

For comprehensive testing, testers need the following test data:

### Creator Account Setup

- **Movie Lists**: At least 3 lists with varying states:
  - 1 published list with 10+ movies
  - 1 draft list with 5+ movies
  - 1 list with 15+ movies (to test sorting and limits)

- **Pinned Movies**: At least 15 pinned movies across lists to test:
  - Top Picks limit enforcement (15/15 max)
  - Reordering in Top Picks manager
  - Correct counter display

- **Movie Types**: Mix of both movies and TV shows:
  - At least 5 movies
  - At least 3 TV shows (clearly distinguishable with season counts)

### Edge Case Data

- **Movie with no poster image**: For testing fallback behavior
- **Movie with no watch providers**: For testing Where to Watch section when empty
- **Movie with very long title**: Test card layout and text truncation
- **Movie with very long personal note**: Test note display in modal and overflow handling
- **List with very long name**: Test header and card layout truncation
- **Genres**: Ensure movies cover multiple genres to test genre browse section

### Test Accounts

- **Creator Account**: Full dashboard access, ability to create/edit/delete lists and movies
- **Visitor Account** (optional): Access to read-only public pages to verify public view isn't affected by dashboard editing

This data enables thorough testing of all manual scenarios across normal cases, edge cases, and error states.
