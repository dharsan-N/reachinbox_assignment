import { db } from '../config/db';
import { emailQueue, EmailJobData } from '../queues/email.queue';
import { EmailJob } from '../types';
import { getTransporterForSender } from '../config/mailer';
import nodemailer from 'nodemailer';

export class ReconciliationService {
  public static async processDuePendingEmails(): Promise<void> {
    try {
      const res = await db.query(
        `SELECT * FROM email_jobs
         WHERE status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
           AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 20`
      );

      for (const job of res.rows) {
        try {
          // Claim job atomically
          const claim = await db.query(
            `UPDATE email_jobs
             SET status = 'PROCESSING', updated_at = NOW()
             WHERE id = $1 AND status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
             RETURNING *`,
            [job.id]
          );

          if (claim.rowCount === 0) continue;

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

          await db.query(
            `UPDATE email_jobs
             SET status = 'SENT', sent_at = NOW(), ethereal_message_id = $2, ethereal_preview_url = $3, updated_at = NOW()
             WHERE id = $1`,
            [job.id, info.messageId, previewUrl]
          );

          console.log(`[Reconciliation] Successfully delivered pending email to ${job.recipient_email}. Preview: ${previewUrl}`);
        } catch (err: any) {
          console.error(`[Reconciliation] Error sending pending email ${job.id}:`, err.message);
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
    }
  }

  public static async reconcilePendingJobs(): Promise<void> {
    console.log('[Reconciliation] Checking for uncompleted scheduled jobs in PostgreSQL...');

    try {
      // First process any overdue emails
      await this.processDuePendingEmails();

      const res = await db.query(
        `SELECT * FROM email_jobs
         WHERE status IN ('SCHEDULED', 'RATE_LIMITED_RESCHEDULED')
         ORDER BY scheduled_at ASC`
      );

      const pendingJobs: EmailJob[] = res.rows;
      console.log(`[Reconciliation] Found ${pendingJobs.length} future scheduled jobs in database.`);

      let reEnqueuedCount = 0;

      for (const job of pendingJobs) {
        const scheduledTime = new Date(job.scheduled_at).getTime();
        const now = Date.now();
        const delayMs = Math.max(0, scheduledTime - now);

        try {
          const existingJob = await emailQueue.getJob(job.id);
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

            await emailQueue.add('send-scheduled-email', jobData, {
              delay: delayMs,
              jobId: job.id,
            });

            reEnqueuedCount++;
          }
        } catch {
          // If Redis is offline, schedule in-memory timeout
          setTimeout(() => {
            ReconciliationService.processDuePendingEmails();
          }, Math.min(delayMs, 5000));
        }
      }

      console.log(`[Reconciliation] Reconciled and validated ${reEnqueuedCount} jobs.`);
    } catch (err: any) {
      console.error('[Reconciliation] Error reconciling pending jobs:', err.message);
    }

    // Set a lightweight heartbeat ticker every 3s to guarantee immediate dispatch of due emails
    setInterval(() => {
      ReconciliationService.processDuePendingEmails();
    }, 3000);
  }
}
