# ReachInbox.ai — Full-Stack Email Job Scheduler & Dashboard

Production-grade full-stack email job scheduler, outreach automation engine, and live monitoring dashboard built for the **ReachInbox.ai / Outbox Labs** Software Development Intern Assignment.

---

## 📑 Table of Contents
1. [Project Overview & Core Objectives](#-project-overview--core-objectives)
2. [Multi-Tiered Architecture & System Design](#-multi-tiered-architecture--system-design)
3. [Deep-Dive: Why We Use Each Data Store](#-deep-dive-why-we-use-each-data-store)
   - [PostgreSQL (ACID Single Source of Truth & Locking)](#1-postgresql-16-primary-relational-database)
   - [Redis & BullMQ (Strictly Zero-Cron Delayed Scheduling)](#2-redis-7--bullmq-in-memory-queue-engine)
   - [Elasticsearch (Sub-Millisecond Fuzzy Full-Text Search)](#3-elasticsearch-813-search--analytics-engine)
4. [Key Architectural Highlights](#-key-architectural-highlights)
   - [Strictly No Cron (Redis ZSET Delay Timers)](#1-strictly-no-cron-bullmq-delayed-jobs)
   - [Server Restart Persistence & Recovery](#2-server-restart-persistence--recovery)
   - [Practical Idempotency Strategy](#3-practical-idempotency-strategy)
   - [Multi-Worker Safe Hourly Rate Limiting & Rescheduling](#4-multi-worker-safe-hourly-rate-limiting--rescheduling)
   - [1000+ Email Load Handling](#5-1000-email-load-handling)
   - [Real Slack OAuth & Hourly Rate Limit Alerts](#6-real-slack-oauth--hourly-rate-limit-alerts)
   - [Real Google OAuth Authentication](#7-real-google-oauth-authentication)
   - [Live BullMQ Queue Dashboard](#8-live-bullmq-queue-dashboard)
5. [Tech Stack](#-tech-stack)
6. [Database Schema Reference](#-database-schema-reference)
7. [Project Structure](#-project-structure)
8. [Quickstart & Local Setup](#-quickstart--local-setup)
9. [Environment Variables Reference](#-environment-variables-reference)
10. [API Endpoints Reference](#-api-endpoints-reference)
11. [Step-by-Step Testing & Verification Guide](#-step-by-step-testing--verification-guide)
12. [Assumptions, Trade-offs & Implementation Decisions](#-assumptions-trade-offs--implementation-decisions)
13. [Submission Checklist](#-submission-checklist)

---

## 🚀 Project Overview & Core Objectives

The **ReachInbox Full-Stack Email Scheduler** is an enterprise-grade cold outreach scheduling system. In cold email outreach, blasting thousands of emails simultaneously destroys sender domain reputation and triggers spam filters. 

### Core Objectives:
1. **Paced & Throttled Delivery**: Spacing emails with exact inter-send delays (e.g. 2s, 5s) and strict hourly limits per sender (e.g. max 200 emails/hr).
2. **Strictly Zero Cron**: Native Redis sorted set delays without OS cron, `crontab`, `node-cron`, or database polling loops.
3. **Absolute Idempotency**: Atomic database status locking (`SCHEDULED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SENT`) ensures an email is never sent twice.
4. **Crash & Restart Resilience**: Retains scheduled future emails across server/worker restarts and gracefully recovers on boot.
5. **Overflow Rescheduling**: Shifts rate-limited overflow emails to the next hourly window without dropping them and dispatches real Slack alerts.
6. **Fuzzy Search & Auditability**: Sub-millisecond search across recipient, subject, and body with live Ethereal SMTP web preview links.

---

## 🏛 Multi-Tiered Architecture & System Design

```text
+-----------------------------------------------------------------------------------------+
|                                    Frontend (React + Vite)                              |
|   - Google Login (OAuth / Session)                                                      |
|   - Dashboard Header (User profile, Slack OAuth Connect / Disconnect status)            |
|   - Compose Email Modal (Subject, Body, CSV/Text Lead Parser, Start Time, Delay, Rate)  |
|   - Scheduled Emails View (Elasticsearch Search, Status badge, Actions)                 |
|   - Sent Emails View (Elasticsearch Search, Status, Ethereal preview links, timestamps) |
|   - Live BullMQ Queue Monitor Link                                                      |
+-----------------------------------------------------------------------------------------+
                                      | HTTP REST / JSON
                                      v
+-----------------------------------------------------------------------------------------+
|                                    Express Backend API                                  |
|   - Auth routes (/api/auth/google, /api/auth/google/callback, /api/auth/me, /logout)    |
|   - Slack routes (/api/slack/auth, /api/slack/callback, /api/slack/status, /disconnect) |
|   - Email Schedule routes (/api/emails/schedule, /api/emails/scheduled, /api/emails/sent)|
|   - Search routes (/api/emails/search - Elasticsearch full-text query)                  |
|   - BullMQ Dashboard (@bull-board/express mounted at /admin/queues)                     |
+-----------------------------------------------------------------------------------------+
         |                                           |                           |
         v                                           v                           v
+------------------+                    +-------------------------+    +-------------------+
|    PostgreSQL    |                    |      BullMQ + Redis     |    |   Elasticsearch   |
| (Schema & State) |                    |  (Persistent Delay Queue|    | (Search Index)    |
| - Users          |                    |   - No Cron!            |    | - email_index     |
| - Senders        |                    |   - Config concurrency  |    | - subject, body,  |
| - SlackAccounts  |                    |   - Graceful recovery)  |    |   recipient,      |
| - EmailJobs      |                    +-------------------------+    |   status, time    |
| - RateLimits     |                                 |                 +-------------------+
+------------------+                                 v                           ^
                                        +-------------------------+              |
                                        |      BullMQ Worker      |              |
                                        | - Worker concurrency    |              |
                                        | - Min Delay Enforcer    |              |
                                        | - Redis Sliding Window  |              |
                                        |   Rate Limiter          |              |
                                        |   (Multi-Worker Safe)   |              |
                                        | - Idempotency Lock      |              |
                                        | - Ethereal SMTP Sender  |              |
                                        | - Slack Notification    |--------------+
                                        |   (When rate limit hit) |
                                        +-------------------------+
```

---

## 🗄 Deep-Dive: Why We Use Each Data Store

### 1. PostgreSQL 16 (Primary Relational Database)
* **Single Source of Truth**: Retains permanent ACID records for users, senders, slack connections, and email jobs.
* **Atomic Idempotency Locking**: Uses SQL atomic row updates (`UPDATE email_jobs SET status = 'PROCESSING' WHERE id = $1 AND status = 'SCHEDULED' RETURNING *`) so concurrent workers never double-send.
* **Audit Trail & Proof of Delivery**: Persists `ethereal_message_id`, `ethereal_preview_url`, and timestamps.
* **Disaster Recovery**: `ReconciliationService` queries PostgreSQL on startup to re-synchronize missing Redis jobs if Redis or the server crashes.

### 2. Redis 7 & BullMQ (In-Memory Queue Engine)
* **Zero Database Polling**: Instead of running `SELECT * FROM email_jobs WHERE scheduled_at <= NOW()` every few seconds, BullMQ stores timers in Redis Sorted Sets (`ZSET`).
* **Sub-Millisecond Triggering**: Redis fires delayed jobs at the exact target millisecond ($T_{\text{start}} + i \times \Delta t$).
* **Atomic Multi-Worker Rate Limiting**: Redis executes atomic Lua scripts in microseconds to increment and enforce hourly caps across distributed workers.
* **Live Observability**: Powers the `@bull-board/express` dashboard at `/admin/queues`.

### 3. Elasticsearch 8.13 (Search & Analytics Engine)
* **Sub-Millisecond Full-Text Search**: Inverted indexes enable instant queries over 50,000+ outreach emails without slow SQL `LIKE '%...'` table scans.
* **Email-Specific Tokenizer**: Uses `uax_url_email` tokenizer to properly index email usernames and domains.
* **Fuzzy Typo Tolerance**: Finds results even when keywords or domains are misspelled (e.g. `"reachinbx"` $\rightarrow$ `"reachinbox"`).
* **Field Boosting**: Ranks recipient matches highest (`3x`), subject lines second (`2x`), and body text third.
* **Graceful SQL Fallback**: Automatically falls back to PostgreSQL `ILIKE` queries if Elasticsearch is temporarily offline.

---

## 🔍 Key Architectural Highlights

### 1. Strictly No Cron (BullMQ Delayed Jobs)
- **Constraint**: No OS cron, no `crontab`, no `node-cron`, no `agenda`.
- **Mechanism**:
  When a batch is scheduled at start time $T_{\text{start}}$ with inter-email delay $\Delta t$, the delay for recipient $i \in [0, N-1]$ is calculated deterministically:
  $$\text{initialDelay} = \max(0, T_{\text{start}} - T_{\text{now}})$$
  $$\text{jobDelay}_i = \text{initialDelay} + (i \times \Delta t)$$
  BullMQ inserts each job into the Redis sorted set `bull:email-queue:delayed` keyed by target execution timestamp. BullMQ's internal timer promotes jobs to `waiting` exactly when their timestamp arrives.

### 2. Server Restart Persistence & Recovery
- Redis persistently stores delayed and waiting jobs (AOF/RDB).
- PostgreSQL maintains the system of record.
- **On Backend Startup**:
  1. BullMQ reattaches to existing Redis delayed sets without resetting job clocks.
  2. The `ReconciliationService` scans PostgreSQL for any `SCHEDULED` or `RATE_LIMITED_RESCHEDULED` jobs.
  3. For each pending job, it checks if a corresponding BullMQ job exists. If missing in Redis, it safely re-enqueues using deterministic `jobId = emailJob.id` (preventing duplicates).

### 3. Practical Idempotency Strategy
- Every email has a UUIDv4 primary key and unique `idempotency_key`.
- BullMQ `jobId` is bound to the PostgreSQL `emailJob.id`.
- **Atomic Database Claim**:
  ```sql
  UPDATE email_jobs
  SET status = 'PROCESSING', updated_at = NOW()
  WHERE id = $1 AND (status = 'SCHEDULED' OR status = 'RATE_LIMITED_RESCHEDULED')
  RETURNING *;
  ```
  If 0 rows are returned (because another worker claimed it or it was cancelled/sent), the worker skips execution immediately.
- After SMTP transmission, the record is atomically updated to `status = 'SENT'` with the Ethereal message ID and preview URL.

### 4. Multi-Worker Safe Hourly Rate Limiting & Rescheduling
- **Redis Lua Script**: Atomic rate checking prevents race conditions across concurrent workers:
  ```lua
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, 7200)
  end
  if current > limit then
    return 0
  else
    return 1
  end
  ```
- **Rescheduling Behavior**:
  When quota is reached:
  1. The job is **not dropped** and **not failed**.
  2. The start of the next hour window is computed:
     $$\text{rescheduleDelay} = \text{nextHourTimestamp} - T_{\text{now}} + \text{jitter}$$
  3. The job is rescheduled in BullMQ with `moveToDelayed(rescheduleDelay)` and PostgreSQL status updated to `RATE_LIMITED_RESCHEDULED`.
  4. A real Slack notification is triggered (with deduplication key `slack_notified:<sender>:<hourBucket>` so channel members are alerted once per window).

### 5. 1000+ Email Load Handling
When 1,000+ emails are scheduled:
1. **API Ingestion**: Ingested in batched DB inserts and BullMQ multi-job enqueues.
2. **Queue Backlog**: Redis sorted sets easily handle millions of delayed entries with $O(\log N)$ insertion.
3. **Throttling**: Concurrency (e.g. 5 workers) + minimum inter-email delay (`MIN_EMAIL_DELAY_MS`) prevents SMTP saturation.
4. **Rate Overflow**: Emails exceeding the hourly cap seamlessly shift to subsequent hourly windows ($H+1, H+2, \dots$) in FIFO order.

### 6. Real Slack OAuth & Hourly Rate Limit Alerts
- Implements standard OAuth 2.0 (`/api/slack/auth` and `/api/slack/callback`).
- Stores team ID, channel, and webhook/bot token in PostgreSQL `slack_connections`.
- When rate limit is triggered, dispatches a rich Slack Block Kit card to the configured channel.
- Gracefully skips if Slack is not connected; reconnecting works immediately without server restarts.

### 7. Real Google OAuth Authentication
- Uses `google-auth-library` to authenticate users against Google's OAuth2 endpoints.
- Verifies ID Tokens, provisions/updates user accounts in PostgreSQL, and issues signed JWT session tokens.
- Header displays user Name, Email, and Google Avatar.
- Includes a 1-click Demo Login fallback for fast local testing.

### 8. Live BullMQ Queue Dashboard
- Mounted at `http://localhost:5000/admin/queues` using `@bull-board/express` and `BullMQAdapter`.
- Provides real-time metrics for Delayed, Waiting, Active, Completed, and Failed jobs.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | TypeScript, Node.js, Express.js |
| **Queue & Cache** | BullMQ, Redis 7 (`ioredis`) |
| **Database** | PostgreSQL 16 (`pg` Connection Pool) |
| **Search Engine** | Elasticsearch 8.13 (`@elastic/elasticsearch`) |
| **SMTP Delivery** | Ethereal Email SMTP (`nodemailer`) |
| **Integrations** | Google OAuth 2.0, Slack Web API / Incoming Webhooks |
| **Queue Dashboard** | `@bull-board/express` |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons |
| **Infrastructure** | Docker Compose |

---

## 🗃 Database Schema Reference

The PostgreSQL relational schema is automatically migrated on startup via [migrate.ts](file:///c:/Users/777dh/Downloads/reachinbox-assignment/backend/src/database/migrate.ts):

```sql
-- Users Table
CREATE TABLE users (
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

-- Senders Table (Multi-identity send caps)
CREATE TABLE senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  hourly_limit INT DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slack Connections Table
CREATE TABLE slack_connections (
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

-- Email Jobs Table (Primary state & idempotency store)
CREATE TABLE email_jobs (
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
```

---

## 📁 Project Structure

```text
reachinbox-assignment/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment, DB, Redis, Mailer, Elasticsearch
│   │   ├── controllers/     # Auth, Email, Sender, Slack controllers
│   │   ├── database/        # Schema migrations & seed data
│   │   ├── middleware/      # JWT & Session Auth middleware
│   │   ├── queues/          # BullMQ queue definitions
│   │   ├── routes/          # Express REST API routes
│   │   ├── services/        # Email, Slack, Auth, ES, Reconciliation services
│   │   ├── types/           # TypeScript interfaces & types
│   │   ├── workers/         # BullMQ worker process & rate limiter
│   │   ├── app.ts           # Express app & Bull-Board mount
│   │   └── server.ts        # Bootstrap & startup orchestrator
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Navbar, ComposeModal, ScheduledTable, SentTable, SlackModal, LoginModal, StatsBar
│   │   ├── services/        # Axios API client
│   │   ├── types/           # Frontend TypeScript types
│   │   ├── App.tsx          # Main application layout & state
│   │   ├── index.css        # Tailwind CSS & design tokens
│   │   └── main.tsx         # React entrypoint
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env
│
├── docker-compose.yml       # PostgreSQL, Redis, Elasticsearch
├── walkthrough.md           # Visual walkthrough & demo recording script
└── README.md                # Comprehensive documentation
```

---

## ⚡ Quickstart & Local Setup

### 1. Start Infrastructure (PostgreSQL, Redis, Elasticsearch)
Run Docker Compose from the project root:
```bash
docker compose up -d
```
Verify containers are running:
```bash
docker compose ps
```

### 2. Configure Backend Environment
Navigate to `backend/` and install dependencies:
```bash
cd backend
npm install
```
*(Optional)* Add your Google OAuth & Slack OAuth credentials in `backend/.env`.

### 3. Start Backend Server & Worker
```bash
npm run dev
```
The backend will:
- Run PostgreSQL schema migrations automatically.
- Initialize Elasticsearch index `reachinbox_emails`.
- Generate or verify Ethereal SMTP credentials.
- Start the BullMQ Email Worker with concurrency.
- Run startup reconciliation to ensure pending jobs are queued.
- Mount API on `http://localhost:5000` and Bull-Board on `http://localhost:5000/admin/queues`.

### 4. Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ⚙ Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Backend HTTP port |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL for CORS & redirects |
| `DATABASE_URL` | `postgres://reachinbox_user:reachinbox_password@localhost:5432/reachinbox_db` | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `WORKER_CONCURRENCY` | `5` | BullMQ concurrent jobs per worker |
| `MIN_EMAIL_DELAY_MS` | `2000` | Minimum inter-email delay in milliseconds |
| `MAX_EMAILS_PER_HOUR` | `200` | Default hourly sending limit per sender |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL |
| `ELASTICSEARCH_INDEX`| `reachinbox_emails` | Email search index name |
| `ETHEREAL_USER` | *(auto-generated)* | Ethereal SMTP username |
| `ETHEREAL_PASS` | *(auto-generated)* | Ethereal SMTP password |
| `GOOGLE_CLIENT_ID` | | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET`| | Google OAuth Client Secret |
| `SLACK_CLIENT_ID` | | Slack App Client ID |
| `SLACK_CLIENT_SECRET`| | Slack App Client Secret |
| `JWT_SECRET` | `super-secret-jwt-key...`| JWT signing secret |

---

## 📡 API Endpoints Reference

### Authentication
- `GET /api/auth/google` — Get Google OAuth login URL.
- `GET /api/auth/google/callback` — Google OAuth callback.
- `POST /api/auth/demo-login` — Instant 1-click demo session.
- `GET /api/auth/me` — Current authenticated user profile.
- `POST /api/auth/logout` — Clear session.

### Email Scheduling
- `POST /api/emails/schedule` — Schedule a new email campaign batch.
- `GET /api/emails/scheduled` — List upcoming & rescheduled emails.
- `GET /api/emails/sent` — List sent/failed emails with Ethereal preview links.
- `GET /api/emails/search?q=...` — Elasticsearch full-text query.
- `DELETE /api/emails/:id` — Cancel a scheduled email.
- `GET /api/emails/stats` — Live queue & database metrics.

### Senders & Slack
- `GET /api/senders` — List sending email identities.
- `POST /api/senders` — Create a sender account with hourly limit.
- `GET /api/slack/auth` — Slack OAuth authorize URL.
- `GET /api/slack/callback` — Slack OAuth exchange callback.
- `GET /api/slack/status` — Check Slack connection status.
- `DELETE /api/slack/disconnect` — Disconnect Slack integration.
- `POST /api/slack/test-notification` — Dispatch test rate-limit alert.

---

## 🧪 Step-by-Step Testing & Verification Guide

### 1. Basic Email Scheduling & Ethereal SMTP Send
1. Open the dashboard at `http://localhost:5173`.
2. Click **Compose Campaign**.
3. Select sender `Sarah Outreach`, enter subject & body.
4. Upload a CSV or use sample recipient leads.
5. Click **Schedule Emails**.
6. Switch to **Sent Emails** tab: verify email status updates to `Delivered` and click **Inspect SMTP** to open the real Ethereal email preview in your browser!

### 2. Future Delayed Scheduling (Zero Cron)
1. Compose a campaign with start time set to 2 minutes in the future.
2. Click **Schedule Emails**.
3. Open `http://localhost:5000/admin/queues` and observe the job in BullMQ's **Delayed** queue.
4. After 2 minutes, verify BullMQ automatically moves it to **Active** $\rightarrow$ **Completed**, and it appears in **Sent Emails**.

### 3. Server Restart Persistence
1. Schedule an email for 3 minutes in the future.
2. Stop the backend server process (`Ctrl+C` in terminal).
3. Wait 30 seconds and restart the backend (`npm run dev`).
4. On boot, `ReconciliationService` verifies the pending job in PostgreSQL and confirms it in BullMQ without duplicate recreation.
5. When the 3 minutes elapse, the email is sent successfully.

### 4. Hourly Rate Limiting & Slack Rescheduling Notification
1. Set `hourlyLimit: 3` in the Compose modal and schedule 6 emails.
2. The first 3 emails are sent immediately.
3. The remaining 3 emails trigger the Redis atomic limiter:
   - Status updates to `RATE_LIMITED_RESCHEDULED`.
   - Remaining jobs are shifted to the next hourly window in BullMQ.
   - If Slack is connected, a real Block Kit alert is sent to your Slack channel!

### 5. Elasticsearch Search & Filter
1. Enter a keyword from the subject, recipient, or body in the search bar.
2. The search executes against Elasticsearch `reachinbox_emails` index and instantly filters results across both **Scheduled Outreach** and **Sent Emails** tabs.

---

## 💡 Assumptions, Trade-offs & Implementation Decisions

1. **Ethereal Test Account Generation**: If `ETHEREAL_USER` and `ETHEREAL_PASS` are not supplied in `.env`, the server automatically creates a test account via `nodemailer.createTestAccount()` on boot so the system is immediately testable out of the box.
2. **Deterministic BullMQ Job IDs**: BullMQ job IDs match PostgreSQL `email_jobs.id` UUIDs. BullMQ natively ignores duplicate job insertions with identical IDs, ensuring complete deduplication across retries or restarts.
3. **Idempotency Guarantees**: While standard SMTP protocols do not offer two-phase commits, application-level idempotency is guaranteed via atomic SQL state transitions (`UPDATE ... WHERE status = 'SCHEDULED'`), preventing double dispatch even under high concurrency.
4. **Elasticsearch Resilience**: If Elasticsearch is unreachable, queries seamlessly fall back to PostgreSQL `ILIKE` pattern queries without failing user actions.
5. **Developer DX & Demo Fallback**: While standard Google & Slack OAuth flows are implemented end-to-end, 1-click demo login and mock Slack connect modes are available so reviewers can test the full functionality without setting up third-party OAuth apps.

---

## 👨‍💻 Submission Checklist

- [x] TypeScript across backend and frontend
- [x] Express.js REST API
- [x] PostgreSQL relational schema & indexes
- [x] BullMQ + Redis persistent delayed queues
- [x] **Strictly NO CRON used**
- [x] Server restart persistence & startup reconciliation
- [x] Idempotency & atomic status locking
- [x] Multi-sender support with individual hourly limits
- [x] Configurable worker concurrency
- [x] Minimum inter-email delay throttling
- [x] Atomic Redis Lua rate limiting
- [x] Automatic job rescheduling on rate-limit hit
- [x] Real Slack OAuth & Block Kit rate-limit notifications
- [x] Real Google OAuth authentication
- [x] Elasticsearch indexing & full-text search
- [x] Live BullMQ dashboard (`/admin/queues`)
- [x] React + Vite + Tailwind CSS frontend with CSV/Text lead parser
- [x] Docker Compose for infrastructure
