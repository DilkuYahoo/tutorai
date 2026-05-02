function dollars(cents) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function MiniBar({ spent, earned, width = 48 }) {
  const total = spent + earned;
  if (total === 0) return null;
  const spendPct = Math.min((spent / total) * 100, 100);
  const earnPct = Math.min((earned / total) * 100, 100);
  return (
    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden" style={{ width }}>
      <div className="h-full flex" style={{ width: '100%' }}>
        {spendPct > 0 && (
          <div className="h-full bg-red-400 dark:bg-red-500" style={{ width: `${spendPct}%` }} />
        )}
        {earnPct > 0 && (
          <div className="h-full bg-green-400 dark:bg-green-500" style={{ width: `${earnPct}%` }} />
        )}
      </div>
    </div>
  );
}

function DayCard({ label, dayData, isToday }) {
  if (!dayData) return null;
  const { spendCents, earnCents, netCents } = dayData;
  const isCredit = netCents < 0;
  const netAbs = Math.abs(netCents);
  const spendDollars = spendCents / 100;
  const earnDollars = earnCents / 100;
  const netDollars = netAbs / 100;

  return (
    <div className={`flex-1 rounded-xl p-3 sm:p-4 border transition-all ${isToday ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        {isToday && (
          <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full font-medium">
            Current
          </span>
        )}
      </div>

      {/* Mini visualization */}
      <div className="mb-3">
        <MiniBar spent={spendCents} earned={earnCents} />
      </div>

      {/* Money flows */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Outflow</span>
          <span className="font-mono text-sm font-semibold text-red-600 dark:text-red-400">
            -{dollars(spendCents)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Inflow</span>
          <span className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">
            +{dollars(earnCents)}
          </span>
        </div>
      </div>

      {/* Net result */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">Net</span>
          <span className={`font-mono text-base font-bold ${
            isCredit ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-200'
          }`}>
            {isCredit ? '+' : '-'}{dollars(netAbs)}
          </span>
        </div>
      </div>

      {/* Earnings gauge */}
      {earnCents > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
            <span>FiT rate:</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              {(earnDollars / (spendDollars || 1) * 100).toFixed(0)}% offset
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingSummary({ billing, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 flex gap-4 items-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!billing) return null;

  const { today, yesterday, dayBefore } = billing;

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 sm:p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DayCard label="Today" dayData={today} isToday />
        <DayCard label="Yesterday" dayData={yesterday} />
        <DayCard label="Day Before" dayData={dayBefore} />
      </div>
    </div>
  );
}
