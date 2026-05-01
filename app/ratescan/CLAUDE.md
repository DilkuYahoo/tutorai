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
        ├── App.jsx                   # Root; useReducer state machine; page routing via `page` state ('dashboard'|'apply'|'terms'|'privacy'|'contact')
        ├── pages/
        │   ├── Dashboard.jsx         # Full dashboard — gradient hero, rate cards, chart, table
        │   ├── TermsPage.jsx         # Terms & Conditions (10 sections, AU law)
        │   ├── PrivacyPage.jsx       # Privacy Policy (12 sections, Privacy Act 1988 / APPs compliant)
        │   └── ContactPage.jsx       # Contact Us — info panel + enquiry form with submitted confirmation state
        ├── components/
        │   ├── Layout.jsx            # Global wrapper: DashboardHeader + children + SiteFooter; accepts isDark, onToggleTheme, onApply, onTerms, onPrivacy, onContact, buttonText
        │   ├── DashboardHeader.jsx   # Fixed h-14 navbar; logo, nav (Home, Rates dropdown, Contact, Privacy), theme toggle, CTA button
        │   ├── StatCard.jsx          # TrendIndicator ↑↓→, RangeBar, tipSide prop (mobile tooltip)
        │   ├── RateChart.jsx         # ECharts wrapper; buildTermTrendOption for Market Rate Outlook
        │   ├── RecentChangesTable.jsx
        │   └── SiteFooter.jsx        # 3-column footer: brand, rate links, legal (Terms/Privacy/Contact); CognifyLabs.ai credit
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

## Python environment
Always activate before running any Python or SAM commands:
```bash
source /Users/Dilku/app/source-code/tutorai/env/bin/activate
```

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

Always use the publish script — never run `aws s3 sync` manually against this bucket.

```bash
cd www/ratescan && ./publish.sh
```

The script (`www/ratescan/publish.sh`) handles:
- `npm run build` inside `app/ratescan/frontend/`
- Hashed JS/CSS assets → `www/assets/` with `max-age=31536000, immutable`
- Root files (index.html etc.) → `www/` with `no-cache`
- CloudFront invalidation for root files only (assets are versioned)

CloudFront distribution ID: `E1J06U2P33MLHN`

⚠️ The S3 bucket `ratescan.com.au` is shared with the data pipeline. Website files
live under the `www/` prefix. The pipeline data (`iceberg/`, `summaries/`, `cache/`,
`config.json`) lives at the bucket root. Never sync to the bucket root with `--delete`.

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

### Global Layout & page routing
- All pages (dashboard, apply, terms, privacy, contact, submitted) render inside `<Layout>` which provides the fixed header and footer.
- `App.jsx` drives routing via `page` state string — there is no React Router; use `setPage('...')` to navigate.
- Fixed header is `h-14` (56px). All full-page content wrappers must use `pt-20` (80px) as top padding to clear the navbar with breathing room. Never use `py-8` or `py-14` alone on page root elements.
- Legal pages (TermsPage, PrivacyPage, ContactPage) share the same layout pattern: `pt-20 pb-14`, back-nav button at top and bottom, section headings in `uppercase tracking-wide text-base font-semibold`.

### Privacy Policy
- 12-section policy compliant with Privacy Act 1988 (Cth) and Australian Privacy Principles (APPs).
- Covers: identity/contact/financial/usage data collected; CDR clarification (not an Accredited Data Recipient); AWS ap-southeast-2 data residency; access/correction rights (APPs 12–13); OAIC complaints pathway.
- Privacy Officer contact: privacy@ratescan.com.au

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

## Known Endpoint Issues & Fixes

### Failing Banks (Stage 1 - Fixed)
The following banks were failing with 403/404 errors due to missing User-Agent header or incorrect API version:

| Bank | URL | Original Issue | Fix Applied |
|------|-----|---------------|-------------|
| AFG_Home_Loans_Alpha | api.afg.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| Aussie_Elevate | api.aussie.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| Aussie_Home_Loans | aussie.openportal.com.au | 404 Not Found | Added User-Agent (unrecoverable - endpoint migrated) |
| Connective_Select | api.connective.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| NRMA_Home_Loans | api.nrma.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| Qantas_Money_Home_Loans | api.qantas.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| Rabobank | openbanking.api.rabobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 (x-v:5 not supported) |
| Tiimely_Home | api.tiimely.app.bendigobank.com.au | 403 Forbidden | Added User-Agent + x-v:4 |
| People's_Choice_and_Heritage | ob-public.peopleschoice.com.au | 403 Forbidden | Fixed — Added User-Agent header |
| AMP_-_My_AMP | api.cdr-api.amp.com.au | Works ✅ | No change needed |
| in1bank_ltd. | cdr.in1bank.com.au | Works ✅ | No change needed |
| St.George_Bank | digital-api.stgeorge.com.au | Works ✅ | No change needed |

### Root Cause
- **Bendigo Bank family APIs**: Block requests without `User-Agent` header (security/WAF rule). Also require `x-v: 4` not `x-v: 5`.
- **Rabobank**: Does not support CDR v5 (`x-v: 5`), returns 406. Requires `x-v: 4`.
- **Aussie Home Loans**: Endpoint deprecated (404), likely migrated to new domain/version.
- **People's Choice & Heritage**: Cloudflare WAF — fixed by adding User-Agent header (previously thought unrecoverable, confirmed working 2026-05-01).

