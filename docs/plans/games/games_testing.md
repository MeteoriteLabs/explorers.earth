---
Feature: games
Doc type: testing
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_prd.md, games_flow.md
---

# Games — Testing Guide

## 1. Manual Test Scenarios

### Creator Dashboard Tests

#### TC-01: Category Navigation — Games
**Preconditions:** Creator is logged in. Games dashboard route exists.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open dashboard on desktop | Sidebar shows Places, Movies & Shows, Books, Games |
| 2 | Click "Games" in sidebar | Games Home view loads |
| 3 | Open dashboard on mobile | Category cards grid shows 4 cards including Games |
| 4 | Tap "Games" card | Games Home view loads |
| 5 | Navigate away and return | Active state on Games item is highlighted |

**Pass Criteria:** All navigation paths reach Games Home. No sidebar regressions in other categories.

---

#### TC-02: Create Game List
**Preconditions:** Creator is on Games Home. No existing game lists.

| Step | Action | Expected Result |
|---|---|---|
| 1 | See Games Home | Empty state shown with CTA button |
| 2 | Click "+ Create Your First List" | Create list modal opens |
| 3 | Enter "All-Time Favorites" as list name | Slug auto-populates as "all-time-favorites" |
| 4 | Edit slug to "my-favorites" | Slug updates to "my-favorites" |
| 5 | Click "Create List" | Modal closes, navigated to empty list view |
| 6 | Navigate back to Games Home | List card appears with "Draft" badge |
| 7 | Open modal again, try to create list with same slug | Error shown: "Slug already in use" |

**Pass Criteria:** List created, slug auto-generated, duplicate slug rejected.

---

#### TC-03: Add Game via IGDB Search
**Preconditions:** Creator is inside a game list. Strapi proxy (H2) is running.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click "+ Add Game" | Full-page overlay opens, shows search input |
| 2 | Type "Elden" in search | Debounced 300ms, then results appear |
| 3 | Verify results show covers, titles, platforms | Each result card shows cover art, title, year, platforms |
| 4 | Click "Select" on "Elden Ring" | Search collapses, game info auto-fills |
| 5 | Verify auto-fill | Title, release year, developer (FromSoftware), publisher, platforms, genres (Action, RPG), IGDB rating, summary visible |
| 6 | Enter personal note in Tiptap editor | Rich text editor responds, formatting works |
| 7 | Set user rating to 9 | 9 stars light up |
| 8 | Check "Add to Top Picks" | Checkbox checked |
| 9 | Click "Add to List" | Navigated back to list view |
| 10 | Verify game appears in list | Game row shows cover, title, platforms, rating badge |
| 11 | Check Games Home Top Picks strip | Elden Ring appears in Top Picks strip |

**Pass Criteria:** Game added, all metadata stored correctly, Top Picks updated.

---

#### TC-04: IGDB Search — Edge Cases
**Preconditions:** Creator is on Add Game overlay.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Type a single character "a" | No search triggered (min 2 chars) |
| 2 | Type "xyzxyzxyz" (no results) | "No games found. Try a different title." message |
| 3 | Type and immediately clear the search | Results clear, input is empty |
| 4 | Type "cyberpunk 2077" | Results include Cyberpunk 2077, no DLC results (category filter works) |
| 5 | Disconnect network mid-search | Error message: "Unable to search. Check your internet connection." |

**Pass Criteria:** Edge cases handled gracefully, no crashes.

---

#### TC-05: Manage Games in List
**Preconditions:** Creator has a list with at least 3 games.

| Step | Action | Expected Result |
|---|---|---|
| 1 | View list with 3 games | All 3 games shown as draggable rows |
| 2 | Click ⭐ on first game (unpin it first if pinned) | Star fills, is_pinned=true, pin_order assigned |
| 3 | Click ⭐ again | Star empties, is_pinned=false |
| 4 | Click ⋮ → "Edit" on a game | Edit overlay opens with pre-filled data |
| 5 | Update the note text | Save |
| 6 | Verify updated note in list row | Note preview updated |
| 7 | Drag Game 1 below Game 3 | Order changes, display_order updated |
| 8 | Refresh page | Order persists |
| 9 | Click ⋮ → "Delete" on Game 2 | Confirmation dialog appears |
| 10 | Confirm deletion | Game removed from list |

