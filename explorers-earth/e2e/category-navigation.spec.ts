import { expect, test, type Locator, type Page } from '@playwright/test';
import { categories, closeFixture, fixtureState, fixtureUser, openFixture, settings, toggle } from './setup/category-navigation';
import { TOP_LEVEL_DESTINATIONS } from './setup/public-shell-continuity';

async function expectTask6Shell(page: Page) {
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Earth loading' })).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toHaveLength(0);
}

/** Submit the explicit confirmation required when a pinned category is unpublished. */
async function submitPinnedCategoryUnpublish(page: Page, control: Locator, categoryLabel: string) {
  await expect(control).toBeEnabled();
  await control.focus();
  await control.press('Space');
  const categoryName = categoryLabel.replace(/ Tab$/, '');
  const dialog = page.getByRole('dialog', { name: `Unpublish ${categoryName}`, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: `Unpublish ${categoryName}`, exact: true }).click();
  return dialog;
}

async function beginTask6FrameAudit(page: Page) {
  await page.evaluate(() => {
    const audit = { frames: [] as { banner: number; nav: number; earth: number; nonblank: boolean }[], stop: false };
    (window as any).__task6ContentFrames = audit;
    const record = () => {
      audit.frames.push({
        banner: document.querySelectorAll('header').length,
        nav: document.querySelectorAll('nav[aria-label="Public navigation"]').length,
        earth: document.querySelectorAll('[role="status"][aria-label="Earth loading"]').length,
        nonblank: Boolean(document.body.innerText.trim()),
      });
      if (!audit.stop) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
}

async function finishTask6FrameAudit(page: Page) {
  return page.evaluate(() => {
    const audit = (window as any).__task6ContentFrames;
    audit.stop = true;
    return audit.frames;
  });
}

type Task6FrameExpectation = { banner: number; nav: number; earth: number; nonblank: boolean };

async function assertTask6FrameWindow(page: Page, expected: Task6FrameExpectation) {
  await beginTask6FrameAudit(page);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const frames = await finishTask6FrameAudit(page);
  expect(frames.length).toBeGreaterThan(0);
  const mismatches = frames.filter((frame) => !(
    frame.banner === expected.banner
    && frame.nav === expected.nav
    && frame.earth === expected.earth
    && frame.nonblank === expected.nonblank
  ));
  expect(mismatches, `all sampled frames must match ${JSON.stringify(expected)}`).toEqual([]);
  return frames.length;
}

async function computedContrast(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const parse = (value: string) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    };
    const blend = (front: ReturnType<typeof parse>, back: ReturnType<typeof parse>) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1,
    });
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    const background = ancestors.reduce((color, node) => blend(parse(getComputedStyle(node).backgroundColor), color), { r: 255, g: 255, b: 255, a: 1 });
    const foreground = blend(parse(getComputedStyle(element).color), background);
    const luminance = (color: typeof background) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return channel(color.r) * 0.2126 + channel(color.g) * 0.7152 + channel(color.b) * 0.0722;
    };
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return { ratio: (light + 0.05) / (dark + 0.05), foreground, background };
  });
}

