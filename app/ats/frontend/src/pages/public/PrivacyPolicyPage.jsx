import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = '1 January 2025'
const YEAR = new Date().getFullYear()

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div className="space-y-2">
          <Link to="/careers" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to Careers
          </Link>
          <h1 className="text-3xl font-bold text-white mt-4">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <Section title="1. Who we are">
          <p>
            AdviceLab Pty Ltd (<strong>"AdviceLab"</strong>, <strong>"we"</strong>, <strong>"us"</strong>, or
            <strong>"our"</strong>) operates the recruitment platform available at advicelab.com.au
            (the <strong>"Platform"</strong>). The Platform is built and maintained by CognifyLabs.ai on
            behalf of AdviceLab.
          </p>
          <p className="mt-3">
            We are bound by the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles
            (APPs) contained within it.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>We collect personal information in the following circumstances:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>
              <strong>Job applicants</strong> — name, email address, phone number, resume/CV, cover
              letter, and any other information you voluntarily provide when submitting an application.
            </li>
            <li>
              <strong>Platform users (staff)</strong> — name, work email address, role, and login
              credentials managed via our identity provider.
            </li>
            <li>
              <strong>Automatically collected data</strong> — browser type, IP address, and usage
              logs collected for security and platform performance purposes.
            </li>
          </ul>
          <p className="mt-3">
            We do not knowingly collect sensitive information (as defined by the APPs) unless you
            voluntarily include it in your application materials.
          </p>
        </Section>

        <Section title="3. How we use your information">
          <p>We use personal information to:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>Assess job applications and manage the recruitment process.</li>
            <li>Communicate with you about your application, including scheduling interviews.</li>
            <li>Maintain records of hiring decisions for compliance and audit purposes.</li>
            <li>Operate, maintain, and improve the Platform.</li>
            <li>Meet our legal obligations under Australian law.</li>
          </ul>
          <p className="mt-3">
            We will not use your personal information for direct marketing without your consent.
          </p>
        </Section>

        <Section title="4. Disclosure of information">
          <p>
            We do not sell, trade, or rent your personal information to third parties. We may share
            information with:
          </p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>
              <strong>Service providers</strong> — AWS (cloud infrastructure), which processes data
              on our behalf under data processing agreements.
            </li>
            <li>
              <strong>CognifyLabs.ai</strong> — as the technical operator of the Platform, limited
              to what is necessary to operate and support the system.
            </li>
            <li>
              <strong>Legal authorities</strong> — where required by law or to protect the rights,
              property, or safety of AdviceLab, our staff, or others.
            </li>
          </ul>
        </Section>

        <Section title="5. Data storage and security">
          <p>
            Your data is stored on servers located in Australia (AWS ap-southeast-2, Sydney). We
            implement appropriate technical and organisational measures to protect personal
            information against unauthorised access, loss, or disclosure, including encrypted
            storage, access controls, and audit logging.
          </p>
          <p className="mt-3">
            Notwithstanding these measures, no data transmission over the internet is guaranteed to
            be completely secure.
          </p>
        </Section>

        <Section title="6. Retention">
          <p>
            Application data is retained for a minimum of 12 months following the conclusion of a
            recruitment process, or as required by applicable Australian employment laws. Staff
            account data is retained for the duration of employment and for a reasonable period
            thereafter.
          </p>
          <p className="mt-3">
            You may request deletion of your personal information (see section 8).
          </p>
        </Section>

        <Section title="7. Cookies">
          <p>
            The Platform uses session cookies strictly necessary for authentication. We do not use
            tracking or advertising cookies. You may disable cookies in your browser settings, but
            this will prevent you from logging in to the Platform.
          </p>
        </Section>

        <Section title="8. Your rights">
          <p>Under the Australian Privacy Principles, you have the right to:</p>
          <ul className="mt-3 space-y-2 list-disc list-inside text-slate-300">
            <li>Access the personal information we hold about you.</li>
            <li>Request correction of inaccurate or outdated information.</li>
            <li>Request deletion of your personal information, subject to legal obligations.</li>
            <li>Lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">oaic.gov.au</a>.</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, please contact us using the details in section 9.
          </p>
        </Section>

        <Section title="9. Contact us">
          <p>
            For privacy-related enquiries or complaints, please contact AdviceLab at:
          </p>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4 text-sm text-slate-300 space-y-1">
            <p><strong className="text-white">AdviceLab Pty Ltd</strong></p>
            <p>advicelab.com.au</p>
            <p>Australia</p>
          </div>
          <p className="mt-3">
            We will respond to all privacy enquiries within 30 days.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. The effective date at the top of
            this page reflects when the current version came into force. Continued use of the
            Platform after any update constitutes acceptance of the revised policy.
          </p>
        </Section>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          © {YEAR} AdviceLab Pty Ltd. All rights reserved. ·{' '}
          <Link to="/terms" className="hover:text-slate-400 transition-colors">Terms of Use</Link>
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
