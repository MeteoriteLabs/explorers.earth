import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  getAppUrl: vi.fn(),
  getEmailTemplateByName: vi.fn(),
}));

vi.mock("../email-service", () => ({ emailService: { sendEmail: mocks.sendEmail } }));
vi.mock("../system-settings-service", () => ({ systemSettingsService: { getAppUrl: mocks.getAppUrl } }));
vi.mock("../../storage", () => ({
  storage: {
    getEmailTemplateByName: mocks.getEmailTemplateByName,
    createEmailTemplate: vi.fn(),
  },
}));

import { confirmReactivation, requestReactivation } from "../reactivation-service";

const user = {
  id: 73,
  documentId: "reactivate-user-document",
  username: "reactivate-user",
  email: "reactivate@example.invalid",
  blocked: true,
  confirmed: true,
  accounts: [{ documentId: "reactivate-account-document" }],
};

function fetchToken(): string {
  const variables = mocks.sendEmail.mock.calls.at(-1)?.[2] as { verificationLink: string };
  return new URL(variables.verificationLink).searchParams.get("token")!;
}

describe("Explorer reactivation Music lifecycle composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRAPI_URL", "https://strapi.example.invalid");
    vi.stubEnv("STRAPI_ACCESS_TOKEN", "write-token-for-test");
    mocks.getAppUrl.mockResolvedValue("https://explorers.example.invalid");
    mocks.getEmailTemplateByName.mockResolvedValue({ id: 9 });
    mocks.sendEmail.mockResolvedValue({ success: true });
  });

  it("reactivates the immutable Music binding before unblocking Strapi and consumes the token only after both converge", async () => {
    const events: string[] = [];
    let putSucceeds = false;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") {
        events.push("strapi-unblock");
        return putSucceeds
          ? Response.json({ ...user, blocked: false })
          : new Response("{}", { status: 503 });
      }
      if (new URL(String(input)).pathname === `/api/users/${user.id}`) return Response.json(user);
      return Response.json([user]);
    }));
    await requestReactivation(user.email);
    const token = fetchToken();
    const inputs: unknown[] = [];
    const reactivateMusic = vi.fn(async (input: unknown) => {
      events.push("music-reactivate");
      inputs.push(input);
    });

    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    putSucceeds = true;
    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toEqual({ success: true });
    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });

    expect(events).toEqual(["music-reactivate", "strapi-unblock", "music-reactivate", "strapi-unblock"]);
    expect(inputs[0]).toEqual({
      userDocumentId: user.documentId,
      accountDocumentId: user.accounts[0].documentId,
      operationId: expect.any(String),
    });
    expect(inputs[1]).toEqual(inputs[0]);
  });

  it("keeps Strapi blocked and the token retryable while Music is unavailable", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") return Response.json({ ...user, blocked: false });
      if (new URL(String(input)).pathname === `/api/users/${user.id}`) return Response.json(user);
      return Response.json([user]);
    });
    vi.stubGlobal("fetch", fetchImpl);
    await requestReactivation(user.email);
    const token = fetchToken();
    const failedMusic = vi.fn(async () => { throw new Error("Music unavailable"); });

    await expect(confirmReactivation(token, { reactivateMusic: failedMusic })).resolves.toMatchObject({ success: false });
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);

    const recoveredMusic = vi.fn(async () => undefined);
    await expect(confirmReactivation(token, { reactivateMusic: recoveredMusic })).resolves.toEqual({ success: true });
    expect(recoveredMusic).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "an empty object", body: {} },
    { label: "a null body", body: null },
    { label: "a still-blocked user", body: user },
    { label: "a mismatched numeric user", body: { ...user, id: user.id + 1, blocked: false } },
    { label: "a mismatched immutable user", body: { ...user, documentId: "replacement-user-document", blocked: false } },
    { label: "a mismatched immutable Account", body: { ...user, blocked: false, accounts: [{ documentId: "replacement-account-document" }] } },
  ])("retains the token and exact Music operation when unblock returns 2xx with $label", async ({ body }) => {
    // Break caught: response.ok is mistaken for proof that the exact immutable Strapi tuple is unblocked.
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") return Response.json(body);
      if (new URL(String(input)).pathname === `/api/users/${user.id}`) return Response.json(user);
      return Response.json([user]);
    });
    vi.stubGlobal("fetch", fetchImpl);
    await requestReactivation(user.email);
    const token = fetchToken();
    const reactivateMusic = vi.fn(async () => undefined);

    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    expect(reactivateMusic).toHaveBeenCalledTimes(2);
    expect(reactivateMusic.mock.calls[1]).toEqual(reactivateMusic.mock.calls[0]);
  });

  it.each([
    { label: "replacement Account", current: { ...user, accounts: [{ documentId: "replacement-account-document" }] } },
    { label: "replacement user", current: { ...user, documentId: "replacement-user-document" } },
    { label: "missing Account", current: { ...user, accounts: [] } },
    { label: "multiple Accounts", current: { ...user, accounts: [user.accounts[0], { documentId: "extra-account-document" }] } },
  ])("fails closed before Music when current Strapi authority has a $label", async ({ current }) => {
    // Break caught: confirmation trusts the 24-hour token snapshot after Strapi identity replacement.
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      if (init?.method === "PUT") return new Response("{}", { status: 200 });
      if (pathname === `/api/users/${user.id}`) return Response.json(current);
      return Response.json([user]);
    });
    vi.stubGlobal("fetch", fetchImpl);
    await requestReactivation(user.email);
    const token = fetchToken();
    const reactivateMusic = vi.fn(async () => undefined);

    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    expect(reactivateMusic).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it.each([
    { label: "an authority outage", current: () => new Response("", { status: 503 }) },
    { label: "a malformed user", current: () => Response.json({ ...user, blocked: "false" }) },
    { label: "an unexpected collection", current: () => Response.json([user]) },
  ])("fails closed before Music when fresh Strapi proof has $label", async ({ current }) => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      if (init?.method === "PUT") return new Response("{}", { status: 200 });
      if (pathname === `/api/users/${user.id}`) return current();
      return Response.json([user]);
    });
    vi.stubGlobal("fetch", fetchImpl);
    await requestReactivation(user.email);
    const token = fetchToken();
    const reactivateMusic = vi.fn(async () => undefined);

    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    expect(reactivateMusic).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("converges a lost unblock response after fresh authority proves the exact tuple is already unblocked", async () => {
    let blocked = true;
    let unblockCalls = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      if (init?.method === "PUT") {
        unblockCalls += 1;
        blocked = false;
        return new Response("", { status: 503 });
      }
      if (pathname === `/api/users/${user.id}`) return Response.json({ ...user, blocked });
      return Response.json([user]);
    });
    vi.stubGlobal("fetch", fetchImpl);
    await requestReactivation(user.email);
    const token = fetchToken();
    const reactivateMusic = vi.fn(async () => undefined);

    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toMatchObject({ success: false });
    await expect(confirmReactivation(token, { reactivateMusic })).resolves.toEqual({ success: true });
    expect(unblockCalls).toBe(1);
    expect(reactivateMusic).toHaveBeenCalledTimes(2);
    expect(reactivateMusic.mock.calls[1]).toEqual(reactivateMusic.mock.calls[0]);
  });
});
