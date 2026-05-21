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

describe('GET /api/journal/days', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/journal/days?from=2026-05-01&to=2026-05-31',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/journal/days/:date', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/journal/days/2026-05-14' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/journal/days/:date', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/journal/days/2026-05-14',
      payload: { mood: { scale: 3, tags: [] } },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/journal/days/:date', () => {
  it('returns 401 without a session cookie', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/journal/days/2026-05-14' });
    expect(res.statusCode).toBe(401);
  });
});
