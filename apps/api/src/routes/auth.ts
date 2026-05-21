import type { FastifyInstance } from 'fastify';
import {
  LoginRequestSchema,
  UpdateMeRequestSchema,
} from '@pathforge/shared';
import { UserModel } from '../models/User.js';
import { SESSION_COOKIE } from '../plugins/auth.js';
import { resetDemoData } from '../seedDemo.js';
import { isValidTimezone, userTodayLocal } from '../lib/user-time.js';

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
      isDemoUser: u.isDemoUser ?? false,
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
        const anchorDate = userTodayLocal(
          user.timezone ?? undefined,
          parsed.data.clientToday
        );
        await resetDemoData(user._id, anchorDate);
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

  app.patch(
    '/api/auth/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = UpdateMeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Invalid body',
          details: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const { timezone } = parsed.data;
      if (typeof timezone === 'string' && !isValidTimezone(timezone)) {
        return reply.code(400).send({ error: 'Invalid timezone' });
      }

      const update: Record<string, unknown> = {};
      if (timezone === null) {
        update.$unset = { timezone: '' };
      } else if (typeof timezone === 'string') {
        update.$set = { timezone };
      }

      // Empty patch is a no-op — return the current user.
      const doc =
        Object.keys(update).length === 0
          ? await UserModel.findById(request.user!._id).lean()
          : await UserModel.findByIdAndUpdate(request.user!._id, update, {
              new: true,
            }).lean();

      if (!doc) return reply.code(404).send({ error: 'Not found' });

      return {
        _id: String(doc._id),
        email: doc.email,
        name: doc.name,
        avatarUrl: doc.avatarUrl ?? undefined,
        googleId: doc.googleId ?? undefined,
        isDemoUser: doc.isDemoUser ?? false,
        timezone: doc.timezone ?? undefined,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    }
  );
}
