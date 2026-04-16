# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

BA Portal is a financial analytics platform for property investment advisors (Buyer Agents). It manages client portfolios, calculates borrowing capacity, visualises 30-year financial projections, and generates AI-powered insights via AWS Bedrock.

---

## Development Rules

After **every code change** to the frontend, run the build to validate there are no TypeScript or compile errors before considering the task done:

```bash
cd app/ba-portal/dashboard-frontend && npm run build
```

Do not report a task as complete if the build fails.

---

## Commands

### Frontend (`dashboard-frontend/`)

```bash
npm run dev        # Start dev server on port 3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend Lambda (Python — run from each function directory)

```bash
cd lambda/update_table && python test_update_table.py   # Chart1 calculations
cd lambda/ba_agent && python test_ba_agent_api.py       # AI features
cd lambda/read_table && python test_fix.py              # Data reading
```

### Deployment

```bash
cd IaC && python deploy_api.py                          # Deploy API Gateway
cd lambda/<function> && python deploy_lambda.py         # Deploy a Lambda function
```

---

## Architecture

### Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite, Tailwind CSS 4 (class-based dark mode), Recharts (main charts), ECharts (LVR chart)
- **Backend**: AWS Lambda (Python 3.13) + DynamoDB + Cognito (OAuth 2.0) + Bedrock (Claude)
- **Auth**: AWS Amplify + Cognito Authorization Code Flow; tokens stored in `sessionStorage`

### Frontend Service Layers (`dashboard-frontend/src/services/`)

All backend communication is strictly layered — components never call `fetch()` directly:

| Service | Responsibility |
|---|---|
| `authService.ts` | Cognito OAuth, token storage/expiry, logout |
| `apiClient.ts` | `fetch()` wrapper; auto-injects Bearer token, handles token expiry by calling logout callback |
| `dashboardService.ts` | All business logic calls: read/update portfolio, config params, AI actions |

`AuthContext` (`contexts/AuthContext.tsx`) is the React state provider for auth; `useApiClientInitialize` hook wires the logout callback into `apiClient` on mount.

### Key Data Flows

1. **Portfolio load**: `dashboardService.fetchDashboardData(portfolioId)` → `read_table` Lambda → DynamoDB
2. **Data update**: `dashboardService.updateDashboardData()` → `update_table` Lambda → DynamoDB + **auto-triggers Chart1 recalculation** via `superchart1.py` (30-year projections with CPI)
3. **AI actions**: All four AI features (add property / optimise / summarise / get advice) hit the same `/ba-agent` endpoint, differentiated by `property_action` field → `ba_agent` Lambda → Bedrock (Claude)

### Backend Lambdas (`lambda/`)

| Directory | Purpose |
|---|---|
| `update_table/` | DynamoDB updates; calls `libs/superchart1.py` for 30-year financial projection calculations |
| `read_table/` | Fetches portfolio data |
| `insert_table/` | Creates new portfolios |
| `ba_agent/` | AI features via Bedrock; `lib/bedrock_client.py` is the Bedrock abstraction |
| `update_chart/` | Chart-specific updates |

`superchart1.py` is the core financial engine — it handles multi-year forecasting, CPI adjustments, DTI ratios, borrowing capacity, and equity calculations.

### Environment Variables (frontend)

```
VITE_COGNITO_CLIENT_ID
VITE_COGNITO_DOMAIN
VITE_COGNITO_REDIRECT_URI
VITE_COGNITO_USER_POOL_ID
VITE_AWS_REGION
VITE_API_URL                              # API Gateway base URL
VITE_REACT_APP_APPSYNC_FINANCE_TABLE_NAME # DynamoDB table
VITE_REACT_APP_APPSYNC_FINANCE_ID         # Default portfolio ID
```

### Infrastructure (`IaC/`)

`api-config.json` defines all REST endpoint mappings. `deploy_api.py` provisions API Gateway from this config.
