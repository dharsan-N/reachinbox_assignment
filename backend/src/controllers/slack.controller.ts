import { Request, Response } from 'express';
import { SlackService } from '../services/slack.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { config } from '../config/env';

export class SlackController {
  public static async getAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || 'demo_user_id';
      const url = SlackService.getAuthorizationUrl(userId);
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing code in Slack callback' });
      return;
    }

    const userId = (state as string) || 'demo_user_id';

    try {
      await SlackService.handleOAuthCallback(code, userId);
      res.redirect(`${config.clientUrl}?slack=connected`);
    } catch (err: any) {
      console.error('Slack OAuth error:', err.message);
      res.redirect(`${config.clientUrl}?error=slack_connection_failed`);
    }
  }

  public static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const connection = await SlackService.getConnection(userId);
      res.json({
        connected: !!connection,
        connection: connection
          ? {
              teamName: connection.team_name,
              channel: connection.channel,
              connectedAt: connection.created_at,
            }
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async disconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      await SlackService.disconnect(userId);
      res.json({ success: true, message: 'Slack disconnected successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async testNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthenticated' });
        return;
      }

      const delivered = await SlackService.sendRateLimitNotification(
        userId,
        'test-sender@reachinbox.ai',
        5,
        new Date(Date.now() + 3600000).toISOString()
      );

      res.json({ success: delivered, message: delivered ? 'Slack alert sent' : 'Slack not connected or already alerted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
