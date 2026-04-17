import React, { useState } from "react";
import { FolderOpen, Calendar, BarChart3, Pencil, Check, X, Plus } from "lucide-react";
import type { PortfolioInfo } from "../services/dashboardService";

interface PortfolioSelectorProps {
  portfolios: PortfolioInfo[];
  onSelectPortfolio: (portfolioId: string) => void;
  onRenamePortfolio?: (portfolioId: string, newName: string) => Promise<void>;
  onCreatePortfolio?: (name: string) => Promise<void>;
}

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  portfolios,
  onSelectPortfolio,
  onRenamePortfolio,
  onCreatePortfolio,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const accentColor = '#06b6d4';

  const startEdit = (portfolio: PortfolioInfo) => {
    setEditingId(portfolio.id);
    setEditingName(portfolio.name || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (portfolioId: string) => {
    if (!onRenamePortfolio || !editingName.trim()) return;
    setSavingId(portfolioId);
    try {
      await onRenamePortfolio(portfolioId, editingName.trim());
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, portfolioId: string) => {
    if (e.key === 'Enter') saveEdit(portfolioId);
    if (e.key === 'Escape') cancelEdit();
  };

  const handleCreate = async () => {
    if (!onCreatePortfolio || !newName.trim()) return;
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
    if (e.key === 'Escape') { setShowCreateForm(false); setNewName(''); }
  };

  return (
    <div className="flex items-center justify-center p-6 min-h-full">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Select Portfolio
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Choose a portfolio to load into the platform
          </p>
        </div>

        {/* Portfolio Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="group rounded-xl p-6 border transition-all duration-200"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}
            >
              {/* Portfolio Icon */}
              <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center"
                   style={{ backgroundColor: `${accentColor}15` }}>
                <BarChart3 size={24} style={{ color: accentColor }} />
              </div>

              {/* Portfolio Name */}
              {editingId === portfolio.id ? (
                <div className="flex items-center gap-1 mb-2">
                  <input
                    autoFocus
                    className="text-xl font-semibold flex-1 min-w-0 rounded px-2 py-0.5 border outline-none"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: accentColor,
                    }}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => handleEditKeyDown(e, portfolio.id)}
                  />
                  <button
                    onClick={() => saveEdit(portfolio.id)}
                    disabled={savingId === portfolio.id || !editingName.trim()}
                    className="p-1 rounded hover:bg-green-500/10 disabled:opacity-40"
                    title="Save"
                  >
                    <Check size={16} className="text-green-500" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 rounded hover:bg-red-500/10"
                    title="Cancel"
                  >
                    <X size={16} className="text-red-400" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 mb-2">
                  <h3 className="text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {portfolio.name || `Portfolio ${portfolio.id.slice(-8)}`}
                  </h3>
                  {onRenamePortfolio && (
                    <button
                      onClick={() => startEdit(portfolio)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity flex-shrink-0"
                      title="Rename portfolio"
                    >
                      <Pencil size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  )}
                </div>
              )}

              {/* Investors List */}
              {portfolio.investors && portfolio.investors.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Investors
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {portfolio.investors.map(inv => inv.name).join(', ')}
                  </p>
                </div>
              ) : (
                <p className="text-sm mb-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  ID: {portfolio.id}
                </p>
              )}

              {/* Last Updated */}
              {portfolio.last_updated && (
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Updated {new Date(portfolio.last_updated).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Updates Count */}
              {portfolio.updates !== undefined && (
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {portfolio.updates} update{portfolio.updates !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Select Button */}
              <button
                className="w-full px-4 py-2 rounded-lg font-medium transition-colors hover:bg-cyan-500 hover:text-white disabled:opacity-40"
                style={{
                  backgroundColor: 'transparent',
                  color: accentColor,
                  border: `1px solid ${accentColor}`
                }}
                disabled={savingId === portfolio.id}
                onClick={() => onSelectPortfolio(portfolio.id)}
              >
                Select Portfolio
              </button>
            </div>
          ))}

          {/* New Portfolio Card */}
          {onCreatePortfolio && (
            <div
              className="rounded-xl p-6 border-2 border-dashed transition-all duration-200 flex flex-col"
              style={{ borderColor: showCreateForm ? accentColor : 'var(--border-color)' }}
            >
              {showCreateForm ? (
                <>
                  <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center"
                       style={{ backgroundColor: `${accentColor}15` }}>
                    <Plus size={24} style={{ color: accentColor }} />
                  </div>
                  <label className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Portfolio name
                  </label>
                  <input
                    autoFocus
                    className="rounded px-3 py-2 border outline-none mb-4 text-sm"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: accentColor,
                    }}
                    placeholder="e.g. Smith Family"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={handleCreateKeyDown}
                  />
                  <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Starts with 2 investors and 1 property.
                  </p>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => { setShowCreateForm(false); setNewName(''); }}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-white/5 border"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-color)'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newName.trim()}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-40"
                    >
                      {creating ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="flex flex-col items-center justify-center w-full h-full gap-3 py-8 rounded-lg transition-colors hover:bg-white/[0.04]"
                  onClick={() => setShowCreateForm(true)}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center"
                       style={{ borderColor: accentColor }}>
                    <Plus size={24} style={{ color: accentColor }} />
                  </div>
                  <span className="text-base font-medium" style={{ color: accentColor }}>
                    New Portfolio
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Count */}
        <div className="text-center mt-8">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSelector;
