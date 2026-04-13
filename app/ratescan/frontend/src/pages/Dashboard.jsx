import { useState, useEffect, useMemo } from 'react'
import DashboardHeader from '../components/DashboardHeader'
import StatCard from '../components/StatCard'
import RateChart, { buildTermTrendOption } from '../components/RateChart'
import RecentChangesTable from '../components/RecentChangesTable'
import { RATE_SUMMARY as MOCK_SUMMARY, RECENT_CHANGES as MOCK_CHANGES } from '../data/mockRates'

const API = import.meta.env.VITE_API_URL || ''

// ── skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`} />
  )
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-sm">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <Skeleton className="h-4 w-40 mb-2" />
      <Skeleton className="h-3 w-72 mb-6" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-3 flex gap-4">
        {[8, 32, 20, 16, 12].map((w, i) => (
          <Skeleton key={i} className={`h-3 w-${w}`} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 px-4 py-3.5 flex gap-4 border-t border-slate-100 dark:border-slate-800">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
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

  // Rebuild chart option whenever summary data changes
  const termTrendOptionFactory = useMemo(
    () => summary ? buildTermTrendOption(summary) : null,
    [summary],
  )

  const s = summary || MOCK_SUMMARY

  const METHODOLOGY =
    'Owner-occupied, principal & interest loans only. ' +
    'Rates outside 5%–8% are excluded to remove high-LVR and introductory outliers. ' +
    'Average, min and max are calculated across all qualifying products from participating lenders.'

  const IO_METHODOLOGY =
    'Owner-occupied, interest-only loans. ' +
    'Rates outside 5%–10% are excluded to remove outliers. ' +
    'Average, min and max are calculated across all qualifying products from participating lenders.'

  const mortgageCards = summary
    ? [
        {
          label: 'Variable P&I', highlight: true, ...s.variable,
          tooltip: 'Floating rate, principal & interest repayments. ' + METHODOLOGY,
        },
        {
          label: 'Variable IO', highlight: false, ...(s.variableIO || {}),
          tooltip: 'Floating rate, interest-only repayments. IO rates are typically 0.5%–0.8% higher than P&I. ' + IO_METHODOLOGY,
        },
      ]
    : null

  const otherCards = summary
    ? [
        {
          label: 'Personal Loan', highlight: false, ...(s.personalLoan || {}),
          tooltip: 'Fixed and variable unsecured personal loans across participating lenders. Rates outside 5%–20% excluded. Average across all loan purposes and terms.',
        },
        {
          label: 'Business Loan', highlight: false, ...(s.businessLoan || {}),
          tooltip: 'Fixed and variable business loans across participating lenders. Rates outside 5%–15% excluded to remove outliers.',
        },
        {
          label: 'Credit Card', highlight: false, ...(s.creditCard || {}),
          tooltip: 'Standard purchase rates on credit cards. Excludes introductory, cash advance and balance transfer rates. Range 8%–25%.',
        },
      ]
    : null

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <DashboardHeader isDark={isDark} onToggleTheme={onToggleTheme} onApply={onApply} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-10">

        {/* Hero */}
        <section>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            Live Market Data
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white mb-3">
            Today's Interest Rates
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400 dark:text-slate-500">
            {loadingSummary
              ? <Skeleton className="h-4 w-48" />
              : <>
                  <span>As of {s.asOf}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>{s.lenderCount} lenders</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span>Australian Open Banking (CDS)</span>
                </>
            }
          </div>
        </section>

        {/* Mortgage rate cards */}
        {loadingSummary
          ? <CardsSkeleton />
          : <>
              {errorSummary && <ErrorBanner message={errorSummary} onRetry={fetchSummary} />}
              <section className="grid grid-cols-2 gap-3 max-w-sm">
                {mortgageCards.map((c) => <StatCard key={c.label} {...c} />)}
              </section>
            </>
        }

        {/* Other rate cards */}
        {!loadingSummary && otherCards && (
          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
              Other Rates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {otherCards.map((c) => <StatCard key={c.label} {...c} />)}
            </div>
          </section>
        )}

        {/* Term trend chart */}
        {loadingSummary
          ? <ChartSkeleton />
          : (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-colors duration-200">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Rate by Fixed Term
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Average rate across lenders — variable through to 5-year fixed · shaded band shows min–max range
                </p>
              </div>
              {termTrendOptionFactory && (
                <RateChart buildOption={termTrendOptionFactory} isDark={isDark} height="300px" />
              )}
            </section>
          )
        }

        {/* Recent rate changes table */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Rate Changes
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Top 10 lenders by most recent update · click a row to expand individual products
            </p>
          </div>
          {loadingChanges
            ? <TableSkeleton />
            : <>
                {errorChanges && <ErrorBanner message={errorChanges} onRetry={fetchChanges} />}
                <RecentChangesTable data={recentChanges} />
              </>
          }
        </section>

        {/* CTA strip */}
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Ready to find your best rate?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Answer a few quick questions and we'll match you with the most competitive offers.
            </p>
          </div>
          <button
            type="button"
            onClick={onApply}
            className="shrink-0 px-6 py-3 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors duration-150"
          >
            Get My Rate →
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
          Data sourced daily from the Australian Open Banking Consumer Data Standards (CDS) API.
          Rates are indicative averages across participating lenders and may not reflect your
          individual eligibility. Always seek independent financial advice.
        </footer>
      </main>
    </div>
  )
}
