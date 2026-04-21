export default function PrivacyPage({ onBack }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-14">

      {/* Back nav */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 underline underline-offset-2 decoration-slate-400 dark:decoration-slate-500 transition-colors mb-10"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" />
        </svg>
        Back to rates
      </button>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">
        Last updated: April 2026 &nbsp;·&nbsp; RateScan, operated by CognifyLabs.ai
      </p>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-10 text-sm leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            1. Introduction
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            RateScan is operated by CognifyLabs.ai (<strong>"we"</strong>, <strong>"us"</strong>, <strong>"our"</strong>).
            We are committed to protecting the privacy of individuals who visit and interact with this website.
            This Privacy Policy explains how we collect, use, hold, and disclose personal information, and how you
            can access or correct information we hold about you.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We are bound by the <em>Privacy Act 1988 (Cth)</em> and the Australian Privacy Principles (APPs)
            contained in that Act. By using this website, you consent to the collection, use, and disclosure of
            your personal information in accordance with this Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            2. What Personal Information We Collect
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            The type of personal information we collect depends on how you interact with us. We may collect:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li><strong>Identity information:</strong> name, date of birth, and age.</li>
            <li><strong>Contact information:</strong> email address and mobile phone number.</li>
            <li>
              <strong>Financial information:</strong> property value, loan amount sought, loan purpose,
              employment type, income, and expense details — provided only when you submit an enquiry
              or expression of interest through our application form.
            </li>
            <li>
              <strong>Usage data:</strong> browser type, IP address, pages viewed, and referring URL,
              collected automatically via server logs and analytics tools.
            </li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We do not collect sensitive information (as defined in the Privacy Act) such as health information,
            racial or ethnic origin, or criminal record, and we do not request it.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            If you contact us by email or through the Contact Us form, we will also collect the content of your
            message and any information you choose to include.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            3. How We Collect Personal Information
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            We collect personal information in the following ways:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Directly from you</strong> when you complete and submit the rate enquiry form or contact us.
            </li>
            <li>
              <strong>Automatically</strong> via web server logs and analytics when you browse our website.
            </li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            Where practicable, we will collect personal information directly from you. We will not collect personal
            information about you from third parties without your consent, unless permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            4. Why We Collect Personal Information (Purpose of Collection)
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            We collect personal information only for purposes that are directly related to our services, including:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>to receive and process your rate enquiry or expression of interest;</li>
            <li>to respond to your questions or messages;</li>
            <li>to operate, improve, and secure this website;</li>
            <li>to comply with our legal obligations; and</li>
            <li>
              to send you service-related communications where you have provided your contact details and
              have not opted out.
            </li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We will not use or disclose your personal information for a secondary purpose unless that purpose
            is related to the primary purpose of collection and you would reasonably expect such use, or you
            have consented, or the use is required or authorised by law (APP 6).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            5. Disclosure of Personal Information
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            We do not sell, rent, or trade your personal information. We may disclose your personal information to:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Cloud infrastructure providers</strong> who host our systems (Amazon Web Services,
              ap-southeast-2 region, Australia). AWS holds ISO 27001 certification and operates under
              applicable Australian data security standards.
            </li>
            <li>
              <strong>Professional advisers</strong> such as lawyers, accountants, or auditors, under
              appropriate confidentiality obligations.
            </li>
            <li>
              <strong>Law enforcement or government agencies</strong> where required or authorised by law,
              a court order, or other legal process.
            </li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            <strong>Sharing with Licensed Mortgage Brokers</strong>
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            Where you submit an enquiry or expression of interest through our application form, we may share
            your contact details (name, email address, and phone number) and relevant financial information
            (property value, loan amount sought, and loan purpose) with licensed, qualified mortgage brokers
            who are authorised to provide personalised financial advice.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            <strong>Why we share your information with brokers.</strong> RateScan is operated by CognifyLabs.ai
            and is restricted from providing personalised financial advice, recommending specific interest
            rates, or suggesting financial products under Australian Financial Services Licence (AFSL) requirements.
            To ensure you receive regulated, tailored financial guidance from a qualified professional, we
            facilitate a connection between you and a licensed mortgage broker who can assess your individual
            circumstances and provide appropriate advice.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            These mortgage brokers are holder(s) of an Australian Financial Services Licence (AFSL) or are
            authorised representatives under such a licence. As such, they are legally obligated to handle
            all personal information in accordance with:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>the <em>Privacy Act 1988 (Cth)</em> and the Australian Privacy Principles (APPs);</li>
            <li>the <em>Corporations Act 2001 (Cth)</em> and relevant regulations;</li>
            <li>their obligations under their AFSL, including client money and advice documentation requirements;</li>
            <li>any additional requirements imposed by the Australian Securities and Investments Commission (ASIC); and</li>
            <li>their own internal privacy policies and data handling procedures.</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We will only share your information with brokers where you have provided your contact details
            through our enquiry or application process. By proceeding with an enquiry, you consent to your
            information being shared in this manner for the purpose of receiving personalised mortgage
            advice from a licensed professional.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We do not currently disclose personal information to overseas recipients. If this changes, we will
            update this Privacy Policy and take reasonable steps to ensure overseas recipients handle your
            information consistently with the APPs (APP 8).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            6. Open Banking Rate Data
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            The interest rate information displayed on RateScan is sourced automatically from the Consumer
            Data Right (CDR) Open Banking API published by participating Australian lenders. This data relates
            to products and rates only — it does not include any individual consumer's financial information.
            RateScan does not access, receive, or store any CDR consumer data relating to you or any other
            individual. We are not an Accredited Data Recipient under the CDR framework.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            7. Data Quality and Security
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            We take reasonable steps to ensure that personal information we hold is accurate, up-to-date,
            complete, and relevant (APP 10), and to protect it from misuse, interference, loss, and
            unauthorised access, modification, or disclosure (APP 11). These measures include:
          </p>
          <ul className="list-disc pl-5 mt-3 space-y-1.5 text-slate-600 dark:text-slate-400">
            <li>encryption of data in transit (TLS) and at rest;</li>
            <li>access controls limiting data access to authorised personnel only;</li>
            <li>hosting all data within AWS ap-southeast-2 (Sydney) data centres; and</li>
            <li>regular security reviews of our infrastructure.</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We retain personal information only for as long as necessary to fulfil the purpose for which it was
            collected, or as required by law. When personal information is no longer needed, we take reasonable
            steps to destroy or de-identify it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            8. Cookies and Analytics
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            This website may use cookies and similar technologies to support its operation and to understand
            how visitors use the site. Cookies are small text files stored on your device. You can configure
            your browser to refuse cookies; however, this may affect the functionality of certain parts of
            the website. Where third-party analytics tools are used, they are configured to anonymise IP
            addresses and are not used for advertising or cross-site tracking.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            9. Access to and Correction of Your Personal Information
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Under APP 12, you have the right to request access to the personal information we hold about you.
            Under APP 13, you have the right to request correction of information that is inaccurate, out-of-date,
            incomplete, irrelevant, or misleading.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            To make an access or correction request, please contact us using the details in section 11 below.
            We will respond to your request within 30 days. We will not charge a fee for making a request, but
            may charge a reasonable fee for providing access if the request involves a substantial amount of work.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            We may decline a request for access or correction in circumstances permitted by the Privacy Act and
            will provide reasons for any refusal.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            10. Complaints
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            If you believe we have breached the Australian Privacy Principles or otherwise mishandled your
            personal information, you may make a complaint to us in writing using the contact details in
            section 11. We will acknowledge your complaint within 5 business days and aim to resolve it
            within 30 days.
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-3">
            If you are not satisfied with our response, you may escalate your complaint to the Office of the
            Australian Information Commissioner (OAIC) at{' '}
            <a
              href="https://www.oaic.gov.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors"
            >
              oaic.gov.au
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            11. Contact Us
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            For any privacy-related enquiries, access and correction requests, or complaints, please contact us:
          </p>
          <div className="mt-3 space-y-1 text-slate-600 dark:text-slate-400">
            <p><strong>Privacy Officer</strong> — CognifyLabs.ai</p>
            <p>Email: <a href="mailto:privacy@ratescan.com.au" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors">privacy@ratescan.com.au</a></p>
            <p>Web: <a href="https://cognifylabs.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors">cognifylabs.ai</a></p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-wide">
            12. Changes to This Privacy Policy
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
            legal requirements, or for other operational reasons. The date at the top of this page indicates when
            the policy was last revised. Your continued use of this website after any update constitutes your
            acceptance of the revised policy. Where changes are material, we will take reasonable steps to notify
            users.
          </p>
        </section>

      </div>

      {/* Bottom back button */}
      <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors"
        >
          ← Back to RateScan
        </button>
      </div>
    </div>
  )
}
