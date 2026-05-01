function dollars(cents) {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BillingSummary({ billing, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-6 items-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-28 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!billing) return null;

  const { spendCents, earnCents, netCents } = billing;
  const isCredit = netCents < 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-6 items-center text-sm">
      <span className="font-medium text-slate-700">Today</span>
      <span className="text-slate-600">
        <span className="font-semibold text-red-600">{dollars(spendCents)}</span> spent
      </span>
      <span className="text-slate-600">
        <span className="font-semibold text-green-600">{dollars(earnCents)}</span> earned
      </span>
      <span className="text-slate-600">
        <span className={`font-semibold ${isCredit ? "text-green-600" : "text-slate-800"}`}>
          {isCredit ? `${dollars(Math.abs(netCents))} credit` : dollars(netCents)}
        </span>{" "}
        net
      </span>
    </div>
  );
}
