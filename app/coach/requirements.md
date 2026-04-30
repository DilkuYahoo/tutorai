# Cricket Coach Scheduling Application — Product Requirements

## Overview

A web-based platform for cricket coaching businesses to manage coaches, players, parents, scheduling, billing, and performance tracking. Built on the **ATS tech stack** (React 18 + Vite, Tailwind CSS, AWS Lambda + DynamoDB + Cognito + S3, SAM/CloudFormation).

---

## User Roles

### 1. Super Coach (Head Coach / Admin)
The Super Coach is **also a practising coach** — they carry a full coach role in addition to their admin privileges.

**As a coach:**
- Has their own player list, availability calendar, and sessions
- Posts session summaries, attaches videos, assigns homework
- Reviews player-uploaded videos
- Maintains their own public profile page
- Marks their own sessions as complete

**As admin (in addition to the above):**
- Full administrative access across all coaches and schedules
- Views a unified calendar showing all coaches' schedules including their own
- Overrides, edits, or cancels any session on any coach's calendar
- Accesses the business-wide analytics dashboard and credit reconciliation report
- Registers, edits, and deregisters coach accounts
- Reassigns sessions between coaches
- Reads all inbox threads across the platform
- Manages platform-level package templates
- Adds manual credit ledger adjustments for any player

### 2. Coach
- Manages their own schedule and session availability
- Activates package templates assigned to them by the Super Coach
- Posts session summaries, attaches videos, assigns homework
- Reviews player-uploaded videos
- Maintains a public-facing profile page
- Marks sessions as complete via a "Complete" button
- Can see their own data only — cannot see other coaches' sessions, players, or revenue

### 3. Player (Individual)
- Self-registers on the platform as a player
- Books sessions for themselves only based on coach availability
- Receives session summaries, invoices, and homework assignments
- Uploads videos to sessions for coach review
- Logs completed drills against assigned homework
- Has their own login — manages their own account directly

### 4. Parent
- Self-registers on the platform as a parent — **not a player themselves**
- Cannot book sessions for themselves under any circumstance
- Adds one or more children (players) under their account
- Books, cancels, and reschedules sessions exclusively on behalf of their children
- Receives invoices and session summaries per child
- Each child has their own independent credit balance and session history
- One child belongs to one parent (single parent association assumed)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5, Tailwind CSS 3 (dark mode `class` strategy), React Router v6 |
| Charts | ECharts 5 via `echarts-for-react` |
| Calendar | FullCalendar v6 (`@fullcalendar/react`, `timegrid`, `daygrid`, `interaction`) |
| Auth | AWS Cognito (JWT, `custom:role` claim) |
| Backend | AWS Lambda (Python 3.13, arm64), API Gateway HTTP API |
| Database | DynamoDB (single-table design) — transactional/application data |
| Reporting | DynamoDB Streams → Lambda → S3 (Parquet) → Glue Catalog → Athena — analytical queries and reconciliation report |
| File Storage | S3 — dedicated bucket for this platform (video uploads, profile photos, Parquet reporting data, CSV exports) |
| Email | AWS SES via async Lambda invocation |
| Payments | Stripe (invoicing, package purchases) |
| IaC | AWS SAM (`template.yaml`) — mirrors ATS deployment pattern |
| Region | ap-southeast-2 (Lambda/API/DynamoDB/Athena/Glue); us-east-1 (CloudFront + ACM) |

---

## Core Features

---

### 1. Authentication & Registration

- Separate registration flows for **Coach**, **Player**, and **Parent**
- Role stored as `custom:role` Cognito attribute: `super_coach`, `coach`, `player`, `parent`
- `super_coach` inherits all `coach` permissions plus admin capabilities — a single account, not two
- Players self-register and manage bookings for themselves only
- Parents self-register, cannot book for themselves, and can only book on behalf of registered child players under their account
- Coaches are registered by the Super Coach (invite flow) — coaches cannot self-register
- All auth follows the existing ATS Cognito pattern (JWT, email-based, first-login password challenge)

---

### 2. Coach Discovery & Profile

#### Coach Directory (Public Listing)
- A public-facing coach listing page accessible to all logged-in players and parents
- Displays all active coaches as cards: photo, name, short bio, per-session rate, available packages
- Player selects a coach from the listing to view their full profile and book

#### Coach Profile Page
Each coach has a public profile page containing:
- Profile photo
- Bio / about me
- Social media links (Instagram, Facebook, YouTube, etc.)
- Per-session rate and active package options
- Availability calendar showing open bookable slots (players book directly from here)

---

### 3. Schedule & Availability Management

The calendar is the **core engine** of the platform. Everything — bookings, credits, sessions, invoices — flows through it.

---

#### Slot Model

All calendar slots are **fixed at 45 minutes**. Every booking, regardless of package tier, occupies exactly one 45-minute slot. This keeps the calendar grid uniform and predictable for coaches and players alike.

---

#### The Scheduling Modes

