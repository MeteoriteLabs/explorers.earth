import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it("submits reactivation email through the Music proxy", async () => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_LOCAL_TUNES_API_URL", "https://music.localhost");
  const requests: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: 200 });
  });
  const { default: Page } = await import("../ReactivateAccount");
  render(<MemoryRouter><Page /></MemoryRouter>);
  await act(async () => { fireEvent.change(screen.getByRole("textbox"), { target: { value: "test@example.com" } }); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "reactivateAccount.sendButton" })); });
  await waitFor(() => expect(requests).toEqual([{ url: "/__localtunes/api/user/request-reactivation", body: { email: "test@example.com" } }]));
});

it("confirms the reactivation link through the same proxy", async () => {
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_LOCAL_TUNES_API_URL", "https://music.localhost");
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    requests.push(String(input)); return new Response('{"success":true}', { status: 200 });
  });
  const { default: Page } = await import("../ReactivateConfirm");
  render(<MemoryRouter initialEntries={["/reactivate-confirm?token=test-only-token"]}><Page /></MemoryRouter>);
  await waitFor(() => expect(requests).toEqual(["/__localtunes/api/user/reactivate?token=test-only-token"]));
});
