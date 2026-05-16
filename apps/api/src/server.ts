import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type Config } from './config.js';
import { connectDb } from './db.js';
import { healthRoutes } from './routes/health.js';
import authPlugin from './plugins/auth.js';

export interface BuildOptions {
  skipDb?: boolean;
  config?: Partial<Config>;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const config = opts.skipDb
    ? ({
        MONGO_URL: 'mongodb://unused',
        SESSION_SECRET: 'test-secret-for-app-build-only',
        NODE_ENV: 'test',
        FRONTEND_ORIGIN: 'http://localhost:5173',
        PORT: 0,
        ...opts.config,
      } satisfies Config)
    : loadConfig();

  const app = Fastify({ logger: !opts.skipDb });
  app.decorate('config', config);

  if (!opts.skipDb) {
    await connectDb(config.MONGO_URL);
    if (config.NODE_ENV === 'development') {
      const { seedDevUsersIfEmpty } = await import('./seed.js');
      await seedDevUsersIfEmpty();
    }
  }

  await app.register(authPlugin);
  await app.register(healthRoutes);
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = await buildApp();
  await app.listen({ port: app.config.PORT, host: '0.0.0.0' });
}
