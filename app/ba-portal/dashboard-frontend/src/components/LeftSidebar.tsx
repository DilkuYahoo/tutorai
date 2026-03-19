/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  User,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

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

interface LeftSidebarProps {
  investors: any[];
  properties: any[];
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
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  investors,
  properties,
  loading,
  isVisible = true,
  onToggleVisibility,
  onUpdate,
  selectedPortfolioId,
}) => {
  const [localVisible, setLocalVisible] = useState(isVisible);
  const [expandedInvestor, setExpandedInvestor] = useState<string | null>(null);
  const [expandedDependants, setExpandedDependants] = useState<string | null>(null);
  const [localInvestors, setLocalInvestors] = useState<any[]>([]);
  const [originalInvestors, setOriginalInvestors] = useState<any[]>([]);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  // Only reset localInvestors when investors prop changes AND there are no local changes
  useEffect(() => {
    if (!hasLocalChanges) {
      setLocalInvestors(investors);
      setOriginalInvestors(investors);
    }
  }, [investors, hasLocalChanges]);

  // Reset local changes when portfolio changes
  useEffect(() => {
    if (selectedPortfolioId) {
      setHasLocalChanges(false);
      setLocalInvestors(investors);
      setOriginalInvestors(investors);
    }
  }, [selectedPortfolioId, investors]);

  const handleToggle = () => {
    const newVisible = !localVisible;
    setLocalVisible(newVisible);
    onToggleVisibility?.(newVisible);
  };

  const toggleInvestorExpand = (investorName: string) => {
    setExpandedInvestor(
      expandedInvestor === investorName ? null : investorName,
    );
  };

  const toggleDependantsExpand = (investorName: string) => {
    setExpandedDependants(
      expandedDependants === investorName ? null : investorName,
    );
  };

  const saveToCache = () => {
    localStorage.setItem("investors", JSON.stringify(localInvestors));
  };

  const updateInvestor = (index: number, field: string, value: any) => {
    const updated = [...localInvestors];
    updated[index] = { ...updated[index], [field]: value };
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  const addIncomeEvent = (investorIndex: number) => {
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
  };

  const addDependantsEvent = (investorIndex: number) => {
    const updated = [...localInvestors];
    if (!updated[investorIndex].dependants_events)
      updated[investorIndex].dependants_events = [];
    updated[investorIndex].dependants_events.push({
      year: 1,
      dependants: 1,
    });
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  const updateIncomeEvent = (
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
  };

  const updateDependantsEvent = (
    investorIndex: number,
    eventIndex: number,
    field: string,
    value: any,
  ) => {
    const updated = [...localInvestors];
    updated[investorIndex].dependants_events[eventIndex] = {
      ...updated[investorIndex].dependants_events[eventIndex],
      [field]: value,
    };
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  const deleteIncomeEvent = (investorIndex: number, eventIndex: number) => {
    const updated = [...localInvestors];
    updated[investorIndex].income_events.splice(eventIndex, 1);
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  const deleteDependantsEvent = (investorIndex: number, eventIndex: number) => {
    const updated = [...localInvestors];
    updated[investorIndex].dependants_events.splice(eventIndex, 1);
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  const deleteInvestor = (index: number) => {
    const updated = [...localInvestors];
    updated.splice(index, 1);
    setLocalInvestors(updated);
    setHasLocalChanges(true);
  };

  if (!localVisible) {
    return (
      <div className="flex items-center justify-center w-16 p-4" style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)' }}>
        <button
          onClick={handleToggle}
          className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors duration-200 flex items-center justify-center"
          title="Show Investors"
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    );
  }

  const getInvestorIcon = () => {
    return <User size={36} className="text-cyan-400" />;
  };

  return (
    <aside className="w-80 text-white p-6 overflow-y-auto border-r flex flex-col" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleToggle}
          className="w-8 h-8 rounded-lg font-bold transition-colors duration-200 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          title="Hide Investors"
        >
          <ChevronsLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-cyan-400">Investors</h2>
      </div>

      {loading ? (
        <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>Loading investors...</div>
      ) : !investors || investors.length === 0 ? (
        <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
          No investor data available
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {localInvestors.map((investor: any, index: number) => (
              <div
                key={index}
                className="rounded-lg p-4 hover:opacity-90 transition-all duration-300 border"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-4xl">{getInvestorIcon()}</div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={investor?.name || ""}
                        onChange={(e) =>
                          updateInvestor(index, "name", e.target.value)
                        }
                        disabled={investor?.name === "Bob" || investor?.name === "Alice"}
                        className="bg-slate-600 text-white rounded px-2 py-1 w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                      <p className="text-xs text-gray-300">Investor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteInvestor(index)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete Investor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex justify-between">
                    <span>Base Income:</span>
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
                      className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Growth Rate:</span>
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
                      className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Essential Expenditure:</span>
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
                      className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Nonessential Expenditure:</span>
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
                      className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Dependants:</span>
                    <input
                      type="number"
                      value={investor?.dependants || 0}
                      onChange={(e) =>
                        updateInvestor(
                          index,
                          "dependants",
                          parseInt(e.target.value),
                        )
                      }
                      className="bg-slate-600 text-white rounded px-2 py-1 w-20 text-right"
                    />
                  </div>
                </div>

                {/* Dependants Events */}
                {investor?.dependants_events &&
                  investor.dependants_events.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-500">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() =>
                            toggleDependantsExpand(investor?.name || "")
                          }
                          className="flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex-1"
                        >
                          <span>Dependants Events</span>
                          <span>
                            {expandedDependants === investor?.name ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </span>
                        </button>
                        <button
                          onClick={() => addDependantsEvent(index)}
                          className="text-green-400 hover:text-green-300 ml-2"
                          title="Add Dependants Event"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {expandedDependants === investor?.name && (
                        <div className="space-y-1">
                          {investor.dependants_events.map(
                            (event: any, eIdx: number) => (
                              <div
                                key={eIdx}
                                className="rounded p-2 text-xs flex justify-between items-center"
                               style={{ backgroundColor: 'var(--bg-secondary)' }}
                              >
                                <div className="flex-1">
                                    <div className="space-y-1">
                                      <div className="flex gap-2">
                                        <label className="text-gray-300">
                                          Year:
                                        </label>
                                        <input
                                          type="number"
                                          value={event.year || 0}
                                          onChange={(e) =>
                                            updateDependantsEvent(
                                              index,
                                              eIdx,
                                              "year",
                                              parseInt(e.target.value),
                                            )
                                          }
                                          className="bg-slate-500 text-white rounded px-1 py-0 w-16 text-xs"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <label className="text-gray-300">
                                          Dependants:
                                        </label>
                                        <input
                                          type="number"
                                          value={event.dependants || 0}
                                          onChange={(e) =>
                                            updateDependantsEvent(
                                              index,
                                              eIdx,
                                              "dependants",
                                              parseInt(e.target.value),
                                            )
                                          }
                                          className="bg-slate-500 text-white rounded px-1 py-0 w-16 text-xs"
                                        />
                                      </div>
                                    </div>
                                </div>
                                <button
                                  onClick={() =>
                                    deleteDependantsEvent(index, eIdx)
                                  }
                                  className="text-red-400 hover:text-red-300 ml-2"
                                  title="Delete Dependants Event"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                {(!investor?.dependants_events || investor.dependants_events.length === 0) && (
                      <div className="mt-4 pt-4 border-t border-slate-500">
                        <button
                          onClick={() => addDependantsEvent(index)}
                          className="text-green-400 hover:text-green-300 flex items-center gap-1 text-xs"
                        >
                          <Plus size={14} /> Add Dependants Event
                        </button>
                      </div>
                    )}

                {/* Income Events */}
                {investor?.income_events &&
                  investor.income_events.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-500">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() =>
                            toggleInvestorExpand(investor?.name || "")
                          }
                          className="flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex-1"
                        >
                          <span>Income Events</span>
                          <span>
                            {expandedInvestor === investor?.name ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </span>
                        </button>
                        <button
                          onClick={() => addIncomeEvent(index)}
                          className="text-green-400 hover:text-green-300 ml-2"
                          title="Add Income Event"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {expandedInvestor === investor?.name && (
                        <div className="space-y-1">
                          {investor.income_events.map(
                            (event: any, eIdx: number) => (
                              <div
                                key={eIdx}
                                className="rounded p-2 text-xs flex justify-between items-center"
                               style={{ backgroundColor: 'var(--bg-secondary)' }}
                              >
                                <div className="flex-1">
                                    <div className="space-y-1">
                                      <div className="flex gap-2">
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
                                        />
                                      </div>
                                      <div className="flex gap-2">
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
                                        />
                                      </div>
                                      <div className="flex gap-2">
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
                                  className="text-red-400 hover:text-red-300 ml-2"
                                  title="Delete Income Event"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                {!(investor?.income_events && investor.income_events.length > 0) && (
                      <div className="mt-4 pt-4 border-t border-slate-500">
                        <button
                          onClick={() => addIncomeEvent(index)}
                          className="text-green-400 hover:text-green-300 flex items-center gap-1 text-xs"
                        >
                          <Plus size={14} /> Add Income Event
                        </button>
                      </div>
                    )}
              </div>
            ))}
          </div>
          {/* Add Investor button hidden - users cannot add more investors */}

          {/* Refresh Button - Always Visible */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                if (onUpdate) {
                  onUpdate(
                    localInvestors,
                    properties,
                    () => {
                      // Success callback - show success message
                      setOriginalInvestors([...localInvestors]);
                      setHasLocalChanges(false);
                      saveToCache();
                    },
                    () => {
                      // Error callback - revert to original data
                      setLocalInvestors([...originalInvestors]);
                    },
                  );
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded transition-colors font-medium"
            >
              <Upload size={16} />
              Refresh Data
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default LeftSidebar;
