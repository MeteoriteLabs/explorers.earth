/**
 * Every URL builder that rewrites a relative path must leave the canonical media route
 * alone.
 *
 * This is the third wave of the same defect. `publicPlaceMedia.ts` had the rule; the
 * public profile tab and the owner dashboard did not (`2861d88d`); and of these five
 * builders, four had no canonical case at all and the fifth matched it loosely. The
 * failure is always the same shape - a canonical
 * `/api/explorers/v1/media/<uuid>/content` path starts with "/", so a builder that
 * prefixes a base URL to any "/" path sends the request to the Strapi origin, or on a
 * movie shelf to TMDB.
 *
 * Which of the five were actually broken, traced to the emitter rather than assumed:
 *
 * - `buildImageUrl` (People) - **live.** `getPersonImageUrl` in `Recommendations.tsx:73`
 *   falls through to `media_details.thumbnail.url`, which is the canonical route.
 * - `resolveProfileImageUrl` - **live.** `resolveAccount` emits `profile_picture.url` as
 *   the canonical route, so the onboarding card fetched it from the Strapi origin.
 * - `buildCoverUrl` - **not broken.** It already returned the route early, but matched it
 *   by prefix, which also accepts a non-uuid id and anything appended after `/content`.
 *   Now the exact shared match, so this is a tightening; the near-miss case below is what
 *   distinguishes the two and it failed on first run against the prefix version.
 * - `buildLogoUrl` (Apps) and `buildImageUrl` (Products) - reached today only with
 *   absolute provider URLs (`safeAppUrlSchema`, `safeProductUrlSchema`), so their "/"
 *   branch is legacy-only. Covered anyway: being wrong about "no canonical path can reach
 *   this" is how the first two waves happened.
 */
import { describe, expect, it } from "vitest";
import { buildLogoUrl } from "../../features/AppsAndTools/utils/appHelpers";
import { buildCoverUrl } from "../../features/Games/utils/gameHelpers";
import { buildImageUrl as buildPersonImageUrl } from "../../features/People/utils/personHelpers";
import { buildImageUrl as buildProductImageUrl } from "../../features/Products/utils/productHelpers";

const canonical = "/api/explorers/v1/media/11111111-1111-4111-8111-111111111111/content";

const builders = [
  ["buildLogoUrl (Apps)", buildLogoUrl],
  ["buildCoverUrl (Books/Games)", buildCoverUrl],
  ["buildImageUrl (People)", buildPersonImageUrl],
  ["buildImageUrl (Products)", buildProductImageUrl],
] as const;

describe("URL builders and the canonical media route", () => {
  it.each(builders)("%s returns a canonical media path unchanged", (_label, build) => {
    expect(build(canonical)).toBe(canonical);
  });

  it.each(builders)("%s still prefixes a legacy Strapi upload path", (_label, build) => {
    // The legacy behaviour has to survive: `routes/index.ts` still serves these views
    // through the Strapi gateway until step 12 retires that runtime, and its media URLs
    // are `/uploads/...`. A fix that returned every "/" path unchanged would silently
    // break the legacy mode instead.
    expect(build("/uploads/cover.jpg")).not.toBe("/uploads/cover.jpg");
    expect(build("/uploads/cover.jpg")).toContain("/uploads/cover.jpg");
  });

  it.each(builders)("%s passes an absolute provider URL straight through", (_label, build) => {
    const provider = "https://provider.example/image.png";
    expect(build(provider)).toBe(provider);
  });

  it.each(builders)("%s does not treat a near-miss as canonical media", (_label, build) => {
    // Guards the exact match. These start with the route but are not it, so they must
    // take the legacy branch rather than being handed back as-is.
    for (const nearMiss of [
      "/api/explorers/v1/media/not-a-uuid/content",
      `${canonical}.jpg`,
      "/api/explorers/v1/accounts/me",
    ]) {
      expect(build(nearMiss)).not.toBe(nearMiss);
    }
  });
});
