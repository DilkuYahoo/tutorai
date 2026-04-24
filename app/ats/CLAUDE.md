# ATS — Claude Context

## What this project is

A web-based Applicant Tracking System (ATS) that enables HR teams and hiring managers to manage the full recruitment lifecycle — job creation, candidate applications, pipeline management, interview scheduling, and reporting. Built and maintained by CognifyLabs.ai. Hosted at advicelab.com.au.

---

## Repo structure

```
app/ats/
├── deploy.sh                    # Single entrypoint for all deployments (dev/test/promote/cf)
├── scope.md                     # Phase roadmap and feature requirements
├── frontend/                    # React + Vite SPA
│   ├── src/
│   │   ├── main.jsx             # Entry point; stacks all Context providers
│   │   ├── router.jsx           # React Router v6 route tree (two layouts: AppLayout + PublicLayout)
│   │   ├── pages/
│   │   │   ├── admin/           # DashboardPage, JobsPage, CandidatesPage, PipelinePage, InterviewsPage, ReportsPage, UsersPage
│   │   │   ├── public/          # CareersPage, ApplicationPage, JobDetailPage, LoginPage, PrivacyPolicyPage, TermsOfUsePage
│   │   │   └── shared/          # NotFoundPage
│   │   ├── components/
│   │   │   ├── layout/          # AppLayout, AppSidebar, AppTopbar, AppFooter, PublicLayout, RequireRole, RoleSwitcher
│   │   │   ├── candidates/      # CandidateDrawer, CandidateRow, CandidateTagList, StageBadge
│   │   │   ├── interviews/      # FeedbackModal, InterviewRow, ScheduleInterviewModal
│   │   │   ├── jobs/            # JobCard, JobModal, JobStatusBadge
│   │   │   ├── pipeline/        # KanbanBoard, KanbanCard, KanbanColumn
│   │   │   ├── charts/          # BarChart, FunnelChart, LineChart (ECharts wrappers)
│   │   │   └── ui/              # BaseBadge, BaseButton, BaseDrawer, BaseInput, BaseModal, BaseSelect, BaseTextarea, EmptyState, LoadingSpinner, StatCard
│   │   ├── context/             # AuthContext, CandidatesContext, InterviewsContext, JobsContext, UIContext, UsersContext
│   │   ├── hooks/               # useAuth, useCandidates, useInterviews, useJobs, useUI, useUsers
│   │   ├── data/
│   │   │   └── mockData.js      # In-memory fallback; seeds all contexts when VITE_API_URL is absent
│   │   └── services/
│   │       ├── api.js           # Axios-based API client; USE_API=true when VITE_API_URL is set
│   │       └── cognito.js       # Cognito auth helpers (login, logout, completeNewPasswordChallenge)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── lambda/
│   ├── shared/                  # Lambda Layer source: db.py, auth.py, response.py, ids.py, validation.py
│   ├── jobs/                    # list_jobs, get_job, get_job_public, list_jobs_public, create_job, update_job, archive_job
│   ├── candidates/              # list_candidates, get_candidate, create_candidate, update_candidate
│   ├── applications/            # list_applications, get_application, create_application, move_stage
│   ├── pipeline/                # get_pipeline
│   ├── interviews/              # list_interviews, create_interview, update_interview, submit_feedback
│   ├── users/                   # get_me, list_users, invite_user, update_user, enable_user, disable_user, delete_user
│   ├── reports/                 # get_metrics
│   ├── audit/                   # get_audit_trail
│   ├── resumes/                 # get_upload_url
│   └── notifications/           # send_email (invoked async — no API route)
└── iac/
    ├── template.yaml            # SAM template: DynamoDB, Cognito, API GW, all Lambda functions
    ├── samconfig.toml           # SAM config: [test] and [prod] environments
    ├── cloudfront.yaml          # CloudFront distribution + Route 53 (deployed to us-east-1)
    └── backups/                 # Route 53 zone backups created automatically by deploy.sh cf
```

