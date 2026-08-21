import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { setupMockAuthentication } from "./setup/auth";

type LifecycleOperation = {
  operationId: string;
  status: "pending_deletion" | "suspended" | "tombstoned" | "not_present";
  phase: "prepared" | "finalized";
  state: "completed" | "requested" | "running" | "failed" | "cancelled";
  boundaryCrossed: boolean;
  retryable: boolean;
  deadLetter: boolean;
};

const envelope = (operation: LifecycleOperation) => ({
  version: "music-lifecycle/v1",
  operation: {
    ...operation,
    upstreamUserDocumentId: "mock-user-123",
    upstreamAccountDocumentId: "account-document-123",
  },
});

async function mockSettings(
  context: BrowserContext,
  operation: LifecycleOperation,
  events: string[] = [],
  options: {
    loseAccountDeleteResponseOnce?: boolean;
    statusMode?: "normal" | "delayed" | "error";
    additionalAccount?: boolean;
    provider?: "google" | "local";
    musicNotPresent?: boolean;
    suspensionUnavailable?: boolean;
    suspensionPendingDeletion?: boolean;
    strapiBlockUnconfirmed?: boolean;
    cancelAsNotPresent?: boolean;
    loseCancelResponseOnce?: boolean;
  } = {},
) {
  let accountPresent = true;
  let loseAccountDeleteResponse = options.loseAccountDeleteResponseOnce === true;
  let loseCancelResponse = options.loseCancelResponseOnce === true;
  await setupMockAuthentication(context);
  await context.route("**/api/music/identity/lifecycle/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").at(-1)!;
    events.push(action);
    if (action === "suspend" && options.suspensionUnavailable) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: {
        code: "LIFECYCLE_UNAVAILABLE", message: "Music lifecycle is unavailable.", retryable: true,
      } }) });
      return;
    }
    if (action === "suspend" && options.suspensionPendingDeletion) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: {
        code: "IDENTITY_PENDING_DELETION", message: "This Music identity is pending deletion.", retryable: false,
      } }) });
      return;
    }
    if (action === "status" && options.statusMode === "delayed") await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (action === "status" && options.statusMode === "error") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: {
        code: "UPSTREAM_UNAVAILABLE", message: "Lifecycle state unavailable.", retryable: true,
      } }) });
      return;
    }
    if (action === "cancel") {
      operation = {
        ...operation,
        status: options.cancelAsNotPresent ? "not_present" : "suspended",
        state: "cancelled",
        boundaryCrossed: false,
        retryable: false,
      };
      if (loseCancelResponse) {
        loseCancelResponse = false;
        await route.abort("connectionreset");
        return;
      }
    }
    if (action === "suspend") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          version: "music-lifecycle/v1",
          identity: { status: options.musicNotPresent ? "not_present" : "suspended" },
        }),
      });
      return;
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
      blocked: false, provider: options.provider ?? "google", confirmed: true,
      accounts: accountPresent ? [account] : [],
    };
    let data: Record<string, unknown>;
    if (query.includes("mutation login")) {
      events.push("login");
      data = { login: { jwt: "mock-jwt-token-xyz", user: currentUser } };
    } else if (query.includes("mutation UpdateUsersPermissionsUser")) {
      events.push("strapi-block");
      data = options.strapiBlockUnconfirmed
        ? { updateUsersPermissionsUser: { data: null } }
        : { updateUsersPermissionsUser: { data: { ...currentUser, blocked: true } } };
    } else if (query.includes("mutation DeleteExplorerAccount")) {
      events.push("account-delete");
      accountPresent = false;
      if (loseAccountDeleteResponse) {
        loseAccountDeleteResponse = false;
        await route.abort("connectionreset");
        return;
      }
      data = { deleteAccount: { documentId: "account-document-123" } };
    } else if (query.includes("mutation DeleteExplorerUser")) {
      events.push("user-delete");
      data = {
        deleteRecommendationList: { documentId: "mock-user-123" },
        deleteUsersPermissionsUser: { data: { documentId: "mock-user-123", accounts: [{ Account_Name: "Test", Account_Type: "Explorer", documentId: "account-document-123", Bio: null, Addresss: null }] } },
      };
    } else if (query.includes("CheckOnboardingStatus")) {
      data = { usersPermissionsUser: currentUser };
    } else if (query.includes("query Account")) {
      data = { accounts: accountPresent ? [account] : [] };
    } else if (query.includes("usersPermissionsUser")) {
      const deletionPresenceRead = query.includes("username") && query.includes("accounts") && !query.includes("Account_Name");
      data = { usersPermissionsUser: deletionPresenceRead && options.additionalAccount
        ? { ...currentUser, accounts: [account, { ...account, documentId: "account-document-b" }] }
        : currentUser };
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

test("a never-provisioned Explorer identity treats exact Music absence as a safe deactivation no-op", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "not_present", phase: "prepared", state: "cancelled",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  }, events, { musicNotPresent: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Deactivate your account?" }).click();
  await page.getByRole("button", { name: "Deactivate My Account" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(events.filter((event) => ["suspend", "strapi-block"].includes(event))).toEqual(["suspend", "strapi-block"]);
});

for (const provider of ["google", "local"] as const) {
  test(`${provider} account deactivation suspends Music before blocking Strapi`, async ({ context, page }) => {
    const events: string[] = [];
    await mockSettings(context, {
      operationId: "delete-operation-durable", status: "suspended", phase: "prepared", state: "cancelled",
      boundaryCrossed: false, retryable: false, deadLetter: false,
    }, events, { provider });
    await page.goto("/settings");
    await page.getByRole("button", { name: "Deactivate your account?" }).click();
    if (provider === "local") await page.getByPlaceholder("Enter your current password").fill("valid-password");
    await page.getByRole("button", { name: "Deactivate My Account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(events.filter((event) => ["login", "suspend", "strapi-block"].includes(event))).toEqual(
      provider === "local" ? ["login", "suspend", "strapi-block"] : ["suspend", "strapi-block"],
    );
  });
}

test("Music suspension outage leaves Strapi and browser authority active for retry", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "suspended", phase: "prepared", state: "cancelled",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  }, events, { suspensionUnavailable: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Deactivate your account?" }).click();
  await page.getByRole("button", { name: "Deactivate My Account" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect(events.filter((event) => event === "strapi-block")).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("auth-storage"))).toContain("mock-jwt-token-xyz");
});

test("pending Music deletion prevents Strapi deactivation and browser auth cleanup", async ({ context, page }) => {
  // Break caught: pending/dead-letter Music deletion is swallowed as not-present and Settings logs the user out.
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "suspended", phase: "prepared", state: "cancelled",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  }, events, { suspensionPendingDeletion: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Deactivate your account?" }).click();
  await page.getByRole("button", { name: "Deactivate My Account" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect(events.filter((event) => event === "strapi-block")).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("auth-storage"))).toContain("mock-jwt-token-xyz");
});

test("an unconfirmed Strapi block leaves the suspended transition resumable without reporting success", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "suspended", phase: "prepared", state: "cancelled",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  }, events, { strapiBlockUnconfirmed: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Deactivate your account?" }).click();
  await page.getByRole("button", { name: "Deactivate My Account" }).click();
  await expect.poll(() => events.filter((event) => event === "strapi-block").length).toBe(1);
  await expect(page).toHaveURL(/\/settings$/);
  expect(events.filter((event) => ["suspend", "strapi-block"].includes(event))).toEqual(["suspend", "strapi-block"]);
  expect(await page.evaluate(() => localStorage.getItem("auth-storage"))).toContain("mock-jwt-token-xyz");
});

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

test("a lost nullable cancel response reloads the exact cancelled terminal state without another prepare", async ({ context, page }) => {
  // Break caught: a never-provisioned cancellation is collapsed to LIFECYCLE_NOT_FOUND after the response is lost.
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "completed",
    boundaryCrossed: false, retryable: false, deadLetter: false,
  }, events, { cancelAsNotPresent: true, loseCancelResponseOnce: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect.poll(() => events.filter((event) => event === "cancel").length).toBe(1);
  await page.reload();
  await expect(page.getByText("Account deletion is prepared. Music access is paused.")).toBeHidden();
  await expect(page.getByRole("button", { name: "Delete your account?" })).toBeVisible();
  expect(events.filter((event) => event === "prepare")).toEqual([]);
  await assertNoLifecyclePersistence(page);
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
  expect(events.filter((event) => ["prepare", "boundary", "account-delete", "user-delete"].includes(event)).slice(-4))
    .toEqual(["prepare", "boundary", "account-delete", "user-delete"]);
});

test("a crossed-boundary retry refuses any additional Account outside the durable tuple", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "requested",
    boundaryCrossed: true, retryable: true, deadLetter: false,
  }, events, { additionalAccount: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Retry account deletion" }).click();
  await expect(page.getByText("The Explorer Account state could not be verified. Try again without signing out.")).toBeVisible();
  await expect(page).toHaveURL(/\/settings$/);
  expect(events.filter((event) => ["account-delete", "user-delete"].includes(event))).toEqual([]);
});

