function dollars(cents) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
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

  const formatDay = (dayData) => {
    if (!dayData) return null;
    const { spendCents, earnCents, netCents } = dayData;
    const isCredit = netCents < 0;
    return (
      <>
        <span className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-red-600 dark:text-red-400">{dollars(spendCents)}</span> spent
        </span>
        <span className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-green-600 dark:text-green-400">{dollars(earnCents)}</span> earned
        </span>
        <span className="text-slate-600 dark:text-slate-400">
          <span className={`font-semibold ${isCredit ? "text-green-600 dark:text-green-400" : "text-slate-800 dark:text-slate-200"}`}>
            {isCredit ? `${dollars(Math.abs(netCents))} credit` : dollars(netCents)}
          </span>{" "}
          net
        </span>
      </>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-6 items-start sm:items-center text-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full">
        <span className="font-medium text-slate-700 dark:text-slate-300 w-20 sm:w-auto">Today</span>
        {formatDay(today)}
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full">
        <span className="font-medium text-slate-700 dark:text-slate-300 w-20 sm:w-auto">Yesterday</span>
        {formatDay(yesterday)}
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full">
        <span className="font-medium text-slate-700 dark:text-slate-300 w-20 sm:w-auto">Day Before</span>
        {formatDay(dayBefore)}
      </div>
    </div>
  );
}