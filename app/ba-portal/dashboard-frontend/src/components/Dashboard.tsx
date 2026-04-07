/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, RefreshCw, LogIn } from "lucide-react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ChartSection from "./ChartSection";
import Footer from "./Footer";
import PortfolioSelector from "./PortfolioSelector";
import EmptyPortfolioState from "./EmptyPortfolioState";
import HouseholdExpensesForm from "./HouseholdExpensesForm";
import InvestorDetailsForm from "./InvestorDetailsForm";
import {
  fetchDashboardDataById,
  fetchPortfolioList,
  fetchConfigParams,
  updateDashboardData,
  renamePortfolio,
  createPortfolio,
  type ConfigParams,
  type PortfolioInfo,
  type PortfolioDependantsEvents,
} from "../services/dashboardService";
import { useAuth } from "../contexts/AuthContext";

interface DashboardData {
  chartData: any[];
  investors: any[];
  properties: any[];
  investmentYears?: number;
  executiveSummary?: string;
  ourAdvice?: string;
  loading: boolean;
  error: string | null;
}

const DEFAULT_CONFIG_PARAMS: ConfigParams = {
  medicareLevyRate: 0.02,
  cpiRate: 0.03,
  accessibleEquityRate: 0.80,
  borrowingPowerMultiplierMin: 3.5,
  borrowingPowerMultiplierBase: 5.0,
  borrowingPowerMultiplierDependantReduction: 0.25,
};

// Shared full-screen page layout used by all sub-views.
// contentClassName controls the inner content area; defaults to a scrollable column.
const PageLayout: React.FC<{
  header: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}> = ({ header, children, contentClassName = 'flex-1 overflow-auto' }) => (
  <div
    className="flex flex-col h-screen transition-colors duration-300 overflow-hidden"
    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
  >
    {header}
    <div className={contentClassName}>
      {children}
    </div>
    <Footer />
  </div>
);

