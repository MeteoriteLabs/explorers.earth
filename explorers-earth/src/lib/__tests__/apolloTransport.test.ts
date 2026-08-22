import {
  ApolloClient,
  InMemoryCache,
  type NormalizedCacheObject,
  type Operation,
  gql,
} from "@apollo/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOperationAST } from "graphql";
import {
  forgotPasswordMutation,
  loginQuery,
  registerQuery,
  resetPasswordMutation,
} from "../../features/Authentication/api/mutation";
import { CHECK_USERNAME_AVAILABILITY } from "../../utils/usernameAPI";
import {
  classifyApolloOperation,
  createApolloTransport,
  resolveBrowserApolloCapabilities,
  selectAuthorization,
} from "../apolloTransport";

const PUBLIC_QUERY = gql`
  query PublicAppData {
    publicApps {
      documentId
    }
  }
`;

const SECOND_PUBLIC_QUERY = gql`
  query PublicProductData {
    publicProducts {
      documentId
    }
  }
`;

const LOGIN_MUTATION = gql`
  mutation login($input: LoginInput!) {
    login(input: $input) {
      jwt
    }
  }
`;

const ANALYTICS_MUTATION = gql`
  mutation CreatePublicPageAnalytic($data: PublicPageAnalyticInput!) {
    createPublicPageAnalytic(data: $data) {
      documentId
    }
  }
`;

const ARBITRARY_MUTATION = gql`
  mutation UpdateAccount($data: AccountInput!) {
    updateAccount(data: $data) {
      documentId
    }
  }
`;

function operation(operationName: string, query: Operation["query"]): Operation {
  return { operationName, query } as Operation;
}

function response(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  const body = JSON.parse(String(init?.body)) as { operationName: string };
  const headers = new Headers(init?.headers);
  return {
    input: String(input),
    operationName: body.operationName,
    authorization: headers.get("authorization") ?? undefined,
  };
}