test("a lost Account mutation response keeps user authority and reload resumes with only the user deletion", async ({ context, page }) => {
  // Break caught: ambiguous Account deletion is followed by user deletion in the same request/attempt.
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "requested",
    boundaryCrossed: true, retryable: true, deadLetter: false,
  }, events, { loseAccountDeleteResponseOnce: true });
  await page.goto("/settings");
  await page.getByRole("button", { name: "Retry account deletion" }).click();
  await expect.poll(() => events.filter((event) => event === "account-delete").length).toBe(1);
  await expect(page).toHaveURL(/\/settings$/);
  expect(events.filter((event) => event === "account-delete")).toHaveLength(1);
  expect(events.filter((event) => event === "user-delete")).toHaveLength(0);

  await page.reload();
  await page.getByRole("button", { name: "Retry account deletion" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(events.filter((event) => event === "account-delete")).toHaveLength(1);
  expect(events.filter((event) => event === "user-delete")).toHaveLength(1);
});

test("dead-letter escalation is typed and offers no destructive retry", async ({ context, page }) => {
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "failed",
    boundaryCrossed: true, retryable: false, deadLetter: true,
  }, events);
  await page.goto("/settings");
  await expect(page.getByRole("alert")).toContainText("manual review");
  await expect(page.getByRole("button", { name: /retry account deletion|cancel deletion/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete (?:your|my) account/i })).toHaveCount(0);
  expect(events.filter((event) => ["prepare", "boundary", "account-delete", "user-delete"].includes(event))).toEqual([]);
  await assertNoLifecyclePersistence(page);
});

