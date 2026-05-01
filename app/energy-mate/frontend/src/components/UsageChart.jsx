import ReactECharts from "echarts-for-react";
import { format, parseISO } from "date-fns";

function toAEST(isoStr) {
  try {
    const d = parseISO(isoStr);
    const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
    return format(aest, "HH:mm");
  } catch {
    return isoStr;
  }
}

export default function UsageChart({ history = [], forecast = [] }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];

  const step = Math.max(1, Math.floor(labels.length / 12));

  const importsData = [
    ...history.map((r) => ({ value: r.importsWh ?? 0, itemStyle: { color: "#ef4444" } })),
    ...forecast.map((r) => ({ value: r.importsWh ?? 0, itemStyle: { color: "#fca5a5" } })),
  ];
  const exportsData = [
    ...history.map((r) => ({ value: r.exportsWh ?? 0, itemStyle: { color: "#22c55e" } })),
    ...forecast.map((r) => ({ value: r.exportsWh ?? 0, itemStyle: { color: "#86efac" } })),
  ];

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => `${p.marker}${p.seriesName}: <b>${p.value} Wh</b>`);
        return `<div class="text-xs">${label}<br/>${lines.join("<br/>")}</div>`;
      },
    },
    legend: { data: ["Imported (Wh)", "Exported (Wh)"], top: 4 },
    grid: { left: 56, right: 16, top: 40, bottom: 48 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { interval: step - 1, fontSize: 10, rotate: 45 },
    },
    yAxis: {
      type: "value",
      name: "Wh",
      nameTextStyle: { fontSize: 10 },
      axisLabel: { fontSize: 10 },
    },
    series: [
      {
        name: "Imported (Wh)",
        type: "bar",
        barMaxWidth: 6,
        stack: "usage",
        data: importsData,
      },
      {
        name: "Exported (Wh)",
        type: "bar",
        barMaxWidth: 6,
        stack: "usage",
        data: exportsData,
      },
    ],
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">
        Energy Usage — Imports &amp; Exports
        <span className="ml-3 text-xs font-normal text-slate-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500 mr-1" />imported
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mx-1 ml-3" />exported
        </span>
      </h2>
      <ReactECharts option={option} style={{ height: 220 }} notMerge />
    </div>
  );
}
