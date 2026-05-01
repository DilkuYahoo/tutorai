import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import StatCard from "../components/StatCard";
import BillingSummary from "../components/BillingSummary";
import PriceChart from "../components/PriceChart";
import UsageChart from "../components/UsageChart";
import RefreshButton from "../components/RefreshButton";
import { getMockLive, getMockHistory } from "../mock";

const API_URL = import.meta.env.VITE_API_URL || "";
const USE_MOCK = !API_URL;

async function fetchLive() {
  if (USE_MOCK) return getMockLive();
  const r = await fetch(`${API_URL}/dashboard/live`);
  if (!r.ok) throw new Error(`Live fetch failed: ${r.status}`);
  return r.json();
}

async function fetchHistory() {
  if (USE_MOCK) return getMockHistory();
  const r = await fetch(`${API_URL}/dashboard/history`);
  if (!r.ok) throw new Error(`History fetch failed: ${r.status}`);
  return r.json();
}

function formatAEST(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = parseISO(isoStr);
    const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return format(aest, "d MMM yyyy HH:mm") + " AEST";
  } catch {
    return isoStr;
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  try {
    const diffMin = Math.floor((Date.now() - parseISO(isoStr).getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin === 1) return "1 min ago";
    if (diffMin < 60) return `${diffMin} min ago`;
    const hrs = Math.floor(diffMin / 60);
    return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  } catch {
    return null;
  }
}

function qualityBadge(quality) {
  const map = {
    Act: { label: "Actual", cls: "bg-green-100 text-green-700" },
    Exp: { label: "Expected", cls: "bg-blue-100 text-blue-700" },
    Fcst: { label: "Forecast", cls: "bg-amber-100 text-amber-700" },
  };
  const q = map[quality] ?? { label: quality, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${q.cls}`}>
      {q.label}
    </span>
  );
}

export default function Dashboard() {
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [liveError, setLiveError] = useState(null);
  const [histError, setHistError] = useState(null);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      setLive(await fetchLive());
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    setHistError(null);
    try {
      setHistory(await fetchHistory());
    } catch (e) {
      setHistError(e.message);
    } finally {
      setHistLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    loadLive();
    loadHistory();
  }, [loadLive, loadHistory]);

  useEffect(() => {
    refresh();
  }, []);

  const loading = liveLoading || histLoading;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <h1 className="text-lg font-bold text-slate-800">Energy-Mate</h1>
          {USE_MOCK && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              mock data
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {live?.lastFetched && timeAgo(live.lastFetched) && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {timeAgo(live.lastFetched)}
            </span>
          )}
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        {/* Errors */}
        {(liveError || histError) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {liveError && <p>Live data error: {liveError}</p>}
            {histError && <p>History error: {histError}</p>}
          </div>
        )}

        {/* Current interval row */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Current Interval
            </h2>
            {live?.quality && qualityBadge(live.quality)}
            {live?.intervalEnd && (
              <span className="text-xs text-slate-400">{formatAEST(live.intervalEnd)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Import Rate"
              value={live?.importRate != null ? parseFloat(live.importRate).toFixed(2) : null}
              unit={live?.importRateUnits ?? "c/kWh"}
              colour="blue"
              loading={liveLoading}
            />
            <StatCard
              label="FiT Rate"
              value={live?.fitRate != null ? parseFloat(live.fitRate).toFixed(2) : null}
              unit={live?.fitRateUnits ?? "c/kWh"}
              colour="green"
              loading={liveLoading}
            />
            <StatCard
              label="Imported"
              value={live?.importsWh != null ? parseFloat(live.importsWh).toFixed(0) : null}
              unit="Wh"
              colour="red"
              loading={liveLoading}
            />
            <StatCard
              label="Exported"
              value={live?.exportsWh != null ? parseFloat(live.exportsWh).toFixed(0) : null}
              unit="Wh"
              colour="green"
              loading={liveLoading}
            />
            <StatCard
              label="Net Cost"
              value={
                live?.importRate != null && live?.importsWh != null
                  ? ((parseFloat(live.importsWh) / 1000) * parseFloat(live.importRate)).toFixed(1)
                  : null
              }
              unit="c"
              sub="this interval"
              colour="amber"
              loading={liveLoading}
            />
          </div>
        </div>

        {/* Billing summary */}
        <BillingSummary billing={history?.todayBilling} loading={histLoading} />

        {/* Price chart */}
        {!histLoading && history ? (
          <PriceChart history={history.history} forecast={history.forecast} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4 h-72 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        )}

        {/* Usage chart */}
        {!histLoading && history ? (
          <UsageChart history={history.history} forecast={history.forecast} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-4 h-56 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          </div>
        )}

        <p className="text-xs text-slate-400 text-center pb-4">
          Data sourced from Localvolts API · All times in AEST (UTC+10)
        </p>
      </main>
    </div>
  );
}