function seedTask6App(state: ReturnType<typeof fixtureState>) {
  state.lists.appLists[0].recommended_apps = [{
    __typename: 'RecommendedApp',
    documentId: 'fixture-app',
    app_url: 'https://example.test/app',
    title: 'Fixture app',
    logo_url: null,
    description: null,
    developer: null,
    platforms: [],
    price_tier: null,
    download_url: null,
    screenshots: [],
    user_recommendation_note: null,
    user_rating: null,
    is_pinned: false,
    pin_order: null,
    app_category: null,
  }];
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 900 }]) {
  test(`Task 6 contained content-state matrix ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const evidence: Record<string, unknown> = {};
    const options = { ...viewport, touch: viewport.width === 320 };

    const warmState = fixtureState({
      public_music: 'Yes',
      pinned_nav_tabs: ['public_profile', 'public_books', 'public_apps', 'public_music'],
    }, 'public');
    seedTask6App(warmState);
    const warm = await openFixture(browser, baseURL!, warmState, options);
    try {
      // Populate the actual gateway cache, then leave the category. The old
      // Apollo cache no longer participates in public category rendering.
      await warm.page.goto(`/${fixtureUser.username}/apps`);
      await expect(warm.page.getByText('Public apps', { exact: true })).toBeVisible();
      await warm.page.goto(`/${fixtureUser.username}/music`);
      await expect(warm.page.getByRole('heading', { name: 'Music', level: 1 })).toBeVisible();
      let releaseWarm!: () => void;
      warmState.faults.set('PublicAppData', [{ gate: new Promise<void>(resolve => { releaseWarm = resolve; }) }]);
      const readsBeforeWarm = warmState.reads.filter(read => read.name === 'PublicAppData').length;
      await beginTask6FrameAudit(warm.page);
      await warm.page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Apps', exact: true }).click();
      await expect.poll(() => warmState.reads.filter(read => read.name === 'PublicAppData').length).toBe(readsBeforeWarm + 1);
      await expect(warm.page.getByText('Public apps', { exact: true })).toBeVisible();
      await expect(warm.page.locator('[aria-busy="true"]').first()).toBeVisible();
      await expectTask6Shell(warm.page);
      releaseWarm();
      await expect(warm.page.locator('[aria-busy="true"]')).toHaveCount(0);
      const warmFrames = await finishTask6FrameAudit(warm.page);
      expect(warmFrames.length).toBeGreaterThan(0);
      expect(warmFrames.every(frame => frame.banner === 1 && frame.nav === 1 && frame.earth === 0 && frame.nonblank)).toBe(true);
      evidence.warmCache = { frames: warmFrames.length, content: 'Public apps' };
    } finally { await closeFixture(warm); }

    const emptyState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_apps'] });
    emptyState.lists.appLists = [];
    const empty = await openFixture(browser, baseURL!, emptyState, options);
    try {
      await empty.page.goto(`/${fixtureUser.username}/apps`);
      await expect(empty.page.getByText('No apps shared yet', { exact: true })).toBeVisible();
      await expectTask6Shell(empty.page);
      const frames = await assertTask6FrameWindow(empty.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.empty = { content: 'No apps shared yet', frames };
    } finally { await closeFixture(empty); }

    const terminalState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_apps'] });
    seedTask6App(terminalState);
    terminalState.faults.set('PublicAppData', [
      // React strict-effects may replay the first category effect. Both cold
      // requests must therefore receive the terminal response.
      { kind: 'error' },
      { kind: 'error' },
    ]);
    const terminal = await openFixture(browser, baseURL!, terminalState, options);
    try {
      await terminal.page.goto(`/${fixtureUser.username}/apps`);
      await expectTask6Shell(terminal.page);
      await expect(terminal.page.getByRole('heading', { name: 'Apps unavailable' })).toBeVisible();
      const coldFrames = await assertTask6FrameWindow(terminal.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.cold = { state: 'resolved shell remains visible for a first category terminal state', frames: coldFrames };
      await expect(terminal.page.getByText('Please try again. If the problem continues, come back later.', { exact: true })).toBeVisible();
      await expect(terminal.page.getByText('Contained fixture failure', { exact: true })).toHaveCount(0);
      expect((await computedContrast(terminal.page.getByRole('heading', { name: 'Apps unavailable' }))).ratio).toBeGreaterThanOrEqual(4.5);
      await expectTask6Shell(terminal.page);
      await terminal.page.screenshot({ path: test.info().outputPath(`task6-terminal-before-retry-${viewport.width}.png`), fullPage: true });
      await beginTask6FrameAudit(terminal.page);
      await terminal.page.getByRole('button', { name: 'Retry', exact: true }).click({ force: true });
      await expect(terminal.page.getByText('Public apps', { exact: true })).toBeVisible();
      await expectTask6Shell(terminal.page);
      const retryFrames = await finishTask6FrameAudit(terminal.page);
      expect(retryFrames.length).toBeGreaterThan(0);
      expect(retryFrames.every(frame => frame.banner === 1 && frame.nav === 1 && frame.earth === 0 && frame.nonblank)).toBe(true);
      evidence.terminalRetry = { frames: retryFrames.length, recovered: true };
      await terminal.page.screenshot({ path: test.info().outputPath(`task6-recovery-after-retry-${viewport.width}.png`), fullPage: true });
    } finally { await closeFixture(terminal); }

    const partialState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_apps'] });
    seedTask6App(partialState);
    partialState.faults.set('PublicAppData', [{ kind: 'partial' }]);
    const partial = await openFixture(browser, baseURL!, partialState, options);
    try {
      await partial.page.goto(`/${fixtureUser.username}/apps`);
      await expect(partial.page.getByText('Public apps', { exact: true })).toBeVisible();
      await expect(partial.page.getByText('Some app data is unavailable.', { exact: true })).toBeVisible();
      expect((await computedContrast(partial.page.getByRole('status'))).ratio).toBeGreaterThanOrEqual(4.5);
      await expectTask6Shell(partial.page);
      const frames = await assertTask6FrameWindow(partial.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.partial = { state: 'usable list plus warning', frames };
      await partial.page.screenshot({ path: test.info().outputPath(`task6-partial-${viewport.width}.png`), fullPage: true });
    } finally { await closeFixture(partial); }

    const minimalState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_recommendations'] });
    minimalState.faults.set('PublicProfileData', [{ kind: 'partial' }]);
    minimalState.faults.set('Account', [{ kind: 'error' }]);
    const minimal = await openFixture(browser, baseURL!, minimalState, options);
    try {
      await minimal.page.goto(`/${fixtureUser.username}`);
      await expectTask6Shell(minimal.page);
      const profileFrames = await assertTask6FrameWindow(minimal.page, { banner: 1, nav: 1, earth: 0, nonblank: true });

      await minimal.page.goto(`/${fixtureUser.username}/places/jaipur/placesmap`);
      const mapHeading = minimal.page.getByRole('heading', { name: 'Map Unavailable' });
      await expect(mapHeading).toBeVisible();
      const mapContrast = await computedContrast(mapHeading);
      expect(mapContrast.ratio).toBeGreaterThanOrEqual(4.5);
      await expect(minimal.page.getByText('Contained fixture failure', { exact: true })).toHaveCount(0);
      const mapFrames = await assertTask6FrameWindow(minimal.page, { banner: 1, nav: 0, earth: 0, nonblank: true });
      evidence.minimalLightContrast = {
        profile: { state: 'incomplete optional profile metadata retains the themed shell', frames: profileFrames },
        placeMap: { contrast: mapContrast.ratio, frames: mapFrames },
      };
    } finally { await closeFixture(minimal); }

    const routingState = fixtureState({ public_products: 'No', pinned_nav_tabs: ['public_profile', 'public_apps'] });
    seedTask6App(routingState);
    const routing = await openFixture(browser, baseURL!, routingState, options);
    try {
      await routing.page.goto(`/${fixtureUser.username}/apps`);
      await expect(routing.page.getByText('Public apps', { exact: true })).toBeVisible();
      await routing.page.goto('/different-user/apps');
      await expect(routing.page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
      await expect(routing.page.getByText('Public apps', { exact: true })).toHaveCount(0);
      await expect(routing.page.getByRole('status', { name: 'Earth loading' })).toHaveCount(0);
      const usernameFrames = await assertTask6FrameWindow(routing.page, { banner: 0, nav: 0, earth: 0, nonblank: true });
      evidence.usernameChange = {
        state: 'invalid identity uses the standalone nonblank Page Not Found boundary with no stale app content',
        frames: usernameFrames,
        shellException: 'banner/nav are intentionally outside this invalid-identity boundary',
      };

      await routing.page.goto(`/${fixtureUser.username}/products`);
      await expect(routing.page).toHaveURL(`${baseURL}/${fixtureUser.username}`);
      await expectTask6Shell(routing.page);
      const hiddenFrames = await assertTask6FrameWindow(routing.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.hiddenCategory = { state: 'redirected to profile', frames: hiddenFrames };

      await routing.page.goto(`/${fixtureUser.username}/apps/missing-list`);
      await expect(routing.page.getByText('List not found or not published.', { exact: true })).toBeVisible();
      await expectTask6Shell(routing.page);
      const nestedFrames = await assertTask6FrameWindow(routing.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.invalidNested = { state: 'themed not-published state', frames: nestedFrames };
    } finally { await closeFixture(routing); }

    const exceptionState = fixtureState({ public_music: 'Yes', pinned_nav_tabs: ['public_profile', 'public_music'] }, 'public');
    const exception = await openFixture(browser, baseURL!, exceptionState, options);
    try {
      await exception.page.goto(`/${fixtureUser.username}/places/map`);
      await expect(exception.page.getByRole('heading', { name: 'Map Unavailable' })).toBeVisible();
      await expect(exception.page.getByRole('banner')).toHaveCount(1);
      await expect(exception.page.getByRole('banner')).toBeVisible();
      await expect(exception.page.getByRole('navigation', { name: 'Public navigation' })).toHaveCount(0);
      await expect(exception.page.getByRole('status', { name: 'Earth loading' })).toHaveCount(0);
      expect(await exception.page.locator('body').innerText()).not.toHaveLength(0);
      const mapFrames = await assertTask6FrameWindow(exception.page, { banner: 1, nav: 0, earth: 0, nonblank: true });
      evidence.map = { state: 'intentional full-screen exception with truthful fallback', frames: mapFrames };

      await exception.page.goto(`/${fixtureUser.username}/music`);
      await expect(exception.page.getByRole('heading', { name: 'Music', level: 1 })).toBeVisible();
      await expectTask6Shell(exception.page);
      const musicFrames = await assertTask6FrameWindow(exception.page, { banner: 1, nav: 1, earth: 0, nonblank: true });
      evidence.music = { state: 'typed public availability preserved', frames: musicFrames };
      await exception.page.screenshot({ path: test.info().outputPath(`task6-music-${viewport.width}.png`), fullPage: true });
    } finally { await closeFixture(exception); }

    await test.info().attach(`task6-content-state-evidence-${viewport.width}`, {
      contentType: 'application/json',
      body: JSON.stringify(evidence, null, 2),
    });
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 900 }]) {
  test(`Task 6 repair rejected Retry is contained ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    const state = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_apps'] });
    seedTask6App(state);
    state.faults.set('PublicAppData', [
      // Cold mount and the first retry are both replayed by strict effects in
      // this development harness. Preserve the intended error → rejected
      // retry → successful retry journey across those real requests.
      { kind: 'error' }, { kind: 'error' },
      { kind: 'offline' }, { kind: 'offline' },
    ]);
    const visitor = await openFixture(browser, baseURL!, state, { ...viewport, touch: viewport.width === 320 });
    try {
      await visitor.page.goto(`/${fixtureUser.username}/apps`);
      await expect(visitor.page.getByRole('heading', { name: 'Apps unavailable' })).toBeVisible();
      await visitor.page.getByRole('button', { name: 'Retry' }).click({ force: true });
      await expect(visitor.page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(visitor.page.getByRole('heading', { name: 'Apps unavailable' })).toBeVisible();
      await visitor.page.getByRole('button', { name: 'Retry' }).click();
      await expect(visitor.page.getByText('Public apps', { exact: true })).toBeVisible();
      await expectTask6Shell(visitor.page);
    } finally { await closeFixture(visitor); }
  });

  test(`Task 6 repair shared state contrast ${viewport.width}x${viewport.height}`, async ({ browser, baseURL }) => {
    const evidence: Record<string, unknown> = {};
    const minimalState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_recommendations'] });
    minimalState.faults.set('PublicProfileData', [{ kind: 'partial' }]);
    minimalState.faults.set('Account', [{ kind: 'error' }]);
    const minimal = await openFixture(browser, baseURL!, minimalState, { ...viewport, touch: viewport.width === 320 });
    try {
      await minimal.page.goto(`/${fixtureUser.username}`);
      await expectTask6Shell(minimal.page);
      evidence.minimalLightProfilePartial = { state: 'incomplete optional profile metadata retains the themed shell' };

      await minimal.page.goto(`/${fixtureUser.username}/places/jaipur/placesmap`);
      const terminal = minimal.page.getByRole('heading', { name: 'Map Unavailable' });
      await expect(terminal).toBeVisible();
      const terminalContrast = await computedContrast(terminal);
      evidence.minimalLightPlaceMapTerminal = terminalContrast;
      expect.soft(terminalContrast.ratio, 'minimal-light PlaceMap terminal heading').toBeGreaterThanOrEqual(4.5);
    } finally { await closeFixture(minimal); }

    const darkState = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_apps'] });
    seedTask6App(darkState);
    darkState.faults.set('PublicAppData', [{ kind: 'partial' }]);
    const dark = await openFixture(browser, baseURL!, darkState, { ...viewport, touch: viewport.width === 320 });
    try {
      await dark.page.goto(`/${fixtureUser.username}/apps`);
      const partial = dark.page.getByRole('status');
      await expect(partial).toContainText('Some app data is unavailable.');
      const darkContrast = await computedContrast(partial);
      evidence.darkAppsPartial = darkContrast;
      expect.soft(darkContrast.ratio, 'dark Apps partial notice').toBeGreaterThanOrEqual(4.5);
    } finally { await closeFixture(dark); }

    await test.info().attach(`task6-repair-contrast-${viewport.width}`, {
      contentType: 'application/json',
      body: JSON.stringify(evidence, null, 2),
    });
    console.info(`[task6-contrast ${viewport.width}x${viewport.height}] ${JSON.stringify(evidence)}`);
  });
}