---

## AWS infrastructure

- Region: ap-southeast-2 (Lambda/API/DynamoDB); us-east-1 (CloudFront + ACM)
- AWS account: 724772096157
- S3 bucket (shared): `advicelab`
  - Frontend web files: `ats/web/{env}/` (env = dev | test | prod)
  - Resume uploads: `ats/resumes/{env}/`
- DynamoDB table: `al_ats_{env}` (single-table design, PK/SK + GSI1 + GSI2)
  - `DeletionPolicy: Retain` — never deleted on stack teardown
  - PITR enabled on both test and prod
- Cognito User Pool: `ats-users-{env}` (JWT auth, email-based, `custom:role` claim)
  - `USER_POOL_ID` is injected into all Lambda functions via SAM Globals env
  - Lambda execution role has Cognito admin permissions for user management operations
- Lambda Layer: `ats-shared-{env}` (shared Python utilities)
- Lambda functions: `ats-{function}-{env}`, Python 3.13, arm64, 256 MB, 15 s timeout
  - Exception: `ats-get-pipeline-{env}` and `ats-get-metrics-{env}` have 29 s timeout
- CloudFront distribution: single distribution for `ats.advicelab.com.au` → `ats/web/prod/` (deployed separately via `cloudfront.yaml` to us-east-1)
- ACM certificate: `arn:aws:acm:us-east-1:724772096157:certificate/779f833d-9f09-4dbd-8898-99e4a245209f` (wildcard `*.advicelab.com.au`)
- Route 53 hosted zone: Z0015604O8Z36ZXYJGP0 (advicelab.com.au)

---

## API endpoints

All Lambda functions are exposed via AWS HTTP API Gateway:

```
https://xmok7w4utg.execute-api.ap-southeast-2.amazonaws.com/prod
```

Cognito User Pool: `ap-southeast-2_3EYyw3ciV` | App Client: `urd1de9263aulbtv0nn6dmp11`

| Method | Path | Auth | Function |
|--------|------|------|----------|
| GET | /jobs | Cognito JWT | list_jobs |
| GET | /jobs/{jobId} | Cognito JWT | get_job |
| GET | /jobs/public | **None** | list_jobs_public |
| GET | /jobs/{jobId}/public | **None** | get_job_public |
| POST | /jobs | Cognito JWT | create_job |
| PUT | /jobs/{jobId} | Cognito JWT | update_job |
| DELETE | /jobs/{jobId} | Cognito JWT | archive_job |
| GET | /candidates | Cognito JWT | list_candidates |
| GET | /candidates/{candidateId} | Cognito JWT | get_candidate |
| POST | /candidates | **None** | create_candidate |
| PUT | /candidates/{candidateId} | Cognito JWT | update_candidate |
| GET | /applications | Cognito JWT | list_applications |
| GET | /applications/{applicationId} | Cognito JWT | get_application |
| POST | /applications | **None** | create_application |
| POST | /applications/{applicationId}/move | Cognito JWT | move_stage |
| GET | /pipeline | Cognito JWT | get_pipeline |
| GET | /interviews | Cognito JWT | list_interviews |
| POST | /interviews | Cognito JWT | create_interview |
| PUT | /interviews/{interviewId} | Cognito JWT | update_interview |
| POST | /interviews/{interviewId}/feedback | Cognito JWT | submit_feedback |
| GET | /users/me | Cognito JWT | get_me |
| GET | /users | Cognito JWT | list_users |
| POST | /users | Cognito JWT (admin) | invite_user |
| PUT | /users/{userId} | Cognito JWT (admin) | update_user |
| POST | /users/{userId}/enable | Cognito JWT (admin) | enable_user |
| POST | /users/{userId}/disable | Cognito JWT (admin) | disable_user |
| DELETE | /users/{userId} | Cognito JWT (admin) | delete_user |
| GET | /reports/metrics | Cognito JWT (admin) | get_metrics |
| GET | /audit/{entityId} | Cognito JWT | get_audit_trail |
| POST | /resumes/upload-url | **None** | get_upload_url |

