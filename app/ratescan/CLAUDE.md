# RateScan — Claude Context

## What this project is
Australian mortgage/loan rate comparison platform. Ingests live rate data from 124 banks via the CDR Open Banking API v5, stores it in an Iceberg table on S3/Glue, and serves it via Lambda + API Gateway to a React frontend.

## Repo structure
```
app/ratescan/
├── lambda/               # Lambda function source (Python)
│   ├── get_rates_summary.py      # GET /rates/summary (loads summaries/latest.json for trends)
│   ├── get_recent_changes.py     # GET /rates/recent-changes
│   ├── submit_application.py     # POST /application
│   └── athena_helper.py          # Shared Athena query utility
├── data-pipeline/        # 5-stage ingestion pipeline
│   ├── main.py                   # Stage 1: fetch product lists
│   ├── main_prod_details.py      # Stage 2: fetch product details
│   ├── flatten_json_to_csv.py    # Stage 3: flatten nested JSON → CSV
│   ├── upsert_dataset.py         # Stage 4: load CSV → Iceberg table
│   ├── functions/
│   │   └── compute_summary/      # Stage 5: compute daily summary + trends
│   │       ├── compute_summary.py
│   │       └── athena_helper.py  # Keep in sync with lambda/athena_helper.py
│   └── statemachine/             # Step Functions ASL definition
├── iac/                  # SAM template + samconfig for API stack
│   ├── template.yaml
│   └── samconfig.toml
└── frontend/             # React + Vite frontend
    └── src/
        ├── pages/Dashboard.jsx
        ├── components/StatCard.jsx   # TrendIndicator: ↑↓→, dataStale amber hint
        ├── components/RateChart.jsx
        └── data/mockRates.js         # Fallback data when API is unreachable
```

## AWS infrastructure
- Region: ap-southeast-2
- S3 bucket: ratescan.com.au
- Iceberg warehouse: s3://ratescan.com.au/iceberg/
- Glue catalog: OpenBanking / database: obdb / table: daily_rates
- Athena workgroup: primary
- SAM stack name: `ratescan-frontend`

## Deploy commands
```bash
# API Lambdas
cd app/ratescan/iac && sam build && sam deploy

# Data pipeline (Stages 1–4 are container images; use --skip-pull-image to avoid re-pulling)
cd app/ratescan/data-pipeline && sam build --skip-pull-image && sam deploy

# Manually trigger pipeline (e.g. to test Stage 5 or force a same-day run)
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:ap-southeast-2:724772096157:stateMachine:RatescanPipeline \
  --input '{}'

# Smoke-test Stage 5 in isolation
aws lambda invoke \
  --function-name ratescan-stage5-compute-summary \
  --payload '{}' --cli-binary-format raw-in-base64-out /tmp/stage5-out.json \
  && cat /tmp/stage5-out.json
```

## Live API base URL
https://eqwjfw8zzh.execute-api.ap-southeast-2.amazonaws.com/prod

## Key decisions — do not reverse without discussion

### Median + P25/P75 (not avg/min/max)
All rate statistics use `approx_percentile(rate_pct, 0.5/0.25/0.75)` in Athena.
API response fields are `median`, `p25`, `p75` — not `avg`, `min`, `max`.
**Reason:** LVR-tiered products create multiple rows per product; high-LVR rows inflate the mean.
Median is robust to this and better represents what a typical borrower is quoted.

### Rate normalization
CDR API stores rates as decimals (0.0624 = 6.24%). Normalization: `if rate < 1 then rate * 100`.
Applied in the `normalised` CTE in every Athena query. Pre-filter `rate < 50` catches outliers.

### OO Variable IO > Investment Variable P&I is expected
IO loans carry an ~81bp premium over P&I (APRA capital requirements + IO lending caps).
The IO premium exceeds the investment surcharge (~30bp). This is correct market behaviour.

### Iceberg full overwrite
`upsert_dataset.py` does a full `table.overwrite()` each pipeline run — not incremental.
daily_rates is a point-in-time snapshot, not a history table.

### Stage 5 daily summary + trend indicators
After each Iceberg upsert, Stage 5 (`compute_summary.py`) runs an Athena query across the 7
stat-card categories, diffs median rates against the previous `summaries/latest.json`, and writes:
- `s3://ratescan.com.au/summaries/YYYY-MM-DD.json` — dated archive
- `s3://ratescan.com.au/summaries/latest.json` — always the most recent

`get_rates_summary.py` reads `latest.json` to attach `trend` ("up"/"down"/"stable") and `change`
(basis-point delta) to each category, and to fix `asOf` to Sydney time.

Staleness logic:
- `latest.json.asOf == today` → trends shown, no warning
- `latest.json.asOf == yesterday` → `dataStale: true`, `asOf` shows yesterday, trend arrows suppressed
- Stage 5 failure → catch-continue to PipelineComplete (non-critical; no SNS alert)

Trend threshold: 5bp (0.05%) to absorb `approx_percentile` approximation noise.
First run writes `trend: null` (no previous to diff against) — cards show no arrow.

## Rate category SQL filters (Athena)
| Category | productCategory | lendingRateType | loanPurpose | repaymentType | rate_pct range |
|---|---|---|---|---|---|
| variable | RESIDENTIAL_MORTGAGES | VARIABLE | OWNER_OCCUPIED | PRINCIPAL_AND_INTEREST | 5–8% |
| variable_io | RESIDENTIAL_MORTGAGES | VARIABLE | OWNER_OCCUPIED | INTEREST_ONLY | 5–10% |
| investment_pi | RESIDENTIAL_MORTGAGES | VARIABLE | INVESTMENT | PRINCIPAL_AND_INTEREST | 5–8% |
| investment_io | RESIDENTIAL_MORTGAGES | VARIABLE | INVESTMENT | INTEREST_ONLY | 5–9% |
| fixed | RESIDENTIAL_MORTGAGES | FIXED | OWNER_OCCUPIED | PRINCIPAL_AND_INTEREST | 5–8%, terms P1Y–P5Y |
| personal_loan | PERS_LOANS | FIXED or VARIABLE | — | — | 5–20% |
| business_loan | BUSINESS_LOANS | FIXED or VARIABLE | — | — | 5–15% |
| credit_card | CRED_AND_CHRG_CARDS | PURCHASE | — | — | 8–25% |
