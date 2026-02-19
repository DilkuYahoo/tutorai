/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

interface RightSidebarProps {
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
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  investors,
  properties,
  loading,
  isVisible = true,
  onToggleVisibility,
  onUpdate,
}) => {
  const [localVisible, setLocalVisible] = useState(isVisible);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [localProperties, setLocalProperties] = useState<any[]>([]);
  const [originalProperties, setOriginalProperties] = useState<any[]>([]);

  useEffect(() => {
    setLocalProperties(properties);
    setOriginalProperties(properties);
  }, [properties]);

  const handleToggle = () => {
    const newVisible = !localVisible;
    setLocalVisible(newVisible);
    onToggleVisibility?.(newVisible);
  };

  const togglePropertyExpand = (propertyName: string) => {
    setExpandedProperty(
      expandedProperty === propertyName ? null : propertyName,
    );
  };

  const saveToCache = () => {
    localStorage.setItem("properties", JSON.stringify(localProperties));
  };

  const updateProperty = (index: number, field: string, value: any) => {
    const updated = [...localProperties];
    updated[index] = { ...updated[index], [field]: value };
    setLocalProperties(updated);
  };

  const addInvestorSplit = (propertyIndex: number) => {
    const updated = [...localProperties];
    if (!updated[propertyIndex].investor_splits)
      updated[propertyIndex].investor_splits = [];
    updated[propertyIndex].investor_splits.push({ name: "", percentage: 0 });
    setLocalProperties(updated);
  };

  const updateInvestorSplit = (
    propertyIndex: number,
    splitIndex: number,
    field: string,
    value: any,
  ) => {
    const updated = [...localProperties];
    updated[propertyIndex].investor_splits[splitIndex] = {
      ...updated[propertyIndex].investor_splits[splitIndex],
      [field]: value,
    };
    setLocalProperties(updated);
  };

  const deleteInvestorSplit = (propertyIndex: number, splitIndex: number) => {
    const updated = [...localProperties];
    updated[propertyIndex].investor_splits.splice(splitIndex, 1);
    setLocalProperties(updated);
  };

  const deleteProperty = (index: number) => {
    const updated = [...localProperties];
    updated.splice(index, 1);
    setLocalProperties(updated);
  };

  const addProperty = () => {
    let newProperty;
    if (localProperties.length > 0) {
      newProperty = JSON.parse(JSON.stringify(localProperties[0]));
      newProperty.name = `Property ${localProperties.length + 1}`;
    } else {
      newProperty = {
        name: "Property 1",
        property_value: 0,
        purchase_year: 0,
        initial_value: 0,
        loan_amount: 0,
        interest_rate: 0,
        rent: 0,
        growth_rate: 0,
        other_expenses: 0,
        annual_principal_change: 0,
        investor_splits: [],
      };
    }
    setLocalProperties([...localProperties, newProperty]);
  };

  if (!localVisible) {
    return (
      <div className="flex items-center justify-center w-16 p-4" style={{ backgroundColor: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)' }}>
        <button
          onClick={handleToggle}
          className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors duration-200 flex items-center justify-center"
          title="Show Properties"
        >
          <ChevronsLeft size={20} />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 text-white p-6 overflow-y-auto border-l flex flex-col" style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-color)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-cyan-400">Properties</h2>
        <button
          onClick={handleToggle}
          className="w-8 h-8 rounded-lg font-bold transition-colors duration-200 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          title="Hide Properties"
        >
          <ChevronsRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>Loading properties...</div>
      ) : !properties || properties.length === 0 ? (
        <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
          No property data available
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {localProperties.map((prop: any, index: number) => (
              <div
                key={index}
                className="rounded-lg p-4 border hover:border-cyan-500 transition-all duration-300"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={prop?.name || ""}
                      onChange={(e) =>
                        updateProperty(index, "name", e.target.value)
                      }
                      className="rounded px-2 py-1 w-full text-xs uppercase font-semibold mb-1"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      placeholder="Property Name"
                    />
                    <input
                      type="number"
                      value={prop?.property_value || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "property_value",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-2 py-1 w-full text-2xl font-bold"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteProperty(index)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete Property"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs border-t pt-3" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>
                  <div className="flex justify-between">
                    <span>Purchase Year:</span>
                    <input
                      type="number"
                      value={prop?.purchase_year || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "purchase_year",
                          parseInt(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-16 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Initial Value:</span>
                    <input
                      type="number"
                      value={prop?.initial_value || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "initial_value",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-20 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Loan Amount:</span>
                    <input
                      type="number"
                      value={prop?.loan_amount || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "loan_amount",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-20 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Interest Rate:</span>
                    <input
                      type="number"
                      value={prop?.interest_rate || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "interest_rate",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-16 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Annual Rent:</span>
                    <input
                      type="number"
                      value={prop?.rent || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "rent",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-20 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Growth Rate:</span>
                    <input
                      type="number"
                      value={prop?.growth_rate || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "growth_rate",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-16 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Other Expenses:</span>
                    <input
                      type="number"
                      value={prop?.other_expenses || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "other_expenses",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-20 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>Annual Principal Change:</span>
                    <input
                      type="number"
                      value={prop?.annual_principal_change || 0}
                      onChange={(e) =>
                        updateProperty(
                          index,
                          "annual_principal_change",
                          parseFloat(e.target.value),
                        )
                      }
                      className="rounded px-1 py-0 w-20 text-xs text-right"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {/* Investor Splits Dropdown */}
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => togglePropertyExpand(prop?.name || "")}
                      className="flex items-center justify-between text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex-1"
                    >
                      <span>Investor Splits</span>
                      <span>
                        {expandedProperty === prop?.name ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => addInvestorSplit(index)}
                      className="text-green-400 hover:text-green-300 ml-2"
                      title="Add Investor Split"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {expandedProperty === prop?.name && (
                    <div className="mt-3 space-y-2">
                      {prop.investor_splits && prop.investor_splits.length > 0 ? (
                        prop.investor_splits.map((split: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            className="rounded p-2 text-xs flex justify-between items-center"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                          >
                            <div className="flex-1">
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={split.name || ""}
                                    onChange={(e) =>
                                      updateInvestorSplit(
                                        index,
                                        sIdx,
                                        "name",
                                        e.target.value,
                                      )
                                    }
                                    className="rounded px-1 py-0 flex-1 text-xs"
                                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    placeholder="Investor Name"
                                  />
                                  <input
                                    type="number"
                                    value={split.percentage || 0}
                                    onChange={(e) =>
                                      updateInvestorSplit(
                                        index,
                                        sIdx,
                                        "percentage",
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    className="rounded px-1 py-0 w-16 text-xs text-right"
                                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                    placeholder="%"
                                  />
                                  <span style={{ color: 'var(--text-primary)' }}>%</span>
                                </div>
                            </div>
                            <button
                              onClick={() => deleteInvestorSplit(index, sIdx)}
                              className="text-red-400 hover:text-red-300 ml-2"
                              title="Delete Investor Split"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          No investor splits available
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={addProperty}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-2 rounded mt-4 transition-colors"
            >
              <Plus size={14} />
              Add Property
            </button>

            {/* Update Button - Always Visible */}
            <button
              onClick={() => {
                if (onUpdate) {
                  onUpdate(
                    investors,
                    localProperties,
                    () => {
                      // Success callback
                      setOriginalProperties([...localProperties]);
                      saveToCache();
                    },
                    () => {
                      // Error callback - revert to original data
                      setLocalProperties([...originalProperties]);
                    },
                  );
                }
              }}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs px-3 py-2 rounded mt-4 block transition-colors w-full"
            >
              <Upload size={14} />
              Update Data
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default RightSidebar;