Public routes (no auth): `POST /candidates`, `POST /applications`, `GET /jobs/public`, `GET /jobs/{jobId}/public`, `POST /resumes/upload-url` — called by the public-facing careers pages.

Admin-only routes: all `/users` mutation endpoints and `GET /reports/metrics`.

---

## Deploy commands

All deployments go through `deploy.sh` in the project root. Never run `aws s3 sync` or `sam deploy` manually.

```bash
# Deploy Lambda backend + build frontend + sync to S3 + invalidate CloudFront → https://ats.advicelab.com.au
./deploy.sh backend

# Deploy/update the CloudFront + Route 53 stack (run once, or after CF changes)
# Must target us-east-1; automatically backs up the Route 53 zone first
./deploy.sh cf
```

### Environment model

There is a single production environment. Local development uses the Vite dev server with mock data (no backend needed).

| Context | URL | Backend | How to run |
|---------|-----|---------|------------|
| Local dev | http://localhost:5173 | None (mock data) | `cd frontend && npm run dev` |
| Production | ats.advicelab.com.au | `ats-prod` SAM stack | `./deploy.sh backend` |

### Frontend API URL injection

`VITE_API_URL` is baked at build time via `vite.config.js`. The deploy script writes a `.env.production` file with the URL resolved from the SAM stack's `ApiUrl` output. For `dev`, no `.env.production` is written and the app falls back to `src/data/mockData.js`.

---

## Frontend architecture

### Stack
React 18 + Vite 5, Tailwind CSS 3 (dark mode `class` strategy), React Router v6, ECharts 5 via `echarts-for-react`. Plain JS + JSX — no TypeScript. No test suite configured.

### Dependencies (package.json)
| Package | Purpose |
|---------|---------|
| `react`, `react-dom`, `react-router-dom` | Core framework |
| `echarts`, `echarts-for-react` | Charts (dashboard/reports) |
| `amazon-cognito-identity-js` | Cognito login, logout, new password challenge |
| `@dnd-kit/core`, `@dnd-kit/utilities` | Drag-and-drop on the Kanban pipeline board |
| `react-big-calendar` | Calendar view on the Interviews page |
| `date-fns` | Date formatting (used by react-big-calendar localiser) |

**Important:** All of the above are in `dependencies` in `package.json`. Do not run bare `npm install <pkg>` — always use `--save` to keep `package.json` in sync. A plain `npm install` has previously wiped unlisted packages.

### Two-layout routing pattern
`src/router.jsx` defines two nested route trees:
- **AppLayout**: sidebar + topbar + footer (compact) + `<Outlet />`. Wraps all admin routes. Guarded by `<RequireRole allowed={['admin', 'hiring_manager']}>`.
- **PublicLayout**: minimal header + footer (full) + `<Outlet />`. Wraps all public routes.

Root `/` redirects to `/careers`. `reports` and all `/users` mutations are admin-only (second `<RequireRole>` inside the admin tree).

### Route table
| Path | Layout | Page | Auth |
|------|--------|------|------|
| `/careers` | Public | CareersPage | None |
| `/careers/:jobId` | Public | JobDetailPage | None |
| `/careers/:jobId/apply` | Public | ApplicationPage | None |
| `/privacy` | Public | PrivacyPolicyPage | None |
| `/terms` | Public | TermsOfUsePage | None |
| `/login` | None | LoginPage | None |
| `/dashboard` | App | DashboardPage | admin, hiring_manager |
| `/jobs` | App | JobsPage | admin, hiring_manager |
| `/candidates` | App | CandidatesPage | admin, hiring_manager |
| `/pipeline` | App | PipelinePage | admin, hiring_manager |
| `/interviews` | App | InterviewsPage | admin, hiring_manager |
| `/reports` | App | ReportsPage | admin only |
| `/users` | App | UsersPage | admin only |

