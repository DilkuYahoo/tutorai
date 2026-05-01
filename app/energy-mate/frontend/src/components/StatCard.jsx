export default function StatCard({ label, value, unit, sub, colour = "blue", loading = false, quality = null }) {
  const colours = {
    blue: "border-blue-500 text-blue-600 dark:text-blue-400",
    green: "border-green-500 text-green-600 dark:text-green-400",
    red: "border-red-500 text-red-600 dark:text-red-400",
    amber: "border-amber-500 text-amber-600 dark:text-amber-400",
    slate: "border-slate-400 text-slate-600 dark:text-slate-400",
  };

  const qualityColors = {
    Act: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    Exp: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    Fcst: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  };

  const qualityLabel = {
    Act: "Actual",
    Exp: "Expected",
    Fcst: "Forecast",
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border-l-4 shadow-sm p-3 sm:p-4 flex flex-col gap-1 ${colours[colour]} relative`}>
      {quality && (
        <span className={`absolute top-2 right-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide leading-tight cursor-default ${qualityColors[quality]}`} title={qualityLabel[quality] || quality}>
          {quality}
        </span>
      )}
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight">{label}</span>
      {loading ? (
        <div className="h-7 w-20 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-xl sm:text-2xl font-bold">{value ?? "—"}</span>
          {unit && <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
        </div>
      )}
      {sub && <span className="text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}