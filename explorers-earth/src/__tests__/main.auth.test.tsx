import { beforeAll, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  render: vi.fn(),
  transport: { request: vi.fn() },
  capabilities: {
    publicRead: "public-read-capability",
    analyticsWrite: "analytics-write-capability",
  },
  createApolloTransport: vi.fn(),
  resolveBrowserApolloCapabilities: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({ render: harness.render })),
}));

vi.mock("../lib/apolloTransport", () => ({
  createApolloTransport: harness.createApolloTransport.mockReturnValue(harness.transport),
  resolveBrowserApolloCapabilities: harness.resolveBrowserApolloCapabilities.mockReturnValue(harness.capabilities),
}));

vi.mock("@apollo/client", () => ({
  ApolloClient: vi.fn(),
  ApolloProvider: ({ children }: { children: React.ReactNode }) => children,
  InMemoryCache: vi.fn(),
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

describe("main Apollo transport", () => {
  beforeAll(async () => {
    await import("../main.tsx");
  });

  it("constructs the application client with the shared operation-aware transport", async () => {
    const { ApolloClient } = await import("@apollo/client");
    expect(harness.resolveBrowserApolloCapabilities).toHaveBeenCalledWith(import.meta.env);
    expect(harness.createApolloTransport).toHaveBeenCalledWith({
      uri: import.meta.env.VITE_API_URL,
      getSessionToken: expect.any(Function),
      capabilities: harness.capabilities,
    });
    expect(ApolloClient).toHaveBeenCalledWith(expect.objectContaining({
      link: harness.transport,
    }));
  });

  it("reads the current session token lazily", () => {
    localStorage.clear();
    localStorage.setItem("qrtoken", "session-token");
    const [{ getSessionToken }] = harness.createApolloTransport.mock.calls[0];

    expect(getSessionToken()).toBe("session-token");
  });
});
