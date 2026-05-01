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

function getLineStyle(quality) {
  const styles = {
    Act: { type: "solid", width: 2 },
    Exp: { type: "solid", width: 2, dash: [4, 4] },
    Fcst: { type: "dashed", width: 2, dash: [6, 4] },
  };
  return styles[quality] || styles.Fcst;
}

export default function PriceChart({ history = [], forecast = [], dark = false }) {
  const histLabels = history.map((r) => toAEST(r.intervalEnd));
  const fcstLabels = forecast.map((r) => toAEST(r.intervalEnd));
  const labels = [...histLabels, ...fcstLabels];

  // Build segmented series by quality to show different line styles
  const importSeries = [];
  const fitSeries = [];

  // Helper: group consecutive items with same quality
  const buildSegments = (items, valueKey) => {
    const segments = [];
    let currentSeg = null;
    items.forEach((r) => {
      const q = r.quality || "Fcst";
      const val = r[valueKey] ?? null;
      if (!currentSeg || currentSeg.quality !== q) {
        currentSeg = { quality: q, data: [], label: q === "Act" ? "Actual" : q === "Exp" ? "Expected" : "Forecast" };
        segments.push(currentSeg);
      }
      currentSeg.data.push(val);
    });
    return segments;
  };

  const importHistSegs = buildSegments(history, "importRate");
  const fitHistSegs = buildSegments(history, "fitRate");
  const importFcstSegs = buildSegments(forecast, "importRate");
  const fitFcstSegs = buildSegments(forecast, "fitRate");

  const step = Math.max(1, Math.floor(labels.length / 12));

  // Quality-based styling
  const qualityStyles = {
    Act: { color: "#3b82f6", type: "solid", width: 2 },
    Exp: { color: "#60a5fa", type: "dashed", width: 2, dash: [4, 4] },
    Fcst: { color: "#93c5fd", type: "dashed", width: 2, dash: [6, 4] },
  };

  // Build import rate series segments
  [...importHistSegs, ...importFcstSegs].forEach((seg) => {
    const style = qualityStyles[seg.quality] || qualityStyles.Fcst;
    importSeries.push({
      name: seg.quality === "Act" ? "Import — Actual" : seg.quality === "Exp" ? "Import — Expected" : "Import — Forecast",
      type: "line",
      smooth: true,
      showSymbol: false,
      data: seg.data,
      lineStyle: { color: style.color, type: style.type, width: style.width, dash: style.dash },
      emphasis: { focus: "series" },
    });
  });

  // Build FiT rate series segments
  [...fitHistSegs, ...fitFcstSegs].forEach((seg) => {
    const style = qualityStyles[seg.quality] || qualityStyles.Fcst;
    fitSeries.push({
      name: seg.quality === "Act" ? "FiT — Actual" : seg.quality === "Exp" ? "FiT — Expected" : "FiT — Forecast",
      type: "line",
      smooth: true,
      showSymbol: false,
      data: seg.data,
      lineStyle: { color: "#10b981", type: style.type, width: style.width, dash: style.dash },
      emphasis: { focus: "series" },
    });
  });

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: (params) => {
        const label = params[0]?.axisValue ?? "";
        const lines = params
          .filter((p) => p.value != null)
          .map((p) => `${p.marker} ${p.seriesName}: <b>${p.value} c/kWh</b>`);
        return `<div style="font-size:12px">${label}<br/>${lines.join("<br/>")}</div>`;
      },
    },
    legend: {
      data: ["Import — Actual", "Import — Expected", "Import — Forecast", "FiT — Actual", "FiT — Expected", "FiT — Forecast"].filter(key =>
        [...importSeries, ...fitSeries].some(s => s.name === key)
      ),
      top: 4,
      fontSize: 9,
    },
    grid: { left: 48, right: 12, top: 60, bottom: 48 },
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
    series: [...importSeries, ...fitSeries],
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