**Pass Criteria:** All CRUD actions work, drag order persists.

---

#### TC-06: Pin Limit Enforcement
**Preconditions:** Creator has exactly 15 games pinned to Top Picks.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Try to pin a 16th game | "You've reached the maximum of 15 Top Picks. Unpin a game first." |
| 2 | Unpin one game | That game's star empties |
| 3 | Pin the 16th game | Successfully pinned |

**Pass Criteria:** Limit enforced, error message shown, management works after unpinning.

---

#### TC-07: Top Picks Manager
**Preconditions:** Creator has 3+ games pinned.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click "Manage" on Top Picks strip | Top Picks Manager view loads |
| 2 | Verify draggable list | All pinned games visible with covers, titles, × buttons |
| 3 | Counter shows "3/15 picks used" | Counter accurate |
| 4 | Change display name to "My Must-Plays" | Name field updates |
| 5 | Save/blur the field | Display name saved to Strapi |
| 6 | Drag game 1 to position 3 | Order updates |
| 7 | Refresh page | Order persists |
| 8 | Click × on a game | Game unpinned, removed from manager list |
| 9 | Counter updates to "2/15 picks used" | Counter decremented |

---

#### TC-08: Publish & Share List
**Preconditions:** Creator has a list with at least 1 game.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Toggle publish switch to ON | "Publish Now" confirmation appears |
| 2 | Confirm publish | List shows "Published" badge |
| 3 | Navigate to Manage tab | Share URL shown: `explorers.earth/{username}/games/{slug}` |
| 4 | Click "Copy" | URL in clipboard, toast shown |
| 5 | Navigate to public URL in browser | Public games page loads with this list |
| 6 | Toggle publish switch to OFF | List hides immediately from public page |

---

### Visitor / Public Page Tests

#### TC-09: Public Games Page — Main View
**Preconditions:** Creator has 2+ published game lists, each with 3+ games, and some pinned.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to `/:username/games` | Page loads |
| 2 | Check header | "[Creator]'s Games · [N] games" shown |
| 3 | Verify Top Picks row at top | Horizontal carousel with pinned games |
| 4 | Verify list rows below | Each published list appears as a named carousel row |
| 5 | Verify genre browse section at bottom | Genre cards shown with game art backgrounds |
| 6 | Scroll each carousel horizontally | Smooth horizontal scroll works on both touch and mouse |

---

#### TC-10: Cover Cards
**Preconditions:** Public games page loaded.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Inspect a cover card | Cover art visible (portrait ratio), title below, platforms below title |
| 2 | Check rating badge | Bottom-right badge shows rating (user or IGDB/10) |
| 3 | Hover over card (desktop) | Card scales up 1.05x |
| 4 | Game with no cover art | Placeholder shown (game controller icon or generic art) |
| 5 | Game with many platforms | Max 3 platforms shown, "+N more" chip if overflow |

---

#### TC-11: Game Detail Modal
**Preconditions:** Public games page loaded, at least one game visible.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Tap a game cover card | Detail modal slides up from bottom |
| 2 | Verify drag bar visible (mobile) | Drag bar at top of modal |
| 3 | Check content: cover art | Large cover art displayed |
| 4 | Check content: metadata | Title, year, platforms (all), developer, publisher, genres, game modes visible |
| 5 | Check content: ratings | IGDB rating (x.x/10) + creator's rating (stars) |
| 6 | Check content: creator note | Tiptap-formatted note displayed |
| 7 | Check content: screenshots | IGDB screenshots in horizontal scroll (if available) |
| 8 | Check "From: [list name]" link | Link visible, tapping navigates to list grid |
| 9 | Swipe down on modal (mobile) | Modal dismisses after 100px threshold |
| 10 | Tap × button | Modal closes |
| 11 | Share button | Native share dialog or copy link option appears |

---

#### TC-12: List Grid Page
**Preconditions:** Public games page loaded.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Tap list heading "All-Time Favorites >" | Navigates to `/:username/games/all-time-favorites` |
| 2 | Verify heading | "All-Time Favorites" shown with game count |
| 3 | Verify back link | "← [Creator]'s Games" back link at top |
| 4 | View grid | 3 columns (mobile), 5-6 columns (desktop) |
| 5 | Tap a game cover | Detail modal opens |
| 6 | Tap back link | Returns to main public games page |

