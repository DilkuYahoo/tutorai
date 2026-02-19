// export interface Investor {
//   name: string;
//   annual_growth_rate: number;
//   base_income: number;
//   income_events: Array<{
//     type: string;
//     year: number;
//     amount: number;
//   }>;
// }

// export interface Property {
//   purchase_year: number;
//   initial_value: number;
//   growth_rate: number;
//   other_expenses: number;
//   investor_splits: Array<{
//     name: string;
//     percentage: number;
//   }>;
//   annual_principal_change: number;
//   name: string;
//   interest_rate: number;
//   loan_amount: number;
//   property_value: number;
//   rent: number;
// }

// export interface ChartDataPoint {
//   year: number;
//   total_debt: number;
//   investor_borrowing_capacities: Record<string, number>;
//   total_rent: number;
//   investor_debts: Record<string, number>;
//   property_loan_balances: Record<string, number>;
//   property_lvrs: Record<string, number>;
//   total_interest_cost: number;
//   property_values: Record<string, number>;
//   total_other_expenses: number;
//   investor_net_incomes: Record<string, number>;
//   cashflow: number;
//   combined_income: number;
// }

// export interface ApiResponse {
//   status: string;
//   message: string;
//   item_id: string;
//   table_name: string;
//   timestamp: string;
//   result: {
//     id: string;
//     chart1: ChartDataPoint[];
//     investors: Investor[];
//     properties: Property[];
//   };
// }

// const API_URL =
//   "https://gwhfr6wpc8.execute-api.ap-southeast-2.amazonaws.com/prod/read-table";

// export const fetchFinancialData = async (): Promise<ApiResponse> => {
//   try {
//     const response = await fetch(API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         table_name: "BA-PORTAL-BASETABLE",
//         id: "B57153AB-B66E-4085-A4C1-929EC158FC3E",
//         region: "ap-southeast-2",
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`API error: ${response.statusText}`);
//     }

//     const data: ApiResponse = await response.json();
//     return data;
//   } catch (error) {
//     console.error("Error fetching financial data:", error);
//     throw error;
//   }
// };
