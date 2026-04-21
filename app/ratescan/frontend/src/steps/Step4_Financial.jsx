import { useEffect, useState } from 'react'
import Navigation from '../components/Navigation'
import { validate, allValid } from '../utils/validators'

const strip = (v) => String(v).replace(/[^0-9.]/g, '')
const fmt   = (v) => { const n = Number(strip(v)); return n ? n.toLocaleString('en-AU') : '' }

const MONTHLY_WEEKS = 52 / 12
const MONTHLY_FORTNIGHTS = 26 / 12

function fieldCls(touched, error) {
  if (touched && error)  return 'border-red-500 focus:border-red-400'
  if (touched && !error) return 'border-emerald-500 focus:border-emerald-400'
  return 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'
}

function ExpenseItem({ item, lineNumber, updateItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-6">{lineNumber}.</span>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{item.category}</span>
      <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input type="text" value={fmt(item.amount)} onChange={(e) => updateItem(lineNumber - 1, 'amount', strip(e.target.value))} placeholder="0" className="w-full pl-5 pr-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded text-sm" />
      </div>
      <select value={item.frequency} onChange={(e) => updateItem(lineNumber - 1, 'frequency', e.target.value)} className="bg-transparent text-sm border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
        <option value="monthly">Monthly</option>
        <option value="weekly">Weekly</option>
        <option value="fortnightly">Fortnightly</option>
      </select>
    </div>
  )
}

export default function Step4_Financial({ formData, updateField, onNext, onBack, isFirst }) {
  const [touched, setTouched] = useState({})
  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }))

  const totalMonthly = formData.expensesItems.reduce((sum, item) => {
    const amt = Number(strip(item.amount || 0))
    const mult = item.frequency === 'weekly' ? MONTHLY_WEEKS : item.frequency === 'fortnightly' ? MONTHLY_FORTNIGHTS : 1
    return sum + amt * mult
  }, 0)

  const expensesValue = Number(strip(formData.expenses))

  const errors = {
    income:   validate.currency(formData.income,   'Annual combined income'),
    expenses: validate.currency(formData.expenses, 'Monthly expenses'),
  }

  const income   = Number(strip(formData.income))
  const surplus  = income > 0 && expensesValue > 0 ? income / 12 - expensesValue : null

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Enter' && allValid(errors)) onNext() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const base  = 'w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-5 py-4 text-xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors'
  const label = 'block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2'

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Finances</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">What is your combined income and expenses?</h2>

      <div className="space-y-6">
        <div>
          <label className={label}>Annual Combined Income (gross)</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">$</span>
            <input type="text" inputMode="numeric" value={fmt(formData.income)}
              onChange={(e) => updateField('income', strip(e.target.value))}
              onBlur={() => touch('income')} placeholder="120,000"
              className={`${base} ${fieldCls(touched.income, errors.income)}`} />
          </div>
          {touched.income && errors.income && <p className="mt-2 text-sm text-red-500">{errors.income}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={label}>Monthly Expenses</label>
            <button type="button" onClick={() => updateField('isExpensesExpanded', !formData.isExpensesExpanded)} className="text-sm text-indigo-500 hover:text-indigo-600">
              {formData.isExpensesExpanded ? '−' : '+'}
            </button>
          </div>
          <div>
            <label className={`${label} mb-2`}>Total Monthly Expenses</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">$</span>
              <input type="text" inputMode="numeric" value={formData.isExpensesExpanded ? fmt(totalMonthly) : fmt(formData.expenses)}
                onChange={formData.isExpensesExpanded ? undefined : (e) => updateField('expenses', strip(e.target.value))}
                onBlur={formData.isExpensesExpanded ? undefined : () => touch('expenses')} placeholder="0"
                disabled={formData.isExpensesExpanded}
                className={`${base} ${formData.isExpensesExpanded ? 'bg-slate-100 dark:bg-slate-800' : ''} ${fieldCls(touched.expenses, errors.expenses)}`} />
            </div>
          </div>
          {formData.isExpensesExpanded && (
            <div className="space-y-4 mt-4">
              {formData.expensesItems.map((item, index) => (
                <ExpenseItem key={index} item={item} lineNumber={index + 1}
                  updateItem={(i, key, value) => {
                    const newItems = [...formData.expensesItems]
                    newItems[i] = { ...newItems[i], [key]: value }
                    updateField('expensesItems', newItems)
                    if (formData.isExpensesExpanded) {
                      const newTotal = newItems.reduce((sum, item) => {
                        const amt = Number(strip(item.amount || 0))
                        const mult = item.frequency === 'weekly' ? MONTHLY_WEEKS : item.frequency === 'fortnightly' ? MONTHLY_FORTNIGHTS : 1
                        return sum + amt * mult
                      }, 0)
                      updateField('expenses', newTotal.toString())
                    }
                  }} />
              ))}
            </div>
          )}
          {touched.expenses && errors.expenses && <p className="mt-2 text-sm text-red-500">{errors.expenses}</p>}
        </div>

        {surplus !== null && (
          <div className="animate-fade-in p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Estimated monthly surplus</p>
            <p className={`text-2xl font-semibold ${surplus >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              ${Math.abs(surplus).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-2">
                {surplus >= 0 ? 'remaining' : 'shortfall'}
              </span>
            </p>
          </div>
        )}
      </div>

      <Navigation onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={false} nextDisabled={!allValid(errors)} />
    </div>
  )
}