test('public shell continuity smoke covers every top-level destination', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const destinations = TOP_LEVEL_DESTINATIONS;
  const state = fixtureState({ public_music: 'Yes' }, 'public');
  const visitor = await openFixture(browser, baseURL!, state);
  const evidence: Record<string, unknown> = {};
  const pathFor = (route: string) => `/${fixtureUser.username}${route ? `/${route}` : ''}`;

  try {
    state.account.pinned_nav_tabs = ['public_profile', 'public_books'];
    await visitor.page.goto(`/${fixtureUser.username.toUpperCase()}/books?utm_source=continuity#matrix`);
    await expect(visitor.page).toHaveURL(`${baseURL}/${fixtureUser.username}/books?utm_source=continuity#matrix`);

    for (const destination of destinations) {
      state.account.pinned_nav_tabs = destination.field === 'public_profile'
        ? ['public_profile', 'public_books']
        : ['public_profile', destination.field];
      const destinationPath = pathFor(destination.route);
      await visitor.page.goto(destinationPath);
      await expect(visitor.page).toHaveURL(`${baseURL}${destinationPath}`);
      const publicNav = visitor.page.getByRole('navigation', { name: 'Public navigation' });
      await expect(publicNav).toBeVisible();
      await expect(publicNav.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
      await expect(visitor.page.getByRole('status', { name: 'Earth loading' })).toHaveCount(0);
      evidence[`direct:${destination.label}`] = { path: new URL(visitor.page.url()).pathname };
    }

    for (const destination of destinations) {
      state.account.pinned_nav_tabs = destination.field === 'public_profile'
        ? ['public_profile', 'public_books']
        : ['public_profile', destination.field];
      const sourcePath = pathFor(destination.source);
      const destinationPath = pathFor(destination.route);
      await visitor.page.goto(sourcePath);
      const publicNav = visitor.page.getByRole('navigation', { name: 'Public navigation' });
      await expect(publicNav).toBeVisible();
      await expect(publicNav.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
      const destinationLink = publicNav.getByRole('link', { name: destination.label, exact: true });
      await expect(destinationLink).toBeVisible();

      // This test samples chrome continuity. Gateway request shape is covered
      // separately below so no artificial gate can turn a cache hit into a
      // false navigation failure.
      const hasRouteTransition = false;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      if (hasRouteTransition) (state as any).destinationGates.set(destinationPath, gate);
      await visitor.page.evaluate(() => {
        const recorder = {
          clickTime: null as number | null,
          clickTrusted: false,
          frames: [] as { time: number; banner: number; nav: number; earth: number; nonblank: boolean }[],
          stop: false,
        };
        (window as any).__publicShellContinuity = recorder;
        addEventListener('click', event => {
          recorder.clickTime = event.timeStamp;
          recorder.clickTrusted = event.isTrusted;
        }, { capture: true, once: true });
        const record = (time: number) => {
          recorder.frames.push({
            time,
            banner: document.querySelectorAll('header').length,
            earth: document.querySelectorAll('[role="status"][aria-label="Earth loading"]').length,
            nav: document.querySelectorAll('nav[aria-label="Public navigation"]').length,
            nonblank: Boolean(document.body.innerText.trim()),
          });
          if (!recorder.stop) requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      });

      await destinationLink.click();
      await expect(visitor.page).toHaveURL(`${baseURL}${destinationPath}`);
      if (hasRouteTransition) await expect.poll(() => (state as any).destinationWaits.includes(destinationPath)).toBe(true);
      await expect.poll(() => visitor.page.evaluate(() => {
        const recorder = (window as any).__publicShellContinuity;
        return recorder.clickTime !== null && recorder.frames.some((frame: any) => frame.time > recorder.clickTime);
      })).toBe(true);
      const held = await visitor.page.evaluate(() => {
        const recorder = (window as any).__publicShellContinuity;
        const postActivation = recorder.frames.filter((frame: any) => frame.time > recorder.clickTime);
        return { clickTime: recorder.clickTime, clickTrusted: recorder.clickTrusted, postActivation };
      });
      expect(held.clickTrusted).toBe(true);
      expect(held.postActivation.length).toBeGreaterThan(0);
      expect(held.postActivation.every((frame: any) => (
        frame.banner === 1 && frame.nav === 1 && frame.earth === 0 && frame.nonblank
      ))).toBe(true);

      if (hasRouteTransition) {
        release();
        (state as any).destinationGates.delete(destinationPath);
      }
      await expect(visitor.page.getByRole('status', { name: 'Earth loading' })).toHaveCount(0);
      await expect(publicNav.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
      const completed = await visitor.page.evaluate(() => {
        const recorder = (window as any).__publicShellContinuity;
        recorder.stop = true;
        return {
          clickTime: recorder.clickTime,
          clickTrusted: recorder.clickTrusted,
          postActivation: recorder.frames.filter((frame: any) => frame.time > recorder.clickTime),
        };
      });
      expect(completed.postActivation.length).toBeGreaterThanOrEqual(held.postActivation.length);
      expect(completed.postActivation.every((frame: any) => (
        frame.banner === 1 && frame.nav === 1 && frame.earth === 0 && frame.nonblank
      ))).toBe(true);
      evidence[`navigate:${destination.label}`] = completed;
    }

    await test.info().attach('public-shell-continuity-frames', {
      contentType: 'application/json',
      body: JSON.stringify(evidence, null, 2),
    });
    await visitor.page.screenshot({ path: test.info().outputPath('public-shell-continuity-final.png'), fullPage: true });
  } finally { await closeFixture(visitor); }
});

test('public category pages read every recommendation type through the unauthenticated gateway', async ({ browser, baseURL }) => {
  const state = fixtureState();
  const visitor = await openFixture(browser, baseURL!, state);
  const requests: Array<{ path: string; authorization: string | undefined }> = [];
  visitor.page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === 'https://music-fixture.test' && url.pathname.startsWith(`/api/explorers/v1/profiles/${fixtureUser.username}/recommendations/`)) {
      requests.push({ path: url.pathname, authorization: request.headers().authorization });
    }
  });
  try {
    for (const category of categories) {
      await visitor.page.goto(`/${fixtureUser.username}/${category.route}`);
      await expect.poll(() => requests.some((request) => request.path === `/api/explorers/v1/profiles/${fixtureUser.username}/recommendations/${category.route}`)).toBe(true);
    }
    expect(requests.every((request) => request.authorization === undefined)).toBe(true);
  } finally {
    await closeFixture(visitor);
  }
});