test("finalized deletion hides every ordinary delete entry point and performs no destructive call", async ({ context, page }) => {
  // Break caught: tombstoned reload exposes a fresh confirmation saga.
  const events: string[] = [];
  await mockSettings(context, {
    operationId: "delete-operation-durable", status: "tombstoned", phase: "finalized", state: "completed",
    boundaryCrossed: true, retryable: false, deadLetter: false,
  }, events);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: /delete (?:your|my) account/i })).toHaveCount(0);
  expect(events.filter((event) => ["prepare", "boundary", "account-delete", "user-delete"].includes(event))).toEqual([]);
  await assertNoLifecyclePersistence(page);
});

for (const statusMode of ["delayed", "error"] as const) {
  test(`unresolved ${statusMode} lifecycle authority fails closed before any destructive control`, async ({ context, page }) => {
    const events: string[] = [];
    await mockSettings(context, {
      operationId: "delete-operation-durable", status: "pending_deletion", phase: "prepared", state: "completed",
      boundaryCrossed: false, retryable: false, deadLetter: false,
    }, events, { statusMode });
    await page.goto("/settings");
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: /delete (?:your|my) account/i })).toHaveCount(0);
    expect(events.filter((event) => ["prepare", "boundary", "account-delete", "user-delete"].includes(event))).toEqual([]);
  });
}
