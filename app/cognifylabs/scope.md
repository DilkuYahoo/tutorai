# CognifyLabs — CloudFront Traffic Monitor
## Project Scope

### Overview
An internal monitoring dashboard that ingests AWS CloudFront access logs, visualises traffic patterns, and surfaces potentially suspicious activity. Monitoring only — no traffic blocking.

---

### 1. Data Ingestion

- Enable CloudFront access logging on all distributions, delivering logs to a **new dedicated S3 bucket** (e.g. `cognifylabs-cloudfront-logs`).
- CloudFront logs only — no WAF, no ALB.
- Logs are parsed by a Lambda and stored in DynamoDB to support near-real-time and historical queries.

---

### 2. Distributions

- ~5–6 CloudFront distributions in the account.
- Default view: **aggregated** across all distributions.
- User can **drill down** into any individual distribution via a dropdown selector.

---

### 3. Dashboard Metrics

| Metric | Notes |
|---|---|
| Total requests | Per time interval |
| Unique IPs | Distinct visitor count |
| Cache hit/miss ratio | Derived from CloudFront `x-edge-result-type` field |
| HTTP status code breakdown | 2xx, 3xx, 4xx, 5xx |
| Top User-Agent strings | Browser/bot breakdown |
| Geographic traffic map | Circle size proportional to request volume |

---

### 4. Geographic Visualisation

- World map with **circles sized proportionally** to request volume per location.
- IPs geo-located using a server-side lookup (e.g. `geoip2` or AWS IP database).
- Suspicious zones **visually highlighted** — threshold values TBD, configurable later.

---

### 5. Date & Time Filtering

- Default view: **last 24 hours**.
- Preset ranges: 24h, 7d, 30d.
- Custom date range picker.
- Dashboard **auto-refreshes every 60 seconds**.

---

### 6. Tech Stack

Follows the same patterns established in the ATS project (`app/ats/`).

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5, Tailwind CSS 3, shadcn/ui, Plain JS + JSX (no TypeScript) |
| Charts | ECharts 5 via `echarts-for-react` (consistent with ATS) |
| Auth (client) | `amazon-cognito-identity-js` |
| Backend | AWS Lambda (Python 3.13, arm64) + HTTP API Gateway |
| Infrastructure | AWS SAM (`template.yaml`) — consistent with ATS IaC pattern |
| Log storage | Amazon S3 (dedicated bucket: `cognifylabs-cloudfront-logs`) |
| Data store | DynamoDB (single-table design, PK/SK + GSIs — same pattern as ATS) |
| Auth (server) | AWS Cognito User Pool — email + temporary password, users created via CLI |
| Region | ap-southeast-2 (Lambda/API/DynamoDB); us-east-1 (CloudFront + ACM) |

---

### 7. Frontend Architecture

Mirrors the ATS frontend structure:

```
frontend/
├── src/
│   ├── main.jsx             # Entry point; Context providers stacked here
│   ├── router.jsx           # React Router v6
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   └── DashboardPage.jsx
│   ├── components/
│   │   ├── layout/          # AppLayout, AppSidebar, AppTopbar, AppFooter
│   │   ├── charts/          # Map, LineChart, BarChart (ECharts wrappers)
│   │   └── ui/              # BaseBadge, BaseButton, BaseSelect, StatCard, LoadingSpinner
│   ├── context/             # AuthContext + domain contexts
│   ├── hooks/               # useAuth + domain hooks
│   ├── data/
│   │   └── mockData.js      # In-memory fallback when VITE_API_URL is absent
│   └── services/
│       ├── api.js           # Axios-based API client
│       └── cognito.js       # Cognito login/logout/completeNewPasswordChallenge
├── vite.config.js
├── tailwind.config.js
└── package.json
```

**Tailwind conventions (same as ATS):**
- Dark mode default: `class="dark"` on `<html>`, never toggled.
- Card pattern: `rounded-2xl border border-slate-800 bg-slate-900 p-5`
- All styling is inline Tailwind utilities — no CSS modules.
- `@` alias maps to `./src` in `vite.config.js`.

---

### 8. Lambda Architecture

Mirrors the ATS Lambda structure:

```
lambda/
├── shared/         # Lambda Layer: db.py, auth.py, response.py, ids.py, validation.py
├── logs/           # ingest_logs (S3 trigger), query_logs (API)
├── distributions/  # list_distributions
└── geo/            # resolve_ip (geo-lookup utility)
```

- All functions: Python 3.13, arm64, 256 MB, 15s timeout.
- Shared layer packaged as `platform_monitor-shared-{env}`.
- Every handler returns `preflight()` on `OPTIONS`.
- CORS headers included in all responses via `response.py`.

---

### 9. Authentication

- AWS Cognito User Pool.
- Users provisioned by admin via AWS CLI:
  ```bash
  aws cognito-idp admin-create-user \
    --user-pool-id <POOL_ID> \
    --username user@example.com \
    --temporary-password TempPass123! \
    --desired-delivery-mediums EMAIL
  ```
- Login: email + temporary password → forced password reset on first login (`NEW_PASSWORD_REQUIRED` challenge handled in `LoginPage`).
- Role stored as `custom:role` Cognito attribute.
- No social logins.

