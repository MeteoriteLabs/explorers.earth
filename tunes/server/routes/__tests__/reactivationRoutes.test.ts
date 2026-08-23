import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the service so the route never touches Strapi / Postgres.
vi.mock('../../services/reactivation-service', () => ({
  requestReactivation: vi.fn().mockResolvedValue(undefined),
  confirmReactivation: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  setupReactivationRoutes,
  reactivationRateLimitKey,
  reactivationRateLimitSkip,
  isValidReactivationEmail,
  reactivationGlobalLimiter,
  REACTIVATION_GLOBAL_MAX,
  reactivationAddressLimiter,
  reactivationAddressLimitKey,
  REACTIVATION_ADDRESS_MAX,
} from '../reactivationRoutes';
import { confirmReactivation } from '../../services/reactivation-service';

const REQ = '/api/user/request-reactivation';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true); // replicate production so the X-Forwarded-For spoof test is meaningful
  setupReactivationRoutes(app);
  return app;
}

it('passes the production Music reactivation transition into token confirmation', async () => {
  // Break caught: Strapi is unblocked but the durable Music owner remains suspended.
  const reactivateMusic = vi.fn(async () => undefined);
  const app = express();
  app.use(express.json());
  setupReactivationRoutes(app, { reactivateMusic });

  await request(app).get('/api/user/reactivate?token=valid-token').expect(200);
  expect(confirmReactivation).toHaveBeenCalledWith('valid-token', expect.objectContaining({ reactivateMusic }));
});

beforeEach(() => {
  // The global limiter uses a constant key shared across the whole module, so
  // reset it between tests (per-email tests already use distinct emails).
  reactivationGlobalLimiter.resetKey('reactivation:global');
  for (const address of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) {
    reactivationAddressLimiter.resetKey(`reactivation-address:${address}`);
  }
});

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

describe('reactivation address and global abuse limits', () => {
  it('keys the recovery limiter by normalized client address', () => {
    expect(reactivationAddressLimitKey({ ip: '203.0.113.7' } as any)).toBe('reactivation-address:203.0.113.7');
    expect(reactivationAddressLimitKey({ ip: undefined } as any)).toBe('reactivation-address:unknown');
  });

  it('allows more than the former 30/hour global bucket while bounding one address', async () => {
    const app = buildApp();
    for (let i = 0; i < REACTIVATION_ADDRESS_MAX; i++) {
      const res = await request(app).post(REQ).set('X-Forwarded-For', '203.0.113.9').send({ email: `address-${i}@example.com` });
      expect(res.status).toBe(200);
    }
    const limited = await request(app).post(REQ).set('X-Forwarded-For', '203.0.113.9').send({ email: 'address-overflow@example.com' });
    expect(limited.status).toBe(429);

    for (let i = 0; i < 31; i++) {
      const res = await request(app).post(REQ).set('X-Forwarded-For', `198.51.100.${i + 1}`).send({ email: `legitimate-${i}@example.com` });
      expect(res.status).toBe(200);
    }
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

describe('isValidReactivationEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidReactivationEmail('user@example.com')).toBe(true);
  });
  it('rejects blank, malformed, and oversized addresses', () => {
    expect(isValidReactivationEmail('')).toBe(false);
    expect(isValidReactivationEmail('notanemail')).toBe(false);
    expect(isValidReactivationEmail('no@dotdomain')).toBe(false);
    expect(isValidReactivationEmail('a'.repeat(250) + '@x.com')).toBe(false); // > 254 chars
  });
});

describe('reactivation limiter spray hardening', () => {
  it('returns 400 (never 429) for a malformed email no matter how often it is sent', async () => {
    const app = buildApp();
    let last = 0;
    for (let i = 1; i <= 10; i++) {
      const res = await request(app).post(REQ).send({ email: 'notanemail' });
      last = res.status;
    }
    expect(last).toBe(400);
  });

  it('returns 400 for an oversized email and does not rate-limit it', async () => {
    const app = buildApp();
    const oversized = 'a'.repeat(250) + '@example.com'; // > 254 chars
    let last = 0;
    for (let i = 1; i <= 7; i++) {
      const res = await request(app).post(REQ).send({ email: oversized });
      last = res.status;
    }
    expect(last).toBe(400);
  });

  it('malformed-email spray does not consume the global budget', async () => {
    const app = buildApp();
    for (let i = 0; i < REACTIVATION_GLOBAL_MAX; i++) {
      await request(app).post(REQ).send({ email: 'notanemail' });
    }
    const valid = await request(app).post(REQ).send({ email: 'still-works@example.com' });
    expect(valid.status).toBe(200);
  });

  it('caps total valid reactivation volume via the global backstop', async () => {
    const app = buildApp();
    for (let i = 0; i < REACTIVATION_GLOBAL_MAX; i++) {
      const res = await request(app).post(REQ).set('X-Forwarded-For', `192.0.${Math.floor(i / 250)}.${(i % 250) + 1}`).send({ email: `spray-${i}@example.com` });
      expect(res.status).toBe(200);
    }
    const overflow = await request(app).post(REQ).set('X-Forwarded-For', '198.18.0.1').send({ email: 'one-too-many@example.com' });
    expect(overflow.status).toBe(429);
    expect(overflow.body.message).toMatch(/temporarily busy/i);
  });
});
