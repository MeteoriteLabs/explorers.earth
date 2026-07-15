import { expect, test } from "@playwright/test";

test.describe("marketing pages", () => {
  test("renders the complete About story and Use Cases navigation", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "Explorers of Earth" })).toBeVisible();
    await expect(page.getByText("WHAT WE'RE BUILDING")).toBeVisible();
    await expect(page.getByText("BELONGING")).toBeVisible();

    await page.getByRole("link", { name: "Use Cases" }).first().click();
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

  test("mobile disclosure fits its navigation and actions at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/use-cases");

    const trigger = page.locator('button[aria-controls="marketing-mobile-menu"]');
    await trigger.click();
    const menu = page.locator("#marketing-mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "About" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Login" })).toBeVisible();

    const layout = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBe(layout.clientWidth);
  });

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 375, height: 812 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 900 },
    { width: 1280, height: 900 },
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
  ]) {
    test(`keeps both marketing pages usable at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const route of ["/about", "/use-cases"]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          mainWidth: document.querySelector("main")?.getBoundingClientRect().width ?? 0,
        }));

        expect(layout.scrollWidth).toBe(layout.clientWidth);
        expect(layout.mainWidth).toBeGreaterThan(0);
        expect(layout.mainWidth).toBeLessThanOrEqual(layout.clientWidth);
      }
    });
  }
});
