import { Response } from 'express';
import { EmailService } from '../services/email.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ScheduleEmailPayload, EmailJobStatus } from '../types';

export class EmailController {
  public static async scheduleEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const payload: ScheduleEmailPayload = req.body;

      if (!payload.recipients || !Array.isArray(payload.recipients) || payload.recipients.length === 0) {
        res.status(400).json({ error: 'Recipients array is required and must not be empty.' });
        return;
      }

      if (!payload.subject || !payload.subject.trim()) {
        res.status(400).json({ error: 'Subject is required.' });
        return;
      }

      if (!payload.body || !payload.body.trim()) {
        res.status(400).json({ error: 'Email body is required.' });
        return;
      }

      const result = await EmailService.scheduleEmails(userId, payload);
      res.status(201).json(result);
    } catch (err: any) {
      console.error('Failed to schedule emails:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  public static async getScheduledEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await EmailService.getScheduledEmails(userId, page, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getSentEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const result = await EmailService.getSentEmails(userId, page, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async searchEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const q = req.query.q as string;
      const status = req.query.status as EmailJobStatus | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const senderEmail = req.query.senderEmail as string | undefined;

      const result = await ElasticsearchService.searchEmails(userId, {
        q,
        status,
        page,
        limit,
        senderEmail,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async cancelScheduledEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const success = await EmailService.cancelScheduledEmail(userId, id);
      if (!success) {
        res.status(404).json({ error: 'Scheduled email not found or already sent/cancelled' });
        return;
      }

      res.json({ success: true, message: 'Email schedule cancelled' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const stats = await EmailService.getStats(userId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
