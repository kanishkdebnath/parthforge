import fp from 'fastify-plugin';
import fastifyCookie from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { User } from '@pathforge/shared';
import { UserModel } from '../models/User.js';

export const SESSION_COOKIE = 'pf_session';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: User;
  }
}

export default fp(async (app) => {
  await app.register(fastifyCookie, {
    secret: app.config.SESSION_SECRET,
  });

  app.decorate('authenticate', async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE];
    if (!raw) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || !unsigned.value) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = await UserModel.findById(unsigned.value).lean();
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    request.user = {
      _id: String(user._id),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      googleId: user.googleId ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });
});
