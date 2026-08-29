import axios from 'axios';
import { WebClient } from '@slack/web-api';
import { config } from '../config/env';
import { db } from '../config/db';
import { redisRateLimiter } from '../config/redis';

export class SlackService {
  public static getAuthorizationUrl(userId: string): string {
    const scopes = ['incoming-webhook', 'chat:write'].join(',');
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', config.slack.clientId || 'mock_slack_client_id');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('redirect_uri', config.slack.redirectUri);
    url.searchParams.set('state', userId);
    return url.toString();
  }

  public static async handleOAuthCallback(code: string, userId: string) {
    if (!config.slack.clientId || !config.slack.clientSecret) {
      // If Slack credentials are not configured in dev, save a mock connection so the UI can be tested
      console.warn('SLACK_CLIENT_ID or SLACK_CLIENT_SECRET missing in .env. Storing demo Slack connection.');
      const res = await db.query(
        `INSERT INTO slack_connections (user_id, team_id, team_name, channel, incoming_webhook_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE 
         SET team_name = EXCLUDED.team_name, channel = EXCLUDED.channel, incoming_webhook_url = EXCLUDED.incoming_webhook_url, updated_at = NOW()
         RETURNING *`,
        [
          userId,
          'T_MOCK_TEAM_123',
          'ReachInbox Workspace',
          '#outreach-alerts',
          'https://hooks.slack.com/services/MOCK/WEBHOOK/123456',
        ]
      );
      return res.rows[0];
    }

    try {
      const response = await axios.post(
        'https://slack.com/api/oauth.v2.access',
        new URLSearchParams({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const data = response.data;
      if (!data.ok) {
        throw new Error(`Slack OAuth error: ${data.error}`);
      }

      const teamId = data.team?.id;
      const teamName = data.team?.name;
      const botToken = data.access_token;
      const webhookUrl = data.incoming_webhook?.url;
      const channel = data.incoming_webhook?.channel || data.incoming_webhook?.channel_id || '#general';

      const res = await db.query(
        `INSERT INTO slack_connections (user_id, team_id, team_name, bot_token, incoming_webhook_url, channel)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE 
         SET team_id = EXCLUDED.team_id, team_name = EXCLUDED.team_name, bot_token = EXCLUDED.bot_token,
             incoming_webhook_url = EXCLUDED.incoming_webhook_url, channel = EXCLUDED.channel, updated_at = NOW()
         RETURNING *`,
        [userId, teamId, teamName, botToken, webhookUrl, channel]
      );

      return res.rows[0];
    } catch (err: any) {
      console.error('Failed to complete Slack OAuth exchange:', err.message);
      throw err;
    }
  }

  public static async getConnection(userId: string) {
    const res = await db.query('SELECT * FROM slack_connections WHERE user_id = $1', [userId]);
    return res.rows[0] || null;
  }

  public static async disconnect(userId: string) {
    await db.query('DELETE FROM slack_connections WHERE user_id = $1', [userId]);
    return { success: true };
  }

  public static async sendRateLimitNotification(
    userId: string,
    senderEmail: string,
    hourlyLimit: number,
    nextWindowIso: string
  ): Promise<boolean> {
    const connection = await this.getConnection(userId);
    if (!connection) {
      console.log(`[Slack] No Slack connection for user ${userId}. Skipping alert.`);
      return false;
    }

    const hourBucket = Math.floor(Date.now() / 3600000);
    const dedupeKey = `slack_notified:${senderEmail}:${hourBucket}`;
    const alreadyNotified = await redisRateLimiter.get(dedupeKey);

    if (alreadyNotified) {
      console.log(`[Slack] Rate limit alert already sent for ${senderEmail} in current hour window.`);
      return true;
    }

    const messagePayload = {
      text: `🚨 *ReachInbox Rate Limit Alert*: Sender \`${senderEmail}\` exceeded hourly limit of ${hourlyLimit} emails/hour. Remaining emails have been safely rescheduled to ${nextWindowIso}.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 ReachInbox Rate Limit Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${hourlyLimit} emails/hour`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nRescheduled Automatically`,
            },
            {
              type: 'mrkdwn',
              text: `*Next Execution Window:*\n${new Date(nextWindowIso).toLocaleTimeString()}`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '💡 _ReachInbox Email Scheduler automatically preserves job order and resumes sending at the start of the next hour window._',
            },
          ],
        },
      ],
    };

    try {
      if (connection.incoming_webhook_url) {
        console.log(`[Slack] Dispatching real HTTP POST to Slack Webhook URL: ${connection.incoming_webhook_url}`);
        await axios.post(connection.incoming_webhook_url, messagePayload);
      } else if (connection.bot_token) {
        console.log(`[Slack] Dispatching message via Slack WebClient for channel: ${connection.channel}`);
        const slackClient = new WebClient(connection.bot_token);
        await slackClient.chat.postMessage({
          channel: connection.channel || '#general',
          ...messagePayload,
        });
      }

      // Mark notified for this hour window (TTL 3600 seconds)
      await redisRateLimiter.set(dedupeKey, '1', 'EX', 3600);
      console.log(`[Slack] Successfully delivered rate limit alert for ${senderEmail}`);
      return true;
    } catch (err: any) {
      console.error(`[Slack] Error delivering Slack notification:`, err.message);
      return false;
    }
  }
}
