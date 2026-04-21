import { useReducer, useCallback, useState, useEffect } from 'react'
import ProgressBar from './components/ProgressBar'
import StepWrapper from './components/StepWrapper'
import Step1_Personal from './steps/Step1_Personal'
import Step2_Property from './steps/Step2_Property'
import Step3_Employment from './steps/Step3_Employment'
import Step4_Financial from './steps/Step4_Financial'
import Step5_Lifestyle from './steps/Step5_Lifestyle'
import Step6_Review from './steps/Step6_Review'
import Dashboard from './pages/Dashboard'
import TermsPage from './pages/TermsPage'
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
  const [page, setPage]     = useState('dashboard') // 'dashboard' | 'apply'

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
      const res = await fetch(`${apiUrl}/application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      dispatch({ type: 'SUBMIT_SUCCESS', id: data.id })
    } catch {
      dispatch({ type: 'SET_SUBMITTING', value: false })
    }
  }, [formData])

  const CurrentStep = STEPS[currentStep - 1]

  if (page === 'terms') {
    return <TermsPage onBack={() => setPage('dashboard')} />
  }

  if (page === 'dashboard') {
    return (
      <Dashboard
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onApply={() => { dispatch({ type: 'RESET' }); setPage('apply') }}
        onTerms={() => setPage('terms')}
      />
    )
  }

  if (submitted) {
    return (
      <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
        <DashboardHeader isDark={isDark} onToggleTheme={toggleTheme} onApply={() => setPage('dashboard')} buttonText="← Back to Rates" />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold mb-3 text-slate-900 dark:text-white">You're all set!</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-2">Your application has been submitted.</p>
            {applicationId && (
              <p className="text-xs text-slate-400 dark:text-slate-600 font-mono mb-8">ID: {applicationId}</p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => dispatch({ type: 'RESET' })}
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 text-sm transition-colors"
              >
                Start a new application
              </button>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
              <button
                onClick={() => { dispatch({ type: 'RESET' }); setPage('dashboard') }}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white underline underline-offset-2 text-sm transition-colors"
              >
                ← View rates
              </button>
            </div>
          </div>
        </div>
        <SiteFooter onTerms={() => setPage('terms')} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-200`}>
      <DashboardHeader isDark={isDark} onToggleTheme={toggleTheme} onApply={() => setPage('dashboard')} buttonText="← Back to Rates" />
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
      <SiteFooter onTerms={() => setPage('terms')} />
    </div>
  )
}
