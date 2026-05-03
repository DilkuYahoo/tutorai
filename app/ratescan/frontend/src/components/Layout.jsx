import DashboardHeader from './DashboardHeader'
import SiteFooter from './SiteFooter'

export default function Layout({ children, isDark, onToggleTheme, onApply, onTerms, onPrivacy, onContact, onHome, onMortgageRates, onOtherRates, onRecentChanges, onLenders, onBrokers, buttonText }) {
  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
      <DashboardHeader
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        onApply={onApply}
        onPrivacy={onPrivacy}
        onContact={onContact}
        onHome={onHome}
        onMortgageRates={onMortgageRates}
        onOtherRates={onOtherRates}
        onRecentChanges={onRecentChanges}
        onLenders={onLenders}
        onBrokers={onBrokers}
        buttonText={buttonText}
      />
      {children}
      <SiteFooter
        onTerms={onTerms}
        onPrivacy={onPrivacy}
        onContact={onContact}
        onBrokers={onBrokers}
      />
    </div>
  )
}