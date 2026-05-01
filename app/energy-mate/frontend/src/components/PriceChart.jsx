import ReactECharts from "echarts-for-react";
import { parseISO } from "date-fns";

function toAEST(isoStr) {
  try {
    const d = parseISO(isoStr);
    // Convert UTC ISO time to AEST (UTC+10) using UTC getters to avoid local timezone issues
    const aestTime = d.getTime() + 10 * 60 * 60 * 1000;
    const aestDate = new Date(aestTime);
    // Format manually using UTC methods since we've already shifted to AEST epoch
    const hours = aestDate.getUTCHours();
    const mins = aestDate.getUTCMinutes();
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return isoStr;
  }
}

export default function PriceChart({ history = [], forecast = [], dark = false }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];

  const step = Math.max(1, Math.floor(labels.length / 12));

  const histImport = history.map((r) => r.importRate ?? null);
  const histFiT = history.map((r) => r.fitRate ?? null);
  const fcstImport = forecast.map((r) => r.importRate ?? null);
  const fcstFiT = forecast.map((r) => r.fitRate ?? null);

  // Build data with itemStyle for each point based on quality
  const buildPointData = (items) =>
    items.map((r) => {
      let color;
      if (r.quality === "Act") color = "#3b82f6";
      else if (r.quality === "Exp") color = "#60a5fa";
      else color = "#93c5fd";
      return { value: r.importRate ?? null, itemStyle: { color } };
    });

  const buildPointDataFit = (items) =>
    items.map((r) => {
      let color;
      if (r.quality === "Act") color = "#10b981";
      else if (r.quality === "Exp") color = "#34d399";
      else color = "#6ee7b7";
      return { value: r.fitRate ?? null, itemStyle: { color } };
    });

  const importData = [...buildPointData(history), ...buildPointData(forecast)];
  const fitData = [...buildPointDataFit(history), ...buildPointDataFit(forecast)];

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => `${p.marker} ${p.seriesName}: <b>${p.value} c/kWh</b>`);
        return `<div style="font-size:12px">${label} AEST<br/>${lines.join("<br/>")}</div>`;
      },
    },
    legend: { data: ["Import rate", "FiT rate"], top: 4 },
    grid: { left: 48, right: 12, top: 40, bottom: 48 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        fontSize: 10,
        rotate: 45,
        formatter: (val, idx) => (idx % step === 0 ? val : ""),
      },
    },
    yAxis: {
      type: "value",
      name: "c/kWh",
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: "Import rate",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: importData,
        lineStyle: { color: "#3b82f6", width: 2 },
        emphasis: { focus: "series" },
      },
      {
        name: "FiT rate",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: fitData,
        lineStyle: { color: "#10b981", width: 2 },
        emphasis: { focus: "series" },
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-4">
      <h2 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        Import &amp; FiT Rate — Last 24 hrs &amp; Next 24 hrs
      </h2>
      <ReactECharts
        option={option}
        theme={dark ? "dark" : undefined}
        style={{ height: 280 }}
        notMerge
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
