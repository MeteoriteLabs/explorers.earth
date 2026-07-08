# Explorers Earth Production Category QA Report

Date: 2026-07-08
Target: https://explorers.earth
Mode: Authenticated production QA, standard tier
Account: logged-in in-app browser session provided by user

## Scope

Verify recommendation categories can create lists and create items under those lists. Non-destructive production policy: create QA data, avoid deletes, and keep newly created draft lists as draft unless public visibility specifically needs publishing.

Known exclusion: infrastructure/backend latency is recorded but not fixed in this pass.

## Summary

Status: In progress

| Category | List Create | Item Create | Publish Prompt | Manage Smoke | Console | Timing | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Products | Passed | Passed | Passed | Passed | No errors captured | ~66s list, ~75s item | Created `QA Products 713664` and added `QA Product 713664` |
| Apps & Tools | Passed | Passed | Passed | Passed | No errors captured | ~66s list, ~75s item | Created `QA Apps 713664` and added Figma |
| Movies | Passed | Passed | Passed | Passed | No errors captured | ~65s list, ~90s item | Created `QA Movies 713664` and added `Interstellar` |
| Books | Passed | Passed | Passed | Passed | No errors captured | ~65s list, ~75s item | Created `QA Books 713664` and added `Atomic Habits` |
| Games | Passed | Passed | Passed | Passed | No errors captured | ~66s list, ~75s item | Created `QA Games 713664` and added `Hades` |
| People | Passed | Passed | Passed | Passed | No errors captured | ~66s list, ~75s item | Created `QA People 713664` and added `QA Person 713664` |
| Music | Blocked | Blocked | N/A | N/A | No console errors captured | Page load only | Shows `Could not connect to Local Tunes` |
| Places | Blocked | Blocked | N/A | N/A | No console errors captured | ~75s failed submit | Add Location rejects typed location with `List Name is Required` |
| Guides | N/A | Wizard opens | N/A | N/A | No console errors captured | Wizard smoke only | `/guides/new` opens after hydration; full guide creation not completed |

## Issues

### ISSUE-001: Music page cannot connect to Local Tunes

Severity: High
Category: Functional
Status: Deferred for investigation

Evidence: Visiting `https://explorers.earth/music` while authenticated shows `Could not connect to Local Tunes` and `Failed to sync user with database`. No create-list/add-item controls are available on that page.

Impact: Music cannot currently be verified as a working category experience in production.

### ISSUE-002: Places Add Location rejects typed location

Severity: High
Category: Functional
Status: Needs code investigation

Repro:

1. Visit `https://explorers.earth/recommendations`.
2. Click `Add Location`.
3. Enter `Bengaluru` in `Search Location`.
4. Fill social link, note, and place URL.
5. Click `Add Location`.
6. Press Enter in the location field and click `Add Location` again.

Observed: the form remains open and shows `List Name is Required`. The location input still contains `Bengaluru`, but the app does not treat it as a valid selected list/location.

Expected: either the typed location should be accepted, or the UI should expose/select a concrete suggestion before submit. The validation message should match the visible `Search Location` field.

## Category Evidence

### Products

- Deployed retest before this full pass: created `QA Desk Lamp` in `Desk Setup`.
- Result: returned to list, item visible, `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Full pass list create: created `QA Products 713664`.
- Full pass item create: added `QA Product 713664` using manual entry.
- Full pass result: returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Timing: list create took about 66 seconds; item create took about 75 seconds.
- Console: no warning/error entries captured during the flow.

### Apps & Tools

- Deployed retest before this full pass: created Figma item in `Creator Stack`.
- Result: returned to list, item visible, `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Full pass list create: created `QA Apps 713664`.
- Full pass item create: added Figma using URL metadata fetch from `https://www.figma.com`.
- Full pass result: returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Timing: list create took about 66 seconds; item create took about 75 seconds.
- Console: no warning/error entries captured during the flow.

### Movies

- Created list: `QA Movies 713664`.
- List create result: passed; new draft list appeared on the Movies category page.
- Item created: `Interstellar`.
- Item create result: passed; returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Timing: list create took about 65 seconds; item create took about 90 seconds.
- Console: no warning/error entries captured during the flow.

### Books

- Created list: `QA Books 713664`.
- List create result: passed; new draft list appeared on the Books category page.
- Item created: `Atomic Habits`.
- Item create result: passed; returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Timing: list create took about 65 seconds; item create took about 75 seconds.
- Console: no warning/error entries captured during the flow.

### Games

- Created list: `QA Games 713664`.
- List create result: passed; new draft list appeared on the Games category page.
- Item created: `Hades`.
- Item create result: passed; returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Timing: list create took about 66 seconds; item create took about 75 seconds.
- Console: no warning/error entries captured during the flow.

### People

- Created list: `QA People 713664`.
- List create result: passed; new draft list appeared on the People category page.
- Item created: `QA Person 713664` using manual entry.
- Item create result: passed; returned to the list detail page, item was visible, and `Publish this list?` prompt appeared.
- Follow-up: clicked `Keep Draft`.
- Timing: list create took about 66 seconds; item create took about 75 seconds.
- Console: no warning/error entries captured during the flow.

### Manage Smoke

- Movies, Books, Games, People, Products, and Apps & Tools all opened the Manage panel from the created QA list detail pages.
- Manage panel showed the expected list name, `Delete`, `Edit`, draft/private state, and QR/share controls.
- No save/delete/publish action was performed during this smoke check.
- Direct detail URL reloads needed a longer readiness wait before `Manage` appeared, matching the known protected-route latency.

### Places

- Page load result: passed after protected-route/data wait.
- Existing public place lists visible: `Hyderabad`, `Singapore`.
- Add Location form opened.
- Creation result: blocked. Submitting with `Bengaluru`, social link, note, and place URL did not create a place/list; validation showed `List Name is Required`.
- Retry: pressing Enter in the location field before submitting still failed with the same validation.
- Console: no warning/error entries captured during the flow.

### Guides

- Page load result: passed after protected-route/data wait.
- Create Guide result: wizard opens at `https://explorers.earth/guides/new` after waiting for hydration.
- Wizard smoke: selecting guide type `Itinerary` and typing `Leh` into location keeps the user on Step 1 and correctly shows `Please select a location for this guide` when no location suggestion is selected.
- Full guide creation was not completed because this is a multi-step guide builder, not the same list + item category flow.

### Music

- Page load result: blocked.
- Observed page message: `Could not connect to Local Tunes` and `Failed to sync user with database`.
- No list/item creation controls were available to test.
- Console: no warning/error entries captured during the page load.
