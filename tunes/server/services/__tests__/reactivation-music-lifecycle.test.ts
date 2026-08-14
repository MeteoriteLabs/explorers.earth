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
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") {
        events.push("strapi-unblock");
        return new Response("{}", { status: putSucceeds ? 200 : 503 });
      }
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
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response("{}", { status: 200 });
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
});
