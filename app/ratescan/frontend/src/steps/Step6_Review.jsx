import Navigation from '../components/Navigation'

const strip = (v) => String(v).replace(/[^0-9.]/g, '')
const fmt   = (v) => { const n = Number(strip(v)); return n ? `$${n.toLocaleString('en-AU')}` : '—' }
const cap   = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : '—'
const RATE_TYPE_LABELS = { 'variable': 'Variable', 'fixed-1y': 'Fixed 1Y', 'fixed-2y': 'Fixed 2Y', 'fixed-3y': 'Fixed 3Y', 'fixed-4y': 'Fixed 4Y', 'fixed-5y': 'Fixed 5Y' }
const REPAYMENT_LABELS = { 'principal-and-interest': 'Principal & Interest', 'interest-only': 'Interest Only' }

function ReviewSection({ title, step, onGoTo, children }) {
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-medium">{title}</h3>
        <button type="button" onClick={() => onGoTo(step)}
          className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 transition-colors">
          Edit
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 dark:text-white font-medium text-right">{value || '—'}</span>
    </div>
  )
}

export default function Step6_Review({ formData, onBack, onGoTo, onSubmit, submitting, isFirst, isLast }) {
  const pv  = Number(strip(formData.propertyValue))
  const la  = Number(strip(formData.loanAmount))
  const lvr = pv > 0 && la > 0 ? ((la / pv) * 100).toFixed(1) : null

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Almost there</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-8 text-slate-900 dark:text-white">Review your details</h2>

      <div className="space-y-3">
        <ReviewSection title="Personal" step={1} onGoTo={onGoTo}>
          <Row label="Full Name"  value={formData.name} />
          <Row label="Age"        value={formData.age ? `${formData.age} years` : null} />
          <Row label="Mobile"     value={formData.mobile} />
          <Row label="Email"      value={formData.email} />
        </ReviewSection>

        <ReviewSection title="Property" step={2} onGoTo={onGoTo}>
          <Row label="Purpose"          value={formData.propertyPurpose === 'live-in' ? 'Live In' : formData.propertyPurpose === 'investment' ? 'Investment' : null} />
          <Row label="Loan Purpose"   value={cap(formData.loanPurpose)} />
          <Row label="Rate Type"      value={RATE_TYPE_LABELS[formData.rateType] || null} />
          <Row label="Repayment Type" value={REPAYMENT_LABELS[formData.repaymentType] || null} />
          <Row label="Property Value" value={fmt(formData.propertyValue)} />
          <Row label="Loan Amount"    value={fmt(formData.loanAmount)} />
          {lvr && <Row label="LVR"   value={`${lvr}%`} />}
        </ReviewSection>

        <ReviewSection title="Employment" step={3} onGoTo={onGoTo}>
          <Row label="Type" value={cap(formData.employmentType)} />
        </ReviewSection>

        <ReviewSection title="Finances" step={4} onGoTo={onGoTo}>
          <Row label="Annual Income"    value={fmt(formData.income)} />
          <Row label="Monthly Expenses" value={fmt(formData.expenses)} />
        </ReviewSection>

        <ReviewSection title="Lifestyle" step={5} onGoTo={onGoTo}>
          <Row label="Dependants" value={formData.dependants === 8 ? '8+' : String(formData.dependants)} />
          {formData.otherInfo && <Row label="Other Info" value={formData.otherInfo} />}
        </ReviewSection>
      </div>

      <Navigation onBack={onBack} onSubmit={onSubmit} isFirst={isFirst} isLast={isLast} submitting={submitting} />
    </div>
  )
}
