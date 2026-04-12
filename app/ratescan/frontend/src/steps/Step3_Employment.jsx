import Navigation from '../components/Navigation'

const OPTIONS = [
  { value: 'full-time',     label: 'Full-time',     sub: 'Permanent employee' },
  { value: 'part-time',     label: 'Part-time',     sub: 'Regular reduced hours' },
  { value: 'self-employed', label: 'Self-employed', sub: 'Business owner / sole trader' },
  { value: 'casual',        label: 'Casual',        sub: 'Variable hours' },
  { value: 'contractor',    label: 'Contractor',    sub: 'Fixed-term contract' },
  { value: 'retired',       label: 'Retired',       sub: 'No longer working' },
]

export default function Step3_Employment({ formData, updateField, onNext, onBack, isFirst }) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Employment</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">What best describes your employment?</h2>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ value, label, sub }) => {
          const selected = formData.employmentType === value
          return (
            <button key={value} type="button" onClick={() => updateField('employmentType', value)}
              className={`px-5 py-4 rounded-xl border text-left transition-all duration-150 ${
                selected
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-500'
              }`}>
              <p className={`font-semibold text-sm ${selected ? 'text-indigo-600 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
            </button>
          )
        })}
      </div>

      <Navigation onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={false} nextDisabled={!formData.employmentType} />
    </div>
  )
}