### State management
No external state library. Each domain has a Context + `useReducer` pair with a matching `useXxx` hook:

| Context | Hook | Domain |
|---------|------|--------|
| `AuthContext` | `useAuth` | Current user, role, Cognito session |
| `JobsContext` | `useJobs` | Job requisitions, create/edit modal |
| `CandidatesContext` | `useCandidates` | Candidates, applications, filters, drawer |
| `InterviewsContext` | `useInterviews` | Interviews, schedule modal, feedback modal |
| `UsersContext` | `useUsers` | Platform users, invite/edit/enable/disable/delete |
| `UIContext` | `useUI` | Sidebar collapsed state |

All providers are stacked in `src/main.jsx`. The pipeline page derives its Kanban columns directly from `CandidatesContext` — there is no separate pipeline context.

### UsersContext — important notes
- `GET /users` is accessible to both `admin` and `hiring_manager` roles — hiring managers need the user list to resolve panel member names on interviews.
- `userById(id)` is a helper function exposed from `UsersContext` — use it in any component that needs to resolve a user UUID to a name (e.g. interview panel display).
- Mutation endpoints (invite, update, enable, disable, delete) are admin-only and guarded on both frontend and backend.
- A user cannot disable or delete their own account — guarded on both frontend (button disabled when `user.id === currentUser.id`) and backend.

### InterviewsContext — important notes
- `upcomingInterviews` = status `Scheduled`, sorted ascending by date.
- `pastInterviews` = status `Completed` or `No-show` only. **Cancelled interviews are excluded from both lists and the calendar** — they disappear on cancel.
- `updateInterview(id, updates)` handles both reschedules and status changes (including cancellation). It is exposed in the provider `value` object — do not omit it.
- `openScheduleModal(context, interviewId?)` — pass `interviewId` to open in edit/reschedule mode; omit or pass `null` for new scheduling.

### Interview business rules
- **One active interview per application**: `create_interview.py` queries GSI1 for existing `Scheduled` interviews on the same `applicationId` and returns 409 if one exists. The frontend `ScheduleInterviewModal` also shows an amber warning banner and disables Submit when an active interview is detected.
- **Cancellation**: `update_interview.py` accepts `{ "status": "Cancelled" }`. The frontend provides inline two-step confirmation (Cancel → Confirm/Keep) in both `InterviewRow` (list view) and the calendar right-hand panel.

### InterviewsPage features
- **List view** (default): Upcoming (Scheduled) and Past (Completed, No-show) sections with search filter.
- **Calendar view**: `react-big-calendar` with week view default. Import locale as `import enAU from 'date-fns/locale/en-AU'` (direct subpath) — the barrel import `from 'date-fns/locale'` does not resolve under Vite.
- **Right-hand panel**: click any calendar event to open a details panel with Reschedule and Cancel actions.
- **Search filter**: single input filters both views by candidate name or job title.
- Calendar theme: `.rbc-dark` CSS class wraps the calendar; overrides are in `src/index.css` under the `.rbc-*` section.

### Pipeline (Kanban) — drag-and-drop
- Uses `@dnd-kit/core` with `PointerSensor` (5 px activation threshold to prevent accidental drags).
- `KanbanBoard` wraps in `DndContext`; `KanbanColumn` uses `useDroppable`; `KanbanCard` uses `useDraggable`.
- `DragOverlay` renders a ghost card (`isDragOverlay` prop) while dragging — pass `isDragOverlay` to suppress the move-stage dropdown and apply `rotate-1 scale-105`.
- Dropping onto a column calls `moveStage(applicationId, newStage)` from `CandidatesContext`.

