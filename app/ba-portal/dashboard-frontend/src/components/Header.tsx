import React, { useState, useEffect } from "react";
import { Settings, Sun, Moon, LogIn, LogOut, User, Settings2, X, Save, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { fetchConfigParams, saveConfigParams } from "../services/dashboardService";
import type { ConfigParams } from "../services/dashboardService";

interface HeaderProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  investmentYears?: number;
  onInvestmentYearsChange?: (years: number) => void;
  configParams?: ConfigParams;
  onConfigParamsChange?: (params: ConfigParams) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isDarkMode: propIsDarkMode, 
  onToggleDarkMode, 
  investmentYears, 
  onInvestmentYearsChange,
  configParams: propConfigParams,
  onConfigParamsChange
}) => {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [localIsDarkMode, setLocalIsDarkMode] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // Default config params
  const defaultConfigParams: ConfigParams = {
    medicareLevyRate: 0.02,
    cpiRate: 0.03,
    accessibleEquityRate: 0.80,
    borrowingPowerMultiplierMin: 3.5,
    borrowingPowerMultiplierBase: 5.0,
    borrowingPowerMultiplierDependantReduction: 0.25
  };

  const [configParams, setConfigParams] = useState<ConfigParams>(propConfigParams || defaultConfigParams);

  // Sync propConfigParams to local state when it changes
  useEffect(() => {
    if (propConfigParams) {
      setConfigParams(propConfigParams);
    }
  }, [propConfigParams]);

  useEffect(() => {
    const checkDarkMode = () => {
      const hasDarkClass = document.documentElement.classList.contains('dark');
      setLocalIsDarkMode(hasDarkClass);
      if (propIsDarkMode !== undefined) {
        propIsDarkMode = hasDarkClass;
      }
    };
    checkDarkMode();

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

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-menu-container')) {
          setShowUserMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Load config when opening the config panel
  const loadConfigFromBackend = async () => {
    setIsLoadingConfig(true);
    setConfigError(null);
    try {
      const configData = await fetchConfigParams();
      setConfigParams(configData.configParams);
      // Also update the investment years if provided
      if (configData.investmentYears && onInvestmentYearsChange) {
        onInvestmentYearsChange(configData.investmentYears);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      setConfigError("Failed to load configuration from server");
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (showConfigPanel) {
      loadConfigFromBackend();
    }
  }, [showConfigPanel]);

  // Close config panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showConfigPanel) {
        const target = event.target as HTMLElement;
        if (!target.closest('.config-panel')) {
          setShowConfigPanel(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showConfigPanel]);

  const handleConfigChange = (field: keyof ConfigParams, value: number) => {
    const updated = { ...configParams, [field]: value };
    setConfigParams(updated);
    onConfigParamsChange?.(updated);
  };

  const handleConfigSave = async () => {
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      await saveConfigParams(configParams, investmentYears);
      onConfigParamsChange?.(configParams);
      setConfigSuccess("Configuration saved successfully!");
      setTimeout(() => {
        setShowConfigPanel(false);
        setConfigSuccess(null);
      }, 1000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setConfigError("Failed to save configuration to server");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const isDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : localIsDarkMode;

  // Theme-aware colors
  const bgColor = isDarkMode ? '#1e293b' : '#f9fafb';
  const borderColor = isDarkMode ? '#334155' : '#e5e7eb';
  const textColor = isDarkMode ? '#ffffff' : '#1f2937';
  const textSecondary = isDarkMode ? '#94a3b8' : '#6b7280';

  const handleLoginClick = () => {
    login();
  };

  const handleLogoutClick = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <header 
      className="px-6 py-4 flex items-center justify-between transition-colors duration-300"
      style={{ backgroundColor: bgColor, borderColor: borderColor, borderBottomWidth: '1px', borderBottomStyle: 'solid' }}
    >
      <div className="flex items-center gap-4">
        {/* Company Logo */}
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">D</span>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: textColor }}>AdviceGenie</h1>
          <p className="text-xs" style={{ color: textSecondary }}>your AI assisted Wealth Adviser</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="relative user-menu-container">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
              style={{ 
                backgroundColor: showUserMenu ? (isDarkMode ? '#334155' : '#e5e7eb') : 'transparent',
                color: textColor
              }}
              aria-label="User menu"
            >
              <User size={18} />
              <span className="text-sm font-medium max-w-32 truncate">
                {user?.name || user?.email || 'User'}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div 
                className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-lg border z-50"
                style={{ 
                  backgroundColor: bgColor, 
                  borderColor: borderColor 
                }}
              >
                <div 
                  className="px-4 py-3 border-b"
                  style={{ borderColor: borderColor }}
                >
                  <p className="text-sm font-medium truncate" style={{ color: textColor }}>
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs truncate" style={{ color: textSecondary }}>
                    {user?.email || ''}
                  </p>
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                  style={{ color: '#ef4444' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogOut size={16} />
                  Logoff
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={handleLoginClick}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: '#06b6d4' }}
          >
            <LogIn size={16} />
            Login
          </button>
        )}

        {/* Settings Icon */}
        <button 
          className="p-2 rounded-lg transition-colors"
          style={{ color: textSecondary }}
          onMouseEnter={(e) => e.currentTarget.style.color = textColor}
          onMouseLeave={(e) => e.currentTarget.style.color = textSecondary}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {/* Config Button */}
        <button 
          className="p-2 rounded-lg transition-colors config-panel"
          style={{ color: showConfigPanel ? '#06b6d4' : textSecondary }}
          onClick={() => setShowConfigPanel(!showConfigPanel)}
          onMouseEnter={(e) => e.currentTarget.style.color = textColor}
          onMouseLeave={(e) => e.currentTarget.style.color = showConfigPanel ? '#06b6d4' : textSecondary}
          aria-label="Config"
        >
          <Settings2 size={20} />
        </button>

        {/* Config Panel */}
        {showConfigPanel && (
          <div 
            className="absolute right-4 top-16 w-80 rounded-lg shadow-xl border z-50 config-panel"
            style={{ 
              backgroundColor: bgColor, 
              borderColor: borderColor 
            }}
          >
            <div 
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: borderColor }}
            >
              <h3 className="text-sm font-semibold" style={{ color: textColor }}>
                Configuration Parameters
              </h3>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="p-1 rounded hover:bg-slate-600"
              >
                <X size={16} style={{ color: textSecondary }} />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {/* Loading/Error/Success Messages */}
              {isLoadingConfig && (
                <div className="flex items-center gap-2 text-sm" style={{ color: textSecondary }}>
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

              {/* Investment Years - Now in Config Panel */}
              <div>
                <label className="text-xs text-cyan-400 block mb-1">Years to Invest</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={investmentYears || 30}
                    onChange={(e) => onInvestmentYearsChange?.(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                  />
                  <span className="text-xs" style={{ color: textSecondary }}>yrs</span>
                </div>
              </div>

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
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

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
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

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
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

              <div>
                <label className="text-xs text-cyan-400 block mb-1">Borrowing Power Min</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={configParams.borrowingPowerMultiplierMin}
                  onChange={(e) => handleConfigChange('borrowingPowerMultiplierMin', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

              <div>
                <label className="text-xs text-cyan-400 block mb-1">Borrowing Power Base</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={configParams.borrowingPowerMultiplierBase}
                  onChange={(e) => handleConfigChange('borrowingPowerMultiplierBase', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

              <div>
                <label className="text-xs text-cyan-400 block mb-1">Dependant Reduction</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={configParams.borrowingPowerMultiplierDependantReduction}
                  onChange={(e) => handleConfigChange('borrowingPowerMultiplierDependantReduction', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', color: textColor, borderColor: borderColor, borderWidth: '1px' }}
                />
              </div>

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

        {/* Dark/Light Mode Toggle */}
        <button 
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg transition-colors"
          style={{ color: textSecondary }}
          onMouseEnter={(e) => e.currentTarget.style.color = textColor}
          onMouseLeave={(e) => e.currentTarget.style.color = textSecondary}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
