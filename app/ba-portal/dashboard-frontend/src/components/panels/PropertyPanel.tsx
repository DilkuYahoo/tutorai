/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Save, Building2, Loader2 } from "lucide-react";
import { formatInThousands, parseThousandsInput } from "../../utils/formatters";

// Shared design-system constants
const inputCls =
  "w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors";
const inputStyle = {
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text-primary)",
  borderColor: "var(--border-color)",
};
const labelCls = "block text-[11px] font-semibold uppercase tracking-wide mb-1";
const labelStyle = { color: "var(--text-tertiary)" };
const sectionCls =
  "text-[11px] font-semibold uppercase tracking-widest border-b pb-1 mb-4";
const sectionStyle = {
  color: "var(--text-tertiary)",
  borderColor: "var(--border-color)",
};

interface PropertyPanelProps {
  index: number;
  properties: any[];
  investors: any[];
  chartData?: any[];
  selectedPortfolioId?: string;
  onUpdate?: (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => Promise<void>;
  onClose?: () => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({
  index,
  properties,
  investors,
  chartData,
  onUpdate,
  onClose,
}) => {
  const [localProperties, setLocalProperties] = useState<any[]>(properties);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const property = localProperties[index];

  const splits: any[] = useMemo(
    () => property?.investor_splits || [],
    [property],
  );

  const latestValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    const val = latest?.property_values?.[property?.name];
    return val ?? property?.property_value ?? null;
  }, [chartData, property]);

  const updateField = useCallback(
    (field: string, value: any) => {
      const updated = [...localProperties];
      updated[index] = { ...updated[index], [field]: value };
      setLocalProperties(updated);

    },
    [localProperties, index],
  );


  const addSplit = useCallback(() => {
    if (investors.length <= 1) return;
    const updated = [...localProperties];
    updated[index] = {
      ...updated[index],
      investor_splits: [...splits, { name: "", percentage: 0 }],
    };
    setLocalProperties(updated);
  }, [localProperties, index, splits, investors]);

  const updateSplit = useCallback(
    (sIdx: number, field: string, value: any) => {
      const updated = [...localProperties];
      const newSplits = [...splits];
      if (field === "percentage") {
        const parsedVal = Math.min(100, Math.max(0, parseFloat(value) || 0));
        // Distribute the remainder proportionally across other investors
        const remainder = 100 - parsedVal;
        const others = newSplits.filter((_: any, i: number) => i !== sIdx);
        const othersTotal = others.reduce((sum: number, s: any) => sum + (s.percentage || 0), 0);
        newSplits[sIdx] = { ...newSplits[sIdx], percentage: parsedVal };
        if (others.length > 0) {
          others.forEach((_: any, i: number) => {
            const realIdx = i >= sIdx ? i + 1 : i;
            const currentPct = newSplits[realIdx].percentage || 0;
            const newPct = othersTotal > 0
              ? Math.round((currentPct / othersTotal) * remainder * 10) / 10
              : Math.round((remainder / others.length) * 10) / 10;
            newSplits[realIdx] = { ...newSplits[realIdx], percentage: newPct };
          });
          // Fix rounding so total is exactly 100
          const total = newSplits.reduce((s: number, x: any) => s + (x.percentage || 0), 0);
          const diff = Math.round((100 - total) * 10) / 10;
          if (diff !== 0) {
            const lastOtherIdx = sIdx === newSplits.length - 1 ? newSplits.length - 2 : newSplits.length - 1;
            newSplits[lastOtherIdx] = { ...newSplits[lastOtherIdx], percentage: Math.round((newSplits[lastOtherIdx].percentage + diff) * 10) / 10 };
          }
        }
      } else {
        newSplits[sIdx] = { ...newSplits[sIdx], [field]: value };
      }
      updated[index] = { ...updated[index], investor_splits: newSplits };
      setLocalProperties(updated);
    },
    [localProperties, index, splits],
  );

  const deleteSplit = useCallback(
    (sIdx: number) => {
      const updated = [...localProperties];
      updated[index] = {
        ...updated[index],
        investor_splits: splits.filter((_: any, i: number) => i !== sIdx),
      };
      setLocalProperties(updated);
    },
    [localProperties, index, splits],
  );

  const handleDelete = useCallback(() => {
    if (!onUpdate) return;
    const updatedProperties = localProperties.filter((_, i) => i !== index);
    onUpdate(investors, updatedProperties, () => onClose?.(), () => {});
  }, [onUpdate, localProperties, investors, index, onClose]);

  const handleSave = useCallback(async () => {
    if (!onUpdate) return;
    setIsSaving(true);
    setSaveError(null);
    await onUpdate(
      investors,
      localProperties,
      () => {
        setIsSaving(false);
        onClose?.();
      },
      () => {
        setIsSaving(false);
        setSaveError("Save failed. Please try again.");
      },
    );
  }, [onUpdate, investors, localProperties, onClose]);