---

#### TC-13: Genre Browse & Genre Page
**Preconditions:** Creator has published games with different genres.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Scroll to "Browse by Genre" section | Genre cards visible with game art backgrounds |
| 2 | Verify game counts on genre cards | Each card shows correct count |
| 3 | Only genres with ≥1 game shown | No empty genres shown |
| 4 | Tap "Role-playing (RPG)" card | Navigates to `/:username/games/genre/role-playing-rpg` |
| 5 | Verify heading | "Role-playing (RPG)" shown with game count |
| 6 | Verify back link | "← [Creator]'s Games" back link |
| 7 | View grid | Games from all lists with that genre |
| 8 | Tap a cover | Detail modal opens |

---

### Edge Case Tests

#### TC-14: Empty States
| Scenario | Expected Result |
|---|---|
| Creator has no game lists | Games Home: "No game lists yet. Create your first list." + CTA button |
| Creator has list with no games | List view: "No games in this list yet. Add your first game!" |
| Creator has no pinned games | Top Picks strip not shown |
| Creator has no published lists | Public page shows "No games shared yet" empty state |
| Creator has published list but 0 games | Carousel row for that list shows empty state gracefully |

---

#### TC-15: Platform Chip Display
| Scenario | Expected Result |
|---|---|
| Game on 1 platform | 1 platform chip shown |
| Game on 3 platforms | All 3 chips shown |
| Game on 8 platforms | 3 chips + "+5 more" chip |
| Detail modal with 8 platforms | All 8 chips shown (wraps to multiple lines) |
| Platform name "PC (Microsoft Windows)" | Shortened to "PC" in cards |
| Platform name "PlayStation 5" | Shortened to "PS5" in cards |

---

#### TC-16: IGDB Rating Display
| Scenario | Expected Result |
|---|---|
| Game with `total_rating: 93.2` | Shown as "9.3" with star icon |
| Game with `total_rating: null` | No IGDB rating badge shown |
| Game with `user_rating: 8`, no IGDB rating | User rating badge shows "8" |
| Game with both `user_rating: 8` and `igdb_rating: 93.2` | User rating shown in card badge; both shown in detail modal |

---

## 2. Component Test Cases

### IgdbSearch Component
- Renders empty state on mount (no query)
- Calls Strapi proxy API after 300ms debounce
- Shows loading spinner during fetch
- Renders game result cards with correct data
- Handles proxy error: shows error message
- Handles empty results: shows "No games found" message
- "Select" button triggers callback with full IGDB result

### GameCoverCard Component
- Renders cover art at correct aspect ratio (3:4)
- Shows rating badge with correct value (user_rating preferred)
- Shows platform chips (max 3 + overflow)
- Shows title and truncates at 2 lines
- Shows fallback image when cover art is null
- Triggers onClick callback when clicked

### GameDetailModal Component
- Renders all metadata fields
- Shows platform chips (all, wrapping)
- Shows IGDB screenshots (horizontal scroll)
- Renders Tiptap note content
- Dismisses on swipe-down (100px threshold)
- Dismisses on × button click

### GameCarouselRow Component
- Renders horizontal scrollable row
- Shows list name heading with ">" arrow
- Shows correct number of cards
- Handles empty game list gracefully

---

## 3. Integration Tests — IGDB Proxy Service

### Proxy Search Tests
```typescript
// Test: Basic search returns results
const results = await igdbService.searchGames('elden ring');
expect(results.length).toBeGreaterThan(0);
expect(results[0]).toHaveProperty('id');
expect(results[0]).toHaveProperty('name');
expect(results[0]).toHaveProperty('cover.image_id');

// Test: DLC filter works (category filter 0,8,9)  
const results = await igdbService.searchGames('elden ring');
const mainGamesOnly = results.every(r => [0, 8, 9].includes(r.category));
expect(mainGamesOnly).toBe(true);

// Test: Empty search returns empty array
const results = await igdbService.searchGames('xyzxyz_not_a_real_game');
expect(results).toEqual([]);
```

