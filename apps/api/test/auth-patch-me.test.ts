import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ skipDb: true });
});

afterAll(async () => {
  await app.close();
});

describe('PATCH /api/auth/me', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      payload: { timezone: 'UTC' },
    });
    expect(res.statusCode).toBe(401);
  });
});
