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
  GripVertical,
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (target: ModalTarget): boolean => {
    if (!activeModal) return false;
    if (target.type !== activeModal.type) return false;
    if (target.type === "investor" && activeModal.type === "investor")
      return target.index === activeModal.index;
    if (target.type === "property" && activeModal.type === "property")
      return target.index === activeModal.index;
    return true;
  };

  const navItemBase =
    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 border-l-2 w-full text-left";

  const navItemActive =
    "bg-cyan-500/10 border-cyan-500 text-cyan-400";

  const navItemInactive =
    "border-transparent hover:bg-white/[0.04]";

  const sectionLabel =
    "text-[10px] font-semibold uppercase tracking-widest px-1 mb-2 mt-1";

  if (!isVisible) {
    return (
      <div
        className="flex flex-col items-center py-4 w-14 flex-shrink-0 gap-3"
        style={{
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <button
          onClick={() => onToggleVisibility(true)}
          className="w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white transition-colors flex items-center justify-center shadow-lg shadow-cyan-500/20"
          title="Show Panel"
          aria-label="Show navigation panel"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <aside
      className="w-60 flex-shrink-0 flex flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-color)",
      }}
      role="navigation"
      aria-label="Portfolio navigation"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border-color)" }}
      >
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>
          Portfolio
        </span>
        <button
          onClick={() => onToggleVisibility(false)}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: "var(--text-tertiary)" }}
          aria-label="Collapse navigation panel"
        >
          <ChevronsLeft size={15} />
        </button>
      </div>

      {/* Nav content */}
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">

        {/* Investors */}
        <section>
          <p className={sectionLabel} style={{ color: "var(--text-tertiary)" }}>
            Investors
          </p>
          {investors.length === 0 ? (
            <p className="text-xs px-3 py-1.5 italic" style={{ color: "var(--text-tertiary)" }}>
              No investors
            </p>
          ) : (
            investors.map((investor: any, i: number) => {
              const target: ModalTarget = { type: "investor", index: i };
              const active = isActive(target);
              const key = `investor-${i}`;
              return (
                <button
                  key={i}
                  className={`${navItemBase} ${active ? navItemActive : navItemInactive}`}
                  style={{ color: active ? undefined : "var(--text-secondary)" }}
                  onClick={() => onOpenModal(target)}
                  onMouseEnter={() => setHoveredItem(key)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-cyan-500/20' : 'bg-white/5'}`}>
                    <User size={11} className={active ? 'text-cyan-400' : ''} style={active ? {} : { color: 'var(--text-tertiary)' }} />
                  </div>
                  <span className="truncate text-xs">{investor.name || `Investor ${i + 1}`}</span>
                  {!active && hoveredItem === key && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5" style={{ color: 'var(--text-tertiary)' }}>Edit</span>
                  )}
                </button>
              );
            })
          )}
        </section>

        {/* Properties */}
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className={sectionLabel + " mb-0 mt-0"} style={{ color: "var(--text-tertiary)" }}>
              Properties
            </p>
            {onAddProperty && (
              <button
                onClick={async () => {
                  setIsAddingProperty(true);
                  try { await onAddProperty(); } finally { setIsAddingProperty(false); }
                }}
                disabled={isAddingProperty}
                className="w-5 h-5 rounded flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 transition-colors"
                title="Add Property"
                aria-label="Add property"
              >
                {isAddingProperty ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            )}
          </div>
          {properties.length === 0 ? (
            <p className="text-xs px-3 py-1.5 italic" style={{ color: "var(--text-tertiary)" }}>
              No properties
            </p>
          ) : (
            properties.map((prop: any, i: number) => {
              const target: ModalTarget = { type: "property", index: i };
              const active = isActive(target);
              const isDragOver = dragOverIndex === i;
              const key = `property-${i}`;
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
                  onMouseEnter={() => setHoveredItem(key)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <button
                    className={`${navItemBase} ${active ? navItemActive : navItemInactive} group`}
                    style={{ color: active ? undefined : "var(--text-secondary)", cursor: "grab" }}
                    onClick={() => onOpenModal(target)}
                  >
                    {hoveredItem === key ? (
                      <GripVertical size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    ) : (
                      <Building2 size={12} className={active ? 'text-cyan-400' : ''} style={active ? {} : { color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    )}
                    <span className="truncate text-xs">{prop.name || `Property ${i + 1}`}</span>
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: "var(--border-color)" }} />

        {/* Settings */}
        <section className="space-y-0.5">
          {[
            { type: "configuration" as const, icon: <Settings2 size={12} />, label: "Portfolio Settings" },
            { type: "householdExpenses" as const, icon: <DollarSign size={12} />, label: "Household Expenses" },
            { type: "investorDetails" as const, icon: <Users size={12} />, label: "Investor Details" },
          ].map(({ type, icon, label }) => {
            const target: ModalTarget = { type };
            const active = isActive(target);
            return (
              <button
                key={type}
                className={`${navItemBase} ${active ? navItemActive : navItemInactive}`}
                style={{ color: active ? undefined : "var(--text-secondary)" }}
                onClick={() => onOpenModal(target)}
              >
                <span style={active ? { color: '#06b6d4' } : { color: 'var(--text-tertiary)' }}>{icon}</span>
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </section>
      </div>
    </aside>
  );
};

export default NavigationPanel;
