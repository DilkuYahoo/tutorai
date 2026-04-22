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
│   │   │   ├── admin/           # DashboardPage, JobsPage, CandidatesPage, PipelinePage, InterviewsPage, ReportsPage
│   │   │   ├── public/          # CareersPage, ApplicationPage
│   │   │   └── shared/          # NotFoundPage
│   │   ├── components/
│   │   │   ├── layout/          # AppLayout, AppSidebar, AppTopbar, PublicLayout, RequireRole, RoleSwitcher
│   │   │   ├── candidates/      # CandidateDrawer, CandidateRow, CandidateTagList, StageBadge
│   │   │   ├── interviews/      # FeedbackModal, InterviewRow
│   │   │   ├── jobs/            # JobCard, JobModal, JobStatusBadge
│   │   │   ├── pipeline/        # KanbanBoard, KanbanCard, KanbanColumn
│   │   │   ├── charts/          # BarChart, FunnelChart, LineChart (ECharts wrappers)
│   │   │   └── ui/              # BaseBadge, BaseButton, BaseDrawer, BaseInput, BaseModal, BaseSelect, BaseTextarea, EmptyState, LoadingSpinner, StatCard
│   │   ├── context/             # AuthContext, CandidatesContext, InterviewsContext, JobsContext, UIContext
│   │   ├── hooks/               # useAuth, useCandidates, useInterviews, useJobs, useUI
│   │   ├── data/
│   │   │   └── mockData.js      # In-memory fallback; seeds all contexts when VITE_API_URL is absent
│   │   └── services/            # (empty — reserved for API client when wiring to real backend)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── lambda/
│   ├── shared/                  # Lambda Layer source: db.py, auth.py, response.py, ids.py, validation.py
│   ├── jobs/                    # list_jobs, get_job, create_job, update_job, archive_job
│   ├── candidates/              # list_candidates, get_candidate, create_candidate, update_candidate
│   ├── applications/            # list_applications, get_application, create_application, move_stage
│   ├── pipeline/                # get_pipeline
│   ├── interviews/              # list_interviews, create_interview, update_interview, submit_feedback
│   ├── users/                   # get_me, list_users
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
| GET | /reports/metrics | Cognito JWT | get_metrics |
| GET | /audit/{entityId} | Cognito JWT | get_audit_trail |
| POST | /resumes/upload-url | **None** | get_upload_url |

Public routes (no auth): `POST /candidates`, `POST /applications`, `POST /resumes/upload-url` — these are called by the public-facing careers/application pages.

---

## Deploy commands

All deployments go through `deploy.sh` in the project root. Never run `aws s3 sync` or `sam deploy` manually.

```bash
# Frontend only (mock data, no backend required) → ats-dev.advicelab.com.au
./deploy.sh dev

# Lambda backend + frontend → ats-test.advicelab.com.au
./deploy.sh test

# Promote test → prod (copies S3 artifacts, deploys Lambda to prod stack) → ats.advicelab.com.au
./deploy.sh promote

# Deploy/update the CloudFront + Route 53 stack (run once, or after CF changes)
# Must target us-east-1; automatically backs up the Route 53 zone first
./deploy.sh cf
```

### Environment model

| Env | URL | Backend | Frontend source | Purpose |
|-----|-----|---------|-----------------|---------|
| dev | ats-dev.advicelab.com.au | None | Mock data | UI development and client preview |
| test | ats-test.advicelab.com.au | `ats-test` SAM stack | Built from source with test API URL | Full-stack integration + UAT |
| prod | ats.advicelab.com.au | `ats-prod` SAM stack | **Copied from test** (no rebuild) | Live environment |

Promotion copies the exact S3 artifacts from `ats/web/test/` to `ats/web/prod/` — the prod frontend is never rebuilt from source. This guarantees prod runs the same binary that passed UAT in test.

`confirm_changeset = true` in `samconfig.toml` for prod: SAM prints the changeset diff and pauses for approval before touching prod infrastructure.

### Frontend API URL injection

`VITE_API_URL` is baked at build time via `vite.config.js`. The deploy script writes a `.env.production` file with the URL resolved from the SAM stack's `ApiUrl` output. For `dev`, no `.env.production` is written and the app falls back to `src/data/mockData.js`.

---

## Frontend architecture

### Stack
React 18 + Vite 5, Tailwind CSS 3 (dark mode `class` strategy), React Router v6, ECharts 5 via `echarts-for-react`. Plain JS + JSX — no TypeScript. No test suite configured.

### Two-layout routing pattern
`src/router.jsx` defines two nested route trees:
- **AppLayout**: sidebar + topbar + `<Outlet />`. Wraps all admin routes. Guarded by `<RequireRole allowed={['admin', 'hiring_manager']}>`.
- **PublicLayout**: minimal header only. Wraps `/careers` and `/careers/:jobId/apply`.

Root `/` redirects to `/careers`. `reports` is admin-only (second `<RequireRole>` inside the admin tree).

### State management
No external state library. Each domain has a Context + `useReducer` pair with a matching `useXxx` hook:

| Context | Domain |
|---------|--------|
| `AuthContext` | Current user, role switching |
| `JobsContext` | Job requisitions, create/edit modal |
| `CandidatesContext` | Candidates, applications, filters, drawer |
| `InterviewsContext` | Interviews, feedback modal |
| `UIContext` | Sidebar collapsed state |

All providers are stacked in `src/main.jsx`. The pipeline page derives its Kanban columns directly from `CandidatesContext` — there is no separate pipeline context.

