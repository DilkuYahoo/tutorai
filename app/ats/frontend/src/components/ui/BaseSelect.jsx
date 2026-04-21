export default function BaseSelect({
  label,
  id,
  error,
  helper,
  options = [],
  placeholder,
  className = '',
  ...props
}) {
  const borderCls = error
    ? 'border-red-500 focus:border-red-400'
    : 'border-slate-700 focus:border-indigo-500'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`
          w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-white
          outline-none transition-colors duration-150 cursor-pointer
          ${borderCls}
        `}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          typeof opt === 'string'
            ? <option key={opt} value={opt}>{opt}</option>
            : <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error  && <p className="text-xs text-red-400">{error}</p>}
      {helper && !error && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  )
}
