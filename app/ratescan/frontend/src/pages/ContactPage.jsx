import { useState } from 'react'

function ContactPage({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // In a real app, send to server
    console.log('Contact form submitted:', form)
    setSubmitted(true)
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
              <p><strong>Email:</strong> info@ratescan.com.au</p>
              <p><strong>Phone:</strong> 1800-RATESCAN (1800 728 372)</p>
              <p><strong>Hours:</strong> Monday to Friday, 9am - 6pm AEST</p>
            </div>
          </div>
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Send Message
              </button>
            </form>
          </div>
      </div>
    </div>
  )
}

export default ContactPage