Sessions are booked against a player's **credit balance**. Two modes are supported, both drawing from the same balance:

| Mode | Description |
|------|-------------|
| **Recurring series** | Player locks in a standing weekly slot (e.g. "Every Thursday at 3:30 pm"). Instances auto-generated forward for as long as credits remain. Series pauses when credits hit zero and resumes on top-up. |
| **Ad-hoc / flexible** | Player books individual sessions at any available slot as needed. Each booking consumes one credit. No standing slot is created. |

A player with 10 credits can mix freely — e.g. lock in 4 as a recurring weekly slot and book the remaining 6 ad-hoc.

---

#### Conflict Resolution at Booking

When a player books a recurring series (e.g. 10 weekly sessions every Thursday at 3:30 pm), some future dates may have conflicts — coach block-outs, public holidays, or already-booked slots.

The system detects all conflicts at booking time and presents a **conflict summary screen** before confirming:

```
"We found 5 conflicts in your 10-session series.
 5 sessions were successfully scheduled.
 5 sessions could not be booked on their intended date.

 What would you like to do with the 5 conflicting sessions?"

 [ Return to my credit pool ]   [ Reschedule each one ]
```

**Option A — Return to credit pool**
- Player presses OK / confirms
- The 5 conflicting sessions are not booked
- Their 5 credits are retained in the player's available balance
- The player can use these credits later to book ad-hoc sessions at any time
- The confirmed 5 recurring sessions proceed as scheduled

**Option B — Reschedule each conflict**
- Player is taken through each conflicting date one at a time
- For each conflict the coach's availability calendar is shown for that week
- Player picks an alternative slot for that date or skips it back to the credit pool
- Each resolved conflict is confirmed immediately; skipped ones return to the pool

**Rules:**
- The conflict check runs at the point of booking confirmation — not when browsing the calendar
- A slot is a conflict if: it falls within a coach block-out, the coach has no availability that day, or that exact slot is already booked by another player
- Partial series bookings are valid — a player can end up with 7 of 10 sessions scheduled and 3 credits in their pool
- The conflict summary is shown even if only 1 session has a conflict

---

#### Coach Availability — Three Layers

The coach's calendar is built from three stacked layers resolved in this order:

**Layer 1 — Weekly availability template (base)**
The coach defines their recurring weekly working hours — e.g. Mon–Fri 3–7 pm, Saturday 9 am–12 pm. The system automatically divides these windows into consecutive back-to-back 45-minute bookable slots with no gap between them (e.g. 3:00, 3:45, 4:30, 5:15, 6:00, 6:45). This template repeats every week indefinitely until changed.

**Layer 2 — Ad-hoc overrides (additions and removals)**
On top of the weekly template, the coach can:
- **Add** extra availability on a specific date (e.g. a one-off Sunday morning)
- **Remove** specific slots on a specific date without creating a full block-out (e.g. remove the 4:00 pm slot next Tuesday only)

**Layer 3 — Block-out periods (full unavailability)**
The coach marks a date range as fully unavailable — e.g. school holidays, leave, travel. A single block-out action covers the entire period in one step, not day by day.
- Any existing bookings that fall within the block-out period are **flagged immediately** and must be manually resolved (rescheduled or cancelled) before the block-out is confirmed
- The system shows a summary: "You have N sessions booked during this period. Resolve them before confirming."
- Block-out dates override both Layer 1 and Layer 2 — no slots are available during a block-out regardless of template

**Slot availability rule:** A slot is bookable only if it is in Layer 1 or Layer 2 AND is not covered by a Layer 3 block-out AND has not already been booked by another player.

---

#### Who Can Schedule

| Role | Can do |
|------|--------|
| Player / Parent | Books directly against the coach's public availability calendar |
| Coach | Books on behalf of a player (initial setup, makeup sessions) |
| Super Coach | Books, reschedules, or cancels any session across all coaches including themselves |

Bookings are **auto-confirmed** — no coach approval required. The coach's published availability is the sole gate.

---

#### Session Types

| Type | Description |
|------|-------------|
| One-on-one | Coach + single player; 45 min slot; recurring or ad-hoc |

Group sessions are **descoped from MVP**. All MVP sessions are one-on-one only.

---

#### Instance-Level Actions

| Action | Who can initiate | Effect |
|--------|-----------------|--------|
| Cancel single instance | Player, Parent, Coach, Super Coach | Cancelled; credit returned if ≥ 24 hrs before start; slot freed immediately |
| Cancel within 24 hours | Player, Parent, Coach, Super Coach | Cancelled; **credit forfeited**; slot freed |
| Reschedule single instance | Player, Parent, Coach, Super Coach | Player picks any open slot; auto-confirmed; original slot freed; all parties notified |
| Cancel entire series | Coach, Super Coach | All future unstarted instances cancelled; credits returned to player's pool; player notified and prompted to select a new coach and rebook |
| Reassign series to new coach | Super Coach | All future unstarted instances cancelled; credits returned to pool; player notified to select a new coach and reschedule remaining sessions |
| Complete instance | Coach only | Triggers summary + invoice (see Section 4) |

