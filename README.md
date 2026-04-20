# CognifyLabs Platform

An AI-powered financial advisory ecosystem built on AWS serverless infrastructure. The platform combines portfolio analytics, mortgage rate intelligence, and AI-generated insights into a suite of tools for property investment advisors and financial professionals.

---

## Platform Overview

The CognifyLabs platform is a multi-app ecosystem with the **BA Portal** as its primary product — a sophisticated financial analytics dashboard for Buyer Agents (property investment advisors). Supporting apps include RateScan (mortgage rate comparison), an HSC educational quiz agent, a photo gallery, and an email delivery service.

---

## Apps

### BA Portal — Buyer Agent Dashboard

The core product. A full-stack financial analytics platform that gives Buyer Agents a complete picture of client portfolio health, 30-year projections, and AI-driven recommendations.

#### Portfolio Management
- Multi-investor portfolio support with isolated access control
- Property asset tracking: loan balance, interest rate, rental income, expenses, LVR
- Investor income management with configurable growth rates
- Dependent and household expense tracking
- Multiple portfolios per advisor (portfolio selector screen)

#### Financial Analytics Engine (SuperChart1)
- 30-year configurable financial forecast (1–30 year slider)
- DTI (Debt-to-Income) ratio calculation
- Borrowing capacity analysis
- Equity accumulation projections
- LVR (Loan-to-Value Ratio) tracking per property
- Household surplus calculations
- Australian tax brackets + Medicare levy calculations
- CPI-adjusted income and expense projections
- Automatic recalculation on every data save

#### AI-Powered Intelligence (AWS Bedrock / Claude)
- **Add Property** — AI generates optimised property acquisition recommendations based on current portfolio state, goals, and risk tolerance
- **Summary** — Generates an executive narrative summary of the entire portfolio
- **Advice** — Produces 3 tailored investment recommendations aligned to the client's goals
- **Optimize** — Market benchmark analysis framework (in development)

#### Visualisations
- Interactive 30-year multi-line financial projection chart (Recharts)
- LVR risk zone chart with visual risk bands (ECharts)
- Summary metric cards: DTI, total equity, household surplus, borrowing capacity
- Real-time chart updates as form data changes

#### Investment Configuration
- Goal type and risk tolerance settings
- Configurable financial parameters: CPI rate, Medicare levy, borrowing multiple
- Investment timeline slider (1–30 years)
- Dark/light mode toggle

#### Authentication
- Passwordless email-based login with 6-digit verification codes (5-minute validity)
- AWS Cognito OAuth 2.0 Authorization Code Flow
- JWT token-based session management
- All API endpoints protected by Cognito authorizer

#### Backend Architecture
- 4 Lambda functions (Python 3.13): `read_table`, `update_table`, `insert_table`, `ba_agent`
- DynamoDB for portfolio, investor, and property data storage
- API Gateway (Cognito-authenticated REST API)
- AWS Bedrock for AI inference
- CloudWatch structured audit logging for all auth and data access events

---

### HSC Agent — Educational Quiz

Vocabulary and comprehension quiz tool built for HSC students studying George Orwell's *1984*.

- Multi-stage quiz progression
- Progress tracking and stage advancement
- Real-time scoring with instant feedback

---

### Photo Gallery

S3-backed media viewer for organised photo and video albums.

- Album-based organisation
- Lightbox viewer
- Presigned URL security for private S3 content

---

### Send Email Service

Email delivery service via Amazon SES.

- HTML and plain text template support
- Attachment support (PDF, DOCX)
- Retirement SOA and Insurance SOI form processing
- Google Sheets integration for lead and document tracking

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.2.4 | Build tool |
| Tailwind CSS | 4.1 | Styling |
| Recharts | 3.6.0 | Financial projection charts |
| ECharts | 6.0.0 | LVR risk zone chart |
| AWS Amplify | 6.19.x | Cognito integration |
| Axios | 1.13.x | HTTP client with auto Bearer token injection |
| Lucide React | 0.562.0 | Icons |

