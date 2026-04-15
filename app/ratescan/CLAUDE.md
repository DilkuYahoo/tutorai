# RateScan — Claude Context

## What this project is
Australian mortgage/loan rate comparison platform. Ingests live rate data from 124 banks via the CDR Open Banking API v5, stores it in an Iceberg table on S3/Glue, and serves it via Lambda + API Gateway to a React frontend. Built and maintained by CognifyLabs.ai.

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
    ├── public/
    │   ├── robots.txt                # Crawl rules + sitemap reference
    │   ├── sitemap.xml               # Single URL entry, changefreq: daily
    │   └── og-image.svg             # 1200×630 branded Open Graph image
    └── src/
        ├── pages/Dashboard.jsx       # Full dashboard — gradient hero, rate cards, chart, table
        ├── components/
        │   ├── DashboardHeader.jsx   # Diamond logo mark, two-tone wordmark
        │   ├── StatCard.jsx          # TrendIndicator ↑↓→, RangeBar, tipSide prop (mobile tooltip)
        │   ├── RateChart.jsx         # ECharts wrapper; buildTermTrendOption for Market Rate Outlook
        │   ├── RecentChangesTable.jsx
        │   └── SiteFooter.jsx        # 3-column footer: brand, rate links, legal; CognifyLabs.ai credit
        └── data/mockRates.js         # Fallback data when API is unreachable
```

## AWS infrastructure
- Region: ap-southeast-2
- S3 bucket: ratescan.com.au
- Iceberg warehouse: s3://ratescan.com.au/iceberg/
- Glue catalog: OpenBanking / database: obdb / table: daily_rates
- Athena workgroup: primary
- SAM stack name: `ratescan-frontend`
- Route 53 hosted zone: Z068691937SVYUSPTFYV (ratescan.com.au)

## DNS records (Route 53)
| Type  | Name                                          | Value                                                     | Purpose                        |
|-------|-----------------------------------------------|-----------------------------------------------------------|--------------------------------|
| TXT   | ratescan.com.au                               | `v=spf1 include:amazonses.com -all`                       | SES email sending              |
| TXT   | ratescan.com.au                               | `google-site-verification=CZarWT6U9rrMlG...`              | Google Search Console          |
| CNAME | a21d649a94f3445988e827b1e8624f41.ratescan.com.au | verify.bing.com                                        | Bing Webmaster Tools           |

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

## Frontend build & deploy
```bash
cd app/ratescan/frontend
npm run build        # outputs to dist/
# deploy to S3 + invalidate CloudFront
aws s3 sync dist/ s3://ratescan.com.au/ --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

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

### Frontend design system
- Tailwind CSS v3, dark mode via `class` strategy (default: dark)
- Font: Inter 300–700 via Google Fonts CDN
- Palette: indigo-500 primary, slate neutrals, emerald (rate down), red (rate up), amber (stale data)
- Hero: `bg-hero-gradient` (tailwind custom: indigo-950 → slate-950 → indigo-950)
- StatCard tooltip: `tipSide` prop — pass `'left'` to left-column cards in 2-col mobile grid to prevent overflow
- P25/P75 row: `grid grid-cols-2` (not flex) to prevent overflow on narrow mobile cards
- "Market Rate Outlook" chart uses real API data (`summary.fixed` term structure) — do NOT replace with mock historical data
- 12-month trend chart was intentionally removed — no real historical data source exists yet

### SEO implementation
- `index.html`: meta description, keywords, canonical, OG tags, Twitter Card, JSON-LD (WebSite + FinancialService)
- `public/robots.txt` + `public/sitemap.xml` (changefreq: daily)
- `public/og-image.svg`: 1200×630 branded dark-theme social preview image
- Google Search Console verified via DNS TXT record (Route 53)
- Bing Webmaster Tools verified via CNAME record (Route 53)
- Prerendering (vite-plugin-prerender) was evaluated but dropped — incompatible with Vite 5 ESM; Google's JS crawler handles the SPA correctly

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
