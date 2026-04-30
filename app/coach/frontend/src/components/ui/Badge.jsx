const COLOURS = {
  green:  'bg-emerald-900/50 text-emerald-400 border-emerald-700',
  red:    'bg-red-900/50 text-red-400 border-red-700',
  amber:  'bg-amber-900/50 text-amber-400 border-amber-700',
  blue:   'bg-blue-900/50 text-blue-400 border-blue-700',
  indigo: 'bg-indigo-900/50 text-indigo-400 border-indigo-700',
  slate:  'bg-slate-800 text-slate-400 border-slate-700',
}

export default function Badge({ label, colour = 'slate' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${COLOURS[colour]}`}>
      {label}
    </span>
  )
}
