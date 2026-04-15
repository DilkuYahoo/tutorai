/**
 * Mock rate data mirroring the shape returned by obdb.daily_rates_clean.
 * Swap the exports for a fetch() call when the /api/rates endpoint is live.
 *
 * Rates are expressed as percentages (e.g. 6.24 = 6.24% p.a.)
 */

export const RATE_SUMMARY = {
  asOf: '2026-04-15',
  lenderCount: 91,
  dataStale: false,
  variable:     { median: 6.19, p25: 5.89, p75: 6.54, count: 312, trend: 'down',   change: -0.05 },
  variableIO:   { median: 6.99, p25: 6.54, p75: 7.45, count: 198, trend: 'stable', change:  0.00 },
  investmentPI: { median: 6.49, p25: 5.99, p75: 6.89, count: 210, trend: 'stable', change:  0.01 },
  investmentIO: { median: 7.04, p25: 6.29, p75: 7.49, count: 185, trend: 'down',   change: -0.05 },
  fixed: {
    1: { median: 5.84, p25: 5.45, p75: 6.25, count: 187 },
    2: { median: 5.69, p25: 5.30, p75: 6.10, count: 165 },
    3: { median: 5.63, p25: 5.25, p75: 6.00, count: 142 },
    4: { median: 5.67, p25: 5.30, p75: 6.05, count: 98  },
    5: { median: 5.76, p25: 5.40, p75: 6.15, count: 87  },
  },
  personalLoan: { median: 11.50, p25: 9.00,  p75: 14.00, count: 89, trend: 'up',     change:  0.15 },
  businessLoan: { median: 8.75,  p25: 7.00,  p75: 10.50, count: 62, trend: 'stable', change: -0.02 },
  creditCard:   { median: 19.99, p25: 17.99, p75: 21.99, count: 45, trend: 'stable', change:  0.00 },
}

/**
 * 5-year forward projection — quarterly intervals, Apr 2026 → Apr 2031.
 *
 * Variable rate: market-consensus forecast (RBA easing cycle then stabilisation).
 * Fixed rates:   flat at today's avg for their locked term, null after expiry.
 *
 * Indices 0–20 correspond to:
 *   0=Apr 26, 4=Apr 27(1Y), 8=Apr 28(2Y), 12=Apr 29(3Y), 16=Apr 30(4Y), 20=Apr 31(5Y)
 */
