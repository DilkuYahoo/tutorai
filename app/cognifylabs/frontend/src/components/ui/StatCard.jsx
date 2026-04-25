export default function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 animate-fade-in">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-indigo-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}
