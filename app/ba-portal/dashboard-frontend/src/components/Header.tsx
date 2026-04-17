import React, { useState, useEffect } from "react";
import { Sun, Moon, LogIn, LogOut, User, ChevronDown, FolderOpen, Home } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { PortfolioInfo } from "../services/dashboardService";

interface HeaderProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  portfolios?: PortfolioInfo[];
  selectedPortfolioId?: string;
  onPortfolioChange?: (portfolioId: string) => void;
  onSwitchPortfolio?: () => void;
  onBackToDashboard?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isDarkMode = false,
  onToggleDarkMode,
  portfolios,
  selectedPortfolioId,
  onPortfolioChange,
  onSwitchPortfolio,
  onBackToDashboard,
}) => {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container')) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const menuItemStyle = {
    color: 'var(--text-primary)',
  };

  return (
    <header
      className="px-6 py-3 flex items-center justify-between border-b flex-shrink-0"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            WealthPulse
          </h1>
          <p className="text-[11px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>
            AI-assisted Wealth Adviser
          </p>
        </div>

        {/* Portfolio selector */}
        {((portfolios && portfolios.length > 0) || selectedPortfolioId) && (
          <div className="relative ml-2">
            <select
              value={selectedPortfolioId || ''}
              onChange={(e) => onPortfolioChange?.(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium cursor-pointer border transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              {portfolios && portfolios.length > 0 ? (
                portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                ))
              ) : (
                <option value={selectedPortfolioId}>{selectedPortfolioId}</option>
              )}
            </select>
            <ChevronDown
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              size={14}
              style={{ color: 'var(--text-tertiary)' }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isAuthenticated ? (
          <div className="relative user-menu-container">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="User menu"
            >
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <User size={13} className="text-cyan-400" />
              </div>
              <span className="max-w-28 truncate hidden sm:block">
                {user?.name || user?.email || 'User'}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-52 rounded-xl border shadow-2xl ring-1 ring-white/5 z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {user?.email || ''}
                  </p>
                </div>
                <div className="py-1">
                  {onSwitchPortfolio && (
                    <button onClick={() => { setShowUserMenu(false); onSwitchPortfolio(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                      style={menuItemStyle}>
                      <FolderOpen size={15} style={{ color: 'var(--text-tertiary)' }} />
                      Switch Portfolio
                    </button>
                  )}
                  {onBackToDashboard && (
                    <button onClick={() => { setShowUserMenu(false); onBackToDashboard(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                      style={menuItemStyle}>
                      <Home size={15} style={{ color: 'var(--text-tertiary)' }} />
                      Back to WealthPulse
                    </button>
                  )}
                  <div className="my-1 border-t" style={{ borderColor: 'var(--border-color)' }} />
                  <button onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-red-500/10 text-red-400">
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={login}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg bg-cyan-500 hover:bg-cyan-400 transition-colors"
          >
            <LogIn size={15} />
            Sign in
          </button>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5 ml-1"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
