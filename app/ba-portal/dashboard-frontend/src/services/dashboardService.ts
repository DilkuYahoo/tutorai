/* eslint-disable @typescript-eslint/no-explicit-any */

import authService from './authService';
import { apiPost } from './apiClient';

const FINANCE_URL = import.meta.env.VITE_REACT_APP_FINANCE_URL || "";
const App_SYNC_REGION = import.meta.env.VITE_REACT_APP_APPSYNC_REGION || "";
const REACT_APP_APPSYNC_FINANCE_ID =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_ID || "";
const REACT_APP_APPSYNC_FINANCE_TABLE_NAME =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_TABLE_NAME || "";
const REACT_APP_ADVISER_NAME = import.meta.env.VITE_REACT_APP_ADVISER_NAME || "John Smith";

export interface ConfigParams {
  medicareLevyRate: number;
  cpiRate: number;
  accessibleEquityRate: number;
  borrowingPowerMultiplierMin: number;
  borrowingPowerMultiplierBase: number;
  borrowingPowerMultiplierDependantReduction: number;
}

export interface PortfolioDependantsEvents {
  year: number;
  dependants: number;
}

export interface DashboardApiResponse {
  chartData: any[];
  investors: any[];
  properties: any[];
  investmentYears?: number;
  executiveSummary?: string;
  ourAdvice?: string;
}

export interface PortfolioInfo {
  id: string;
  name: string;
  last_updated?: string;
  updates?: number;
  investors?: Array<{ name: string }>;
}

export interface PortfolioListResponse {
  portfolios: PortfolioInfo[];
}

export interface ConfigApiResponse {
  configParams: ConfigParams;
  investmentYears: number;
  investmentGoals?: InvestmentGoals;
  portfolioDependants?: number;
  portfolioDependantsEvents?: PortfolioDependantsEvents[];
}

export interface InvestmentGoals {
  goal: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}



export async function fetchPortfolioList(adviserName?: string): Promise<PortfolioListResponse> {
  const adviser = adviserName || REACT_APP_ADVISER_NAME;
  
  const result = await apiPost(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    action: 'list_portfolios',
    adviser_name: adviser,
    region: App_SYNC_REGION,
  });

  return {
    portfolios: result.portfolios || [],
  };
}

export async function fetchDashboardDataById(portfolioId: string): Promise<DashboardApiResponse> {
  const result = await apiPost(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: portfolioId,
    region: App_SYNC_REGION,
  });

  return {
    chartData: result.result.chart1 || [],
    investors: result.result.investors || [],
    properties: result.result.properties || [],
    investmentYears: result.result.investment_years || 30,
    executiveSummary: result.result.executive_summary || '',
    ourAdvice: result.result.our_advice || '',
  };
}

export async function updateDashboardData(
  investors?: any[],
  properties?: any[],
  investmentYears?: number,
  executiveSummary?: string,
  ourAdvice?: string,
  portfolioId?: string,
): Promise<void> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const attributes: any = {};

  // Only include investors if it's a non-empty array
  if (investors !== undefined && investors !== null && Array.isArray(investors) && investors.length > 0) {
    attributes.investors = investors;
  }

  // Only include properties if it's a non-empty array
  if (properties !== undefined && properties !== null && Array.isArray(properties) && properties.length > 0) {
    attributes.properties = properties;
  }

  // Note: chart1 is NOT sent to backend - it's calculated by the Lambda
  // The Lambda recalculates chart1 whenever investors and properties are provided

  // Include investment_years if provided
  if (investmentYears !== undefined && investmentYears !== null) {
    attributes.investment_years = investmentYears;
  }

  // Include executive_summary if provided
  if (executiveSummary !== undefined && executiveSummary !== null) {
    attributes.executive_summary = executiveSummary;
  }

  // Include our_advice if provided
  if (ourAdvice !== undefined && ourAdvice !== null) {
    attributes.our_advice = ourAdvice;
  }

  await apiPost(`${FINANCE_URL}/update-table?t=${Date.now()}`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    attributes,
  });
}

export async function fetchConfigParams(portfolioId?: string): Promise<ConfigApiResponse> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const result = await apiPost(`${FINANCE_URL}/read-table`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    region: App_SYNC_REGION,
  });

  const data = result.result || {};

  return {
    configParams: {
      medicareLevyRate: data.medicare_levy_rate ?? 0.02,
      cpiRate: data.cpi_rate ?? 0.03,
      accessibleEquityRate: data.accessible_equity_rate ?? 0.80,
      borrowingPowerMultiplierMin: data.borrowing_power_multiplier_min ?? 3.5,
      borrowingPowerMultiplierBase: data.borrowing_power_multiplier_base ?? 5.0,
      borrowingPowerMultiplierDependantReduction: data.borrowing_power_multiplier_dependant_reduction ?? 0.25,
    },
    investmentYears: data.investment_years ?? 30,
    investmentGoals: data.investment_goals ? {
      goal: data.investment_goals.goal || '',
      riskTolerance: data.investment_goals.risk_tolerance || 'moderate',
    } : undefined,
    portfolioDependants: data.portfolio_dependants ?? 0,
    portfolioDependantsEvents: data.portfolio_dependants_events || [],
  };
}

