import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { setupMockAuthentication } from "./setup/auth";
import { installMusicQualificationMocks } from "./setup/music";

test.beforeEach(async ({ context }) => {
  await setupMockAuthentication(context);
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("sanitized-fixture-page", { body: await page.screenshot(), contentType: "image/png" });
  }
});

async function expectButtonsToMeetTouchTarget(root: Locator) {
  for (const control of await root.getByRole("button").all()) {
    if (await control.isVisible()) {
      await expect.poll(async () => {
        const box = await control.boundingBox();
        return Math.min(box?.height ?? 0, box?.width ?? 0);
      }, { message: `expected ${await control.getAttribute("aria-label") ?? await control.innerText()} to settle at a 44px touch target` })
        .toBeGreaterThanOrEqual(44);
    }
  }
}

for (const viewport of [
  { label: "375px", width: 375, height: 820 },
  { label: "desktop", width: 1280, height: 900 },
]) {
  test(`axe and keyboard-only Music sharing are clean at ${viewport.label}`, async ({ page }) => {
    const qualification = await installMusicQualificationMocks(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/recommendations/music");
    await expect.poll(qualification.ensureCalls).toBe(1);
    await expect(page.getByRole("heading", { name: "Create your first playlist" })).toBeVisible();

    const initialAudit = await new AxeBuilder({ page }).include("section.dashboard-theme").analyze();
    expect(initialAudit.violations).toEqual([]);

    const sharing = page.getByRole("button", { name: "Sharing settings" });
    for (let index = 0; index < 80 && !(await sharing.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(sharing).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Music sharing" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio")).toHaveCount(3);
    const privateMode = dialog.getByRole("radio", { name: "Private" });
    const publicMode = dialog.getByRole("radio", { name: "Public" });
    await expect(privateMode).toBeFocused();
    const dialogAudit = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(dialogAudit.violations).toEqual([]);
    await expectButtonsToMeetTouchTarget(dialog);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(publicMode).toBeChecked();
    await expect(dialog.getByText("Anyone can view shared playlists, and the page can appear in search.")).toBeVisible();

    const save = dialog.getByRole("button", { name: "Save sharing" });
    for (let index = 0; index < 12 && !(await save.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(save).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(sharing).toBeFocused();
    await expect(page.getByText("Music is public.")).toBeVisible();
    expect(qualification.publicationMode()).toBe("public");
    expect(qualification.publicationCommands).toEqual([{
      body: { mode: "public" },
      idempotencyKey: expect.stringMatching(/^tunes-share-v1-\d{13}-[0-9a-f-]{36}$/),
    }]);

    await expectButtonsToMeetTouchTarget(page.locator("section.dashboard-theme"));
  });
}
