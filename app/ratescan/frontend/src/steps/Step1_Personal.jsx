import { useEffect, useRef, useState } from 'react'
import Navigation from '../components/Navigation'
import { validate, allValid } from '../utils/validators'

function fieldCls(touched, error) {
  if (touched && error)  return 'border-red-500 focus:border-red-400'
  if (touched && !error) return 'border-emerald-500 focus:border-emerald-400'
  return 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'
}

export default function Step1_Personal({ formData, updateField, onNext, isFirst }) {
  const nameRef = useRef(null)
  const [touched, setTouched] = useState({})

  useEffect(() => { nameRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Enter' && allValid(errors)) onNext() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const touch = (f) => setTouched((t) => ({ ...t, [f]: true }))

  const errors = {
    name:   validate.name(formData.name),
    age:    validate.age(formData.age),
    mobile: validate.mobile(formData.mobile),
    email:  validate.email(formData.email),
  }

  const base = 'w-full bg-white dark:bg-slate-900 border rounded-xl px-5 py-4 text-xl text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none transition-colors'
  const label = 'block text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2'

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 font-medium">Let's get started</p>
      <h2 className="text-3xl font-semibold tracking-tight mb-10 text-slate-900 dark:text-white">Tell us about yourself</h2>

      <div className="space-y-6">
        <div>
          <label className={label}>Full Name</label>
          <input ref={nameRef} type="text" value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            onBlur={() => touch('name')}
            placeholder="e.g. Sarah Johnson"
            className={`${base} ${fieldCls(touched.name, errors.name)}`} />
          {touched.name && errors.name && <p className="mt-2 text-sm text-red-500">{errors.name}</p>}
        </div>

        <div>
          <label className={label}>Age</label>
          <input type="text" inputMode="numeric" value={formData.age}
            onChange={(e) => updateField('age', e.target.value.replace(/\D/g, ''))}
            onBlur={() => touch('age')}
            placeholder="e.g. 34" maxLength={2}
            className={`${base} ${fieldCls(touched.age, errors.age)}`} />
          {touched.age && errors.age && <p className="mt-2 text-sm text-red-500">{errors.age}</p>}
        </div>

        <div>
          <label className={label}>Mobile Number</label>
          <input type="tel" value={formData.mobile}
            onChange={(e) => updateField('mobile', e.target.value)}
            onBlur={() => touch('mobile')}
            placeholder="e.g. 0412 345 678"
            className={`${base} ${fieldCls(touched.mobile, errors.mobile)}`} />
          {touched.mobile && errors.mobile && <p className="mt-2 text-sm text-red-500">{errors.mobile}</p>}
        </div>

        <div>
          <label className={label}>Email Address</label>
          <input type="email" value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => touch('email')}
            placeholder="e.g. sarah@email.com"
            className={`${base} ${fieldCls(touched.email, errors.email)}`} />
          {touched.email && errors.email && <p className="mt-2 text-sm text-red-500">{errors.email}</p>}
        </div>
      </div>

      <Navigation onNext={onNext} isFirst={isFirst} isLast={false} nextDisabled={!allValid(errors)} />
    </div>
  )
}
