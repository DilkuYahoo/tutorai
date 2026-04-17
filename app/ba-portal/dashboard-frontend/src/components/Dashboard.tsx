/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from "react";
import { X, AlertCircle, RefreshCw, LogIn, AlertTriangle } from "lucide-react";
import Header from "./Header";
import NavigationPanel, { type ModalTarget } from "./NavigationPanel";
import Modal from "./ui/Modal";
import InvestorPanel from "./panels/InvestorPanel";
import PropertyPanel from "./panels/PropertyPanel";
import ConfigurationPanel from "./panels/ConfigurationPanel";
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
  addPropertyWithBaAgent,
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

const PROPERTY_WORDS = [
  'Oakwood', 'Maple', 'Pine', 'Cedar', 'Elm', 'Birch', 'Spruce', 'Willow', 'Aspen', 'Poplar',
  'Chestnut', 'Hazel', 'Beech', 'Sycamore', 'Alder', 'Rowan', 'Hawthorn', 'Holly', 'Ivy', 'Fern',
  'Thistle', 'Bramble', 'Heather', 'Gorse', 'Briar', 'Vine', 'Reed', 'Rush', 'Moss', 'Lichen',
  'Stone', 'Rock', 'Hill', 'Dale', 'Glen', 'Vale', 'Ridge', 'Peak', 'Summit', 'Crest',
  'Brook', 'Stream', 'River', 'Lake', 'Pond', 'Spring', 'Well', 'Fountain', 'Cascade', 'Waterfall',
  'Sky', 'Cloud', 'Storm', 'Rain', 'Sun', 'Moon', 'Star', 'Dawn', 'Dusk', 'Night',
  'Forest', 'Wood', 'Grove', 'Thicket', 'Clearing', 'Meadow', 'Field', 'Pasture', 'Prairie', 'Savannah',
  'Mountain', 'Valley', 'Canyon', 'Gorge', 'Cliff', 'Crag', 'Boulder', 'Slate', 'Quartz', 'Granite'
];

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
  const [activeModal, setActiveModal] = useState<ModalTarget | null>(null);
  const [pendingProperty, setPendingProperty] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(100);
  const [investmentYears, setInvestmentYears] = useState(30);
  const [configParams, setConfigParams] = useState<ConfigParams>(DEFAULT_CONFIG_PARAMS);
  const [portfolioDependants, setPortfolioDependants] = useState<number>(0);
  const [portfolioDependantsEvents, setPortfolioDependantsEvents] = useState<PortfolioDependantsEvents[]>([]);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);

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

  const syncSplitNames = (updatedInvestors: any[], properties: any[]): any[] => {
    const nameMap: Record<string, string> = {};
    data.investors.forEach((old: any, i: number) => {
      const next = updatedInvestors[i];
      if (next && old.name && next.name && old.name !== next.name) {
        nameMap[old.name] = next.name;
      }
    });
    if (Object.keys(nameMap).length === 0) return properties;
    return properties.map((prop: any) => ({
      ...prop,
      investor_splits: (prop.investor_splits || []).map((s: any) =>
        nameMap[s.name] ? { ...s, name: nameMap[s.name] } : s
      ),
    }));
  };

  const handleUpdate = async (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => {
    const syncedProperties = syncSplitNames(investors, properties);
    try {
      setUpdating(true);
      setUpdateError(null);
      setUpdateSuccess(null);

      await updateDashboardData(investors, syncedProperties, investmentYears, '', '', selectedPortfolioId);

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

  const calculateEqualSplits = useCallback((investors: any[]) => {
    if (investors.length === 1) {
      return [{ name: investors[0].name, percentage: 100 }];
    }
    const basePercentage = Math.floor(100 / investors.length);
    const remainder = 100 - basePercentage * investors.length;
    return investors.map((investor: any, index: number) => ({
      name: investor.name,
      percentage: index === 0 ? basePercentage + remainder : basePercentage,
    }));
  }, []);

  const generatePropertyId = useCallback(() => {
    const existing = new Set([
      ...data.properties.map((p: any) => p.name),
      ...(pendingProperty ? [pendingProperty.name] : []),
    ]);
    let id: string;
    do {
      id = PROPERTY_WORDS[Math.floor(Math.random() * PROPERTY_WORDS.length)];
    } while (existing.has(id));
    return id;
  }, [data.properties, pendingProperty]);

  const handleAddProperty = useCallback(async () => {
    const defaultSplits = calculateEqualSplits(data.investors);
    const propertyName = generatePropertyId();
    let newProperty: any;
    try {
      newProperty = await addPropertyWithBaAgent(selectedPortfolioId);
      newProperty.name = propertyName;
      newProperty.investor_splits = defaultSplits;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate a property recommendation at this time. Please try again.";
      setErrorModal({ title: "Property Recommendation", message });
      return;
    }
    setPendingProperty(newProperty);
    setActiveModal({ type: 'property', index: data.properties.length });
  }, [selectedPortfolioId, data.investors, data.properties, pendingProperty, calculateEqualSplits, generatePropertyId]);

  // --- Render: unauthenticated guard (safe to place here after all hooks) ---
  if (!authLoading && !isAuthenticated) {
    return (
      <PageLayout header={<Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>Please log in to access the Platform.</p>
            <button
              onClick={login}
              className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <LogIn size={20} />
              Log In
            </button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Helper: get modal title
  const getModalTitle = (target: ModalTarget): string => {
    if (target.type === 'investor') return data.investors[target.index]?.name || `Investor ${target.index + 1}`;
    if (target.type === 'property') return data.properties[target.index]?.name || `Property ${target.index + 1}`;
    if (target.type === 'configuration') return 'Portfolio Settings';
    if (target.type === 'householdExpenses') return 'Household Expenses';
    if (target.type === 'investorDetails') return 'Investor Details';
    return '';
  };

  if (selectedPortfolioId) {
    return (
      <PageLayout
        contentClassName="flex flex-1 overflow-hidden"
        header={
          <Header
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            onSwitchPortfolio={handleSwitchPortfolio}
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

        {/* Modal overlay */}
        {activeModal && (
          <Modal
            isOpen={true}
            onClose={() => setActiveModal(null)}
            title={getModalTitle(activeModal)}
          >
            {activeModal.type === 'investor' && (
              <InvestorPanel
                index={activeModal.index}
                investors={data.investors}
                properties={data.properties}
                selectedPortfolioId={selectedPortfolioId}
                onUpdate={handleUpdate}
                onClose={() => setActiveModal(null)}
              />
            )}
            {activeModal.type === 'property' && (
              <PropertyPanel
                index={activeModal.index}
                properties={pendingProperty ? [...data.properties, pendingProperty] : data.properties}
                investors={data.investors}
                chartData={data.chartData}
                selectedPortfolioId={selectedPortfolioId}
                isPending={!!pendingProperty}
                onUpdate={(investors, properties, onSuccess, onError) => {
                  setPendingProperty(null);
                  return handleUpdate(investors, properties, onSuccess, onError);
                }}
                onClose={() => { setPendingProperty(null); setActiveModal(null); }}
              />
            )}
            {activeModal.type === 'configuration' && (
              <ConfigurationPanel
                selectedPortfolioId={selectedPortfolioId}
                investmentYears={investmentYears}
                onInvestmentYearsChange={setInvestmentYears}
                configParams={configParams}
                onConfigParamsChange={setConfigParams}
                portfolioDependants={portfolioDependants}
                onPortfolioDependantsChange={setPortfolioDependants}
                portfolioDependantsEvents={portfolioDependantsEvents}
                onPortfolioDependantsEventsChange={setPortfolioDependantsEvents}
                onClose={() => setActiveModal(null)}
              />
            )}
            {activeModal.type === 'householdExpenses' && (
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
                    setActiveModal(null);
                  }, () => {});
                }}
                numInvestors={data.investors.length}
                initialEssentialTotal={data.investors.reduce((sum, inv) => sum + (inv.essential_expenditure || 0), 0)}
                initialNonEssentialTotal={data.investors.reduce((sum, inv) => sum + (inv.nonessential_expenditure || 0), 0)}
              />
            )}
            {activeModal.type === 'investorDetails' && (
              <InvestorDetailsForm
                investors={data.investors}
                onSave={(updatedInvestors) => {
                  handleUpdate(updatedInvestors, data.properties, () => {
                    setActiveModal(null);
                  }, () => {});
                }}
                onClose={() => setActiveModal(null)}
              />
            )}
          </Modal>
        )}

        {/* Error modal */}
        {errorModal && (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setErrorModal(null)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border shadow-2xl ring-1 ring-white/5 overflow-hidden"
              style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  {errorModal.title}
                </span>
                <button
                  onClick={() => setErrorModal(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={15} />
                </button>
              </div>
              {/* Body */}
              <div className="p-5">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={18} className="text-amber-400" />
                  </div>
                  <p className="text-sm leading-relaxed pt-1.5" style={{ color: 'var(--text-primary)' }}>
                    {errorModal.message}
                  </p>
                </div>
              </div>
              {/* Footer */}
              <div className="px-5 pb-5 flex justify-end">
                <button
                  onClick={() => setErrorModal(null)}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        <NavigationPanel
          investors={data.investors}
          properties={data.properties}
          isVisible={sidebarVisible}
          onToggleVisibility={setSidebarVisible}
          onOpenModal={setActiveModal}
          activeModal={activeModal}
          onAddProperty={handleAddProperty}
          onReorderProperties={(reordered) => handleUpdate(data.investors, reordered)}
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
      <PageLayout header={<Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}>
        <PortfolioSelector
          portfolios={portfolios}
          onSelectPortfolio={setSelectedPortfolioId}
          onRenamePortfolio={handleRenamePortfolio}
          onCreatePortfolio={handleCreatePortfolio}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout header={<Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}>
      <EmptyPortfolioState
        onCreatePortfolio={handleCreatePortfolio}
        isLoading={portfoliosLoading}
        error={portfoliosError}
        onRetry={loadPortfolios}
      />
    </PageLayout>
  );
};

export default Dashboard;
