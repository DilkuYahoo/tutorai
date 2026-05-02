import ReactECharts from "echarts-for-react";
import { parseISO } from "date-fns";

function toAEST(isoStr) {
  try {
    const d = new Date(isoStr);
    const aestTime = d.getTime() + 10 * 60 * 60 * 1000;
    const aestDate = new Date(aestTime);
    const hours = aestDate.getUTCHours();
    const mins = aestDate.getUTCMinutes();
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

function getBarStyle(quality, base) {
  const op = { Act: 0.9, Exp: 0.7, Fcst: 0.45 }[quality] || 0.45;
  if (base === "import") {
    return { color: `rgba(239, 68, 68, ${op})`, borderColor: `rgba(239, 68, 68, ${Math.min(op + 0.15, 1)})` };
  }
  return { color: `rgba(34, 197, 94, ${op})`, borderColor: `rgba(34, 197, 94, ${Math.min(op + 0.15, 1)})` };
}

export default function UsageChart({ history = [], forecast = [], dark = false }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];
  const step = Math.max(1, Math.floor(labels.length / 12));

  const importsData = [
    ...history.map((r) => ({ value: r.importsWh ?? 0, itemStyle: getBarStyle(r.quality || "Act", "import") })),
    ...forecast.map((r) => ({ value: r.importsWh ?? 0, itemStyle: getBarStyle(r.quality || "Fcst", "import") })),
  ];
  const exportsData = [
    ...history.map((r) => ({ value: r.exportsWh ?? 0, itemStyle: getBarStyle(r.quality || "Act", "export") })),
    ...forecast.map((r) => ({ value: r.exportsWh ?? 0, itemStyle: getBarStyle(r.quality || "Fcst", "export") })),
  ];

  const option = {
    darkMode: dark ? "auto" : "light",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: dark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)",
      textStyle: { color: dark ? "#e5e7eb" : "#111827" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const quality = params[0]?.data?.quality || "Unknown";
        const lines = params.filter((p) => p.value != null).map((p) => `${p.marker} ${p.seriesName}: <b>${p.value} Wh</b>`);
        return '<div style="font-size:11px;font-weight:600;border-bottom:1px solid ' + (dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)") + ';padding-bottom:4px;margin-bottom:4px">' + label + ' AEST</div><div style="font-size:10px;color:' + (dark ? "#9ca3af" : "#6b7280") + ';margin-bottom:6px">Quality: <span style="font-weight:600">' + quality + '</span></div>' + lines.join("<br/>");
      },
    },
    legend: {
      data: ["Imported (Wh)", "Exported (Wh)"],
      top: 8,
      textStyle: { fontSize: 11 },
      itemGap: 16,
    },
    grid: { left: 52, right: 16, top: 48, bottom: 52, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10,
        color: dark ? "#9ca3af" : "#6b7280",
        rotate: 0,
        formatter: (val, idx) => (idx % step === 0 ? val : ""),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Wh",
      nameTextStyle: { fontSize: 10, color: dark ? "#9ca3af" : "#6b7280" },
      axisLine: { lineStyle: { color: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: dark ? "#9ca3af" : "#6b7280" },
      splitLine: {
        lineStyle: {
          color: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
          type: "dashed",
        },
      },
      min: 0,
    },
    series: [
      {
        name: "Imported (Wh)",
        type: "bar",
        barMaxWidth: 10,
        barGap: "20%",
        data: importsData,
        zlevel: 2,
      },
      {
        name: "Exported (Wh)",
        type: "bar",
        barMaxWidth: 10,
        barGap: "20%",
        data: exportsData,
        zlevel: 1,
      },
    ],
    dataZoom: labels.length >= 48 ? [{
      type: "inside",
      start: 0,
      end: Math.min(100, Math.max(25, (history.length / labels.length) * 100)),
      throttle: 100,
    }, {
      type: "slider",
      height: 24,
      bottom: 8,
      start: 0,
      end: Math.min(100, Math.max(25, (history.length / labels.length) * 100)),
      backgroundColor: dark ? "rgba(100,100,100,0.15)" : "rgba(0,0,0,0.05)",
      fillerColor: dark ? "rgba(100,100,100,0.25)" : "rgba(0,0,0,0.08)",
      handleStyle: {
        color: dark ? "#9ca3af" : "#6b7280",
        borderColor: dark ? "rgba(100,100,100,0.4)" : "rgba(0,0,0,0.2)",
      },
      borderColor: dark ? "rgba(100,100,100,0.15)" : "rgba(0,0,0,0.1)",
    }] : [],
    animation: true,
    animationDuration: 800,
    animationEasing: "cubicOut",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-4 border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            Energy Usage — Imports &amp; Exports
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            <span className="inline-block w-2 h-0.5 bg-red-500 mr-1 rounded-full"></span> Imported  <span className="inline-block w-2 h-0.5 bg-emerald-500 mr-1 rounded-full"></span> Exported
          </p>
        </div>
        {forecast.length > 0 && history.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              Forecast
            </span>
          </div>
        )}
      </div>
      <ReactECharts option={option} theme={dark ? "dark" : undefined} style={{ height: 260 }} notMerge opts={{ renderer: "svg", animation: true }} />
    </div>
  );
}