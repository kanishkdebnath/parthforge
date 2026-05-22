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

  it('GET /api/budget/categories returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/categories' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/categories returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/categories',
      payload: {
        groupId: '507f1f77bcf86cd799439011',
        name: 'Rent',
        kind: 'expense',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/budget/categories/reorder returns 401', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/budget/categories/reorder',
      payload: {
        groupId: '507f1f77bcf86cd799439011',
        ids: ['507f1f77bcf86cd799439012'],
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/transactions returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/transactions?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/transactions returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/transactions',
      payload: {
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 50_000,
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/budget/transactions/:id returns 401', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/budget/transactions/507f1f77bcf86cd799439011',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/targets returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/targets?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('PUT /api/budget/targets returns 401', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/budget/targets',
      payload: { month: '2026-05', items: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/recurring returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budget/recurring' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/budget/recurring/:id/apply returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budget/recurring/507f1f77bcf86cd799439011/apply',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/report returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/report?month=2026-05',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/budget/report (no month) returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/budget/report',
    });
    expect(res.statusCode).toBe(401);
  });
});
