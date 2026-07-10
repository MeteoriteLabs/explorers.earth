import { test, expect } from '@playwright/test';
import { setupMockAuthentication } from './setup/auth';

test.beforeEach(async ({ context, page }) => {
  await setupMockAuthentication(context);

  await page.route('**/graphql', async route => {
    const payload = route.request().postDataJSON();

    if (payload?.query?.includes('CheckOnboardingStatus') || payload?.query?.includes('MyAccount') || payload?.query?.includes('UsersPermissionsUser')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            usersPermissionsUser: {
              accounts: [
                {
                  documentId: 'acc-123',
                  Account_Name: 'Test Account',
                  Account_Type: 'business',
                  mobile_number: '1234567890',
                  public_movie: 'No',
                  public_books: 'No',
                  public_games: 'No',
                  public_music: 'No',
                  public_apps: 'No',
                  public_products: 'No',
                  public_people: 'No',
                  public_guides: 'No',
                  public_recommendations: 'No'
                }
              ]
            }
          }
        })
      });
    } else if (payload?.query?.includes('createPeopleList')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            createPeopleList: {
              documentId: 'people-list-123',
              List_Name: 'Inspiring Founders',
              slug: 'inspiring-founders',
              visibility: false,
              display_order: 0,
            }
          }
        })
      });
    } else if (payload?.query?.includes('createRecommendedPerson')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            createRecommendedPerson: {
              documentId: 'person-rec-456',
              name: 'Mock Person Name',
            }
          }
        })
      });
    } else if (payload?.query?.includes('PEOPLE_LISTS_BY_ACCOUNT') || payload?.query?.includes('PeopleLists')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            personLists: [
              {
                documentId: 'people-list-123',
                List_Name: 'Inspiring Founders',
                slug: 'inspiring-founders',
                visibility: false,
                display_order: 0,
                recommended_people: []
              }
            ]
          }
        })
      });
    } else if (payload?.query?.includes('PEOPLE_BY_LIST') || payload?.query?.includes('PeopleByList')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            personLists: [
              {
                documentId: 'people-list-123',
                List_Name: 'Inspiring Founders',
                slug: 'inspiring-founders',
                Visibility: false,
                display_order: 0,
                recommended_people: [
                  {
                    documentId: 'person-rec-456',
                    name: 'Mock Person Name',
                    username_handle: 'mockperson',
                    headline: 'Founder & Builder',
                    location: 'San Francisco, CA',
                    avatar_path: 'https://example.com/avatar.png',
                    media_details: '{}',
                    primary_platform: 'linkedin',
                    social_urls: '{}',
                    skills_tags: '["React", "Node"]',
                    user_recommendation_note: 'A great leader and engineer.',
                    user_rating: 9,
                    is_pinned: false,
                    pin_order: null,
                    display_order: 0,
                    people_category: null
                  }
                ]
              }
            ]
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} })
      });
    }
  });

  // Mock Scraper Endpoint
  await page.route('**/api/people/scrape-profile', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        full_name: 'Mock Person Name',
        name: 'Mock Person Name',
        bio: 'Founder & Builder',
        platform: 'linkedin',
        profile_url: 'https://linkedin.com/in/test'
      })
    });
  });
});

test('Flow 7: People List and Scraper E2E', async ({ page }) => {
  await page.goto('/recommendations/people');

  const addListBtn = page.locator('button:has-text("New List")').first();
  await expect(addListBtn).toBeVisible();
  await addListBtn.click();

  const nameInput = page.locator('input[name="List_Name"]');
  await nameInput.fill('Inspiring Founders');

  const submitBtn = page.locator('button[type="submit"]:has-text("Create List")');
  await submitBtn.click();

  await page.goto('/recommendations/people/people-list-123');

  const addPersonBtn = page.locator('button:has-text("Add Person")');
  await expect(addPersonBtn).toBeVisible();
  await addPersonBtn.click();

  await expect(page).toHaveURL(/\/recommendations\/people\/people-list-123\/add/);

  const urlInput = page.locator('input[placeholder*="linkedin.com"]');
  await urlInput.fill('https://linkedin.com/in/test');

  const fetchBtn = page.locator('button:has-text("Fetch")');
  await fetchBtn.click();

  const noteEditor = page.locator('.ql-editor');
  await expect(noteEditor).toBeVisible();
  await noteEditor.fill('Inspiring coding mentor.');

  const saveBtn = page.locator('button:has-text("Add to List")');
  await saveBtn.click();

  await expect(page).toHaveURL(/\/recommendations\/people\/people-list-123/);
});
