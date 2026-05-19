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

describe('GET /api/jobs', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/jobs' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/507f1f77bcf86cd799439011',
    });
    expect(res.statusCode).toBe(401);
  });
});
