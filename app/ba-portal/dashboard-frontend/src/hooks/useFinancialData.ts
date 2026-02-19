// import { useState, useEffect } from "react";
// import {
//   fetchFinancialData,
//   ApiResponse,
//   ChartDataPoint,
//   Investor,
//   Property,
// } from "../services/financialApi";

// interface UseFinancialDataReturn {
//   chartData: ChartDataPoint[];
//   investors: Investor[];
//   properties: Property[];
//   loading: boolean;
//   error: string | null;
// }

// export const useFinancialData = (): UseFinancialDataReturn => {
//   const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
//   const [investors, setInvestors] = useState<Investor[]>([]);
//   const [properties, setProperties] = useState<Property[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const loadData = async () => {
//       try {
//         setLoading(true);
//         const response = await fetchFinancialData();
//         setChartData(response.result.chart1);
//         setInvestors(response.result.investors);
//         setProperties(response.result.properties);
//         setError(null);
//       } catch (err) {
//         setError(err instanceof Error ? err.message : "Failed to fetch data");
//         setChartData([]);
//         setInvestors([]);
//         setProperties([]);
//       } finally {
//         setLoading(false);
//       }
//     };

//     loadData();
//   }, []);

//   return { chartData, investors, properties, loading, error };
// };