export const RATE_PROJECTION = {
  quarters: [
    'Apr 26', 'Jul 26', 'Oct 26', 'Jan 27', 'Apr 27',
    'Jul 27', 'Oct 27', 'Jan 28', 'Apr 28', 'Jul 28',
    'Oct 28', 'Jan 29', 'Apr 29', 'Jul 29', 'Oct 29',
    'Jan 30', 'Apr 30', 'Jul 30', 'Oct 30', 'Jan 31', 'Apr 31',
  ],
  // Projected variable rate — eases from 6.24 → ~5.55 then gently lifts
  variable: [
    6.24, 6.05, 5.88, 5.77, 5.70,
    5.65, 5.62, 5.60, 5.58, 5.56,
    5.55, 5.55, 5.55, 5.56, 5.58,
    5.60, 5.62, 5.63, 5.65, 5.67, 5.68,
  ],
  // Fixed — flat for term, null after expiry
  fixed1: [5.89, 5.89, 5.89, 5.89, 5.89, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  fixed2: [5.74, 5.74, 5.74, 5.74, 5.74, 5.74, 5.74, 5.74, 5.74, null, null, null, null, null, null, null, null, null, null, null, null],
  fixed3: [5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, 5.68, null, null, null, null, null, null, null, null],
  fixed4: [5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, 5.72, null, null, null, null],
  fixed5: [5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81, 5.81],
}

/**
 * Top 10 lenders by most recent rate change.
 * Each lender may have 1–N products updated in the same batch.
 * prevRate / rate expressed as percentages.
 */
export const RECENT_CHANGES = [
  {
    id: 1,
    lender: 'Commonwealth Bank',
    initials: 'CBA',
    changedAt: '2026-04-13',
    products: [
      { name: 'Extra Home Loan',        type: 'Variable',  prevRate: 6.34, rate: 6.24 },
      { name: 'Standard Variable Rate', type: 'Variable',  prevRate: 6.59, rate: 6.49 },
      { name: 'Fixed Rate Home Loan',   type: 'Fixed 1Y',  prevRate: 5.99, rate: 5.89 },
    ],
  },
  {
    id: 2,
    lender: 'ANZ',
    initials: 'ANZ',
    changedAt: '2026-04-13',
    products: [
      { name: 'Simplicity PLUS',        type: 'Variable',  prevRate: 6.29, rate: 6.19 },
      { name: 'Fixed 2 Year',           type: 'Fixed 2Y',  prevRate: 5.84, rate: 5.74 },
    ],
  },
  {
    id: 3,
    lender: 'Westpac',
    initials: 'WBC',
    changedAt: '2026-04-12',
    products: [
      { name: 'Flexi First Option',     type: 'Variable',  prevRate: 6.44, rate: 6.34 },
      { name: 'Fixed Options 3 Year',   type: 'Fixed 3Y',  prevRate: 5.78, rate: 5.68 },
      { name: 'Fixed Options 5 Year',   type: 'Fixed 5Y',  prevRate: 5.91, rate: 5.81 },
    ],
  },
  {
    id: 4,
    lender: 'NAB',
    initials: 'NAB',
    changedAt: '2026-04-12',
    products: [
      { name: 'Base Variable Rate',     type: 'Variable',  prevRate: 6.49, rate: 6.39 },
    ],
  },
  {
    id: 5,
    lender: 'ING',
    initials: 'ING',
    changedAt: '2026-04-11',
    products: [
      { name: 'Orange Advantage',       type: 'Variable',  prevRate: 6.19, rate: 6.09 },
      { name: 'Fixed 1 Year',           type: 'Fixed 1Y',  prevRate: 5.94, rate: 5.84 },
    ],
  },
  {
    id: 6,
    lender: 'Macquarie Bank',
    initials: 'MQB',
    changedAt: '2026-04-11',
    products: [
      { name: 'Basic Home Loan',        type: 'Variable',  prevRate: 6.09, rate: 5.99 },
    ],
  },
  {
    id: 7,
    lender: 'Suncorp Bank',
    initials: 'SUN',
    changedAt: '2026-04-10',
    products: [
      { name: 'Back to Basics',         type: 'Variable',  prevRate: 6.24, rate: 6.14 },
      { name: 'Fixed Home Loan 2Y',     type: 'Fixed 2Y',  prevRate: 5.84, rate: 5.79 },
    ],
  },
  {
    id: 8,
    lender: 'Bank of Queensland',
    initials: 'BOQ',
    changedAt: '2026-04-10',
    products: [
      { name: 'Economy Variable',       type: 'Variable',  prevRate: 6.39, rate: 6.29 },
    ],
  },
  {
    id: 9,
    lender: 'Bendigo Bank',
    initials: 'BEN',
    changedAt: '2026-04-09',
    products: [
      { name: 'Express Home Loan',      type: 'Variable',  prevRate: 6.29, rate: 6.19 },
      { name: 'Complete Home Loan',     type: 'Variable',  prevRate: 6.54, rate: 6.44 },
      { name: 'Fixed Rate 3 Year',      type: 'Fixed 3Y',  prevRate: 5.73, rate: 5.68 },
    ],
  },
  {
    id: 10,
    lender: 'AMP Bank',
    initials: 'AMP',
    changedAt: '2026-04-09',
    products: [
      { name: 'Professional Package',   type: 'Variable',  prevRate: 6.34, rate: 6.24 },
    ],
  },
]

/** 12-month monthly average trend — variable, fixed 1Y, fixed 3Y */
export const RATE_TREND = [
  { month: 'May 25',  variable: 6.51, fixed1: 6.12, fixed3: 5.92 },
  { month: 'Jun 25',  variable: 6.48, fixed1: 6.08, fixed3: 5.88 },
  { month: 'Jul 25',  variable: 6.45, fixed1: 6.02, fixed3: 5.84 },
  { month: 'Aug 25',  variable: 6.42, fixed1: 5.98, fixed3: 5.80 },
  { month: 'Sep 25',  variable: 6.38, fixed1: 5.94, fixed3: 5.77 },
  { month: 'Oct 25',  variable: 6.35, fixed1: 5.91, fixed3: 5.74 },
  { month: 'Nov 25',  variable: 6.31, fixed1: 5.88, fixed3: 5.72 },
  { month: 'Dec 25',  variable: 6.29, fixed1: 5.86, fixed3: 5.70 },
  { month: 'Jan 26',  variable: 6.28, fixed1: 5.93, fixed3: 5.71 },
  { month: 'Feb 26',  variable: 6.26, fixed1: 5.91, fixed3: 5.69 },
  { month: 'Mar 26',  variable: 6.25, fixed1: 5.90, fixed3: 5.68 },
  { month: 'Apr 26',  variable: 6.24, fixed1: 5.89, fixed3: 5.68 },
]
