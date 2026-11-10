import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './config/env';
import { authRouter } from './routes/auth';
import { scenariosRouter } from './routes/scenarios';
import { attemptsRouter } from './routes/attempts';
import { trainerRouter } from './routes/trainer';
import { metaRouter } from './routes/meta';
import { farmsRouter } from './routes/farms';
import { shareRouter } from './routes/share';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind a proxy
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.get('/', (_req, res) => {
    res.json({ name: 'Digital Farm Lab API', docs: 'See docs/API.md' });
  });
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/share', shareRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/scenarios', scenariosRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/farms', farmsRouter);
  app.use('/api', metaRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
