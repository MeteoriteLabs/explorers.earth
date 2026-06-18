import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the service so the route never touches Strapi / Postgres.
vi.mock('../../services/reactivation-service', () => ({
  requestReactivation: vi.fn().mockResolvedValue(undefined),
  confirmReactivation: vi.fn().mockResolvedValue({ success: true }),
}));

import { setupReactivationRoutes, reactivationRateLimitKey, reactivationRateLimitSkip } from '../reactivationRoutes';

const REQ = '/api/user/request-reactivation';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true); // replicate production so the X-Forwarded-For spoof test is meaningful
  setupReactivationRoutes(app);
  return app;
}

describe('reactivation route harness smoke test', () => {
  it('returns 200 for a valid reactivation request', async () => {
    const res = await request(buildApp()).post(REQ).send({ email: 'smoke@example.com' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/user/request-reactivation rate limiting', () => {
  it('allows 5 requests for an email then 429s the 6th', async () => {
    const app = buildApp();
    const email = 'cap-test@example.com';
    for (let i = 1; i <= 5; i++) {
      const res = await request(app).post(REQ).send({ email });
      expect(res.status).toBe(200);
    }
    const sixth = await request(app).post(REQ).send({ email });
    expect(sixth.status).toBe(429);
    expect(sixth.body.message).toMatch(/too many/i);
  });

  it('cannot be bypassed by rotating X-Forwarded-For (per-email cap holds)', async () => {
    const app = buildApp();
    const email = 'spoof-test@example.com';
    for (let i = 1; i <= 5; i++) {
      const res = await request(app).post(REQ).set('X-Forwarded-For', `10.0.0.${i}`).send({ email });
      expect(res.status).toBe(200);
    }
    const sixth = await request(app).post(REQ).set('X-Forwarded-For', '10.0.0.99').send({ email });
    expect(sixth.status).toBe(429); // spoofed IP must NOT reset the per-email bucket
  });

  it('keeps separate buckets per email', async () => {
    const app = buildApp();
    const a = 'indep-a@example.com';
    const b = 'indep-b@example.com';
    for (let i = 1; i <= 6; i++) await request(app).post(REQ).send({ email: a });
    const aLimited = await request(app).post(REQ).send({ email: a });
    expect(aLimited.status).toBe(429);
    const bFirst = await request(app).post(REQ).send({ email: b });
    expect(bFirst.status).toBe(200); // a different email is unaffected
  });

  it('does not rate-limit requests with no email — stays 400 even when spammed', async () => {
    const app = buildApp();
    let last = 0;
    for (let i = 1; i <= 7; i++) {
      const res = await request(app).post(REQ).send({});
      last = res.status;
    }
    expect(last).toBe(400); // skipped by limiter → hits route validation, never 429
  });
});

describe('reactivationRateLimitKey', () => {
  it('keys on the normalized (trimmed, lowercased) email', () => {
    expect(reactivationRateLimitKey({ body: { email: '  Foo@Bar.COM ' } } as any)).toBe('reactivation:foo@bar.com');
  });
  it('produces a stable empty key when email is missing', () => {
    expect(reactivationRateLimitKey({ body: {} } as any)).toBe('reactivation:');
  });
});

describe('reactivationRateLimitSkip', () => {
  it('skips when email is missing or blank', () => {
    expect(reactivationRateLimitSkip({ body: {} } as any)).toBe(true);
    expect(reactivationRateLimitSkip({ body: { email: '   ' } } as any)).toBe(true);
  });
  it('does not skip when an email is present', () => {
    expect(reactivationRateLimitSkip({ body: { email: 'a@b.com' } } as any)).toBe(false);
  });
});