test('public Places pagination requests one bounded unauthenticated detail page', async ({ browser, baseURL }) => {
  const state = fixtureState();
  const list = state.lists.recommendationLists[0]!;
  list.recommended_places = Array.from({ length: 24 }, (_, index) => ({
    documentId: `paging-place-${index + 1}`,
    Recommendation_Type: 'place',
    Media: [],
    media_details: {},
    recommendation_category: { Category_Name: 'Fixture category' },
    Place_Details: {
      Title: `Paging Place ${index + 1}`,
      Place_Name: `Paging Place ${index + 1}`,
      Place_Address: 'Fixture City',
      Place_Id: `fixture-place-${index + 1}`,
      Photos: [], Rating: 4.5, Rating_Count: 10, Geometry: { lat: 26.9, lng: 75.8 },
    },
  }));
  const visitor = await openFixture(browser, baseURL!, state);
  const requests: Array<{ pathname: string; search: string; authorization: string | undefined }> = [];
  visitor.page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === 'https://music-fixture.test'
      && url.pathname === `/api/explorers/v1/profiles/${fixtureUser.username}/recommendations/places/public-places`) {
      requests.push({ pathname: url.pathname, search: url.search, authorization: request.headers().authorization });
    }
  });
  try {
    await visitor.page.goto(`/${fixtureUser.username}/places/public-places`);
    await expect(visitor.page.getByText('Paging Place 24', { exact: true })).toBeVisible();
    await visitor.page.getByRole('button', { name: 'Load more places', exact: true }).scrollIntoViewIfNeeded();
    await expect.poll(() => requests.some((request) => request.search === '?limit=24&cursor=o24')).toBe(true);
    expect(requests.every((request) => request.authorization === undefined)).toBe(true);
  } finally {
    await closeFixture(visitor);
  }
});

