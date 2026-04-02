/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import { X, AlertCircle, RefreshCw, LogIn } from "lucide-react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ChartSection from "./ChartSection";
import Footer from "./Footer";
import PortfolioSelector from "./PortfolioSelector";
import {
  fetchDashboardDataById,
  fetchPortfolioList,
  fetchConfigParams,
  updateDashboardData,
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

const Dashboard: React.FC = () => {
  const { handleAuthCallback, isLoading: authLoading, isAuthenticated, login } = useAuth();

  // Render login prompt for unauthenticated users
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
  
  // Portfolio state
  const [portfolios, setPortfolios] = useState<PortfolioInfo[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);
  const [investmentYears, setInvestmentYears] = useState(30);
  const [configParams, setConfigParams] = useState<ConfigParams>({
    medicareLevyRate: 0.02,
    cpiRate: 0.03,
    accessibleEquityRate: 0.80,
    borrowingPowerMultiplierMin: 3.5,
    borrowingPowerMultiplierBase: 5.0,
    borrowingPowerMultiplierDependantReduction: 0.25,
  });
  
  // Portfolio-level dependants state
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
          // Clear the URL parameters after successful auth
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    };
    
    handleCallback();
  }, [handleAuthCallback]);

  // Load portfolios on mount
  useEffect(() => {
    const loadPortfolios = async () => {
      try {
        const result = await fetchPortfolioList();
        setPortfolios(result.portfolios);
      } catch (err) {
        console.error("Failed to load portfolios:", err);
        // Fallback to default ID if available
        const defaultId = import.meta.env.VITE_REACT_APP_APPSYNC_FINANCE_ID;
        if (defaultId) {
          setSelectedPortfolioId(defaultId);
        }
      }
    };

    if (!authLoading && isAuthenticated) {
      loadPortfolios();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const load = async () => {
      // Don't load until we have a selected portfolio
      if (!selectedPortfolioId) return;
      
      // Don't load if not authenticated
      if (!isAuthenticated) {
        return;
      }
      
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

        // Update local state if investmentYears exists in response
        if (result.investmentYears !== undefined) {
          setInvestmentYears(result.investmentYears);
        }
        
        // Load portfolio-level dependants from config
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

    // Only load data if auth is not loading and we have a selected portfolio
    if (!authLoading && selectedPortfolioId && isAuthenticated) {
      load();
    }
  }, [authLoading, selectedPortfolioId, isAuthenticated]);

  // Auto-dismiss update error with progress bar
  useEffect(() => {
    if (updateError) {
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
    }
  }, [updateError]);

  // Auto-dismiss update success with progress bar
  useEffect(() => {
    if (updateSuccess) {
      setProgress(100);
      const duration = 3000; // Shorter duration for success messages
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
    }
  }, [updateSuccess]);

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
      
      // Don't pass chart1 - let the Lambda calculate it fresh from investors/properties
      await updateDashboardData(investors, properties, investmentYears, '', '', selectedPortfolioId);
      
      // Fetch fresh data from DynamoDB after update (includes newly calculated chart1)
      const freshData = await fetchDashboardDataById(selectedPortfolioId);
      
      // Update local state with fresh data from DynamoDB
      setData(prev => ({
        ...prev,
        investors: freshData.investors,
        properties: freshData.properties,
        chartData: freshData.chartData,
        investmentYears: freshData.investmentYears || investmentYears,
        executiveSummary: '',  // Clear summary - needs regeneration
        ourAdvice: '',  // Clear advice - needs regeneration
        loading: false,
        error: null,
      }));
      
      setUpdateSuccess("Data updated successfully!");
      onSuccess?.();
    } catch (err) {
      console.log("Error message:", err);
      setUpdateError("Update failed. Please try again.");
      onError?.();
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleSwitchPortfolio = () => {
    setSelectedPortfolioId('');
  };

  if (selectedPortfolioId) {
    return (
      <div className="flex flex-col h-screen transition-colors duration-300 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <Header
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          onSwitchPortfolio={handleSwitchPortfolio}
        />
        <div className="flex flex-1 overflow-hidden">
        {/* Main Error Toast */}
        {data.error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-xl z-50 w-100 animate-in slide-in-from-top-2 fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Error Loading Data</h3>
                <p className="text-xs text-red-100 mt-1 line-clamp-2">
                  {data.error}
                </p>
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

            {/* Progress bar */}
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
          loading={data.loading}
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
        </div>
        <Footer />
      </div>
    );
  } else if (portfolios.length > 0) {
    return <PortfolioSelector portfolios={portfolios} onSelectPortfolio={setSelectedPortfolioId} isDarkMode={isDarkMode} />;
  } else {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <p>Loading portfolios...</p>
      </div>
    );
  }
};

export default Dashboard;
