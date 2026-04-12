import { useEffect, useState } from 'react'
import Navigation from '../components/Navigation'
import { validate, allValid } from '../utils/validators'

const strip = (v) => String(v).replace(/[^0-9.]/g, '')
const fmt   = (v) => { const n = Number(strip(v)); return n ? n.toLocaleString('en-AU') : '' }

function fieldCls(touched, error) {
  if (touched && error)  return 'border-red-500 focus:border-red-400'
  if (touched && !error) return 'border-emerald-500 focus:border-emerald-400'
  return 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'
}

export default function Step4_Financial({ formData, updateField, onNext, onBack, isFirst }) {
  const [touched, setTouched] = useState({})
  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }))

  const errors = {
    income:   validate.currency(formData.income,   'Annual income'),
    expenses: validate.currency(formData.expenses, 'Monthly expenses'),
  }

  const income   = Number(strip(formData.income))
  const expenses = Number(strip(formData.expenses))
  const surplus  = income > 0 && expenses > 0 ? income / 12 - expenses : null

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
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">What are your income and expenses?</h2>

      <div className="space-y-6">
        <div>
          <label className={label}>Annual Income (gross)</label>
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
          <label className={label}>Monthly Expenses</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">$</span>
            <input type="text" inputMode="numeric" value={fmt(formData.expenses)}
              onChange={(e) => updateField('expenses', strip(e.target.value))}
              onBlur={() => touch('expenses')} placeholder="3,500"
              className={`${base} ${fieldCls(touched.expenses, errors.expenses)}`} />
          </div>
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
