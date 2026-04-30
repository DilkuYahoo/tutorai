import { useState } from 'react'
import ThemeToggle from './ThemeToggle'

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <polygon points="11,2 20,11 11,20 2,11" fill="#6366f1" />
      <polygon points="11,6 16,11 11,16 6,11" fill="#818cf8" opacity="0.6" />
    </svg>
  )
}

export default function DashboardHeader({ isDark, onToggleTheme, onApply, onPrivacy, onContact, onHome, onMortgageRates, onOtherRates, onRecentChanges, onLenders, buttonText = '' }) {
  const [ratesDropdownOpen, setRatesDropdownOpen] = useState(false)
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-4 sm:px-6
      bg-white/90 dark:bg-slate-950/90 backdrop-blur-md
      border-b border-slate-200/60 dark:border-slate-800
      transition-colors duration-200">

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight">
          Rate<span className="text-indigo-500">Scan</span>
        </span>
        <span className="hidden sm:inline text-slate-200 dark:text-slate-700 select-none ml-1">|</span>
        <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
          Australian Interest Rates
        </span>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex items-center space-x-6 flex-1 justify-center relative">
        <button onClick={onHome} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Home</button>
        <div className="relative">
          <button onClick={() => setRatesDropdownOpen(!ratesDropdownOpen)} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
            Rates <span className={`transition-transform ${ratesDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {ratesDropdownOpen && (
            <div className="absolute top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 min-w-48 z-10">
              <button onClick={() => { setRatesDropdownOpen(false); onMortgageRates(); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Mortgage Rates</button>
              <button onClick={() => { setRatesDropdownOpen(false); onOtherRates(); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Other Rates</button>
              <button onClick={() => { setRatesDropdownOpen(false); onRecentChanges(); }} className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Recent Changes</button>
            </div>
          )}
        </div>
        <button onClick={onLenders} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Lenders</button>
        <button onClick={onContact} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Contact Us</button>
        <button onClick={onPrivacy} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Privacy Statement</button>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        {buttonText && (
          <button
            type="button"
            onClick={onApply}
            className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-semibold transition-colors duration-150 shadow-sm shadow-indigo-500/20"
          >
            {buttonText}
          </button>
        )}
      </div>
    </header>
  )
}
