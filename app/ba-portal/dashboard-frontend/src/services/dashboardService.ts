/* eslint-disable @typescript-eslint/no-explicit-any */

const FINANCE_URL = import.meta.env.VITE_REACT_APP_FINANCE_URL || "";
const App_SYNC_REGION = import.meta.env.VITE_REACT_APP_APPSYNC_REGION || "";
const REACT_APP_APPSYNC_FINANCE_ID =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_ID || "";
const REACT_APP_APPSYNC_FINANCE_TABLE_NAME =
  import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_TABLE_NAME || "";

export interface DashboardApiResponse {
  chartData: any[];
  investors: any[];
  properties: any[];
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
  };
}

export async function updateDashboardData(
  investors: any[],
  properties: any[],
  chart1?: any[],
): Promise<void> {
  const attributes: any = { investors, properties };

  // Include chart1 if provided
  if (chart1) {
    attributes.chart1 = chart1;
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
