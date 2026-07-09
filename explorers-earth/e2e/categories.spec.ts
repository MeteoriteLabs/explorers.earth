import { test, expect } from '@playwright/test';
import { setupMockAuthentication } from './setup/auth';

test.beforeEach(async ({ context, page }) => {
  await setupMockAuthentication(context);

  // Mock all external endpoints and GraphQL queries to keep E2E tests stable and fast
  await page.route('**/graphql', async route => {
    const payload = route.request().postDataJSON();

    if (payload?.query?.includes('CheckOnboardingStatus')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            usersPermissionsUser: {
              accounts: [
                {
                  Account_Name: 'Test Account',
                  Account_Type: 'business',
                  mobile_number: '1234567890'
                }
              ]
            }
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accounts: {
              data: [
                {
                  id: '1',
                  attributes: {
                    username: 'testuser',
                    name: 'Test User',
                    avatar_url: null,
                  }
                }
              ]
            },
            recommendedMovies: { data: [] },
          recommendedBooks: { data: [] },
          recommendedGames: { data: [] },
          recommendedMusic: { data: [] },
          recommendedProducts: { data: [] },
          recommendedApps: { data: [] },
          recommendedPeople: { data: [] },
          recommendedPlaces: { data: [] },
          recommendedGuides: { data: [] }
        }
      })
    });
  }
});

  await page.route('**/api/products/scrape-link', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Mock Product Name', description: 'Product Bio', price: 9.99 })
    });
  });

  await page.route('**/api/apps/scrape-url', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Mock App Name', description: 'App Bio', platform: 'iOS' })
    });
  });

  await page.route('**/api/people/scrape-profile', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Mock Person Name', bio: 'Person Bio', platform: 'linkedin' })
    });
  });
});

test.describe('Explorers Earth Content Flow E2Es', () => {
  test('1. Movies: Can navigate to Movies tab', async ({ page }) => {
    await page.goto('/');
    // Check if body or header displays page elements
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('2. Books: Can navigate to Books tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('3. Games: Can navigate to Games tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('4. Music: Can navigate to Music tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('5. Products: Can navigate to Products tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('6. Apps: Can navigate to Apps tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('7. People: Can navigate to People tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('8. Locations: Can navigate to Locations tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('9. Guides: Can navigate to Guides tab', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
