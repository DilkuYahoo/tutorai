import { useState, useEffect, useMemo } from 'react'
import DashboardHeader from '../components/DashboardHeader'
import StatCard from '../components/StatCard'
import RateChart, { buildTermTrendOption } from '../components/RateChart'
import RecentChangesTable from '../components/RecentChangesTable'
import { RATE_SUMMARY as MOCK_SUMMARY, RECENT_CHANGES as MOCK_CHANGES } from '../data/mockRates'

const API = import.meta.env.VITE_API_URL || ''

// ── skeleton primitives ───────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />
}

function CardsSkeleton() {
  return (
    <section>
      <div className="mb-4 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-1">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </section>
  )
}

function PanelSkeleton({ rows = 3 }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-${rows} gap-3`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-1">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <div className="mb-5 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <section>
      <div className="mb-4 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-3 flex gap-4">
          {[8, 32, 20, 16, 12].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w}`} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 px-4 py-3.5 flex items-center gap-4 border-t border-slate-100 dark:border-slate-800">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-medium text-red-500 dark:text-red-400 hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  )
}

// ── section heading ───────────────────────────────────────────────────────────
function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function Dashboard({ isDark, onToggleTheme, onApply }) {
  const [summary,        setSummary]        = useState(null)
  const [recentChanges,  setRecentChanges]  = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingChanges, setLoadingChanges] = useState(true)
  const [errorSummary,   setErrorSummary]   = useState(null)
  const [errorChanges,   setErrorChanges]   = useState(null)

  const fetchSummary = () => {
    setLoadingSummary(true)
    setErrorSummary(null)
    fetch(`${API}/rates/summary`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() })
      .then((data) => { setSummary(data); setLoadingSummary(false) })
      .catch((err) => {
        console.warn('rates/summary fetch failed, falling back to mock data:', err.message)
        setSummary(MOCK_SUMMARY)
        setErrorSummary(API ? `Could not reach API: ${err.message}` : null)
        setLoadingSummary(false)
      })
  }

  const fetchChanges = () => {
    setLoadingChanges(true)
    setErrorChanges(null)
    fetch(`${API}/rates/recent-changes`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() })
      .then((data) => { setRecentChanges(data); setLoadingChanges(false) })
      .catch((err) => {
        console.warn('rates/recent-changes fetch failed, falling back to mock data:', err.message)
        setRecentChanges(MOCK_CHANGES)
        setErrorChanges(API ? `Could not reach API: ${err.message}` : null)
        setLoadingChanges(false)
      })
  }

  useEffect(() => {
    fetchSummary()
    fetchChanges()
  }, [])

  const termTrendOptionFactory = useMemo(
    () => summary ? buildTermTrendOption(summary) : null,
    [summary],
  )

  const s = summary || MOCK_SUMMARY

  // ── tooltip methodology strings ─────────────────────────────────────────────
  const M =
    'Owner-occupied, principal & interest loans only. ' +
    'Rates outside 5%–8% are excluded to remove high-LVR and introductory outliers. ' +
    'Median, P25 and P75 are calculated across all qualifying products from participating lenders.'

  const M_IO =
    'Owner-occupied, interest-only loans. ' +
    'Rates outside 5%–10% are excluded to remove outliers. ' +
    'Median, P25 and P75 are calculated across all qualifying products from participating lenders.'

  const M_INV =
    'Investment property loans only. ' +
    'Rates outside 5%–8% (P&I) or 5%–9% (IO) are excluded to remove outliers. ' +
    'Median, P25 and P75 calculated across all qualifying products from participating lenders.'

  const dataStale = s.dataStale ?? false

  const mortgageCards = summary ? [
    {
      label: 'Variable P&I', highlight: false, ...s.variable, dataStale,
      tooltip: 'Floating rate, principal & interest repayments. ' + M,
    },
    {
      label: 'Variable IO', highlight: false, ...(s.variableIO || {}), dataStale,
      tooltip: 'Floating rate, interest-only repayments. Typically 0.5%–0.8% higher than P&I. ' + M_IO,
    },
    {
      label: 'Investment P&I', highlight: false, ...(s.investmentPI || {}), dataStale,
      tooltip: 'Variable rate, investment property, principal & interest. Typically 0.2%–0.5% above owner-occupied P&I. ' + M_INV,
    },
    {
      label: 'Investment IO', highlight: false, ...(s.investmentIO || {}), dataStale,
      tooltip: 'Variable rate, investment property, interest-only. Highest-cost category — used by investors managing cash flow. ' + M_INV,
    },
  ] : null

  const otherCards = summary ? [
    {
      label: 'Personal Loan', highlight: false, ...(s.personalLoan || {}), dataStale,
      tooltip: 'Fixed and variable unsecured personal loans. Rates outside 5%–20% excluded. Median across all loan purposes and terms.',
    },
    {
      label: 'Business Loan', highlight: false, ...(s.businessLoan || {}), dataStale,
      tooltip: 'Fixed and variable business loans. Rates outside 5%–15% excluded to remove outliers.',
    },
    {
      label: 'Credit Card', highlight: false, ...(s.creditCard || {}), dataStale,
      tooltip: 'Standard purchase rates on credit cards. Excludes introductory, cash advance and balance transfer rates. Range 8%–25%.',
    },
  ] : null

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <DashboardHeader isDark={isDark} onToggleTheme={onToggleTheme} onApply={onApply} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-10">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-2">
            Live Market Data
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white mb-3">
            Today's Interest Rates
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            {loadingSummary
              ? <Skeleton className="h-4 w-52" />
              : <>
                  <span>
                    As of {s.asOf}
                    {s.dataStale && (
                      <span className="ml-1 text-amber-500 dark:text-amber-400 text-xs">(yesterday's data)</span>
                    )}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>{s.lenderCount} lenders</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>Australian Open Banking (CDS)</span>
                </>
            }
          </div>
        </section>

        {/* ── Mortgage Rate Cards ───────────────────────────────────────────── */}
        {loadingSummary
          ? <CardsSkeleton />
          : (
            <section>
              {errorSummary && <ErrorBanner message={errorSummary} onRetry={fetchSummary} />}
              <SectionHeading
                title="Mortgage Rates"
                subtitle={`Variable owner-occupied and investment rates · P&I and interest-only · filtered across ${s.lenderCount} lenders`}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mortgageCards.map((c) => <StatCard key={c.label} {...c} />)}
              </div>
            </section>
          )
        }

        {/* ── Other Rate Cards ──────────────────────────────────────────────── */}
        {loadingSummary
          ? <PanelSkeleton rows={3} />
          : otherCards && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-colors duration-200">
              <SectionHeading
                title="Other Rates"
                subtitle="Indicative averages across participating lenders · personal loans, business lending and credit cards"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {otherCards.map((c) => <StatCard key={c.label} {...c} />)}
              </div>
            </section>
          )
        }

        {/* ── Term Trend Chart ──────────────────────────────────────────────── */}
        {loadingSummary
          ? <ChartSkeleton />
          : (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-colors duration-200">
              <SectionHeading
                title="Rate by Fixed Term"
                subtitle="Owner-occupied P&I median across lenders — variable through to 5-year fixed · shaded band shows P25–P75 range"
              />
              {termTrendOptionFactory && (
                <RateChart buildOption={termTrendOptionFactory} isDark={isDark} height="300px" />
              )}
            </section>
          )
        }

        {/* ── Recent Rate Changes ───────────────────────────────────────────── */}
        {loadingChanges
          ? <TableSkeleton />
          : (
            <section>
              {errorChanges && <ErrorBanner message={errorChanges} onRetry={fetchChanges} />}
              <SectionHeading
                title="Recent Rate Changes"
                subtitle="Top 10 lenders by most recent update · click any row to expand individual products"
              />
              <RecentChangesTable data={recentChanges} />
            </section>
          )
        }

        {/* ── CTA Strip ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-indigo-400/30 dark:border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              Ready to find your best rate?
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Answer a few quick questions and we'll match you with the most competitive offers.
            </p>
          </div>
          <button
            type="button"
            onClick={onApply}
            className="shrink-0 px-6 py-3 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-semibold transition-colors duration-150"
          >
            Get My Rate →
          </button>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-500 dark:text-slate-500 leading-relaxed pb-4">
          Data sourced daily from the Australian Open Banking Consumer Data Standards (CDS) API.
          Rates are indicative averages across participating lenders and may not reflect your
          individual eligibility. Always seek independent financial advice.
        </footer>

      </main>
    </div>
  )
}