### User management (UsersPage)
- Admin-only page at `/users`.
- Invite flow: creates Cognito user via `admin_create_user` + writes DynamoDB record. Cognito sends a temporary password email automatically (`DesiredDeliveryMediums=["EMAIL"]`).
- First login: Cognito triggers `NEW_PASSWORD_REQUIRED` challenge, handled in `LoginPage` via `completeNewPasswordChallenge`. The `name` attribute must be passed as a required attribute.
- Role is stored as `custom:role` Cognito attribute. Valid values: `admin`, `hiring_manager`.

### Branding
- Application name is **Advice Lab** throughout. Do not use "Recruit" — it was the original placeholder and has been replaced everywhere.
- `AppSidebar` logo text: "Advice Lab"
- `PublicLayout` header text: "Advice Lab"
- `AppLayout` page title fallback: "Advice Lab"

### Footer
- `AppFooter` component in `src/components/layout/AppFooter.jsx`, two variants:
  - `variant="admin"` — compact single line, offset for sidebar (`md:pl-60`), used in `AppLayout`.
  - `variant="public"` — full footer with brand, CognifyLabs.ai link, Privacy/Terms/Careers nav links, used in `PublicLayout`.
- Copyright: "© {year} AdviceLab Pty Ltd. All rights reserved."
- CognifyLabs.ai link: `https://cognifylabs.ai` (external, `target="_blank"`).

### Legal pages
- `/privacy` → `PrivacyPolicyPage` — covers Australian Privacy Act 1988, APPs, data collection, AWS Sydney storage, candidate rights, OAIC complaint pathway.
- `/terms` → `TermsOfUsePage` — covers authorised use, candidate submissions, prohibited conduct, IP, disclaimer, limitation of liability. Governed by NSW law.
- Both pages are under `PublicLayout` (no auth required) and link to each other in their footers.
- **These are placeholder documents.** They should be reviewed by a lawyer before the platform goes live with real candidates.

### Mock data
`src/data/mockData.js` is the single source of truth for all data when `VITE_API_URL` is absent. It exports `MOCK_USERS`, `MOCK_JOBS`, `MOCK_CANDIDATES`, `MOCK_APPLICATIONS`, `MOCK_INTERVIEWS`, `MOCK_METRICS`, and lookup constants (`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES`, `INTERVIEW_TYPES`, `SOURCE_CHANNELS`).

When wiring a real API: replace the initial state seeds in each context with fetched data and convert action handlers to async operations.

### `@` alias
`vite.config.js` maps `@` → `./src`. All imports use `@/` rather than relative paths.

### Tailwind conventions
- All styling is inline Tailwind utilities — no CSS modules.
- Dark mode is default: `class="dark"` is set on `<html>` in `index.html`, never toggled.
- Font: Inter via system stack.
- Card pattern: `rounded-2xl border border-slate-800 bg-slate-900 p-5`
- Badge variants (`BaseBadge`): `indigo`, `emerald`, `amber`, `red`, `slate` — used consistently for job statuses and pipeline stages. Mappings live in `JobStatusBadge.jsx` and `StageBadge.jsx`.
- Animations defined in `tailwind.config.js`: `animate-fade-in`, `animate-fade-up`, `animate-slide-in-right`, `animate-slide-in-left`.
- Light mode overrides are in `src/index.css` — re-map hardcoded dark Tailwind utilities when `.light` is on `<html>`.

### Build output
Vite manual chunks split `vendor-react` (react, react-dom, react-router-dom) and `vendor-echarts` into separate files for long-term caching. The ECharts chunk exceeds 500 kB — expected.

### Dev commands
```bash
cd frontend
npm run dev       # Vite dev server → http://localhost:5173 (mock data)
npm run build     # Production build → dist/
npm run preview   # Serve dist/ locally
```

---

## Lambda architecture

### Shared layer (`lambda/shared/`)
Packaged as a Lambda Layer (`ats-shared-{env}`). All functions import from `shared.*` via `/opt/python`.

