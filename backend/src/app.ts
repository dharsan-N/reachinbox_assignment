import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queues/email.queue';
import { config } from './config/env';
import apiRouter from './routes';

export function createApp(): Express {
  const app = express();

  // Permissive and resilient CORS for all onrender.com and local origins
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (
          !requestOrigin ||
          requestOrigin.includes('localhost') ||
          requestOrigin.includes('127.0.0.1') ||
          requestOrigin.includes('onrender.com') ||
          requestOrigin === config.clientUrl ||
          requestOrigin.replace(/\/$/, '') === config.clientUrl.replace(/\/$/, '')
        ) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Bull-Board Queue Dashboard Mount
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter: serverAdapter,
  });

  app.get('/admin', (req: Request, res: Response) => res.redirect('/admin/queues/'));
  app.get('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
    if (!req.originalUrl.endsWith('/')) {
      return res.redirect(301, '/admin/queues/');
    }
    next();
  });
  app.use('/admin/queues', serverAdapter.getRouter());
  console.log('BullMQ Live Dashboard mounted at /admin/queues/');

  // Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'reachinbox-scheduler-backend',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // API Routes
  app.use('/api', apiRouter);

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}
