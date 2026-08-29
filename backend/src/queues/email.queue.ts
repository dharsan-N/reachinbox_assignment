import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  emailJobId: string;
  userId: string;
  senderId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
  idempotencyKey: string;
  scheduledAt: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep for 24h for dashboard visibility
      count: 2000,
    },
    removeOnFail: false,
  },
});

emailQueue.on('error', (err) => {
  console.error('BullMQ Email Queue error:', err);
});
