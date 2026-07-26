# explorers.earth HIGH+MEDIUM Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 5 open HIGH/MEDIUM bugs from `BUG-REPORT-2026-07-25.md` (BUG-2 guides already fixed
on this branch) with minimal, well-scoped changes + regression tests, in one PR against `main`.

**Architecture:** Frontend is `explorers-earth/` (React 18 + TS + Vite + Apollo + Formik, Vitest +
@testing-library/react). Each fix is a small, isolated change with a co-located `__tests__` regression
test. One bug (BUG-6) is rooted in the separate `tunes/` Express app; we add a defensive frontend guard
here and flag the server fix as a follow-up.

**Tech Stack:** React, TypeScript, Apollo Client, Formik, react-router-dom, sonner (toast), Vitest,
@testing-library/react, @apollo/client/testing (`MockedProvider`).

---

## Decisions needed before/while implementing (flag to user)

- **D1 — BUG-6 server fix scope.** The wrong-price root cause is in `tunes/server/utils/scrapeUtils.ts`
  (first-match `.a-price .a-offscreen` grabs the installment price; locale-naive number parse; currency
  mirrors the wrong widget). Fixing it changes the `tunes` deploy, not explorers.earth. This plan adds a
  **frontend guard** (don't silently trust a scraped price; warn + let user correct) in the explorers PR,
  and lists the exact server fix as a **separate follow-up PR** in `tunes`. Confirm this split.
- **D2 — Places "open into new list".** Places has no `/places/:listId` route; a list is a city rendered
  inline via `selectedCity` (Zustand). The fix here is: on create, set `selectedCity` from the mutation's
  returned `documentId` (robust vs the current name lookup) and scroll it into view. Whether the Favorites
  dashboard should also switch to a full "detail" surface for the new empty city is a UX decision — flagged.

---

## File map (what changes)

- `explorers-earth/src/features/PublicHome/components/PublicPlaceCard.tsx` — BUG-1 render guard.
- `explorers-earth/src/features/PublicHome/components/PublicGuides.tsx` — BUG-1 render guard (2 sites).
- `explorers-earth/src/features/Favorites/hooks/useAddRecommendation.ts` — BUG-1 data fix (`?? null`).
- `explorers-earth/src/features/Profile/components/AddressInput.tsx` — BUG-4 ref-stable autocomplete.
- `explorers-earth/src/features/{Movies,Books,Games,AppsAndTools,Products,People}/components/dashboard/*Home.tsx`
  — BUG-3 navigate into new list.
- `explorers-earth/src/features/Favorites/hooks/useCreateLocation.ts` — BUG-3(Places) robust id + BUG-5 error handling.
- `explorers-earth/src/components/ui/AddLocationModal.tsx` — BUG-5 await submit + button loading.
- `explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx` — BUG-6 frontend price guard.
- New tests co-located in `__tests__/` dirs.

---

## Task 1: BUG-1a — Harden public rating render (fixes all existing bad rows)

**Files:**
- Modify: `explorers-earth/src/features/PublicHome/components/PublicPlaceCard.tsx:105-115`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicGuides.tsx:642-650, 755-799`
- Test: `explorers-earth/src/features/PublicHome/components/__tests__/PublicPlaceCard.test.tsx` (new)

- [ ] **Step 1: Write the failing test** (`PublicPlaceCard.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PublicPlaceCard from "../PublicPlaceCard";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const base = { title: "Lalbagh", subtitle: "Park", imageUrl: "", onClick: () => {} };
const renderCard = (props: any) =>
  render(<MemoryRouter><PublicPlaceCard {...base} {...props} /></MemoryRouter>);

describe("PublicPlaceCard rating", () => {
  it("does not crash and hides rating when rating is an empty string", () => {
    expect(() => renderCard({ rating: "" as any })).not.toThrow();
    expect(screen.queryByText(/★/)).toBeNull();
  });
  it("renders a numeric string rating without throwing", () => {
    expect(() => renderCard({ rating: "8.8" as any })).not.toThrow();
    expect(screen.getByText(/8\.8/)).toBeTruthy();
  });
  it("renders a numeric rating", () => {
    renderCard({ rating: 8.8 });
    expect(screen.getByText(/8\.8/)).toBeTruthy();
  });
  it("hides rating when undefined", () => {
    renderCard({ rating: undefined });
    expect(screen.queryByText(/★/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd explorers-earth && npx vitest run src/features/PublicHome/components/__tests__/PublicPlaceCard.test.tsx`
Expected: FAIL — `TypeError: rating.toFixed is not a function` on the `rating: ""` case.

- [ ] **Step 3: Implement the render guard** in `PublicPlaceCard.tsx`. Replace the rating block
  (currently lines 105-115, guard `rating !== undefined`) with a numeric coercion + finite check:

```tsx
{(() => {
  const numericRating = typeof rating === "number" ? rating : Number(rating);
  const hasRating = Number.isFinite(numericRating);
  const numericReviews = typeof reviews === "number" ? reviews : Number(reviews);
  const hasReviews = Number.isFinite(numericReviews) && numericReviews > 0;
  if (!hasRating && !hasReviews) return null;
  return (
    <div className="flex items-center gap-1 text-[0.58rem] md:text-[0.62rem] font-semibold text-white/90 font-poppins mt-0.5">
      {hasRating && (
        <span className="text-[#fbbf24] flex items-center gap-0.5">★ {numericRating.toFixed(1)}</span>
      )}
      {hasReviews && <span className="text-white/70">({numericReviews})</span>}
    </div>
  );
})()}
```

- [ ] **Step 4: Apply the same coercion in `PublicGuides.tsx`.** At the two rating computations
  (`const rating = placeDetails.Rating || 5.0` at ~642 and ~755), replace with a numeric coercion so a
  truthy non-numeric string can't reach `.toFixed`:

```tsx
const rawRating = placeDetails.Rating;
const rating = Number.isFinite(Number(rawRating)) ? Number(rawRating) : 5.0;
```
(Leaves the existing `rating.toFixed(1)` at lines 650/799 safe.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/PublicHome/components/__tests__/PublicPlaceCard.test.tsx`
Expected: PASS (all 4 cases).

- [ ] **Step 6: Commit**

```bash
git add explorers-earth/src/features/PublicHome/components/PublicPlaceCard.tsx \
        explorers-earth/src/features/PublicHome/components/PublicGuides.tsx \
        explorers-earth/src/features/PublicHome/components/__tests__/PublicPlaceCard.test.tsx
git commit -m "fix(public): guard rating.toFixed against non-numeric values (BUG-1 render)"
```

---

## Task 2: BUG-1b — Stop persisting string ratings

**Files:**
- Modify: `explorers-earth/src/features/Favorites/hooks/useAddRecommendation.ts:298-299, 864-865`
- Test: `explorers-earth/src/features/Favorites/__tests__/placeDetailsRating.test.ts` (new)

- [ ] **Step 1: Write the failing test** — extract-and-test the numeric fallback. Add a tiny exported
  pure helper `buildPlaceRating` to `useAddRecommendation.ts` and test it (keeps the test unit-sized,
  no Apollo/Formik needed):

```ts
// in useAddRecommendation.ts (module scope, exported)
export const toNumberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
```

```ts
// placeDetailsRating.test.ts
import { describe, it, expect } from "vitest";
import { toNumberOrNull } from "../hooks/useAddRecommendation";

describe("toNumberOrNull", () => {
  it("keeps finite numbers", () => expect(toNumberOrNull(4.2)).toBe(4.2));
  it("maps undefined/null/empty-string to null", () => {
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("8.8")).toBeNull(); // never persist strings
  });
});
```

- [ ] **Step 2: Run test to verify it fails** (`toNumberOrNull` not exported yet)

Run: `cd explorers-earth && npx vitest run src/features/Favorites/__tests__/placeDetailsRating.test.ts`
Expected: FAIL — import error / undefined.

- [ ] **Step 3: Implement.** Add `toNumberOrNull` (Step 1 code) and use it in both `Place_Details` blocks.
  Change lines 298-299 (create) and 864-865 (edit) from `|| ""` to the helper:

```ts
Rating: toNumberOrNull(placeDetails?.data?.rating),
Rating_Count: toNumberOrNull(placeDetails?.data?.userRatingCount),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/Favorites/__tests__/placeDetailsRating.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add explorers-earth/src/features/Favorites/hooks/useAddRecommendation.ts \
        explorers-earth/src/features/Favorites/__tests__/placeDetailsRating.test.ts
git commit -m "fix(places): persist Place_Details.Rating as number|null, never string (BUG-1 data)"
```

---

## Task 3: BUG-4 — AddressInput: build the Google Autocomplete once (fixes lost location)

**Files:**
- Modify: `explorers-earth/src/features/Profile/components/AddressInput.tsx:91-200`
- Test: `explorers-earth/src/features/Profile/components/__tests__/AddressInput.placeChanged.test.tsx` (new)

**Root cause:** the init `useEffect` dep array (line 200) includes `onChange` and `setPlaces` (fresh
closures each render). A keystroke re-render tears down and rebuilds the Autocomplete, so the pending
`place_changed` fires on the cleared instance and `setPlaces(place)` never runs.

- [ ] **Step 1: Write the failing test.** Mock `@vis.gl/react-google-maps` `useMapsLibrary` to return a
  fake `places` lib whose `Autocomplete` lets the test dispatch `place_changed`, and assert `setPlaces`
  is called even after the parent re-renders (changing callback identities).

```tsx
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

let placeChangedCb: (() => void) | null = null;
const fakePlace = { place_id: "p1", geometry: { location: { lat: () => 1, lng: () => 2 } }, formatted_address: "Jaipur, Rajasthan, India" };
class FakeAutocomplete {
  addListener(evt: string, cb: () => void) { if (evt === "place_changed") placeChangedCb = cb; }
  getPlace() { return fakePlace; }
}
vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: () => ({ Autocomplete: FakeAutocomplete }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
// stub google event API used in cleanup
(globalThis as any).google = { maps: { event: { clearInstanceListeners: vi.fn() } } };

import AddressInput from "../AddressInput";

describe("AddressInput place_changed", () => {
  it("reports the selected place even after parent re-renders", () => {
    const setPlaces = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <AddressInput type="listName" label="x" setPlaces={setPlaces} onChange={onChange} placeHolder="p" />
    );
    // simulate a keystroke-driven re-render that gives new closure identities
    rerender(<AddressInput type="listName" label="x" setPlaces={(...a) => setPlaces(...a)} onChange={(...a) => onChange(...a)} placeHolder="p" />);
    expect(placeChangedCb).toBeTruthy();
    placeChangedCb!(); // Google fires selection
    expect(setPlaces).toHaveBeenCalledWith(expect.objectContaining({ place_id: "p1" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd explorers-earth && npx vitest run src/features/Profile/components/__tests__/AddressInput.placeChanged.test.tsx`
Expected: FAIL — after rerender the effect rebuilt the instance, so the captured `placeChangedCb` belongs
to the old instance and `setPlaces` isn't called (or is stale).

- [ ] **Step 3: Implement the ref-stable fix** in `AddressInput.tsx`:
  1. Near the top of the component, add refs kept current every render:
     ```tsx
     const onChangeRef = useRef(onChange);
     const setPlacesRef = useRef(setPlaces);
     onChangeRef.current = onChange;
     setPlacesRef.current = setPlaces;
     ```
  2. Inside the `place_changed` listener body (currently ~lines 172-188), call the refs instead of the
     props: replace `setPlaces(place)` → `setPlacesRef.current?.(place)` and any `onChange(returnValue)`
     inside that listener → `onChangeRef.current?.(returnValue)`.
  3. Change the init-effect dependency array at line 200 from
     `[placesLibrary, onChange, setPlaces, type]` to `[placesLibrary, type]`.
  (Do NOT change the input's manual `onChange` at line 376 — manual typing must keep calling `onChange`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/Profile/components/__tests__/AddressInput.placeChanged.test.tsx`
Expected: PASS.

- [ ] **Step 5: Regression-guard the 12 consumers** — run the existing AddressInput + dependent tests:

Run: `cd explorers-earth && npx vitest run src/features/Profile/components/__tests__/AddressInput.test.tsx`
Expected: PASS (existing behavior unchanged).

- [ ] **Step 6: Commit**

```bash
git add explorers-earth/src/features/Profile/components/AddressInput.tsx \
        explorers-earth/src/features/Profile/components/__tests__/AddressInput.placeChanged.test.tsx
git commit -m "fix(location): build Google Autocomplete once so first selection is captured (BUG-4)"
```

---

## Task 4: BUG-3 — Open the new list after creating it (6 route-based categories)

**Files (each modifies the parent `onCreated` handler; convention proven in
`Favorites/components/AddLinkedProductsPage.tsx:264`):**
- `Movies/components/dashboard/MoviesHome.tsx:655-667`
- `Books/components/dashboard/BooksHome.tsx:650-662`
- `Games/components/dashboard/GamesHome.tsx:634-648`
- `AppsAndTools/components/dashboard/AppsHome.tsx:593`
- `Products/components/dashboard/ProductsHome.tsx:498`
- `People/components/dashboard/PeopleHome.tsx:484`
- Tests: one source-assertion test per category in each `components/dashboard/__tests__/`
  (mirror `AppsAndTools/.../__tests__/addAppNavigationState.test.ts`).

The modal already forwards `documentId` to `onCreated`. `:listId` = `documentId`. `useNavigate` is
already imported in every Home.

- [ ] **Step 1: Write the failing source-assertion test (Apps example)**
  `AppsAndTools/components/dashboard/__tests__/createAppListNavigation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("AppsHome navigates into the new list after create", () => {
  const src = readFileSync(join(__dirname, "../AppsHome.tsx"), "utf8");
  expect(src).toMatch(/navigate\(`\/recommendations\/apps\/\$\{[^}]+\}`/);
});
```
(Repeat per category with the matching route substring.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd explorers-earth && npx vitest run src/features/AppsAndTools/components/dashboard/__tests__/createAppListNavigation.test.ts`
Expected: FAIL (no navigate call yet).

- [ ] **Step 3: Implement per category.** Change the parent `onCreated` to accept the id and navigate.
  Apps (single-line `onCreated={() => refetch()}` at :593):
```tsx
onCreated={(newId?: string) => {
  refetch();
  if (newId) navigate(`/recommendations/apps/${newId}`);
}}
```
  Products (:498) → `/recommendations/products/${newId}`; People (:484) → `/recommendations/people/${newId}`.
  Movies (:655-667), Books (:650-662), Games (:634-648): keep their existing refetch/visibility-prompt
  body and append the navigate, passing state so the detail page's existing post-create prompt fires:
```tsx
onCreated={(newId?: string) => {
  refetch();
  if (newId) navigate(`/recommendations/movies/${newId}`, { state: { justCreatedList: true } });
}}
```
  (Books/Games use their own `justCreatedList` handling — mirror it; verify the detail view reads
  `location.state?.justCreatedList` as MoviesHome does at :349-363.)

- [ ] **Step 4: Run each category test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/{AppsAndTools,Products,People,Movies,Books,Games}/components/dashboard/__tests__/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add explorers-earth/src/features/*/components/dashboard/*Home.tsx \
        explorers-earth/src/features/*/components/dashboard/__tests__/create*ListNavigation.test.ts
git commit -m "fix(lists): navigate into the newly created list (BUG-3, 6 categories)"
```

---

## Task 5: BUG-5 + BUG-3(Places) — Places create: surface error, await submit, loading, robust id

**Files:**
- Modify: `explorers-earth/src/features/Favorites/hooks/useCreateLocation.ts:60-188`
- Modify: `explorers-earth/src/components/ui/AddLocationModal.tsx:133-214, 328-333`
- Test: `explorers-earth/src/features/Favorites/__tests__/useCreateLocation.errors.test.ts` (new)

- [ ] **Step 1: Write the failing test** — mock `axios.get` to reject; assert `toast.error` fires and
  loading is reset (submit no longer silently swallows).

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("axios", () => ({ default: { get: vi.fn().mockRejectedValue(new Error("boom")), post: vi.fn() } }));
// ...mock useMutation/useQuery from @apollo/client and stores as the file requires...

// renderHook(useCreateLocation, ...); call handleLocationSubmit({ placeId: "x", listName: "Y" });
// expect(toast.error).toHaveBeenCalled(); expect(setIsLoading).toHaveBeenLastCalledWith(false);
```
(Fill in the Apollo/store mocks to match `AddressInput.test.tsx`/`ListCreation.test.tsx` conventions.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd explorers-earth && npx vitest run src/features/Favorites/__tests__/useCreateLocation.errors.test.ts`
Expected: FAIL — no `toast.error` on the pre-try throw.

- [ ] **Step 3a: Wrap the whole flow in try/catch/finally** in `handleLocationSubmit`
  (`useCreateLocation.ts`): move `try {` to just before the `axios.get` (line ~66), make `setIsLoading(true)`
  the first line of the try, and change the catch (185-187) to:
```ts
} catch (error) {
  console.error("Failed to create location:", error);
  toast.error(t("toast.error.recommendedListUpdateFailed"));
} finally {
  setIsLoading(false);
}
```

- [ ] **Step 3b: Use the returned documentId (Places create-nav, robust vs name lookup).** In the success
  branch (~163-181), replace the name-based city lookup with the mutation response id:
```ts
const created = response.data?.createRecommendationList;
if (created?.documentId) {
  const refreshed = await refetchCities();
  const updatedCity =
    refreshed.data?.recommendationLists?.find((l: selectedCity) => l.documentId === created.documentId)
    ?? created;
  setSelectedCity(updatedCity);
}
toast(t("dashboard.recommendations.toastMessages.listCreated"));
setIsLocationModalOpen(false);
if (onCreated) onCreated(created?.documentId);
```
  (This makes the newly created city the selected one via its stable id — the existing scroll-to-selected
  effect at `Favorites.tsx:320-332` then brings it into view. See D2 if a full detail surface is wanted.)

- [ ] **Step 3c: Await + loading in the modal** (`AddLocationModal.tsx`). Make `handleSubmit` async, add a
  local `submitting` state, `await onSubmit(...)` in try/catch, only `onClose()` on success, and pass
  `disabled={submitting}` to the submit `<Button>` (lines 328-333). Keep the existing `place_id` guard (line 135).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/Favorites/__tests__/useCreateLocation.errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add explorers-earth/src/features/Favorites/hooks/useCreateLocation.ts \
        explorers-earth/src/components/ui/AddLocationModal.tsx \
        explorers-earth/src/features/Favorites/__tests__/useCreateLocation.errors.test.ts
git commit -m "fix(places): surface create errors, await submit, add loading, use returned id (BUG-5, BUG-3 Places)"
```

---

## Task 6: BUG-6 — Frontend guard against a bad scraped price (+ flag server fix)

**Files:**
- Modify: `explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx:210-220`
- Test: `explorers-earth/src/features/Products/__tests__/scrapePriceGuard.test.tsx` (new)

**Note:** The real fix is server-side (`tunes/server/utils/scrapeUtils.ts` — see D1). Here we stop
silently trusting the scraped price and prompt the user to verify.

- [ ] **Step 1: Write the failing test** — feed `handleUrlScraped` a bad payload (`price: 16.7, currency:
  "EUR"` for a product whose real price is ~$399) and assert a warning toast fires and the price field is
  populated but flagged (not silently accepted as final). Match the existing
  `Products/__tests__/scrape-flow.integration.test.tsx` harness (mock fetch, render AddProductPage).

- [ ] **Step 2: Run to verify it fails**

Run: `cd explorers-earth && npx vitest run src/features/Products/__tests__/scrapePriceGuard.test.tsx`
Expected: FAIL — price accepted silently, no warning.

- [ ] **Step 3: Implement the guard** in `handleUrlScraped` (`AddProductPage.tsx:210-220`): accept the
  scraped price only if it is a positive finite number; regardless, show a `toast(t("...reviewPrice"))`
  informational toast so the user verifies the auto-filled Price/Currency (fields are already editable at
  :482-493). Do not block saving.

```tsx
const priceNum = Number(data?.price);
const safePrice = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;
setFormData((prev) => ({ ...prev, ...data, price: safePrice ?? prev.price }));
toast("Auto-filled from the link — please double-check the price and currency.");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd explorers-earth && npx vitest run src/features/Products/__tests__/scrapePriceGuard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx \
        explorers-earth/src/features/Products/__tests__/scrapePriceGuard.test.tsx
git commit -m "fix(products): don't silently trust scraped price; prompt user to verify (BUG-6 frontend)"
```

**Follow-up (separate `tunes` PR, D1):** in `tunes/server/utils/scrapeUtils.ts`
(a) scope Amazon price/currency to the buy-box (`#corePrice*`, skip `#installmentCalculator`/`[id*="installment"]`),
(b) locale-aware number normalization, (c) prefer JSON-LD `offers.price/priceCurrency` over DOM scrape.
Add unit tests for the parser (`tunes/server/utils/__tests__/scrapeUtils.test.ts`).

---

## Final steps (after all tasks)

- [ ] Full test suite: `cd explorers-earth && npx vitest run` — expect green.
- [ ] Typecheck: `cd explorers-earth && npx tsc --noEmit -p tsconfig.app.json` — exit 0.
- [ ] Lint changed files: `cd explorers-earth && npx eslint <changed files>` — 0 errors.
- [ ] `/codex review` the diff; address findings.
- [ ] `/ship` → open PR to `main`; resolve PR comments; merge; verify on prod (public place list opens
  without crashing; create-list opens into the new list; guide location holds on first pick).

## Self-review notes
- BUG-2 (guides activity photos) already fixed on this branch (commit `020fd01`) — include in the PR.
- BUG-1 has TWO tasks (render guard + data fix) so both old and new data are safe.
- BUG-4's AddressInput fix also improves BUG-5's place-selection reliability (shared component).
- Places (BUG-3) intentionally differs (no route) — see D2.

---

## v2 REVISIONS (post-codex review) — these SUPERSEDE the buggy parts above

Decisions: D3 = **keep the publish prompt in the list detail** (wire detail views). D1/BUG-6 = **fix both**
(frontend mitigation in explorers-earth PR + `tunes` server parser in a second PR).

### Task 1 fixes
- [P1] Coercion bug: `Number("")`/`Number(null)` are `0`. Guard BEFORE coercing. Correct helper (use in
  PublicPlaceCard, PublicGuides, and the extra sites below):
  ```ts
  const hasValue = (v: unknown) => v != null && String(v).trim() !== "" && Number.isFinite(Number(v));
  // render only if hasValue(rating); value = Number(rating)  (rating 0 → "0.0" is correct)
  ```
- [P2] Test prop names are wrong. Actual PublicPlaceCard props (`PublicPlaceCard.tsx:3-10`) are `image`
  and required `onClickhandler` — fix the test to use those (not `imageUrl`/`onClick`).
- [P2] Same crash also in: `features/Guides/components/PublicGuideCard.tsx:30,100`,
  `components/ui/Card.tsx:274-286`, `features/PublicHome/components/NoImagePlaceCard.tsx:120-124`.
  Apply the same `hasValue` guard to all. (Scope check: these are the rating `.toFixed` sites; do NOT
  touch numeric distance `.toFixed`.)

### Task 2 fixes
- Keep `toNumberOrNull`; use that name consistently (fix plan prose that said `buildPlaceRating`/`?? null`).
- Strengthen the test to assert the built create+edit mutation variables carry numeric|null (not just the
  helper). If a full render test is heavy, at least import and assert the same helper is used at both sites.

### Task 3 fixes
- Swap BOTH callback sites in the `place_changed` listener to refs: `AddressInput.tsx:147` AND `:180`
  (not just one). Use `setPlacesRef.current?.(...)` / `onChangeRef.current?.(...)`.
- Add an unmounted/stale-request guard: capture an `effectId`/`isCurrent` in the init effect and, in the
  async metadata `.then`, bail if superseded (so a late `axios.get` can't call a stale callback).
- Rewrite the regression test to be valid: spy on the `Autocomplete` constructor and assert it is
  constructed exactly ONCE across a parent re-render (new closure identities), and that firing
  `place_changed` calls `setPlaces`. Mock `axios` so the listener's metadata path doesn't hit the network.
- Consumer count is 13 files / 23 usages (not 12) — smoke-run the AddressInput-dependent tests.

### Task 4 fixes (D3: keep prompt in the detail view)
- `justCreatedList` route state does NOT work as written: the category Home components consume it
  (`MoviesHome.tsx:350`, `BooksHome.tsx:345`, `GamesHome.tsx:332`, `AppsHome.tsx:336`) but navigation
  UNMOUNTS them; the detail views only read `justAddedRecommendation`
  (`MovieListView.tsx:189-197`, `BookListView.tsx:414-422`, `GameListView.tsx:342-350`, and the Apps/
  Products/People ListViews). So:
  1. In each parent `onCreated`, navigate to the detail route with `state: { justCreatedList: true }` and
     REMOVE the now-dead category-level publish-prompt logic (Movies/Books/Games).
  2. In each of the 6 detail ListViews, read `location.state?.justCreatedList` (mirror the existing
     `justAddedRecommendation` handling) and trigger the SAME publish prompt there.
- Replace the brittle source-regex tests with a behavioral test: render `<X>Home` with a mocked create
  mutation returning a `documentId`, submit the modal, assert `navigate` called with the right route +
  `{ state: { justCreatedList: true } }`.

### Task 5 fixes (async contract — the big one)
- Make `handleLocationSubmit` return `Promise<boolean>` (true on success; on caught error show
  `toast.error(...)` and return `false`). Update the `UseCreateLocationProps.onCreated` type to
  `(newId?: string) => void` and the hook's return contract.
- `refetchCities()` is BEST-EFFORT after a successful mutation: wrap it in its own try/catch; set
  `selectedCity` from the returned `createRecommendationList.documentId` entity FIRST, then attempt the
  refetch. A refetch failure must NOT report create-failure (avoids the duplicate-create retry trap).
- Remove the hook's own `setIsLocationModalOpen(false)` (the modal owns close now).
- `AddLocationModal.handleSubmit` becomes `async`: `const ok = await onSubmit(submissionValues); if (ok !== false) onClose();`
  (backward-compatible: the other two submitters — `Home.tsx:841-844`, edit handler `Favorites.tsx:818-822`
  — return `undefined`, so `ok !== false` closes as before). Add local `submitting` state; pass
  `isLoading={submitting}` (NOT `disabled`) to the submit `<Button>` (`Button.tsx:66,187-195`).
- Use a CREATE-specific error toast key (not the "...UpdateFailed" key).
- Remove the exactly-duplicated effect at `AddLocationModal.tsx:37-55`.

### Task 6 fixes (both apps)
- **Frontend (explorers-earth PR):** do NOT spread `...data` blindly (it drops the `scrapedImages`
  selection flow at `AddProductPage.tsx:210-218`) — preserve the existing image handling. Add a
  PERSISTENT inline "unverified — please check price/currency" indicator on the Price/Currency fields
  (not an ephemeral toast), guard `currency` against the allowed `<select>` options
  (`AddProductPage.tsx:489-490`) falling back to blank/default if unsupported, and avoid the double toast
  (the "metadata fetched" toast at `:45` already fires).
- **Server (separate `tunes` PR):** `tunes/server/utils/scrapeUtils.ts`: scope Amazon price/currency to
  the buy-box (`#corePrice*`, `#apex_desktop`), SKIP installment/EMI (`#installmentCalculator`,
  `[id*="installment"]`), locale-aware number normalization, and prefer JSON-LD `offers.price/priceCurrency`
  over DOM (invert precedence at `:477`). Add parser unit tests at
  `tunes/server/utils/__tests__/scrapeUtils.test.ts` (European format, installment-vs-buybox, JSON-LD precedence).

### Order of implementation (this PR = explorers-earth)
1 (Task 1) → 2 (Task 2) → 3 (Task 4 nav+detail) → 4 (Task 3 AddressInput) → 5 (Task 5 Places) → 6 (Task 6 frontend).
The `tunes` server fix is a SEPARATE PR done after.