| Module | Purpose |
|--------|---------|
| `db.py` | DynamoDB helpers: `get_item`, `put_item`, `update_item`, `query_pk`, `query_gsi`, `batch_get`, `transact_write`, `increment` |
| `auth.py` | JWT claim extraction (`get_user_id`, `get_role`, `get_user_name`) and `require_role` guard |
| `response.py` | HTTP response builders: `ok`, `created`, `no_content`, `bad_request`, `forbidden`, `not_found`, `conflict`, `server_error`, `preflight` — all include CORS headers |
| `ids.py` | `generate_id()` (UUID4), `utc_now()` (ISO 8601), `today()` (YYYY-MM-DD) |
| `validation.py` | Lookup constants (`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES`, `INTERVIEW_TYPES`, `INTERVIEW_STATUSES`, `FEEDBACK_RECOMMENDATIONS`) and `require_fields`, `require_enum`, `ValidationError` |

### Patterns
- Every handler checks `OPTIONS` and returns `preflight()` first.
- Role enforcement via `require_role(event, *allowed_roles)` — returns a 403 response dict on failure; caller returns it immediately.
- Body parsed from `event["body"]` with `json.loads`; empty body defaults to `{}`.
- All mutations write an audit item to `PK=AUDIT#{entityId}` alongside the main write, using `transact_write` for atomicity.
- Stage moves (`move_stage.py`) also write a history item (`PK=APPLICATION#{id}`, `SK=HISTORY#{now}#{stage}`) and fire an async notification.
- **All async Lambda invocations (email notifications) must be wrapped in `try/except Exception: pass`** — the notification Lambda ARN may change or be removed, and email failures must never cause a 500 on the main API response.

### Notification pattern
`send_email` Lambda is invoked asynchronously (`InvocationType="Event"`) from several handlers. The `NOTIFICATION_LAMBDA_ARN` env var points to it. Templates currently wired up:

| Template | Triggered from | When |
|----------|---------------|------|
| `application_received` | `create_application.py` | New application submitted |
| `interview_invite` | `create_interview.py` | Interview scheduled (sends formatted date/time to candidate) |
| `stage_change` | `move_stage.py` | Application moved to any stage except Offer/Rejected |
| `offer` | `move_stage.py` | Application moved to Offer stage |
| `rejection` | `move_stage.py` | Application moved to Rejected stage |

All notification blocks must be wrapped in `try/except Exception: pass` — see pattern above.

### User management Lambdas (`lambda/users/`)
All user mutation functions use `boto3` Cognito admin APIs and require `USER_POOL_ID` from environment:

| Function | Cognito operation | Notes |
|----------|------------------|-------|
| `invite_user.py` | `admin_create_user` | Checks for duplicate email scoped to `USER#` PK prefix only; sends temp password via Cognito email |
| `update_user.py` | `admin_update_user_attributes` | Updates name, role, department |
| `enable_user.py` | `admin_enable_user` | Admin only |
| `disable_user.py` | `admin_disable_user` | Cannot disable self |
| `delete_user.py` | `admin_delete_user` | Cannot delete self; removes DynamoDB record |

Duplicate-email check in `invite_user.py` uses `FilterExpression` scoped to `Attr("PK").begins_with("USER#")` to avoid false positives against candidate records that share an email.

### DynamoDB access patterns (single-table)
- `PK=JOB#{id}`, `SK=#META` — job record
- `PK=CANDIDATE#{id}`, `SK=#META` — candidate record
- `PK=APPLICATION#{id}`, `SK=#META` — application record
- `PK=APPLICATION#{id}`, `SK=HISTORY#{timestamp}#{stage}` — stage history
- `PK=INTERVIEW#{id}`, `SK=#META` — interview record
- `PK=USER#{id}`, `SK=#META` — platform user record (separate from `CANDIDATE#`)
- `PK=AUDIT#{entityId}`, `SK={timestamp}#{action}` — audit trail
- `GSI1PK=JOBS`, `GSI1SK={status}#{createdAt}#{id}` — list jobs by status
- `GSI1PK=JOB#{jobId}`, `GSI1SK=APP#{stage}#{createdAt}#{id}` — applications per job
- `GSI1PK=APPLICATION#{appId}`, `GSI1SK=INTERVIEW#{scheduledAt}` — interviews per application (used for one-active check)
- `GSI2PK=CANDIDATE#{candidateId}`, `GSI2SK=APP#{createdAt}` — applications per candidate
- `GSI2PK=INTERVIEWS`, `GSI2SK={status}#{scheduledAt}#{id}` — list all interviews by status/date