---

#### Calendar Views

**Coach view**
- Their own calendar: booked sessions, available slots, block-outs, ad-hoc overrides
- Booked sessions show: player name, session type, recurring/ad-hoc indicator
- Can manage availability (add/remove slots, set block-outs) directly from this view
- Super Coach sees this same view for their own sessions, plus the unified view below
- **Drag and drop**: coach can drag a booked session to a different available slot to reschedule it — auto-confirmed; player notified by email; original slot freed

**Super Coach unified view**
- All coaches displayed simultaneously, each coach in a distinct colour
- Colour legend shown as a filter panel — coaches can be toggled on/off
- Clicking any session opens the session detail with full edit/cancel/reassign options
- Default view: all coaches visible; can filter down to one or more coaches
- **Drag and drop**: Super Coach can drag any session across any coach's calendar to reschedule or reassign — if dragged to a different coach's slot it triggers a reassignment; player notified

**Player / Parent booking view**
- Shows the selected coach's available (unbooked) slots only — no other players' bookings visible
- Slots are displayed as 45-minute blocks across a weekly calendar grid
- Player selects a slot to book ad-hoc, or selects a recurring day/time to set up a series
- Parent must select a child first before the booking calendar is shown
- No drag and drop on the player/parent view — booking is click-to-select only

---

### 4. Session Lifecycle

```
Booked → Completed
   ↓
Cancelled  (credit returned to pool — no cash refund)
   ↓
Rescheduled (original slot freed; player selects new slot; auto-confirmed)
```

Sessions are **Booked** the moment a player confirms a slot. There is no intermediate "Confirmed" state — booking is auto-confirmed against the coach's availability.

**Completion flow:**
1. Coach adds commentary to the session before marking it done
2. Coach presses **"Complete"** — triggers automatically:
   - Session summary emailed to the player/parent
   - If player is on a package: one credit deducted from their ledger; no invoice sent
   - If player is paying per-session: Stripe invoice created and emailed to the player/parent with a payment link
3. Sessions cannot be marked Complete before their scheduled start time (backend enforced)
4. Payment is always **after the session** — no upfront charge at booking time for per-session players

**Cancellation policy (credit only, no cash refunds):**
- Cancellations made **≥ 24 hours before** the session start: full credit returned
- Cancellations made **< 24 hours before** the session start: credit is **forfeited** (late cancellation)
- Credit return applies to both per-session credits and package credits
- No cash/Stripe refunds are issued under any circumstances
- The freed time slot is immediately available for other players to book
- Late cancellations are logged and visible to the Super Coach on the dashboard

---

### 5. Session Content

After a session the coach can attach:
- **Written summary** — free-text notes on what was covered
- **Videos** — uploaded to the dedicated S3 bucket (no size or duration limit)
  - Upload UI must have **large, prominent buttons** optimised for mobile/field use
  - Files should begin uploading immediately on selection (presigned S3 URL pattern)

#### Player Video Upload
- Players/parents can upload their own videos to a session for coach review
- Same mobile-friendly large-button UI
- Coach provides a **free-text written response** to the uploaded video (no annotation tooling at this stage)

---

### 6. Homework

Coaches can assign homework per session or per player:
- Link to a YouTube video
- Custom drill description (free text)

Players can log which drills they have completed against the assigned homework.

---

### 7. Group Events

**Descoped from MVP.** Group events (invite-based sessions, paid events, tour sessions) will not be built in Phase 1. The platform focuses on one-on-one and group training sessions only. Group events may be revisited in a future phase.

---

### 7a. Session Comment (Coach → Player)

**General inbox messaging is descoped from MVP.**

The only in-platform communication in MVP is a one-way **session comment** from coach to player, tied directly to a session.

- Available on every session (upcoming and completed)
- Coach types a comment and sends it — it appears on the player's session record in their dashboard
- **One-way only**: player/parent cannot reply in-platform — they contact the coach outside the platform for now
- Distinct from the session summary (sent automatically on completion); a session comment can be sent at any time before or after the session
- Player/parent receives an email notification when a session comment is posted
- Multiple comments can be added to the same session over time

---

### 8. Billing & Payments (Stripe)

#### Fee Structure
Each coach defines:
- Per-session rate (e.g. $80 / session)
- Packages (e.g. 10 sessions for $500)

Packages track remaining session credits; each completed session deducts one credit.

#### Payment Flow
- Business collects all payments via Stripe
- Super Coach pays individual coaches separately outside the platform (manual bank transfer or similar — not managed by the platform)
- Payment is always **after the session** — no upfront charge at booking for per-session players
- On session completion, the platform automatically:
  1. Creates a Stripe invoice for the player/parent (per-session players only)
  2. Sends the invoice via Stripe (email with payment link)
  3. Reconciles payment status — once Stripe marks the invoice as paid, the session is marked paid in the platform
