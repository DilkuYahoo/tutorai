import { useState } from 'react'

const API         = import.meta.env.VITE_API_URL || ''
const MAX_MESSAGE = 100
const NAME_RE     = /^[a-zA-Z\s'\-]+$/

function ContactPage({ onBack }) {
  const [form, setForm]           = useState({ name: '', email: '', message: '', website: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const handleNameChange = (e) => {
    const val = e.target.value
    if (val === '' || NAME_RE.test(val)) {
      setForm(prev => ({ ...prev, name: val }))
    }
  }

  const handleMessageChange = (e) => {
    const val = e.target.value.slice(0, MAX_MESSAGE)
    setForm(prev => ({ ...prev, message: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
          <p className="mb-6">Your message has been sent. We'll get back to you soon.</p>
          <button onClick={onBack} className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Back to Home</button>
        </div>
      </div>
    )
  }

  const charsLeft = MAX_MESSAGE - form.message.length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-14">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Contact Us</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">RateScan · operated by CognifyLabs.ai</p>
        </div>
        <button onClick={onBack} className="text-sm text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors">← Back to rates</button>
      </header>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Get in Touch</h2>
          <p className="mb-4">Have questions about RateScan or need help with your loan application? We're here to help.</p>
          <div className="space-y-2">
            <p><strong>Hours:</strong> Monday to Friday, 9am – 6pm AEST</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">We typically respond within one business day.</p>
          </div>
        </div>
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                required
                placeholder="Jane Smith"
                value={form.name}
                onChange={handleNameChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                required
                placeholder="jane@email.com"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Message</label>
                <span className={`text-xs tabular-nums ${charsLeft <= 20 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {charsLeft} / {MAX_MESSAGE}
                </span>
              </div>
              <textarea
                required
                rows={5}
                placeholder="How can we help you?"
                value={form.message}
                onChange={handleMessageChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ display: 'none' }}
            />
            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ContactPage