test('Places ripple radius stays finite at startup, repeat and route re-entry', async ({ browser, baseURL }) => {
  const state = fixtureState(); state.lists.recommendationLists = [];
  const owner = await openFixture(browser, baseURL!, state, { owner: true });
  await owner.context.addInitScript(() => {
    (window as any).__invalidFixtureRadii = [];
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (this.localName === 'circle' && name === 'r' && !Number.isFinite(Number(value))) (window as any).__invalidFixtureRadii.push({ value: String(value), stack: new Error().stack });
      return original.call(this, name, value);
    };
  });
  try {
    for (let visit = 0; visit < 2; visit++) {
      if (visit === 0) await owner.page.goto('/recommendations/places'); else await owner.page.goBack();
      await expect(owner.page.getByText('Map your world', { exact: true })).toBeVisible();
      await owner.page.waitForTimeout(3000); // Includes the 2.4s repeat boundary.
      const invalid = await owner.page.evaluate(() => (window as any).__invalidFixtureRadii);
      await test.info().attach(`circle-startup-${visit}`, { body: JSON.stringify(invalid), contentType: 'application/json' });
      expect(invalid).toEqual([]);
      const radii = await owner.page.locator('circle[r]').evaluateAll(circles => circles.map(circle => Number(circle.getAttribute('r'))));
      expect(radii.length).toBeGreaterThan(0); expect(radii.every(r => Number.isFinite(r) && r >= 0)).toBe(true);
      await owner.page.getByText('Settings', { exact: true }).first().click();
    }
  } finally { await closeFixture(owner); }
});

test('contained actual Settings boot verifies account without mounting consent or writing preferences', async ({ browser, baseURL }) => {
  const state = fixtureState(); const owner = await openFixture(browser, baseURL!, state, { owner: true });
  try {
    await owner.page.goto('/settings');
    await owner.page.getByRole('button', { name: /Public Visibility/ }).click();
    await expect(owner.page.getByRole('switch', { name: 'Music public visibility' })).toBeEnabled();
    await expect(owner.page.getByTestId('cookie-consent-positioner')).toHaveCount(0);
    expect(await owner.page.evaluate(() => localStorage.getItem('explorers-cookie-consent'))).toBeNull();
    expect(state.writes).toEqual([]); owner.guard.assertClean();
  } finally { await closeFixture(owner); }
});

