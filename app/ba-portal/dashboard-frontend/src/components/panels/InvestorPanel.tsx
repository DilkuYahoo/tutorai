/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useCallback } from "react";
import { Plus, Trash2, Save, User, Loader2 } from "lucide-react";
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

interface InvestorPanelProps {
  index: number;
  investors: any[];
  properties: any[];
  selectedPortfolioId?: string;
  onUpdate?: (
    investors: any[],
    properties: any[],
    onSuccess?: () => void,
    onError?: () => void,
  ) => Promise<void>;
  onClose?: () => void;
}

const InvestorPanel: React.FC<InvestorPanelProps> = ({
  index,
  investors,
  properties,
  onUpdate,
  onClose,
}) => {
  const [localInvestors, setLocalInvestors] = useState<any[]>(investors);
  const [localProperties] = useState<any[]>(properties);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const investor = localInvestors[index];

  const updateField = useCallback(
    (field: string, value: any) => {
      const updated = [...localInvestors];
      const oldName = updated[index].name;
      updated[index] = { ...updated[index], [field]: value };
      setLocalInvestors(updated);
      setHasChanges(true);

      // Keep property splits in sync if name changed
      if (field === "name" && value !== oldName) {
        // handled at save time — no need to mutate read-only localProperties here
      }
    },
    [localInvestors, index],
  );

  const addIncomeEvent = useCallback(() => {
    const updated = [...localInvestors];
    if (!updated[index].income_events) updated[index].income_events = [];
    updated[index] = {
      ...updated[index],
      income_events: [
        ...updated[index].income_events,
        { year: 3, amount: 0, type: "increase" },
      ],
    };
    setLocalInvestors(updated);
    setHasChanges(true);
  }, [localInvestors, index]);

  const updateIncomeEvent = useCallback(
    (eIdx: number, field: string, value: any) => {
      const updated = [...localInvestors];
      const events = [...(updated[index].income_events || [])];
      events[eIdx] = { ...events[eIdx], [field]: value };
      updated[index] = { ...updated[index], income_events: events };
      setLocalInvestors(updated);
      setHasChanges(true);
    },
    [localInvestors, index],
  );

  const deleteIncomeEvent = useCallback(
    (eIdx: number) => {
      const updated = [...localInvestors];
      const events = (updated[index].income_events || []).filter(
        (_: any, i: number) => i !== eIdx,
      );
      updated[index] = { ...updated[index], income_events: events };
      setLocalInvestors(updated);
      setHasChanges(true);
    },
    [localInvestors, index],
  );

  const handleDelete = useCallback(() => {
    if (!onUpdate) return;
    const updatedInvestors = localInvestors.filter((_, i) => i !== index);
    onUpdate(updatedInvestors, localProperties, () => onClose?.(), () => {});
  }, [onUpdate, localInvestors, localProperties, index, onClose]);

  const handleSave = useCallback(async () => {
    if (!onUpdate) return;
    setIsSaving(true);
    setSaveError(null);
    await onUpdate(
      localInvestors,
      localProperties,
      () => {
        setIsSaving(false);
        setHasChanges(false);
        onClose?.();
      },
      () => {
        setIsSaving(false);
        setSaveError("Save failed. Please try again.");
      },
    );
  }, [onUpdate, localInvestors, localProperties, onClose]);

  if (!investor) {
    return (
      <div
        className="text-center py-8"
        style={{ color: "var(--text-tertiary)" }}
      >
        <User size={32} className="mx-auto mb-2 opacity-50" />
        <p>Investor not found</p>
      </div>
    );
  }

  const incomeEvents: any[] = investor.income_events || [];

  return (
    <div className="space-y-6">
      {/* Identity header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
          <User size={26} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={investor.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full bg-transparent text-lg font-semibold border-b focus:outline-none focus:border-cyan-500 pb-1 transition-colors"
            style={{
              color: "var(--text-primary)",
              borderColor: "var(--border-color)",
            }}
            aria-label="Investor name"
          />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Investor
          </p>
        </div>
      </div>

      {/* Income */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Income
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Base Income
            </label>
            <input
              type="text"
              value={formatInThousands(investor.base_income || 0)}
              onChange={(e) =>
                updateField("base_income", parseThousandsInput(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Base income"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Annual Growth Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={investor.annual_growth_rate || 0}
              onChange={(e) =>
                updateField("annual_growth_rate", parseFloat(e.target.value))
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Annual growth rate"
            />
          </div>
        </div>
      </div>

      {/* Expenditure */}
      <div>
        <p className={sectionCls} style={sectionStyle}>
          Expenditure
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>
              Essential
            </label>
            <input
              type="text"
              value={formatInThousands(investor.essential_expenditure || 0)}
              onChange={(e) =>
                updateField(
                  "essential_expenditure",
                  parseThousandsInput(e.target.value),
                )
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Essential expenditure"
            />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>
              Nonessential
            </label>
            <input
              type="text"
              value={formatInThousands(investor.nonessential_expenditure || 0)}
              onChange={(e) =>
                updateField(
                  "nonessential_expenditure",
                  parseThousandsInput(e.target.value),
                )
              }
              className={inputCls}
              style={inputStyle}
              aria-label="Nonessential expenditure"
            />
          </div>
        </div>
      </div>

      {/* Income Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className={sectionCls + " mb-0 border-0 pb-0"} style={sectionStyle}>
            Income Events
          </p>
          <button
            onClick={addIncomeEvent}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            aria-label="Add income event"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
        <div
          className="border-b mb-1"
          style={{ borderColor: "var(--border-color)" }}
        />

        {incomeEvents.length === 0 ? (
          <p className="text-sm py-3" style={{ color: "var(--text-tertiary)" }}>
            No income events — future salary changes or bonuses can be added here.
          </p>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div
              className="grid grid-cols-[80px_1fr_130px_36px] gap-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span>Year</span>
              <span>Amount</span>
              <span>Type</span>
              <span />
            </div>
            {/* Table rows */}
            {incomeEvents.map((event: any, eIdx: number) => (
              <div
                key={eIdx}
                className="grid grid-cols-[80px_1fr_130px_36px] gap-2 px-2 py-1.5 rounded-lg items-center"
                style={{ backgroundColor: "var(--bg-tertiary)" }}
              >
                <input
                  type="number"
                  value={event.year || 0}
                  onChange={(e) =>
                    updateIncomeEvent(eIdx, "year", parseInt(e.target.value))
                  }
                  className="w-full px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  style={inputStyle}
                  aria-label="Income event year"
                />
                <input
                  type="text"
                  value={formatInThousands(event.amount || 0)}
                  onChange={(e) =>
                    updateIncomeEvent(
                      eIdx,
                      "amount",
                      parseThousandsInput(e.target.value),
                    )
                  }
                  className="w-full px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  style={inputStyle}
                  aria-label="Income event amount"
                />
                <select
                  value={event.type || "increase"}
                  onChange={(e) =>
                    updateIncomeEvent(eIdx, "type", e.target.value)
                  }
                  className="w-full px-2 py-1.5 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  style={inputStyle}
                  aria-label="Income event type"
                >
                  <option value="increase">Increase</option>
                  <option value="set">Set</option>
                </select>
                <button
                  onClick={() => deleteIncomeEvent(eIdx)}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  aria-label="Delete income event"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
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
          aria-label="Delete investor"
        >
          <Trash2 size={15} />
          Delete Investor
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
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

export default InvestorPanel;
