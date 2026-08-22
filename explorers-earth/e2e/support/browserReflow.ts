import type { BrowserContext, CDPSession, Page } from "@playwright/test";

export interface ReflowZoomHandle {
  readonly session: CDPSession;
  readonly layoutWidth: number;
  readonly layoutHeight: number;
  restore(): Promise<void>;
}

/**
 * Chromium has no stable Playwright page-zoom API. This uses the supported CDP
 * device-metrics override to emulate 200% browser reflow: the CSS layout
 * viewport is halved while deviceScaleFactor=2 preserves a two-device-pixel
 * rendering density. Unlike setPageScaleFactor, visualViewport.scale stays 1
 * and responsive layout, focus geometry, and overflow use the narrower width.
 */
export async function emulateBrowserReflowZoom200(
  context: BrowserContext,
  page: Page,
): Promise<ReflowZoomHandle> {
  const baseline = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const layoutWidth = Math.ceil(baseline.width / 2);
  const layoutHeight = Math.ceil(baseline.height / 2);
  const session = await context.newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: layoutWidth,
    height: layoutHeight,
    deviceScaleFactor: 2,
    mobile: false,
    screenWidth: baseline.width,
    screenHeight: baseline.height,
  });
  return {
    session,
    layoutWidth,
    layoutHeight,
    restore: async () => {
      await session.send("Emulation.clearDeviceMetricsOverride");
      await session.detach();
    },
  };
}