for (const category of categories) {
  // Break caught: Off forgets only visibility, or On silently restores saved pin.
  test(`${category.route}: Settings Off → guest fallback → header On → explicit manual Pin`, async ({ browser, baseURL }) => {
    const other = category.field === 'public_books' ? 'public_games' : 'public_books';
    const state = fixtureState({ pinned_nav_tabs: ['public_profile', category.field, other] });
    const owner = await openFixture(browser, baseURL!, state, { owner: true });
    const guest = await openFixture(browser, baseURL!, state);
    try {
      await settings(owner.page);
      await submitPinnedCategoryUnpublish(owner.page, owner.page.getByRole('checkbox', { name: category.label, exact: true }), category.label);
      await expect.poll(() => state.writes.length).toBe(1);
      expect(state.writes.map(r => r.variables)).toEqual([{ documentId: 'browser-account', data: { [category.field]: 'No', pinned_nav_tabs: ['public_profile', other] } }]);
      await owner.page.reload(); await settings(owner.page, true);
      await expect(owner.page.getByRole('checkbox', { name: category.label, exact: true })).not.toBeChecked();
      await expect(owner.page.getByRole('checkbox', { name: `Pin ${category.label}`, exact: true })).not.toBeChecked();
      await guest.page.goto(`/${fixtureUser.username}`);
      await expect(guest.page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
      await expect(guest.page.locator(`a[href="/${fixtureUser.username}/${category.route}"]`)).toHaveCount(0);
      await guest.page.goto(`/${fixtureUser.username}/${category.route}?utm_source=browser`);
      await expect(guest.page).toHaveURL(`${baseURL}/${fixtureUser.username}?utm_source=browser`);
      await owner.page.goto(`/recommendations/${category.route}`);
      await toggle(owner.page.getByRole('checkbox').first(), true);
      expect(state.writes.at(-1)?.variables.data).toEqual({ [category.field]: 'Yes' });
      expect(state.account.pinned_nav_tabs).toEqual(['public_profile', other]);
      await settings(owner.page, true);
      const pin = owner.page.getByRole('checkbox', { name: `Pin ${category.label}`, exact: true });
      await expect(pin).not.toBeChecked(); await toggle(pin, true);
      expect(state.writes.at(-1)?.variables.data).toEqual({ pinned_nav_tabs: ['public_profile', other, category.field] });
      await owner.page.reload(); await settings(owner.page, true); await expect(pin).toBeChecked();
      await guest.page.goto(`/${fixtureUser.username}`);
      await expect(guest.page.getByRole('link', { name: category.route[0].toUpperCase() + category.route.slice(1), exact: true })).toBeVisible();
      expect(guest.guard.vendors).toEqual([]);
      expect(await guest.page.evaluate(() => ({ auth: localStorage.getItem('auth-storage'), token: localStorage.getItem('qrtoken') }))).toEqual({ auth: null, token: null });
    } finally { await closeFixture(owner); await closeFixture(guest); }
  });
}

for (const category of categories) {
  test(`${category.route}: Auto saved → header Off → reload → Hub On → Manual explicit Pin`, async ({ browser, baseURL }) => {
    const other = category.field === 'public_books' ? 'public_games' : 'public_books';
    const state = fixtureState({ auto_pinning: true, pinned_nav_tabs: ['public_profile', category.field, other] });
    const owner = await openFixture(browser, baseURL!, state, { owner: true });
    const guest = await openFixture(browser, baseURL!, state);
    try {
      await owner.page.goto(`/recommendations/${category.route}`);
      await toggle(owner.page.getByRole('checkbox').first(), false);
      await owner.page.reload(); await expect(owner.page.getByRole('checkbox').first()).not.toBeChecked();
      expect(state.account.pinned_nav_tabs).toEqual(['public_profile', other]); expect(state.account.auto_pinning).toBe(true);
      await guest.page.goto(`/${fixtureUser.username}/${category.route}`); await expect(guest.page).toHaveURL(`${baseURL}/${fixtureUser.username}`);
      await owner.page.goto('/recommendations');
      const card = owner.page.locator('.rec-card').filter({ has: owner.page.getByRole('heading', { name: category.label.replace(/ Tab$/, ''), exact: true }) });
      await card.evaluate(element => element.scrollIntoView({ block: 'center' }));
      await card.getByTitle('Category options').click();
      const enable = owner.page.getByRole('button', { name: 'Enable Public URL', exact: true });
      await enable.focus(); await enable.press('Enter');
      await expect.poll(() => state.account[category.field]).toBe('Yes');
      expect(state.writes.at(-1)?.variables.data).toEqual({ [category.field]: 'Yes' });
      await settings(owner.page, true); await toggle(owner.page.getByRole('checkbox', { name: 'Auto-pin navigation tabs' }), false);
      await expect(owner.page.getByRole('checkbox', { name: `Pin ${category.label}`, exact: true })).not.toBeChecked();
      await owner.page.goto('/recommendations'); await card.evaluate(element => element.scrollIntoView({ block: 'center' })); await card.getByTitle('Category options').click();
      const pinAction = owner.page.getByRole('button', { name: 'Pin to Public Nav (Max 5)', exact: true }); await pinAction.focus(); await pinAction.press('Enter');
      await expect.poll(() => state.account.pinned_nav_tabs).toEqual(['public_profile', other, category.field]);
      await guest.page.goto(`/${fixtureUser.username}`);
      await expect(guest.page.getByRole('link', { name: category.route[0].toUpperCase() + category.route.slice(1), exact: true })).toBeVisible();
    } finally { await closeFixture(owner); await closeFixture(guest); }
  });
}

test('Profile mandatory, five slots, unpublished pin blocked and hidden saved choice removable', async ({ browser, baseURL }) => {
  const state = fixtureState({ public_games: 'No', pinned_nav_tabs: ['public_profile', 'public_books', 'public_movie', 'public_apps', 'public_products'] });
  const owner = await openFixture(browser, baseURL!, state, { owner: true });
  try {
    await settings(owner.page, true);
    await expect(owner.page.getByRole('checkbox', { name: 'Pin Profile Tab' })).toBeDisabled();
    await expect(owner.page.getByRole('checkbox', { name: 'Pin Games Tab' })).toBeDisabled();
    const people = owner.page.getByRole('checkbox', { name: 'Pin People Tab' });
    await people.focus(); await people.press('Space');
    await expect(owner.page.getByRole('alert')).toContainText('up to 5 tabs'); expect(state.writes).toEqual([]);
    state.account.public_books = 'No'; await owner.page.reload(); await settings(owner.page, true);
    await toggle(owner.page.getByRole('checkbox', { name: 'Pin Books Tab' }), false);
    expect(state.writes.at(-1)?.variables.data).toEqual({ pinned_nav_tabs: ['public_profile', 'public_movie', 'public_apps', 'public_products'] });
    expect(state.account.auto_pinning).toBe(false);
  } finally { await closeFixture(owner); }
});

for (const failure of ['read', 'write', 'lost', 'verification'] as const) {
  test(`category ${failure} failure remains honest and recovers through explicit Refresh`, async ({ browser, baseURL }) => {
    const state = fixtureState({ pinned_nav_tabs: ['public_profile', 'public_books', 'public_music'], public_music: 'Yes' }, 'public');
    const owner = await openFixture(browser, baseURL!, state, { owner: true });
    try {
      await settings(owner.page, true);
      const before = state.writes.length;
      if (failure === 'read') state.faults.set('CategoryNavigationAccount', [{ kind: 'error' }]);
      else if (failure === 'verification') state.faults.set('CategoryNavigationAccount', [{}, { kind: 'error' }]);
      else state.faults.set('UpdateTabVisibility', [{ kind: failure === 'lost' ? 'lost' : 'error' }]);
      const control = owner.page.getByRole('checkbox', { name: 'Books Tab', exact: true });
      await submitPinnedCategoryUnpublish(owner.page, control, 'Books Tab');
      await expect(owner.page.getByRole('alert').filter({ has: owner.page.getByRole('button', { name: 'Refresh', exact: true }) })).toBeVisible();
      const count = state.writes.length; await owner.page.waitForTimeout(250); expect(state.writes).toHaveLength(count);
      expect(state.account.pinned_nav_tabs).toContain('public_music');
      // The failed unpublish intentionally leaves its confirmation dialog open;
      // dismiss it before exercising the independent recovery control.
      await owner.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await owner.page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(control).toBeEnabled();
      await expect(control).toBeChecked({ checked: failure === 'read' || failure === 'write' });
      expect(state.writes.length - before).toBe(failure === 'read' ? 0 : 1);
    } finally { await closeFixture(owner); }
  });
}

test('two owner tabs merge latest pins, rapid repeated activation cannot add duplicate writes', async ({ browser, baseURL }) => {
  const state = fixtureState(); const owner = await openFixture(browser, baseURL!, state, { owner: true });
  const second = await owner.context.newPage();
  try {
    await settings(owner.page, true); await settings(second, true);
    await toggle(owner.page.getByRole('checkbox', { name: 'Pin Games Tab' }), true);
    await toggle(second.getByRole('checkbox', { name: 'Pin Apps & Tools Tab' }), true);
    await expect.poll(() => state.account.pinned_nav_tabs).toEqual(['public_profile', 'public_books', 'public_games', 'public_apps']);
    let release!: () => void; state.faults.set('UpdateTabVisibility', [{ gate: new Promise<void>(resolve => { release = resolve; }) }]);
    const control = second.getByRole('checkbox', { name: 'Books Tab', exact: true });
    await submitPinnedCategoryUnpublish(second, control, 'Books Tab'); await expect(control).toBeDisabled(); await control.press('Space');
    expect(state.writes).toHaveLength(3); release(); await expect(control).not.toBeChecked();
    await owner.page.reload(); await settings(owner.page, true);
    await expect(owner.page.getByRole('checkbox', { name: 'Pin Books Tab' })).not.toBeChecked();
    await expect(owner.page.getByRole('checkbox', { name: 'Pin Games Tab' })).toBeChecked();
  } finally { await closeFixture(owner); }
});

for (const choice of ['reject', 'accept', 'custom-off', 'custom-on', 'close'] as const) {
  test(`actual HTML consent ${choice} persists only its explicit choice, never recurring seeds`, async ({ browser, baseURL }) => {
    const visitor = await openFixture(browser, baseURL!, fixtureState());
    const page = visitor.page;
    try {
      await page.goto('/');
      const banner = page.getByTestId('cookie-consent-positioner');
      await expect(banner).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('explorers-cookie-consent'))).toBeNull();
      expect(visitor.guard.vendors).toEqual([]);
      expect(await page.evaluate(() => ({ scripts: [...document.scripts].filter(s => /googletagmanager|clarity\.ms/.test(s.src)).length, configs: ((window as any).dataLayer ?? []).filter((e: any) => e[0] === 'config').length }))).toEqual({ scripts: 0, configs: 0 });
      if (choice === 'close') await page.getByRole('button', { name: 'Close banner' }).click();
      else if (choice === 'reject') await page.getByRole('button', { name: /Reject Non-Essential/ }).click();
      else if (choice === 'accept') await page.getByRole('button', { name: /Accept All Cookies/ }).click();
      else {
        await page.getByRole('button', { name: /Customize/ }).click();
        await page.getByRole('switch', { name: choice === 'custom-on' ? 'Analytics Cookies' : 'Marketing Cookies' }).click();
        await page.getByRole('button', { name: 'Save Preferences' }).click();
      }
      await expect(banner).toHaveCount(0);
      const stored = await page.evaluate(() => localStorage.getItem('explorers-cookie-consent'));
      if (choice === 'close') expect(stored).toBeNull();
      else expect(JSON.parse(stored!)).toMatchObject({ essential: true, analytics: choice === 'accept' || choice === 'custom-on', marketing: choice === 'accept' || choice === 'custom-off' });
      const enabled = choice === 'accept' || choice === 'custom-on';
      await expect.poll(() => visitor.guard.vendors.length).toBe(enabled ? 2 : 0);
      await page.reload();
      expect(await page.evaluate(() => localStorage.getItem('explorers-cookie-consent'))).toBe(stored);
      if (choice === 'close') await expect(banner).toBeVisible(); else await expect(banner).toHaveCount(0);
      await page.goto(`/${fixtureUser.username}`);
      await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
      await expect(banner).toHaveCount(0);
      if (!enabled) expect(visitor.guard.vendors).toEqual([]);
    } finally { await closeFixture(visitor); }
  });
}

