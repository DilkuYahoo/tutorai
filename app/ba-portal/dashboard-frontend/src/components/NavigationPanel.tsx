/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  User,
  Building2,
  Settings2,
  DollarSign,
  Users,
  Plus,
  Loader2,
} from "lucide-react";

export type ModalTarget =
  | { type: "investor"; index: number }
  | { type: "property"; index: number }
  | { type: "configuration" }
  | { type: "householdExpenses" }
  | { type: "investorDetails" };

interface NavigationPanelProps {
  investors: any[];
  properties: any[];
  isVisible: boolean;
  onToggleVisibility: (visible: boolean) => void;
  onOpenModal: (target: ModalTarget) => void;
  activeModal: ModalTarget | null;
  onAddProperty?: () => Promise<void>;
  onReorderProperties?: (reordered: any[]) => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  investors,
  properties,
  isVisible,
  onToggleVisibility,
  onOpenModal,
  activeModal,
  onAddProperty,
  onReorderProperties,
}) => {
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isActive = (target: ModalTarget): boolean => {
    if (!activeModal) return false;
    if (target.type !== activeModal.type) return false;
    if (target.type === "investor" && activeModal.type === "investor")
      return target.index === activeModal.index;
    if (target.type === "property" && activeModal.type === "property")
      return target.index === activeModal.index;
    return true;
  };

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-all duration-150 ${
      active
        ? "bg-cyan-500/20 border-l-2 border-cyan-400 text-cyan-400"
        : "border-l-2 border-transparent hover:bg-white/5"
    }`;

  if (!isVisible) {
    return (
      <div
        className="flex items-center justify-center w-16 p-4 flex-shrink-0"
        style={{
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <button
          onClick={() => onToggleVisibility(true)}
          className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors duration-200 flex items-center justify-center"
          title="Show Panel"
          aria-label="Show navigation panel"
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-color)",
      }}
      role="navigation"
      aria-label="Portfolio navigation"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-color)" }}
      >
        <span className="text-sm font-bold text-cyan-400 tracking-wide">
          WealthPulse
        </span>
        <button
          onClick={() => onToggleVisibility(false)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: "var(--text-secondary)" }}
          title="Collapse Panel"
          aria-label="Collapse navigation panel"
        >
          <ChevronsLeft size={18} />
        </button>
      </div>

      {/* Nav content */}
      <div className="flex-1 py-3 px-3 space-y-5 overflow-y-auto">
        {/* Investors */}
        <section>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            Investors
          </p>
          {investors.length === 0 ? (
            <p
              className="text-xs px-3 py-2 italic"
              style={{ color: "var(--text-tertiary)" }}
            >
              No investors
            </p>
          ) : (
            investors.map((investor: any, i: number) => {
              const target: ModalTarget = { type: "investor", index: i };
              return (
                <button
                  key={i}
                  className={itemClass(isActive(target))}
                  style={{ color: isActive(target) ? undefined : "var(--text-secondary)", width: "100%", textAlign: "left" }}
                  onClick={() => onOpenModal(target)}
                >
                  <User size={16} className="flex-shrink-0 text-cyan-400/70" />
                  <span className="truncate">{investor.name || `Investor ${i + 1}`}</span>
                </button>
              );
            })
          )}
        </section>

        {/* Properties */}
        <section>
          <div className="flex items-center justify-between px-1 mb-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              Properties
            </p>
            {onAddProperty && (
              <button
                onClick={async () => {
                  setIsAddingProperty(true);
                  try {
                    await onAddProperty();
                  } finally {
                    setIsAddingProperty(false);
                  }
                }}
                disabled={isAddingProperty}
                className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                title="Add Property"
                aria-label="Add property"
              >
                {isAddingProperty ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Plus size={13} />
                )}
              </button>
            )}
          </div>
          {properties.length === 0 ? (
            <p
              className="text-xs px-3 py-2 italic"
              style={{ color: "var(--text-tertiary)" }}
            >
              No properties
            </p>
          ) : (
            properties.map((prop: any, i: number) => {
              const target: ModalTarget = { type: "property", index: i };
              const isDragOver = dragOverIndex === i;
              return (
                <div
                  key={i}
                  draggable
                  onDragStart={() => { dragIndex.current = i; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => {
                    const from = dragIndex.current;
                    if (from === null || from === i) { setDragOverIndex(null); return; }
                    const reordered = [...properties];
                    reordered.splice(i, 0, reordered.splice(from, 1)[0]);
                    onReorderProperties?.(reordered);
                    setDragOverIndex(null);
                    dragIndex.current = null;
                  }}
                  onDragEnd={() => { setDragOverIndex(null); dragIndex.current = null; }}
                  className={`rounded-lg transition-all ${isDragOver ? 'border-t-2 border-cyan-400' : 'border-t-2 border-transparent'}`}
                >
                  <button
                    className={itemClass(isActive(target))}
                    style={{ color: isActive(target) ? undefined : "var(--text-secondary)", width: "100%", textAlign: "left", cursor: "grab" }}
                    onClick={() => onOpenModal(target)}
                  >
                    <Building2 size={16} className="flex-shrink-0 text-cyan-400/70" />
                    <span className="truncate">{prop.name || `Property ${i + 1}`}</span>
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: "var(--border-color)" }} />

        {/* Portfolio Settings */}
        <section className="space-y-0.5">
          <button
            className={itemClass(isActive({ type: "configuration" }))}
            style={{ color: isActive({ type: "configuration" }) ? undefined : "var(--text-secondary)", width: "100%", textAlign: "left" }}
            onClick={() => onOpenModal({ type: "configuration" })}
          >
            <Settings2 size={16} className="flex-shrink-0 text-cyan-400/70" />
            <span>Portfolio Settings</span>
          </button>

          <button
            className={itemClass(isActive({ type: "householdExpenses" }))}
            style={{ color: isActive({ type: "householdExpenses" }) ? undefined : "var(--text-secondary)", width: "100%", textAlign: "left" }}
            onClick={() => onOpenModal({ type: "householdExpenses" })}
          >
            <DollarSign size={16} className="flex-shrink-0 text-cyan-400/70" />
            <span>Household Expenses</span>
          </button>

          <button
            className={itemClass(isActive({ type: "investorDetails" }))}
            style={{ color: isActive({ type: "investorDetails" }) ? undefined : "var(--text-secondary)", width: "100%", textAlign: "left" }}
            onClick={() => onOpenModal({ type: "investorDetails" })}
          >
            <Users size={16} className="flex-shrink-0 text-cyan-400/70" />
            <span>Investor Details</span>
          </button>
        </section>
      </div>
    </aside>
  );
};

export default NavigationPanel;
