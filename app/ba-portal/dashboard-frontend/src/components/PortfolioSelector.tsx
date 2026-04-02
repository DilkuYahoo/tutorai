import React from "react";
import { FolderOpen, Calendar, BarChart3 } from "lucide-react";
import type { PortfolioInfo } from "../services/dashboardService";

interface PortfolioSelectorProps {
  portfolios: PortfolioInfo[];
  onSelectPortfolio: (portfolioId: string) => void;
  isDarkMode?: boolean;
}

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  portfolios,
  onSelectPortfolio,
  isDarkMode = false
}) => {
  // Theme-aware colors
  const bgColor = isDarkMode ? '#1e293b' : '#f8fafc';
  const cardBg = isDarkMode ? '#334155' : '#ffffff';
  const cardBorder = isDarkMode ? '#475569' : '#e2e8f0';
  const textColor = isDarkMode ? '#f1f5f9' : '#1e293b';
  const textSecondary = isDarkMode ? '#94a3b8' : '#64748b';
  const accentColor = '#06b6d4';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: textColor }}>
            Select Portfolio
          </h1>
          <p className="text-lg" style={{ color: textSecondary }}>
            Choose a portfolio to load into the platform
          </p>
        </div>

        {/* Portfolio Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="rounded-xl p-6 border transition-all duration-200 hover:shadow-lg cursor-pointer group"
              style={{
                backgroundColor: cardBg,
                borderColor: cardBorder,
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}
              onClick={() => onSelectPortfolio(portfolio.id)}
            >
              {/* Portfolio Icon */}
              <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center"
                   style={{ backgroundColor: `${accentColor}15` }}>
                <BarChart3 size={24} style={{ color: accentColor }} />
              </div>

              {/* Portfolio Name */}
              <h3 className="text-xl font-semibold mb-2 truncate" style={{ color: textColor }}>
                {portfolio.name || `Portfolio ${portfolio.id.slice(-8)}`}
              </h3>

              {/* Portfolio ID */}
              <p className="text-sm mb-3 font-mono" style={{ color: textSecondary }}>
                ID: {portfolio.id}
              </p>

              {/* Last Updated */}
              {portfolio.last_updated && (
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} style={{ color: textSecondary }} />
                  <span className="text-sm" style={{ color: textSecondary }}>
                    Updated {new Date(portfolio.last_updated).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Updates Count */}
              {portfolio.updates !== undefined && (
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} style={{ color: textSecondary }} />
                  <span className="text-sm" style={{ color: textSecondary }}>
                    {portfolio.updates} update{portfolio.updates !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Select Button */}
              <button
                className="w-full px-4 py-2 rounded-lg font-medium transition-colors group-hover:bg-cyan-500 group-hover:text-white"
                style={{
                  backgroundColor: 'transparent',
                  color: accentColor,
                  border: `1px solid ${accentColor}`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPortfolio(portfolio.id);
                }}
              >
                Select Portfolio
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm" style={{ color: textSecondary }}>
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSelector;