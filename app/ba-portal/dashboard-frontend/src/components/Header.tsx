import React, { useState, useEffect } from "react";
import { Settings, Sun, Moon, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode: propIsDarkMode, onToggleDarkMode }) => {
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
          <h1 className="text-xl font-bold" style={{ color: textColor }}>Dashboard</h1>
          <p className="text-xs" style={{ color: textSecondary }}>Financial Analytics Platform</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {/* Auth Button - Login or User Menu */}
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