export async function saveConfigParams(
  configParams: ConfigParams,
  investmentYears?: number,
  investmentGoals?: InvestmentGoals,
  portfolioDependants?: number,
  portfolioDependantsEvents?: PortfolioDependantsEvents[],
  portfolioId?: string
): Promise<void> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const attributes: any = {
    medicare_levy_rate: configParams.medicareLevyRate,
    cpi_rate: configParams.cpiRate,
    accessible_equity_rate: configParams.accessibleEquityRate,
    borrowing_power_multiplier_min: configParams.borrowingPowerMultiplierMin,
    borrowing_power_multiplier_base: configParams.borrowingPowerMultiplierBase,
    borrowing_power_multiplier_dependant_reduction: configParams.borrowingPowerMultiplierDependantReduction,
  };

  // Include investment_years if provided
  if (investmentYears !== undefined && investmentYears !== null) {
    attributes.investment_years = investmentYears;
  }

  // Include investment_goals if provided
  if (investmentGoals) {
    attributes.investment_goals = {
      goal: investmentGoals.goal,
      risk_tolerance: investmentGoals.riskTolerance,
    };
  }

  // Include portfolio_dependants if provided
  if (portfolioDependants !== undefined && portfolioDependants !== null) {
    attributes.portfolio_dependants = portfolioDependants;
  }

  // Include portfolio_dependants_events if provided
  if (portfolioDependantsEvents !== undefined && portfolioDependantsEvents !== null) {
    attributes.portfolio_dependants_events = portfolioDependantsEvents;
  }

  await apiPost(`${FINANCE_URL}/update-table`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    attributes,
  });
}

const DEFAULT_INVESTORS = [
  {
    name: "Bob",
    base_income: 120000,
    annual_growth_rate: 3,
    essential_expenditure: 50000,
    nonessential_expenditure: 3000,
    income_events: []
  },
  {
    name: "Alice",
    base_income: 100000,
    annual_growth_rate: 2.5,
    essential_expenditure: 50000,
    nonessential_expenditure: 3000,
    income_events: []
  }
];

const DEFAULT_PROPERTY = {
  name: "Property 1",
  purchase_year: 1,
  initial_value: 600000,
  property_value: 660000,
  loan_amount: 600000,
  interest_rate: 5,
  rent: 30000,
  growth_rate: 3,
  other_expenses: 5000,
  annual_principal_change: 0,
  investor_splits: [
    { name: "Bob", percentage: 50 },
    { name: "Alice", percentage: 50 }
  ]
};

export async function createPortfolio(name: string): Promise<string> {
  const portfolioId = crypto.randomUUID();
  const userEmail = authService.getUserFromToken()?.email || REACT_APP_ADVISER_NAME;

  await apiPost(`${FINANCE_URL}/insert-table`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    region: App_SYNC_REGION,
    item: {
      id: portfolioId,
      name,
      status: "active",
      adviser_name: userEmail,
      investors: DEFAULT_INVESTORS,
      properties: [DEFAULT_PROPERTY],
    }
  });
  return portfolioId;
}

export async function renamePortfolio(portfolioId: string, newName: string): Promise<void> {
  await apiPost(`${FINANCE_URL}/update-table`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: portfolioId,
    region: App_SYNC_REGION,
    attributes: { name: newName }
  });
}

export interface BaAgentProperty {
  name: string;
  purchase_year: number;
  loan_amount: number;
  annual_principal_change: number;
  rent: number;
  interest_rate: number;
  other_expenses: number;
  property_value: number;
  initial_value: number;
  growth_rate: number;
  investor_splits: Array<{ name: string; percentage: number }>;
}

export interface BaAgentResponse {
  status: string;
  action: string;
  property: BaAgentProperty;
}



export async function addPropertyWithBaAgent(portfolioId?: string): Promise<BaAgentProperty> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const result: BaAgentResponse = await apiPost(`${FINANCE_URL}/ba-agent`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    property_action: "add",
  });

  return result.property;
}



export async function generatePortfolioSummary(portfolioId?: string): Promise<{ summary: string }> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const result = await apiPost(`${FINANCE_URL}/ba-agent`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    property_action: "summary",
  });

  return result;
}

export async function generateOurAdvice(portfolioId?: string): Promise<{ advice: string; cached?: boolean }> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const result = await apiPost(`${FINANCE_URL}/ba-agent`, {
    table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
    id: id,
    property_action: "advice",
  });

  return result;
}
