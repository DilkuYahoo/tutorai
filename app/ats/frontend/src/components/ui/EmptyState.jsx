export default function EmptyState({ icon, heading, subtext, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && <div className="mb-4 text-slate-600">{icon}</div>}
      <p className="text-sm font-semibold text-slate-400">{heading}</p>
      {subtext && <p className="mt-1 text-xs text-slate-600">{subtext}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
