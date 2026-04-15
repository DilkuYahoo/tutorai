import ThemeToggle from './ThemeToggle'

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <polygon points="11,2 20,11 11,20 2,11" fill="#6366f1" />
      <polygon points="11,6 16,11 11,16 6,11" fill="#818cf8" opacity="0.6" />
    </svg>
  )
}

export default function DashboardHeader({ isDark, onToggleTheme, onApply }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-4 sm:px-6
      bg-white/90 dark:bg-slate-950/90 backdrop-blur-md
      border-b border-slate-200/60 dark:border-slate-800
      transition-colors duration-200">

      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-1">
        <LogoMark />
        <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight">
          Rate<span className="text-indigo-500">Scan</span>
        </span>
        <span className="hidden sm:inline text-slate-200 dark:text-slate-700 select-none ml-1">|</span>
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
          Australian Interest Rates
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-semibold transition-colors duration-150 shadow-sm shadow-indigo-500/20"
        >
          Get My Rate →
        </button>
      </div>
    </header>
  )
}
