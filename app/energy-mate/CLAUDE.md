# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Energy-Mate is a personal energy monitoring dashboard for a Localvolts spot-price electricity customer in Australia. It polls the [Localvolts API](https://api.localvolts.com) every 5 minutes, stores 5-minute NEM interval data in DynamoDB indefinitely, and serves a React dashboard showing current import/FiT rates, energy usage, 24-hr history, 24-hr forecast, and daily billing totals.

## Commands

### Frontend

```bash
cd frontend
npm run dev          # local dev server (uses mock data — no backend needed)
npm run build        # production build
```

When `VITE_API_URL` is not set, the frontend falls back to `src/mock.js` with generated data so the UI is fully testable without a deployed backend.

To use the live API during development, set `VITE_API_URL` in `vite.config.js`:
```javascript
define: {
  "import.meta.env.VITE_API_URL": JSON.stringify("https://iuu5v3eh3j.execute-api.ap-southeast-2.amazonaws.com"),
}
```

### Backend — deploy

```bash
cd backend
./deploy.sh backend   # sam build + sam deploy + frontend build + S3 sync
./deploy.sh frontend  # frontend build + S3 sync only
```

Build and deploy always run from `backend/iac/` using SAM. The deploy script pulls the `ApiUrl` stack output and injects it as `VITE_API_URL` at frontend build time.

### Backend — invoke pipeline manually

```bash
aws lambda invoke --function-name em-fetch-intervals --region ap-southeast-2 /tmp/out.json && cat /tmp/out.json
```

### Backend — tail logs

```bash
aws logs tail /aws/lambda/em-get-live    --since 10m --region ap-southeast-2
aws logs tail /aws/lambda/em-get-history --since 10m --region ap-southeast-2
aws logs tail /aws/lambda/em-fetch-intervals --since 10m --region ap-southeast-2
```

## Architecture

### Data flow

```
Localvolts API (api.localvolts.com/v1/customer/interval)
    │
    ├── EventBridge rate(5 minutes) → em-fetch-intervals Lambda
    │       fetches past 24hrs + next 24hrs → upserts to DynamoDB
    │
    └── on Refresh / page load
            ├── GET /dashboard/live  → em-get-live Lambda
            │       calls Localvolts directly (always fresh), upserts current interval
            └── GET /dashboard/history → em-get-history Lambda
                    reads DynamoDB for 48-hr window + computes today's billing totals
```

### DynamoDB schema (`em_energy_mate_prod`)

Single table, no TTL — all history retained forever (~50 MB/year).

| PK | SK | Key fields |
|----|----|------------|
| `INTERVAL#<NMI>` | `<intervalEnd UTC ISO>` | `costsAllVarRate`, `earningsAllVarRate`, `importsAll`, `exportsAll`, `costsAll`, `earningsAll`, `quality` |

Queries use `query_pk_between(pk, sk_start, sk_end)` with ISO string comparison on the SK — this works because ISO 8601 sorts lexicographically.

### Shared Lambda layer (`backend/lambda/shared/`)

All three Lambda functions receive this layer at `/opt/python`. The `sys.path.insert(0, "/opt/python")` line at the top of each handler is required.

- `db.py` — DynamoDB helpers; `query_pk_between` paginates automatically
- `response.py` — CORS-safe HTTP responses (`ok`, `server_error`, `preflight`)
- `localvolts.py` — Localvolts API client; reads credentials from SSM at cold start

### SSM parameters (set manually, never in code)

| Name | Type | Purpose |
|------|------|---------|
| `/energy-mate/lv-api-key` | SecureString | Localvolts API key |
| `/energy-mate/lv-partner-id` | SecureString | Localvolts partner ID |
| `/energy-mate/nmi` | String | National Meter Identifier |

Lambda functions fall back to `os.environ` (`LV_API_KEY`, `LV_PARTNER_ID`, `NMI`) for local testing.

### Localvolts API constraints

- Max 24 hours of data per call — the pipeline makes two calls per run (past 24hrs + next 24hrs)
- Historical data goes up to 72 hours in the past
- `quality` field: `Act` (settled), `Exp` (expected, has some actuals), `Fcst` (all forecast)
- `costsAllVarRate` / `earningsAllVarRate` return the string `"N/A"` when there are no imports/exports — handle this explicitly

### Frontend data split

`Dashboard.jsx` makes two parallel fetches on mount and on every Refresh:
- `/dashboard/live` → populates the five stat cards (import rate, FiT, imported Wh, exported Wh, net cost)
- `/dashboard/history` → populates `PriceChart` (grouped bar: import rate + FiT), `UsageChart` (stacked bar: imports + exports), and `BillingSummary` (today's spend/earn/net in dollars)

All times are stored in UTC in DynamoDB and converted to AEST (UTC+10, hardcoded offset — no DST in NEM) for display.

### Deployed resources

- Stack: `energy-mate-prod` (ap-southeast-2)
- API: `https://iuu5v3eh3j.execute-api.ap-southeast-2.amazonaws.com`
- Frontend: `s3://cognifylabs.ai/energy-mate/web/`
- Table: `em_energy_mate_prod`

