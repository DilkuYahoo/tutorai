export default function TermsPage({ onBack }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">

        {/* Back nav */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors mb-10"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" />
          </svg>
          Back to rates
        </button>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">
          Last updated: April 2026 &nbsp;·&nbsp; RateScan, operated by CognifyLabs.ai
        </p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              1. Information Service Only — Not Financial Advice
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              RateScan is an information aggregation and display service only. Nothing published on this
              website — including rate tables, trend indicators, charts, comparisons, or any other content —
              constitutes financial product advice, financial planning advice, credit advice, mortgage
              broking services, or any other form of regulated advice under the{' '}
              <em>Corporations Act 2001 (Cth)</em>, the{' '}
              <em>National Consumer Credit Protection Act 2009 (Cth)</em>, or any other Australian law.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-3">
              RateScan does not hold an Australian Financial Services Licence (AFSL), an Australian Credit
              Licence (ACL), or any other regulatory authorisation to provide financial product advice or
              credit assistance. You must not rely on any content on this website as a substitute for
              advice from a licensed professional.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-3">
              Before making any borrowing, refinancing, or financial decision, you should obtain
              independent advice from a qualified and licensed financial adviser, mortgage broker, or
              credit representative who can assess your individual circumstances.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              2. No Representation or Warranty
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              All information published on RateScan is provided on an <strong>"as is" and "as available"</strong> basis,
              without warranty of any kind, express or implied. We make no representations or warranties
              regarding:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>the accuracy, completeness, reliability, suitability, or timeliness of any rate data or other information;</li>
              <li>whether the rates displayed are the rates currently offered by any particular lender;</li>
              <li>whether any particular product is available to you or meets your eligibility requirements;</li>
              <li>the uninterrupted or error-free operation of this website; or</li>
              <li>the fitness of this website or its content for any particular purpose.</li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mt-3">
              To the maximum extent permitted by law, all implied warranties, conditions, and guarantees
              are excluded.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              3. Nature of Rate Data
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Rate information displayed on RateScan is sourced automatically from the Australian
              Open Banking Consumer Data Standards (CDS) API v5, operated by participating Authorised
              Deposit-taking Institutions (ADIs) and other licensed lenders. This data is ingested daily
              and is subject to the following limitations:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>
                <strong>Indicative medians only.</strong> Displayed rates are statistical medians (50th
                percentile) across rate rows in the source data. They do not represent any single lender's
                advertised rate and are not guaranteed to reflect the rate you will be offered.
              </li>
              <li>
                <strong>LVR and eligibility exclusions.</strong> Source data contains multiple rate tiers
                per product (e.g. by Loan-to-Value Ratio). The rate you are offered will depend on your
                individual LVR, credit profile, loan size, and other lender criteria.
              </li>
              <li>
                <strong>Data lag.</strong> Data is refreshed once daily. Rates may have changed since the
                last update. The "As of" date shown on the dashboard indicates when the data was last
                ingested.
              </li>
              <li>
                <strong>Incomplete coverage.</strong> Not all Australian lenders participate in the Open
                Banking CDR programme. Lenders not participating are not represented in the data.
              </li>
              <li>
                <strong>Third-party data.</strong> RateScan does not independently verify the rates
                published by lenders via the CDR API. Lenders are solely responsible for the accuracy of
                their own data submissions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              4. Limitation of Liability
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              To the maximum extent permitted by applicable Australian law, RateScan and CognifyLabs.ai,
              including their directors, employees, agents, contractors, and affiliates, will not be liable
              for any loss or damage of any kind arising directly or indirectly from your use of, or
              reliance on, this website or its content, including but not limited to:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>any financial loss, including loss of profit, revenue, savings, opportunity, or goodwill;</li>
              <li>any loss arising from a borrowing, lending, investment, or refinancing decision;</li>
              <li>any indirect, incidental, special, consequential, or punitive damages;</li>
              <li>any loss of data, business interruption, or reputational damage; or</li>
              <li>
                any inaccuracy, error, omission, or delay in rate data sourced from third-party Open
                Banking APIs.
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 mt-3">
              Where liability cannot be excluded under the <em>Australian Consumer Law</em> or any other
              non-excludable statutory right, our liability is limited, at our election, to resupplying
              the relevant information or paying the cost of having the information resupplied.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              5. No Lender Affiliation or Endorsement
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              RateScan is an independent information service and is not affiliated with, endorsed by,
              sponsored by, or acting as agent for any bank, credit union, lender, or financial institution
              whose rates may appear on this website. The display of a lender's rates does not constitute
              a recommendation, endorsement, or comparison of that lender's products.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-3">
              RateScan receives no commission, referral fee, or other consideration from any lender in
              connection with the display of rate information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              6. Use at Your Own Risk
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Your use of this website and any reliance you place on its content is entirely at your own
              risk. You acknowledge that you have read and understood these Terms and that you will not
              hold RateScan or CognifyLabs.ai responsible for any outcome arising from your use of this
              service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              7. Enquiry Submissions
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              If you choose to submit an enquiry or expression of interest through RateScan, you
              acknowledge that:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>submission does not constitute a loan application or credit application;</li>
              <li>no credit assessment or credit decision is made by RateScan;</li>
              <li>we do not guarantee that any lender will contact you or offer you credit; and</li>
              <li>
                any personal information you submit will be handled in accordance with the{' '}
                <em>Privacy Act 1988 (Cth)</em> and the Australian Privacy Principles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              8. Intellectual Property
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              All content, design, code, trademarks, and other intellectual property on this website are
              owned by or licensed to CognifyLabs.ai. You may not reproduce, distribute, or create
              derivative works from any content on this website without prior written permission, except
              as permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              9. Governing Law
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              These Terms are governed by the laws of New South Wales, Australia. You submit to the
              exclusive jurisdiction of the courts of New South Wales for any dispute arising out of or
              relating to these Terms or your use of this website.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              10. Changes to These Terms
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              We may update these Terms at any time without notice. The date at the top of this page
              reflects the most recent revision. Your continued use of this website after any changes
              constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
              11. Contact
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              For questions about these Terms, please contact CognifyLabs.ai via{' '}
              <a
                href="https://cognifylabs.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:text-indigo-400 transition-colors"
              >
                cognifylabs.ai
              </a>.
            </p>
          </section>

        </div>

        {/* Bottom back button */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onBack}
            className="text-sm text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            ← Back to RateScan
          </button>
        </div>

      </div>
    </div>
  )
}
