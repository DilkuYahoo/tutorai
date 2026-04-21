const VARIANTS = {
  indigo:  'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  amber:   'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  red:     'bg-red-500/10 text-red-400 border border-red-500/30',
  slate:   'bg-slate-800 text-slate-400 border border-slate-700',
}

export default function BaseBadge({ label, variant = 'slate' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${VARIANTS[variant] ?? VARIANTS.slate}`}>
      {label}
    </span>
  )
}
