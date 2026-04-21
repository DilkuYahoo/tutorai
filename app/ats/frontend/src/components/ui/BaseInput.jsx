export default function BaseInput({
  label,
  id,
  error,
  helper,
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
      <input
        id={id}
        className={`
          w-full bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-white
          placeholder:text-slate-600 outline-none transition-colors duration-150
          ${borderCls}
        `}
        {...props}
      />
      {error  && <p className="text-xs text-red-400">{error}</p>}
      {helper && !error && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  )
}
