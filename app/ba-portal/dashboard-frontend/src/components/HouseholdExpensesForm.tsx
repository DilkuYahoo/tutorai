import React, { useState, useEffect } from 'react';

// TypeScript interfaces
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
    members: number;
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

// Predefined expense categories
const ESSENTIAL_CATEGORIES = [
  'rentMortgage',
  'utilities',
  'groceries',
  'transport',
  'insurance',
  'education',
  'healthcare'
] as const;

const NON_ESSENTIAL_CATEGORIES = [
  'diningOut',
  'entertainment',
  'subscriptions',
  'holidays',
  'shopping',
  'miscellaneous'
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
  miscellaneous: 'Miscellaneous'
} as const;

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' }
];

// Helper functions
const normalizeToMonthly = (amount: number, frequency: string): number => {
  switch (frequency) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'fortnightly':
      return (amount * 26) / 12;
    case 'monthly':
      return amount;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const HouseholdExpensesForm: React.FC<HouseholdExpensesFormProps> = ({
  onSave,
  initialData,
  numInvestors = 0,
  initialEssentialTotal,
  initialNonEssentialTotal
}) => {
  // Initialize state
  const [data, setData] = useState<HouseholdExpensesData>(() => {
    const defaultExpenseItem = { amount: 0, frequency: 'monthly' as const, monthlyValue: 0 };

    const initialEssentials = ESSENTIAL_CATEGORIES.reduce((acc, cat) => ({
      ...acc,
      [cat]: { ...defaultExpenseItem }
    }), {});
    const initialNonEssentials = NON_ESSENTIAL_CATEGORIES.reduce((acc, cat) => ({
      ...acc,
      [cat]: { ...defaultExpenseItem }
    }), {});

    // Set default categories if initial totals provided
    if (initialEssentialTotal !== undefined && initialEssentialTotal > 0) {
      const monthlyEssential = initialEssentialTotal / 12;
      (initialEssentials as any)['healthcare'] = {
        amount: monthlyEssential,
        frequency: 'monthly' as const,
        monthlyValue: monthlyEssential
      };
    }
    if (initialNonEssentialTotal !== undefined && initialNonEssentialTotal > 0) {
      const monthlyNonEssential = initialNonEssentialTotal / 12;
      (initialNonEssentials as any)['miscellaneous'] = {
        amount: monthlyNonEssential,
        frequency: 'monthly' as const,
        monthlyValue: monthlyNonEssential
      };
    }

    return {
      essentials: initialEssentials,
      nonEssentials: initialNonEssentials,
      totals: {
        essentialTotal: 0,
        nonEssentialTotal: 0,
        overallTotal: 0
      },
      split: {
        enabled: false,
        members: 1,
        perPersonExpense: 0
      },
      ...initialData
    };
  });

  // Calculate totals whenever data changes
  useEffect(() => {
    const calculateTotals = () => {
      let essentialTotal = 0;
      let nonEssentialTotal = 0;

      Object.values(data.essentials).forEach(item => {
        essentialTotal += item.monthlyValue;
      });

      Object.values(data.nonEssentials).forEach(item => {
        nonEssentialTotal += item.monthlyValue;
      });

      const overallTotal = essentialTotal + nonEssentialTotal;
      const perPersonExpense = data.split.enabled && data.split.members > 0
        ? overallTotal / data.split.members
        : 0;

      setData(prev => ({
        ...prev,
        totals: {
          essentialTotal,
          nonEssentialTotal,
          overallTotal
        },
        split: {
          ...prev.split,
          perPersonExpense
        }
      }));
    };

    calculateTotals();
  }, [data.essentials, data.nonEssentials, data.split.members, data.split.enabled]);

  // Update expense item
  const updateExpense = (
    category: 'essentials' | 'nonEssentials',
    key: string,
    field: 'amount' | 'frequency',
    value: number | string
  ) => {
    setData(prev => {
      const updatedItem = { ...prev[category][key] };

      if (field === 'amount') {
        updatedItem.amount = value as number;
      } else if (field === 'frequency') {
        updatedItem.frequency = value as ExpenseItem['frequency'];
      }

      updatedItem.monthlyValue = normalizeToMonthly(updatedItem.amount, updatedItem.frequency);

      return {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: updatedItem
        }
      };
    });
  };

  // Update split settings
  const updateSplit = (field: 'enabled' | 'members', value: boolean | number) => {
    setData(prev => ({
      ...prev,
      split: {
        ...prev.split,
        [field]: value
      }
    }));
  };

  // Render expense input row
  const renderExpenseRow = (
    category: 'essentials' | 'nonEssentials',
    key: string,
    label: string
  ) => {
    const item = data[category][key];

    return (
      <div key={key} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            {label}
          </label>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <div className="flex-1">
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.amount || ''}
              onChange={(e) => updateExpense(category, key, 'amount', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 dark:bg-gray-700 dark:text-white"
              placeholder="0.00"
            />
          </div>
          <div className="w-32">
            <select
              value={item.frequency}
              onChange={(e) => updateExpense(category, key, 'frequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 dark:bg-gray-700 dark:text-white"
            >
              {FREQUENCIES.map(freq => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="md:col-span-1 text-right">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Annual:</div>
          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(item.monthlyValue * 12)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Household Expenses Form
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Track and calculate your household expenses
        </p>
      </div>

      {/* Essential Expenses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Essential Expenses
          </h2>
          <div className="text-right">
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Annual</div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
              {formatCurrency(data.totals.essentialTotal * 12)}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {ESSENTIAL_CATEGORIES.map(cat => renderExpenseRow('essentials', cat, CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]))}
        </div>
      </div>

      {/* Non-Essential Expenses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Non-Essential Expenses
          </h2>
          <div className="text-right">
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Annual</div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
              {formatCurrency(data.totals.nonEssentialTotal * 12)}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {NON_ESSENTIAL_CATEGORIES.map(cat => renderExpenseRow('nonEssentials', cat, CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]))}
        </div>
      </div>

      {/* Overall Summary */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Annual Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Essential</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(data.totals.essentialTotal * 12)}
            </div>
          </div>
          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Non-Essential</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(data.totals.nonEssentialTotal * 12)}
            </div>
          </div>
          <div className="text-center p-4 rounded-lg border-2" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
            <div className="text-sm">Total</div>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totals.overallTotal * 12)}
            </div>
          </div>
        </div>
      </div>

      {numInvestors > 1 && (
        <>
          {/* Household Splitting */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Household Splitting
            </h3>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={data.split.enabled}
                  onChange={(e) => updateSplit('enabled', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500 dark:bg-gray-700"
                />
                <span style={{ color: 'var(--text-primary)' }}>Split between household members?</span>
              </label>
            </div>
            {data.split.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    Number of Members
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={data.split.members}
                    onChange={(e) => updateSplit('members', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    Per Person Annual
                  </label>
                  <div className="text-2xl font-bold py-2" style={{ color: 'var(--accent-primary)' }}>
                    {formatCurrency(data.split.perPersonExpense * 12)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="text-center">
        <button
          onClick={() => onSave?.(data)}
          className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
        >
          Save Household Expenses
        </button>
      </div>
    </div>
  );
};

export default HouseholdExpensesForm;