---

## Domain model

### Pipeline stages (ordered)
`Applied` → `Screening` → `Interview` → `Final Interview` → `Offer` → `Hired` / `Rejected`

### Job statuses
`Draft` → `Open` → `Closed` → `On Hold` → `Archived`

### Interview statuses
`Scheduled` → `Completed` / `Cancelled` / `No-show`

### Roles
| Role | Access |
|------|--------|
| `admin` | All routes including `/reports` and all `/users` mutations |
| `hiring_manager` | All routes except `/reports` and user mutations; can read `/users` (for panel names) |
| `candidate` | Public routes only (`/careers`, `/careers/:jobId`, `/careers/:jobId/apply`) |

Role is stored as a Cognito custom attribute (`custom:role`) and injected into JWT claims. The frontend reads it from `AuthContext`; the backend reads it via `auth.get_role(event)`.

---

## Key decisions — do not reverse without discussion

### Single-table DynamoDB design
All entities (jobs, candidates, applications, interviews, users, audit) live in one table (`al_ats_{env}`). GSI1 and GSI2 enable the primary list access patterns. Do not add a second table without discussing the access pattern first.

### No rebuild on promote
`./deploy.sh promote` copies S3 artifacts from test → prod rather than rebuilding. Prod must run the exact binary that passed UAT in test. Never run `npm run build` targeting prod directly.

### Public routes have no auth
`POST /candidates`, `POST /applications`, `GET /jobs/public`, `GET /jobs/{jobId}/public`, and `POST /resumes/upload-url` have `Authorizer: NONE` in the SAM template. Candidates apply without an account. Do not add auth to these routes.

### Async email notifications — always fire-and-forget
`send_email` Lambda is invoked with `InvocationType="Event"`. Email failures must never fail an API response. Every notification block must be wrapped in `try/except Exception: pass`. Do not change to synchronous invocation.

### One active interview per application
Only one `Scheduled` interview is permitted per `applicationId` at a time. This is enforced in `create_interview.py` (409 conflict) and warned in `ScheduleInterviewModal.jsx`. Rescheduling an existing interview (PUT) is not blocked.

### Cancelled interviews are hidden
Cancelled interviews are excluded from `upcomingInterviews`, `pastInterviews`, and the calendar. They remain in DynamoDB for audit purposes but are not surfaced in the UI.

### Validation constants must be kept in sync
`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES`, `INTERVIEW_TYPES`, `INTERVIEW_STATUSES` etc. are defined in both `lambda/shared/validation.py` and `frontend/src/data/mockData.js`. There is no code generation step — update both when adding a new value.

### CloudFront stack in us-east-1
`cloudfront.yaml` must be deployed to us-east-1 — ACM certificates for CloudFront are only valid when issued in us-east-1. The deploy script handles this automatically via `--region us-east-1`.

### USER# vs CANDIDATE# are separate entity types
Platform users (staff with Cognito accounts) are stored under `PK=USER#{id}`. Candidates (job applicants) are stored under `PK=CANDIDATE#{id}`. An email address may appear in both. The duplicate-email check in `invite_user.py` must be scoped to `USER#` records only to avoid false positives.

### date-fns locale import
In `InterviewsPage.jsx`, import the en-AU locale as `import enAU from 'date-fns/locale/en-AU'` (direct subpath). The barrel import `import { enAU } from 'date-fns/locale'` does not resolve under Vite and causes a module load error.
