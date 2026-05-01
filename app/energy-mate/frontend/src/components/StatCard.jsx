export default function StatCard({ label, value, unit, sub, colour = "blue", loading = false }) {
  const colours = {
    blue: "border-blue-500 text-blue-600",
    green: "border-green-500 text-green-600",
    red: "border-red-500 text-red-600",
    amber: "border-amber-500 text-amber-600",
    slate: "border-slate-400 text-slate-600",
  };

  return (
    <div className={`bg-white rounded-xl border-l-4 shadow-sm p-4 flex flex-col gap-1 ${colours[colour]}`}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value ?? "—"}</span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
      )}
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}
