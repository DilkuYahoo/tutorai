import { useState, useRef } from 'react'
import Layout from '../components/Layout'

export default function BrokerPage({ isDark, onToggleTheme, onHome, onMortgageRates, onOtherRates, onRecentChanges, onLenders, onTerms, onPrivacy, onContact }) {
  const [formData, setFormData] = useState({
    businessName: '',
    abn: '',
    contactName: '',
    email: '',
    phone: '',
    licenseType: '',
    licenseNumber: '',
    yearsExperience: '',
    monthlyLeads: '',
    region: '',
    website: '',
    companySize: '',
    specializations: '',
    agreeTerms: false,
    agreePrivacy: false,
    agreeCompliance: false
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const formRef = useRef(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required'
    if (!formData.abn.trim()) newErrors.abn = 'ABN is required'
    else if (!/^\d{11}$/.test(formData.abn.replace(/\s/g, ''))) newErrors.abn = 'ABN must be 11 digits'
    if (!formData.contactName.trim()) newErrors.contactName = 'Contact name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required'
    if (!formData.licenseType) newErrors.licenseType = 'License type is required'
    if (!formData.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required'
    if (!formData.region) newErrors.region = 'Region is required'
    if (!formData.agreeTerms) newErrors.agreeTerms = 'You must agree to the Terms'
    if (!formData.agreePrivacy) newErrors.agreePrivacy = 'You must agree to the Privacy Policy'
    if (!formData.agreeCompliance) newErrors.agreeCompliance = 'You must confirm compliance understanding'
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // Scroll to first error
      const firstError = Object.keys(newErrors)[0]
      const el = document.querySelector(`[name="${firstError}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      // In a real app, this would POST to your backend
      await new Promise(resolve => setTimeout(resolve, 1500))
      setSubmitted(true)
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (err) {
      setErrors({ submit: 'Failed to submit. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Layout
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        onApply={() => {}}
        onTerms={onTerms}
        onPrivacy={onPrivacy}
        onContact={onContact}
        onHome={onHome}
        onMortgageRates={onMortgageRates}
        onOtherRates={onOtherRates}
        onRecentChanges={onRecentChanges}
        onLenders={onLenders}
        buttonText="← Back to Home"
      >
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="text-center animate-fade-in max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-semibold mb-3 text-slate-900 dark:text-white">Thank You, {formData.contactName.split(' ')[0]}!</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Your broker onboarding request has been received. Our partnership team will review your application and contact you within 2-3 business days.
            </p>
            <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-xl p-4 mb-8 text-left">
              <p className="text-sm text-slate-400">
                <span className="text-slate-300">Business:</span> {formData.businessName}<br />
                <span className="text-slate-300">Contact:</span> {formData.contactName}<br />
                <span className="text-slate-300">Email:</span> {formData.email}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => { setSubmitted(false); setFormData({ businessName: '', abn: '', contactName: '', email: '', phone: '', licenseType: '', licenseNumber: '', yearsExperience: '', monthlyLeads: '', region: '', website: '', companySize: '', specializations: '', agreeTerms: false, agreePrivacy: false, agreeCompliance: false }) }}
                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 text-sm transition-colors"
              >
                Submit Another Application
              </button>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
              <button
                onClick={() => { setSubmitted(false); onHome() }}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white underline underline-offset-2 text-sm transition-colors"
              >
                ← Back to Rates Dashboard
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
      onToggleTheme={onToggleTheme}
      onApply={() => {}}
      onTerms={onTerms}
      onPrivacy={onPrivacy}
      onContact={onContact}
      onHome={onHome}
      onMortgageRates={onMortgageRates}
      onOtherRates={onOtherRates}
      onRecentChanges={onRecentChanges}
      onLenders={onLenders}
      buttonText="← Back to Rates"
    >
      <div ref={formRef} className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
              Broker Partnership
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Join our network of trusted finance professionals. Get exclusive access to real-time rate leads and grow your business with RateScan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8" noValidate>
            {/* Business Details Section */}
            <section className="bg-slate-800/30 dark:bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
              <h2 className="text-lg font-semibold mb-6 text-slate-100 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">1</span>
                Business Details
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.businessName ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="Enter legal business name"
                  />
                  {errors.businessName && <p className="text-red-400 text-xs mt-1">{errors.businessName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    ABN <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="abn"
                    value={formData.abn}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').substring(0, 11)
                      setFormData(prev => ({ ...prev, abn: val }))
                      if (errors.abn) setErrors(prev => ({ ...prev, abn: '' }))
                    }}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.abn ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="12345678901"
                    maxLength={11}
                  />
                  {errors.abn && <p className="text-red-400 text-xs mt-1">{errors.abn}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Contact Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.contactName ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="Your full name"
                  />
                  {errors.contactName && <p className="text-red-400 text-xs mt-1">{errors.contactName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Company Size
                  </label>
                  <select
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="">Select size</option>
                    <option value="solo">Solo Practitioner</option>
                    <option value="small">Small (2-5 staff)</option>
                    <option value="medium">Medium (6-15 staff)</option>
                    <option value="large">Large (16+ staff)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.email ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="you@business.com.au"
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Phone / Mobile <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.phone ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="+61 400 000 000"
                  />
                  {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    placeholder="https://yourbusiness.com.au"
                  />
                </div>
              </div>
            </section>

            {/* License Section */}
            <section className="bg-slate-800/30 dark:bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
              <h2 className="text-lg font-semibold mb-6 text-slate-100 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">2</span>
                License Information
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    License Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="licenseType"
                    value={formData.licenseType}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.licenseType ? 'border-red-500' : 'border-slate-700'} text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                  >
                    <option value="">Select license type</option>
                    <option value="AFSL">AFSL (Australian Financial Services License)</option>
                    <option value="ACL">ACL (Australian Credit License)</option>
                    <option value="BOTH">Both AFSL & ACL</option>
                    <option value="CA">Credit Representative (CA)</option>
                    <option value="OTHER">Other (Please specify in notes)</option>
                  </select>
                  {errors.licenseType && <p className="text-red-400 text-xs mt-1">{errors.licenseType}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    License Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.licenseNumber ? 'border-red-500' : 'border-slate-700'} text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                    placeholder="e.g. 1234567"
                  />
                  {errors.licenseNumber && <p className="text-red-400 text-xs mt-1">{errors.licenseNumber}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Years Experience
                  </label>
                  <select
                    name="yearsExperience"
                    value={formData.yearsExperience}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="">Select experience</option>
                    <option value="0-2">0-2 years</option>
                    <option value="3-5">3-5 years</option>
                    <option value="6-10">6-10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Monthly Lead Volume
                  </label>
                  <select
                    name="monthlyLeads"
                    value={formData.monthlyLeads}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    <option value="">Select volume</option>
                    <option value="0-10">0-10 leads/month</option>
                    <option value="11-50">11-50 leads/month</option>
                    <option value="51-100">51-100 leads/month</option>
                    <option value="100+">100+ leads/month</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Region / Service Area
                  </label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border ${errors.region ? 'border-red-500' : 'border-slate-700'} text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all`}
                  >
                    <option value="">Select primary region</option>
                    <option value="NSW">NSW</option>
                    <option value="VIC">Victoria</option>
                    <option value="QLD">Queensland</option>
                    <option value="WA">Western Australia</option>
                    <option value="SA">South Australia</option>
                    <option value="TAS">Tasmania</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">Northern Territory</option>
                    <option value="National">National (Australia-wide)</option>
                  </select>
                  {errors.region && <p className="text-red-400 text-xs mt-1">{errors.region}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 dark:text-slate-200 mb-2">
                    Specializations (optional)
                  </label>
                  <textarea
                    name="specializations"
                    value={formData.specializations}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/50 dark:bg-slate-950/50 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    placeholder="What are your key specializations? (e.g. first home buyers, investment loans, SMSF, commercial...)"
                  />
                </div>
              </div>
            </section>

            {/* Compliance & Consent Section */}
            <section className="bg-slate-800/30 dark:bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-700/50">
              <h2 className="text-lg font-semibold mb-6 text-slate-100 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold">3</span>
                Compliance & Terms
              </h2>

              <div className="space-y-5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded bg-slate-900/50 dark:bg-slate-950/50 border-slate-700 text-indigo-500 focus:ring-indigo-500/50 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300 dark:text-slate-200 group-hover:text-slate-100 transition-colors">
                    I agree to the{' '}
                    <button type="button" onClick={onTerms} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Terms & Conditions
                    </button>{' '}
                    and acknowledge that broker partnership is subject to approval and compliance verification.
                    {errors.agreeTerms && <span className="text-red-400"> {errors.agreeTerms}</span>}
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="agreePrivacy"
                    checked={formData.agreePrivacy}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded bg-slate-900/50 dark:bg-slate-950/50 border-slate-700 text-indigo-500 focus:ring-indigo-500/50 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300 dark:text-slate-200 group-hover:text-slate-100 transition-colors">
                    I have read and agree to the{' '}
                    <button type="button" onClick={onPrivacy} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                      Privacy Statement
                    </button>{' '}
                    including data collection, storage, and usage practices in accordance with the Privacy Act 1988 (Cth) and Australian Privacy Principles (APPs).
                    {errors.agreePrivacy && <span className="text-red-400"> {errors.agreePrivacy}</span>}
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name="agreeCompliance"
                    checked={formData.agreeCompliance}
                    onChange={handleChange}
                    className="w-5 h-5 mt-0.5 rounded bg-slate-900/50 dark:bg-slate-950/50 border-slate-700 text-indigo-500 focus:ring-indigo-500/50 focus:ring-2"
                  />
                  <span className="text-sm text-slate-300 dark:text-slate-200 group-hover:text-slate-100 transition-colors">
                    I confirm that I hold valid Australian licensing (AFSL/ACL or appropriate credit representative authority), that all provided information is true and accurate, and I understand that RateScan reserves the right to verify compliance and licensing status before granting access to lead generation services.
                    {errors.agreeCompliance && <span className="text-red-400"> {errors.agreeCompliance}</span>}
                  </span>
                </label>

                <div className="mt-6 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-300 font-medium">Note on Customer Dignity:</span> RateScan and its partners are committed to treating all customers with complete dignity, respect, and fairness. As a partner, you agree to uphold the highest standards of ethical conduct, privacy protection, and non-discriminatory practices in all customer interactions. This includes clear communication, transparent fee disclosure, informed consent, and the right of customers to make autonomous financial decisions without pressure or undue influence. Partners found in violation of these principles may have their access to lead generation services suspended or terminated.
                  </p>
                </div>
              </div>
            </section>

            {errors.submit && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                {errors.submit}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
              <button
                type="button"
                onClick={() => { setSubmitted(false); onHome() }}
                className="text-slate-400 hover:text-slate-300 text-sm transition-colors underline underline-offset-2"
              >
                ← Cancel
              </button>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