### Backend (AWS Serverless)
| Service | Purpose |
|---|---|
| Lambda (Python 3.13) | Compute: calculations, AI calls, CRUD operations |
| DynamoDB | Portfolio, investor, property, chart data |
| API Gateway | REST endpoints with Cognito authorisation |
| Cognito | User auth, OAuth 2.0, JWT tokens |
| Bedrock (Claude) | AI recommendations, summaries, advice |
| SES | Transactional email delivery |
| S3 | Static assets, rate data warehouse |
| CloudWatch | Structured audit logging and monitoring |

### External Integrations
- **AWS Bedrock / Claude** — AI inference for BA Portal
- **Google Sheets API** — Leads and SOA document tracking
- **Amazon SES** — Outbound email

---

## Project Structure

```
tutorai/
├── app/
│   ├── ba-portal/                    # Primary product
│   │   ├── dashboard-frontend/       # React + TypeScript + Vite app
│   │   │   └── src/
│   │   │       ├── components/       # Dashboard, Sidebar, Charts, Forms
│   │   │       ├── services/         # dashboardService, authService, apiClient
│   │   │       ├── contexts/         # AuthContext
│   │   │       └── config/           # Cognito config
│   │   ├── lambda/
│   │   │   ├── ba_agent/             # AI actions (Bedrock)
│   │   │   ├── update_table/         # Data update + Chart1 recalculation
│   │   │   │   └── libs/superchart1.py  # 30-year financial engine
│   │   │   ├── read_table/           # DynamoDB reads
│   │   │   └── insert_table/         # Portfolio creation
│   │   └── IaC/
│   │       └── api-config.json       # API Gateway definition
│   ├── hsc_agent/                    # Educational quiz app
│   ├── photo-gallery/                # S3 media viewer
│   └── send-email/                   # SES email service
├── app.py                            # Root Flask utility app
├── config.py                         # Shared configuration
├── mylib.py                          # Shared utilities (email, sheets, AI)
└── requirements.txt                  # Python dependencies
```

---

## BA Portal API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/read-table` | POST | Fetch portfolio, investors, properties, chart data |
| `/update-table` | POST | Save data and trigger Chart1 recalculation |
| `/insert-table` | POST | Create a new portfolio |
| `/ba-agent` | POST | Execute AI actions (add / summary / advice / optimize) |

All endpoints require a valid Cognito JWT in the `Authorization: Bearer` header.

---

## Development

### Frontend
```bash
cd app/ba-portal/dashboard-frontend
npm install
npm run dev        # Development server
npm run build      # Production build
```

### Lambda (unit tests)
```bash
cd app/ba-portal/lambda/update_table
python test_update_table.py

cd app/ba-portal/lambda/ba_agent
python test_ba_agent_api.py
```

### Deployment
```bash
# Deploy API Gateway
cd app/ba-portal/IaC && python deploy_api.py

# Deploy individual Lambda
cd app/ba-portal/lambda/<function> && python deploy_lambda.py

```

---

## Environment Variables

**BA Portal Frontend (`.env`)**
```
VITE_API_URL=<API Gateway URL>
VITE_COGNITO_CLIENT_ID=<Cognito app client ID>
VITE_COGNITO_DOMAIN=<Cognito domain>
VITE_AWS_REGION=ap-southeast-2
```

---

## Architecture Decisions

- **Serverless-first:** All compute runs in Lambda — scales to zero, no idle cost
- **Strict service layer:** Frontend components never call fetch directly; all requests go through `dashboardService.ts` → `apiClient.ts`
- **Calculation on save:** Chart1 recalculates automatically on every `update_table` call, keeping stored projections always fresh
- **Multi-tenant design:** Portfolio ID is the primary access boundary; each advisor can manage multiple client portfolios