function client(options: {
  getSessionToken?: () => string | null;
  publicRead?: string;
  analyticsWrite?: string;
}): ApolloClient<NormalizedCacheObject> {
  return new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: {
      query: { fetchPolicy: "no-cache" },
      mutate: { fetchPolicy: "no-cache" },
    },
    link: createApolloTransport({
      uri: "https://api.example.test/graphql",
      getSessionToken: options.getSessionToken ?? (() => null),
      capabilities: {
        publicRead: options.publicRead,
        analyticsWrite: options.analyticsWrite,
      },
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyApolloOperation", () => {
  it.each([
    { operationName: "login", query: LOGIN_MUTATION, expected: "auth" },
    { operationName: "register", query: gql`mutation register { register(input: {}) { jwt } }`, expected: "auth" },
    { operationName: "forgotPassword", query: gql`mutation forgotPassword { forgotPassword(email: "qa@example.test") { ok } }`, expected: "auth" },
    { operationName: "resetPassword", query: gql`mutation resetPassword { resetPassword(password: "x", passwordConfirmation: "x", code: "x") { jwt } }`, expected: "auth" },
    { operationName: "CheckUsernameAvailability", query: gql`query CheckUsernameAvailability { accounts { documentId } }`, expected: "auth" },
    { operationName: "PublicAppData", query: PUBLIC_QUERY, expected: "public-read" },
    { operationName: "CreatePublicPageAnalytic", query: ANALYTICS_MUTATION, expected: "analytics-write" },
    { operationName: "UpdateAccount", query: ARBITRARY_MUTATION, expected: "session-only" },
    { operationName: "CreateAnalyticsLookalike", query: gql`mutation CreateAnalyticsLookalike { updateAccount(data: {}) { documentId } }`, expected: "session-only" },
    { operationName: "CreatePublicPageAnalytic", query: gql`mutation CreatePublicPageAnalytic { updateAccount(data: {}) { documentId } }`, expected: "session-only" },
  ] as const)("classifies $operationName as $expected", ({ operationName, query, expected }) => {
    expect(classifyApolloOperation(operation(operationName, query))).toBe(expected);
  });

  it.each([
    ["login", loginQuery],
    ["register", registerQuery],
    ["forgotPassword", forgotPasswordMutation],
    ["resetPassword", resetPasswordMutation],
    ["CheckUsernameAvailability", CHECK_USERNAME_AVAILABILITY],
  ] as const)("classifies the shipped %s document through the exact auth contract", (_name, document) => {
    const operationName = getOperationAST(document)?.name?.value;

    expect(operationName).toBeDefined();
    expect(classifyApolloOperation(operation(operationName!, document))).toBe("auth");
  });

  it.each([
    {
      caseName: "wrong operation kind",
      query: gql`query login { login { jwt } }`,
    },
    {
      caseName: "wrong root field",
      query: gql`mutation login { updateAccount(data: {}) { documentId } }`,
    },
    {
      caseName: "multiple direct root fields",
      query: gql`mutation login { login(input: {}) { jwt } updateAccount(data: {}) { documentId } }`,
    },
    {
      caseName: "hidden named-fragment root",
      query: gql`
        mutation login { login(input: {}) { jwt } ...HiddenAuthRoot }
        fragment HiddenAuthRoot on Mutation { updateAccount(data: {}) { documentId } }
      `,
    },
    {
      caseName: "hidden inline-fragment root",
      query: gql`
        mutation login { login(input: {}) { jwt } ... on Mutation { updateAccount(data: {}) { documentId } } }
      `,
    },
    {
      caseName: "operation-name mismatch",
      query: gql`mutation register { register(input: {}) { jwt } }`,
    },
    {
      caseName: "duplicate selected operation names",
      query: gql`
        mutation login { login(input: {}) { jwt } }
        mutation login { login(input: {}) { jwt } }
      `,
    },
  ])("fails the auth contract closed for $caseName", ({ query }) => {
    expect(classifyApolloOperation(operation("login", query))).toBe("session-only");
  });

  it("allows an alias only when the underlying auth root field matches", () => {
    const aliasedLogin = gql`
      mutation login { authenticate: login(input: {}) { jwt } }
    `;

    expect(classifyApolloOperation(operation("login", aliasedLogin))).toBe("auth");
  });

  it.each([
    {
      caseName: "mixed direct roots",
      query: gql`
        mutation CreatePublicPageAnalytic {
          createPublicPageAnalytic(data: {}) { documentId }
          updateAccount(data: {}) { documentId }
        }
      `,
    },
    {
      caseName: "named fragment hiding an arbitrary mutation",
      query: gql`
        mutation CreatePublicPageAnalytic {
          createPublicPageAnalytic(data: {}) { documentId }
          ...HiddenAnalyticsRoot
        }
        fragment HiddenAnalyticsRoot on Mutation { updateAccount(data: {}) { documentId } }
      `,
    },
    {
      caseName: "inline fragment hiding an arbitrary mutation",
      query: gql`
        mutation CreatePublicPageAnalytic {
          createPublicPageAnalytic(data: {}) { documentId }
          ... on Mutation { updateAccount(data: {}) { documentId } }
        }
      `,
    },
    {
      caseName: "approved root supplied only through a named fragment",
      query: gql`
        mutation CreatePublicPageAnalytic { ...AnalyticsRoot }
        fragment AnalyticsRoot on Mutation { createPublicPageAnalytic(data: {}) { documentId } }
      `,
    },
    {
      caseName: "missing fragment",
      query: gql`mutation CreatePublicPageAnalytic { ...MissingAnalyticsRoot }`,
    },
    {
      caseName: "fragment cycle",
      query: gql`
        mutation CreatePublicPageAnalytic { ...AnalyticsRootA }
        fragment AnalyticsRootA on Mutation { ...AnalyticsRootB }
        fragment AnalyticsRootB on Mutation { ...AnalyticsRootA }
      `,
    },
  ])("fails the analytics contract closed for $caseName", ({ query }) => {
    expect(classifyApolloOperation(operation("CreatePublicPageAnalytic", query)))
      .toBe("session-only");
  });

  it("allows an alias only when the underlying analytics root field matches", () => {
    const aliasedAnalytics = gql`
      mutation CreatePublicPageAnalytic {
        record: createPublicPageAnalytic(data: {}) { documentId }
      }
    `;

    expect(classifyApolloOperation(operation("CreatePublicPageAnalytic", aliasedAnalytics)))
      .toBe("analytics-write");
  });

  it("classifies anonymous and subscription documents without assuming a named query", () => {
    expect(classifyApolloOperation({ query: gql`query { publicApps { documentId } }` }))
      .toBe("public-read");
    expect(classifyApolloOperation({ query: gql`subscription { publicApps { documentId } }` }))
      .toBe("session-only");
  });
});

describe("selectAuthorization", () => {
  const capabilities = {
    publicRead: "public-read-capability",
    analyticsWrite: "analytics-write-capability",
  };

  it.each([
    ["auth", "session-token", undefined],
    ["session-only", "session-token", "Bearer session-token"],
    ["session-only", undefined, undefined],
    ["public-read", "session-token", "Bearer session-token"],
    ["public-read", undefined, "Bearer public-read-capability"],
    ["analytics-write", "session-token", "Bearer session-token"],
    ["analytics-write", undefined, "Bearer analytics-write-capability"],
  ] as const)(
    "selects the %s credential with session %s",
    (capability, sessionToken, expected) => {
      expect(selectAuthorization({ capability, sessionToken, capabilities })).toBe(expected);
    },
  );

  it("keeps the deprecated shared capability local-only", () => {
    expect(resolveBrowserApolloCapabilities({
      DEV: true,
      VITE_PUBLIC_ACCESS_TOKEN: "legacy-local-capability",
    })).toEqual({
      publicRead: "legacy-local-capability",
      analyticsWrite: "legacy-local-capability",
    });

    expect(resolveBrowserApolloCapabilities({
      DEV: false,
      VITE_PUBLIC_ACCESS_TOKEN: "legacy-release-capability",
    })).toEqual({ publicRead: undefined, analyticsWrite: undefined });
  });

  it("prefers distinct dedicated capabilities over the local legacy input", () => {
    expect(resolveBrowserApolloCapabilities({
      DEV: true,
      VITE_PUBLIC_READ_ACCESS_TOKEN: "read-only",
      VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "write-only",
      VITE_PUBLIC_ACCESS_TOKEN: "legacy-local",
    })).toEqual({ publicRead: "read-only", analyticsWrite: "write-only" });
  });

  it("keeps an anonymous public read anonymous when no capability exists", () => {
    expect(selectAuthorization({
      capability: "public-read",
      capabilities: {},
    })).toBeUndefined();
  });
});

describe("createApolloTransport", () => {
  it("sends no browser capability on authentication or arbitrary mutations", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestDetails(input, init);
      requests.push(request);
      return response({
        data: request.operationName === "login"
          ? { login: { jwt: "jwt" } }
          : { updateAccount: { documentId: "account-1" } },
      });
    }));

    const transportClient = client({
      publicRead: "read-only",
      analyticsWrite: "write-only",
    });

    await transportClient.mutate({ mutation: LOGIN_MUTATION, variables: { input: {} } });
    await transportClient.mutate({ mutation: ARBITRARY_MUTATION, variables: { data: {} } });

    expect(requests.map(({ operationName, authorization }) => ({ operationName, authorization }))).toEqual([
      { operationName: "login", authorization: undefined },
      { operationName: "UpdateAccount", authorization: undefined },
    ]);
  });

  it("uses the session before public-read and analytics-write capabilities", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestDetails(input, init);
      requests.push(request);
      return response({
        data: request.operationName === "PublicAppData"
          ? { publicApps: [] }
          : { createPublicPageAnalytic: { documentId: "event-1" } },
      });
    }));

    const transportClient = client({
      getSessionToken: () => "session-token",
      publicRead: "read-only",
      analyticsWrite: "write-only",
    });

    await transportClient.query({ query: PUBLIC_QUERY });
    await transportClient.mutate({ mutation: ANALYTICS_MUTATION, variables: { data: {} } });

    expect(requests.map(({ authorization }) => authorization)).toEqual([
      "Bearer session-token",
      "Bearer session-token",
    ]);
  });

  it("uses distinct public-read and analytics-write capabilities for guests", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestDetails(input, init);
      requests.push(request);
      return response({
        data: request.operationName === "PublicAppData"
          ? { publicApps: [] }
          : { createPublicPageAnalytic: { documentId: "event-1" } },
      });
    }));

    const transportClient = client({ publicRead: "read-only", analyticsWrite: "write-only" });
    await transportClient.query({ query: PUBLIC_QUERY });
    await transportClient.mutate({ mutation: ANALYTICS_MUTATION, variables: { data: {} } });

    expect(requests.map(({ authorization }) => authorization)).toEqual([
      "Bearer read-only",
      "Bearer write-only",
    ]);
  });

  it("retries one public-capability 401 anonymously", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestDetails(input, init);
      requests.push(request);
      return requests.length === 1
        ? response({ errors: [{ message: "Unauthorized" }] }, 401)
        : response({ data: { publicApps: [{ documentId: "app-1" }] } });
    }));

    const result = await client({ publicRead: "expired-read-only" }).query({ query: PUBLIC_QUERY });

    expect(result.data.publicApps).toEqual([{ documentId: "app-1" }]);
    expect(requests.map(({ authorization }) => authorization)).toEqual([
      "Bearer expired-read-only",
      undefined,
    ]);
  });

  it("stops after the one anonymous retry also receives a 401", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(requestDetails(input, init));
      return response({ errors: [{ message: "Unauthorized" }] }, 401);
    }));

    await expect(client({ publicRead: "expired-read-only" }).query({ query: PUBLIC_QUERY }))
      .rejects.toThrow();
    expect(requests.map(({ authorization }) => authorization)).toEqual([
      "Bearer expired-read-only",
      undefined,
    ]);
  });

  it.each([
    ["session public read", () => client({ getSessionToken: () => "session-token", publicRead: "read-only" }).query({ query: PUBLIC_QUERY })],
    ["analytics write", () => client({ analyticsWrite: "write-only" }).mutate({ mutation: ANALYTICS_MUTATION, variables: { data: {} } })],
  ] as const)("does not downgrade a failed %s request", async (_name, run) => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(requestDetails(input, init));
      return response({ errors: [{ message: "Unauthorized" }] }, 401);
    }));

    await expect(run()).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it("does not mistake an equal-valued session token for the public-read capability", async () => {
    const requests: ReturnType<typeof requestDetails>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(requestDetails(input, init));
      return response({ errors: [{ message: "Unauthorized" }] }, 401);
    }));

    await expect(client({
      getSessionToken: () => "same-token-value",
      publicRead: "same-token-value",
    }).query({ query: PUBLIC_QUERY })).rejects.toThrow();

    expect(requests).toHaveLength(1);
  });

  it("does not share anonymous retry state between concurrent public reads", async () => {
    const requests = new Map<string, Array<string | undefined>>();
    let releaseFirstAnonymousRetry!: (value: Response) => void;
    const firstAnonymousRetry = new Promise<Response>((resolve) => {
      releaseFirstAnonymousRetry = resolve;
    });

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = requestDetails(input, init);
      const authorizations = requests.get(request.operationName) ?? [];
      authorizations.push(request.authorization);
      requests.set(request.operationName, authorizations);

      if (request.operationName === "PublicAppData" && authorizations.length === 1) {
        return response({ errors: [{ message: "Unauthorized" }] }, 401);
      }
      if (request.operationName === "PublicAppData") return firstAnonymousRetry;
      return response({ data: { publicProducts: [] } });
    }));

    const transportClient = client({ publicRead: "read-only" });
    const first = transportClient.query({ query: PUBLIC_QUERY });

    await vi.waitFor(() => {
      expect(requests.get("PublicAppData")).toEqual(["Bearer read-only", undefined]);
    });

    const second = transportClient.query({ query: SECOND_PUBLIC_QUERY });
    await expect(second).resolves.toMatchObject({ data: { publicProducts: [] } });
    expect(requests.get("PublicProductData")).toEqual(["Bearer read-only"]);

    releaseFirstAnonymousRetry(response({ data: { publicApps: [] } }));
    await expect(first).resolves.toMatchObject({ data: { publicApps: [] } });
  });

  it("preserves a GraphQL Forbidden response as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      errors: [{ message: "Forbidden access" }],
      data: { publicApps: null },
    })));

    await expect(client({ publicRead: "read-only" }).query({ query: PUBLIC_QUERY }))
      .rejects.toThrow("Forbidden access");
  });
});
