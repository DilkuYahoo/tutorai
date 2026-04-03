# WealthPulse

A comprehensive React + TypeScript + Vite financial dashboard for wealth management and investment portfolio analysis. This dashboard provides AI-powered insights, interactive charts, and real-time data management for investment portfolios.

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6?style=flat&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF?style=flat&logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?style=flat&logo=tailwind-css)
![ECharts](https://img.shields.io/badge/ECharts-5.4.3-FF6F61?style=flat&logo=apache-echarts)

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Components Overview](#components-overview)
  - [Dashboard](#dashboard)
  - [Header](#header)
  - [Sidebar](#sidebar)
  - [ChartSection](#chartsection)
  - [Footer](#footer)
- [Services](#services)
- [API Integration](#api-integration)
- [Authentication](#authentication)
- [Data Models](#data-models)
- [Running the Application](#running-the-application)
- [Building for Production](#building-for-production)

---

## Features

### Core Functionality

- **Portfolio Management**
  - Multiple portfolio support with easy switching
  - Portfolio selection via dropdown in header
  - Persistent portfolio data in DynamoDB

- **Investor Management**
  - Add/remove investors
  - Configure investor details (name, base income, growth rate, expenditures)
  - Income events tracking (future income changes)
  - Protected default investors (Bob, Alice)

- **Property Management**
  - Add/remove properties
  - Configure property details (purchase year, value, loan, interest rate, rent, growth)
  - Investor ownership splits (percentage-based)
  - AI-powered property suggestions via BA Agent

- **Configuration Settings**
  - Investment years (projection period)
  - Investment goals (Passive Income, Capital Growth, Tax Benefits, etc.)
  - Risk tolerance (Conservative, Moderate, Aggressive)
  - Portfolio dependants tracking
  - Future dependant events (births, children leaving home)
  - Advanced financial parameters (Medicare Levy, CPI, borrowing power multipliers)

### Visualizations

- **Portfolio Growth vs Debt**
  - Total Property Value over time
  - Total Loan Balance tracking
  - Total Equity progression

- **Cashflow Analysis**
  - Combined Income
  - Essential vs Nonessential Expenses
  - Property Cashflow
  - Household Surplus

- **Debt-to-Income (DTI) Analysis**
  - DTI Ratio with safe/caution zones
  - Total Borrowing Capacity

- **Investor Net Income**
  - Individual investor income trends
  - Maximum Purchase Price calculation

### AI-Powered Insights

- **Executive Summary**
  - AI-generated portfolio overview
  - Saved to DynamoDB for persistence

- **Our Advice**
  - Personalized investment recommendations
  - Actionable next steps

### User Experience

- Dark/Light mode toggle
- Responsive sidebar with collapsible sections
- Real-time data validation
- Optimistic UI updates
- Error handling with auto-dismiss notifications
- Loading states with spinners

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Dashboard │  │  Header  │  │ Sidebar  │  │ChartSection │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│       │             │             │               │          │
│       └─────────────┴─────────────┴───────────────┘          │
│                             │                                   │
│                    ┌────────┴────────┐                         │
│                    │  AuthContext   │                         │
│                    │ DashboardService│                         │
│                    └────────┬────────┘                         │
└─────────────────────────────┼─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway                                  │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │  /portfolios     │  │  /generate-*     │                   │
│  └────────┬─────────┘  └────────┬─────────┘                   │
└───────────┼──────────────────────┼─────────────────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  read_table Lambda      │  │  ba_agent Lambda        │
│  (Fetch portfolio data) │  │  (AI generation)        │
└───────────┬─────────────┘  └───────────┬─────────────┘
            │                             │
            ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DynamoDB                                    │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Portfolio Items  │  │ Config Params     │                   │
│  └──────────────────┘  └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | React 18.2.0 |
| Language | TypeScript 5.3.3 |
| Build Tool | Vite 5.4.2 |
| Styling | Tailwind CSS 3.4.1 |
| Charts | ECharts 5.4.3 + echarts-for-react |
| Icons | Lucide React |
| Authentication | AWS Cognito (viaamazon-cognito-identity-js) |
| API Client | Native fetch API |
| State Management | React Context + useState/useEffect |

---

## Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS Account with:
  - API Gateway configured
  - Lambda functions deployed
  - DynamoDB tables created
  - Cognito User Pool configured

---

## Installation

```bash
# Navigate to the frontend directory
cd app/ba-portal/dashboard-frontend

# Install dependencies
npm install
```

---

## Configuration

### Environment Variables

Create a `.env` file in the dashboard-frontend directory:

```env
# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/callback
VITE_COGNITO_SIGNOUT_URI=http://localhost:5173

# API Gateway Configuration
VITE_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod

# Default Portfolio ID
VITE_REACT_APP_APPSYNC_FINANCE_ID=your-default-portfolio-id
```

### AWS Cognito Setup

1. Create a User Pool in AWS Cognito
2. Note the User Pool ID and Client App ID
3. Configure the redirect URI for OAuth
4. Add the domain to your allowed callback URLs

---

## Project Structure

```
dashboard-frontend/
├── public/
│   └── vite.svg              # Logo assets
├── src/
│   ├── components/
│   │   ├── ChartSection.tsx  # Main charts and visualizations
│   │   ├── Dashboard.tsx     # Main dashboard container
│   │   ├── Footer.tsx       # Footer component
│   │   ├── Header.tsx       # Top navigation bar
│   │   └── Sidebar.tsx       # Left sidebar with data management
│   ├── configs/
│   │   └── cognitoConfig.ts # Cognito authentication config
│   ├── contexts/
│   │   └── AuthContext.tsx   # Authentication context provider
│   ├── hooks/
│   │   └── useFinancialData.ts # Custom hooks for data
│   ├── pages/
│   │   ├── Analytics.tsx    # Analytics page
│   │   ├── Reports.tsx      # Reports page
│   │   ├── Settings.tsx     # Settings page
│   │   └── Users.tsx        # Users management page
│   ├── services/
│   │   ├── authService.ts   # Authentication service
│   │   ├── dashboardService.ts # Dashboard data service
│   │   └── financialApi.ts  # Financial API client
│   ├── App.css
│   ├── App.tsx              # Root component
│   ├── index.css            # Global styles
│   └── main.tsx             # Entry point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Components Overview

### Dashboard

The main container component that orchestrates all other components.

**Responsibilities:**
- Authentication state management
- Portfolio selection and loading
- Data fetching and caching
- Update handling with optimistic UI
- Error and success notifications
- Theme (dark/light mode) management

**Key State:**
```typescript
interface DashboardData {
  chartData: any[];           // Year-by-year financial projections
  investors: Investor[];      // Investor information
  properties: Property[];     // Property investments
  investmentYears: number;   // Projection period (default: 30)
  executiveSummary: string; // AI-generated summary
  ourAdvice: string;         // AI-generated advice
  loading: boolean;
  error: string | null;
}
```

### Header

Top navigation bar with brand identity, portfolio selector, and user menu.

**Features:**
- Company logo and branding (AdviceGenie)
- Portfolio dropdown selector
- User authentication status display
- Login/logout functionality
- Dark/light mode toggle
- Responsive design

### Sidebar

Collapsible sidebar with three main sections for data management.

#### Investors Section
- List all investors with expandable details
- Edit investor fields inline:
  - Name (with protection for default investors)
  - Base Income
  - Annual Growth Rate
  - Essential Expenditure
  - Nonessential Expenditure
- Manage income events (future income changes)
- Add/delete investors

#### Properties Section
- List all properties with current values
- Edit property fields:
  - Name
  - Purchase Year
  - Initial Value
  - Loan Amount
  - Interest Rate
  - Annual Rent
  - Growth Rate
  - Other Expenses
  - Annual Principal Change
- Manage investor ownership splits
- Add new properties (with BA Agent assistance)
- Delete properties

#### Configuration Section
- **Investment Profile:**
  - Years to Invest (1-50)
  - Investment Goal selection
  - Risk Tolerance (Conservative/Moderate/Aggressive)
  - Portfolio Dependants count

- **Dependant Events:**
  - Add future dependant changes (year + count)
  - Remove events

- **Advanced Settings:**
  - Medicare Levy Rate
  - CPI Rate
  - Accessible Equity Rate
  - Borrowing Power Multipliers (Min, Base, Dependant Reduction)

### ChartSection

Main content area displaying visualizations and AI insights.

**Sections:**
1. **Key Metrics Cards**
   - Total Equity
   - Property Cash Flow
   - Household Surplus

2. **Executive Summary**
   - AI-generated portfolio overview
   - Markdown rendering
   - Collapsible panel

3. **Our Advice**
   - AI-generated recommendations
   - Markdown rendering
   - Collapsible panel

4. **Portfolio Growth vs Debt Chart**
   - Line chart with area style
   - Property value, loan balance, equity tracking

5. **Cashflow Chart**
   - Stacked bar chart
   - Income, expenses, cashflow components

6. **DTI Ratio & Borrowing Capacity Chart**
   - Dual-axis chart
   - DTI ratio with threshold lines
   - Borrowing capacity tracking

7. **Investor Net Income Chart**
   - Multiple line series
   - Per-investor income tracking
   - Max purchase price overlay

### Footer

Simple footer component with copyright and version information.

---

## Services

### authService.ts

Authentication service handling Cognito OAuth flow.

**Functions:**
```typescript
// Initialize Cognito auth
initializeAuth(): Promise<void>

// Login redirect
login(): void

// Handle OAuth callback
handleAuthCallback(code: string): Promise<UserData>

// Logout
logout(): void

// Get current session
getSession(): Promise<CognitoUserSession>

// Check if authenticated
isAuthenticated(): Promise<boolean>
```

### dashboardService.ts

Main service for dashboard data operations.

**Functions:**
```typescript
// Fetch dashboard data by portfolio ID
fetchDashboardDataById(portfolioId: string): Promise<DashboardData>

// Fetch list of portfolios
fetchPortfolioList(): Promise<{portfolios: PortfolioInfo[]}>

// Fetch configuration parameters
fetchConfigParams(portfolioId: string): Promise<ConfigData>

// Save configuration parameters
saveConfigParams(params: ConfigParams, ...): Promise<void>

// Update dashboard data
updateDashboardData(investors, properties, investmentYears, ...): Promise<void>

// Generate AI portfolio summary
generatePortfolioSummary(portfolioId: string): Promise<{summary: string}>

// Generate AI advice
generateOurAdvice(portfolioId: string): Promise<{advice: string}>

// Add property with BA Agent
addPropertyWithBaAgent(portfolioId: string): Promise<Property>
```

### financialApi.ts

Low-level API client for financial data.

---

## API Integration

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/portfolios` | GET | List all portfolios |
| `/portfolios/{id}` | GET | Fetch portfolio data |
| `/portfolios/{id}/config` | GET | Fetch config params |
| `/portfolios/{id}/config` | POST | Save config params |
| `/update` | POST | Update portfolio data |
| `/generate-summary` | POST | Generate AI summary |
| `/generate-advice` | POST | Generate AI advice |
| `/add-property` | POST | Add property with BA Agent |

### Data Flow

1. User authenticates via Cognito
2. Dashboard loads portfolio list
3. User selects portfolio
4. Data fetched from DynamoDB via Lambda
5. Charts render with data
6. User modifies data in Sidebar
7. Refresh button sends update to Lambda
8. Lambda recalculates projections
9. Dashboard refreshes with new data

---

## Authentication

The application uses AWS Cognito for authentication with OAuth 2.0 flow:

1. **Login:** User clicks login → Redirected to Cognito hosted UI
2. **Callback:** Cognito redirects with authorization code
3. **Exchange:** Frontend exchanges code for tokens
4. **Session:** Tokens stored, user session established
5. **Logout:** Tokens cleared, user logged out

### Auth Context

Provides authentication state throughout the app:
```typescript
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
  handleAuthCallback: (code: string) => Promise<void>;
}
```

---

## Data Models

### Investor

```typescript
interface Investor {
  name: string;
  base_income: number;
  annual_growth_rate: number;
  essential_expenditure: number;
  nonessential_expenditure: number;
  income_events?: IncomeEvent[];
}
```

### IncomeEvent

```typescript
interface IncomeEvent {
  year: number;
  amount: number;
  type: 'increase' | 'set';
}
```

### Property

```typescript
interface Property {
  name: string;
  property_value: number;
  purchase_year: number;
  initial_value: number;
  loan_amount: number;
  interest_rate: number;
  rent: number;
  growth_rate: number;
  other_expenses: number;
  annual_principal_change: number;
  investor_splits?: InvestorSplit[];
}
```

### InvestorSplit

```typescript
interface InvestorSplit {
  name: string;
  percentage: number;
}
```

### ConfigParams

```typescript
interface ConfigParams {
  medicareLevyRate: number;
  cpiRate: number;
  accessibleEquityRate: number;
  borrowingPowerMultiplierMin: number;
  borrowingPowerMultiplierBase: number;
  borrowingPowerMultiplierDependantReduction: number;
}
```

### PortfolioDependantsEvents

```typescript
interface PortfolioDependantsEvents {
  year: number;
  dependants: number;
}
```

---

## Running the Development Server

```bash
# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`

---

## Building for Production

```bash
# Build the application
npm run build
```

Build output will be in the `dist` directory. Deploy to any static hosting service (AWS S3 + CloudFront, Vercel, Netlify, etc.).

---

## License

MIT License - See LICENSE file for details.

---

## Support

For issues and feature requests, please open an issue on the project repository.
