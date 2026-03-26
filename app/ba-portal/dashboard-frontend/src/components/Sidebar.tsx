/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Sparkles,
  User,
  Building2,
  Settings,
  DollarSign,
  TrendingUp,
  Calendar,
  Percent,
  Wallet,
  CreditCard,
  PieChart,
  Users,
  Settings2,
  Save,
} from "lucide-react";
import { addPropertyWithBaAgent, fetchConfigParams, saveConfigParams } from "../services/dashboardService";
import type { ConfigParams, InvestmentGoals, PortfolioDependantsEvents } from "../services/dashboardService";

// Format number for display in thousands (e.g., 1500000 → "1.5M")
const formatInThousands = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toString();
};

// Parse thousands input back to actual value (e.g., "1.5K" → 1500)
const parseThousandsInput = (input: string): number => {
  const trimmed = input.trim().toUpperCase();
  const num = parseFloat(trimmed);

  if (trimmed.endsWith('M')) {
    return Math.round(num * 1000000);
  } else if (trimmed.endsWith('K')) {
    return Math.round(num * 1000);
  }
  return isNaN(num) ? 0 : Math.round(num * 1000); // Default: assume input is in thousands
};

interface SidebarProps {
  investors: any[];
  properties: any[];
  chartData?: any[];
  loading: boolean;
  isVisible?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
  onUpdate?: (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => Promise<void>;
  selectedPortfolioId?: string;
  // Configuration props
  investmentYears?: number;
  onInvestmentYearsChange?: (years: number) => void;
  configParams?: ConfigParams;
  onConfigParamsChange?: (params: ConfigParams) => void;
  portfolioDependants?: number;
  onPortfolioDependantsChange?: (dependants: number) => void;
  portfolioDependantsEvents?: PortfolioDependantsEvents[];
  onPortfolioDependantsEventsChange?: (events: PortfolioDependantsEvents[]) => void;
}

type ActiveSection = 'investors' | 'properties' | 'configuration';

const Sidebar: React.FC<SidebarProps> = ({
  investors,
  properties,
  chartData,
  loading,
  isVisible = true,
  onToggleVisibility,
  onUpdate,
  selectedPortfolioId,
  // Configuration props
  investmentYears: propInvestmentYears,
  onInvestmentYearsChange,
  configParams: propConfigParams,
  onConfigParamsChange,
  portfolioDependants: propPortfolioDependants,
  onPortfolioDependantsChange,
  portfolioDependantsEvents: propPortfolioDependantsEvents,
  onPortfolioDependantsEventsChange,
}) => {
  const [localVisible, setLocalVisible] = useState(isVisible);
  const [activeSection, setActiveSection] = useState<ActiveSection>('investors');
  const [expandedInvestor, setExpandedInvestor] = useState<string | null>(null);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [localInvestors, setLocalInvestors] = useState<any[]>([]);
  const [originalInvestors, setOriginalInvestors] = useState<any[]>([]);
  const [localProperties, setLocalProperties] = useState<any[]>([]);
  const [originalProperties, setOriginalProperties] = useState<any[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isAddingProperty, setIsAddingProperty] = useState(false);

  // Configuration state
  const [configParams, setConfigParams] = useState<ConfigParams>(propConfigParams || {
    medicareLevyRate: 0.02,
    cpiRate: 0.03,
    accessibleEquityRate: 0.80,
    borrowingPowerMultiplierMin: 3.5,
    borrowingPowerMultiplierBase: 5.0,
    borrowingPowerMultiplierDependantReduction: 0.25,
  });
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoals>({
    goal: '',
    riskTolerance: 'moderate',
  });
  const [portfolioDependants, setPortfolioDependants] = useState<number>(propPortfolioDependants || 0);
  const [portfolioDependantsEvents, setPortfolioDependantsEvents] = useState<PortfolioDependantsEvents[]>(propPortfolioDependantsEvents || []);
  const [localInvestmentYears, setLocalInvestmentYears] = useState<number>(propInvestmentYears || 30);
  const [newDependantEventYear, setNewDependantEventYear] = useState<number>(1);
  const [newDependantEventCount, setNewDependantEventCount] = useState<number>(1);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Get latest property values from chartData (end of investment period)
  const latestPropertyValues = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return {};
    const latestData = chartData[chartData.length - 1];
    return latestData?.property_values || {};
  }, [chartData]);

  // Only reset localInvestors when investors prop changes AND there are no local changes
  useEffect(() => {
    if (!hasLocalChanges) {
      setLocalInvestors(investors);
      setOriginalInvestors(investors);
    }
  }, [investors, hasLocalChanges]);

  // Only reset localProperties when properties change AND there are no local changes
  useEffect(() => {
    if (!hasLocalChanges) {
      setLocalProperties(properties);
      setOriginalProperties(properties);
    }
  }, [properties, hasLocalChanges]);

  // Reset local changes when portfolio changes
  useEffect(() => {
    if (selectedPortfolioId) {
      setHasLocalChanges(false);
      setLocalInvestors(investors);
      setOriginalInvestors(investors);
      setLocalProperties(properties);
      setOriginalProperties(properties);
    }
  }, [selectedPortfolioId, investors, properties]);

  // Sync config params from props
  useEffect(() => {
    if (propConfigParams) {
      setConfigParams(propConfigParams);
    }
  }, [propConfigParams]);

  // Sync portfolio dependants from props
  useEffect(() => {
    if (propPortfolioDependants !== undefined) {
      setPortfolioDependants(propPortfolioDependants);
    }
  }, [propPortfolioDependants]);

  useEffect(() => {
    if (propPortfolioDependantsEvents) {
      setPortfolioDependantsEvents(propPortfolioDependantsEvents);
    }
  }, [propPortfolioDependantsEvents]);

  // Sync investmentYears from prop
  useEffect(() => {
    if (propInvestmentYears) {
      setLocalInvestmentYears(propInvestmentYears);
    }
  }, [propInvestmentYears]);

  // Load config when Configuration tab is active
  const loadConfigFromBackend = async () => {
    if (!selectedPortfolioId) return;
    setIsLoadingConfig(true);
    setConfigError(null);
    try {
      const configData = await fetchConfigParams(selectedPortfolioId);
      setConfigParams(configData.configParams);
      if (configData.investmentYears) {
        setLocalInvestmentYears(configData.investmentYears);
        onInvestmentYearsChange?.(configData.investmentYears);
      }
      if (configData.investmentGoals) {
        setInvestmentGoals(configData.investmentGoals);
      }
      if (configData.portfolioDependants !== undefined) {
        setPortfolioDependants(configData.portfolioDependants);
        onPortfolioDependantsChange?.(configData.portfolioDependants);
      }
      if (configData.portfolioDependantsEvents) {
        setPortfolioDependantsEvents(configData.portfolioDependantsEvents);
        onPortfolioDependantsEventsChange?.(configData.portfolioDependantsEvents);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      setConfigError("Failed to load configuration from server");
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Reset investment goals when portfolio changes (while loading new data)
  useEffect(() => {
    if (selectedPortfolioId) {
      setInvestmentGoals({
        goal: '',
        riskTolerance: 'moderate',
      });
    }
  }, [selectedPortfolioId]);

  // Load config when Configuration tab is active OR when portfolio changes
  useEffect(() => {
    if (activeSection === 'configuration' && selectedPortfolioId) {
      loadConfigFromBackend();
    }
  }, [activeSection, selectedPortfolioId]);

  const handleConfigChange = (field: keyof ConfigParams, value: number) => {
    const updated = { ...configParams, [field]: value };
    setConfigParams(updated);
    onConfigParamsChange?.(updated);
  };

  const handleConfigSave = async () => {
    if (!selectedPortfolioId) return;
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      await saveConfigParams(
        configParams,
        localInvestmentYears,
        investmentGoals,
        portfolioDependants,
        portfolioDependantsEvents,
        selectedPortfolioId
      );
      onConfigParamsChange?.(configParams);
      onPortfolioDependantsChange?.(portfolioDependants);
      onPortfolioDependantsEventsChange?.(portfolioDependantsEvents);
      setConfigSuccess("Configuration saved successfully!");
      setTimeout(() => setConfigSuccess(null), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setConfigError("Failed to save configuration to server");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggle = useCallback(() => {
    const newVisible = !localVisible;
    setLocalVisible(newVisible);
    onToggleVisibility?.(newVisible);
  }, [localVisible, onToggleVisibility]);

  const toggleInvestorExpand = useCallback((investorName: string) => {
    setExpandedInvestor(prev => prev === investorName ? null : investorName);
  }, []);

  const togglePropertyExpand = useCallback((propertyName: string) => {
    setExpandedProperty(prev => prev === propertyName ? null : propertyName);
  }, []);

  const saveToCache = useCallback(() => {
    localStorage.setItem("investors", JSON.stringify(localInvestors));
    localStorage.setItem("properties", JSON.stringify(localProperties));
  }, [localInvestors, localProperties]);

  const updateInvestor = useCallback((index: number, field: string, value: any) => {
    const updated = [...localInvestors];
    updated[index] = { ...updated[index], [field]: value };
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  }, [localInvestors]);

  const addIncomeEvent = useCallback((investorIndex: number) => {
    const updated = [...localInvestors];
    if (!updated[investorIndex].income_events)
      updated[investorIndex].income_events = [];
    updated[investorIndex].income_events.push({
      year: 3,
      amount: 0,
      type: "increase",
    });
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  }, [localInvestors]);

  const updateIncomeEvent = useCallback((
    investorIndex: number,
    eventIndex: number,
    field: string,
    value: any,
  ) => {
    const updated = [...localInvestors];
    updated[investorIndex].income_events[eventIndex] = {
      ...updated[investorIndex].income_events[eventIndex],
      [field]: value,
    };
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  }, [localInvestors]);

  const deleteIncomeEvent = useCallback((investorIndex: number, eventIndex: number) => {
    const updated = [...localInvestors];
    updated[investorIndex].income_events.splice(eventIndex, 1);
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  }, [localInvestors]);

  const deleteInvestor = useCallback((index: number) => {
    const updated = [...localInvestors];
    updated.splice(index, 1);
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  }, [localInvestors]);

  const updateProperty = useCallback((index: number, field: string, value: any) => {
    const updated = [...localProperties];
    updated[index] = { ...updated[index], [field]: value };
    setLocalProperties(updated);
    setHasLocalChanges(true);
  }, [localProperties]);

  const addInvestorSplit = useCallback((propertyIndex: number) => {
    const updated = [...localProperties];
    if (!updated[propertyIndex].investor_splits)
      updated[propertyIndex].investor_splits = [];
    updated[propertyIndex].investor_splits.push({ name: "", percentage: 0 });
    setLocalProperties(updated);
    setHasLocalChanges(true);
  }, [localProperties]);

  const updateInvestorSplit = useCallback((
    propertyIndex: number,
    splitIndex: number,
    field: string,
    value: any,
  ) => {
    const updated = [...localProperties];
    updated[propertyIndex].investor_splits[splitIndex] = {
      ...updated[propertyIndex].investor_splits[splitIndex],
      [field]: value,
    };
    setLocalProperties(updated);
    setHasLocalChanges(true);
  }, [localProperties]);

  const deleteInvestorSplit = useCallback((propertyIndex: number, splitIndex: number) => {
    const updated = [...localProperties];
    updated[propertyIndex].investor_splits.splice(splitIndex, 1);
    setLocalProperties(updated);
    setHasLocalChanges(true);
  }, [localProperties]);

  const deleteProperty = useCallback((index: number) => {
    const updated = [...localProperties];
    updated.splice(index, 1);
    setLocalProperties(updated);
    setHasLocalChanges(true);
  }, [localProperties]);

  const addProperty = useCallback(async () => {
    setIsAddingProperty(true);
    try {
      const newProperty = await addPropertyWithBaAgent(selectedPortfolioId);
      setLocalProperties([...localProperties, newProperty]);
      setHasLocalChanges(true);
    } catch (error) {
      console.error("Error adding property with ba_agent:", error);
      // Fallback to local property creation if API fails
      let fallbackProperty;
      if (localProperties.length > 0) {
        fallbackProperty = JSON.parse(JSON.stringify(localProperties[0]));
        fallbackProperty.name = `Property ${localProperties.length + 1}`;
      } else {
        fallbackProperty = {
          name: "Property 1",
          property_value: 0,
          purchase_year: 0,
          initial_value: 0,
          loan_amount: 0,
          interest_rate: 0,
          rent: 0,
          growth_rate: 0,
          other_expenses: 0,
          annual_principal_change: 0,
          investor_splits: [],
        };
      }
      setLocalProperties([...localProperties, fallbackProperty]);
      setHasLocalChanges(true);
    } finally {
      setIsAddingProperty(false);
    }
  }, [localProperties, selectedPortfolioId]);

  const handleRefresh = useCallback(() => {
    if (onUpdate) {
      onUpdate(
        localInvestors,
        localProperties,
        () => {
          // Success callback
          setOriginalInvestors([...localInvestors]);
          setOriginalProperties([...localProperties]);
          setHasLocalChanges(false);
          saveToCache();
        },
        () => {
          // Error callback - revert to original data
          setLocalInvestors([...originalInvestors]);
          setLocalProperties([...originalProperties]);
        },
      );
    }
  }, [onUpdate, localInvestors, localProperties, originalInvestors, originalProperties, saveToCache]);

  if (!localVisible) {
    return (
      <div 
        className="flex items-center justify-center w-16 p-4" 
        style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)' }}
      >
        <button
          onClick={handleToggle}
          className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors duration-200 flex items-center justify-center"
          title="Show Sidebar"
          aria-label="Show sidebar"
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <aside 
      className="w-80 text-white overflow-y-auto border-r flex flex-col" 
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
      role="navigation"
      aria-label="Dashboard sidebar"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={handleToggle}
          className="w-8 h-8 rounded-lg font-bold transition-colors duration-200 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          title="Hide Sidebar"
          aria-label="Hide sidebar"
        >
          <ChevronsLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-cyan-400">Dashboard</h2>
      </div>

      {/* Section Tabs */}
      <div 
        className="grid grid-cols-2 border-b" 
        style={{ borderColor: 'var(--border-color)' }}
        role="tablist"
        aria-label="Sidebar sections"
      >
        <button
          onClick={() => setActiveSection('investors')}
          className={`flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all duration-300 ${
            activeSection === 'investors'
              ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
          }`}
          role="tab"
          aria-selected={activeSection === 'investors'}
          aria-controls="investors-panel"
          id="investors-tab"
        >
          <Users size={18} />
          <span>Investors</span>
        </button>
        <button
          onClick={() => setActiveSection('properties')}
          className={`flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all duration-300 ${
            activeSection === 'properties'
              ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
          }`}
          role="tab"
          aria-selected={activeSection === 'properties'}
          aria-controls="properties-panel"
          id="properties-tab"
        >
          <Building2 size={18} />
          <span>Properties</span>
        </button>
        <button
          onClick={() => setActiveSection('configuration')}
          className={`flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-all duration-300 ${
            activeSection === 'configuration'
              ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
          }`}
          role="tab"
          aria-selected={activeSection === 'configuration'}
          aria-controls="configuration-panel"
          id="configuration-tab"
        >
          <Settings2 size={18} />
          <span>Config</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            {/* Investors Section */}
            {activeSection === 'investors' && (
              <div 
                id="investors-panel"
                role="tabpanel"
                aria-labelledby="investors-tab"
                className="animate-in fade-in duration-300"
              >
                {!investors || investors.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <User size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No investor data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {localInvestors.map((investor: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-lg p-4 hover:opacity-90 transition-all duration-300 border"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <User size={20} className="text-cyan-400" />
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={investor?.name || ""}
                                onChange={(e) =>
                                  updateInvestor(index, "name", e.target.value)
                                }
                                disabled={investor?.name === "Bob" || investor?.name === "Alice"}
                                className="bg-slate-600 text-white rounded px-2 py-1 w-full disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                                aria-label="Investor name"
                              />
                              <p className="text-xs text-gray-400 mt-1">Investor</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteInvestor(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Delete Investor"
                              aria-label="Delete investor"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <DollarSign size={14} className="text-gray-400" />
                              <span>Base Income:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(investor?.base_income || 0)}
                              onChange={(e) =>
                                updateInvestor(
                                  index,
                                  "base_income",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right text-xs"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Base income"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={14} className="text-gray-400" />
                              <span>Growth Rate:</span>
                            </div>
                            <input
                              type="number"
                              value={investor?.annual_growth_rate || 0}
                              onChange={(e) =>
                                updateInvestor(
                                  index,
                                  "annual_growth_rate",
                                  parseFloat(e.target.value),
                                )
                              }
                              className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right text-xs"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Annual growth rate"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Wallet size={14} className="text-gray-400" />
                              <span>Essential Expenditure:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(investor?.essential_expenditure || 0)}
                              onChange={(e) =>
                                updateInvestor(
                                  index,
                                  "essential_expenditure",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right text-xs"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Essential expenditure"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <CreditCard size={14} className="text-gray-400" />
                              <span>Nonessential Expenditure:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(investor?.nonessential_expenditure || 0)}
                              onChange={(e) =>
                                updateInvestor(
                                  index,
                                  "nonessential_expenditure",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right text-xs"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Nonessential expenditure"
                            />
                          </div>
                        </div>

                        {/* Income Events Dropdown */}
                        {investor?.income_events &&
                          investor.income_events.length > 0 && (
                            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <div className="flex items-center justify-between mb-2">
                                <button
                                  onClick={() =>
                                    toggleInvestorExpand(investor?.name || "")
                                  }
                                  className="flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex-1"
                                  aria-expanded={expandedInvestor === investor?.name}
                                  aria-controls={`income-events-${index}`}
                                >
                                  <span>Income Events</span>
                                  <span className="transition-transform duration-300">
                                    {expandedInvestor === investor?.name ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </span>
                                </button>
                                <button
                                  onClick={() => addIncomeEvent(index)}
                                  className="text-green-400 hover:text-green-300 ml-2 transition-colors"
                                  title="Add Income Event"
                                  aria-label="Add income event"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                              <div
                                id={`income-events-${index}`}
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                  expandedInvestor === investor?.name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                                }`}
                              >
                                <div className="space-y-2 mt-2">
                                  {investor.income_events.map(
                                    (event: any, eIdx: number) => (
                                      <div
                                        key={eIdx}
                                        className="rounded p-2 text-xs flex justify-between items-center"
                                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                                      >
                                        <div className="flex-1">
                                          <div className="space-y-1">
                                            <div className="flex gap-2 items-center">
                                              <Calendar size={12} className="text-gray-400" />
                                              <label className="text-gray-300">
                                                Year:
                                              </label>
                                              <input
                                                type="number"
                                                value={event.year || 0}
                                                onChange={(e) =>
                                                  updateIncomeEvent(
                                                    index,
                                                    eIdx,
                                                    "year",
                                                    parseInt(e.target.value),
                                                  )
                                                }
                                                className="bg-slate-500 text-white rounded px-1 py-0 w-16 text-xs"
                                                aria-label="Income event year"
                                              />
                                            </div>
                                            <div className="flex gap-2 items-center">
                                              <DollarSign size={12} className="text-gray-400" />
                                              <label className="text-gray-300">
                                                Amount:
                                              </label>
                                              <input
                                                type="text"
                                                value={formatInThousands(event.amount || 0)}
                                                onChange={(e) =>
                                                  updateIncomeEvent(
                                                    index,
                                                    eIdx,
                                                    "amount",
                                                    parseThousandsInput(e.target.value),
                                                  )
                                                }
                                                className="bg-slate-500 text-white rounded px-1 py-0 w-20 text-xs"
                                                aria-label="Income event amount"
                                              />
                                            </div>
                                            <div className="flex gap-2 items-center">
                                              <Settings size={12} className="text-gray-400" />
                                              <label className="text-gray-300">
                                                Type:
                                              </label>
                                              <select
                                                value={event.type || "increase"}
                                                onChange={(e) =>
                                                  updateIncomeEvent(
                                                    index,
                                                    eIdx,
                                                    "type",
                                                    e.target.value,
                                                  )
                                                }
                                                className="bg-slate-500 text-white rounded px-1 py-0 text-xs"
                                                aria-label="Income event type"
                                              >
                                                <option value="increase">
                                                  Increase
                                                </option>
                                                <option value="set">
                                                  Set
                                                </option>
                                              </select>
                                            </div>
                                          </div>
                                        </div>
                                        <button
                                          onClick={() =>
                                            deleteIncomeEvent(index, eIdx)
                                          }
                                          className="text-red-400 hover:text-red-300 ml-2 transition-colors"
                                          title="Delete Income Event"
                                          aria-label="Delete income event"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        {!(investor?.income_events && investor.income_events.length > 0) && (
                          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                            <button
                              onClick={() => addIncomeEvent(index)}
                              className="text-green-400 hover:text-green-300 flex items-center gap-1 text-xs transition-colors"
                              aria-label="Add income event"
                            >
                              <Plus size={14} /> Add Income Event
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Properties Section */}
            {activeSection === 'properties' && (
              <div 
                id="properties-panel"
                role="tabpanel"
                aria-labelledby="properties-tab"
                className="animate-in fade-in duration-300"
              >
                {localProperties.length === 0 ? (
                  <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                    <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No property data available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {localProperties.map((prop: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-lg p-4 border hover:border-cyan-500 transition-all duration-300"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={prop?.name || ""}
                              onChange={(e) =>
                                updateProperty(index, "name", e.target.value)
                              }
                              className="rounded px-2 py-1 w-full text-xs uppercase font-semibold mb-1"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              placeholder="Property Name"
                              aria-label="Property name"
                            />
                            <span
                              className="rounded px-2 py-1 w-full text-2xl font-bold block"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                              ${(latestPropertyValues[prop?.name] ?? prop?.property_value ?? 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteProperty(index)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Delete Property"
                              aria-label="Delete property"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs border-t pt-3" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-gray-400" />
                              <span>Purchase Year:</span>
                            </div>
                            <input
                              type="number"
                              value={prop?.purchase_year || 0}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "purchase_year",
                                  parseInt(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-16 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Purchase year"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <DollarSign size={12} className="text-gray-400" />
                              <span>Initial Value:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(prop?.initial_value || 0)}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "initial_value",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-20 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Initial value"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <CreditCard size={12} className="text-gray-400" />
                              <span>Loan Amount:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(prop?.loan_amount || 0)}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "loan_amount",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-20 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Loan amount"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Percent size={12} className="text-gray-400" />
                              <span>Interest Rate:</span>
                            </div>
                            <input
                              type="number"
                              value={prop?.interest_rate || 0}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "interest_rate",
                                  parseFloat(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-16 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Interest rate"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <DollarSign size={12} className="text-gray-400" />
                              <span>Annual Rent:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(prop?.rent || 0)}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "rent",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-20 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Annual rent"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={12} className="text-gray-400" />
                              <span>Growth Rate:</span>
                            </div>
                            <input
                              type="number"
                              value={prop?.growth_rate || 0}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "growth_rate",
                                  parseFloat(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-16 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Growth rate"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Wallet size={12} className="text-gray-400" />
                              <span>Other Expenses:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(prop?.other_expenses || 0)}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "other_expenses",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-20 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Other expenses"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <PieChart size={12} className="text-gray-400" />
                              <span>Annual Principal Change:</span>
                            </div>
                            <input
                              type="text"
                              value={formatInThousands(prop?.annual_principal_change || 0)}
                              onChange={(e) =>
                                updateProperty(
                                  index,
                                  "annual_principal_change",
                                  parseThousandsInput(e.target.value),
                                )
                              }
                              className="rounded px-1 py-0 w-20 text-xs text-right"
                              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                              aria-label="Annual principal change"
                            />
                          </div>
                        </div>

                        {/* Investor Splits Dropdown */}
                        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => togglePropertyExpand(prop?.name || "")}
                              className="flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex-1"
                              aria-expanded={expandedProperty === prop?.name}
                              aria-controls={`investor-splits-${index}`}
                            >
                              <span>Investor Splits</span>
                              <span className="transition-transform duration-300">
                                {expandedProperty === prop?.name ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </span>
                            </button>
                            <button
                              onClick={() => addInvestorSplit(index)}
                              className="text-green-400 hover:text-green-300 ml-2 transition-colors"
                              title="Add Investor Split"
                              aria-label="Add investor split"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <div
                            id={`investor-splits-${index}`}
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              expandedProperty === prop?.name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                            }`}
                          >
                            <div className="mt-3 space-y-2">
                              {prop.investor_splits && prop.investor_splits.length > 0 ? (
                                prop.investor_splits.map((split: any, sIdx: number) => (
                                  <div
                                    key={sIdx}
                                    className="rounded p-2 text-xs flex justify-between items-center"
                                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                                  >
                                    <div className="flex-1">
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="text"
                                          value={split.name || ""}
                                          onChange={(e) =>
                                            updateInvestorSplit(
                                              index,
                                              sIdx,
                                              "name",
                                              e.target.value,
                                            )
                                          }
                                          className="rounded px-1 py-0 flex-1 text-xs"
                                          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                          placeholder="Investor Name"
                                          aria-label="Investor split name"
                                        />
                                        <input
                                          type="number"
                                          value={split.percentage || 0}
                                          onChange={(e) =>
                                            updateInvestorSplit(
                                              index,
                                              sIdx,
                                              "percentage",
                                              parseFloat(e.target.value),
                                            )
                                          }
                                          className="rounded px-1 py-0 w-16 text-xs text-right"
                                          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                          placeholder="%"
                                          aria-label="Investor split percentage"
                                        />
                                        <span style={{ color: 'var(--text-primary)' }}>%</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => deleteInvestorSplit(index, sIdx)}
                                      className="text-red-400 hover:text-red-300 ml-2 transition-colors"
                                      title="Delete Investor Split"
                                      aria-label="Delete investor split"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                  No investor splits available
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Property Button */}
                <button
                  onClick={addProperty}
                  disabled={isAddingProperty}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded mt-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  aria-label="Add property"
                >
                  {isAddingProperty ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isAddingProperty ? "Adding Property..." : "Add Property"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Configuration Section */}
      {activeSection === 'configuration' && (
        <div 
          id="configuration-panel"
          role="tabpanel"
          aria-labelledby="configuration-tab"
          className="animate-in fade-in duration-300 p-4"
        >
          <div className="space-y-4">
            {/* Loading/Error/Success Messages */}
            {isLoadingConfig && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 size={16} className="animate-spin" />
                Loading configuration...
              </div>
            )}
            {configError && (
              <div className="text-sm px-3 py-2 rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                {configError}
              </div>
            )}
            {configSuccess && (
              <div className="text-sm px-3 py-2 rounded" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                {configSuccess}
              </div>
            )}

            {/* Section 1: Investment Profile */}
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
              <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <TrendingUp size={16} />
                Investment Profile
              </h3>
              <div className="space-y-4">
                {/* Investment Years */}
                <div>
                  <label className="text-xs text-cyan-400 block mb-1">Years to Invest</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={localInvestmentYears || 30}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || 30;
                        setLocalInvestmentYears(newValue);
                        onInvestmentYearsChange?.(newValue);
                      }}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>yrs</span>
                  </div>
                </div>

                {/* Investment Goals */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <label className="text-xs text-cyan-400 block mb-2 font-semibold">Investment Goal</label>
                  <div className="space-y-2">
                    <select
                      value={investmentGoals.goal}
                      onChange={(e) => setInvestmentGoals({ ...investmentGoals, goal: e.target.value })}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    >
                      <option value="">Select a goal...</option>
                      {["Passive Income", "Capital Growth", "Tax Benefits", "Wealth Accumulation", "Retirement Planning", "Lifestyle & Personal Use"].map((goal) => (
                        <option key={goal} value={goal}>{goal}</option>
                      ))}
                    </select>
                    <div>
                      <label className="text-xs text-cyan-400 block mb-1">Risk Tolerance</label>
                      <select
                        value={investmentGoals.riskTolerance}
                        onChange={(e) => setInvestmentGoals({ ...investmentGoals, riskTolerance: e.target.value as 'conservative' | 'moderate' | 'aggressive' })}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                      >
                        <option value="conservative">Conservative</option>
                        <option value="moderate">Moderate</option>
                        <option value="aggressive">Aggressive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Portfolio Dependants */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <label className="text-xs text-cyan-400 block mb-1 font-semibold">Portfolio Dependants</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={portfolioDependants}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0;
                      setPortfolioDependants(newValue);
                      onPortfolioDependantsChange?.(newValue);
                    }}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                  />
                </div>

                {/* Dependant Events */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <label className="text-xs text-cyan-400 block mb-2 font-semibold">Dependant Events (Future Changes)</label>
                  
                  {/* Add new event */}
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Year</label>
                      <input
                        type="number"
                        min="1"
                        value={newDependantEventYear}
                        onChange={(e) => setNewDependantEventYear(parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Dependants</label>
                      <input
                        type="number"
                        min="0"
                        value={newDependantEventCount}
                        onChange={(e) => setNewDependantEventCount(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newEvents = [...portfolioDependantsEvents, { year: newDependantEventYear, dependants: newDependantEventCount }];
                        newEvents.sort((a, b) => a.year - b.year);
                        setPortfolioDependantsEvents(newEvents);
                        onPortfolioDependantsEventsChange?.(newEvents);
                        setNewDependantEventYear(1);
                        setNewDependantEventCount(1);
                      }}
                      className="mt-4 px-2 py-1 bg-cyan-500 text-white text-xs rounded hover:bg-cyan-600"
                    >
                      Add
                    </button>
                  </div>

                  {/* Existing events list */}
                  {portfolioDependantsEvents.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {portfolioDependantsEvents.map((event, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: 'var(--bg-secondary)' }}
                        >
                          <span style={{ color: 'var(--text-primary)' }}>
                            Year {event.year}: {event.dependants} dependant{event.dependants !== 1 ? 's' : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newEvents = portfolioDependantsEvents.filter((_, i) => i !== index);
                              setPortfolioDependantsEvents(newEvents);
                              onPortfolioDependantsEventsChange?.(newEvents);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Advanced Settings (Collapsible) */}
            <div className="rounded-lg border" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
              {/* Collapsible Header */}
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="w-full flex items-center justify-between p-4 text-sm font-bold text-cyan-400 hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings size={16} />
                  Advanced Settings
                </span>
                {showAdvancedSettings ? (
                  <ChevronUp size={18} className="transition-transform duration-300" />
                ) : (
                  <ChevronDown size={18} className="transition-transform duration-300" />
                )}
              </button>

              {/* Collapsible Content */}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  showAdvancedSettings ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-4 pb-4 space-y-4">
                  {/* Medicare Levy Rate */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">Medicare Levy Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={configParams.medicareLevyRate}
                      onChange={(e) => handleConfigChange('medicareLevyRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>

                  {/* CPI Rate */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">CPI Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={configParams.cpiRate}
                      onChange={(e) => handleConfigChange('cpiRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>

                  {/* Accessible Equity Rate */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">Accessible Equity Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={configParams.accessibleEquityRate}
                      onChange={(e) => handleConfigChange('accessibleEquityRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>

                  {/* Borrowing Power Min */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">Borrowing Power Min</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={configParams.borrowingPowerMultiplierMin}
                      onChange={(e) => handleConfigChange('borrowingPowerMultiplierMin', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>

                  {/* Borrowing Power Base */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">Borrowing Power Base</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={configParams.borrowingPowerMultiplierBase}
                      onChange={(e) => handleConfigChange('borrowingPowerMultiplierBase', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>

                  {/* Dependant Reduction */}
                  <div>
                    <label className="text-xs text-cyan-400 block mb-1">Dependant Reduction</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={configParams.borrowingPowerMultiplierDependantReduction}
                      onChange={(e) => handleConfigChange('borrowingPowerMultiplierDependantReduction', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)', borderWidth: '1px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleConfigSave}
              disabled={isSavingConfig || isLoadingConfig}
              className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-300 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              {isSavingConfig ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Footer with Refresh Button */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
        <button
          onClick={handleRefresh}
          className="flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded transition-colors font-medium w-full"
          aria-label="Refresh data"
        >
          <Upload size={16} />
          Refresh Data
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
