import { db } from '../config/db';
import { emailQueue, EmailJobData } from '../queues/email.queue';
import { isRedisAvailable } from '../config/redis';
import { EmailJob } from '../types';
import { getTransporterForSender } from '../config/mailer';
import { ElasticsearchService } from './elasticsearch.service';
import nodemailer from 'nodemailer';

export class ReconciliationService {
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  public static startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    // Immediately check and start 2.5s heartbeat
    this.processDuePendingEmails();
    this.heartbeatInterval = setInterval(() => {
      this.processDuePendingEmails();
    }, 2500);
    console.log('[Reconciliation] Continuous scheduler heartbeat active (2.5s interval).');
  }

  public static async processDuePendingEmails(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const res = await db.query(
        `SELECT * FROM email_jobs
         WHERE status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
           AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 30`
      );

      for (const job of res.rows) {
        try {
          // Check sender hourly limit
          const hourCountRes = await db.query(
            `SELECT COUNT(*) FROM email_jobs
             WHERE sender_email = $1 AND status = 'SENT' AND sent_at >= NOW() - INTERVAL '1 hour'`,
            [job.sender_email]
          );
          const currentSentInHour = parseInt(hourCountRes.rows[0]?.count || '0', 10);
          const limit = job.hourly_limit || 200;

          if (currentSentInHour >= limit) {
            const nextHour = new Date(Date.now() + 3600000);
            console.warn(`[RateLimit] Sender ${job.sender_email} reached hourly limit (${currentSentInHour}/${limit}). Rescheduling ${job.id}`);
            await db.query(
              `UPDATE email_jobs
               SET status = 'RATE_LIMITED_RESCHEDULED', scheduled_at = $2, updated_at = NOW()
               WHERE id = $1`,
              [job.id, nextHour]
            );
            continue;
          }

          // Claim job atomically
          const claim = await db.query(
            `UPDATE email_jobs
             SET status = 'PROCESSING', updated_at = NOW()
             WHERE id = $1 AND status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
             RETURNING *`,
            [job.id]
          );

          if (claim.rowCount === 0) continue;

          console.log(`[Scheduler] Delivering due email ${job.id} to recipient: ${job.recipient_email}`);

          const { transporter, isRealGmail } = await getTransporterForSender(job.user_id, job.sender_email);
          const info = await transporter.sendMail({
            from: `"${job.sender_email.split('@')[0]}" <${job.sender_email}>`,
            to: job.recipient_email,
            subject: job.subject,
            text: job.body,
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${job.body.replace(/\n/g, '<br/>')}</div>`,
          });

          let previewUrl: string | undefined = undefined;
          if (!isRealGmail) {
            previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
          }

          const updateRes = await db.query(
            `UPDATE email_jobs
             SET status = 'SENT', sent_at = NOW(), ethereal_message_id = $2, ethereal_preview_url = $3, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [job.id, info.messageId || 'msg_' + Date.now(), previewUrl]
          );

          const updatedJob = updateRes.rows[0];
          console.log(`[Scheduler] Delivered email ${job.id} to ${job.recipient_email}. (Transport: ${isRealGmail ? 'Real Gmail' : 'Ethereal SMTP'})`);
          if (previewUrl) {
            console.log(`[Scheduler] Ethereal Preview URL: ${previewUrl}`);
          }

          if (updatedJob) {
            await ElasticsearchService.indexEmail(updatedJob);
          }
        } catch (err: any) {
          console.error(`[Scheduler] Error sending email ${job.id}:`, err.message);
          await db.query(
            `UPDATE email_jobs
             SET status = 'FAILED', error_message = $2, retry_count = retry_count + 1, updated_at = NOW()
             WHERE id = $1`,
            [job.id, err.message]
          );
        }
      }
    } catch (err: any) {
      console.warn('[Reconciliation] Error scanning due jobs:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  public static async reconcilePendingJobs(): Promise<void> {
    console.log('[Reconciliation] Checking for uncompleted scheduled jobs in PostgreSQL...');

    try {
      // First process any overdue emails
      await this.processDuePendingEmails();

      if (isRedisAvailable()) {
        const res = await db.query(
          `SELECT * FROM email_jobs
           WHERE status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
           ORDER BY scheduled_at ASC`
        );

        const pendingJobs: EmailJob[] = res.rows;
        console.log(`[Reconciliation] Found ${pendingJobs.length} scheduled jobs in database.`);

        for (const job of pendingJobs) {
          const scheduledTime = new Date(job.scheduled_at).getTime();
          const now = Date.now();
          const delayMs = Math.max(0, scheduledTime - now);

          try {
            const existingJob = await Promise.race([
              emailQueue.getJob(job.id),
              new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
            ]);

            if (!existingJob) {
              const jobData: EmailJobData = {
                emailJobId: job.id,
                userId: job.user_id,
                senderId: job.sender_id,
                senderEmail: job.sender_email,
                recipientEmail: job.recipient_email,
                subject: job.subject,
                body: job.body,
                hourlyLimit: job.hourly_limit,
                delayBetweenEmailsMs: job.delay_between_emails_ms,
                idempotencyKey: job.idempotency_key,
                scheduledAt: new Date(job.scheduled_at).toISOString(),
              };

              await Promise.race([
                emailQueue.add('send-scheduled-email', jobData, {
                  delay: delayMs,
                  jobId: job.id,
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
              ]);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('[Reconciliation] Error during job sync:', err.message);
    }
  }
}