const Dashboard: React.FC = () => {
  const { handleAuthCallback, isLoading: authLoading, isAuthenticated, login } = useAuth();

  // All hooks must be declared unconditionally before any early returns
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [portfoliosError, setPortfoliosError] = useState<string | null>(null);

  const [data, setData] = useState<DashboardData>({
    chartData: [],
    investors: [],
    properties: [],
    investmentYears: 30,
    executiveSummary: '',
    ourAdvice: '',
    loading: true,
    error: null,
  });

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);
  const [investmentYears, setInvestmentYears] = useState(30);
  const [showExpensesForm, setShowExpensesForm] = useState(false);
  const [showInvestorDetails, setShowInvestorDetails] = useState(false);
  const [configParams, setConfigParams] = useState<ConfigParams>(DEFAULT_CONFIG_PARAMS);
  const [portfolioDependants, setPortfolioDependants] = useState<number>(0);
  const [portfolioDependantsEvents, setPortfolioDependantsEvents] = useState<PortfolioDependantsEvents[]>([]);

  // Handle OAuth callback on mount
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        try {
          await handleAuthCallback(code);
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    };
    handleCallback();
  }, [handleAuthCallback]);

  // Load and enrich portfolios — extracted to avoid duplication
  const loadPortfolios = useCallback(async () => {
    setPortfoliosLoading(true);
    setPortfoliosError(null);
    try {
      const result = await fetchPortfolioList();
      const enrichedPortfolios = await Promise.all(
        result.portfolios.map(async (portfolio) => {
          try {
            const dashboardData = await fetchDashboardDataById(portfolio.id);
            return {
              ...portfolio,
              investors: (dashboardData.investors || []).map(inv => ({ name: inv.name })),
            };
          } catch (err) {
            console.warn(`Failed to fetch investors for portfolio ${portfolio.id}:`, err);
            return portfolio;
          }
        })
      );
      setPortfolios(enrichedPortfolios);
    } catch (err) {
      console.error("Failed to load portfolios:", err);
      setPortfoliosError(err instanceof Error ? err.message : "Failed to load portfolios");
      setPortfolios([]);
    } finally {
      setPortfoliosLoading(false);
    }
  }, []);

  // Load portfolios once authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadPortfolios();
    }
  }, [authLoading, isAuthenticated, loadPortfolios]);

  // Load dashboard data when portfolio selection changes
  useEffect(() => {
    if (!selectedPortfolioId || authLoading || !isAuthenticated) return;

    const load = async () => {
      try {
        setData((prev) => ({ ...prev, loading: true, error: null }));

        const result = await fetchDashboardDataById(selectedPortfolioId);
        setData({
          ...result,
          investmentYears: result.investmentYears || 30,
          executiveSummary: result.executiveSummary || '',
          ourAdvice: result.ourAdvice || '',
          loading: false,
          error: null,
        });

        if (result.investmentYears !== undefined) {
          setInvestmentYears(result.investmentYears);
        }

        const configResult = await fetchConfigParams(selectedPortfolioId);
        if (configResult.portfolioDependants !== undefined) {
          setPortfolioDependants(configResult.portfolioDependants);
        }
        if (configResult.portfolioDependantsEvents) {
          setPortfolioDependantsEvents(configResult.portfolioDependantsEvents);
        }
      } catch (err) {
        setData({
          chartData: [],
          investors: [],
          properties: [],
          investmentYears: 30,
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error occurred",
        });
      }
    };

    load();
  }, [authLoading, selectedPortfolioId, isAuthenticated]);

  // Auto-dismiss update error with progress bar
  useEffect(() => {
    if (!updateError) return;
    setProgress(100);
    const duration = 5000;
    const interval = 50;
    const step = (interval / duration) * 100;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          setUpdateError(null);
          return 0;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [updateError]);

  // Auto-dismiss update success with progress bar
  useEffect(() => {
    if (!updateSuccess) return;
    setProgress(100);
    const duration = 3000;
    const interval = 50;
    const step = (interval / duration) * 100;
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timer);
          setUpdateSuccess(null);
          return 0;
        }
        return next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [updateSuccess]);

  // Apply dark mode class and persist preference in a single effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => setIsDarkMode((prev: boolean) => !prev), []);

  const handleCreatePortfolio = async (name: string) => {
    const newPortfolioId = await createPortfolio(name);
    await loadPortfolios();
    setSelectedPortfolioId(newPortfolioId);
  };

  const handleRenamePortfolio = async (portfolioId: string, newName: string) => {
    await renamePortfolio(portfolioId, newName);
    setPortfolios(prev =>
      prev.map(p => p.id === portfolioId ? { ...p, name: newName } : p)
    );
  };

  const handleUpdate = async (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => {
    try {
      setUpdating(true);
      setUpdateError(null);
      setUpdateSuccess(null);

      await updateDashboardData(investors, properties, investmentYears, '', '', selectedPortfolioId);

      const freshData = await fetchDashboardDataById(selectedPortfolioId);
      setData(prev => ({
        ...prev,
        investors: freshData.investors,
        properties: freshData.properties,
        chartData: freshData.chartData,
        investmentYears: freshData.investmentYears || investmentYears,
        executiveSummary: '',
        ourAdvice: '',
        loading: false,
        error: null,
      }));

      setUpdateSuccess("Data updated successfully!");
      onSuccess?.();
    } catch (err) {
      console.error("Update failed:", err);
      setUpdateError("Update failed. Please try again.");
      onError?.();
    } finally {
      setUpdating(false);
    }
  };

  const handleSwitchPortfolio = useCallback(() => setSelectedPortfolioId(''), []);

  // --- Render: unauthenticated guard (safe to place here after all hooks) ---
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="mb-6">Please log in to access the Platform.</p>
          <button
            onClick={login}
            className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <LogIn size={20} />
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (selectedPortfolioId) {
    if (showInvestorDetails) {
      return (
        <PageLayout header={
          <Header
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onBackToDashboard={() => setShowInvestorDetails(false)}
          />
        }>
          <InvestorDetailsForm
            investors={data.investors}
            onSave={(updatedInvestors) => {
              handleUpdate(updatedInvestors, data.properties, () => {
                setShowInvestorDetails(false);
              }, () => {});
            }}
            onClose={() => setShowInvestorDetails(false)}
          />
        </PageLayout>
      );
    }

    if (showExpensesForm) {
      const totalEssential = data.investors.reduce((sum, inv) => sum + (inv.essential_expenditure || 0), 0);
      const totalNonEssential = data.investors.reduce((sum, inv) => sum + (inv.nonessential_expenditure || 0), 0);

      return (
        <PageLayout header={
          <Header
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onBackToDashboard={() => setShowExpensesForm(false)}
          />
        }>
          <HouseholdExpensesForm
            onSave={(expensesData) => {
              const annualEssential = expensesData.totals.essentialTotal * 12;
              const annualNonEssential = expensesData.totals.nonEssentialTotal * 12;
              const numInv = data.investors.length;
              const updatedInvestors = data.investors.map(inv => ({
                ...inv,
                essential_expenditure: annualEssential / numInv,
                nonessential_expenditure: annualNonEssential / numInv,
              }));
              handleUpdate(updatedInvestors, data.properties, () => {
                setShowExpensesForm(false);
              }, () => {});
            }}
            numInvestors={data.investors.length}
            initialEssentialTotal={totalEssential}
            initialNonEssentialTotal={totalNonEssential}
          />
        </PageLayout>
      );
    }

    return (
      <PageLayout
        contentClassName="flex flex-1 overflow-hidden"
        header={
          <Header
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onSwitchPortfolio={handleSwitchPortfolio}
            onShowExpenses={() => setShowExpensesForm(true)}
            onShowInvestorDetails={() => setShowInvestorDetails(true)}
          />
        }
      >
        {/* Main Error Toast */}
        {data.error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Error Loading Data</h3>
                <p className="text-xs text-red-100 mt-1 line-clamp-2">{data.error}</p>
              </div>
              <button
                onClick={() => setData((prev) => ({ ...prev, error: null }))}
                className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-xs font-medium transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Update Error Toast */}
        {updateError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-3 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{updateError}</p>
              </div>
              <button
                onClick={() => setUpdateError(null)}
                className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {updating && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-slate-800 p-6 rounded-xl shadow-2xl text-center border border-slate-700">
              <div className="animate-spin rounded-full h-12 w-12 border-3 border-slate-600 border-t-cyan-400 mx-auto mb-3"></div>
              <p className="text-white font-medium">Updating...</p>
            </div>
          </div>
        )}

        <Sidebar
          investors={data.investors}
          properties={data.properties}
          chartData={data.chartData}
          loading={data.loading}
          isVisible={sidebarVisible}
          onToggleVisibility={setSidebarVisible}
          onUpdate={handleUpdate}
          selectedPortfolioId={selectedPortfolioId}
          investmentYears={investmentYears}
          onInvestmentYearsChange={setInvestmentYears}
          configParams={configParams}
          onConfigParamsChange={setConfigParams}
          portfolioDependants={portfolioDependants}
          onPortfolioDependantsChange={setPortfolioDependants}
          portfolioDependantsEvents={portfolioDependantsEvents}
          onPortfolioDependantsEventsChange={setPortfolioDependantsEvents}
        />

        <ChartSection
          chartData={data.chartData}
          investors={data.investors}
          loading={data.loading}
          isDarkMode={isDarkMode}
          executiveSummary={data.executiveSummary}
          ourAdvice={data.ourAdvice}
          selectedPortfolioId={selectedPortfolioId}
          onSummaryGenerated={(summary) => {
            setData(prev => ({ ...prev, executiveSummary: summary }));
          }}
          onAdviceGenerated={(advice) => {
            setData(prev => ({ ...prev, ourAdvice: advice }));
          }}
        />
      </PageLayout>
    );
  }

  if (portfolios.length > 0) {
    return (
      <PortfolioSelector
        portfolios={portfolios}
        onSelectPortfolio={setSelectedPortfolioId}
        onRenamePortfolio={handleRenamePortfolio}
        onCreatePortfolio={handleCreatePortfolio}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <EmptyPortfolioState
      onCreatePortfolio={handleCreatePortfolio}
      isDarkMode={isDarkMode}
      isLoading={portfoliosLoading}
      error={portfoliosError}
      onRetry={loadPortfolios}
    />
  );
};

export default Dashboard;
