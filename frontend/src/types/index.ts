export type EmailJobStatus =
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED'
  | 'RATE_LIMITED_RESCHEDULED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface Sender {
  id: string;
  user_id: string;
  name: string;
  email: string;
  hourly_limit: number;
}

export interface SlackConnectionInfo {
  connected: boolean;
  connection?: {
    teamName?: string;
    channel?: string;
    connectedAt?: string;
  } | null;
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
  scheduled_at: string;
  sent_at?: string;
  delay_between_emails_ms: number;
  hourly_limit: number;
  bull_job_id?: string;
  idempotency_key: string;
  ethereal_message_id?: string;
  ethereal_preview_url?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface SchedulePayload {
  senderId?: string;
  senderEmail?: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

export interface DashboardStats {
  dbStats: {
    scheduled_count: string;
    sent_count: string;
    failed_count: string;
    rescheduled_count: string;
    total_count: string;
  };
  queueStats: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
  };
}