- Package players are not invoiced per session — their credit is deducted from the ledger on completion
- The Super Coach dashboard reflects reconciled revenue from Stripe (paid invoices only, not pending)

#### Package Templates (Platform-Level)

Packages are defined at the **platform level** by the Super Coach, not by individual coaches. This allows standardised tiers across the business (e.g. Standard, Premium) while still letting coaches be assigned different packages at different price points.

**Super Coach manages:**
- Creates platform-wide package templates (e.g. "Standard — 10 sessions", "Premium — 10 sessions", "Trial — 1 session")
- Each template defines: name, tier, session count, price, and a description
- All sessions are 45 minutes — duration is not a package attribute
- Assigns which package templates each coach can offer (a coach may offer one or several)
- Can update or reassign a coach's available packages at any time

**Coach selects from assigned templates:**
- Coach does not create packages from scratch — they activate/deactivate from the templates assigned to them by the Super Coach
- Coach's profile page displays only their active packages

**Player purchases:**
- Packages are purchased upfront via Stripe Checkout; credits are added to the player's ledger on payment confirmation
- Both per-session and package options are available simultaneously on a coach's profile
- Credits never expire — purchased credits and cancellation-returned credits are held indefinitely

#### No discount vouchers at this stage.

---

### 9. Notifications (Email only — Phase 1)

| Trigger | Recipient |
|---------|-----------|
| Session booked | Coach + Player/Parent |
| Session cancelled or rescheduled | Coach + Player/Parent |
| Late cancellation (< 24 hrs) occurred | Super Coach |
| Session completed | Player/Parent (summary + invoice) |
| Homework assigned | Player/Parent |
| Upcoming session reminder | Coach + Player/Parent |
| Player video uploaded (awaiting review) | Coach |
| New inbox message received | Recipient (Coach / Player / Parent) |
| Session comment posted by coach | Player/Parent |
| Credit balance low (≤ 2 credits) | Player/Parent |

All email notifications fire asynchronously (fire-and-forget, `InvocationType="Event"`), wrapped in `try/except Exception: pass` — email failures must never fail an API response.

---

### 10. Coach & Super Coach Dashboard

The Coach and Super Coach share the **same dashboard UI**. The difference is scope and access:

| Feature | Coach | Super Coach |
|---------|-------|-------------|
| Upcoming sessions | Their own only | All coaches including themselves; filterable by coach |
| Sessions completed | Their own only | All coaches including themselves; filterable by coach |
| Revenue | Their own sessions | Business-wide including their own; filterable by coach |
| Player list | Their own players | All players across all coaches |
| Late cancellations | Their own | All coaches |
| Credit reconciliation report | Not visible | Full access |
| Coach management | Not visible | Full access (register, edit, deregister other coaches — not themselves) |

#### Stats Cards (top of dashboard)
- Today's sessions (count + list)
- Upcoming sessions this week
- Sessions completed this month
- Revenue this month (from paid Stripe invoices)
- Outstanding invoices (unpaid, count + total value)
- Videos awaiting review (amber badge — count of player videos with no coach response after 3 days)

#### Upcoming Sessions Panel
- Sessions listed chronologically
- Each row: player name, date/time, session type, status
- Super Coach sees a **Coach filter** (dropdown) to scope to one coach or view all
- Click through to the session detail

#### Coach Management (Super Coach only)

**Register a coach**
- Super Coach creates the coach's Cognito account and sets up their full profile: name, bio, photo, social links, per-session rate, and assigned package templates
- Coach receives an invite email with a temporary password (same ATS first-login flow)
- Coach completes their profile and sets availability after first login

**Edit a coach profile**
- Super Coach can update any coach's profile details, per-session rate, and assigned package templates at any time

**Session Reassignment**
- Super Coach can reassign any session or entire recurring series from one coach to another at any time — not just during deregistration
- Use cases include: coach illness/leave (reassign specific instances), player requesting a coach change (reassign entire series), load balancing when a new coach joins
- Reassignment rules:
  - The receiving coach must have availability at the session's scheduled time, or the Super Coach must reschedule the session as part of the reassignment
  - The player/parent is notified by email when their session is reassigned to a different coach
  - Completed sessions are never reassigned — only future unstarted instances
  - The original coach's session history and completed records remain unchanged