  if (!property) {
    return (
      <div
        className="text-center py-8"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Building2 size={32} className="mx-auto mb-2 opacity-50" />
        <p>Property not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 size={24} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={property.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-transparent text-lg font-semibold border-b focus:outline-none focus:border-cyan-500 pb-1 transition-colors"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-color)",
            }}
            aria-label="Property name"
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Investment Property
          </p>
        </div>
        {latestValue !== null && (
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-cyan-400">
              ${latestValue.toLocaleString()}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Current Value
            </p>
          </div>
        )}
      </div>

      {/* Purchase Details */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Purchase Details
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Purchase Year
            </label>
            <input
              type="number"
              value={property.purchase_year || 0}
              onChange={(e) =>
                updateField("purchase_year", parseInt(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Purchase year"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Initial Value
            </label>
            <input
              type="text"
              value={formatInThousands(property.initial_value || 0)}
              onChange={(e) =>
                updateField("initial_value", parseThousandsInput(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Initial value"
            />
          </div>
        </div>
      </div>

      {/* Financing */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Financing
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Loan Amount
            </label>
            <input
              type="text"
              value={formatInThousands(property.loan_amount || 0)}
              onChange={(e) =>
                updateField("loan_amount", parseThousandsInput(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Loan amount"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Interest Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={property.interest_rate || 0}
              onChange={(e) =>
                updateField("interest_rate", parseFloat(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Interest rate"
            />
          </div>
        </div>
      </div>

      {/* Revenue & Growth */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Revenue &amp; Growth
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Annual Rent
            </label>
            <input
              type="text"
              value={formatInThousands(property.rent || 0)}
              onChange={(e) =>
                updateField("rent", parseThousandsInput(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Annual rent"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Growth Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={property.growth_rate || 0}
              onChange={(e) =>
                updateField("growth_rate", parseFloat(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Growth rate"
            />
          </div>
        </div>
      </div>

      {/* Costs */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Costs
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Other Expenses
            </label>
            <input
              type="text"
              value={formatInThousands(property.other_expenses || 0)}
              onChange={(e) =>
                updateField(
                  "other_expenses",
                  parseThousandsInput(e.target.value),
                )
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Other expenses"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Annual Principal Change
            </label>
            <input
              type="text"
              value={formatInThousands(property.annual_principal_change || 0)}
              onChange={(e) =>
                updateField(
                  "annual_principal_change",
                  parseThousandsInput(e.target.value),
                )
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Annual principal change"
            />
          </div>
        </div>
      </div>

      {/* Investor Splits */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className={sectionCls + " mb-0 border-0 pb-0"} style={sectionStyle}>
            Ownership Splits
          </p>
          {investors.length > 1 && (
            <button
              onClick={addSplit}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              aria-label="Add investor split"
            >
              <Plus size={14} />
              Add Split
            </button>
          )}
        </div>
        <div className="border-b mb-3" style={{ borderColor: "var(--border-color)" }} />

        {/* Visual ownership bar */}
        {(() => {
          const barItems: { name: string; pct: number }[] =
            investors.length === 1
              ? [{ name: investors[0].name, pct: 100 }]
              : splits.map((s: any) => ({ name: s.name || "—", pct: s.percentage || 0 }));

          const colours = ["#06b6d4", "#818cf8", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"];

          return (
            <div className="mb-4">
              {/* Stacked bar */}
              <div className="flex w-full h-7 rounded-lg overflow-hidden gap-px" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                {barItems.map((item, i) => (
                  <div
                    key={i}
                    style={{ width: `${item.pct}%`, backgroundColor: colours[i % colours.length], transition: "width 0.3s ease" }}
                    title={`${item.name}: ${item.pct}%`}
                  />
                ))}
                {/* Unfilled remainder */}
                {(() => { const rem = 100 - barItems.reduce((s, x) => s + x.pct, 0); return rem > 0 ? <div style={{ width: `${rem}%`, backgroundColor: "var(--bg-tertiary)" }} /> : null; })()}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {barItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colours[i % colours.length] }} />
                    <span className="truncate max-w-[120px]">{item.name}</span>
                    <span className="font-semibold" style={{ color: colours[i % colours.length] }}>{item.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Single investor — no editable rows needed */}
        {investors.length === 1 ? null : splits.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            No splits defined — add investors to this property.
          </p>
        ) : (
          <div className="space-y-3">
            {splits.map((split: any, sIdx: number) => {
              const colour = ["#06b6d4", "#818cf8", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"][sIdx % 6];
              return (
                <div key={sIdx} className="rounded-lg px-3 py-2.5 space-y-2" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  {/* Name row */}
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colour }} />
                    <input
                      type="text"
                      value={split.name || ""}
                      onChange={(e) => updateSplit(sIdx, "name", e.target.value)}
                      className="flex-1 px-2 py-1 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      style={inputStyle}
                      placeholder="Investor name"
                      aria-label="Investor split name"
                    />
                    <span className="text-sm font-semibold w-12 text-right flex-shrink-0" style={{ color: colour }}>
                      {(split.percentage || 0).toFixed(0)}%
                    </span>
                    <button
                      onClick={() => deleteSplit(sIdx)}
                      className="flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      aria-label="Delete investor split"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Slider */}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={split.percentage || 0}
                    onChange={(e) => updateSplit(sIdx, "percentage", e.target.value)}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: colour }}
                    aria-label={`${split.name || "Investor"} ownership percentage`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {saveError && (
        <div className="text-sm px-3 py-2 rounded-lg bg-red-500/10 text-red-400">
          {saveError}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-4 border-t"
        style={{ borderColor: "var(--border-color)" }}
      >
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-400/40 hover:bg-red-500/10 transition-colors"
          aria-label="Delete property"
        >
          <Trash2 size={15} />
          Delete Property
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/30 disabled:cursor-not-allowed text-white transition-colors"
          aria-label="Save changes"
        >
          {isSaving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;
