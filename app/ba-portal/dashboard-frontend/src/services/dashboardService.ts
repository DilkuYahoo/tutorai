/* eslint-disable @typescript-eslint/no-explicit-any */

const FINANCE_URL = import.meta.env.VITE_REACT_APP_FINANCE_URL || "";
const App_SYNC_REGION = import.meta.env.VITE_REACT_APP_APPSYNC_REGION || "";
const REACT_APP_APPSYNC_FINANCE_ID =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_ID || "";
const REACT_APP_APPSYNC_FINANCE_TABLE_NAME =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_TABLE_NAME || "";

export interface ConfigParams {
  medicareLevyRate: number;
  cpiRate: number;
  accessibleEquityRate: number;
  borrowingPowerMultiplierMin: number;
  borrowingPowerMultiplierBase: number;
  borrowingPowerMultiplierDependantReduction: number;
}

export interface DashboardApiResponse {
  chartData: any[];
  investors: any[];
  properties: any[];
  investmentYears?: number;
}

export interface ConfigApiResponse {
  configParams: ConfigParams;
  investmentYears: number;
}

export async function fetchDashboardData(): Promise<DashboardApiResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table`, {
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
  };
}

export async function updateDashboardData(
  investors: any[],
  properties: any[],
  chart1?: any[],
  investmentYears?: number,
): Promise<void> {
  const attributes: any = { investors, properties };

  // Include chart1 if provided
  if (chart1) {
    attributes.chart1 = chart1;
  }

  // Include investment_years if provided
  if (investmentYears !== undefined && investmentYears !== null) {
    attributes.investment_years = investmentYears;
  }

  const response = await fetch(`${FINANCE_URL}/update-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: REACT_APP_APPSYNC_FINANCE_ID,
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

export async function fetchConfigParams(): Promise<ConfigApiResponse> {
  const response = await fetch(`${FINANCE_URL}/read-table`, {
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
  };
}

export async function saveConfigParams(
  configParams: ConfigParams,
  investmentYears?: number
): Promise<void> {
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

  console.log("Saving config params:", { configParams, investmentYears, attributes });

  const response = await fetch(`${FINANCE_URL}/update-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_name: REACT_APP_APPSYNC_FINANCE_TABLE_NAME,
      id: REACT_APP_APPSYNC_FINANCE_ID,
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
