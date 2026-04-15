function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <polygon points="11,2 20,11 11,20 2,11" fill="#6366f1" />
      <polygon points="11,6 16,11 11,16 6,11" fill="#818cf8" opacity="0.6" />
    </svg>
  )
}

const RATE_LINKS = [
  { label: 'Variable Rates',    href: '#mortgage-rates' },
  { label: 'Market Rate Outlook', href: '#rate-charts' },
  { label: 'Investment Rates',  href: '#mortgage-rates' },
  { label: 'Personal Loans',    href: '#other-rates' },
  { label: 'Credit Cards',      href: '#other-rates' },
  { label: 'Recent Changes',    href: '#recent-changes' },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">

        {/* Three-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">

          {/* Col 1 — Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LogoMark />
              <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
                Rate<span className="text-indigo-500">Scan</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Australia's daily mortgage and loan rate tracker, powered by Open Banking Consumer Data Standards.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-600 leading-relaxed">
              Data sourced daily from the Australian Open Banking CDS API (v5) across 91+ participating lenders.
            </p>
          </div>

          {/* Col 2 — Rate categories */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              Rate Categories
            </p>
            <ul className="space-y-2.5">
              {RATE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              Important Information
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              Rates shown are indicative medians across participating lenders and may not reflect individual eligibility, LVR, or product-specific conditions.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              RateScan is an information service only and does not constitute financial advice. Always seek independent advice from a licensed financial adviser before making borrowing decisions.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-600">
          <span>© {new Date().getFullYear()} RateScan · Australian Open Banking · Not financial advice</span>
          <span>
            Built &amp; maintained by{' '}
            <a
              href="https://cognifylabs.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 dark:text-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
            >
              CognifyLabs.ai
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
