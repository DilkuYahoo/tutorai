import ReactECharts from "echarts-for-react";
import { parseISO } from "date-fns";

function toAEST(isoStr) {
  try {
    const d = parseISO(isoStr);
    const aestTime = d.getTime() + 10 * 60 * 60 * 1000;
    const aestDate = new Date(aestTime);
    const hours = aestDate.getUTCHours();
    const mins = aestDate.getUTCMinutes();
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

function buildQualityData(items, valueExtractor) {
  return items.map((r) => {
    let color;
    if (r.quality === "Act") color = "#1e40af";
    else if (r.quality === "Exp") color = "#60a5fa";
    else color = "#93c5fd";
    return { value: valueExtractor(r), itemStyle: { color } };
  });
}

export default function PriceChart({ history = [], forecast = [], dark = false }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];
  const step = Math.max(1, Math.floor(labels.length / 16));

  const importData = buildQualityData(history, (r) => r.importRate ?? null);
  const importFcstData = buildQualityData(forecast, (r) => r.importRate ?? null);
  const fullImportData = [...importData, ...importFcstData];

  const fitData = buildQualityData(history, (r) => r.fitRate ?? null);
  const fitFcstData = buildQualityData(forecast, (r) => r.fitRate ?? null);
  const fullFitData = [...fitData, ...fitFcstData];

  const allRates = [...history, ...forecast].flatMap((r) => [r.importRate, r.fitRate]).filter((v) => v != null);
  const minRate = Math.floor(Math.min(...allRates) * 0.95 / 5) * 5;
  const maxRate = Math.ceil(Math.max(...allRates) * 1.05 / 5) * 5;

  const option = {
    darkMode: dark ? "auto" : "light",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", snap: true, lineStyle: { color: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.3)" } },
      backgroundColor: dark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.95)",
      borderColor: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)",
      textStyle: { color: dark ? "#e5e7eb" : "#111827" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const q = params[0]?.data?.quality || "Unknown";
        const lines = params.filter((p) => p.value != null).map((p) => `${p.marker} ${p.seriesName}: <b style="color:${p.color}">${p.value} c/kWh</b>`);
        return `<div style="font-size:11px;font-weight:600;border-bottom:1px solid ${dark?"rgba(255,255,255,0.15)":"rgba(0,0,0,0.1)"};padding-bottom:4px;margin-bottom:4px">${label} AEST</div><div style="font-size:10px;color:${dark?"#9ca3af":"#6b7280"};margin-bottom:6px">Quality: <span style="font-weight:600">${q}</span></div>${lines.join("<br/>")}`;
      },
    },
    legend: { data: ["Import rate", "FiT rate"], top: 8, textStyle: { fontSize: 11 }, itemGap: 16 },
    grid: { left: 52, right: 16, top: 48, bottom: 52, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: dark ? "#9ca3af" : "#6b7280", rotate: 0, formatter: (val, idx) => (idx % step === 0 ? val : "") },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "c/kWh",
      nameTextStyle: { fontSize: 10, color: dark ? "#9ca3af" : "#6b7280" },
      axisLine: { lineStyle: { color: dark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" } },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: dark ? "#9ca3af" : "#6b7280" },
      splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)", type: "dashed" } },
      min: minRate - 5,
      max: maxRate + 5,
    },
    visualMap: forecast.length > 0 ? [{
      show: false, type: "piecewise", left: "3%", right: "3%", top: "78%", orient: "horizontal",
      pieces: [{ gt: history.length - 1, lte: labels.length - 1, color: dark ? "rgba(250,204,21,0.12)" : "rgba(250,204,21,0.06)" }],
      borderWidth: 0, outOfRange: { color: "transparent" }, z: -1,
    }] : [],
    series: [{
      name: "Import rate",
      type: "line",
      data: fullImportData,
      smooth: true,
      symbol: "none",
      showSymbol: false,
      sampling: "lttb",
      areaStyle: {
        opacity: 0.22,
        color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: "rgba(59,130,246,0.32)" }, { offset: 1, color: "rgba(59,130,246,0.015)" },
        ]},
      },
      lineStyle: { width: 2.5, color: { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [
        { offset: 0, color: "#3b82f6" }, { offset: 0.5, color: "#2563eb" }, { offset: 1, color: "#1d4ed8" }
      ]}},
      zlevel: 2, z: 2,
    }, {
      name: "FiT rate",
      type: "line",
      data: fullFitData,
      smooth: true,
      symbol: "none",
      showSymbol: false,
      sampling: "lttb",
      areaStyle: {
        opacity: 0.18,
        color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: "rgba(16,185,129,0.35)" }, { offset: 1, color: "rgba(16,185,129,0.015)" },
        ]},
      },
      lineStyle: { width: 2.5, color: { type: "linear", x: 0, y: 0, x2: 1, y2: 0, colorStops: [
        { offset: 0, color: "#10b981" }, { offset: 0.5, color: "#059669" }, { offset: 1, color: "#047857" }
      ]}},
      zlevel: 1, z: 1,
    }],
    dataZoom: forecast.length > 0 ? [{
      type: "inside", start: 0, end: Math.min(100, Math.max(25, (history.length / labels.length) * 100)),
      throttle: 100, moveOnMouseMove: true, zoomOnMouseWheel: true, moveOnMouseWheel: true,
    }, {
      type: "slider", show: labels.length >= 48, height: 24, bottom: 8, start: 0,
      end: Math.min(100, Math.max(25, (history.length / labels.length) * 100)),
      backgroundColor: dark ? "rgba(100,100,100,0.15)" : "rgba(0,0,0,0.05)",
      fillerColor: dark ? "rgba(100,100,100,0.25)" : "rgba(0,0,0,0.08)",
      handleStyle: { color: dark ? "#9ca3af" : "#6b7280", borderColor: dark ? "rgba(100,100,100,0.4)" : "rgba(0,0,0,0.2)" },
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
            Import &amp; FiT Rate — 48 Hours
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            <span className="inline-block w-2 h-0.5 bg-blue-500 mr-1 rounded-full"></span> Import  <span className="inline-block w-2 h-0.5 bg-emerald-500 mr-1 rounded-full"></span> FiT  <span className="inline-block w-2 h-0.5 bg-amber-400/30 mr-1 rounded-full"></span> Future
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
      <ReactECharts option={option} theme={dark ? "dark" : undefined} style={{ height: 280 }} notMerge opts={{ renderer: "svg", animation: true }} />
    </div>
  );
}