test('last list Draft and Delete preserve category settings/pins, private items stay filtered', async ({ browser, baseURL }) => {
  const state = fixtureState();
  state.lists.bookLists[0].recommended_books = [{ __typename: 'RecommendedBook', documentId: 'fixture-book', volume_id: 'fixture-volume', title: 'Visible fixture book', authors: [], subjects: [], Media: [], book_categories: [], is_pinned: false }];
  const privateList = { ...structuredClone(state.lists.bookLists[0]), documentId: 'private-books-list', List_Name: 'Private fixture list', slug: 'private-fixture', visibility: false };
  state.lists.bookLists.push(privateList);
  const before = { public_books: state.account.public_books, pins: [...state.account.pinned_nav_tabs] };
  const owner = await openFixture(browser, baseURL!, state, { owner: true }); const guest = await openFixture(browser, baseURL!, state);
  try {
    await guest.page.goto(`/${fixtureUser.username}/books`);
    await expect(guest.page.getByText('Public books', { exact: true }).first()).toBeVisible();
    await expect(guest.page.getByText('Private fixture list', { exact: true })).toHaveCount(0);
    await owner.page.goto('/recommendations/books');
    const card = owner.page.locator('div.group').filter({ has: owner.page.getByRole('heading', { name: 'Public books', exact: true }) });
    await card.getByRole('switch', { name: 'Toggle', exact: true }).click();
    await expect(card.getByText('Draft', { exact: true })).toBeVisible();
    expect(state.writes.map(r => r.name)).toEqual(['UpdateBookList']);
    await owner.page.reload(); await expect(card.getByText('Draft', { exact: true })).toBeVisible();
    await guest.page.reload(); await expect(guest.page.getByText('Public books', { exact: true })).toHaveCount(0);
    await owner.page.getByRole('heading', { name: 'Public books', exact: true }).click();
    await owner.page.getByRole('button', { name: 'manage', exact: true }).click();
    owner.page.once('dialog', dialog => dialog.accept());
    await owner.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(owner.page).toHaveURL(`${baseURL}/recommendations/books`);
    expect(state.writes.map(r => r.name)).toEqual(['UpdateBookList', 'DeleteBookList']);
    await owner.page.getByRole('heading', { name: 'Private fixture list', exact: true }).click();
    await owner.page.getByRole('button', { name: 'manage', exact: true }).click();
    owner.page.once('dialog', dialog => dialog.accept()); await owner.page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(owner.page.getByText('Build your library', { exact: true })).toBeVisible();
    expect(state.lists.bookLists).toEqual([]); expect(state.writes.map(r => r.name)).toEqual(['UpdateBookList', 'DeleteBookList', 'DeleteBookList']);
    expect({ public_books: state.account.public_books, pins: state.account.pinned_nav_tabs }).toEqual(before);
    await settings(owner.page, true); await expect(owner.page.getByRole('checkbox', { name: 'Books Tab', exact: true })).toBeChecked();
    await expect(owner.page.getByRole('checkbox', { name: 'Pin Books Tab' })).toBeChecked();
  } finally { await closeFixture(owner); await closeFixture(guest); }
});

test('all eight empty list responses never mutate category publication or saved pins', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const state = fixtureState(); for (const category of categories) state.lists[category.root] = [];
  const before = structuredClone(state.account); const owner = await openFixture(browser, baseURL!, state, { owner: true });
  await owner.context.addInitScript(() => {
    (window as any).__invalidSvgNumbers = [];
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      const number = parseFloat(String(value));
      if (['circle', 'rect'].includes(this.localName) && ['r', 'cx', 'cy', 'width', 'height'].includes(name) && (!Number.isFinite(number) || ['r', 'width', 'height'].includes(name) && number < 0)) (window as any).__invalidSvgNumbers.push({ tag: this.localName, name, value: String(value) });
      return original.call(this, name, value);
    };
  });
  try {
    const taglines = ['Map your world', 'Your personal cinema', 'Build your library', 'Level up your lists', 'Your stack, curated', 'Showcase your picks', 'Celebrate great minds', 'Write the itinerary'];
    const diagnostics: Record<string, string[]> = {};
    const invalid: Record<string, unknown> = {};
    for (const [index, category] of categories.entries()) {
      const start = owner.guard.errors.length; await owner.page.goto(`/recommendations/${category.route}`); await expect(owner.page.getByText(taglines[index], { exact: true })).toBeVisible();
      await owner.page.waitForTimeout(5500); // Cross the observed longest numeric repeat (Games XP, 5s).
      invalid[category.route] = await owner.page.evaluate(() => (window as any).__invalidSvgNumbers);
      await owner.page.getByText('Settings', { exact: true }).first().click(); await owner.page.goBack(); await expect(owner.page.getByText(taglines[index], { exact: true })).toBeVisible();
      invalid[category.route] = await owner.page.evaluate(() => (window as any).__invalidSvgNumbers);
      diagnostics[category.route] = owner.guard.errors.slice(start);
    }
    await test.info().attach('empty-category-console-by-route', { contentType: 'application/json', body: JSON.stringify(diagnostics) });
    await test.info().attach('invalid-numeric-svg-attributes', { contentType: 'application/json', body: JSON.stringify(invalid) });
    expect(Object.values(invalid).every(values => Array.isArray(values) && values.length === 0)).toBe(true);
    await settings(owner.page); expect(state.writes).toEqual([]); expect(state.account).toEqual(before);
  } finally { await closeFixture(owner); }
});