### URL Builder Tests
```typescript
// getCoverUrl
expect(igdbService.getCoverUrl('co2ms3', 'cover_big'))
  .toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co2ms3.jpg');

// getScreenshotUrl
expect(igdbService.getScreenshotUrl('scm8yz', '720p'))
  .toBe('https://images.igdb.com/igdb/image/upload/t_720p/scm8yz.jpg');
```

### Rating Formatter Tests
```typescript
// formatIgdbRating
expect(igdbService.formatIgdbRating(93.2)).toBe('9.3');
expect(igdbService.formatIgdbRating(100)).toBe('10.0');
expect(igdbService.formatIgdbRating(null)).toBeNull();
```

### Data Transformer Tests
```typescript
// transformIgdbResult
const mockResult: IGDBSearchResult = {
  id: 1877,
  name: 'The Witcher 3: Wild Hunt',
  slug: 'the-witcher-3-wild-hunt',
  cover: { image_id: 'co2ms3' },
  total_rating: 93.2,
  total_rating_count: 1847,
  first_release_date: 1431993600,
  genres: [{ id: 12, name: 'Role-playing (RPG)' }],
  platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
  involved_companies: [
    { developer: true, publisher: false, company: { name: 'CD Projekt Red' } }
  ],
  game_modes: [{ id: 1, name: 'Single player' }],
  screenshots: [{ image_id: 'scm8yz' }],
};

const result = igdbService.transformIgdbResult(mockResult);
expect(result.igdb_id).toBe(1877);
expect(result.title).toBe('The Witcher 3: Wild Hunt');
expect(result.cover_url).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co2ms3.jpg');
expect(result.cover_url_large).toBe('https://images.igdb.com/igdb/image/upload/t_1080p/co2ms3.jpg');
expect(result.release_year).toBe('2015');
expect(result.developer).toBe('CD Projekt Red');
expect(result.igdb_rating).toBe(93.2);
expect(result.game_modes).toEqual(['Single player']);
expect(result.screenshot_ids).toEqual(['scm8yz']);
```

---

## 4. Cross-Browser / Device Testing Matrix

| Browser / Device | Navigation | Carousel Scroll | Detail Modal | Add Game |
|---|---|---|---|---|
| Chrome (Desktop) | ✓ | ✓ | ✓ | ✓ |
| Firefox (Desktop) | ✓ | ✓ | ✓ | ✓ |
| Safari (Desktop) | ✓ | ✓ | ✓ | ✓ |
| Chrome (Android) | ✓ | Touch scroll | Swipe dismiss | Keyboard aware |
| Safari (iPhone) | ✓ | Touch scroll | Swipe dismiss | Keyboard aware |

**Mobile-specific checks:**
- Touch momentum scrolling in carousels (not jerky)
- Swipe-down-to-dismiss in detail modal (100px threshold)
- Add game form: keyboard doesn't hide submit buttons (pb-40 container)
- Platform chips wrap correctly on small screens
- Genre grid is 2 columns on mobile, 4 on desktop

---

## 5. Regression Tests (Existing Features)

After implementing Games, run the following to confirm no regressions:

### Places Dashboard
- [ ] Navigate to `/recommendations` — Places dashboard loads
- [ ] Create a place recommendation — works

### Movies & Shows Dashboard
- [ ] Navigate to `/recommendations/movies` — Movies dashboard loads
- [ ] Add a movie via TMDB — works
- [ ] Public movies page at `/:username/movies` — loads correctly

### Books Dashboard
- [ ] Navigate to `/recommendations/books` — Books dashboard loads
- [ ] Add a book via Google Books — works
- [ ] Public books page at `/:username/books` — loads correctly

---

## 6. Performance Checks

| Metric | Target | Notes |
|---|---|---|
| Public games page initial load | < 2s | Apollo cache-first, lazy load carousels |
| IGDB search response time | < 800ms | Proxy adds ~50-100ms overhead vs direct call |
| Detail modal open animation | < 200ms | Framer Motion slide-up |
| Cover image load time | < 500ms | IGDB Twitch CDN is fast |
| Slug auto-generation | Instant | Client-side |
| Pin toggle response | < 500ms | Optimistic update + mutation |
