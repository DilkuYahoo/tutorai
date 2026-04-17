import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Settings,
  TrendingUp,
} from "lucide-react";
import {
  fetchConfigParams,
  saveConfigParams,
  type ConfigParams,
  type InvestmentGoals,
  type PortfolioDependantsEvents,
} from "../../services/dashboardService";

interface ConfigurationPanelProps {
  selectedPortfolioId?: string;
  investmentYears?: number;
  onInvestmentYearsChange?: (years: number) => void;
  configParams?: ConfigParams;
  onConfigParamsChange?: (params: ConfigParams) => void;
  portfolioDependants?: number;
  onPortfolioDependantsChange?: (dependants: number) => void;
  portfolioDependantsEvents?: PortfolioDependantsEvents[];
  onPortfolioDependantsEventsChange?: (events: PortfolioDependantsEvents[]) => void;
  onClose?: () => void;
}

const DEFAULT_CONFIG: ConfigParams = {
  medicareLevyRate: 0.02,
  cpiRate: 0.03,
  accessibleEquityRate: 0.80,
  borrowingPowerMultiplierMin: 3.5,
  borrowingPowerMultiplierBase: 5.0,
  borrowingPowerMultiplierDependantReduction: 0.25,
};

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  selectedPortfolioId,
  investmentYears: propInvestmentYears,
  onInvestmentYearsChange,
  configParams: propConfigParams,
  onConfigParamsChange,
  portfolioDependants: propPortfolioDependants,
  onPortfolioDependantsChange,
  portfolioDependantsEvents: propPortfolioDependantsEvents,
  onPortfolioDependantsEventsChange,
  onClose,
}) => {
  const [configParams, setConfigParams] = useState<ConfigParams>(propConfigParams || DEFAULT_CONFIG);
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoals>({ goal: 'Passive Income', riskTolerance: 'moderate' });
  const [portfolioDependants, setPortfolioDependants] = useState<number>(propPortfolioDependants || 0);
  const [portfolioDependantsEvents, setPortfolioDependantsEvents] = useState<PortfolioDependantsEvents[]>(propPortfolioDependantsEvents || []);
  const [localInvestmentYears, setLocalInvestmentYears] = useState<number>(propInvestmentYears || 30);
  const [newDependantEventYear, setNewDependantEventYear] = useState<number>(1);
  const [newDependantEventCount, setNewDependantEventCount] = useState<number>(1);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Load config from backend on mount
  useEffect(() => {
    if (!selectedPortfolioId) return;
    const load = async () => {
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
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolioId]);

  const handleConfigChange = (field: keyof ConfigParams, value: number) => {
    const updated = { ...configParams, [field]: value };
    setConfigParams(updated);
    onConfigParamsChange?.(updated);
  };

  const handleConfigSave = async () => {
    if (!selectedPortfolioId) return;
    setIsSavingConfig(true);
    setConfigError(null);

    try {
      await saveConfigParams(
        configParams,
        localInvestmentYears,
        investmentGoals,
        portfolioDependants,
        portfolioDependantsEvents,
        selectedPortfolioId,
      );
      onConfigParamsChange?.(configParams);
      onPortfolioDependantsChange?.(portfolioDependants);
      onPortfolioDependantsEventsChange?.(portfolioDependantsEvents);
      onClose?.();
    } catch (error) {
      console.error("Failed to save config:", error);
      setConfigError("Failed to save configuration to server");
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status messages */}
      {isLoadingConfig && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
          <Loader2 size={16} className="animate-spin" />
          Loading configuration...
        </div>
      )}
      {configError && (
        <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
          {configError}
        </div>
      )}

      {/* Investment Profile */}
      <div className="rounded-lg p-4 border" style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}>
        <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
          <TrendingUp size={16} />
          Investment Profile
        </h3>
        <div className="space-y-4">
          {/* Investment Years */}
          <div>
            <label className="text-xs text-cyan-400 block mb-1">
              Years to Invest: <span className="font-semibold">{localInvestmentYears} yrs</span>
            </label>
            <input
              type="range"
              min="5"
              max="30"
              value={localInvestmentYears}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setLocalInvestmentYears(v);
                onInvestmentYearsChange?.(v);
              }}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
              <span>5 yrs</span>
              <span>30 yrs</span>
            </div>
          </div>

          {/* Investment Goal */}
          <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <label className="text-xs text-cyan-400 block mb-2 font-semibold">Investment Goal</label>
            <div className="space-y-2">
              <select
                value={investmentGoals.goal}
                onChange={(e) => setInvestmentGoals({ ...investmentGoals, goal: e.target.value })}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
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
                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Portfolio Dependants */}
          <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <label className="text-xs text-cyan-400 block mb-1 font-semibold">Portfolio Dependants</label>
            <input
              type="number"
              step="1"
              min="0"
              value={portfolioDependants}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0;
                setPortfolioDependants(v);
                onPortfolioDependantsChange?.(v);
              }}
              className="w-full px-3 py-2 rounded text-sm"
              style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
            />
          </div>

          {/* Dependant Events */}
          <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
            <label className="text-xs text-cyan-400 block mb-2 font-semibold">Dependant Events (Future Changes)</label>
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="text-xs" style={{ color: "var(--text-tertiary)" }}>Year</label>
                <input
                  type="number"
                  min="1"
                  value={newDependantEventYear}
                  onChange={(e) => setNewDependantEventYear(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 rounded text-xs"
                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs" style={{ color: "var(--text-tertiary)" }}>Dependants</label>
                <input
                  type="number"
                  min="0"
                  value={newDependantEventCount}
                  onChange={(e) => setNewDependantEventCount(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 rounded text-xs"
                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
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
            {portfolioDependantsEvents.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {portfolioDependantsEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: "var(--bg-secondary)" }}
                  >
                    <span style={{ color: "var(--text-primary)" }}>
                      Year {event.year}: {event.dependants} dependant{event.dependants !== 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newEvents = portfolioDependantsEvents.filter((_, i) => i !== idx);
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

      {/* Advanced Settings */}
      <div className="rounded-lg border" style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}>
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
            <ChevronUp size={18} />
          ) : (
            <ChevronDown size={18} />
          )}
        </button>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdvancedSettings ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 space-y-4">
            {[
              { key: "medicareLevyRate", label: "Medicare Levy Rate", step: "0.01", min: "0", max: "1" },
              { key: "cpiRate", label: "CPI Rate", step: "0.01", min: "0", max: "1" },
              { key: "accessibleEquityRate", label: "Accessible Equity Rate", step: "0.01", min: "0", max: "1" },
              { key: "borrowingPowerMultiplierMin", label: "Borrowing Power Min", step: "0.1", min: "0", max: undefined },
              { key: "borrowingPowerMultiplierBase", label: "Borrowing Power Base", step: "0.1", min: "0", max: undefined },
              { key: "borrowingPowerMultiplierDependantReduction", label: "Dependant Reduction", step: "0.01", min: "0", max: undefined },
            ].map(({ key, label, step, min, max }) => (
              <div key={key}>
                <label className="text-xs text-cyan-400 block mb-1">{label}</label>
                <input
                  type="number"
                  step={step}
                  min={min}
                  max={max}
                  value={configParams[key as keyof ConfigParams]}
                  onChange={(e) => handleConfigChange(key as keyof ConfigParams, parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)", borderWidth: "1px" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleConfigSave}
        disabled={isSavingConfig || isLoadingConfig}
        className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
      >
        {isSavingConfig ? (
          <><Loader2 size={14} className="animate-spin" />Saving…</>
        ) : (
          <><Save size={14} />Save Configuration</>
        )}
      </button>
    </div>
  );
};

export default ConfigurationPanel;
