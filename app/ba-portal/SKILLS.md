# BA Portal — Skills & Capabilities

A reference guide covering the technical skills, domain knowledge, and architectural patterns required to work effectively on this project.

---

## Domain Knowledge

### Australian Property Investment Advisory
- Australian tax brackets (0%, 16%, 30%, 37%, 45%) and Medicare levy (2%)
- Loan-to-Value Ratio (LVR) analysis and risk thresholds
- Debt-to-Income (DTI) ratio calculations and safe/caution zone interpretation
- Borrowing power modeling with configurable multipliers
- Accessible equity calculations for refinancing decisions
- CPI inflation modeling for long-term financial projections (up to 50 years)
- Rental income vs property expense cash flow analysis
- Multi-investor property ownership with percentage-based splits

### Wealth Planning Concepts
- Portfolio equity tracking across multiple properties over time
- Dependant event modeling (births, children leaving home) and their financial impact
- Income event projections (future income changes by year)
- Risk profiling (Conservative / Moderate / Aggressive)
- Investment goal alignment in advisory outputs

---

## Frontend Skills

### Languages & Frameworks
- **TypeScript 5.x** — strict typing, interface design, generic patterns
- **React 19** — functional components, hooks, context API
- **Vite 7** — dev server, build configuration, HMR

### Styling
- **Tailwind CSS 4** — utility-first styling, dark mode via `class` strategy, responsive design
- **PostCSS** — CSS processing pipeline

### Data Visualisation
- **ECharts 6 / echarts-for-react** — complex financial charts (portfolio growth, debt, equity over time)
- **Recharts 3** — supplementary charting (DTI, LVR analysis)
- Configuring dynamic chart data series based on calculated financial projections

### Authentication & AWS Integration
- **AWS Amplify Auth 6 / Amplify UI React 6** — Cognito-backed OAuth 2.0 flows
- JWT token management — automatic injection into API requests, expiry handling, redirect on logout
- Cognito Hosted UI integration with custom redirect URIs

### HTTP & API Communication
- **Axios 1** — HTTP client with token injection interceptors
- REST API consumption with structured request/response types
- Error handling patterns with auto-dismiss notifications and loading states

### State Management & Patterns
- React Context API (`AuthContext`) for global authentication state
- `useState` / `useEffect` for local component state
- Custom hooks (`useFinancialData`, `useApiClientInitialize`) for reusable data logic
- Service layer pattern — `authService`, `dashboardService`, `apiClient` separation
- Optimistic UI updates for responsive user experience

### Markdown
- Custom markdown parser in `ChartSection` for rendering AI-generated advisory text

### Code Quality
- **ESLint 9** with `@typescript-eslint`, `eslint-plugin-react-hooks`, React Refresh plugin
- Strict TypeScript compiler configuration (`tsconfig.json`)

---

## Backend Skills

### Language & Runtime
- **Python 3.9+** — AWS Lambda handler functions
- Serverless function design — stateless, event-driven handlers

### AWS Services
| Service | Usage |
|---|---|
| **Lambda** | `read-table`, `update-table`, `insert-table`, `ba-agent` functions |
| **API Gateway** | REST endpoints with Cognito JWT authorisation |
| **DynamoDB** | Portfolio, investor, property, and Chart1 data storage |
| **Cognito** | User pool management, OAuth 2.0 token issuance |
| **Bedrock (Claude)** | AI portfolio summaries, investment advice, property recommendations |
| **CloudWatch** | Structured audit logging, metrics, and alarms |

### DynamoDB Patterns
- Parameterised queries and transactional writes
- Decimal encoding for DynamoDB numeric type compatibility
- Structured data schemas for portfolios, investors, and properties

### Financial Calculation Engine
- `superchart1.py` — core library computing 30-year financial forecasts
- Chart1 recalculation triggered automatically on every `update-table` call
- Configurable parameters: CPI rate, borrowing multipliers, Medicare levy, investment horizon

### AI Integration (AWS Bedrock)
- `bedrock_client.py` — wrapper for Claude model invocations
- Prompt engineering for: portfolio summaries, investment advice, property recommendations, property optimisation
- Context injection of financial metrics into AI prompts
- Markdown-formatted output for client-ready advisory text

### Security
- Cognito authoriser on all API Gateway routes
- Audit trail logging: user email, timestamp, action, status on every operation
- CORS configured for production domain (`advicegenie.com`) and local dev (`localhost:3000`)

---

## Infrastructure & DevOps Skills

### Infrastructure as Code
- Python-based deployment scripts (`deploy_api.py`, `deploy_lambda.py`, `teardown_api.py`)
- `api-config.json` — declarative API Gateway endpoint definitions with authorisation, CORS, and monitoring config
- Lambda code-only vs full infrastructure deployment modes

### Environment Configuration
- Vite environment variables (`VITE_*`) for frontend runtime config
- Per-environment API endpoints, Cognito domain, and redirect URIs
- AWS region-specific configuration (`ap-southeast-2`)

### Monitoring & Observability
- CloudWatch alarms for auth failures, read errors, and unauthorised access
- Structured JSON logging across all Lambda functions
- Audit trail design for financial compliance

---

## Architecture Patterns

### Frontend
- **Component composition** — `PageLayout` wrapper, collapsible sidebar, chart section separation
- **Service abstraction** — UI components never call AWS directly; all calls go through `dashboardService` → `apiClient`
- **Custom hooks** — encapsulate data fetching and API client initialisation logic
- **Context + local state** — global auth state via Context; UI state stays local to components

### Backend
- **Serverless microservices** — one Lambda per operation, independently deployable
- **Calculation on write** — Chart1 recalculated server-side on every update, ensuring consistent stored projections
- **Configuration parameters** — financial assumptions centralised in `superchart1.py` module-level config
- **Audit-first design** — every mutation logged with identity, action, and result

### Data Flow
```
Cognito OAuth → JWT Token → API Gateway (authorise) → Lambda → DynamoDB
                                                     ↘ Bedrock (AI actions)
```

---

## Key Files to Know

| Path | Purpose |
|---|---|
| [dashboard-frontend/src/components/Dashboard.tsx](dashboard-frontend/src/components/Dashboard.tsx) | Main orchestrator component |
| [dashboard-frontend/src/components/ChartSection.tsx](dashboard-frontend/src/components/ChartSection.tsx) | Chart visualisations and AI panel rendering |
| [dashboard-frontend/src/components/Sidebar.tsx](dashboard-frontend/src/components/Sidebar.tsx) | Investor, property, and settings forms |
| [dashboard-frontend/src/services/dashboardService.ts](dashboard-frontend/src/services/dashboardService.ts) | High-level API operations |
| [dashboard-frontend/src/services/apiClient.ts](dashboard-frontend/src/services/apiClient.ts) | Axios HTTP client with token injection |
| [dashboard-frontend/src/contexts/AuthContext.tsx](dashboard-frontend/src/contexts/AuthContext.tsx) | Global authentication state |
| [lambda/update_table/libs/superchart1.py](lambda/update_table/libs/superchart1.py) | Core financial calculation engine |
| [lambda/ba_agent/main.py](lambda/ba_agent/main.py) | AI agent — Bedrock-powered advisory actions |
| [lambda/ba_agent/lib/bedrock_client.py](lambda/ba_agent/lib/bedrock_client.py) | Bedrock API wrapper |
| [IaC/api-config.json](IaC/api-config.json) | API Gateway declarative configuration |
| [IaC/deploy_api.py](IaC/deploy_api.py) | API Gateway deployment script |
