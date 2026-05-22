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

describe('Budget routes (smoke — no session)', () => {
  it('GET /api/budget/groups returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/groups' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/groups returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/groups',
      payload: { name: 'Income', color: '#10b981' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/budget/groups/reorder returns 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/budget/groups/reorder',
      payload: { ids: ['507f1f77bcf86cd799439011'] },
    });
    expect(res.statusCode).toBe(401);
  });
});
