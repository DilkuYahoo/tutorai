/* eslint-disable @typescript-eslint/no-explicit-any */

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
}

export interface PortfolioInfo {
  id: string;
  name: string;
  last_updated?: string;
  updates?: number;
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

export async function fetchDashboardData(): Promise<DashboardApiResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: REACT_APP_APPSYNC_FINANCE_ID,
      region: App_SYNC_REGION,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

  return {
    chartData: result.result.chart1 || [],
    investors: result.result.investors || [],
    properties: result.result.properties || [],
    investmentYears: result.result.investment_years || 30,
    executiveSummary: result.result.executive_summary || '',
  };
}

export async function fetchPortfolioList(adviserName?: string): Promise<PortfolioListResponse> {
  const adviser = adviserName || REACT_APP_ADVISER_NAME;
  
  let url = `${FINANCE_URL}/read-table?t=${Date.now()}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      action: 'list_portfolios',
      adviser_name: adviser,
      region: App_SYNC_REGION,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

  return {
    portfolios: result.portfolios || [],
  };
}

export async function fetchDashboardDataById(portfolioId: string): Promise<DashboardApiResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: portfolioId,
      region: App_SYNC_REGION,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

  return {
    chartData: result.result.chart1 || [],
    investors: result.result.investors || [],
    properties: result.result.properties || [],
    investmentYears: result.result.investment_years || 30,
    executiveSummary: result.result.executive_summary || '',
  };
}

export async function updateDashboardData(
  investors?: any[],
  properties?: any[],
  chart1?: any[],
  investmentYears?: number,
  executiveSummary?: string,
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

  // Include chart1 if provided
  if (chart1) {
    attributes.chart1 = chart1;
  }

  // Include investment_years if provided
  if (investmentYears !== undefined && investmentYears !== null) {
    attributes.investment_years = investmentYears;
  }

  // Include executive_summary if provided
  if (executiveSummary !== undefined && executiveSummary !== null) {
    attributes.executive_summary = executiveSummary;
  }

  const response = await fetch(`${FINANCE_URL}/update-table?t=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      attributes,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }
}

export async function fetchConfigParams(portfolioId?: string): Promise<ConfigApiResponse> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/read-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      region: App_SYNC_REGION,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

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

  console.log("Saving config params:", { configParams, investmentYears, investmentGoals, portfolioDependants, portfolioDependantsEvents, attributes });

  const response = await fetch(`${FINANCE_URL}/update-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      attributes,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }
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

export interface AiRecommendationAnalysis {
  bottlenecks: string;
  recommendations: string[];
  optimal_timing: string;
  max_purchase_price: string;
}

export interface AiRecommendationResponse {
  status: string;
  action: string;
  analysis: AiRecommendationAnalysis;
}

export async function addPropertyWithBaAgent(portfolioId?: string): Promise<BaAgentProperty> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/ba-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      property_action: "add",
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result: BaAgentResponse = await response.json();

  if (result.status !== "success") {
    throw new Error(result.property?.name ? "Failed to add property" : "API returned error status");
  }

  return result.property;
}

export async function generateAiRecommendations(portfolioId?: string): Promise<AiRecommendationAnalysis> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/ba-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      property_action: "optimize",
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result: AiRecommendationResponse = await response.json();

  if (result.status !== "success") {
    throw new Error(result.analysis ? "Failed to generate recommendations" : "API returned error status");
  }

  return result.analysis;
}

export async function generatePortfolioSummary(portfolioId?: string): Promise<{ summary: string }> {
  const id = portfolioId || REACT_APP_APPSYNC_FINANCE_ID;
  
  const response = await fetch(`${FINANCE_URL}/ba-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: id,
      property_action: "summary",
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status !== "success") {
    throw new Error(result.message || "API returned error status");
  }

  return result;
}