test('direct dashboard/public/share never mount consent; landing delayed banner cancels on navigation', async ({ browser, baseURL }) => {
  const state = fixtureState(); const visitor = await openFixture(browser, baseURL!, state, { owner: true });
  const landing = await openFixture(browser, baseURL!, state);
  try {
    for (const path of ['/settings', '/recommendations/music', `/${fixtureUser.username}`, `/${fixtureUser.username}/music`, '/music/share/missing-fixture']) {
      await visitor.page.goto(path); await visitor.page.waitForTimeout(2200);
      await expect(visitor.page.getByTestId('cookie-consent-positioner')).toHaveCount(0);
      expect(await visitor.page.evaluate(() => localStorage.getItem('explorers-cookie-consent'))).toBeNull(); expect(visitor.guard.vendors).toEqual([]);
    }
    await landing.page.goto('/'); await landing.page.getByRole('button', { name: /log.?in/i }).first().click();
    await landing.page.waitForTimeout(2300); await expect(landing.page.getByTestId('cookie-consent-positioner')).toHaveCount(0); expect(landing.guard.vendors).toEqual([]);
  } finally { await closeFixture(visitor); await closeFixture(landing); }
});

test('consent storage denial keeps actual bootstrap and explicit Accept fail closed', async ({ browser, baseURL }) => {
  const visitor = await openFixture(browser, baseURL!, fixtureState());
  await visitor.context.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === 'explorers-cookie-consent') throw new DOMException('Fixture denied', 'SecurityError'); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key === 'explorers-cookie-consent') throw new DOMException('Fixture denied', 'SecurityError'); return set.call(this, key, value); };
  });
  try {
    await visitor.page.goto('/'); await visitor.page.getByRole('button', { name: /Accept All Cookies/ }).click();
    await expect(visitor.page.getByTestId('cookie-consent-positioner')).toHaveCount(0); expect(visitor.guard.vendors).toEqual([]);
    await visitor.page.reload(); await expect(visitor.page.getByTestId('cookie-consent-positioner')).toBeVisible(); expect(visitor.guard.vendors).toEqual([]);
    expect(await visitor.page.evaluate(() => [...document.scripts].filter(s => /googletagmanager|clarity\.ms/.test(s.src)).length)).toBe(0);
  } finally { await closeFixture(visitor); }
});

test('catchall deliberately denies unknown external HTTP and WebSocket without forwarding', async ({ browser, baseURL }) => {
  const visitor = await openFixture(browser, baseURL!, fixtureState());
  try {
    await visitor.page.goto(`/${fixtureUser.username}`); await expect(visitor.page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    visitor.guard.assertClean();
    await visitor.page.evaluate(async () => { try { await fetch('https://music-fixture.test/deliberately-unhandled'); } catch { /* Expected local abort. */ } });
    const unhandledMusicPage = await visitor.context.newPage();
    await unhandledMusicPage.goto('https://localtunes.test/assets/deliberately-unhandled.js').catch(() => undefined);
    await unhandledMusicPage.close();
    await visitor.page.evaluate(origin => new Promise<void>(resolve => { const socket = new WebSocket(origin.replace('http:', 'ws:') + '/deliberately-unhandled'); socket.onclose = () => resolve(); }), baseURL!);
    expect(visitor.guard.denied).toEqual([
      'GET external music-fixture.test',
      'GET external localtunes.test/assets/deliberately-unhandled.js',
      'unexpected websocket',
    ]);
    await test.info().attach('expected-denial', { contentType: 'application/json', body: JSON.stringify({ denied: visitor.guard.denied, console: visitor.guard.errors }) });
    expect(visitor.guard.errors).toEqual(['Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector']);
  } finally { await visitor.context.close(); }
});

test('offline/online and Music outage preserve unrelated pins until explicit fresh owner action', async ({ browser, baseURL }) => {
  const state = fixtureState({ public_music: 'Yes', pinned_nav_tabs: ['public_profile', 'public_music', 'public_books'] }, 'public');
  const owner = await openFixture(browser, baseURL!, state, { owner: true });
  try {
    await settings(owner.page, true);
    state.faults.set('CategoryNavigationAccount', [{ kind: 'offline' }]);
    await owner.context.setOffline(true);
    const pin = owner.page.getByRole('checkbox', { name: 'Pin Games Tab' }); await pin.focus(); await pin.press('Space');
    await expect(owner.page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible(); expect(state.writes).toEqual([]);
    expect(state.account.pinned_nav_tabs).toEqual(['public_profile', 'public_music', 'public_books']);
    await owner.context.setOffline(false); await expect(pin).toBeEnabled(); expect(state.writes).toEqual([]);
    state.faults.set('/api/music/public-profile/browser-account', Array.from({ length: 10 }, () => ({ kind: 'error' as const })));
    await toggle(pin, true);
    expect(state.writes.at(-1)?.variables.data).toEqual({ pinned_nav_tabs: ['public_profile', 'public_music', 'public_books', 'public_games'] });
    expect(state.account.public_music).toBe('Yes'); expect(state.mode).toBe('public');
  } finally { await owner.context.setOffline(false); await closeFixture(owner); }
});

test('ordinary stale loaded account rereads latest pins and route/account change blocks pending intent', async ({ browser, baseURL }) => {
  const state = fixtureState(); const owner = await openFixture(browser, baseURL!, state, { owner: true }); let release!: () => void;
  try {
    await settings(owner.page, true);
    state.account.pinned_nav_tabs = ['public_profile', 'public_books', 'public_apps'];
    await toggle(owner.page.getByRole('checkbox', { name: 'Pin Games Tab' }), true);
    expect(state.account.pinned_nav_tabs).toEqual(['public_profile', 'public_books', 'public_apps', 'public_games']);
    const writes = state.writes.length;
    state.faults.set('CategoryNavigationAccount', [{ gate: new Promise<void>(resolve => { release = resolve; }) }]);
    const books = owner.page.getByRole('checkbox', { name: 'Books Tab', exact: true }); await submitPinnedCategoryUnpublish(owner.page, books, 'Books Tab'); await expect(books).toBeDisabled();
    state.account.documentId = 'fixture-account-b'; await owner.page.goto('/recommendations/books'); release();
    await expect(owner.page.getByRole('checkbox').first()).toBeEnabled(); expect(state.writes).toHaveLength(writes); expect(state.account.public_books).toBe('Yes');
    state.account.documentId = 'browser-account'; await owner.page.reload(); await expect(owner.page.getByRole('checkbox').first()).toBeChecked(); expect(state.writes).toHaveLength(writes);
  } finally { release?.(); await closeFixture(owner); }
});
