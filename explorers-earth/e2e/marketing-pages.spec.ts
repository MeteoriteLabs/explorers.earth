import { expect, test } from "@playwright/test";

test.describe("marketing pages", () => {
  test("renders the complete About story and Use Cases navigation", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "Explorers of Earth" })).toBeVisible();
    await expect(page.getByText("WHAT WE'RE BUILDING")).toBeVisible();
    await expect(page.getByText("BELONGING")).toBeVisible();

    await page.getByRole("button", { name: "Use Cases" }).first().click();
    await expect(page).toHaveURL(/\/use-cases$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Different perspectives");
  });

  test("supports direct and SPA persona hashes without hiding the target", async ({ page }) => {
    await page.goto("/use-cases#creators");
    const creators = page.locator("#creators");
    await expect(creators).toBeInViewport();
    const box = await creators.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(70);

    await page.goto("/");
    await page.getByRole("link", { name: "See this perspective" }).nth(2).click();
    await expect(page).toHaveURL(/\/use-cases#brands$/);
    await expect(page.locator("#brands")).toBeInViewport();
  });

  test("mobile disclosure closes with Escape and restores trigger focus", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/use-cases");

    const trigger = page.locator('button[aria-controls="marketing-mobile-menu"]');
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    test(`has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/use-cases");
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflows).toBe(false);
    });
  }
});
