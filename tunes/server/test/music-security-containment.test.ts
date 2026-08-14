import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { io as createSocket, type Socket } from "socket.io-client";

const TEST_JWT_SECRET = "containment-test-jwt-secret-with-sufficient-length";
const OWNER = {
  id: 41,
  username: "owner",
  email: "owner@example.test",
  password: "",
  guestUrl: "public-room-owner",
  isEmailVerified: true,
  isAdmin: false,
  suspendedAt: null,
};
const REGISTERED = { ...OWNER, id: 77, username: "registered", email: null, guestUrl: "public-room-registered" };

vi.mock("../storage", async () => {
  const session = (await import("express-session")).default;
  return { storage: {
    sessionStore: new session.MemoryStore(),
    getUserByGuestUrl: vi.fn(async (guestUrl: string) => /^public-room-[a-z]+$/.test(guestUrl) ? (guestUrl === OWNER.guestUrl ? OWNER : { ...OWNER, id: 42, guestUrl }) : undefined),
    getUser: vi.fn(async (id: number) => id === OWNER.id ? OWNER : id === REGISTERED.id ? REGISTERED : undefined),
    getUserByUsername: vi.fn(async (username: string) => username === OWNER.username ? OWNER : undefined),
    getUserByEmail: vi.fn(async () => undefined),
    createUser: vi.fn(async () => REGISTERED),
    createUserProfile: vi.fn(async () => undefined),
    getUserByExternalId: vi.fn(async (id: number) => id === 9001 ? OWNER : undefined),
    logYoutubeApiUsage: vi.fn(async () => undefined),
    createUserSession: vi.fn(async () => undefined),
  } };
});

vi.mock("../services/user-sync-service", () => ({
  userSyncService: { syncUser: vi.fn(async () => OWNER) },
}));

const { createValidatedApp } = await import("../config/music-startup");
const createApp = async () => {
  const inheritedDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    return await createValidatedApp(process.env, {
      readSecretFile: async () => Buffer.alloc(32, 0x6d).toString("base64url"),
      verifyDatabaseConnection: async () => undefined,
    });
  } finally {
    if (inheritedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = inheritedDatabaseUrl;
  }
};
const { storage } = await import("../storage");
const { resetContainmentLimiters } = await import("../security-containment");

function expectErrorEnvelope(response: request.Response, code: string) {
  expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
  expect(response.body).toEqual({
    error: expect.objectContaining({
      code,
      message: expect.any(String),
      action: expect.any(String),
      retryable: expect.any(Boolean),
      requestId: response.headers["x-request-id"],
    }),
  });
}

