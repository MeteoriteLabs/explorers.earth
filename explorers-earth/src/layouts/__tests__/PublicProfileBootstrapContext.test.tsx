import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryResult, queryResultsByUsername, useQuerySpy } = vi.hoisted(() => ({
  queryResult: {
    data: undefined as Record<string, unknown> | undefined,
    loading: true,
    error: undefined as Error | undefined,
    refetch: vi.fn<() => Promise<unknown>>(),
  },
  queryResultsByUsername: new Map<string, {
    data: Record<string, unknown> | undefined;
    loading: boolean;
    error: Error | undefined;
    refetch: ReturnType<typeof vi.fn>;
  }>(),
  useQuerySpy: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: (...args: any[]) => {
      useQuerySpy(...args);
      const key = args[1]?.variables?.filters?.username?.eq;
      return queryResultsByUsername.get(key) ?? queryResult;
    },
  };
});

import {
  PublicProfileBootstrapProvider,
  usePublicProfileBootstrap,
} from "../PublicProfileBootstrapContext";

function CaptureBootstrap({ label }: { label: string }) {
  const bootstrap = usePublicProfileBootstrap();
  return (
    <section aria-label={label}>
      <span data-testid={`${label}-key`}>{bootstrap.bootstrapKey}</span>
      <span data-testid={`${label}-status`}>{bootstrap.status}</span>
      {bootstrap.status === "ready" && (
        <span data-testid={`${label}-account`}>{bootstrap.account.Account_Name}</span>
      )}
      {bootstrap.status === "error" && (
        <button type="button" disabled={bootstrap.retrying} onClick={() => void bootstrap.retry()}>
          {bootstrap.retrying ? "Retrying" : "Retry"}
        </button>
      )}
    </section>
  );
}

function BootstrapRoute({ children }: { children: ReactNode }) {
  return <PublicProfileBootstrapProvider>{children}</PublicProfileBootstrapProvider>;
}

function NavigationControls() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/Alice")}>Visit Alice</button>
      <button type="button" onClick={() => navigate("/Bob")}>Visit Bob</button>
    </>
  );
}

