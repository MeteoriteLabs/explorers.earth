import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setupMockAuthentication } from "./setup/auth";

type LifecycleOperation = {
  operationId: string;
  status: "pending_deletion" | "suspended" | "tombstoned";
  phase: "prepared" | "finalized";
  state: "completed" | "requested" | "running" | "failed" | "cancelled";
  boundaryCrossed: boolean;
  retryable: boolean;
  deadLetter: boolean;
};

const envelope = (operation: LifecycleOperation) => ({ version: "music-lifecycle/v1", operation });

async function mockSettings(context: BrowserContext, operation: LifecycleOperation, events: string[] = []) {
  await setupMockAuthentication(context);
  await context.route("**/api/music/identity/lifecycle/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1)!;
    events.push(action);
    if (action === "cancel") {
      operation = { ...operation, status: "suspended", state: "cancelled", boundaryCrossed: false, retryable: false };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(operation)) });
  });
  await context.route("**/graphql", async (route) => {
    const query = String(route.request().postDataJSON()?.query ?? "");
    const account = {
      Account_Name: "Test", Account_Type: "Explorer", mobile_number: "+15555550100",
      documentId: "account-document-123", username: "testuser", localtunes_integrated: "No",
      localtunes_public: "No", public_profile: "Yes", public_recommendations: "No", public_music: "No",
      public_movie: "No", public_guides: "No", public_books: "No", public_games: "No", public_apps: "No",
      public_products: "No", public_people: "No", pinned_nav_tabs: [], auto_pinning: false,
    };
    const currentUser = {
      id: "mock-user-123", documentId: "mock-user-123", username: "testuser", email: "test@explorers.earth",
      blocked: false, provider: "google", accounts: [account],
    };
    let data: Record<string, unknown>;
    if (query.includes("mutation DeleteAccount")) {
      events.push("upstream-delete");
      data = {
        deleteRecommendationList: { documentId: "mock-user-123" },
        deleteUsersPermissionsUser: { data: { accounts: [{ Account_Name: "Test", Account_Type: "Explorer", documentId: "account-document-123", Bio: null, Addresss: null }] } },
        deleteAccount: { documentId: "account-document-123" },
      };
    } else if (query.includes("CheckOnboardingStatus")) {
      data = { usersPermissionsUser: currentUser };
    } else if (query.includes("query Account")) {
      data = { accounts: [account] };
    } else if (query.includes("usersPermissionsUser")) {
      data = { usersPermissionsUser: currentUser };
    } else {
      data = {
        bookLists: [], gameLists: [], appLists: [], productLists: [], movieLists: [], personLists: [],
        guides: [], recommendationLists: [], subscriptions: [], plans: [],
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

async function assertNoLifecyclePersistence(page: Page) {
  const persisted = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage),
    url: location.href,
    cookies: document.cookie,
  }));
  expect(JSON.stringify(persisted)).not.toContain("delete-operation-durable");
  expect(persisted.url).not.toMatch(/operation|secret/i);
}

test("pending deletion survives reload and a second tab, then cancels only before the boundary", async ({ context, page }) => {
  const pending: LifecycleOperation = {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "completed",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  };
  await mockSettings(context, pending);
  await page.goto("/settings");
  await expect(page.getByText("Account deletion is prepared. Music access is paused.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Cancel deletion" })).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto("/settings");
  await expect(secondTab.getByText("Account deletion is prepared. Music access is paused.")).toBeVisible();
  await assertNoLifecyclePersistence(page);
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page.getByText("Account deletion is prepared. Music access is paused.")).toBeHidden();
});

test("a crossed-boundary retry preserves ordering and completes at login", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "requested",
    boundaryCrossed: true, retryable: true, deadLetter: false,
  }, events);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Retry account deletion" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(events.slice(-3)).toEqual(["prepare", "boundary", "upstream-delete"]);
});

test("dead-letter escalation is typed and offers no destructive retry", async ({ context, page }) => {
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "failed",
    boundaryCrossed: true, retryable: false, deadLetter: true,
  });
  await page.goto("/settings");
  await expect(page.getByRole("alert")).toContainText("manual review");
  await expect(page.getByRole("button", { name: /retry account deletion|cancel deletion/i })).toHaveCount(0);
  await assertNoLifecyclePersistence(page);
});
