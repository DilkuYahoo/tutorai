import ThemeToggle from './ThemeToggle'

export default function DashboardHeader({ isDark, onToggleTheme, onApply }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-4 sm:px-6
      bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800
      transition-colors duration-200">

      {/* Logo */}
      <div className="flex items-center gap-2 flex-1">
        <span className="text-indigo-500 font-bold text-lg tracking-tight">RateScan</span>
        <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-widest mt-0.5">
          Rates
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors duration-150"
        >
          Get My Rate
          <span className="ml-1 opacity-75">→</span>
        </button>
      </div>
    </header>
  )
}