describe("Music standalone containment REST boundary", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];
  let server: Awaited<ReturnType<typeof createApp>>["server"];

  beforeAll(async () => {
    const { hashPassword } = await import("../auth");
    OWNER.password = await hashPassword("correct horse battery staple");
    process.env.STRAPI_JWT_SECRET = TEST_JWT_SECRET;
    process.env.ALLOWED_ORIGINS = "https://explorers.example.test";
    process.env.MUSIC_ADMIN_EXTERNAL_IDS = "9002";
    ({ app, server } = await createApp());
  });

  afterAll(() => server?.close());

  beforeEach(() => {
    resetContainmentLimiters();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ data: { deleteUsers: true } }), { status: 200 })) as typeof fetch;
  });

  it.each([
    ["POST", "/api/auth/sync", { strapiUser: { username: "victim", email: "victim@example.test" } }],
    ["GET", "/api/auth/user-data?username=victim", undefined],
    ["GET", "/api/auth/onboarding-status?username=victim", undefined],
  ])("disables unauthenticated legacy identity ownership: %s %s", async (method, path, body) => {
    const response = await request(app)[method.toLowerCase() as "get"](path).send(body);
    expect(response.status).toBe(401);
    expectErrorEnvelope(response, "AUTH_REQUIRED");
  });

  it("rejects malformed, forged, and expired bearer credentials without owner lookups", async () => {
    const expired = jwt.sign({ id: 9001, exp: 1 }, TEST_JWT_SECRET);
    const forged = jwt.sign({ id: 9001 }, "attacker-secret");
    for (const token of ["not-a-jwt", forged, expired]) {
      const response = await request(app)
        .get("/api/playlists?username=owner&userId=41")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Username", OWNER.username);
      expect(response.status).toBe(401);
      expectErrorEnvelope(response, "AUTH_INVALID");
    }
  });

  it("rejects ambiguous session/bearer ownership and ignores header/query/body owner claims", async () => {
    const token = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const response = await request(app)
      .post("/api/playlists?username=attacker&userId=999")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Username", "attacker")
      .send({ username: "attacker", userId: 999, name: "stolen" });
    expect(response.status).toBe(400);
    expectErrorEnvelope(response, "AMBIGUOUS_OWNER_INPUT");
    expect(storage.getUserByUsername).not.toHaveBeenCalled();
  });

  it("removes the arbitrary GraphQL service-token proxy before fetch", async () => {
    const response = await request(app).post("/graphql").send({
      query: "mutation { deleteUsers { documentId } }",
    });
    expect(response.status).toBe(410);
    expectErrorEnvelope(response, "GRAPHQL_PROXY_REMOVED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/strapi/config"],
    ["GET", "/api/debug/strapi"],
    ["POST", "/api/strapi/graphql"],
  ])("tombstones every Strapi service-credential alias before upstream access: %s %s", async (method, path) => {
    process.env.STRAPI_ACCESS_TOKEN = "server-service-token-never-return";
    const response = await request(app)[method.toLowerCase() as "get"](path).send({ query: "mutation { deleteUsers }" });
    expect(response.status).toBe(410);
    expectErrorEnvelope(response, path.endsWith("graphql") ? "GRAPHQL_PROXY_REMOVED" : "SERVICE_CREDENTIAL_ROUTE_REMOVED");
    expect(JSON.stringify(response.body)).not.toContain(process.env.STRAPI_ACCESS_TOKEN);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("denies suspended verified identities without exposing lifecycle state", async () => {
    const token = jwt.sign({ id: 9001, suspended: true }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const response = await request(app).get("/api/playlists").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
    expectErrorEnvelope(response, "AUTH_SUSPENDED");
    expect(JSON.stringify(response.body)).not.toContain("9001");
  });

  it.each([
    ["GET", "/api/subscriptions/user-plans/other-user", undefined],
    ["GET", "/api/subscriptions/song-limits/victim", undefined],
    ["POST", "/api/subscriptions/user-plans", { user: "victim", plan: "premium" }],
    ["POST", "/api/subscriptions/song-limits", { username: "victim", song_requests: 0 }],
    ["PUT", "/api/subscriptions/song-limits/victim-document", { song_requests: 0 }],
  ])("denies unauthenticated subscription or quota IDOR: %s %s", async (method, path, body) => {
    const response = await request(app)[method.toLowerCase() as "get"](path).send(body);
    expect(response.status).toBe(401);
    expectErrorEnvelope(response, "AUTH_REQUIRED");
  });

  it("disables subscription plan service-token reads for unauthenticated and authenticated callers", async () => {
    const unauthenticated = await request(app).get("/api/subscriptions/plans");
    expect(unauthenticated.status).toBe(401);
    expectErrorEnvelope(unauthenticated, "AUTH_REQUIRED");

    const token = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const authenticated = await request(app).get("/api/subscriptions/plans/paid-plan").set("Authorization", `Bearer ${token}`);
    expect(authenticated.status).toBe(410);
    expectErrorEnvelope(authenticated, "LEGACY_OWNER_ROUTE_REMOVED");
    expect(JSON.stringify(authenticated.body)).not.toContain("raw upstream subscription failure");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a bounded-body typed failure before echoing secret or PII", async () => {
    const secret = "raw-secret-never-return";
    const response = await request(app)
      .post("/api/auth/sync")
      .set("Content-Type", "application/json")
      .send({ password: secret, email: "private@example.test", padding: "x".repeat(70_000) });
    expect(response.status).toBe(413);
    expect(JSON.stringify(response.body)).not.toContain(secret);
    expect(JSON.stringify(response.body)).not.toContain("private@example.test");
    expectErrorEnvelope(response, "PAYLOAD_TOO_LARGE");
  });

  it("redacts request bodies, email, tokens, cookies, guest capabilities, and raw error text in logs", async () => {
    const forbidden = [
      "log-secret-password",
      "private-log@example.test",
      "Bearer raw-log-token",
      "cosmic.sid=raw-cookie",
      "private-guest-capability",
      "upstream raw failure",
    ];
    const stdout: string[] = [];
    const stderr: string[] = [];
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => { stdout.push(String(chunk)); return true; });
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation((chunk: any) => { stderr.push(String(chunk)); return true; });

    console.log({ password: forbidden[0], email: forbidden[1], authorization: forbidden[2], cookie: forbidden[3], guestUrl: forbidden[4] });
    console.error(new Error(forbidden[5]));
    const response = await request(app)
      .post("/api/auth/sync")
      .set("Authorization", forbidden[2])
      .set("Cookie", forbidden[3])
      .send({ password: forbidden[0], email: forbidden[1], guestUrl: forbidden[4] });

    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    const captured = `${stdout.join("\n")}\n${stderr.join("\n")}\n${JSON.stringify(response.body)}`;
    for (const value of forbidden) expect(captured).not.toContain(value);
  });

  it("enforces exact origin and double-submit CSRF on native session mutations", async () => {
    const missingOrigin = await request(app).post("/api/login").send({ username: OWNER.username, password: "wrong" });
    expect(missingOrigin.status).toBe(403);
    expectErrorEnvelope(missingOrigin, "ORIGIN_FORBIDDEN");

    const missingCsrf = await request(app)
      .post("/api/login")
      .set("Origin", "https://explorers.example.test")
      .send({ username: OWNER.username, password: "wrong" });
    expect(missingCsrf.status).toBe(403);
    expectErrorEnvelope(missingCsrf, "CSRF_INVALID");

    const agent = request.agent(app);
    const csrf = await agent.get("/api/csrf-token");
    const csrfCookie = (csrf.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("XSRF-TOKEN="))!;
    const invalid = await agent.post("/api/login")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .set("Cookie", csrfCookie.split(";")[0])
      .send({ username: "absent", password: "wrong" });
    expect(invalid.status).toBe(401);
    expectErrorEnvelope(invalid, "AUTH_INVALID");
  });

  it("rate-limits legacy ensure-compatible identity endpoints", async () => {
    let response!: request.Response;
    for (let index = 0; index < 31; index += 1) {
      response = await request(app).post("/api/auth/sync").set("X-Forwarded-For", "198.51.100.90").send({});
    }
    expect(response.status).toBe(429);
    expectErrorEnvelope(response, "RATE_LIMITED");
  });

  it("rate-limits exposed native authentication before credential evaluation", async () => {
    let response!: request.Response;
    for (let index = 0; index < 31; index += 1) {
      response = await request(app).post("/api/login").set("X-Forwarded-For", "203.0.113.50").send({});
    }
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("60");
    expectErrorEnvelope(response, "RATE_LIMITED");
  });

  it("cannot bypass auth throttling with spoofed forwarded addresses and keeps bounded limiter state", async () => {
    const { consumeContainmentLimit, containmentLimiterStats } = await import("../security-containment");
    let response!: request.Response;
    for (let index = 0; index < 40; index += 1) {
      response = await request(app).post("/api/login").set("X-Forwarded-For", `198.51.100.${index}`).send({});
    }
    expect(response.status).toBe(429);
    for (let index = 0; index < 1400; index += 1) {
      consumeContainmentLimit(`hostile-cardinality-${index}`, 1, 60_000);
    }
    expect(containmentLimiterStats().size).toBeLessThanOrEqual(containmentLimiterStats().capacity);
    expect(app.get("trust proxy")).not.toBe(true);
  });

  it("tombstones cross-user subscription resources for authenticated principals without upstream errors", async () => {
    const agent = await authenticatedAgent();
    const response = await agent.get("/api/subscriptions/user-plans/victim-resource-c");
    expect(response.status).toBe(410);
    expectErrorEnvelope(response, "LEGACY_OWNER_ROUTE_REMOVED");
    expect(JSON.stringify(response.body)).not.toContain("victim-resource-c");

    const tokenB = jwt.sign({ id: 902 }, process.env.STRAPI_JWT_SECRET!, { algorithm: "HS256", expiresIn: "5m" });
    const tokenResponse = await request(app)
      .get("/api/subscriptions/song-limits/resource-c")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(tokenResponse.status).toBe(410);
    expectErrorEnvelope(tokenResponse, "LEGACY_OWNER_ROUTE_REMOVED");
  });

  it("allows only a verified bearer with an exact origin to reach read-only YouTube search", async () => {
    process.env.YOUTUBE_API_KEY = "youtube-test-key";
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: { videoId: "video-1" }, snippet: { title: "Result" } }],
      nextPageToken: "page-2",
    }), { status: 200 })) as typeof fetch;
    const token = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });

    const response = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://explorers.example.test")
      .send({ query: "safe search", pageToken: "page-1" });

    expect(response.status).toBe(200);
    expect(response.body.items[0].id.videoId).toBe("video-1");
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(storage.getUserByUsername).not.toHaveBeenCalled();
  });

  it("allows a verified native session to search without turning the read-only POST into a CSRF mutation", async () => {
    process.env.YOUTUBE_API_KEY = "youtube-test-key";
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: { videoId: "session-video" }, snippet: { title: "Session result" } }],
    }), { status: 200 })) as typeof fetch;
    const agent = await authenticatedAgent();

    const response = await agent
      .post("/api/youtube/search")
      .set("Origin", "https://explorers.example.test")
      .send({ query: "session search" });

    expect(response.status).toBe(200);
    expect(response.body.items[0].id.videoId).toBe("session-video");
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("validates and rate-limits the bounded YouTube search capability before upstream access", async () => {
    process.env.YOUTUBE_API_KEY = "youtube-test-key";
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as typeof fetch;
    const token = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });

    const missingOrigin = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ query: "safe search" });
    expect(missingOrigin.status).toBe(403);
    expectErrorEnvelope(missingOrigin, "ORIGIN_FORBIDDEN");

    const oversizedQuery = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://explorers.example.test")
      .send({ query: "x".repeat(201) });
    expect(oversizedQuery.status).toBe(400);
    expectErrorEnvelope(oversizedQuery, "REQUEST_INVALID");
    expect(global.fetch).not.toHaveBeenCalled();

    let response!: request.Response;
    for (let index = 0; index < 31; index += 1) {
      response = await request(app)
        .post("/api/youtube/search")
        .set("Authorization", `Bearer ${token}`)
        .set("Origin", "https://explorers.example.test")
        .send({ query: `safe search ${index}` });
    }
    expect(response.status).toBe(429);
    expectErrorEnvelope(response, "RATE_LIMITED");
    expect(global.fetch).toHaveBeenCalledTimes(30);
  });

  it("rejects owner input, invalid/mixed/suspended credentials, and every other YouTube mutation", async () => {
    const token = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const ownerInput = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://explorers.example.test")
      .send({ query: "safe search", username: "owner" });
    expect(ownerInput.status).toBe(400);
    expectErrorEnvelope(ownerInput, "AMBIGUOUS_OWNER_INPUT");

    const malformed = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", "Bearer malformed")
      .set("Origin", "https://explorers.example.test")
      .send({ query: "safe search" });
    expect(malformed.status).toBe(401);
    expectErrorEnvelope(malformed, "AUTH_INVALID");

    const suspendedToken = jwt.sign({ id: 9001, suspended: true }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const suspended = await request(app)
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${suspendedToken}`)
      .set("Origin", "https://explorers.example.test")
      .send({ query: "safe search" });
    expect(suspended.status).toBe(403);
    expectErrorEnvelope(suspended, "AUTH_SUSPENDED");

    const agent = await authenticatedAgent();
    const csrf = await agent.get("/api/csrf-token");
    const mixed = await agent
      .post("/api/youtube/search")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .send({ query: "safe search" });
    expect(mixed.status).toBe(400);
    expectErrorEnvelope(mixed, "AMBIGUOUS_CREDENTIALS");

    const otherMutation = await request(app)
      .post("/api/youtube/video-from-url")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "https://explorers.example.test")
      .send({ url: "https://youtu.be/video-1" });
    expect(otherMutation.status).toBe(410);
    expectErrorEnvelope(otherMutation, "LEGACY_OWNER_ROUTE_REMOVED");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("tombstones non-search YouTube routes for native sessions before handlers run", async () => {
    process.env.YOUTUBE_API_KEY = "youtube-test-key";
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })) as typeof fetch;
    const handlerLog = vi.spyOn(console, "log");
    const agent = await authenticatedAgent();
    const csrf = await agent.get("/api/csrf-token");

    const post = await agent
      .post("/api/youtube/video-from-url")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .send({ url: "https://youtu.be/native-session-must-not-reach-handler" });
    expect(post.status).toBe(410);
    expectErrorEnvelope(post, "LEGACY_OWNER_ROUTE_REMOVED");

    const get = await agent.get("/api/youtube/video/native-session-must-not-reach-handler");
    expect(get.status).toBe(410);
    expectErrorEnvelope(get, "LEGACY_OWNER_ROUTE_REMOVED");

    expect(global.fetch).not.toHaveBeenCalled();
    expect(storage.logYoutubeApiUsage).not.toHaveBeenCalled();
    expect(handlerLog.mock.calls.flat().join(" ")).not.toContain("YouTube video-from-url endpoint HIT");
  });

  it("preserves narrow public capability flows while CSRF-protecting session mutations", async () => {
    const verification = await request(app).post("/api/verify-email/not-a-valid-capability");
    expect(verification.status).not.toBe(403);
    expect(verification.body.error?.code).not.toBe("CSRF_INVALID");
    const reactivation = await request(app).post("/api/user/request-reactivation").send({});
    expect(reactivation.status).toBe(400);
    expect(reactivation.body.error?.code).not.toBe("CSRF_INVALID");

    const agent = await authenticatedAgent();
    const blocked = await agent.post("/api/resend-verification");
    expect(blocked.status).toBe(403);
    expectErrorEnvelope(blocked, "ORIGIN_FORBIDDEN");
  });

  async function authenticatedAgent() {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/csrf-token");
    const csrfCookie = (csrf.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("XSRF-TOKEN="))!;
    const login = await agent.post("/api/login")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .set("Cookie", csrfCookie.split(";")[0])
      .send({ username: OWNER.username, password: "correct horse battery staple" });
    expect(login.status).toBe(200);
    return agent;
  }

  it.each([
    ["omitted", { username: REGISTERED.username, password: "registration-password" }],
    ["malicious", {
      username: REGISTERED.username,
      password: "registration-password",
      strapiUserId: 9001,
      strapiDocumentId: "attacker-document",
      accountDocumentId: "attacker-account",
      lifecycleOperationId: "attacker-operation",
    }],
  ])("tombstones native registration at the central boundary for %s server identity fields", async (_kind, body) => {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/csrf-token");
    const csrfCookie = (csrf.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("XSRF-TOKEN="))!;
    const response = await agent.post("/api/register")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .set("Cookie", `cosmic.sid=s%3Aattacker-registration.invalid; ${csrfCookie.split(";")[0]}`)
      .send(body);
    expect(response.status).toBe(410);
    expectErrorEnvelope(response, "LEGACY_IDENTITY_ROUTE_REMOVED");
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it.each([
    "/api/register",
    "/api/register/",
    "/API/REGISTER",
    "/aPi/ReGiStEr/?source=legacy",
  ])("tombstones every Express registration alias at the central boundary: %s", async (path) => {
    const response = await request(app).post(path).send({
      username: REGISTERED.username,
      password: "registration-password",
      strapiUserDocumentId: "forged-person",
      strapiAccountDocumentId: "forged-account",
    });
    expect(response.status).toBe(410);
    expectErrorEnvelope(response, "LEGACY_IDENTITY_ROUTE_REMOVED");
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it.each(["/api/register//", "/api/register/extra"])("does not widen registration containment to %s", async (path) => {
    const response = await request(app).post(path).send({});
    expect(response.status).toBe(404);
    expect(storage.createUser).not.toHaveBeenCalled();
  });

  it("rotates the native session on login, uses hardened cookies, and invalidates logout", async () => {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/csrf-token").set("X-Forwarded-Proto", "https");
    const csrfCookie = (csrf.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("XSRF-TOKEN="));
    const token = csrf.body.token;
    expect(csrfCookie).toContain("SameSite=Lax");

    const fixedCookie = "cosmic.sid=s%3Aattacker-fixed.invalid";
    const login = await agent
      .post("/api/login")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", token)
      .set("Cookie", `${fixedCookie}; ${csrfCookie!.split(";")[0]}`)
      .send({ username: OWNER.username, password: "correct horse battery staple" });
    expect(login.status).toBe(200);
    const sessionCookie = (login.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("cosmic.sid="));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).not.toContain("attacker-fixed");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");

    const bearer = jwt.sign({ id: 9001 }, TEST_JWT_SECRET, { expiresIn: "5m" });
    const ambiguous = await agent.get("/api/playlists/999").set("Authorization", `Bearer ${bearer}`);
    expect(ambiguous.status).toBe(400);
    expectErrorEnvelope(ambiguous, "AMBIGUOUS_CREDENTIALS");

    const logout = await agent
      .post("/api/logout")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", token);
    expect(logout.status).toBe(200);
    expect((await agent.get("/api/check")).status).toBe(401);

    const fallback = await request(app).get("/api/check").set("Cookie", "localtunes_cross_domain_auth=forged-browser-session");
    expect(fallback.status).toBe(401);
  });
});

describe("Music production startup containment", () => {
  it("refuses to start without mandatory non-default credentials", async () => {
    const saved = { ...process.env };
    process.env.NODE_ENV = "production";
    delete process.env.STRAPI_JWT_SECRET;
    delete process.env.DATABASE_URL;
    await expect(createApp()).rejects.toThrow(/STRAPI_JWT_SECRET|credential|default/i);
    process.env = saved;
  });

  it("marks production session and CSRF cookies Secure", async () => {
    const saved = { ...process.env };
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.SESSION_SECRET = "session-secret-with-at-least-thirty-two-characters";
    process.env.COOKIE_SECRET = "cookie-secret-with-at-least-thirty-two-characters";
    process.env.STRAPI_JWT_SECRET = TEST_JWT_SECRET;
    process.env.ALLOWED_ORIGINS = "https://explorers.example.test";
    let productionServer: Awaited<ReturnType<typeof createApp>>["server"] | undefined;
    try {
      const production = await createApp();
      productionServer = production.server;
      const response = await request(production.app).get("/api/csrf-token").set("X-Forwarded-Proto", "https");
      expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("Secure")]));
    } finally {
      productionServer?.close();
      process.env = saved;
    }
  });
});

describe("Music Socket.IO containment", () => {
  let app: Awaited<ReturnType<typeof createApp>>["app"];
  let server: Awaited<ReturnType<typeof createApp>>["server"];
  let url: string;
  const sockets: Socket[] = [];

  beforeEach(() => resetContainmentLimiters());
  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  beforeAll(async () => {
    const { hashPassword } = await import("../auth");
    OWNER.password = await hashPassword("correct horse battery staple");
    process.env.STRAPI_JWT_SECRET = TEST_JWT_SECRET;
    process.env.ALLOWED_ORIGINS = "https://explorers.example.test";
    ({ app, server } = await createApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function connect(options: Parameters<typeof createSocket>[1]): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = createSocket(url, { path: "/ws", transports: ["websocket"], reconnection: false, ...options });
      sockets.push(socket);
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  }

  function containmentFailure(options: Parameters<typeof createSocket>[1]): Promise<Record<string, any>> {
    return new Promise((resolve) => {
      const socket = createSocket(url, { path: "/ws", transports: ["websocket"], reconnection: false, ...options });
      sockets.push(socket);
      socket.once("containment_error", resolve);
      socket.once("connect_error", (error: any) => resolve(error.data));
    });
  }

  async function ownerSessionCookie(): Promise<string> {
    const agent = request.agent(app);
    const csrf = await agent.get("/api/csrf-token");
    const csrfCookie = (csrf.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("XSRF-TOKEN="))!;
    const login = await agent.post("/api/login")
      .set("Origin", "https://explorers.example.test")
      .set("X-CSRF-Token", csrf.body.token)
      .set("Cookie", csrfCookie.split(";")[0])
      .send({ username: OWNER.username, password: "correct horse battery staple" });
    return (login.headers["set-cookie"] as unknown as string[]).find((value) => value.startsWith("cosmic.sid="))!.split(";")[0];
  }

  it("rejects a socket origin outside the exact allowlist", async () => {
    await expect(connect({ extraHeaders: { Origin: "https://evil.example.test" }, query: { guestUrl: OWNER.guestUrl } }))
      .rejects.toThrow();
  });

  it("denies guest player_state with a request ID and does not leak room capability", async () => {
    const guest = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: OWNER.guestUrl } });
    const failure = await new Promise<Record<string, any>>((resolve) => {
      guest.once("containment_error", resolve);
      guest.emit("player_state", { playing: true, token: "socket-secret" });
    });
    expect(failure.error).toEqual(expect.objectContaining({ code: "SOCKET_EVENT_FORBIDDEN", requestId: expect.any(String) }));
    expect(JSON.stringify(failure)).not.toContain(OWNER.guestUrl);
    expect(JSON.stringify(failure)).not.toContain("socket-secret");
  });

  it("accepts a schema-valid bounded guest request but rejects malformed and oversized payloads", async () => {
    const guest = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: OWNER.guestUrl } });
    const accepted = new Promise<Record<string, any>>((resolve) => guest.once("guest_request_status", resolve));
    guest.emit("guest_request", { type: "song", externalId: "yt:abc123" });
    await expect(accepted).resolves.toEqual(expect.objectContaining({ status: "accepted", requestId: expect.any(String) }));

    for (const payload of [{ arbitrary: true }, { type: "song", externalId: "x".repeat(9_000) }]) {
      const denied = new Promise<Record<string, any>>((resolve) => guest.once("containment_error", resolve));
      guest.emit("guest_request", payload);
      await expect(denied).resolves.toEqual({ error: expect.objectContaining({ code: "SOCKET_PAYLOAD_INVALID" }) });
    }
  });

  it("delivers a valid guest request only to the authenticated owner room", async () => {
    const cookie = await ownerSessionCookie();
    const owner = await connect({ extraHeaders: { Origin: "https://explorers.example.test", Cookie: cookie } });
    const other = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: "public-room-other" } });
    let leaked = false;
    other.on("guest_request", () => { leaked = true; });
    const delivered = new Promise<Record<string, unknown>>((resolve) => owner.once("guest_request", resolve));
    const guest = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: OWNER.guestUrl } });
    guest.emit("guest_request", { type: "song", externalId: "yt:delivered" });
    await expect(delivered).resolves.toEqual(expect.objectContaining({ type: "song", externalId: "yt:delivered", requestId: expect.any(String) }));
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    expect(leaked).toBe(false);
  });

  it("denies a suspended owner socket", async () => {
    const cookie = await ownerSessionCookie();
    OWNER.suspendedAt = new Date() as any;
    try {
      const failure = await containmentFailure({ extraHeaders: { Origin: "https://explorers.example.test", Cookie: cookie } });
      expect(failure.error).toEqual(expect.objectContaining({ code: "AUTH_SUSPENDED" }));
    } finally {
      OWNER.suspendedAt = null;
    }
  });

  it("rate-limits guest events per socket", async () => {
    const guest = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: OWNER.guestUrl } });
    const failures: Record<string, any>[] = [];
    guest.on("containment_error", (failure) => failures.push(failure));
    for (let index = 0; index < 12; index += 1) {
      guest.emit("guest_request", { type: "song", externalId: `yt:${index}` });
    }
    await vi.waitFor(() => expect(failures.some((failure) => failure.error?.code === "RATE_LIMITED")).toBe(true));
  });

  it("retains a guest rate limit across reconnects", async () => {
    const options = { extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: "public-room-reconnect" } };
    const first = await connect(options);
    for (let index = 0; index < 10; index += 1) first.emit("guest_request", { type: "song", externalId: `yt:first-${index}` });
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    first.close();
    const second = await connect(options);
    const failure = new Promise<Record<string, any>>((resolve) => second.once("containment_error", resolve));
    second.emit("guest_request", { type: "song", externalId: "yt:bypass" });
    await expect(failure).resolves.toEqual({ error: expect.objectContaining({ code: "RATE_LIMITED" }) });
  });

  it("isolates guest events and capabilities between rooms", async () => {
    const first = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: OWNER.guestUrl } });
    const second = await connect({ extraHeaders: { Origin: "https://explorers.example.test" }, query: { guestUrl: "public-room-other" } });
    let leaked = false;
    second.on("guest_request_status", () => { leaked = true; });
    const accepted = new Promise((resolve) => first.once("guest_request_status", resolve));
    first.emit("guest_request", { type: "song", externalId: "yt:isolated" });
    await accepted;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    expect(leaked).toBe(false);
  });
});
