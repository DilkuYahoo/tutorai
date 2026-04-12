import Navigation from '../components/Navigation'

export default function Step5_Lifestyle({ formData, updateField, onNext, onBack, isFirst }) {
  const dep = formData.dependants
  const inc = () => updateField('dependants', Math.min(dep + 1, 8))
  const dec = () => updateField('dependants', Math.max(dep - 1, 0))

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Lifestyle</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">A little more about you</h2>

      <div className="space-y-8">
        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
            Number of Dependants
          </label>
          <div className="flex items-center gap-6">
            <button type="button" onClick={dec} disabled={dep === 0}
              className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl font-light text-slate-700 dark:text-white hover:border-slate-300 dark:hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center">
              −
            </button>
            <span className="text-4xl font-semibold w-8 text-center tabular-nums text-slate-900 dark:text-white">
              {dep === 8 ? '8+' : dep}
            </span>
            <button type="button" onClick={inc} disabled={dep === 8}
              className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl font-light text-slate-700 dark:text-white hover:border-slate-300 dark:hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center">
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
            Other Information{' '}
            <span className="normal-case text-slate-400 dark:text-slate-600">(optional)</span>
          </label>
          <textarea
            value={formData.otherInfo}
            onChange={(e) => updateField('otherInfo', e.target.value)}
            placeholder="e.g. refinancing existing loan, investment property…"
            rows={4}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-base text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>
      </div>

      <Navigation onBack={onBack} onNext={onNext} isFirst={isFirst} isLast={false} nextDisabled={false} />
    </div>
  )
}
