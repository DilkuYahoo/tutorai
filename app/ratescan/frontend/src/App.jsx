import { useReducer, useCallback, useState, useEffect } from 'react'
import ProgressBar from './components/ProgressBar'
import StepWrapper from './components/StepWrapper'
import Step1_Personal from './steps/Step1_Personal'
import Step2_Property from './steps/Step2_Property'
import Step3_Employment from './steps/Step3_Employment'
import Step4_Financial from './steps/Step4_Financial'
import Step5_Lifestyle from './steps/Step5_Lifestyle'
import Step6_Review from './steps/Step6_Review'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ContactPage from './pages/ContactPage'
import BrokerPage from './pages/BrokerPage'
import LendersPage from './pages/LendersPage'
import DashboardHeader from './components/DashboardHeader'
import SiteFooter from './components/SiteFooter'

const TOTAL_STEPS = 6

const initialState = {
  currentStep: 1,
  direction: 'forward',
  submitting: false,
  submitted: false,
  applicationId: null,
  formData: {
    name: '',
    age: '',
    mobile: '',
    email: '',
    propertyValue: '',
    loanAmount: '',
    propertyPurpose: '',
    loanPurpose: '',
    rateType: '',
    repaymentType: '',
    employmentType: '',
    income: '',
    expenses: '',
    expensesItems: [
      { category: 'Rent/Mortgage', amount: '', frequency: 'monthly' },
      { category: 'Utilities', amount: '', frequency: 'monthly' },
      { category: 'Groceries', amount: '', frequency: 'weekly' },
      { category: 'Transport', amount: '', frequency: 'monthly' },
      { category: 'Insurance', amount: '', frequency: 'monthly' },
      { category: 'Entertainment', amount: '', frequency: 'monthly' },
      { category: 'Dining Out', amount: '', frequency: 'monthly' },
      { category: 'Clothing', amount: '', frequency: 'monthly' },
      { category: 'Personal Care', amount: '', frequency: 'monthly' },
      { category: 'Childcare/Education', amount: '', frequency: 'monthly' },
      { category: 'Other', amount: '', frequency: 'monthly' },
    ],
    isExpensesExpanded: false,
    dependants: 0,
    otherInfo: '',
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'NEXT':
      return { ...state, direction: 'forward', currentStep: Math.min(state.currentStep + 1, TOTAL_STEPS) }
    case 'BACK':
      return { ...state, direction: 'back', currentStep: Math.max(state.currentStep - 1, 1) }
    case 'GO_TO_STEP':
      return { ...state, direction: action.step < state.currentStep ? 'back' : 'forward', currentStep: action.step }
    case 'UPDATE_FIELD':
      return { ...state, formData: { ...state.formData, [action.field]: action.value } }
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value }
    case 'SUBMIT_SUCCESS':
      return { ...state, submitting: false, submitted: true, applicationId: action.id }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

const STEPS = [Step1_Personal, Step2_Property, Step3_Employment, Step4_Financial, Step5_Lifestyle, Step6_Review]

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { currentStep, direction, submitting, submitted, applicationId, formData } = state

  const [isDark, setIsDark] = useState(true)
  const [page, setPage] = useState('dashboard')
const [matchedRates, setMatchedRates] = useState([])

  const navigateHome = () => setPage('dashboard')
  const navigateMortgageRates = () => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }
  const navigateOtherRates = () => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }
  const navigateRecentChanges = () => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [isDark])

  const toggleTheme = useCallback(() => setIsDark((d) => !d), [])
  const updateField = useCallback((field, value) => dispatch({ type: 'UPDATE_FIELD', field, value }), [])
  const handleNext  = useCallback(() => dispatch({ type: 'NEXT' }), [])
  const handleBack  = useCallback(() => dispatch({ type: 'BACK' }), [])
  const handleGoTo  = useCallback((step) => dispatch({ type: 'GO_TO_STEP', step }), [])

  const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SET_SUBMITTING', value: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const [appRes, ratesRes] = await Promise.allSettled([
        fetch(`${apiUrl}/application`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }),
        fetch(`${apiUrl}/rates/matched`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyPurpose: formData.propertyPurpose,
            loanPurpose:     formData.loanPurpose,
            rateType:        formData.rateType,
            repaymentType:   formData.repaymentType,
            propertyValue:   formData.propertyValue,
            loanAmount:      formData.loanAmount,
          }),
        }),
      ])
      const appData = appRes.status === 'fulfilled' ? await appRes.value.json() : {}
      if (ratesRes.status === 'fulfilled') {
        try { setMatchedRates(await ratesRes.value.json()) } catch { /* ignore */ }
      }
      dispatch({ type: 'SUBMIT_SUCCESS', id: appData.id })
    } catch {
      dispatch({ type: 'SET_SUBMITTING', value: false })
    }
  }, [formData])

  const CurrentStep = STEPS[currentStep - 1]

  if (page === 'terms') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
      >
        <TermsPage onBack={() => setPage('dashboard')} />
      </Layout>
    )
  }

  if (page === 'privacy') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
      >
        <PrivacyPage onBack={() => setPage('dashboard')} />
      </Layout>
    )
  }

  if (page === 'contact') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
      >
        <ContactPage onBack={() => setPage('dashboard')} />
      </Layout>
    )
  }

  if (page === 'brokers') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => {}}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
        onBrokers={() => setPage('brokers')}
      >
        <BrokerPage
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onHome={() => setPage('dashboard')}
          onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
          onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
          onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
          onLenders={() => setPage('lenders')}
          onTerms={() => setPage('terms')}
          onPrivacy={() => setPage('privacy')}
          onContact={() => setPage('contact')}
          onBrokers={() => setPage('brokers')}
        />
      </Layout>
    )
  }

  if (page === 'lenders') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
      >
        <LendersPage onBack={() => setPage('dashboard')} />
      </Layout>
    )
  }

  if (page === 'dashboard') {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onMortgageRates={() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' })}
        onOtherRates={() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' })}
        onRecentChanges={() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' })}
        onLenders={() => setPage('lenders')}
        buttonText="Get My Rate →"
      >
        <Dashboard
          isDark={isDark}
          onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        />
      </Layout>
    )
  }

  if (submitted) {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => setPage('dashboard')}
        onTerms={() => setPage('terms')}
        onPrivacy={() => setPage('privacy')}
        onContact={() => setPage('contact')}
        onHome={() => setPage('dashboard')}
        onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
        onLenders={() => setPage('lenders')}
        buttonText="← Back to Rates"
      >
        <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
          <div className="w-full max-w-xl animate-fade-in">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-semibold mb-3 text-slate-900 dark:text-white">You're all set!</h1>
              <p className="text-slate-500 dark:text-slate-400 mb-2">Your application has been submitted.</p>
              {applicationId && (
                <p className="text-xs text-slate-400 dark:text-slate-600 font-mono">ID: {applicationId}</p>
              )}
            </div>

            <div className="mb-10">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 leading-relaxed text-center">
                We are not authorised to provide financial, credit, or lending advice. The information below is
                for general research purposes only and does not constitute a recommendation or offer of credit.
                A qualified mortgage broker will contact you as soon as possible to discuss your options.
              </p>

              {matchedRates.length > 0 ? (
                <>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 font-medium text-center">
                    Based on our research, the following products may be suited to your needs
                  </p>
                  <div className="space-y-3">
                    {matchedRates.map((r, i) => (
                      <div key={i} className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.brand}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{r.productName}</p>
                          {r.comparisonRate && (
                            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Comparison {r.comparisonRate.toFixed(2)}% p.a.</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">{r.rate.toFixed(2)}<span className="text-sm font-normal text-slate-400">%</span></p>
                          {r.applicationUri && (
                            <a href={r.applicationUri} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline mt-1 inline-block">
                              View product →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-600 text-center mt-4">
                    Advertised rates only. Actual rate and eligibility determined by the lender.
                  </p>
                </>
              ) : (
                <div className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">We're on it</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                    We weren't able to identify a matching product in our current dataset for your selected criteria.
                    A broker will review your application and reach out shortly with the most suitable options available to you.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => { dispatch({ type: 'RESET' }); setMatchedRates([]) }}
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 text-sm transition-colors"
              >
                Start a new application
              </button>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
              <button
                onClick={() => { dispatch({ type: 'RESET' }); setMatchedRates([]); setPage('dashboard') }}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white underline underline-offset-2 text-sm transition-colors"
              >
                ← View rates
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      isDark={isDark}
      onToggleTheme={toggleTheme}
      onApply={() => setPage('dashboard')}
      onTerms={() => setPage('terms')}
      onPrivacy={() => setPage('privacy')}
      onContact={() => setPage('contact')}
      onHome={() => setPage('dashboard')}
      onMortgageRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('mortgage-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
      onOtherRates={() => { setPage('dashboard'); setTimeout(() => document.getElementById('other-rates')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
      onRecentChanges={() => { setPage('dashboard'); setTimeout(() => document.getElementById('recent-changes')?.scrollIntoView({ behavior: 'smooth' }), 100) }}
      onLenders={() => setPage('lenders')}
      onBrokers={() => setPage('brokers')}
      buttonText="← Back to Rates"
    >
      <main className="flex-1 flex flex-col">
        <div className="pt-20 pb-8">
          <ProgressBar current={currentStep} total={TOTAL_STEPS} />
        </div>
        <div className="flex-1 flex items-center justify-center px-4 pb-12">
          <div className="w-full max-w-xl">
            <StepWrapper key={currentStep} direction={direction}>
              <CurrentStep
                formData={formData}
                updateField={updateField}
                onNext={handleNext}
                onBack={handleBack}
                onGoTo={handleGoTo}
                onSubmit={handleSubmit}
                submitting={submitting}
                isFirst={currentStep === 1}
                isLast={currentStep === TOTAL_STEPS}
              />
            </StepWrapper>
          </div>
        </div>
      </main>
    </Layout>
  )
}
