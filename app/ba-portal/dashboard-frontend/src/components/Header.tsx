import React, { useState, useEffect } from "react";
import { Sun, Moon, LogIn, LogOut, User, ChevronDown, FolderOpen, DollarSign, Home, Users } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { PortfolioInfo } from "../services/dashboardService";

interface HeaderProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  portfolios?: PortfolioInfo[];
  selectedPortfolioId?: string;
  onPortfolioChange?: (portfolioId: string) => void;
  onSwitchPortfolio?: () => void;
  onShowExpenses?: () => void;
  onShowInvestorDetails?: () => void;
  onBackToDashboard?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isDarkMode: propIsDarkMode,
  onToggleDarkMode,
  portfolios,
  selectedPortfolioId,
  onPortfolioChange,
  onSwitchPortfolio,
  onShowExpenses,
  onShowInvestorDetails,
  onBackToDashboard,
}) => {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [localIsDarkMode, setLocalIsDarkMode] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
        
        {/* Portfolio Selector */}
        {(portfolios && portfolios.length > 0) || selectedPortfolioId ? (
          <div className="relative">
            <select
              value={selectedPortfolioId || ''}
              onChange={(e) => onPortfolioChange?.(e.target.value)}
              className="appearance-none px-4 py-2 pr-10 rounded-lg text-sm font-medium cursor-pointer"
              style={{ 
                backgroundColor: isDarkMode ? '#334155' : '#e5e7eb', 
                color: textColor,
                borderColor: borderColor,
                borderWidth: '1px'
              }}
            >
              {portfolios && portfolios.length > 0 ? (
                portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name || portfolio.id}
                  </option>
                ))
              ) : (
                <option value={selectedPortfolioId}>{selectedPortfolioId}</option>
              )}
            </select>
            <ChevronDown 
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              size={16}
              style={{ color: textSecondary }}
            />
          </div>
        ) : null}
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
                {onSwitchPortfolio && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSwitchPortfolio();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{ color: textColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FolderOpen size={16} />
                    Switch Portfolio
                  </button>
                )}
                {onBackToDashboard && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onBackToDashboard();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{ color: textColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Home size={16} />
                    Back to WealthPulse
                  </button>
                )}
                {onShowExpenses && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onShowExpenses();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{ color: textColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <DollarSign size={16} />
                    Household Expenses
                  </button>
                )}
                {onShowInvestorDetails && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onShowInvestorDetails();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors"
                    style={{ color: textColor }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? '#334155' : '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Users size={16} />
                    Investor Details
                  </button>
                )}
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
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90 bg-cyan-500 hover:bg-cyan-600"
          >
            <LogIn size={16} />
            Login
          </button>
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
