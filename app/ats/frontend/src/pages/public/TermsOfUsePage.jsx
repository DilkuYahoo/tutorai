import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '1 January 2025'
const YEAR = new Date().getFullYear()

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-slate-950 py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-2">
          <Link to="/careers" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Careers
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Terms of Use</h1>
          <p className="text-sm text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <Section title="1. Acceptance of terms">
          <p>
            By accessing or using the AdviceLab recruitment platform at advicelab.com.au
            (the <strong>"Platform"</strong>), you agree to be bound by these Terms of Use
            (<strong>"Terms"</strong>). If you do not agree, please do not use the Platform.
          </p>
          <p className="mt-3">
            These Terms are governed by the laws of New South Wales, Australia.
          </p>
        </Section>

        <Section title="2. About the Platform">
          <p>
            The Platform is operated by <strong>AdviceLab Pty Ltd</strong> ("AdviceLab") and is
            built and maintained by <a href="https://cognifylabs.ai" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">CognifyLabs.ai</a>.
            It provides tools for managing recruitment workflows, including job listings, candidate
            applications, interview scheduling, and hiring decisions.
          </p>
        </Section>

        <Section title="3. Who can use the Platform">
          <p>The Platform has two types of users:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>
              <strong>Candidates</strong> — individuals who submit job applications via the public
              careers page. No account is required.
            </li>
            <li>
              <strong>Staff users</strong> — AdviceLab employees or contractors who are granted
              access by an administrator. Use is restricted to authorised personnel only.
            </li>
          </ul>
        </Section>

        <Section title="4. Candidate submissions">
          <p>
            By submitting a job application, you confirm that all information provided is accurate
            and complete to the best of your knowledge. Submitting false or misleading information
            may result in your application being withdrawn.
          </p>
          <p className="mt-3">
            Applications are submitted for consideration only and do not constitute an offer of
            employment.
          </p>
        </Section>

        <Section title="5. Authorised use (staff)">
          <p>Staff users must:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>Keep login credentials confidential and not share account access.</li>
            <li>Use the Platform solely for legitimate recruitment and HR purposes on behalf of AdviceLab.</li>
            <li>Not attempt to access data or functionality beyond their assigned role permissions.</li>
            <li>Report any suspected unauthorised access or security incident promptly.</li>
          </ul>
          <p className="mt-3">
            Accounts are personal and non-transferable. AdviceLab may suspend or revoke access at
            any time.
          </p>
        </Section>

        <Section title="6. Prohibited conduct">
          <p>You must not use the Platform to:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>Submit spam, unsolicited communications, or bulk applications.</li>
            <li>Attempt to probe, scan, or test the vulnerability of the Platform or its infrastructure.</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Platform.</li>
            <li>Harvest or scrape candidate or user data.</li>
            <li>Engage in any conduct that violates Australian law, including the <em>Privacy Act 1988</em>, the <em>Spam Act 2003</em>, or anti-discrimination legislation.</li>
          </ul>
        </Section>

        <Section title="7. Intellectual property">
          <p>
            All content, software, and trade marks on the Platform are the property of AdviceLab
            Pty Ltd or its licensors. Nothing in these Terms grants you any rights to use
            AdviceLab's intellectual property other than as strictly necessary to use the Platform
            for its intended purpose.
          </p>
        </Section>

        <Section title="8. Disclaimer of warranties">
          <p>
            The Platform is provided <strong>"as is"</strong> and <strong>"as available"</strong>
            without warranty of any kind. To the maximum extent permitted by Australian law,
            AdviceLab excludes all implied warranties, including fitness for a particular purpose
            and uninterrupted availability.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the extent permitted by law, AdviceLab's liability for any claim arising out of or
            in connection with the Platform is limited to the amount paid (if any) for access to the
            Platform in the 12 months preceding the claim. AdviceLab is not liable for indirect,
            incidental, or consequential losses.
          </p>
          <p className="mt-3">
            Nothing in these Terms limits liability for death, personal injury caused by negligence,
            fraud, or any other liability that cannot be excluded by law.
          </p>
        </Section>

        <Section title="10. Privacy">
          <p>
            Your use of the Platform is also governed by our{' '}
            <Link to="/privacy" className="text-indigo-400 hover:underline">Privacy Policy</Link>,
            which is incorporated into these Terms by reference. By using the Platform, you consent
            to the collection and use of your information as described in that policy.
          </p>
        </Section>

        <Section title="11. Changes to these Terms">
          <p>
            We may update these Terms at any time. The effective date at the top of this page
            reflects the current version. Continued use of the Platform after changes are published
            constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For questions about these Terms, please contact AdviceLab at:
          </p>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm text-slate-300 space-y-1">
            <p><strong className="text-white">AdviceLab Pty Ltd</strong></p>
            <p>advicelab.com.au</p>
            <p>Australia</p>
          </div>
        </Section>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          © {YEAR} AdviceLab Pty Ltd. All rights reserved. ·{' '}
          <Link to="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
    </section>
  )
}
