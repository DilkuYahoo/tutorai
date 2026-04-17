import React, { useState, useEffect } from 'react';
import { Save, DollarSign, ShoppingCart, Users } from 'lucide-react';

interface ExpenseItem {
  amount: number;
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'yearly';
  monthlyValue: number;
}

type ExpenseCategory = Record<string, ExpenseItem>;

interface HouseholdExpensesData {
  essentials: ExpenseCategory;
  nonEssentials: ExpenseCategory;
  totals: {
    essentialTotal: number;
    nonEssentialTotal: number;
    overallTotal: number;
  };
  split: {
    enabled: boolean;
    perPersonExpense: number;
  };
}

interface HouseholdExpensesFormProps {
  onSave?: (data: HouseholdExpensesData) => void;
  initialData?: Partial<HouseholdExpensesData>;
  numInvestors?: number;
  initialEssentialTotal?: number;
  initialNonEssentialTotal?: number;
}

const ESSENTIAL_CATEGORIES = [
  'rentMortgage',
  'utilities',
  'groceries',
  'transport',
  'insurance',
  'education',
  'healthcare',
] as const;

const NON_ESSENTIAL_CATEGORIES = [
  'diningOut',
  'entertainment',
  'subscriptions',
  'holidays',
  'shopping',
  'miscellaneous',
] as const;

const CATEGORY_LABELS = {
  rentMortgage: 'Rent / Mortgage',
  utilities: 'Utilities',
  groceries: 'Groceries',
  transport: 'Transport',
  insurance: 'Insurance',
  education: 'Education',
  healthcare: 'Healthcare',
  diningOut: 'Dining Out',
  entertainment: 'Entertainment',
  subscriptions: 'Subscriptions',
  holidays: 'Holidays',
  shopping: 'Shopping',
  miscellaneous: 'Miscellaneous',
} as const;

const FREQUENCIES = [
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly',     label: 'Monthly' },
  { value: 'yearly',      label: 'Yearly' },
];

