# Energy-Mate Billing System Documentation

## Overview

Energy-Mate is a personal energy monitoring dashboard for Localvolts spot-price electricity customers in Australia. The system tracks energy import/export costs and earnings through the Localvolts API, storing half-hourly NEM interval data in DynamoDB.

---

## 1. Localvolts API Cost/Earnings Tracking

### Data Fields

The Localvolts API provides the following financial tracking fields:

| Field | Description | Unit |
|-------|-------------|------|
| `costsAll` | Total import costs | cents (c) |
| `earningsAll` | Total export earnings | cents (c) |
| `costsAllVarRate` | Variable import rate | c/kWh |
| `earningsAllVarRate` | Variable export/FiT rate | c/kWh |
| `costsAllVar` | Variable import costs | cents |
| `costsAllFixed` | Fixed import costs | cents |
| `earningsAllVar` | Variable export earnings | cents |
| `earningsAllFixed` | Fixed export earnings | cents |

### Data Flow

```
Localvolts API (v1/customer/interval)
       │
       ├── EventBridge (5 min) → fetch_intervals Lambda
       │       └── Past 24hrs + Next 24hrs → DynamoDB
       │
       └── GET /dashboard/live → get_live Lambda
               └── Real-time fetch + upsert to DynamoDB
```

### Billing Aggregation Logic

**Files:** `get_history.py:83-98`, `billing_test.py:137-138`

```python
spend_cents = sum(_to_float(i.get("costsAll")) or 0 for i in items)
earn_cents = sum(_to_float(i.get("earningsAll")) or 0 for i in items)
```

**Key Features:**
- Handles `None` and `"N/A"` values gracefully
- Aggregates at AEST day boundaries
- Returns both cent and dollar values (cents/100)

---

## 2. Time Counters

### Backend Time Handling

**File:** `billing_test.py:60-76`, `get_history.py:36-42`

```python
AEST_OFFSET = timedelta(hours=10)  # No DST in NEM

def _get_aest_day_bounds(aest_dt):
    start_aest = aest_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    end_aest = start_aest + timedelta(days=1)
    start_utc = start_aest - AEST_OFFSET
    end_utc = end_aest - AEST_OFFSET
    return start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"), end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
```

### Frontend Time Display

**File:** `Dashboard.jsx:45-58`

```javascript
function formatTimeAgo(isoStr) {
  const diffMs = Date.now() - parseISO(isoStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins === 0) return `${secs} sec ago`;
  return `${mins} min ${secs} sec ago`;
}
```

**Update Interval:** Updates every second via `useEffect` with `setInterval` (line 137 in Dashboard.jsx)

### AEST Date Formatting

**File:** `Dashboard.jsx:27-43`

```javascript
function formatAEST(isoStr) {
  const aestTime = d.getTime() + 10 * 60 * 60 * 1000;
  // Returns: "DD Mon YYYY HH:MM AEST"
}
```

---

## 3. AEST Timezone Handling

### Storage

- All timestamps stored in UTC ISO format (`YYYY-MM-DDTHH:MM:SSZ`)
- DynamoDB SK uses UTC lexicographical sorting for efficient queries

### Conversion

| Context | Offset | Notes |
|---------|--------|-------|
| Backend | `+10 hours` | Hardcoded, no DST adjustment |
| Frontend | `+10 hours` | JavaScript Date manipulation |

### Billing Periods

**File:** `get_history.py:80-98`

```python
# Today's billing
today_start, today_end = _get_aest_day_bounds(now_aest)

# Yesterday's billing
yesterday_aest = now_aest - timedelta(days=1)
yesterday_start, yesterday_end = _get_aest_day_bounds(yesterday_aest)

# Day before yesterday
day2_aest = now_aest - timedelta(days=2)
day2_start, day2_end = _get_aest_day_bounds(day2_aest)
```

---

## 4. Quality Indicators

### Quality Values

| Code | Label | Meaning | When Used |
|------|-------|---------|-----------|
| `Act` | Actual | Settled interval data | Past intervals with final rates |
| `Exp` | Expected | Mixed actual/forecast | Current/in-progress intervals |
| `Fcst` | Forecast | All forecasted | Future intervals |

### Backend Source

**File:** `localvolts.py:21-32`

Quality field comes directly from Localvolts API response.

### Frontend Display

**File:** `Dashboard.jsx:60-72`

```javascript
function qualityBadge(quality) {
  const map = {
    Act: { label: "Actual", cls: "bg-green-100 text-green-700..." },
    Exp: { label: "Expected", cls: "bg-blue-100 text-blue-700..." },
    Fcst: { label: "Forecast", cls: "bg-amber-100 text-amber-700..." },
  };
}
```

**File:** `StatCard.jsx:10-14`

```javascript
const qualityColors = {
  Act: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  Exp: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  Fcst: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};
```

### Visual Representation

- **StatCard.jsx**: Small pill badge at top-right corner (`text-[10px]`, `px-1.5 py-0.5`)
- **Dashboard.jsx**: Full-width badge below section title
- **Color scheme**: Green (Act), Blue (Exp), Amber (Fcst)

---

## 5. API Endpoints

### GET /dashboard/live

**Response:**
```json
{
  "importRate": 28.50,
  "importRateUnits": "c/kWh",
  "fitRate": 8.25,
  "fitRateUnits": "c/kWh",
  "importsWh": 3200,
  "exportsWh": 1500,
  "quality": "Exp",
  "intervalEnd": "2026-05-02T08:30:00Z",
  "lastFetched": "2026-05-02T08:34:15Z"
}
```

### GET /dashboard/history

**Response:**
```json
{
  "history": [...],
  "forecast": [...],
  "todayBilling": {
    "spendCents": 125.50,
    "earnCents": 78.25,
    "netCents": 47.25
  },
  "yesterdayBilling": {...},
  "day2Billing": {...}
}
```

---

## 6. Test Infrastructure

### billing_test.py

Standalone utility for validating billing aggregation:
- Queries DynamoDB for AEST-day intervals
- Sums `costsAll` and `earningsAll`
- Returns formatted results with dollar conversions

### test_localvolts_costs.py

Validation script with scenarios:
1. Full day with solar exports
2. Night-only (import only, no exports)
3. Daytime (import + export)
4. Zero-cost edge cases
5. DynamoDB storage format validation

---

## 7. DynamoDB Schema

| PK | SK | Fields |
|----|----|--------|
| `INTERVAL#<NMI>` | `<UTC ISO>` | All cost/earning/quality fields |

**Query pattern:** `query_pk_between(PK, SK_start, SK_end)`