function renderBootstrap(path = "/Alice") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:username"
          element={
            <BootstrapRoute>
              <CaptureBootstrap label="first" />
              <CaptureBootstrap label="second" />
              <NavigationControls />
            </BootstrapRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicProfileBootstrapContext", () => {
  beforeEach(() => {
    queryResult.data = undefined;
    queryResult.loading = true;
    queryResult.error = undefined;
    queryResult.refetch = vi.fn().mockResolvedValue(undefined);
    queryResultsByUsername.clear();
    useQuerySpy.mockClear();
  });

  it("normalizes the username and owns one bootstrap operation for every consumer", () => {
    queryResult.data = {
      accounts: [
        {
          documentId: "account-1",
          Account_Name: "Alice",
          public_profile: "Yes",
          public_apps: "Yes",
          social_media: { theme_settings: { preset: "cinematic-dark" } },
        },
      ],
    };
    queryResult.loading = false;

    renderBootstrap("/Alice");

    expect(screen.getByTestId("first-key")).toHaveTextContent("alice");
    expect(screen.getByTestId("second-status")).toHaveTextContent("ready");
    expect(screen.getByTestId("first-account")).toHaveTextContent("Alice");
    expect(useQuerySpy).toHaveBeenCalledTimes(1);
    expect(useQuerySpy.mock.calls[0]?.[1]).toMatchObject({
      variables: { filters: { username: { eq: "alice" } } },
      fetchPolicy: "cache-and-network",
    });
  });

  it("classifies a settled empty account response as not found", () => {
    queryResult.data = { accounts: [] };
    queryResult.loading = false;

    renderBootstrap();

    expect(screen.getByTestId("first-status")).toHaveTextContent("not-found");
  });

  it("classifies an initial query failure without treating it as not found", () => {
    queryResult.loading = false;
    queryResult.error = new Error("Forbidden");

    renderBootstrap();

    expect(screen.getByTestId("first-status")).toHaveTextContent("error");
    expect(screen.queryByText("not-found")).not.toBeInTheDocument();
  });

  it("runs one bootstrap retry at a time", async () => {
    let resolveRetry: (() => void) | undefined;
    queryResult.loading = false;
    queryResult.error = new Error("offline");
    queryResult.refetch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    renderBootstrap();

    const firstConsumer = screen.getByRole("region", { name: "first" });
    const retry = within(firstConsumer).getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    fireEvent.click(retry);

    expect(queryResult.refetch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(within(firstConsumer).getByRole("button", { name: "Retrying" })).toBeDisabled(),
    );

    await act(async () => resolveRetry?.());

    await waitFor(() =>
      expect(within(firstConsumer).getByRole("button", { name: "Retry" })).toBeEnabled(),
    );
  });

  it("keys retry ownership to the mounted-router username and ignores an old completion", async () => {
    let resolveAlice: (() => void) | undefined;
    let resolveBob: (() => void) | undefined;
    const aliceRefetch = vi.fn(
      () => new Promise<void>((resolve) => { resolveAlice = resolve; }),
    );
    const bobRefetch = vi.fn(
      () => new Promise<void>((resolve) => { resolveBob = resolve; }),
    );
    queryResultsByUsername.set("alice", {
      data: undefined,
      loading: false,
      error: new Error("Alice offline"),
      refetch: aliceRefetch,
    });
    queryResultsByUsername.set("bob", {
      data: undefined,
      loading: false,
      error: new Error("Bob offline"),
      refetch: bobRefetch,
    });

    renderBootstrap("/Alice");
    const firstConsumer = screen.getByRole("region", { name: "first" });
    fireEvent.click(within(firstConsumer).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(aliceRefetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Visit Bob" }));

    await waitFor(() => expect(screen.getByTestId("first-key")).toHaveTextContent("bob"));
    const bobRetry = within(firstConsumer).getByRole("button", { name: "Retry" });
    expect(bobRetry).toBeEnabled();
    fireEvent.click(bobRetry);
    await waitFor(() => expect(bobRefetch).toHaveBeenCalledTimes(1));

    await act(async () => resolveAlice?.());
    expect(within(firstConsumer).getByRole("button", { name: "Retrying" })).toBeDisabled();

    await act(async () => resolveBob?.());
    await waitFor(() =>
      expect(within(firstConsumer).getByRole("button", { name: "Retry" })).toBeEnabled(),
    );
  });

  it("keeps a newer Alice retry owned when Alice A1 resolves after Alice to Bob to Alice navigation", async () => {
    const resolveAlice: Array<() => void> = [];
    let resolveBob: (() => void) | undefined;
    const aliceRefetch = vi.fn(
      () => new Promise<void>((resolve) => { resolveAlice.push(resolve); }),
    );
    const bobRefetch = vi.fn(
      () => new Promise<void>((resolve) => { resolveBob = resolve; }),
    );
    queryResultsByUsername.set("alice", {
      data: undefined,
      loading: false,
      error: new Error("Alice offline"),
      refetch: aliceRefetch,
    });
    queryResultsByUsername.set("bob", {
      data: undefined,
      loading: false,
      error: new Error("Bob offline"),
      refetch: bobRefetch,
    });

    renderBootstrap("/Alice");
    const firstConsumer = screen.getByRole("region", { name: "first" });
    fireEvent.click(within(firstConsumer).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(aliceRefetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Visit Bob" }));
    await waitFor(() => expect(screen.getByTestId("first-key")).toHaveTextContent("bob"));
    fireEvent.click(within(firstConsumer).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(bobRefetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Visit Alice" }));
    await waitFor(() => expect(screen.getByTestId("first-key")).toHaveTextContent("alice"));
    fireEvent.click(within(firstConsumer).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(aliceRefetch).toHaveBeenCalledTimes(2));
    expect(within(firstConsumer).getByRole("button", { name: "Retrying" })).toBeDisabled();

    await act(async () => resolveAlice[0]?.());

    const aliceA2 = within(firstConsumer).getByRole("button", { name: "Retrying" });
    expect(aliceA2).toBeDisabled();
    fireEvent.click(aliceA2);
    expect(aliceRefetch).toHaveBeenCalledTimes(2);

    await act(async () => resolveAlice[1]?.());
    await waitFor(() =>
      expect(within(firstConsumer).getByRole("button", { name: "Retry" })).toBeEnabled(),
    );
    await act(async () => resolveBob?.());
  });
});
