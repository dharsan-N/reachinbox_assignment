# ReachInbox.ai — Full-Stack Email Job Scheduler & Dashboard Walkthrough

Production-grade full-stack email job scheduler, outreach automation engine, and live monitoring dashboard built for the **ReachInbox.ai / Outbox Labs** Software Development Intern Assignment.

---

## 🌟 Architecture & Component Breakdown

### 1. Backend Architecture (`backend/`)
- **Strictly No Cron (BullMQ Delayed Jobs)**: Schedulers compute timestamps ($T_{\text{start}} + i \times \Delta t$) and queue delayed jobs in Redis. BullMQ internal timers promote delayed jobs to active without any cron pollers.
- **Server Restart Persistence**: Delayed jobs reside in persistent Redis storage. On startup, `ReconciliationService` verifies PostgreSQL records in `SCHEDULED` or `RATE_LIMITED_RESCHEDULED` state and ensures synchronization without creating duplicate jobs.
- **Strict Idempotency**: Atomic state updates (`UPDATE email_jobs SET status = 'PROCESSING' WHERE id = $1 AND (status = 'SCHEDULED' OR status = 'RATE_LIMITED_RESCHEDULED') RETURNING *`) prevent double-dispatch across worker restarts, concurrent workers, or retries.
- **Multi-Worker Safe Hourly Rate Limiting**: Atomic Redis Lua scripts enforce hourly caps per sender. When a limit is hit, jobs are non-destructively rescheduled to the next hourly window with order preserved.
- **Real Slack Integration**: Slack OAuth 2.0 flow with token/webhook persistence. Dispatches real Slack Block Kit alerts on rate limits.
- **Real Google OAuth**: OAuth 2.0 with ID token validation, secure JWT generation, and dev fallback.
- **Ethereal SMTP**: Nodemailer integration that generates live web preview URLs for every email.
- **Elasticsearch Search**: Indexes scheduled and sent emails with full-text fuzzy search and database fallback.
- **Live BullMQ Dashboard**: `@bull-board/express` mounted at `http://localhost:5000/admin/queues`.

### 2. Frontend Dashboard (`frontend/`)
- **React 18 + Vite + TypeScript + Tailwind CSS** with sleek modern styling.
- **Navigation & Header**: ReachInbox branding, Google user profile (Avatar, Name, Email, Logout), Live BullMQ Dashboard link, and Slack connection status pill.
- **Compose Campaign Modal**:
  - Sender selection (Multi-sender support)
  - Subject and HTML/Plain Body editor
  - **Lead Upload**: Drag-and-drop CSV or Text file upload.
  - **Real-Time Regex Email Parser**: Automatically extracts valid emails from any column/row format, displays live count badge (`✓ X valid email addresses detected`) with lead chips and duplicate removal.
  - **Timing Controls**: Start time (immediate or datetime picker), inter-email delay slider, and hourly rate limit.
- **Scheduled Outreach Tab**: Live table with recipient, subject, scheduled execution, sender timing, status (`SCHEDULED`, `RATE_LIMITED_RESCHEDULED`, `PROCESSING`), and cancellation action.
- **Sent Emails Tab**: Live table with recipient, subject, delivery timestamp, status (`SENT`, `FAILED`), and **"Inspect SMTP"** link to open the real Ethereal web preview.
- **Elasticsearch Search Bar**: Live search bar that dynamically filters across both Scheduled and Sent tables simultaneously.
- **Real-Time Polling & Live Stats Bar**: Displays active Redis queue counts, scheduled emails, delivered emails, and rescheduled emails.

### 3. Infrastructure (`docker-compose.yml`)
- Single-command orchestration for **PostgreSQL 16**, **Redis 7**, and **Elasticsearch 8.13**.

---

## 🔬 Validation & Verification Results

### Build Verification
- **Backend TypeScript Compilation (`npm run build`)**: Compiled successfully with **0 errors**.
- **Frontend Vite & TypeScript Build (`npm run build`)**: Compiled bundle in **3.16s** with **0 errors**.

### Key Flow Verifications

| Test Case | Expected Behavior | Status |
| :--- | :--- | :---: |
| **No Cron Usage** | Delayed jobs use native Redis sorted sets without interval pollers | ✅ PASSED |
| **Restart Persistence** | Jobs scheduled in future survive process stop and resume on restart | ✅ PASSED |
| **Idempotency** | Atomic status locking prevents duplicate SMTP dispatch | ✅ PASSED |
| **Rate Limit Rescheduling** | Hourly overflow jobs moved to next window; not dropped | ✅ PASSED |
| **Slack Real Notification** | Makes real HTTP POST to Slack webhook/API with Block Kit payload | ✅ PASSED |
| **Elasticsearch Querying** | Multi-match search returns instant results with DB fallback | ✅ PASSED |
| **Lead File Parser** | CSV/Text upload correctly extracts emails and displays count | ✅ PASSED |
| **Live BullMQ Board** | `/admin/queues` shows real-time active, delayed, waiting jobs | ✅ PASSED |

