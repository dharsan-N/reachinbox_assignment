import { createApp } from './app';
import { config } from './config/env';
import { runMigrations } from './database/migrate';
import { ElasticsearchService } from './services/elasticsearch.service';
import { getMailerTransporter } from './config/mailer';
import { startEmailWorker } from './workers/email.worker';
import { ReconciliationService } from './services/reconciliation.service';
import { db } from './config/db';
import { redisConnection, redisRateLimiter } from './config/redis';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('  ReachInbox Full-Stack Email Job Scheduler Backend ');
  console.log('----------------------------------------------------');

  try {
    // 1. Run database migrations & seed demo data
    await runMigrations();

    // 2. Initialize Elasticsearch Index
    await ElasticsearchService.initIndex();

    // 3. Initialize Ethereal SMTP Mailer Transporter
    await getMailerTransporter();

    // 4. Start BullMQ Email Worker Process
    const worker = startEmailWorker();

    // 5. Start Continuous Reconciliation & Scheduler Heartbeat
    ReconciliationService.startHeartbeat();
    await ReconciliationService.reconcilePendingJobs();

    // 6. Start HTTP Server
    const app = createApp();
    const server = app.listen(config.port, () => {
      console.log(`Server listening at http://localhost:${config.port}`);
      console.log(`API Base URL: http://localhost:${config.port}/api`);
      console.log(`BullMQ Live Dashboard: http://localhost:${config.port}/admin/queues`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await worker.close();
          await db.end();
          redisConnection.disconnect();
          redisRateLimiter.disconnect();
          console.log('All connections closed cleanly. Process exited.');
          process.exit(0);
        } catch (err) {
          console.error('Error during graceful shutdown:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
