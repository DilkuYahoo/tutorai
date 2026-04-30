export default function StatCard({ label, value, sub, accent = false, badge }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-900 border-slate-800'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-indigo-200' : 'text-slate-500'}`}>{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className={`text-2xl font-bold ${accent ? 'text-white' : 'text-slate-100'}`}>{value}</p>
        {badge && (
          <span className="mb-0.5 text-xs font-semibold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      {sub && <p className={`text-xs mt-1 ${accent ? 'text-indigo-200' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  )
}
