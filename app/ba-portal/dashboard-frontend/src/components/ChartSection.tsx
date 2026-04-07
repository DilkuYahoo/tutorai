/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import ReactECharts from 'echarts-for-react';
import { generatePortfolioSummary, generateOurAdvice, updateDashboardData } from '../services/dashboardService';
import { Sparkles, ChevronDown } from 'lucide-react';

// Simple markdown to HTML converter
const parseMarkdown = (text: string): string => {
  if (!text) return '';
  
  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Remove any header lines containing EXECUTIVE SUMMARY (case insensitive, any level)
    .replace(/^#+\s*.*EXECUTIVE\s+SUMMARY.*$/gim, '')
    .replace(/\n#+\s*.*EXECUTIVE\s+SUMMARY.*$/gim, '')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2" style="color: inherit;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-4 mb-2" style="color: inherit;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-2" style="color: inherit;">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Line breaks - handle multiple newlines
    .replace(/\n\n\n+/g, '</p><p class="mb-2">')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br />');
  
  // Clean up any double paragraphs or empty tags
  html = html.replace(/<p class="mb-2"><\/p>/g, '');
  html = html.replace(/<p class="mb-2">\s*<\/p>/g, '');
  
  return `<p class="mb-2">${html}</p>`;
};

interface ChartSectionProps {
  chartData: any[];
  loading: boolean;
  isDarkMode?: boolean;
  investors?: any[];
  executiveSummary?: string;
  ourAdvice?: string;
  selectedPortfolioId?: string;
  onSummaryGenerated?: (summary: string) => void;
  onAdviceGenerated?: (advice: string) => void;
}

const ChartSection: React.FC<ChartSectionProps> = ({ chartData, loading, isDarkMode = false, investors, executiveSummary, ourAdvice, selectedPortfolioId, onSummaryGenerated, onAdviceGenerated }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Current Snapshot state
  const [snapshotSummary, setSnapshotSummary] = useState<string>('');
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isSnapshotExpanded, setIsSnapshotExpanded] = useState<boolean>(true);
  const [cachedPortfolioId, setCachedPortfolioId] = useState<string>('');

  // Our Advice state
  const [adviceText, setAdviceText] = useState<string>('');
  const [adviceLoading, setAdviceLoading] = useState<boolean>(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [isAdviceExpanded, setIsAdviceExpanded] = useState<boolean>(true);

  // Load executive summary from props on mount or when portfolio changes
  useEffect(() => {
    // Reset cache when portfolio changes to force refresh from backend
    if (selectedPortfolioId && selectedPortfolioId !== cachedPortfolioId) {
      console.log("Portfolio changed from", cachedPortfolioId, "to", selectedPortfolioId, "- resetting summary cache");
      setCachedPortfolioId(selectedPortfolioId);
      setSnapshotSummary(''); // Clear local cache
    }
    
    // If executiveSummary prop is empty or undefined, clear local cache
    // This handles the case when Refresh Data is pressed
    if (!executiveSummary || executiveSummary.trim().length === 0) {
      console.log("Executive summary prop is empty - clearing local cache");
      setSnapshotSummary('');
      return;
    }
    
    // If there's content in the prop, use it
    if (executiveSummary && executiveSummary.trim().length > 0) {
      setSnapshotSummary(executiveSummary);
    }
  }, [executiveSummary, selectedPortfolioId, cachedPortfolioId]);

  // Load our advice from props
  useEffect(() => {
    // Always update advice when portfolio changes OR when ourAdvice prop changes
    if (selectedPortfolioId) {
      setCachedPortfolioId(selectedPortfolioId);
    }
    
    // If we have new advice from props, use it
    if (ourAdvice && ourAdvice.trim().length > 0) {
      setAdviceText(ourAdvice);
    } else if (!ourAdvice || ourAdvice.trim().length === 0) {
      // Clear advice if no advice in props
      setAdviceText('');
    }
  }, [ourAdvice, selectedPortfolioId]);

  // Chart colors that work in both modes
  const chartColors = {
    text: isDarkMode ? '#ffffff' : '#1f2937',
    axisLabel: isDarkMode ? '#94a3b8' : '#4b5563',
    legend: isDarkMode ? '#ffffff' : '#1f2937',
    markLine: isDarkMode ? '#ffffff' : '#6b7280',
    markLineLabel: isDarkMode ? '#ffffff' : '#374151',
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Transform API data for charts
  const transformedData =
    chartData && chartData.length > 0
      ? chartData.map((item: any) => {
          const totalPropertyValue = Object.values(item.property_values || {}).reduce((sum: number, val: any) => sum + (val || 0), 0);
          const totalLoanBalance = Object.values(item.property_loan_balances || {}).reduce((sum: number, val: any) => sum + (val || 0), 0);
          const totalEquity = totalPropertyValue - totalLoanBalance;
          const lvr = item.lvr || (totalPropertyValue > 0 ? (totalLoanBalance / totalPropertyValue) * 100 : 0);
          
          const combinedIncome = item.combined_income || 0;
          const totalEssentialExpenses = item.total_essential_expenses || 0;
          const totalNonessentialExpenses = item.total_nonessential_expenses || 0;
          const propertyCashflow = item.property_cashflow;
          const householdSurplus = item.household_surplus;
          
          const borrowingCapacity = (() => {
            const capacities = item.investor_borrowing_capacities;
            if (capacities && capacities.M) {
              return Object.values(capacities.M).reduce((sum: number, inv: any) => {
                return sum + (inv && inv.N !== undefined ? Number(inv.N) : 0);
              }, 0);
            }
            return Object.values(capacities || {}).reduce((sum: number, val: any) => {
              return sum + (Number(val) || 0);
            }, 0);
          })();
          
          return {
            year: `Year ${Math.floor(item.year || 0)}`,
            rawYear: item.year || 0,
            property_values: item.property_values || {},
            loanBalances: item.property_loan_balances || {},
            totalPropertyValue,
            totalLoanBalance,
            totalEquity,
            lvr,
            total_debt: item.total_debt,
            total_rent: item.total_rent,
            total_expenses: item.total_other_expenses || 0,
            sumNetIncome: Object.values(item.investor_net_incomes || {}).reduce((sum: number, val: any) => sum + (val || 0), 0),
            investor_net_incomes: item.investor_net_incomes || {},
            combined_income: combinedIncome,
            total_essential_expenses: totalEssentialExpenses,
            total_nonessential_expenses: totalNonessentialExpenses,
            property_cashflow: propertyCashflow,
            household_surplus: householdSurplus,
            borrowing_capacity: borrowingCapacity,
            investor_borrowing_capacities: item.investor_borrowing_capacities,
            max_purchase_price: item.max_purchase_price || 0,
            // Buy score fields
            buy_score: item.buy_score || 0,
            buy_score_equity_ratio: item.buy_score_equity_ratio || 0,
            buy_score_borrowing_ratio: item.buy_score_borrowing_ratio || 0,
            buy_score_dti: item.buy_score_dti || 0,
            // DTI ratio from backend
            dti_ratio: item.dti_ratio || 0,
          };
        })
      : [];

  // Get key metrics from the latest year
  const latestData =
    chartData && chartData.length > 0 ? chartData[chartData.length - 1] : {};
  const investorNames = Object.keys(latestData?.investor_net_incomes || {});

  // Map stale chart1 keys (old names) to current investor names by position
  const chartKeyToDisplayName: Record<string, string> = {};
  investorNames.forEach((chartKey, i) => {
    chartKeyToDisplayName[chartKey] = investors?.[i]?.name || chartKey;
  });

  const colors = ['#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'];

  // ECharts options - Portfolio Growth vs Debt
  const portfolioOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode ? '#475569' : '#e5e7eb',
      textStyle: { color: isDarkMode ? '#f1f5f9' : '#1f2937' },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>`;
        params.forEach((param: any) => {
          result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
            ${param.seriesName}: ${param.value.toLocaleString()}
          </div>`;
        });
        return result;
      }
    },
    legend: { 
      textStyle: { color: chartColors.legend },
      top: 0
    },
    grid: { left: 60, right: 40 },
    xAxis: {
      type: 'category',
      data: transformedData.map((d: any) => d.year),
      axisLabel: { 
        interval: Math.floor(transformedData.length / 10) || 0, 
        color: chartColors.axisLabel, 
        fontSize: 12 
      },
      axisLine: { lineStyle: { color: isDarkMode ? '#475569' : '#d1d5db' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Value ($)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => `${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
      }
    ],
    series: [
      {
        name: 'Total Property Value',
        type: 'line',
        data: transformedData.map((d: any) => d.totalPropertyValue),
        lineStyle: { color: '#06b6d4', width: 3 },
        itemStyle: { color: '#06b6d4' },
        smooth: true
      },
      {
        name: 'Total Loan Balance',
        type: 'line',
        data: transformedData.map((d: any) => d.totalLoanBalance),
        lineStyle: { color: '#f59e0b', width: 3 },
        itemStyle: { color: '#f59e0b' },
        smooth: true
      },
      {
        name: 'Total Equity',
        type: 'line',
        data: transformedData.map((d: any) => d.totalEquity),
        areaStyle: { color: '#10b981', opacity: 0.3 },
        lineStyle: { color: '#10b981', width: 3 },
        itemStyle: { color: '#10b981' },
        smooth: true
      }
    ]
  };

  // Get cashflow data
  const getCashflowData = () => {
    return transformedData.map((d: any) => {
      const borrowingCapacity = (() => {
        const capacities = d.investor_borrowing_capacities;
        if (capacities && capacities.M) {
          return Object.values(capacities.M).reduce((sum: number, inv: any) => {
            return sum + (inv && inv.N !== undefined ? Number(inv.N) : 0);
          }, 0);
        }
        return Object.values(capacities || {}).reduce((sum: number, val: any) => {
          return sum + (Number(val) || 0);
        }, 0);
      })();
      
      return {
        combinedIncome: d.combined_income || 0,
        essentialExpenses: d.total_essential_expenses || 0,
        nonessentialExpenses: d.total_nonessential_expenses || 0,
        propertyCashflow: d.property_cashflow || 0,
        householdSurplus: d.household_surplus || 0,
        borrowingCapacity,
        lvr: d.lvr || 0
      };
    });
  };

  const cashflowData = getCashflowData();

  // Cashflow Chart
  const cashflowOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode ? '#475569' : '#e5e7eb',
      textStyle: { color: isDarkMode ? '#f1f5f9' : '#1f2937' },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div><div style="margin-top: 8px; space-y: 4px;">`;
        params.forEach((param: any) => {
          const value = param.value;
          const formattedValue = value < 0 ? `-$${Math.abs(value).toLocaleString()}` : `$${value.toLocaleString()}`;
          result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
            <span>${param.seriesName}:</span>
            <span style="margin-left: auto; font-weight: 600;">${formattedValue}</span>
          </div>`;
        });
        result += '</div>';
        return result;
      }
    },
    legend: { 
      textStyle: { color: chartColors.legend },
      top: 0
    },
    grid: { left: 40, right: 40, top: 40 },
    xAxis: {
      type: 'category',
      data: transformedData.map((d: any) => d.year),
      axisLabel: { 
        interval: Math.floor(transformedData.length / 10) || 0, 
        color: chartColors.axisLabel, 
        fontSize: 12 
      },
      axisLine: { lineStyle: { color: isDarkMode ? '#475569' : '#d1d5db' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Value ($)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => `${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
      }
    ],
    series: [
      {
        name: 'Combined Income',
        type: 'bar',
        stack: 'cashflow',
        data: cashflowData.map((d: any) => d.combinedIncome),
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: 'Total Essential Expenses',
        type: 'bar',
        stack: 'cashflow',
        data: cashflowData.map((d: any) => -d.essentialExpenses),
        itemStyle: { color: '#f59e0b', borderRadius: [0, 0, 4, 4] }
      },
      {
        name: 'Total Nonessential Expenses',
        type: 'bar',
        stack: 'cashflow',
        data: cashflowData.map((d: any) => -d.nonessentialExpenses),
        itemStyle: { color: '#ef4444' }
      },
      {
        name: 'Property Cashflow',
        type: 'bar',
        stack: 'cashflow',
        data: cashflowData.map((d: any) => d.propertyCashflow),
        itemStyle: { color: '#8b5cf6' }
      },
      {
        name: 'Household Surplus',
        type: 'line',
        data: cashflowData.map((d: any) => d.householdSurplus),
        lineStyle: { color: '#22c55e', width: 3 },
        itemStyle: { color: '#22c55e' },
        symbol: 'circle',
        symbolSize: 8,
        areaStyle: { color: '#22c55e', opacity: 0.2 }
      }
    ]
  };

  // DTI Ratio Chart
  const dtiRatioOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode ? '#475569' : '#e5e7eb',
      textStyle: { color: isDarkMode ? '#f1f5f9' : '#1f2937' },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>`;
        params.forEach((param: any) => {
          if (param.seriesName === 'Total Borrowing Capacity') {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: <strong>${param.value.toLocaleString()}</strong>
            </div>`;
          } else {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: <strong>${param.value.toFixed(2)}</strong>
            </div>`;
          }
        });
        return result;
      }
    },
    legend: { 
      textStyle: { color: chartColors.legend },
      top: 0
    },
    grid: { left: 60, right: 80, top: 40 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: transformedData.map((d: any) => d.year),
      axisLabel: { color: chartColors.axisLabel, fontSize: 12 },
      axisLine: { lineStyle: { color: isDarkMode ? '#475569' : '#d1d5db' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'DTI Ratio',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => value.toFixed(2), color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } },
        min: 0
      },
      {
        type: 'value',
        name: 'Borrowing Capacity ($)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => `${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'DTI Ratio',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: transformedData.map((d: any) => d.dti_ratio || 0),
        lineStyle: { color: '#f59e0b', width: 3 },
        itemStyle: { color: '#f59e0b' },
        areaStyle: { color: '#f59e0b', opacity: 0.2 },
        markLine: {
          data: [
            { yAxis: 0.30, name: 'Safe Zone', lineStyle: { color: '#10b981', type: 'dashed' } },
            { yAxis: 0.43, name: 'Caution', lineStyle: { color: '#f59e0b', type: 'dashed' } }
          ],
          label: { color: chartColors.markLineLabel, fontSize: 10 }
        }
      },
      {
        name: 'Total Borrowing Capacity',
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 10,
        yAxisIndex: 1,
        data: transformedData.map((d: any) => d.borrowing_capacity || 0),
        lineStyle: { color: '#06b6d4', width: 3, type: 'dashed' },
        itemStyle: { color: '#06b6d4' },
        areaStyle: { color: '#06b6d4', opacity: 0.1 }
      }
    ]
  };

  // Investor Net Income Chart
  const investorNetIncomeOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode ? '#475569' : '#e5e7eb',
      textStyle: { color: isDarkMode ? '#f1f5f9' : '#1f2937' },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>`;
        params.forEach((param: any) => {
          result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
            ${param.seriesName}: $${param.value.toLocaleString()}
          </div>`;
        });
        return result;
      }
    },
    legend: { 
      textStyle: { color: chartColors.legend },
      top: 0
    },
    grid: { left: 60, right: 60, top: 40 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: transformedData.map((d: any) => d.year),
      axisLabel: { color: chartColors.axisLabel, fontSize: 12 },
      axisLine: { lineStyle: { color: isDarkMode ? '#475569' : '#d1d5db' } }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Net Income ($)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => `${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'Purchase Price ($)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: (value: number) => `${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { show: false }
      }
    ],
    series: [
      ...investorNames.map((name: string, index: number) => ({
        name: chartKeyToDisplayName[name],
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: transformedData.map((d: any) => d.investor_net_incomes?.[name] || 0),
        areaStyle: { opacity: 0.1, color: colors[index % colors.length] },
        lineStyle: { width: 2 },
        itemStyle: { color: colors[index % colors.length] }
      })),
      {
        name: 'Max Purchase Price',
        type: 'line',
        smooth: true,
        symbol: 'triangle',
        symbolSize: 10,
        yAxisIndex: 1,
        data: transformedData.map((d: any) => d.max_purchase_price || 0),
        lineStyle: { color: '#8b5cf6', width: 3 },
        itemStyle: { color: '#8b5cf6' },
        areaStyle: { color: '#8b5cf6', opacity: 0.1 }
      }
    ]
  };

  const totalPropertyValues = Object.values(latestData?.property_values || {}).reduce((sum: number, val: any) => sum + (val || 0), 0);
  const totalEquity = totalPropertyValues - (Object.values(latestData?.property_loan_balances || {}).reduce((sum: number, val: any) => sum + (val || 0), 0));

  const handleGeneratePortfolioSummary = async () => {
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const result = await generatePortfolioSummary(selectedPortfolioId);
      console.log("[DEBUG] Generated summary:", result.summary?.substring(0, 100) + "...");
      
      // Save summary to DynamoDB so it persists
      if (result.summary && selectedPortfolioId) {
        try {
          await updateDashboardData(undefined, undefined, undefined, result.summary, undefined, selectedPortfolioId);
          console.log("[DEBUG] Saved summary to DynamoDB");
        } catch (saveError) {
          console.error("[DEBUG] Failed to save summary to DynamoDB:", saveError);
        }
      }
      
      setSnapshotSummary(result.summary);
      // Notify parent component that summary was generated
      if (onSummaryGenerated) {
        onSummaryGenerated(result.summary);
      }
    } catch (error) {
      console.error("Failed to generate portfolio summary:", error);
      setSnapshotError("Unable to generate summary. Please try again.");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleGenerateOurAdvice = async () => {
    setAdviceLoading(true);
    setAdviceError(null);
    try {
      console.log("[DEBUG] handleGenerateOurAdvice - calling API...");
      const result = await generateOurAdvice(selectedPortfolioId);
      console.log("[DEBUG] Generated advice:", result.advice?.substring(0, 100) + "...");
      setAdviceText(result.advice);
      if (onAdviceGenerated) {
        onAdviceGenerated(result.advice);
      }
    } catch (error: any) {
      console.error("[DEBUG] Failed to generate advice:", error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      setAdviceError(`Unable to generate advice: ${errorMessage}`);
    } finally {
      setAdviceLoading(false);
    }
  };

  // Card background color
  const cardBg = isDarkMode ? '#1e293b' : '#f9fafb';
  const cardBorder = isDarkMode ? '#334155' : '#e5e7eb';
  const cardText = isDarkMode ? '#f1f5f9' : '#1f2937';
  const cardTextSecondary = isDarkMode ? '#94a3b8' : '#6b7280';

  return (
    <div className="flex-1 p-8 overflow-y-auto" style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f3f4f6' }}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2" style={{ color: cardText }}>
            WealthPulse
          </h1>
          <p style={{ color: cardTextSecondary }}>
            Comprehensive financial dashboard providing insights into portfolio growth, risk management, and cashflow analysis over time.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8" style={{ color: cardTextSecondary }}>
            Loading financial data...
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-8" style={{ color: cardTextSecondary }}>
            No data available
          </div>
        ) : (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Total Equity Card */}
              <div className="rounded-lg p-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <p className="text-sm font-semibold opacity-90">
                  Total Equity (Year {Math.floor(latestData.year || 30)})
                </p>
                <p className="text-xl font-bold pt-3 mt-2 border-t border-white/20">
                  ${totalEquity.toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg p-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)' }}>
                <p className="text-sm font-semibold opacity-90">
                  Property Cash Flow (Year {Math.floor(latestData.year || 30)})
                </p>
                <p className="text-xl font-bold pt-3 mt-2 border-t border-white/20">
                  ${(latestData.property_cashflow || 0).toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg p-4 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <p className="text-sm font-semibold opacity-90">Household Surplus (Year {Math.floor(latestData.year || 30)})</p>
                <p className="text-xl font-bold pt-3 mt-2 border-t border-white/20">
                  ${(latestData.household_surplus || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Executive Summary Card */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>Executive Summary</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSnapshotExpanded(!isSnapshotExpanded)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}
                    title={isSnapshotExpanded ? 'Collapse details' : 'Expand details'}
                  >
                    <ChevronDown className={`w-5 h-5 transform transition-transform ${isSnapshotExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    onClick={handleGeneratePortfolioSummary}
                    disabled={snapshotLoading}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    <Sparkles className="w-5 h-5" />
                    {snapshotLoading ? 'Generating...' : '🤖 Summarise'}
                  </button>
                  
                </div>
              </div>
              {isSnapshotExpanded && (
                <>
                  {snapshotLoading && (
                    <div className="text-center py-4" style={{ color: cardTextSecondary }}>
                      Generating summary...
                    </div>
                  )}
                  {snapshotError && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: '#ef4444' }}>
                      {snapshotError}
                    </div>
                  )}
                  {snapshotSummary && !snapshotLoading && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }}>
                      <div 
                        style={{ color: cardTextSecondary }}
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(snapshotSummary) }}
                      />
                    </div>
                  )}
                  {!snapshotSummary && !snapshotLoading && !snapshotError && (
                    <div className="text-sm" style={{ color: cardTextSecondary }}>
                      <p>Click the button to generate an AI summary of your portfolio.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Our Advice Card */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>Our Advice</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAdviceExpanded(!isAdviceExpanded)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}
                    title={isAdviceExpanded ? 'Collapse details' : 'Expand details'}
                  >
                    <ChevronDown className={`w-5 h-5 transform transition-transform ${isAdviceExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <button
                    onClick={handleGenerateOurAdvice}
                    disabled={adviceLoading}
                    className="px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    <Sparkles className="w-5 h-5" />
                    {adviceLoading ? 'Generating...' : '💡 Get Advice'}
                  </button>
                </div>
              </div>
              {isAdviceExpanded && (
                <>
                  {adviceLoading && (
                    <div className="text-center py-4" style={{ color: cardTextSecondary }}>
                      Generating advice...
                    </div>
                  )}
                  {adviceError && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: '#ef4444' }}>
                      {adviceError}
                    </div>
                  )}
                  {adviceText && !adviceLoading && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb' }}>
                      <div 
                        style={{ color: cardTextSecondary }}
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(adviceText) }}
                      />
                    </div>
                  )}
                  {!adviceText && !adviceLoading && !adviceError && (
                    <div className="text-sm" style={{ color: cardTextSecondary }}>
                      <p>Click the button to get actionable advice for your portfolio.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Portfolio Growth vs Debt Chart */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  Portfolio Growth vs Debt
                </h2>
                <button
                  onClick={() => toggleSection('portfolio')}
                  className="transition-colors"
                  style={{ color: cardTextSecondary }}
                  title="Learn more about this chart"
                >
                  <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'portfolio' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'portfolio' && (
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Tracks your portfolio's property values, loan balances, and equity position over time.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><span style={{ color: '#06b6d4' }}>Total Property Value</span> - Sum of all property market values</li>
                    <li><span style={{ color: '#f59e0b' }}>Total Loan Balance</span> - Outstanding loan amounts across properties</li>
                    <li><span style={{ color: '#10b981' }}>Total Equity</span> - Property value minus loan balance</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Rising equity indicates portfolio growth and risk reduction.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Shows portfolio growth with property values, equity, and loan balances over time.
              </p>
              <ReactECharts option={portfolioOption} style={{ height: '300px' }} />
            </div>

            {/* Cashflow */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  Cashflow (Income Lens)
                </h2>
                <button
                  onClick={() => toggleSection('cashflow')}
                  className="transition-colors"
                  style={{ color: cardTextSecondary }}
                  title="Learn more about this chart"
                >
                  <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'cashflow' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'cashflow' && (
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Income, expenses, and borrowing capacity to assess your ability to service debt and maintain positive cashflow.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><span style={{ color: '#10b981' }}>Combined Income</span> - Total household income from all investors</li>
                    <li><span style={{ color: '#f59e0b' }}>Essential Expenses</span> - Necessary living costs (mortgage, utilities, insurance)</li>
                    <li><span style={{ color: '#ef4444' }}>Nonessential Expenses</span> - Discretionary spending</li>
                    <li><span style={{ color: '#8b5cf6' }}>Property Cashflow</span> - Net property income (rent - costs)</li>
                    <li><span style={{ color: '#06b6d4' }}>LVR</span> - Loan-to-Value Ratio (secondary axis, %)</li>
                    <li><span style={{ color: '#22c55e' }}>Household Surplus</span> - Remaining income after all expenses</li>
                    <li><span style={{ color: '#ec4899' }}>Borrowing Capacity</span> - Maximum additional borrowing based on income</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Positive household surplus indicates room for additional investment or savings. Borrowing capacity shows your ability to take on more debt.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Illustrates cashflow components and borrowing capacity over time.
              </p>
              <ReactECharts option={cashflowOption} style={{ height: '300px' }} />
            </div>

            {/* DTI Ratio & Borrowing Capacity Chart */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  DTI Ratio & Borrowing Power
                </h2>
                <button
                  onClick={() => toggleSection('dti')}
                  className="transition-colors"
                  style={{ color: cardTextSecondary }}
                  title="Learn more about this chart"
                >
                  <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'dti' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'dti' && (
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Debt-to-Income (DTI) ratio showing the proportion of gross household income used to service debt, along with total borrowing capacity.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Formula:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>DTI Ratio = Total Debt / Combined Income</strong></li>
                    <li><span style={{ color: '#f59e0b' }}>DTI Ratio</span> - Proportion of income going to debt repayment</li>
                    <li><span style={{ color: '#06b6d4' }}>Total Borrowing Capacity</span> - Sum of all investors' borrowing capacities (secondary axis)</li>
                  </ul>
                  <p className="mt-2 text-sm"><strong style={{ color: cardText }}>Interpretation:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>DTI &lt; 0.30: Safe zone - comfortable debt servicing</li>
                    <li>DTI 0.30-0.43: Caution - may affect borrowing capacity</li>
                    <li>DTI &gt; 0.43: High risk - likely to struggle with additional debt</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: The Total Borrowing Capacity line shows your purchasing power. Higher values with lower DTI indicate room for additional investment.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Shows Debt-to-Income ratio and total borrowing capacity over time. Lower DTI indicates healthier debt position.
              </p>
              <ReactECharts option={dtiRatioOption} style={{ height: '300px' }} />
            </div>

            {/* Investor Net Income Chart */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  Investor Net Income
                </h2>
                <button
                  onClick={() => toggleSection('investorNetIncome')}
                  className="transition-colors"
                  style={{ color: cardTextSecondary }}
                  title="Learn more about this chart"
                >
                  <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'investorNetIncome' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'investorNetIncome' && (
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Net income trends for each investor and maximum purchase price over time.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Individual investor net income lines showing income progression</li>
                    <li><span style={{ color: '#8b5cf6' }}>Max Purchase Price</span> - Maximum property price affordable based on borrowing capacity (secondary axis)</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Rising net income indicates improving financial position for each investor.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Shows net income trends for each investor and max purchase price over time.
              </p>
              <ReactECharts option={investorNetIncomeOption} style={{ height: '300px' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChartSection;
