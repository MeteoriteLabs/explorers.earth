import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the service so the route never touches Strapi / Postgres.
vi.mock('../../services/reactivation-service', () => ({
  requestReactivation: vi.fn().mockResolvedValue(undefined),
  confirmReactivation: vi.fn().mockResolvedValue({ success: true }),
}));

import { setupReactivationRoutes } from '../reactivationRoutes';

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
