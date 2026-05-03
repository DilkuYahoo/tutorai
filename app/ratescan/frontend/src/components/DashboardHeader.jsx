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

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  )
}

function MobileNavItem({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200
        hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-500 dark:hover:text-indigo-400
        transition-colors duration-150"
    >
      {children}
    </button>
  )
}

export default function DashboardHeader({ isDark, onToggleTheme, onApply, onPrivacy, onContact, onHome, onMortgageRates, onOtherRates, onRecentChanges, onLenders, onBrokers, buttonText = '' }) {
  const [ratesDropdownOpen, setRatesDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
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

        {/* Desktop Navigation */}
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
          <button onClick={onBrokers} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Brokers</button>
          <button onClick={onContact} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Contact Us</button>
          <button onClick={onPrivacy} className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">Privacy</button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          {buttonText && (
            <button
              type="button"
              onClick={onApply}
              className="hidden sm:block px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-semibold transition-colors duration-150 shadow-sm shadow-indigo-500/20"
            >
              {buttonText}
            </button>
          )}
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <XIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <nav className="fixed top-14 inset-x-0 z-40 md:hidden bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-lg px-3 py-3">
            <MobileNavItem onClick={() => { closeMobile(); onHome(); }}>Home</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onMortgageRates(); }}>Mortgage Rates</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onOtherRates(); }}>Other Rates</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onRecentChanges(); }}>Recent Changes</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onLenders(); }}>Lenders</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onBrokers(); }}>Brokers</MobileNavItem>            <MobileNavItem onClick={() => { closeMobile(); onContact(); }}>Contact Us</MobileNavItem>
            <MobileNavItem onClick={() => { closeMobile(); onPrivacy(); }}>Privacy</MobileNavItem>
            {buttonText && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { closeMobile(); onApply(); }}
                  className="w-full px-4 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors duration-150"
                >
                  {buttonText}
                </button>
              </div>
            )}
          </nav>
        </>
      )}
    </>
  )
}
