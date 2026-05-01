// Used when VITE_API_URL is not set (local dev without backend)
import { subHours, addHours, format } from "date-fns";

function makeInterval(date, isForecast) {
  const importRate = 15 + Math.random() * 30;
  const fitRate = 5 + Math.random() * 15;
  // importsWh and exportsWh are in Wh (not kWh) - realistic 5-min interval values
  const importsWh = isForecast ? 300 + Math.random() * 400 : 200 + Math.random() * 600;
  const exportsWh = isForecast ? 100 + Math.random() * 300 : 50 + Math.random() * 400;
  return {
    intervalEnd: date.toISOString(),
    importRate: parseFloat(importRate.toFixed(2)),
    fitRate: parseFloat(fitRate.toFixed(2)),
    importsWh: parseFloat(importsWh.toFixed(0)),
    exportsWh: parseFloat(exportsWh.toFixed(0)),
    costCents: parseFloat(((importsWh / 1000) * importRate).toFixed(2)),
    earnCents: parseFloat(((exportsWh / 1000) * fitRate).toFixed(2)),
    quality: isForecast ? "Fcst" : "Act",
  };
}

function generateMockHistory() {
  const now = new Date();
  const history = [];
  const forecast = [];
  for (let i = 288; i >= 1; i--) {
    history.push(makeInterval(subHours(now, i * (5 / 60)), false));
  }
  for (let i = 1; i <= 288; i++) {
    forecast.push(makeInterval(addHours(now, i * (5 / 60)), true));
  }
  const todaySpend = history.slice(-288).reduce((s, r) => s + r.costCents, 0);
  const todayEarn = history.slice(-288).reduce((s, r) => s + r.earnCents, 0);
  const yesterdaySpend = history.slice(-576, -288).reduce((s, r) => s + r.costCents, 0);
  const yesterdayEarn = history.slice(-576, -288).reduce((s, r) => s + r.earnCents, 0);
  const day2Spend = history.slice(-864, -576).reduce((s, r) => s + r.costCents, 0);
  const day2Earn = history.slice(-864, -576).reduce((s, r) => s + r.earnCents, 0);
  return {
    history,
    forecast,
    todayBilling: {
      spendCents: parseFloat(todaySpend.toFixed(2)),
      earnCents: parseFloat(todayEarn.toFixed(2)),
      netCents: parseFloat((todaySpend - todayEarn).toFixed(2)),
    },
    yesterdayBilling: {
      spendCents: parseFloat(yesterdaySpend.toFixed(2)),
      earnCents: parseFloat(yesterdayEarn.toFixed(2)),
      netCents: parseFloat((yesterdaySpend - yesterdayEarn).toFixed(2)),
    },
    day2Billing: {
      spendCents: parseFloat(day2Spend.toFixed(2)),
      earnCents: parseFloat(day2Earn.toFixed(2)),
      netCents: parseFloat((day2Spend - day2Earn).toFixed(2)),
    },
  };
}

function generateMockLive() {
  const importRate = parseFloat((15 + Math.random() * 30).toFixed(2));
  const fitRate = parseFloat((5 + Math.random() * 15).toFixed(2));
  return {
    importRate,
    importRateUnits: "c/kWh",
    fitRate,
    fitRateUnits: "c/kWh",
    importsWh: parseFloat((200 + Math.random() * 600).toFixed(0)),
    exportsWh: parseFloat((50 + Math.random() * 400).toFixed(0)),
    quality: "Exp",
    intervalEnd: new Date().toISOString(),
    lastFetched: new Date().toISOString(),
  };
}

export function getMockLive() {
  return generateMockLive();
}

export function getMockHistory() {
  return generateMockHistory();
}

export const MOCK_LIVE = generateMockLive();
export const MOCK_HISTORY = generateMockHistory();
