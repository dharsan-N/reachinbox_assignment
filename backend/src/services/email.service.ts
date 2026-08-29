import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/db';
import { emailQueue, EmailJobData } from '../queues/email.queue';
import { isRedisAvailable } from '../config/redis';
import { ElasticsearchService } from './elasticsearch.service';
import { EmailJob, EmailJobStatus, ScheduleEmailPayload } from '../types';
import { config } from '../config/env';
import nodemailer from 'nodemailer';
import { getMailerTransporter } from '../config/mailer';

export class EmailService {
  public static async scheduleEmails(
    userId: string,
    payload: ScheduleEmailPayload
  ): Promise<{ scheduledCount: number; jobs: EmailJob[] }> {
    const {
      senderId,
      senderEmail = 'outreach@reachinbox.ai',
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmailsMs = config.queue.minEmailDelayMs,
      hourlyLimit = config.queue.maxEmailsPerHour,
    } = payload;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one recipient email address is required.');
    }
    if (!subject || !subject.trim()) {
      throw new Error('Subject is required.');
    }
    if (!body || !body.trim()) {
      throw new Error('Body is required.');
    }

    const uniqueRecipients = Array.from(new Set(recipients.map((r) => r.trim().toLowerCase())));

    const now = Date.now();
    const parsedStartTime = startTime ? new Date(startTime).getTime() : now;
    const initialDelayMs = Math.max(0, parsedStartTime - now);

    const createdJobs: EmailJob[] = [];

    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipient = uniqueRecipients[i];
      const jobDelayMs = initialDelayMs + i * delayBetweenEmailsMs;
      const scheduledDate = new Date(now + jobDelayMs);
      const idempotencyKey = `${userId}-${recipient}-${Date.now()}-${uuidv4().slice(0, 8)}`;
      const emailJobId = uuidv4();

      // 1. Insert into database
      const dbRes = await db.query(
        `INSERT INTO email_jobs (
          id, user_id, sender_id, sender_email, recipient_email, subject, body,
          status, scheduled_at, delay_between_emails_ms, hourly_limit,
          idempotency_key, bull_job_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          emailJobId,
          userId,
          senderId || null,
          senderEmail,
          recipient,
          subject,
          body,
          'SCHEDULED',
          scheduledDate,
          delayBetweenEmailsMs,
          hourlyLimit,
          idempotencyKey,
          null,
        ]
      );

      const emailJob: EmailJob = dbRes.rows[0];

      // 2. Enqueue in BullMQ delayed queue if Redis is available
      const jobData: EmailJobData = {
        emailJobId: emailJob.id,
        userId,
        senderId,
        senderEmail,
        recipientEmail: recipient,
        subject,
        body,
        hourlyLimit,
        delayBetweenEmailsMs,
        idempotencyKey,
        scheduledAt: scheduledDate.toISOString(),
      };

      try {
        const bullJob = await Promise.race([
          emailQueue.add('send-scheduled-email', jobData, {
            delay: jobDelayMs,
            jobId: emailJob.id,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);

        if (bullJob) {
          await db.query('UPDATE email_jobs SET bull_job_id = $1 WHERE id = $2', [bullJob.id, emailJob.id]);
          emailJob.bull_job_id = bullJob.id;
        }
      } catch (queueErr: any) {
        console.warn(`[BullMQ] Queue dispatch notice: ${queueErr.message}. DB reconciliation scheduler active.`);
      }

      // 3. Index to Elasticsearch
      await ElasticsearchService.indexEmail(emailJob);

      createdJobs.push(emailJob);
    }

    console.log(
      `[EmailService] Scheduled ${createdJobs.length} emails starting at ${new Date(
        now + initialDelayMs
      ).toISOString()}`
    );

    return {
      scheduledCount: createdJobs.length,
      jobs: createdJobs,
    };
  }

  public static async getScheduledEmails(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: EmailJob[]; total: number }> {
    const offset = (page - 1) * limit;

    const countRes = await db.query(
      `SELECT COUNT(*) FROM email_jobs
       WHERE user_id = $1 AND status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'PROCESSING')`,
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await db.query(
      `SELECT * FROM email_jobs
       WHERE user_id = $1 AND status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'PROCESSING')
       ORDER BY scheduled_at ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { items: res.rows, total };
  }

  public static async getSentEmails(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ items: EmailJob[]; total: number }> {
    const offset = (page - 1) * limit;

    const countRes = await db.query(
      `SELECT COUNT(*) FROM email_jobs
       WHERE user_id = $1 AND status IN ('SENT', 'FAILED')`,
      [userId]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const res = await db.query(
      `SELECT * FROM email_jobs
       WHERE user_id = $1 AND status IN ('SENT', 'FAILED')
       ORDER BY sent_at DESC NULLS LAST, updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { items: res.rows, total };
  }

  public static async cancelScheduledEmail(userId: string, emailJobId: string): Promise<boolean> {
    const res = await db.query(
      `UPDATE email_jobs
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
       RETURNING *`,
      [emailJobId, userId]
    );

    if (res.rowCount === 0) {
      return false;
    }

    try {
      if (isRedisAvailable()) {
        const bullJob = await Promise.race([
          emailQueue.getJob(emailJobId),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
        ]);
        if (bullJob) {
          await bullJob.remove();
        }
      }
    } catch {}

    await ElasticsearchService.indexEmail(res.rows[0]);
    return true;
  }

  public static async getStats(userId: string) {
    let dbStats = {
      scheduled_count: '0',
      sent_count: '0',
      failed_count: '0',
      rescheduled_count: '0',
      total_count: '0',
    };

    try {
      const res = await db.query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'SCHEDULED') AS scheduled_count,
          COUNT(*) FILTER (WHERE status = 'SENT') AS sent_count,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count,
          COUNT(*) FILTER (WHERE status = 'RATE_LIMITED_RESCHEDULED') AS rescheduled_count,
          COUNT(*) AS total_count
         FROM email_jobs
         WHERE user_id = $1`,
        [userId]
      );
      if (res.rows[0]) {
        dbStats = res.rows[0];
      }
    } catch {}

    let queueStats = { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 };
    try {
      if (isRedisAvailable()) {
        queueStats = (await Promise.race([
          emailQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed'),
          new Promise((resolve) => setTimeout(() => resolve(queueStats), 1000)),
        ])) as any;
      }
    } catch {}

    return {
      dbStats,
      queueStats,
    };
  }
}
