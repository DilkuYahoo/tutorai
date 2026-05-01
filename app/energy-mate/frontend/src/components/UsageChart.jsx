import ReactECharts from "echarts-for-react";

function toAEST(isoStr) {
  try {
    const d = new Date(isoStr);
    // Convert UTC time to AEST (UTC+10) using UTC getters to avoid local timezone issues
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

export default function UsageChart({ history = [], forecast = [], dark = false }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];

  const step = Math.max(1, Math.floor(labels.length / 12));

  // Quality-based styling for usage bars
  // Actual (Act): solid colors (history, settled data)
  // Expected (Exp): slightly lighter/higher opacity (history, mixed)
  // Forecast (Fcst): lightest/most transparent (forecast)
  const getBarStyle = (quality, baseImport, baseExport) => {
    const opacity = { Act: 1.0, Exp: 0.85, Fcst: 0.55 };
    const op = opacity[quality] || opacity.Fcst;
    return {
      import: { color: `rgba(239, 68, 68, ${op})`, borderColor: op < 1 ? `rgba(239, 68, 68, ${op + 0.1})` : undefined },
      export: { color: `rgba(34, 197, 94, ${op})`, borderColor: op < 1 ? `rgba(34, 197, 94, ${op + 0.1})` : undefined },
    };
  };

  const importsData = [
    ...history.map((r) => {
      const style = getBarStyle(r.quality || "Act");
      return { value: r.importsWh ?? 0, itemStyle: style.import };
    }),
    ...forecast.map((r) => {
      const style = getBarStyle(r.quality || "Fcst");
      return { value: r.importsWh ?? 0, itemStyle: style.import };
    }),
  ];
  const exportsData = [
    ...history.map((r) => {
      const style = getBarStyle(r.quality || "Act");
      return { value: r.exportsWh ?? 0, itemStyle: style.export };
    }),
    ...forecast.map((r) => {
      const style = getBarStyle(r.quality || "Fcst");
      return { value: r.exportsWh ?? 0, itemStyle: style.export };
    }),
  ];

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const quality = params[0]?.data?.quality || "";
        const qualityBadge = quality ? `<br/><span style="font-size:11px">${quality}</span>` : "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => `${p.marker}${p.seriesName}: <b>${p.value} Wh</b>`);
        return `<div style="font-size:12px">${label} AEST${qualityBadge}<br/>${lines.join("<br/>")}</div>`;
      },
    },
    legend: { data: ["Imported (Wh)", "Exported (Wh)"], top: 4 },
    grid: { left: 52, right: 12, top: 40, bottom: 48 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: {
        fontSize: 10,
        rotate: 45,
        formatter: (val, idx) => {
          if (idx % step === 0) return val;
          return "";
        },
      },
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
        data: importsData,
      },
      {
        name: "Exported (Wh)",
        type: "bar",
        barMaxWidth: 6,
        data: exportsData,
      },
    ],
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-3 sm:p-4">
      <h2 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
        Energy Usage — Imports &amp; Exports
        <span className="ml-2 sm:ml-3 text-xs font-normal text-slate-400 dark:text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500 mr-1" />imported
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500 mx-1 ml-2 sm:ml-3" />exported
        </span>
      </h2>
      <ReactECharts
        option={option}
        theme={dark ? "dark" : undefined}
        style={{ height: 220 }}
        notMerge
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