const normalizeToMonthly = (amount: number, frequency: string): number => {
  switch (frequency) {
    case 'weekly':      return (amount * 52) / 12;
    case 'fortnightly': return (amount * 26) / 12;
    case 'monthly':     return amount;
    case 'yearly':      return amount / 12;
    default:            return amount;
  }
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

// Shared design-system constants (matches ConfigurationPanel / InvestorPanel)
const inputCls =
  'w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-500/60 transition-colors';
const inputStyle = {
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  borderColor: 'var(--border-color)',
};
const sectionCls =
  'text-[10px] font-semibold uppercase tracking-widest border-b pb-2 mb-3 flex items-center justify-between';
const sectionStyle = { color: 'var(--text-tertiary)', borderColor: 'var(--border-color)' };
const cardStyle = { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' };

const HouseholdExpensesForm: React.FC<HouseholdExpensesFormProps> = ({
  onSave,
  initialData,
  numInvestors = 0,
  initialEssentialTotal,
  initialNonEssentialTotal,
}) => {
  const [data, setData] = useState<HouseholdExpensesData>(() => {
    const defaultItem = { amount: 0, frequency: 'monthly' as const, monthlyValue: 0 };

    const initialEssentials = ESSENTIAL_CATEGORIES.reduce(
      (acc, cat) => ({ ...acc, [cat]: { ...defaultItem } }), {}
    );
    const initialNonEssentials = NON_ESSENTIAL_CATEGORIES.reduce(
      (acc, cat) => ({ ...acc, [cat]: { ...defaultItem } }), {}
    );

    if (initialEssentialTotal !== undefined && initialEssentialTotal > 0) {
      const m = initialEssentialTotal / 12;
      (initialEssentials as any)['healthcare'] = { amount: m, frequency: 'monthly' as const, monthlyValue: m };
    }
    if (initialNonEssentialTotal !== undefined && initialNonEssentialTotal > 0) {
      const m = initialNonEssentialTotal / 12;
      (initialNonEssentials as any)['miscellaneous'] = { amount: m, frequency: 'monthly' as const, monthlyValue: m };
    }

    return {
      essentials: initialEssentials,
      nonEssentials: initialNonEssentials,
      totals: { essentialTotal: 0, nonEssentialTotal: 0, overallTotal: 0 },
      split: { enabled: false, perPersonExpense: 0 },
      ...initialData,
    };
  });

  useEffect(() => {
    let essentialTotal = 0;
    let nonEssentialTotal = 0;
    Object.values(data.essentials).forEach(item => { essentialTotal += item.monthlyValue; });
    Object.values(data.nonEssentials).forEach(item => { nonEssentialTotal += item.monthlyValue; });
    const overallTotal = essentialTotal + nonEssentialTotal;
    const perPersonExpense = data.split.enabled && numInvestors > 1 ? overallTotal / numInvestors : 0;
    setData(prev => ({
      ...prev,
      totals: { essentialTotal, nonEssentialTotal, overallTotal },
      split: { ...prev.split, perPersonExpense },
    }));
  }, [data.essentials, data.nonEssentials, data.split.enabled, numInvestors]);

  const updateExpense = (
    category: 'essentials' | 'nonEssentials',
    key: string,
    field: 'amount' | 'frequency',
    value: number | string
  ) => {
    setData(prev => {
      const updatedItem = { ...prev[category][key] };
      if (field === 'amount') updatedItem.amount = value as number;
      else updatedItem.frequency = value as ExpenseItem['frequency'];
      updatedItem.monthlyValue = normalizeToMonthly(updatedItem.amount, updatedItem.frequency);
      return { ...prev, [category]: { ...prev[category], [key]: updatedItem } };
    });
  };

  const renderExpenseRow = (category: 'essentials' | 'nonEssentials', key: string, label: string) => {
    const item = data[category][key];
    return (
      <div key={key} className="grid grid-cols-[1fr_90px_80px] gap-2 items-center py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <input
          type="number"
          min="0"
          step="1"
          value={item.amount || ''}
          onChange={(e) => updateExpense(category, key, 'amount', parseFloat(e.target.value) || 0)}
          className={inputCls}
          style={inputStyle}
          placeholder="0"
        />
        <select
          value={item.frequency}
          onChange={(e) => updateExpense(category, key, 'frequency', e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Essential', value: data.totals.essentialTotal * 12 },
          { label: 'Non-Essential', value: data.totals.nonEssentialTotal * 12 },
          { label: 'Total Annual', value: data.totals.overallTotal * 12, accent: true },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-lg p-3 border text-center" style={cardStyle}>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
            <div className={`text-sm font-bold ${accent ? 'text-cyan-400' : ''}`} style={accent ? {} : { color: 'var(--text-primary)' }}>
              {formatCurrency(value)}
            </div>
          </div>
        ))}
      </div>

      {/* Household split toggle */}
      {numInvestors > 1 && (
        <div className="rounded-lg p-4 border" style={cardStyle}>
          <div className={sectionCls} style={sectionStyle}>
            <span className="flex items-center gap-2"><Users size={12} />Household Split</span>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={data.split.enabled}
              onChange={(e) => setData(prev => ({ ...prev, split: { ...prev.split, enabled: e.target.checked } }))}
              className="rounded accent-cyan-500"
            />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Split expenses between {numInvestors} investors</span>
          </label>
          {data.split.enabled && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>Per Person (Annual)</div>
              <div className="text-lg font-bold text-cyan-400">{formatCurrency(data.split.perPersonExpense * 12)}</div>
            </div>
          )}
        </div>
      )}

      {/* Essential Expenses */}
      <div className="rounded-lg p-4 border" style={cardStyle}>
        <div className={sectionCls} style={sectionStyle}>
          <span className="flex items-center gap-2"><DollarSign size={12} />Essential Expenses</span>
          <span className="text-cyan-400 normal-case tracking-normal font-semibold">{formatCurrency(data.totals.essentialTotal * 12)}</span>
        </div>
        <div>
          {ESSENTIAL_CATEGORIES.map(cat => renderExpenseRow('essentials', cat, CATEGORY_LABELS[cat]))}
        </div>
      </div>

      {/* Non-Essential Expenses */}
      <div className="rounded-lg p-4 border" style={cardStyle}>
        <div className={sectionCls} style={sectionStyle}>
          <span className="flex items-center gap-2"><ShoppingCart size={12} />Non-Essential Expenses</span>
          <span className="text-cyan-400 normal-case tracking-normal font-semibold">{formatCurrency(data.totals.nonEssentialTotal * 12)}</span>
        </div>
        <div>
          {NON_ESSENTIAL_CATEGORIES.map(cat => renderExpenseRow('nonEssentials', cat, CATEGORY_LABELS[cat]))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={() => onSave?.(data)}
        className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
      >
        <Save size={14} />
        Save Household Expenses
      </button>
    </div>
  );
};

export default HouseholdExpensesForm;
