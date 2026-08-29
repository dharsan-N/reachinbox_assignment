import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export async function runMigrations() {
  console.log('Running database schema migrations...');

  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  } catch {
    // Ignore if extension creation is not permitted or already handled
  }

  const schemaSql = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      google_id VARCHAR(255) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Senders Table
    CREATE TABLE IF NOT EXISTS senders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      hourly_limit INT DEFAULT 200,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Slack Connections Table
    CREATE TABLE IF NOT EXISTS slack_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      team_id VARCHAR(255),
      team_name VARCHAR(255),
      incoming_webhook_url TEXT,
      bot_token TEXT,
      channel VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Email Jobs Table
    CREATE TABLE IF NOT EXISTS email_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES senders(id) ON DELETE SET NULL,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
      scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
      sent_at TIMESTAMP WITH TIME ZONE,
      delay_between_emails_ms INT DEFAULT 2000,
      hourly_limit INT DEFAULT 200,
      bull_job_id VARCHAR(255),
      idempotency_key VARCHAR(255) UNIQUE NOT NULL,
      ethereal_message_id VARCHAR(255),
      ethereal_preview_url TEXT,
      error_message TEXT,
      retry_count INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  try {
    await db.query(schemaSql);
    console.log('Database schema successfully migrated.');

    // Seed default demo user and senders
    const usersRes = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersRes.rows[0].count, 10) === 0) {
      const demoUserId = uuidv4();
      await db.query(
        `INSERT INTO users (id, email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          demoUserId,
          'oliver.brown@email.io',
          'Oliver Brown',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          'demo_google_id_123',
        ]
      );

      const sendersToSeed = [
        { name: 'Oliver Brown', email: 'oliver.brown@email.io', limit: 200 },
        { name: 'Sarah Outreach', email: 'sarah@reachinbox.ai', limit: 200 },
        { name: 'Enterprise BD Team', email: 'sales@reachinbox.ai', limit: 300 },
      ];

      for (const s of sendersToSeed) {
        await db.query(
          `INSERT INTO senders (id, user_id, name, email, hourly_limit)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), demoUserId, s.name, s.email, s.limit]
        );
      }
      console.log('Database seeded with default demo user and senders.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
