import { useState, useEffect, useCallback } from "react";
import { parseISO } from "date-fns";
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
    const d = new Date(isoStr);
    // Convert UTC time to AEST (UTC+10) using UTC getters
    const aestTime = d.getTime() + 10 * 60 * 60 * 1000;
    const aestDate = new Date(aestTime);
    const year = aestDate.getUTCFullYear();
    const month = String(aestDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(aestDate.getUTCDate()).padStart(2, "0");
    const hours = String(aestDate.getUTCHours()).padStart(2, "0");
    const mins = String(aestDate.getUTCMinutes()).padStart(2, "0");
    return `${day} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][aestDate.getUTCMonth()]} ${year} ${hours}:${mins} AEST`;
  } catch {
    return isoStr;
  }
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return null;
  try {
    const diffMs = Date.now() - parseISO(isoStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 0) return "just now";
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins === 0) return `${secs} sec ago`;
    return `${mins} min ${secs} sec ago`;
  } catch {
    return null;
  }
}

function qualityBadge(quality) {
  const map = {
    Act: { label: "Actual", cls: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    Exp: { label: "Expected", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    Fcst: { label: "Forecast", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  };
  const q = map[quality] ?? { label: quality, cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${q.cls}`}>
      {q.label}
    </span>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export default function Dashboard({ dark, onToggleDark }) {
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [liveError, setLiveError] = useState(null);
  const [histError, setHistError] = useState(null);
  const [timeAgoStr, setTimeAgoStr] = useState("");

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

  // Update relative time counter every second
  useEffect(() => {
    if (!live?.lastFetched) return;
    const updateTimeAgo = () => {
      const str = formatTimeAgo(live.lastFetched);
      setTimeAgoStr(str);
    };
    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [live?.lastFetched]);

  useEffect(() => {
    refresh();
  }, []);

  const loading = liveLoading || histLoading;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl sm:text-2xl">⚡</span>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">Energy-Mate</h1>
          {USE_MOCK && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-full font-medium shrink-0">
              mock
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {live?.lastFetched && timeAgoStr && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Updated {timeAgoStr}
            </span>
          )}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <RefreshButton onClick={refresh} loading={loading} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5">
        {/* Errors */}
        {(liveError || histError) && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {liveError && <p>Live data error: {liveError}</p>}
            {histError && <p>History error: {histError}</p>}
          </div>
        )}

        {/* Current interval row */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Current Interval
            </h2>
            {live?.quality && qualityBadge(live.quality)}
            {live?.intervalEnd && (
              <span className="text-xs text-slate-400 dark:text-slate-500">{formatAEST(live.intervalEnd)}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
             <StatCard
               label="Import Rate"
               value={live?.importRate != null ? parseFloat(live.importRate).toFixed(2) : null}
               unit={live?.importRateUnits ?? "c/kWh"}
               colour="blue"
               loading={liveLoading}
               quality={live?.quality}
             />
             <StatCard
               label="FiT Rate"
               value={live?.fitRate != null ? parseFloat(live.fitRate).toFixed(2) : null}
               unit={live?.fitRateUnits ?? "c/kWh"}
               colour="green"
               loading={liveLoading}
               quality={live?.quality}
             />
          </div>
        </div>

        {/* Billing summary */}
        <BillingSummary billing={{
          today: history?.todayBilling,
          yesterday: history?.yesterdayBilling,
          dayBefore: history?.day2Billing,
        }} loading={histLoading} />

        {/* Price chart */}
        {!histLoading && history ? (
          <PriceChart history={history.history} forecast={history.forecast} dark={dark} />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-56 sm:h-72 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        {/* Usage chart */}
        {!histLoading && history ? (
          <UsageChart history={history.history} forecast={history.forecast} dark={dark} />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 h-48 sm:h-56 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
          Data sourced from Localvolts API · All times in AEST (UTC+10)
        </p>
      </main>
    </div>
  );
}

