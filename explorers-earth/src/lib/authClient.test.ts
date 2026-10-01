import { beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../store/store";
import { authClient } from "./authClient";

describe("verified browser session", () => {
  beforeEach(() => { useAuthStore.getState().logout(); vi.restoreAllMocks(); });

  it("loads a Better Auth session and canonical account before exposing owner access", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      calls.push(input);
      if (input === "/api/auth/get-session") return new Response(JSON.stringify({ user: { id: "user-a", email: "a@example.invalid" }, session: { id: "session-a" } }), { status: 200 });
      return new Response(JSON.stringify({ account: { id: "account-a", handle: "alice", onboardingStatus: "complete", revision: 1 } }), { status: 200 });
    }));
    await authClient.refresh();
    expect(calls).toEqual(["/api/auth/get-session", "/api/explorers/v1/me"]);
    expect(useAuthStore.getState()).toMatchObject({ status: "active-complete", isAuthenticated: true, accountId: "account-a", token: null });
    expect(localStorage.getItem("qrtoken")).toBeNull();
  });

  it("ignores a response from a previous session generation", async () => {
    let release!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const pending = authClient.refresh();
    useAuthStore.getState().logout();
    release(new Response(JSON.stringify({ user: { id: "user-a" }, session: { id: "old" } }), { status: 200 }));
    await pending;
    expect(useAuthStore.getState().status).toBe("signed-out");
  });

  it("does not treat a provider outage as sign-out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await authClient.refresh();
    expect(useAuthStore.getState().status).toBe("error");
  });
});
