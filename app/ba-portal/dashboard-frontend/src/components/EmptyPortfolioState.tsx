import React, { useState } from "react";
import { FolderOpen, Plus, AlertCircle, RefreshCw } from "lucide-react";

interface EmptyPortfolioStateProps {
  onCreatePortfolio: (name: string) => Promise<void>;
  isDarkMode?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const EmptyPortfolioState: React.FC<EmptyPortfolioStateProps> = ({
  onCreatePortfolio,
  isDarkMode = false,
  isLoading = false,
  error = null,
  onRetry
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Theme-aware colors
  const bgColor = isDarkMode ? '#1e293b' : '#f8fafc';
  const cardBg = isDarkMode ? '#334155' : '#ffffff';
  const cardBorder = isDarkMode ? '#475569' : '#e2e8f0';
  const textColor = isDarkMode ? '#f1f5f9' : '#1e293b';
  const textSecondary = isDarkMode ? '#94a3b8' : '#64748b';
  const accentColor = '#06b6d4';

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreatePortfolio(newName.trim());
      setNewName('');
      setShowCreateForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setShowCreateForm(false);
      setNewName('');
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-cyan-400 mx-auto mb-4"></div>
          <p style={{ color: textColor }} className="text-lg font-medium">
            Loading your portfolios...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: bgColor }}
      >
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: textColor }}>
            Failed to Load Portfolios
          </h2>
          <p className="mb-6" style={{ color: textSecondary }}>
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={20} />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: bgColor }}
    >
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: textColor }}>
            Welcome!
          </h1>
          <p className="text-lg" style={{ color: textSecondary }}>
            You don't have any portfolios yet. Create your first one to get started.
          </p>
        </div>

        {/* Create Portfolio Card */}
        <div
          className="rounded-xl p-8 border-2 border-dashed transition-all duration-200 flex flex-col"
          style={{ borderColor: showCreateForm ? accentColor : cardBorder, backgroundColor: cardBg }}
        >
          {showCreateForm ? (
            <>
              <div
                className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center mx-auto"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <Plus size={24} style={{ color: accentColor }} />
              </div>
              <label className="text-sm font-medium mb-2 text-center" style={{ color: textSecondary }}>
                Portfolio name
              </label>
              <input
                autoFocus
                className="rounded px-4 py-3 border outline-none mb-2 text-sm"
                style={{
                  color: textColor,
                  backgroundColor: cardBg,
                  borderColor: accentColor,
                }}
                placeholder="e.g. Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
              />
              <p className="text-xs mb-6 text-center" style={{ color: textSecondary }}>
                Starts with 2 investors and 1 property.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewName('');
                  }}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    color: textSecondary,
                    border: `1px solid ${cardBorder}`
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-40"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </>
          ) : (
            <button
              className="flex flex-col items-center justify-center w-full gap-4 py-12 rounded-lg transition-colors hover:bg-cyan-50"
              onClick={() => setShowCreateForm(true)}
            >
              <div
                className="w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: accentColor }}
              >
                <Plus size={32} style={{ color: accentColor }} />
              </div>
              <div className="text-center">
                <span className="text-lg font-medium block" style={{ color: accentColor }}>
                  Create First Portfolio
                </span>
                <span className="text-sm mt-1 block" style={{ color: textSecondary }}>
                  Click to get started
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 p-6 rounded-lg" style={{ backgroundColor: `${accentColor}10`, borderLeft: `4px solid ${accentColor}` }}>
          <h3 className="font-semibold mb-2" style={{ color: textColor }}>
            What's a Portfolio?
          </h3>
          <p style={{ color: textSecondary }} className="text-sm">
            A portfolio represents a collection of investors and properties. You can create multiple portfolios to manage different scenarios or family situations. Each portfolio starts with 2 sample investors and 1 sample property that you can customize.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmptyPortfolioState;
