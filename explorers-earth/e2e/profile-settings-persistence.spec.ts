import { expect, test } from "@playwright/test";
import {
  ONE_PIXEL_PNG,
  type FixtureState,
  installPublicFixture,
  openFixture,
  expectNoHorizontalOverflow,
} from "./support/publicProfileFixture";

const savedOrder = [
  "music",
  "movies",
  "books",
  "games",
  "guides",
  "apps",
  "products",
  "people",
  "places",
];

test("saved dashboard state renders identically on public root, category, and hard reload", async ({ page }) => {
  const observed: string[] = [];
  const state: FixtureState = {
    preset: "sunset-glow",
    wallpaperMode: "ambient-gradient",
    layout: "featured",
    mode: "success",
    landingTab: "music",
    headerImageUrl: null,
    footerBranding: "minimal",
    enabledCategories: savedOrder,
    localTunesUrl: "https://localtunes.earth/playlist/saved-playlist",
    business: {
      title: "Saved Studio",
      address: "9 Business Road",
      about: "Saved public business details.",
    },
    categoryOrder: savedOrder,
    bio: "<p><strong>Saved rich profile</strong> with public parity.</p>",
    socialVisibility: "visible",
    feedItems: [{
      documentId: "saved-gallery-image",
      url: `data:image/png;base64,${ONE_PIXEL_PNG}`,
      fileName: "saved-gallery.png",
      type: "image",
      aspectRatio: "1:1",
      width: 1,
      height: 1,
    }],
    attempts: {},
  };
  await installPublicFixture(page, state, observed);

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1024, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await openFixture(page, `saved-state-${viewport.width}`);

    await expect(page.getByTestId("public-profile-hero")).toHaveAttribute(
      "data-wallpaper-mode",
      "ambient-gradient",
    );
    await expect(page.getByTestId("wallpaper-image")).toHaveCount(0);
    await expect(page.getByTestId("recommendations-featured")).toBeVisible();
    await expect(page.getByText("Saved rich profile", { exact: false })).toBeVisible();
    await expect(page.locator('a[href="https://instagram.com/fixture"]')).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Footer" })).toHaveCount(0);
    await expect(page.locator('footer a[aria-label="explorers.earth"]')).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Profile sections" }).getByRole("tab")).toHaveCount(3);
    expect(
      await page.locator("[data-category-id]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-category-id")),
      ),
    ).toEqual(savedOrder);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("tab", { name: "Gallery" }).click();
    await expect(page.locator('img[alt="saved-gallery.png"]')).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("public-profile-hero")).toHaveAttribute(
      "data-wallpaper-mode",
      "ambient-gradient",
    );
    await expect(page.getByTestId("recommendations-featured")).toBeVisible();
  }

  await page.goto("/presentation-fixture/books", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/presentation-fixture\/books$/);
  await expect(page.locator('[data-public-route-marker="public-books-page"]')).toBeVisible();
  expect(observed).toContain("PublicProfileBootstrap");
  expect(observed).toContain("PublicProfileContent");
});
