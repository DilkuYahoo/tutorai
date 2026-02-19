/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import ReactECharts from 'echarts-for-react';

interface ChartSectionProps {
  chartData: any[];
  loading: boolean;
}

const ChartSection: React.FC<ChartSectionProps> = ({ chartData, loading }) => {
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Check initial dark mode state
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();

    // Listen for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

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
          };
        })
      : [];

  // Get key metrics from the latest year
  const latestData =
    chartData && chartData.length > 0 ? chartData[chartData.length - 1] : {};
  const investorNames = Object.keys(latestData?.investor_net_incomes || {});
  const propertyNames = Object.keys(latestData?.property_values || {});
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
          if (param.seriesName === 'LVR (%)') {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: ${param.value.toFixed(1)}%
            </div>`;
          } else {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: $${param.value.toLocaleString()}
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
    grid: { left: 60, right: 60 },
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
        axisLabel: { formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'LVR (%)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: '{value}%', color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { show: false }
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
      },
      {
        name: 'LVR (%)',
        type: 'line',
        data: transformedData.map((d: any) => d.lvr),
        yAxisIndex: 1,
        lineStyle: { color: '#ef4444', width: 3 },
        itemStyle: { color: '#ef4444' },
        smooth: true
      }
    ]
  };

  // LVR & Risk Compression Chart
  const lvrOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode ? '#475569' : '#e5e7eb',
      textStyle: { color: isDarkMode ? '#f1f5f9' : '#1f2937' },
      formatter: (params: any) => {
        let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>`;
        params.forEach((param: any) => {
          if (param.seriesName.includes('LVR')) {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: ${param.value.toFixed(1)}%
            </div>`;
          } else {
            result += `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              ${param.seriesName}: $${param.value.toLocaleString()}
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
    grid: { left: 40 },
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
    yAxis: {
      type: 'value',
      axisLabel: { formatter: '{value}%', color: chartColors.axisLabel, fontSize: 12 },
      splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
    },
    series: [
      ...propertyNames.map((name: string, index: number) => ({
        name: `LVR: ${name}`,
        type: 'bar',
        data: transformedData.map((d: any) => (((d.loanBalances[name] || 0) / ((d.property_values && d.property_values[name]) || 1)) * 100)),
        itemStyle: { 
          color: colors[index % colors.length],
          borderRadius: [4, 4, 0, 0]
        }
      })),
      {
        name: 'Portfolio LVR',
        type: 'line',
        data: transformedData.map((d: any) => d.lvr),
        lineStyle: { color: '#ef4444', width: 3 },
        itemStyle: { color: '#ef4444' },
        symbol: 'circle',
        symbolSize: 6,
        markLine: {
          data: [
            { yAxis: 80, name: '80% Bank Comfort' },
            { yAxis: 70, name: '70% Bank Comfort' },
            { yAxis: 60, name: '60% Bank Comfort' }
          ],
          lineStyle: { color: chartColors.markLine, type: 'dashed', width: 2 },
          label: { color: chartColors.markLineLabel, fontSize: 10 }
        }
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

  // Cashflow & Serviceability Chart
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
          let formattedValue: string;
          if (param.seriesName === 'LVR') {
            formattedValue = `${value.toFixed(1)}%`;
          } else {
            formattedValue = value < 0 ? `-$${Math.abs(value).toLocaleString()}` : `$${value.toLocaleString()}`;
          }
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
      },
      {
        type: 'value',
        name: 'LVR (%)',
        nameTextStyle: { color: chartColors.text },
        axisLabel: { formatter: '{value}%', color: chartColors.axisLabel, fontSize: 12 },
        splitLine: { show: false }
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
        name: 'LVR',
        type: 'line',
        yAxisIndex: 1,
        data: cashflowData.map((d: any) => d.lvr),
        lineStyle: { color: '#06b6d4', width: 3 },
        itemStyle: { color: '#06b6d4' },
        symbol: 'circle',
        symbolSize: 8
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
      },
      {
        name: 'Borrowing Capacity',
        type: 'line',
        data: cashflowData.map((d: any) => d.borrowingCapacity),
        lineStyle: { color: '#ec4899', type: 'dashed' },
        itemStyle: { color: '#ec4899' },
        symbol: 'diamond',
        symbolSize: 6
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
    yAxis: {
      type: 'value',
      name: 'Net Income ($)',
      nameTextStyle: { color: chartColors.text },
      axisLabel: { formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`, color: chartColors.axisLabel, fontSize: 12 },
      splitLine: { lineStyle: { color: isDarkMode ? '#334155' : '#e5e7eb', type: 'dashed' } }
    },
    series: investorNames.map((name: string, index: number) => ({
      name: name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: transformedData.map((d: any) => d.investor_net_incomes?.[name] || 0),
      areaStyle: { opacity: 0.1, color: colors[index % colors.length] },
      lineStyle: { width: 2 },
      itemStyle: { color: colors[index % colors.length] }
    }))
  };

  const totalPropertyValues = Object.values(latestData?.property_values || {}).reduce((sum: number, val: any) => sum + (val || 0), 0);
  const totalEquity = totalPropertyValues - (Object.values(latestData?.property_loan_balances || {}).reduce((sum: number, val: any) => sum + (val || 0), 0));
  const generateSummary = () => {
    const totalValue = totalPropertyValues;
    const totalDebt = latestData?.property_cashflow || 0;
    const equity = totalValue - totalDebt;
    const lvr = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;
    const summary = `Portfolio Executive Summary:\n\nTotal Property Value: ${totalValue.toLocaleString()}\nTotal Debt: ${totalDebt.toLocaleString()}\nEquity: ${equity.toLocaleString()}\nLoan-to-Value Ratio: ${lvr.toFixed(1)}%\n\nThe portfolio shows strong growth potential with current equity position.`;
    setExecutiveSummary(summary);
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
            Investor Dashboard
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
                <h2 className="text-xl font-bold" style={{ color: cardText }}>Executive Summary of the Portfolio</h2>
                <button
                  onClick={generateSummary}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: '#06b6d4', color: 'white' }}
                >
                  Generate Summary
                </button>
              </div>
              {executiveSummary && (
                <div style={{ color: cardTextSecondary, whiteSpace: 'pre-line' }}>
                  {executiveSummary}
                </div>
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
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Tracks your portfolio's property values, loan balances, equity position, and Loan-to-Value Ratio (LVR) over time.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><span style={{ color: '#06b6d4' }}>Total Property Value</span> - Sum of all property market values</li>
                    <li><span style={{ color: '#f59e0b' }}>Total Loan Balance</span> - Outstanding loan amounts across properties</li>
                    <li><span style={{ color: '#10b981' }}>Total Equity</span> - Property value minus loan balance</li>
                    <li><span style={{ color: '#ef4444' }}>LVR (%)</span> - Loan-to-Value Ratio (secondary axis)</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Rising equity with stable or declining LVR indicates portfolio growth and risk reduction.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Shows portfolio growth with property values, equity, loan balances, and LVR over time.
              </p>
              <ReactECharts option={portfolioOption} style={{ height: '300px' }} />
            </div>

            {/* LVR & Risk Compression */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  LVR & Risk Compression
                </h2>
                <button
                  onClick={() => toggleSection('lvr')}
                  className="transition-colors"
                  style={{ color: cardTextSecondary }}
                  title="Learn more about this chart"
                >
                  <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'lvr' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
              {expandedSection === 'lvr' && (
                <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                  <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> LVR trends for each property and the overall portfolio, with bank comfort zone indicators.</p>
                  <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><span style={{ color: '#06b6d4' }}>Property LVR bars</span> - Individual property LVR (loan ÷ value)</li>
                    <li><span style={{ color: '#ef4444' }}>Portfolio LVR line</span> - Overall portfolio weighted average LVR</li>
                    <li>Dashed lines show bank comfort thresholds (80%, 70%, 60%)</li>
                  </ul>
                  <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Banks typically get concerned when LVR exceeds 80%. Staying below 70% provides buffer for market fluctuations.</p>
                </div>
              )}
              <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                Displays LVR trends for individual properties and portfolio, with bank comfort zones.
              </p>
              <ReactECharts option={lvrOption} style={{ height: '300px' }} />
            </div>

            {/* Cashflow & Serviceability */}
            <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold" style={{ color: cardText }}>
                  Cashflow & Serviceability (Income Lens)
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

            {/* Investor Net Income Over Time */}
            {investorNames.length > 0 && (
              <div className="rounded-xl p-6 border shadow-lg" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold" style={{ color: cardText }}>
                    Investors Net Income Over Time
                  </h2>
                  <button
                    onClick={() => toggleSection('investor')}
                    className="transition-colors"
                    style={{ color: cardTextSecondary }}
                    title="Learn more about this chart"
                  >
                    <svg className={`w-6 h-6 transform transition-transform ${expandedSection === 'investor' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                {expandedSection === 'investor' && (
                  <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', color: cardTextSecondary }}>
                    <p className="mb-2"><strong style={{ color: cardText }}>What this chart shows:</strong> Net income trends for each investor over the investment horizon, accounting for salary, tax, and investment distributions.</p>
                    <p className="mb-2"><strong style={{ color: cardText }}>Data sources:</strong></p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Each colored line represents one investor's net income trajectory</li>
                      <li>Includes salary growth, tax implications, and investment distributions</li>
                      <li>Shows how individual financial situations evolve over time</li>
                    </ul>
                    <p className="mt-2 text-sm" style={{ color: cardTextSecondary }}>Tip: Compare investor income trends to identify who's most able to service additional debt or contribute to the portfolio.</p>
                  </div>
                )}
                <p className="text-sm mb-4" style={{ color: cardTextSecondary }}>
                  Shows the net income for each investor throughout the investment duration.
                </p>
                <ReactECharts option={investorNetIncomeOption} style={{ height: '300px' }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChartSection;
