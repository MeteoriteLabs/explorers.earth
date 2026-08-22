import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  contextCallback: undefined as
    | ((
        operation: { operationName?: string },
        context: { headers?: Record<string, string> },
      ) => { headers: Record<string, string> })
    | undefined,
  errorCallback: undefined as ((input: any) => unknown) | undefined,
  render: vi.fn(),
}));

const { mockLink } = vi.hoisted(() => {
  const link = { concat: vi.fn() } as { concat: ReturnType<typeof vi.fn> };
  link.concat.mockReturnValue(link);
  return { mockLink: link };
});

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render: harness.render })),
}));

vi.mock("@apollo/client/link/context", () => ({
  setContext: vi.fn((callback) => {
    harness.contextCallback = callback;
    return mockLink;
  }),
}));

vi.mock("@apollo/client/link/error", () => ({
  onError: vi.fn((callback) => {
    harness.errorCallback = callback;
    return mockLink;
  }),
}));

vi.mock("@apollo/client", () => ({
  ApolloClient: vi.fn(),
  ApolloProvider: ({ children }: { children: React.ReactNode }) => children,
  InMemoryCache: vi.fn(),
  createHttpLink: vi.fn(() => ({})),
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("react-helmet-async", () => ({
  HelmetProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("sonner", () => ({ Toaster: () => null }));
vi.mock("../App.tsx", () => ({ default: () => null }));
vi.mock("../components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../lib/apolloCache", () => ({ typePolicies: {} }));
vi.mock("../lib/queryClient", () => ({ queryClient: {} }));
vi.mock("../utils/analytics", () => ({ initAnalytics: vi.fn() }));

describe("Apollo authorization headers", () => {
  beforeAll(async () => {
    await import("../main.tsx");
  });

  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_PUBLIC_ACCESS_TOKEN", "public-access-token");
  });

  it("uses the configured public credential when a visitor has no session token", () => {
    const result = harness.contextCallback!(
      { operationName: "CheckUsername" },
      { headers: { accept: "application/json" } },
    );

    expect(result.headers).toEqual({
      accept: "application/json",
      authorization: "Bearer public-access-token",
    });
  });

  it("omits authorization for authentication operations", () => {
    const result = harness.contextCallback!(
      { operationName: "login" },
      { headers: { accept: "application/json" } },
    );

    expect(result.headers).toEqual({ accept: "application/json" });
  });

  it("retries an invalid public credential once without authorization", () => {
    let context: Record<string, any> = {
      headers: { authorization: "Bearer invalid-public-token", accept: "application/json" },
      usedPublicAccessToken: true,
    };
    const operation = {
      getContext: () => context,
      setContext: (next: Record<string, any>) => {
        context = { ...context, ...next };
      },
    };
    const retryResult = Symbol("retry-result");
    const forward = vi.fn(() => retryResult);

    const result = harness.errorCallback!({
      networkError: { statusCode: 401 },
      operation,
      forward,
    });

    expect(result).toBe(retryResult);
    expect(forward).toHaveBeenCalledWith(operation);
    expect(context.skipPublicAccessToken).toBe(true);
    expect(context.headers).toEqual({ accept: "application/json" });
  });

  it("forwards the authenticated visitor's session token", () => {
    localStorage.setItem("qrtoken", "session-token");

    const result = harness.contextCallback!(
      { operationName: "UpdateAccount" },
      { headers: { accept: "application/json" } },
    );

    expect(result.headers).toEqual({
      accept: "application/json",
      authorization: "Bearer session-token",
    });
  });
});
