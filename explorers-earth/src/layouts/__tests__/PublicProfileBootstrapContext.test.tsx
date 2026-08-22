import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryResult, useQuerySpy } = vi.hoisted(() => ({
  queryResult: {
    data: undefined as Record<string, unknown> | undefined,
    loading: true,
    error: undefined as Error | undefined,
    refetch: vi.fn<() => Promise<unknown>>(),
  },
  useQuerySpy: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => {
      useQuerySpy(...args);
      return queryResult;
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
});
