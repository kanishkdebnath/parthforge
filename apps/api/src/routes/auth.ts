import type { FastifyInstance } from 'fastify';
import { LoginRequestSchema } from '@pathforge/shared';
import { UserModel } from '../models/User.js';
import { SESSION_COOKIE } from '../plugins/auth.js';
import { resetDemoData } from '../seedDemo.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/dev-users', async (_request, reply) => {
    if (app.config.NODE_ENV !== 'development') {
      return reply.code(404).send({ error: 'Not found' });
    }
    const users = await UserModel.find({}).lean();
    return users.map((u) => ({
      _id: String(u._id),
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl ?? undefined,
    }));
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }
    const user = await UserModel.findById(parsed.data.userId).lean();
    if (!user) {
      return reply.code(400).send({ error: 'Unknown user' });
    }
    if (user.isDemoUser) {
      try {
        await resetDemoData(user._id);
      } catch (err) {
        request.log.error(
          { err, userId: String(user._id) },
          'demo-reset-failed'
        );
        // fail-open: continue with login so the demo user isn't locked out
      }
    }
    reply.setCookie(SESSION_COOKIE, String(user._id), {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: app.config.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return { ok: true };
  });

  app.post(
    '/api/auth/logout',
    { preHandler: [app.authenticate] },
    async (_request, reply) => {
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return { ok: true };
    }
  );

  app.get(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!request.user) {
        // Unreachable in practice — `authenticate` preHandler 401s before this runs —
        // but the explicit guard keeps the response type free of `undefined`.
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      return request.user;
    }
  );
}