### Mock data
`src/data/mockData.js` is the single source of truth for all data when `VITE_API_URL` is absent. It exports `MOCK_USERS`, `MOCK_JOBS`, `MOCK_CANDIDATES`, `MOCK_APPLICATIONS`, `MOCK_INTERVIEWS`, `MOCK_METRICS`, and lookup constants (`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES`, `INTERVIEW_TYPES`, `SOURCE_CHANNELS`).

When wiring a real API: replace the initial state seeds in each context with fetched data and convert action handlers to async operations. The `src/services/` directory is reserved for this API client.

### `@` alias
`vite.config.js` maps `@` → `./src`. All imports use `@/` rather than relative paths.

### Tailwind conventions
- All styling is inline Tailwind utilities — no CSS modules.
- Dark mode is default: `class="dark"` is set on `<html>` in `index.html`, never toggled.
- Font: Inter via system stack.
- Card pattern: `rounded-2xl border border-slate-800 bg-slate-900 p-5`
- Badge variants (`BaseBadge`): `indigo`, `emerald`, `amber`, `red`, `slate` — used consistently for job statuses and pipeline stages. Mappings live in `JobStatusBadge.jsx` and `StageBadge.jsx`.
- Animations defined in `tailwind.config.js`: `animate-fade-in`, `animate-fade-up`, `animate-slide-in-right`, `animate-slide-in-left`.

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
| `db.py` | DynamoDB helpers: `get_item`, `put_item`, `update_item`, `query_pk`, `query_gsi`, `batch_get`, `transact_write` |
| `auth.py` | JWT claim extraction (`get_user_id`, `get_role`, `get_user_name`) and `require_role` guard |
| `response.py` | HTTP response builders: `ok`, `created`, `no_content`, `bad_request`, `forbidden`, `not_found`, `conflict`, `server_error`, `preflight` — all include CORS headers |
| `ids.py` | `generate_id()` (UUID4), `utc_now()` (ISO 8601), `today()` (YYYY-MM-DD) |
| `validation.py` | Lookup constants (`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES`, `INTERVIEW_TYPES`, `INTERVIEW_STATUSES`, `FEEDBACK_RECOMMENDATIONS`) and `require_fields`, `require_enum`, `ValidationError` |

### Patterns
- Every handler checks `OPTIONS` and returns `preflight()` first.
- Role enforcement via `require_role(event, *allowed_roles)` — returns a 403 response dict on failure; caller returns it immediately.
- Body parsed from `event["body"]` with `json.loads`; empty body defaults to `{}`.
- All mutations write an audit item to `PK=AUDIT#{entityId}` alongside the main write, using `transact_write` for atomicity.
- Stage moves (move_stage.py) also write a history item (`PK=APPLICATION#{id}`, `SK=HISTORY#{now}#{stage}`) and fire an async notification to `send_email` Lambda via `InvocationType="Event"`.

### DynamoDB access patterns (single-table)
- `PK=JOB#{id}`, `SK=#META` — job record
- `PK=CANDIDATE#{id}`, `SK=#META` — candidate record
- `PK=APPLICATION#{id}`, `SK=#META` — application record
- `PK=APPLICATION#{id}`, `SK=HISTORY#{timestamp}#{stage}` — stage history
- `PK=AUDIT#{entityId}`, `SK={timestamp}#{action}` — audit trail
- `GSI1PK=JOBS`, `GSI1SK={status}#{createdAt}#{id}` — list jobs by status
- `GSI1PK=JOB#{jobId}`, `GSI1SK=APP#{stage}#{createdAt}#{id}` — applications per job
- `GSI2PK=CANDIDATE#{candidateId}`, `GSI2SK=APP#{createdAt}` — applications per candidate

---

## Domain model

### Pipeline stages (ordered)
`Applied` → `Screening` → `Interview` → `Final Interview` → `Offer` → `Hired` / `Rejected`

### Job statuses
`Draft` → `Open` → `Closed` → `On Hold` → `Archived`

### Roles
| Role | Access |
|------|--------|
| `admin` | All routes including `/reports` |
| `hiring_manager` | All routes except `/reports` |
| `candidate` | Public routes only (`/careers`, `/careers/:jobId/apply`) |

Role is stored as a Cognito custom attribute (`custom:role`) and injected into JWT claims. The frontend reads it from `AuthContext`; the backend reads it via `auth.get_role(event)`.

---

## Key decisions — do not reverse without discussion

### Single-table DynamoDB design
All entities (jobs, candidates, applications, interviews, audit) live in one table (`al_ats_{env}`). GSI1 and GSI2 enable the primary list access patterns. This is intentional — do not add a second table without discussing the access pattern first.

### No rebuild on promote
`./deploy.sh promote` copies S3 artifacts from test → prod rather than rebuilding. This is intentional: prod must run the exact binary that was UAT'd in test. Never run `npm run build` targeting prod directly.

### Public routes have no auth
`POST /candidates`, `POST /applications`, and `POST /resumes/upload-url` have `Authorizer: NONE` in the SAM template. This is intentional — candidates apply without an account. Do not add auth to these routes.

### Async email notifications
`send_email` Lambda is invoked with `InvocationType="Event"` (fire-and-forget) from `move_stage` and `create_application`. Email failures do not fail the API response. Do not change this to synchronous invocation.

### Validation constants shared across Lambda and frontend
`PIPELINE_STAGES`, `JOB_STATUSES`, `EMPLOYMENT_TYPES` etc. are defined in both `lambda/shared/validation.py` and `frontend/src/data/mockData.js`. These must be kept in sync manually — there is no code generation step.

### CloudFront stack in us-east-1
`cloudfront.yaml` must be deployed to us-east-1 — ACM certificates for CloudFront are only valid when issued in us-east-1. The deploy script handles this automatically via `--region us-east-1`.