**Deregister a coach**
- Super Coach deactivates the coach's account
- Before deactivation, the platform shows a summary: number of upcoming sessions, affected players, and active recurring series
- Super Coach must resolve all upcoming sessions first (reassign or cancel each) before deactivation is permitted — the deactivate button is disabled until the session count reaches zero
- On cancellation of a session during deregistration: full credit is always returned to the player regardless of the 24-hour rule (coach-side deregistration is not the player's fault)
- All completed sessions, summaries, invoices, and history are retained permanently after deactivation
- Deactivated coach account cannot log in; their profile is hidden from the public coach listing

#### Coach Dashboard Detail

The coach's own dashboard view contains:

**My Sessions — Today**
- List of today's sessions in chronological order
- Each card: player name, time, recurring/ad-hoc indicator, session status
- Quick action: mark complete, add comment, view session detail

**My Stats (this month)**
- Sessions completed
- Sessions upcoming
- Revenue earned (paid invoices only)
- Outstanding invoices (unpaid, with count and total value)
- Videos awaiting review (amber badge count)

**My Players**
- List of all players the coach has an active relationship with
- Each row: player name, parent name (if applicable), active package, credits remaining, last session date, next session date
- Click through to the player's full session history with that coach

**My Upcoming Sessions**
- Full list beyond today, sorted chronologically
- Filter by: this week / this month / all upcoming
- Each row: player name, date/time, recurring/ad-hoc, status

**Homework Outstanding**
- List of homework assigned across all sessions that has not yet been completed by the player
- Each row: player name, session date, drill description or YouTube link, days since assigned

#### Change Password
Available to all roles from their dashboard (Coach, Super Coach, Player, Parent) via a "Change Password" option in the account/avatar menu. Uses Cognito client-side SDK — no Lambda required (same pattern as ATS `ChangePasswordModal`).

---

### 10a. Credit Reconciliation Report

A dedicated report available to the Super Coach only, giving a complete picture of all credit activity across the business.

#### Filters
| Filter | Options |
|--------|---------|
| Date range | From / To (defaults to current month) |
| Player | Search and select a specific player |
| Parent | Filter all children under a parent account |
| Coach | Show only sessions and credits tied to a specific coach |
| Entry type | Purchase / Deduction / Cancellation return / Manual adjustment |

#### Report Columns (one row per ledger entry)
| Column | Description |
|--------|-------------|
| Date & time | When the ledger entry was created |
| Player | Player name |
| Parent | Parent name (if applicable) |
| Coach | Coach associated with the session (blank for purchases) |
| Entry type | Human-readable label (e.g. "Package purchase", "Session completed", "Cancellation return", "Manual adjustment by [Name]") |
| Credits | Delta — positive (added) or negative (deducted), colour-coded |
| Balance after | Running credit balance at that point in time |
| Reference | Linked session date/time, package name, or manual adjustment note |
| Adjusted by | Super Coach name — shown only for manual adjustment entries |

#### Summary Totals (shown above the table, update with filters)
- Total credits purchased
- Total credits consumed (sessions completed)
- Total credits returned (cancellations)
- Total credits manually adjusted (net)
- Total credits currently outstanding across all players

#### Export
- Export filtered results to CSV for external reconciliation against Stripe payouts

---

### 11. Player/Parent Dashboard

The player/parent dashboard is the primary logged-in view. Everything relevant to the player's coaching journey is accessible from this single screen without needing to navigate elsewhere.

#### Credit & Billing Summary (top of page)
- Credit balance broken down into three states:
  - **Available** — credits free to book new sessions
  - **Committed** — credits reserved against upcoming booked sessions (not yet consumed)
  - **Total purchased** — lifetime credits purchased (for reference)
- Credits never expire
- Alert banner if credits are low (e.g. ≤ 2 remaining) with a prompt to top up
- Link to purchase more sessions / packages
- Outstanding invoices (unpaid Stripe invoices) with a direct payment link

#### Upcoming Sessions
- List of all booked upcoming sessions, sorted by date ascending
- Each session card shows: date, time, duration, coach name, session type (one-on-one / group), and whether it is part of a recurring series
- **Cancel** button — disabled within 24 hours of session start (late cancellation policy shown as tooltip)
- **Reschedule** button — opens the coach's availability calendar to pick a new slot

#### Session History (Completed Sessions)
Each completed session is expandable and shows the full record:

| Section | Content |
|---------|---------|
| Session details | Date, time, duration, coach name |
| Coach summary | Written notes added by the coach after the session |
| Coach videos | Videos uploaded by the coach for this session (S3-hosted, inline playback) |
| Coach video response | Coach's written response to any player-uploaded video |
| Player videos | Videos uploaded by the player for this session, with upload status |
| Homework | Assigned drills and YouTube links; player can mark each drill as completed |
| Invoice | Invoice status (paid / pending) with link to Stripe-hosted invoice PDF |

#### Player Video Upload (from session history)
- Available on any completed or upcoming session
- Large, prominent upload button optimised for mobile (field use)
- Upload begins immediately on file selection via presigned S3 URL
- Progress indicator shown during upload
- Once uploaded, player can see the file and any coach written response

#### Homework Tracker
- Consolidated view of all outstanding homework across all sessions
- Each item shows: session date, coach name, drill description or YouTube link
- Checkbox to mark each drill as done (logged as a completed drill entry)
- Completed homework items collapse out of the outstanding list but remain visible under the relevant session in history

#### Parent View
- Parent sees a tab or switcher to toggle between each of their children
- All of the above sections are scoped to the selected child
- Parent can book, cancel, or reschedule sessions on behalf of any child
- Credit balance is per-child (tied to each player profile, not the parent account)

---

## Reporting Architecture

### OLTP vs OLAP Split

Application data lives in DynamoDB. Reporting data flows to S3/Parquet via DynamoDB Streams and is queried by Athena.

```
DynamoDB (write)
     ↓
DynamoDB Streams
     ↓
Lambda (stream transformer)
     ↓
S3 Parquet files (partitioned by entity type + date)
     ↓
AWS Glue Catalog (schema registry)
     ↓
Athena (SQL queries)
     ↓
Reporting Lambda (API endpoint)
     ↓
Frontend
```

### What Uses Each Layer

| Feature | Query Layer | Reason |
|---------|-------------|--------|
| Dashboard stats cards | DynamoDB (Lambda + GSI) | Simple counts, low latency needed |
| Upcoming sessions list | DynamoDB (Lambda + GSI) | Transactional, real-time |
| Player credit balance | DynamoDB (ledger sum) | Must be real-time accurate |
| Booking conflict check | DynamoDB | Must be real-time at booking |
| Credit reconciliation report | Athena | Multi-filter, aggregated, exportable |
| Revenue by coach (time filter) | Athena | Cross-entity aggregation |
| CSV export | Athena → S3 presigned URL | Native Athena result output |

### Stream Transformer Lambda

The transformer Lambda consumes DynamoDB Stream events and writes Parquet to S3. It processes these event types:

| DynamoDB event | Parquet table written |
|---------------|----------------------|
| Session INSERT / MODIFY | `sessions` |
| Credit ledger INSERT | `credit_ledger` |
| Invoice INSERT / MODIFY | `invoices` |
| Coach profile INSERT / MODIFY | `coaches` |
| Player profile INSERT / MODIFY | `players` |
| Package purchase INSERT | `package_purchases` |

### S3 Parquet Partitioning

```
s3://coach-platform/reporting/
  sessions/year=2026/month=04/
  credit_ledger/year=2026/month=04/
  invoices/year=2026/month=04/
  coaches/
  players/
```

Date-based partitioning on `sessions`, `credit_ledger`, and `invoices` allows Athena to prune scans when the date range filter is applied — keeping query costs minimal.

### Glue Catalog

One Glue database: `coach_platform`. One table per Parquet entity above. Glue crawler runs nightly to detect schema changes. Athena queries reference `coach_platform.sessions`, `coach_platform.credit_ledger`, etc.

### Credit Ledger — coachId Denormalisation

The credit ledger Parquet table includes `coachId` directly on every entry (denormalised from the session record). This avoids a join in Athena when filtering the reconciliation report by coach — the report can filter `WHERE coach_id = ?` on the ledger table directly without joining to sessions.

### CSV Export Flow

1. Frontend requests a CSV export with active filters
2. Reporting Lambda submits an Athena query with `OutputLocation` set to `s3://coach-platform/exports/{queryExecutionId}/`
3. Lambda polls Athena until the query completes (or uses async + webhook pattern)
4. Lambda generates a presigned S3 URL for the result file (valid 15 minutes)
5. Frontend receives the URL and triggers a browser download

### Lag Tolerance

DynamoDB Streams → S3 pipeline introduces a 10–60 second lag. This is acceptable for all Athena-backed features — the reconciliation report and revenue analytics are not real-time requirements.

---

## Data Model (DynamoDB Single-Table — Draft)

| Entity | PK | SK |
|--------|----|----|
| Coach profile | `COACH#{id}` | `#META` |
| Player profile | `PLAYER#{id}` | `#META` |
| Parent profile | `PARENT#{id}` | `#META` |
| Parent → child link | `PARENT#{parentId}` | `CHILD#{playerId}` |
| Recurring series | `SERIES#{id}` | `#META` | coach, player, day-of-week, time, duration |
| Session instance | `SESSION#{id}` | `#META` | `seriesId` (nullable for one-offs), status, scheduledAt |
| Booking | `SESSION#{sessionId}` | `BOOKING#{playerId}` |
| Homework | `SESSION#{sessionId}` | `HOMEWORK#{id}` |
| Completed drill | `HOMEWORK#{hwId}` | `DRILL#{playerId}#{timestamp}` |
| Package template | `PACKAGE#{id}` | `#META` | platform-level template: name, sessionCount, price, tier (e.g. Standard/Premium/Trial) — created by Super Coach; no expiry; all sessions 45 min |
| Coach package assignment | `COACH#{coachId}` | `PACKAGE#{packageId}` | which templates this coach actively offers; `active` flag |
| Player package | `PLAYER#{playerId}` | `PACKAGE#{packageId}` | `creditsRemaining`, `stripePaymentId`, `coachId` (coach this purchase is for) — no expiry |
| Credit ledger entry | `CREDITS#{playerId}` | `{timestamp}#{id}` | `type` (purchase/booking_reserve/session_complete/cancellation_return/late_cancel_forfeit/manual_adjustment), `delta`, `fromState`, `toState`, `balanceAvailable`, `balanceCommitted`, `sessionId` or `packageId` (reference), `coachId` (denormalised — enables direct coach filter in Athena without join), `adjustedBy` (Super Coach userId + name, manual_adjustment only), `note` (required for manual_adjustment) |
| Video | `SESSION#{sessionId}` | `VIDEO#{id}` |
| Invoice | `INVOICE#{id}` | `#META` | includes `stripeInvoiceId`, `status` (pending/paid/void) |
| Session comment | `SESSION#{sessionId}` | `COMMENT#{timestamp}#{id}` | coachId, body (one-way coach → player only) |

GSIs to be finalised during technical design.

### Credit Balance Logic

Credits move through **three states**. A credit is never consumed until the session is physically completed by the coach.

```
AVAILABLE  →  COMMITTED  →  CONSUMED
   (purchased)   (session booked)   (session completed)
       ↑               ↓
       └── RETURNED (session cancelled)
```

| State | Meaning |
|-------|---------|
| **Available** | Credit is in the pool — free to book a session |
| **Committed** | A session has been booked against this credit — credit is reserved but not yet spent |
| **Consumed** | Coach pressed Complete — credit is permanently spent |
| **Returned** | Session was cancelled — committed credit returns to Available |

**Rules:**
- Booking a session moves a credit from **Available → Committed**
- Completing a session moves a credit from **Committed → Consumed**
- Cancelling a session moves a credit from **Committed → Available** (subject to the 24-hour rule — late cancellations move Committed → Consumed with no session delivered)
- Credits are **never consumed at booking time** — only at session completion
- A player cannot book a session if they have zero Available credits, even if they have Committed credits (those are already spoken for)
- The player dashboard shows all three counts clearly: Available, Committed (booked upcoming sessions), and total purchased to date

**Ledger implementation:**
- Every credit movement writes a ledger entry: `type`, `delta`, `fromState`, `toState`, `balanceAvailable`, `balanceCommitted`, `sessionId` or `packageId`
- The scheduling engine reads `balanceAvailable` to determine how many more sessions can be booked
- The conflict resolution flow at booking reads `balanceAvailable` before reserving credits — no booking proceeds if available balance is insufficient
- All top-ups go through Stripe on-platform — credits move to Available only after Stripe confirms payment (`checkout.session.completed` webhook)
- **Super Coach manual adjustment**: Super Coach can add credits directly to a player's Available balance via the dashboard. Every manual entry requires a free-text reason and records the Super Coach's name and userId. Labelled "Manual adjustment by [Name]" everywhere in the UI.

---

## Decisions Log

| # | Decision |
|---|----------|
| Billing model | Business collects via Stripe; Super Coach pays coaches manually outside the platform |
| Invoicing | Auto-generated and sent via Stripe on session completion; platform reconciles on Stripe `invoice.paid` webhook |
| Packages | Both per-session and multi-session packages supported simultaneously per coach |
| Package expiry | No expiry on any credits — purchased or returned from cancellations. Simplified for MVP. |
| Group events | Descoped from MVP. To be revisited in a future phase. |
| Waiting list | Descoped from MVP. |
| GST | Invoices must include GST; business is GST-registered |
| Discount vouchers | Out of scope for Phase 1 |
| Package ownership | Packages are platform-level templates created by Super Coach. Coaches select from assigned templates — they do not create packages from scratch. Super Coach can change a coach's assigned packages at any time. |
| Session duration | Fixed at 45 minutes platform-wide. Not a package attribute. |
| Video review flag | Amber badge on coach and Super Coach dashboard after 3 days with no written response. Cleared when coach responds. Driven by a daily scheduled Lambda. |
| General messaging | Descoped from MVP. To be revisited in a future phase. |
| Session comment | One-way coach → player comment tied to a specific session. Multiple comments per session. Email notification on post. Player cannot reply in-platform. |
| Group sessions | Descoped from MVP. All MVP sessions are one-on-one only. |
| Coach discovery | Public coach directory page. Player browses active coaches, selects one, and books from their profile calendar. |
| Payment timing | Always after the session. No upfront charge at booking. Package players deducted from credit ledger on completion; per-session players invoiced via Stripe on completion. |
| Series mid-reassignment | When a series is reassigned or cancelled mid-way, all future instances are cancelled and credits returned to the player's pool. Player selects a new coach from the directory and reschedules remaining sessions independently. |
| Booking conflict resolution | When a recurring series has conflicts, the system shows a conflict summary at booking time. Player chooses: (A) return conflicting credits to pool and proceed with confirmed sessions, or (B) reschedule each conflict one at a time. Partial series bookings are valid. |
| Reporting architecture | OLTP/OLAP split. Dashboard stats and real-time data queried from DynamoDB. Reconciliation report, revenue analytics, and CSV export served from Athena via DynamoDB Streams → Lambda → S3 Parquet → Glue → Athena pipeline. 10–60s lag is acceptable for analytical features. |
| Credit ledger coachId | `coachId` is denormalised onto every credit ledger entry to enable direct coach filtering in Athena without a join to the sessions table. |
| Super Coach dual role | Super Coach is also a practising coach with their own players, sessions, and profile. Admin capabilities are additive — one account, one login. |
| Parent booking scope | Parents cannot book sessions for themselves. They can only book on behalf of registered child players under their account. |
| Coach registration | Super Coach registers coaches via the dashboard (invite flow). Coaches cannot self-register. Super Coach cannot deregister themselves. |
| Session reassignment | Super Coach can reassign any session or recurring series to another coach at any time — not just during deregistration. Covers illness, player coach-change requests, and load balancing. Player always notified on reassignment. |
| Coach deregistration | Super Coach must reassign or cancel all upcoming sessions before deactivating a coach. Cancellations during deregistration always return full credit to the player (no 24-hour rule applies). |
| Dashboard | Coach and Super Coach share the same dashboard UI. Coach sees only their own data; Super Coach sees all coaches with filter capability. |
| Change password | Available to all roles (Coach, Super Coach, Player, Parent) via the account menu. Cognito client-side SDK — no Lambda needed. |
| Cancellation refunds | Credit only — no cash refunds. Per-session cancellations issue a platform credit; package cancellations return the credit to the package balance |
| Scheduling model | Two modes: **recurring series** (standing weekly slot) and **ad-hoc / flexible** (book individual sessions at any available time). Both draw from the same credit balance. Coach and player/parent can both initiate bookings. |
| Cancellation window | ≥ 24 hours before session start → credit returned. < 24 hours → credit forfeited (late cancel). No cash refunds ever. |
| Who can cancel/reschedule | Player, Parent, Coach, Super Coach — all roles can cancel or reschedule any instance within their scope |
| Reschedule confirmation | Auto-confirmed when player selects an available slot. Coach's published availability is the sole approval gate — no separate coach sign-off needed. |
| Slot duration | Fixed at 45 minutes for all sessions regardless of package tier. Uniform across the entire platform. |
| Buffer between sessions | None — slots are consecutive. A 3:00 pm session ends at 3:45 pm and the next slot starts at 3:45 pm immediately. |
| Availability model | Three-layer system: (1) recurring weekly template, (2) ad-hoc slot additions/removals per date, (3) block-out periods. Layer 3 overrides everything. Block-outs cover full date ranges in one action. |
| Super Coach calendar | All coaches shown simultaneously in distinct colours with toggle filters. Clicking any session opens full edit/cancel/reassign. |
| Drag and drop | Coach and Super Coach calendars support drag and drop to reschedule sessions. Dragging to a different coach on the Super Coach view triggers a reassignment. Player notified on any drag-and-drop change. Player/Parent booking view is click-to-select only — no drag and drop. |
| Coaches per session | One coach per session only. No multi-coach or assistant coach support. |
| Series generation | Instances auto-generated based on live credit balance. Series pauses when balance hits zero; resumes automatically when player tops up on-platform via Stripe. |
| Credit source of truth | All purchases go through Stripe. Credits added to Available balance only after Stripe confirms payment. Balance tracked via append-only ledger with three states: Available → Committed (on booking) → Consumed (on session complete). Cancellation returns Committed → Available. Late cancellation forfeits Committed → Consumed. Credits never consumed at booking time. |
| Platform domain | TBD — client to provide. Infrastructure provisioning deferred. |

---

## Remaining Open Questions

The following need answers before technical design begins:

~~1. **Credit expiry on cancellation returns**~~ — **Resolved**: All credits (purchased and returned from cancellations) never expire. No expiry logic required.
~~2. **Reschedule confirmation flow**~~ — **Resolved**: Auto-confirmed. If the player picks an available slot it is immediately booked — no coach approval required. The coach's published availability is the approval gate.
~~3. **Multiple coaches per session**~~ — **Resolved**: One coach per session only.
~~4. **Video review flag**~~ — **Resolved**: Amber badge on coach dashboard after 3 days with no written response. Also visible on Super Coach dashboard for accountability. Badge clears when coach submits their response. A daily scheduled Lambda checks for unresponded videos and writes the flag.
~~5. **Coach profile — session duration options**~~ — **Resolved**: Session duration is defined per package template (e.g. Standard = 45 min, Premium = 60 min). Duration is fixed at purchase — not selectable by the player at booking time.
~~6. **Deregistered coach — session reassignment**~~ — **Resolved**: Session reassignment is a standalone Super Coach capability used anytime (illness, player coach-change, deregistration). Super Coach must resolve all upcoming sessions before deactivating a coach account. Cancellations during deregistration always return full credit to players.
