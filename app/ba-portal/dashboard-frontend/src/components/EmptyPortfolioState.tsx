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
  isLoading = false,
  error = null,
  onRetry
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

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
      <div className="min-h-full flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/10 border-t-cyan-400 mx-auto mb-4" />
          <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            Loading your portfolios...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Failed to Load Portfolios
          </h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
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
    <div className="min-h-full flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <FolderOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome!
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            You don't have any portfolios yet. Create your first one to get started.
          </p>
        </div>

        {/* Create Portfolio Card */}
        <div
          className="rounded-xl p-8 border-2 border-dashed transition-all duration-200 flex flex-col"
          style={{
            borderColor: showCreateForm ? '#06b6d4' : 'var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {showCreateForm ? (
            <>
              <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center mx-auto bg-cyan-500/10">
                <Plus size={24} className="text-cyan-400" />
              </div>
              <label className="text-sm font-medium mb-2 text-center" style={{ color: 'var(--text-secondary)' }}>
                Portfolio name
              </label>
              <input
                autoFocus
                className="rounded-lg px-4 py-3 border outline-none mb-2 text-sm focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-500/60 transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: '#06b6d4',
                }}
                placeholder="e.g. Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
              />
              <p className="text-xs mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
                Starts with 2 investors and 1 property.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCreateForm(false); setNewName(''); }}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors hover:bg-white/5 border"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', backgroundColor: 'transparent' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors bg-cyan-500 hover:bg-cyan-400 text-white disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </>
          ) : (
            <button
              className="flex flex-col items-center justify-center w-full gap-4 py-12 rounded-lg transition-colors hover:bg-white/[0.04]"
              onClick={() => setShowCreateForm(true)}
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-500/50 flex items-center justify-center">
                <Plus size={32} className="text-cyan-400" />
              </div>
              <div className="text-center">
                <span className="text-lg font-medium block text-cyan-400">
                  Create First Portfolio
                </span>
                <span className="text-sm mt-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Click to get started
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 p-6 rounded-lg border-l-4 border-cyan-500" style={{ backgroundColor: 'rgba(6,182,212,0.06)' }}>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            What's a Portfolio?
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A portfolio represents a collection of investors and properties. You can create multiple portfolios to manage different scenarios or family situations. Each portfolio starts with 2 sample investors and 1 sample property that you can customize.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmptyPortfolioState;
