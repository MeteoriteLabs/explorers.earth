import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupExplorersAnalyticsRoutes } from "../explorersAnalyticsRoutes";

const input = {
  consent: true,
  eventId: "evt-20260824-route-1",
  accountId: "account-1",
  event: {
    type: "view",
    timestamp: "2026-08-24T03:30:00.000Z",
    page: "public-profile",
    canonicalPath: "/tk2727",
  },
};

const buildApp = ({ authorized = true } = {}) => {
  const service = {
    ingest: vi.fn().mockResolvedValue({
      status: "committed",
      documentId: "strapi-event-1",
      duplicate: false,
    }),
    readAccountEvents: vi.fn().mockResolvedValue([{ eventId: "evt-1" }]),
  };
  const authorizeOwner = vi.fn().mockResolvedValue(authorized);
  const validatePublicTarget = vi.fn().mockResolvedValue(true);
  const allowWrite = vi.fn().mockReturnValue(true);
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  setupExplorersAnalyticsRoutes(app, {
    service,
    authorizeOwner,
    validatePublicTarget,
    allowWrite,
  });
  return {
    app,
    service,
    authorizeOwner,
    validatePublicTarget,
    allowWrite,
  };
};

describe("explorers analytics routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a canonical public event without returning or storing an IP", async () => {
    const { app, service } = buildApp();
    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .set("X-Forwarded-For", "203.0.113.90")
      .send(input);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      status: "committed",
      documentId: "strapi-event-1",
      duplicate: false,
    });
    expect(service.ingest).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ getIp: expect.any(Function) }),
    );
    expect(JSON.stringify(response.body)).not.toContain("203.0.113.90");
  });

  it("returns 204 when analytics consent is denied", async () => {
    const { app, service } = buildApp();
    service.ingest.mockResolvedValue({ status: "consent-denied" });

    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .send({ ...input, consent: false });

    expect(response.status).toBe(204);
  });

  it("rejects malformed events before target validation or ingestion", async () => {
    const { app, service, validatePublicTarget } = buildApp();
    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .send({ ...input, eventId: "short" });

    expect(response.status).toBe(400);
    expect(validatePublicTarget).not.toHaveBeenCalled();
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it("returns 404 for an analytics target that is not a real public account", async () => {
    const { app, service, validatePublicTarget } = buildApp();
    validatePublicTarget.mockResolvedValue(false);

    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .send(input);

    expect(response.status).toBe(404);
    expect(validatePublicTarget).toHaveBeenCalledWith(input);
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it("rate limits before spending a Strapi validation or write", async () => {
    const { app, service, validatePublicTarget, allowWrite } = buildApp();
    allowWrite.mockReturnValue(false);

    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .send(input);

    expect(response.status).toBe(429);
    expect(validatePublicTarget).not.toHaveBeenCalled();
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it("returns 202 for an in-flight duplicate", async () => {
    const { app, service } = buildApp();
    service.ingest.mockResolvedValue({ status: "pending", duplicate: true });
    const response = await request(app)
      .post("/api/explorers/analytics/events")
      .send(input);
    expect(response.status).toBe(202);
  });

  it("maps idempotency conflicts to 409 and upstream failures to 502", async () => {
    const { IdempotencyConflictError } = await import(
      "../../services/explorers-analytics-service"
    );
    const conflict = buildApp();
    conflict.service.ingest.mockRejectedValue(new IdempotencyConflictError());
    expect(
      (
        await request(conflict.app)
          .post("/api/explorers/analytics/events")
          .send(input)
      ).status,
    ).toBe(409);

    const upstream = buildApp();
    upstream.service.ingest.mockRejectedValue(new Error("Strapi unavailable"));
    expect(
      (
        await request(upstream.app)
          .post("/api/explorers/analytics/events")
          .send(input)
      ).status,
    ).toBe(502);
  });

  it("denies cross-account owner reads before querying events", async () => {
    const { app, service, authorizeOwner } = buildApp({ authorized: false });

    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "other-account",
        fromDate: "2026-08-01",
        toDate: "2026-08-31",
        timeZone: "America/New_York",
      });

    expect(response.status).toBe(403);
    expect(authorizeOwner).toHaveBeenCalledWith(
      expect.anything(),
      "other-account",
    );
    expect(service.readAccountEvents).not.toHaveBeenCalled();
  });

  it("passes only the authorized account and date range to the scoped read", async () => {
    const { app, service } = buildApp();

    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "account-1",
        fromDate: "2026-08-01",
        toDate: "2026-08-31",
        timeZone: "America/New_York",
      });

    expect(response.status).toBe(200);
    expect(service.readAccountEvents).toHaveBeenCalledWith({
      accountId: "account-1",
      from: "2026-08-01T04:00:00.000Z",
      to: "2026-09-01T03:59:59.999Z",
    });
    expect(response.body).toEqual({ events: [{ eventId: "evt-1" }] });
  });

  it("rejects invalid read scopes before authorization", async () => {
    const { app, service, authorizeOwner } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({ accountId: "account-1", fromDate: "not-a-date", toDate: "also-bad", timeZone: "invalid" });
    expect(response.status).toBe(400);
    expect(authorizeOwner).not.toHaveBeenCalled();
    expect(service.readAccountEvents).not.toHaveBeenCalled();
  });

  it.each([
    {
      fromDate: "2026-08-31",
      toDate: "2026-08-01",
      timeZone: "America/New_York",
    },
    {
      fromDate: "2025-01-01",
      toDate: "2026-08-01",
      timeZone: "America/New_York",
    },
  ])("rejects reversed or oversized analytics windows", async (scope) => {
    const { app, authorizeOwner } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({ accountId: "account-1", ...scope });
    expect(response.status).toBe(400);
    expect(authorizeOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["2026-08-15", "2026-11-15"],
    ["2026-02-15", "2026-05-18"],
  ])("accepts 93 calendar days across DST in America/New_York", async (fromDate, toDate) => {
    const { app, service } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({ accountId: "account-1", fromDate, toDate, timeZone: "America/New_York" });

    expect(response.status).toBe(200);
    expect(service.readAccountEvents).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["2026-08-15", "2026-11-16"],
    ["2026-02-15", "2026-05-19"],
  ])("rejects 94 calendar days across DST in America/New_York", async (fromDate, toDate) => {
    const { app, service, authorizeOwner } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({ accountId: "account-1", fromDate, toDate, timeZone: "America/New_York" });

    expect(response.status).toBe(400);
    expect(authorizeOwner).not.toHaveBeenCalled();
    expect(service.readAccountEvents).not.toHaveBeenCalled();
  });

  it("rejects a civil date skipped by the accepted IANA timezone", async () => {
    const { app, service, authorizeOwner } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "account-1",
        fromDate: "2011-12-30",
        toDate: "2011-12-30",
        timeZone: "Pacific/Apia",
      });

    expect(response.status).toBe(400);
    expect(authorizeOwner).not.toHaveBeenCalled();
    expect(service.readAccountEvents).not.toHaveBeenCalled();
  });

  it.each(["2011-12-29", "2011-12-31"])(
    "accepts a valid calendar date adjacent to Pacific/Apia's skipped day: %s",
    async (date) => {
      const { app, service } = buildApp();
      const response = await request(app)
        .get("/api/explorers/analytics/events")
        .query({
          accountId: "account-1",
          fromDate: date,
          toDate: date,
          timeZone: "Pacific/Apia",
        });

      expect(response.status).toBe(200);
      expect(service.readAccountEvents).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a timezone alias that is not an IANA timezone", async () => {
    const { app, service, authorizeOwner } = buildApp();
    const response = await request(app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "account-1",
        fromDate: "2026-08-01",
        toDate: "2026-08-31",
        timeZone: "EST",
      });

    expect(response.status).toBe(400);
    expect(authorizeOwner).not.toHaveBeenCalled();
    expect(service.readAccountEvents).not.toHaveBeenCalled();
  });

  it("returns a controlled 502 when authorization or scoped reads fail", async () => {
    const authorizationFailure = buildApp();
    authorizationFailure.authorizeOwner.mockRejectedValue(
      new Error("identity provider unavailable"),
    );
    const authResponse = await request(authorizationFailure.app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "account-1",
        fromDate: "2026-08-01",
        toDate: "2026-08-31",
        timeZone: "America/New_York",
      });
    expect(authResponse.status).toBe(502);

    const readFailure = buildApp();
    readFailure.service.readAccountEvents.mockRejectedValue(
      new Error("Strapi unavailable"),
    );
    const readResponse = await request(readFailure.app)
      .get("/api/explorers/analytics/events")
      .query({
        accountId: "account-1",
        fromDate: "2026-08-01",
        toDate: "2026-08-31",
        timeZone: "America/New_York",
      });
    expect(readResponse.status).toBe(502);
  });
});
