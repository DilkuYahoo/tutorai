const VARIANTS = {
  primary:   'bg-indigo-500 hover:bg-indigo-400 text-white',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  ghost:     'hover:bg-slate-800 text-slate-400 hover:text-slate-200',
  danger:    'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function BaseButton({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  onClick,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...rest}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full font-semibold
        transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed
        ${VARIANTS[variant] ?? VARIANTS.primary}
        ${SIZES[size] ?? SIZES.md}
        ${className}
      `}
    >
      {children}
    </button>
  )
}