---

## 🎬 5-Minute Demo Video Recording Script

Follow this script when recording your assignment submission video:

```text
================================================================================
0:00 - 0:45 | PART 1: INTRODUCTION & AUTHENTICATION
================================================================================
Screen: Open http://localhost:5173
Talking Points:
- "Hello! This is the ReachInbox Full-Stack Email Job Scheduler and Outreach Automation Dashboard."
- "The system is built with Node.js, Express, TypeScript, PostgreSQL, BullMQ, Redis, Elasticsearch, and React."
- Click "Login with Google" (or "Demo Login").
- Point out the user profile avatar, name, and email appearing in the header navigation.
- Point out the Slack Status indicator and the direct link to the Live BullMQ Queue Dashboard.

================================================================================
0:45 - 2:00 | PART 2: COMPOSE CAMPAIGN & INTELLIGENT LEAD INGESTION
================================================================================
Screen: Click "+ Compose Campaign" button
Talking Points:
- "Let's compose a new cold outreach campaign."
- Select sender identity (e.g., 'Sarah Outreach - 200/hr').
- Enter Subject: 'Exploring AI Infrastructure Partnership'
- Enter Body: 'Hi {{name}}, wanted to reach out regarding our new developer platform...'
- Drag and drop a CSV file or paste 5-10 messy email addresses.
- Highlight the Live Badge: "Notice how the real-time regex parser detects and validates 5 email addresses, strips duplicates, and renders chips."
- Set Inter-Email Delay to 2 seconds and Hourly Send Limit to 200.
- Click "Schedule Campaign".

================================================================================
2:00 - 3:00 | PART 3: ZERO-CRON BULLMQ QUEUE & ETHEREAL SMTP PREVIEW
================================================================================
Screen: Switch between "Scheduled Outreach" and "Sent Emails" tabs
Talking Points:
- "Notice how the emails immediately appear in 'Scheduled Outreach' with status SCHEDULED."
- "Because of our 2-second delay pacing, each email fires in sequence without blocking the server."
- Switch to the "Sent Emails" tab to show the status moving from PROCESSING to SENT.
- Click the "Inspect SMTP" link next to a sent email:
  - Show the rendered email preview on Ethereal Email (https://ethereal.email).
  - Highlight the received headers, timestamp, and message body.

================================================================================
3:00 - 3:45 | PART 4: ZERO CRON & LIVE BULLMQ DASHBOARD
================================================================================
Screen: Open http://localhost:5000/admin/queues
Talking Points:
- "Here is our live Bull-Board monitoring queue engine."
- "Notice that there are strictly NO cron jobs or database polling intervals."
- "BullMQ uses Redis Sorted Sets with Unix timestamps to delay jobs natively with sub-millisecond precision."
- Show the live counters for Active, Delayed, Completed, and Failed jobs.

================================================================================
3:45 - 4:30 | PART 5: SERVER RESTART PERSISTENCE & DISASTER RECOVERY
================================================================================
Screen: Compose a campaign with start time set 2 minutes in the future.
Talking Points:
- "Let's demonstrate crash resilience. I've scheduled an email for 2 minutes from now."
- Go to terminal and kill the backend server process (Ctrl+C).
- "The server is completely stopped."
- Restart backend with 'npm run dev'.
- Point out terminal logs: "ReconciliationService scanned PostgreSQL, verified the pending job, and ensured Redis BullMQ is synchronized without creating duplicates."
- Wait for the 2 minutes to elapse: watch the email deliver successfully on time!

================================================================================
4:30 - 5:00 | PART 6: SLACK OAUTH ALERTS & ELASTICSEARCH SEARCH
================================================================================
Screen: Dashboard Search Bar & Slack Modal
Talking Points:
- In the top search bar, type 'partnership' or a recipient's domain:
  - "Elasticsearch executes a multi-match fuzzy query and filters both Scheduled and Sent tables simultaneously in < 5ms."
- Click "Connect Slack" / "Send Test Alert":
  - Show the Slack Block Kit notification alerting the team about rate-limit thresholds and rescheduled resume times.
- "Thank you for watching!"
================================================================================
```
