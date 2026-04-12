import ThemeToggle from './ThemeToggle'

export default function ProgressBar({ current, total, isDark, onToggleTheme }) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          Step {current} of {total}
        </span>
      </div>
    </div>
  )
}
