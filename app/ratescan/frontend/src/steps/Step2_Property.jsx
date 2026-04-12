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

function LVRBadge({ lvr }) {
  if (!lvr) return null
  const pct   = (lvr * 100).toFixed(1)
  const color = lvr <= 0.8
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
    : lvr <= 0.9
    ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold ${color}`}>
      <span>LVR {pct}%</span>
      {lvr <= 0.8 && <span className="text-xs font-normal opacity-70">Good</span>}
      {lvr > 0.8 && lvr <= 0.9 && <span className="text-xs font-normal opacity-70">Higher risk</span>}
      {lvr > 0.9  && <span className="text-xs font-normal opacity-70">LMI likely</span>}
    </div>
  )
}

const btnCls = (selected) =>
  `px-5 py-4 rounded-xl border text-left transition-all duration-150 ${
    selected
      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-500'
  }`

const PURPOSE_OPTIONS = [
  { value: 'live-in',    label: 'Live In',    sub: 'Owner occupied' },
  { value: 'investment', label: 'Investment', sub: 'Rental / portfolio' },
]

const LOAN_OPTIONS = [
  { value: 'first-home',   label: 'First Home Buyer',  sub: 'Buying your first property' },
  { value: 'refinance',    label: 'Refinance',         sub: 'Switch from existing loan' },
  { value: 'renovate',     label: 'Renovate',          sub: 'Fund home improvements' },
  { value: 'off-the-plan', label: 'Off the Plan',      sub: 'Pre-construction purchase' },
  { value: 'land-build',   label: 'Land & Build',      sub: 'Buy land, then construct' },
  { value: 'upgrade',      label: 'Upgrade / Upsize',  sub: 'Move to a bigger home' },
  { value: 'downsize',     label: 'Downsize',          sub: 'Move to a smaller home' },
  { value: 'other',        label: 'Other',             sub: 'Something else' },
]

export default function Step2_Property({ formData, updateField, onNext, onBack, isFirst }) {
  const [touched, setTouched] = useState({})
  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }))

  const errors = {
    propertyValue:   validate.currency(formData.propertyValue, 'Property value'),
    loanAmount:      validate.loanAmount(formData.loanAmount, formData.propertyValue),
    propertyPurpose: formData.propertyPurpose ? null : 'Please select a property purpose',
    loanPurpose:     formData.loanPurpose     ? null : 'Please select a loan purpose',
  }

  const pv  = Number(strip(formData.propertyValue))
  const la  = Number(strip(formData.loanAmount))
  const lvr = pv > 0 && la > 0 && la <= pv ? la / pv : null

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Enter' && allValid(errors)) onNext() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const base  = 'w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-5 py-4 text-xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors'
  const label = 'block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2'

  const BtnLabel = ({ selected, label, sub }) => (
    <>
      <p className={`font-semibold text-sm ${selected ? 'text-indigo-600 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
    </>
  )

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Property details</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">What's the property value?</h2>

      <div className="space-y-6">
        <div>
          <label className={label}>Property Value</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">$</span>
            <input type="text" inputMode="numeric" value={fmt(formData.propertyValue)}
              onChange={(e) => updateField('propertyValue', strip(e.target.value))}
              onBlur={() => touch('propertyValue')} placeholder="750,000"
              className={`${base} ${fieldCls(touched.propertyValue, errors.propertyValue)}`} />
          </div>
          {touched.propertyValue && errors.propertyValue && <p className="mt-2 text-sm text-red-500">{errors.propertyValue}</p>}
        </div>

        <div>
          <label className={label}>Loan Amount</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">$</span>
            <input type="text" inputMode="numeric" value={fmt(formData.loanAmount)}
              onChange={(e) => updateField('loanAmount', strip(e.target.value))}
              onBlur={() => touch('loanAmount')} placeholder="600,000"
              className={`${base} ${fieldCls(touched.loanAmount, errors.loanAmount)}`} />
          </div>
          {touched.loanAmount && errors.loanAmount && <p className="mt-2 text-sm text-red-500">{errors.loanAmount}</p>}
        </div>

        {lvr && <div className="animate-fade-in"><LVRBadge lvr={lvr} /></div>}

        <div>
          <label className={label}>Property Purpose</label>
          <div className="grid grid-cols-2 gap-3">
            {PURPOSE_OPTIONS.map(({ value, label, sub }) => (
              <button key={value} type="button" onClick={() => updateField('propertyPurpose', value)}
                className={btnCls(formData.propertyPurpose === value)}>
                <BtnLabel selected={formData.propertyPurpose === value} label={label} sub={sub} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={label}>Loan Purpose</label>
          <div className="grid grid-cols-2 gap-3">
            {LOAN_OPTIONS.map(({ value, label, sub }) => (
              <button key={value} type="button" onClick={() => updateField('loanPurpose', value)}
                className={btnCls(formData.loanPurpose === value)}>
                <BtnLabel selected={formData.loanPurpose === value} label={label} sub={sub} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <Navigation onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={false} nextDisabled={!allValid(errors)} />
    </div>
  )
}
