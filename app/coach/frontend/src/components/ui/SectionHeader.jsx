export default function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
