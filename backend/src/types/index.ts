export type EmailJobStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'RATE_LIMITED_RESCHEDULED';

export interface User {
  id: string;
  google_id?: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Sender {
  id: string;
  user_id: string;
  name: string;
  email: string;
  hourly_limit: number;
  created_at: Date;
}

export interface SlackConnection {
  id: string;
  user_id: string;
  team_id?: string;
  team_name?: string;
  incoming_webhook_url?: string;
  bot_token?: string;
  channel?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EmailJob {
  id: string;
  user_id: string;
  sender_id?: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: EmailJobStatus;
  scheduled_at: Date;
  sent_at?: Date;
  delay_between_emails_ms: number;
  hourly_limit: number;
  bull_job_id?: string;
  idempotency_key: string;
  ethereal_message_id?: string;
  ethereal_preview_url?: string;
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduleEmailPayload {
  senderId?: string;
  senderEmail?: string;
  senderName?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string; // ISO String or null (defaults to now)
  delayBetweenEmailsMs?: number; // Minimum delay between each email
  hourlyLimit?: number; // Hourly cap per sender / batch
}

export interface EmailSearchQuery {
  q?: string;
  status?: EmailJobStatus;
  page?: number;
  limit?: number;
  senderEmail?: string;
}
