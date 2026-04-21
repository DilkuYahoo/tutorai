export default function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-end px-0 pt-2 pb-1">
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          Step {current} of {total}
        </span>
      </div>
    </div>
  )
}
