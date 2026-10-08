import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../components/SEO", () => ({ default: () => null }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const ACCOUNT = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

/** Serve one observation from /status and record what the page then does. */
async function confirmWith(recovery: unknown) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    requests.push(input);
    return input.endsWith("/status")
      ? new Response(JSON.stringify({ recovery }), { status: 200 })
      : new Response(JSON.stringify({ lifecycle: { status: "active", revision: 8 } }), { status: 200 });
  }));
  const { default: Page } = await import("../ReactivateConfirm");
  render(<MemoryRouter><Page /></MemoryRouter>);
  return requests;
}

it("starts Google recovery without collecting an email address", async () => {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    requests.push(input);
    return input.endsWith("/start") ? new Response(null, { status: 204 })
      : new Response(JSON.stringify({ url: "https://accounts.google.com/example" }), { status: 200 });
  }));
  const { default: Page } = await import("../ReactivateAccount");
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Google/i }));
  await waitFor(() => expect(requests).toEqual(["/api/explorers/v1/recovery/start", "/api/auth/sign-in/social"]));
});

it("ignores a legacy URL token and requires the cookie proof before submitting revision-bound recovery", async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    requests.push({ url: input, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return input.endsWith("/status")
      ? new Response(JSON.stringify({ recovery: { outcome: "pending", accountId: ACCOUNT, status: "suspended",
        revision: 7, operationId: null, kind: "deactivate" } }), { status: 200 })
      : new Response(JSON.stringify({ lifecycle: { status: "active", revision: 8 } }), { status: 200 });
  }));
  const { default: Page } = await import("../ReactivateConfirm");
  render(<MemoryRouter initialEntries={["/reactivate-confirm?token=untrusted"]}><Page /></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("button", { name: /reactivate/i })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /reactivate/i }));
  await waitFor(() => expect(requests).toEqual([
    { url: "/api/explorers/v1/recovery/status", method: "GET" },
    { url: "/api/explorers/v1/recovery/complete", method: "POST", body: { expectedRevision: 7 } },
  ]));
});

// Ticket 2.4 package L0. Each outcome is its own state. Before this the page decided from
// the raw status and showed "This account cannot be recovered." for all of them - which
// was wrong, not merely terse, for the first case below.

it("tells an owner whose success response was lost that the account is already active", async () => {
  await confirmWith({ outcome: "recovered", accountId: ACCOUNT, status: "active", revision: 8, operationId: null });
  await waitFor(() => expect(screen.getByText(/already active/i)).toBeInTheDocument());
  // Same destination as a fresh success - a new session - and no claim that recovery failed.
  expect(screen.getByRole("button", { name: /Sign in with Google/i })).toBeInTheDocument();
  expect(screen.queryByText(/cannot be recovered/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /Reactivate account/i })).toBeNull();
});

it("offers no retry for a deleted account, because no retry can succeed", async () => {
  await confirmWith({ outcome: "terminal", accountId: ACCOUNT, status: "deleted", revision: 9, operationId: null });
  await waitFor(() => expect(screen.getByText(/was deleted/i)).toBeInTheDocument());
  expect(screen.getByRole("alert")).toHaveTextContent(/permanent/i);
  // The retry affordance is the defect: it invited an owner to repeat something impossible.
  expect(screen.queryByRole("button", { name: /Try Google recovery again/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /Reactivate account/i })).toBeNull();
});

it("gives a quotable reference and no action when a transition needs a person", async () => {
  await confirmWith({ outcome: "manual_review", accountId: ACCOUNT, status: "pending_deletion", revision: 9,
    operationId: "11111111-2222-4333-8444-555555555555", reason: "operation_failed", failureCode: "music_release_timeout" });
  await waitFor(() => expect(screen.getByText(/needs a person/i)).toBeInTheDocument());
  expect(screen.getByText(/11111111-2222-4333-8444-555555555555/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Reactivate account/i })).toBeNull();
  // An internal failure code is for support to match, not for the owner to read as prose.
  expect(screen.queryByText(/music_release_timeout/)).toBeNull();
});

it("treats an indeterminate observation as retryable rather than as a refusal", async () => {
  await confirmWith({ outcome: "unknown" });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i));
  expect(screen.getByRole("button", { name: /Try Google recovery again/i })).toBeInTheDocument();
  expect(screen.queryByText(/cannot be recovered/i)).toBeNull();
});

it("does not act on an observation shape it does not understand", async () => {
  // A future outcome, or a tampered body, is indeterminate - never an implied success.
  const requests = await confirmWith({ outcome: "definitely_fine", accountId: ACCOUNT, revision: 7 });
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i));
  expect(requests).toEqual(["/api/explorers/v1/recovery/status"]);
  expect(screen.queryByRole("button", { name: /Reactivate account/i })).toBeNull();
});