---

### 10. Infrastructure (SAM)

```
iac/
├── template.yaml      # SAM: DynamoDB, Cognito, API GW, all Lambda functions
├── samconfig.toml     # [test] and [prod] environments
└── cloudfront.yaml    # CloudFront + Route 53 (deployed to us-east-1)
```

- `DeletionPolicy: Retain` on DynamoDB — never deleted on stack teardown.
- CloudFront/ACM stack deployed to `us-east-1` (ACM cert requirement).
- Single `deploy.sh` entrypoint — never run `sam deploy` manually.

---

### 11. Deployment

| Context | URL | Backend | How to run |
|---|---|---|---|
| Local dev | http://localhost:5173 | None (mock data) | `cd frontend && npm run dev` |
| Production | TBD (e.g. `monitor.cognifylabs.ai`) | `platform_monitor-prod` SAM stack | `./deploy.sh backend` |

`VITE_API_URL` baked at build time via `vite.config.js`. Falls back to `mockData.js` when absent.

---

### 12. Implementation Plan

Delivered in phases. Auth is intentionally last — the dashboard is **public (no login required)** until Phase 5.

---

#### Phase 1 — AWS Infrastructure & Log Ingestion
> Goal: CloudFront logs flowing into S3 and queryable from DynamoDB.

- [ ] Create `cognifylabs-cloudfront-logs` S3 bucket (ap-southeast-2)
- [ ] Enable CloudFront access logging on all 5–6 distributions → point to new bucket
- [ ] Write `ingest_logs` Lambda — triggered by S3 `ObjectCreated` event, parses CloudFront log format, writes records to DynamoDB
- [ ] Design DynamoDB single-table schema (PK/SK + GSIs for time-range and distribution queries)
- [ ] Write SAM `template.yaml` — DynamoDB table, S3 bucket, `ingest_logs` Lambda, S3 event trigger
- [ ] Deploy and verify logs are landing in DynamoDB

---

#### Phase 2 — Backend API
> Goal: API endpoints that the frontend can call to fetch metrics.

- [ ] Set up shared Lambda Layer (`platform_monitor-shared`) — `db.py`, `response.py`, `ids.py`, `auth.py`
- [ ] `list_distributions` Lambda — returns all known distribution IDs + names
- [ ] `query_logs` Lambda — accepts `distributionId`, `from`, `to`; returns aggregated metrics (requests, unique IPs, status codes, user agents, cache hit/miss)
- [ ] `query_geo` Lambda — returns IP → country/lat/lon aggregations for the map
- [ ] Wire all Lambdas to HTTP API Gateway in `template.yaml` (**no Cognito auth at this stage — all routes public**)
- [ ] Deploy and test endpoints with `curl`

---

#### Phase 3 — Frontend Foundation
> Goal: React app scaffolded with layout, routing, and mock data working.

- [ ] Scaffold `frontend/` — Vite + React 18 + Tailwind CSS 3 + shadcn/ui
- [ ] Set up `vite.config.js` with `@` alias, ECharts in `optimizeDeps.include`
- [ ] Build `AppLayout` — sidebar, topbar, footer (same pattern as ATS)
- [ ] Build `LoginPage` placeholder (not wired to Cognito yet)
- [ ] Build `DashboardPage` shell with stat cards and placeholder charts
- [ ] Wire `mockData.js` fallback so dev works without a backend
- [ ] Set up `api.js` (Axios client) and `AuthContext` stub

---

#### Phase 4 — Dashboard Features
> Goal: Fully working dashboard connected to the real API.

- [ ] **Distribution selector** — dropdown to switch between distributions or view all
- [ ] **Date range filter** — preset buttons (24h, 7d, 30d) + custom date picker
- [ ] **Stat cards** — total requests, unique IPs, cache hit %, top status code
- [ ] **Requests over time** — ECharts line chart, grouped by hour/day
- [ ] **Status code breakdown** — ECharts bar chart
- [ ] **Top User-Agents** — table with count + % share
- [ ] **Geographic map** — ECharts world map with proportional circles per country
- [ ] **Auto-refresh** — poll API every 60 seconds, update all widgets
- [ ] Connect all components to real API (`VITE_API_URL` env var)

---

#### Phase 5 — Cognito Authentication (last)
> Goal: Lock the dashboard behind a login screen.

- [ ] Add Cognito User Pool + App Client to `template.yaml`
- [ ] Add `cognitoLogin`, `cognitoLogout`, `completeNewPasswordChallenge` to `cognito.js`
- [ ] Wire `AuthContext` to real Cognito session
- [ ] Add `RequireAuth` route guard — redirect to `/login` if no session
- [ ] Add Cognito `JWT_AUTHORIZER` to all API Gateway routes in `template.yaml`
- [ ] Add `auth.py` JWT claim extraction to Lambda shared layer
- [ ] Document user provisioning CLI command in `CLAUDE.md`
- [ ] Test first-login flow (temp password → forced reset)

---

### 13. Out of Scope (for now)

- Traffic blocking or WAF rule management.
- Real-time WebSocket streaming (60s polling is sufficient).
- Multi-account AWS support.
- Mobile-optimised layout.
- Automated alerting / notifications.
- TypeScript.
