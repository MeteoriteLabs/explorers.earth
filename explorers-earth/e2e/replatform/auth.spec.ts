import { readFileSync } from 'node:fs';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

type Persona = { userId: string; cookie: string; handle: string };
type Fixture = { origin: string; personas: { ownerA: Persona; ownerB: Persona }; recoveryProof: string };
const fixturePath = process.env.AUTH_E2E_FIXTURE_PATH;
if (!fixturePath || process.env.PLAYWRIGHT_EXTERNAL_BASE_URL?.startsWith('http://127.0.0.1:') !== true)
  throw new Error('Auth E2E requires the owned loopback fixture runner');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
if (fixture.origin !== process.env.PLAYWRIGHT_EXTERNAL_BASE_URL || !fixture.recoveryProof)
  throw new Error('Auth fixture authority mismatch');

async function browserSession(context: BrowserContext, persona: Persona) {
  const separator = persona.cookie.indexOf('=');
  await context.addCookies([{ name: persona.cookie.slice(0, separator),
    value: persona.cookie.slice(separator + 1), url: fixture.origin, sameSite: 'Lax', httpOnly: true }]);
}
async function localOnly(page: Page) {
  await page.route('**/*', (route) => {
    const target = new URL(route.request().url());
    if (target.protocol === 'data:' || target.protocol === 'blob:' || target.origin === fixture.origin)
      return route.continue();
    return route.abort();
  });
}

test('stale local auth never opens a private deep link; public login remains reachable', async ({ page }) => {
  await localOnly(page);
  await page.addInitScript(() => localStorage.setItem('auth-storage', JSON.stringify({ state: {
    isAuthenticated: true, token: 'old-strapi-token', user: { documentId: 'old-account' },
  }, version: 0 })));
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page.getByRole('button', { name: /Google/i }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('qrtoken'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: /Google/i }).first()).toBeVisible();
});

test('real local session gates onboarding and cross-tab logout revokes both tabs', async ({ context, page }) => {
  await browserSession(context, fixture.personas.ownerA);
  await localOnly(page);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/onboarding$/);
  const second = await context.newPage();
  await localOnly(second);
  await second.goto('/onboarding');
  await expect(second.getByRole('button', { name: 'Log out' }).first()).toBeVisible();
  await second.getByRole('button', { name: 'Log out' }).first().click();
  await second.getByRole('button', { name: 'Log out' }).last().click();
  await expect(second).toHaveURL(/\/login(?:\?.*)?$/);
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  const denied = await page.request.get(`${fixture.origin}/api/explorers/v1/me`, {
    headers: { Cookie: fixture.personas.ownerA.cookie },
  });
  expect(denied.status()).toBe(401);
  await second.close();
});

test('purpose-bound proof recovers once against real API and requires a fresh ordinary session', async ({ context, page }) => {
  await context.addCookies([{ name: 'explorers_recovery_proof', value: fixture.recoveryProof,
    domain: '127.0.0.1', path: '/api/explorers/v1/recovery', sameSite: 'Lax', httpOnly: true }]);
  await localOnly(page);
  await page.goto('/reactivate-confirm?token=legacy-url-token');
  await expect(page.getByRole('button', { name: 'Reactivate account' })).toBeVisible();
  await page.getByRole('button', { name: 'Reactivate account' }).click();
  await expect(page.getByText('Account reactivated')).toBeVisible();
  const ordinary = await page.request.get(`${fixture.origin}/api/explorers/v1/me`);
  expect(ordinary.status()).toBe(401);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('expired or unavailable');
});
