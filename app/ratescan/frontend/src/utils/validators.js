const stripCurrency = (v) => String(v).replace(/[^0-9.]/g, '')

export const validate = {
  name(v) {
    if (!v?.trim()) return 'Full name is required'
    if (v.trim().length < 2) return 'Name must be at least 2 characters'
    if (!/^[a-zA-Z\s'\-]+$/.test(v.trim())) return 'Name can only contain letters, spaces, hyphens and apostrophes'
    return null
  },

  age(v) {
    if (v === '' || v === null || v === undefined) return 'Age is required'
    if (!/^\d+$/.test(String(v).trim())) return 'Age must be a whole number'
    const n = Number(v)
    if (n < 18) return 'You must be at least 18 years old'
    if (n > 99) return 'Enter a valid age between 18 and 99'
    return null
  },

  mobile(v) {
    if (!v?.trim()) return 'Mobile number is required'
    const clean = v.replace(/\s/g, '')
    if (!/^04\d{8}$/.test(clean)) return 'Enter a valid Australian mobile (04xx xxx xxx)'
    return null
  },

  email(v) {
    if (!v?.trim()) return 'Email address is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return 'Enter a valid email address'
    return null
  },

  currency(v, label = 'This field') {
    if (!v) return `${label} is required`
    const n = Number(stripCurrency(v))
    if (!n || n <= 0) return `${label} must be greater than zero`
    if (n > 100_000_000) return `${label} seems too high — please check`
    return null
  },

  loanAmount(v, propertyValue) {
    const err = validate.currency(v, 'Loan amount')
    if (err) return err
    const la = Number(stripCurrency(v))
    const pv = Number(stripCurrency(propertyValue))
    if (pv > 0 && la > pv) return 'Loan amount cannot exceed property value'
    return null
  },
}

/** Returns true if an object of { field: errorString|null } has no errors */
export const allValid = (errors) => Object.values(errors).every((e) => !e)
