import ReactECharts from "echarts-for-react";
import { format, parseISO } from "date-fns";

// Convert UTC ISO to AEST display label (UTC+10)
function toAEST(isoStr) {
  try {
    const d = parseISO(isoStr);
    // Offset by 10hrs manually to avoid TZ env issues in Lambda/browser
    const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return format(aest, "HH:mm");
  } catch {
    return isoStr;
  }
}

export default function PriceChart({ history = [], forecast = [] }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];

  const histImport = history.map((r) => r.importRate ?? null);
  const histFiT = history.map((r) => r.fitRate ?? null);
  const fcstImport = forecast.map((r) => r.importRate ?? null);
  const fcstFiT = forecast.map((r) => r.fitRate ?? null);

  // Show every Nth label to avoid crowding (show ~12 labels across the x axis)
  const step = Math.max(1, Math.floor(labels.length / 12));

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => `${p.marker}${p.seriesName}: <b>${p.value} c/kWh</b>`);
        return `<div class="text-xs">${label}<br/>${lines.join("<br/>")}</div>`;
      },
    },
    legend: { data: ["Import rate", "FiT rate"], top: 4 },
    grid: { left: 48, right: 16, top: 40, bottom: 48 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        interval: step - 1,
        fontSize: 10,
        rotate: 45,
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
        data: [...histImport, ...fcstImport],
        lineStyle: { color: "#3b82f6", width: 2 },
        emphasis: { focus: "series" },
      },
      {
        name: "FiT rate",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: [...histFiT, ...fcstFiT],
        lineStyle: { color: "#22c55e", width: 2 },
        emphasis: { focus: "series" },
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">
        Import &amp; FiT Rate — Last 24 hrs &amp; Next 24 hrs
      </h2>
      <ReactECharts option={option} style={{ height: 260 }} notMerge />
    </div>
  );
}
