export default function Navigation({
  onBack,
  onNext,
  onSubmit,
  isFirst,
  isLast,
  nextDisabled = false,
  submitting = false,
  nextLabel = 'Continue',
}) {
  return (
    <div className={`flex items-center mt-10 ${isFirst ? 'justify-end' : 'justify-between'}`}>
      {!isFirst && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-8 py-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-semibold transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}

      {isLast ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="px-8 py-3 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Submitting…
            </>
          ) : (
            'Submit Application'
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="px-8 py-3 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200"
        >
          {nextLabel}
        </button>
      )}
    </div>
  )
}