### Config Changes (data-pipeline/config.json)
- Added `User-Agent: Mozilla/5.0 (compatible; RateScan/1.0)` to affected banks
- Changed `x-v: 5` → `x-v: 4` for Bendigo family banks and Rabobank
- Also updated `headers_prd_details` for product detail fetches consistency

## Monitoring & Troubleshooting

### CloudWatch Log Groups
| Log Group | Purpose |
|---|---|
| `/aws/lambda/ratescan-stage1-fetch-products` | Stage 1: Fetch product lists (per bank) |
| `/aws/lambda/ratescan-stage2-fetch-details` | Stage 2: Fetch product details (per product) |
| `/aws/lambda/ratescan-stage3-flatten-csv` | Stage 3: Flatten JSON → CSV |
| `/aws/lambda/ratescan-stage4-upsert` | Stage 4: CSV → Iceberg |
| `/aws/lambda/ratescan-stage5-compute-summary` | Stage 5: Daily summary + trends |
| `/aws/states/RatescanPipeline` | Step Functions execution history |

### Quick Diagnostics Commands

#### Check recent pipeline executions
```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:ap-southeast-2:724772096157:stateMachine:RatescanPipeline \
  --max-results 5 \
  --region ap-southeast-2 \
  --query 'executions[].{status:status, start:startDate, name:name}' \
  --output table
```

#### Find banks that failed URL access (last 30 days)
```bash
# Stage 1 failures (product list fetch)
aws logs filter-log-events \
  --log-group-name '/aws/lambda/ratescan-stage1-fetch-products' \
  --start-time $(date -v-30d +%s)000 \
  --filter-pattern 'Error for bank' \
  --region ap-southeast-2 \
  --max-items 1000 \
  --output json | jq -r '.events[].message' | \
  grep -oE 'Error for bank [^:]+' | sed 's/Error for bank //' | sort | uniq -c | sort -rn
```

#### Get Stage 2 completely skipped banks (exhausted retries)
```bash
aws logs filter-log-events \
  --log-group-name '/aws/lambda/ratescan-stage2-fetch-details' \
  --start-time $(date -v-30d +%s)000 \
  --filter-pattern 'Skipping' \
  --region ap-southeast-2 \
  --max-items 1000 \
  --output json | jq -r '.events[].message' | \
  grep -oE 'Skipping [^ ]* after' | sed 's/Skipping //' | sed 's/ after//' | sort | uniq
```

#### Check a specific bank's errors across both stages
```bash
BANK="Central_Murray_Bank"
aws logs filter-log-events \
  --log-group-name '/aws/lambda/ratescan-stage1-fetch-products' \
  --start-time $(date -v-30d +%s)000 \
  --filter-pattern "$BANK" \
  --region ap-southeast-2 \
  --max-items 20 \
  --output json | jq -r '.events[].message' | head -20
```

#### List all bank codes from config
```bash
cat data-pipeline/config.json | jq -r '.banks | keys[]'
```

### Common Error Patterns

| Error Type | Typical Cause | Fix Priority |
|---|---|---|
| `403 Forbidden` (Stage 1) | Missing User-Agent header or bank revoked API credentials; invalid headers; IP restrictions | HIGH — update headers or contact bank |
| `404 Not Found` (Stage 1) | Endpoint URL deprecated; bank migrated to new CDR API version | HIGH — update `config.json` base_url |
| `406 Unsupported Version` | CDR v5 (`x-v: 5`) not supported by bank | HIGH — downgrade to `x-v: 4` |
| `500 Internal Server Error` (Stage 2) | Bank's product detail API is down or misbehaving | MEDIUM — monitor; auto-retry helps |
| `timeout` | Network latency; bank API too slow | LOW — consider increasing `REQUEST_TIMEOUT` env var |
| `States.Timeout` (Step Functions) | Too many bank failures cascading; pipeline exceeds 30min timeout | CRITICAL — fix underlying bank failures |

### Pipeline Health Dashboard

**Running**: `States.Timeout` in last 3 daily runs → Stage 1/2 failures exceed 20% tolerance threshold. Manual test runs succeed because they process fewer banks or use different concurrency settings.

**Alert destination**: `ratescan-pipeline-alerts` SNS topic → `info@ratescan.com.au`

### Key Lambda Environment Variables
- `S3_BUCKET` = `ratescan.com.au`
- `S3_PREFIX` = `products`
- `CONFIG_S3_KEY` = `config.json` (S3 path)
- `REQUEST_TIMEOUT` = `30` (seconds)
- `MAX_CONSECUTIVE_FAILURES` = `5` (Stage 2 only)

### Log Query Reference Dates
- Logs stored: **indefinitely** (no retention set; default infinite)
- Timezone: All timestamps in **UTC** (`2026-04-12T03:56:37.582Z`)
- Pipeline runs daily at **07:00 Sydney time** (EventBridge cron: `0 7 * * ? *`)
- Lambda timeout: **300 seconds** (5 min) per bank in Stage 1 Map state
