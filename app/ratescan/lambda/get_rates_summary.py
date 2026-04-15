"""
get_rates_summary.py — GET /rates/summary

Returns median, P25, P75 and product count for:
  - Variable rate (all lenders)
  - Fixed rate by term: 1Y, 2Y, 3Y, 4Y, 5Y

Median is used instead of average because the rate distribution is right-skewed:
  - LVR-tiered products produce multiple rows per product (high-LVR tiers are
    priced higher and would inflate a simple average).
  - Small specialist lenders with outlier rates have equal row-weight to majors.
  Median is robust to both effects and better reflects what a typical borrower sees.
  P25/P75 replace min/max as a meaningful spread band rather than extreme outliers.

Rate normalisation:
  Most lenders store rates as decimals (0.0624 = 6.24%).
  A small number store rates as percentages (6.24 = 6.24%).
  Heuristic: if rate < 1 multiply by 100, otherwise use as-is.

Fixed term normalisation:
  additionalvalue follows ISO 8601 duration: P1Y, P2Y … or P12M, P24M …
  Both forms are resolved to an integer year (1–5).
"""

import json
import os
from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo

import boto3
from botocore.exceptions import ClientError

from athena_helper import run_query

DATABASE         = os.environ.get("ATHENA_DATABASE", "obdb")
S3_BUCKET        = os.environ.get("S3_BUCKET", "ratescan.com.au")
SUMMARIES_PREFIX = os.environ.get("SUMMARIES_PREFIX", "summaries")
CACHE_PREFIX     = os.environ.get("CACHE_PREFIX", "cache")

_TREND_CATEGORIES = (
    "variable", "variableIO", "investmentPI", "investmentIO",
    "personalLoan", "businessLoan", "creditCard",
)

_SQL = f"""
WITH normalised AS (
  SELECT
    productcategory,
    UPPER(lendingratetype) AS lendingratetype,
    additionalvalue,
    UPPER(loanpurpose)     AS loanpurpose,
    UPPER(repaymenttype)   AS repaymenttype,
    CASE
      WHEN TRY_CAST(rate AS DOUBLE) < 1
        THEN TRY_CAST(rate AS DOUBLE) * 100
      ELSE TRY_CAST(rate AS DOUBLE)
    END AS rate_pct,
    brand
  FROM {DATABASE}.daily_rates
  WHERE TRY_CAST(rate AS DOUBLE) IS NOT NULL
    AND TRY_CAST(rate AS DOUBLE) > 0
    AND TRY_CAST(rate AS DOUBLE) < 50   -- broad pre-filter; each CTE applies tighter bounds
),

variable AS (
  SELECT
    'variable'                                        AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND UPPER(loanpurpose)    = 'OWNER_OCCUPIED'
    AND UPPER(repaymenttype)  = 'PRINCIPAL_AND_INTEREST'
),

variable_io AS (
  SELECT
    'variable_io'                                     AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 10.0
    AND UPPER(loanpurpose)    = 'OWNER_OCCUPIED'
    AND UPPER(repaymenttype)  = 'INTEREST_ONLY'
),

investment_pi AS (
  SELECT
    'investment_pi'                                   AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND loanpurpose   = 'INVESTMENT'
    AND repaymenttype = 'PRINCIPAL_AND_INTEREST'
),

investment_io AS (
  SELECT
    'investment_io'                                   AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 9.0
    AND loanpurpose   = 'INVESTMENT'
    AND repaymenttype = 'INTEREST_ONLY'
),

fixed AS (
  SELECT
    'fixed' AS category,
    CAST(
      CASE
        WHEN REGEXP_LIKE(additionalvalue, '^P[1-5]Y$')
          THEN CAST(REGEXP_EXTRACT(additionalvalue, '^P([1-5])Y$', 1) AS INTEGER)
        WHEN REGEXP_LIKE(additionalvalue, '^P(12|24|36|48|60)M$')
          THEN CAST(REGEXP_EXTRACT(additionalvalue, '^P([0-9]+)M$', 1) AS INTEGER) / 12
      END AS VARCHAR
    ) AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'FIXED'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND UPPER(loanpurpose)   = 'OWNER_OCCUPIED'
    AND UPPER(repaymenttype) = 'PRINCIPAL_AND_INTEREST'
    AND (
      REGEXP_LIKE(additionalvalue, '^P[1-5]Y$')
      OR REGEXP_LIKE(additionalvalue, '^P(12|24|36|48|60)M$')
    )
  GROUP BY
    CASE
      WHEN REGEXP_LIKE(additionalvalue, '^P[1-5]Y$')
        THEN CAST(REGEXP_EXTRACT(additionalvalue, '^P([1-5])Y$', 1) AS INTEGER)
      WHEN REGEXP_LIKE(additionalvalue, '^P(12|24|36|48|60)M$')
        THEN CAST(REGEXP_EXTRACT(additionalvalue, '^P([0-9]+)M$', 1) AS INTEGER) / 12
    END
),

personal_loan AS (
  SELECT
    'personal_loan'                                   AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'PERS_LOANS'
    AND lendingratetype IN ('FIXED', 'VARIABLE')
    AND rate_pct BETWEEN 5.0 AND 20.0
),

business_loan AS (
  SELECT
    'business_loan'                                   AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'BUSINESS_LOANS'
    AND lendingratetype IN ('FIXED', 'VARIABLE')
    AND rate_pct BETWEEN 5.0 AND 15.0
),

credit_card AS (
  SELECT
    'credit_card'                                     AS category,
    NULL                                              AS term_years,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'CRED_AND_CHRG_CARDS'
    AND lendingratetype = 'PURCHASE'
    AND rate_pct BETWEEN 8.0 AND 25.0
)

SELECT * FROM variable
UNION ALL
SELECT * FROM variable_io
UNION ALL
SELECT * FROM investment_pi
UNION ALL
SELECT * FROM investment_io
UNION ALL
SELECT * FROM fixed
UNION ALL
SELECT * FROM personal_loan
UNION ALL
SELECT * FROM business_loan
UNION ALL
SELECT * FROM credit_card
ORDER BY category DESC, term_years
"""


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    s3 = boto3.client("s3")

    # Read latest.json once — used for both cache key and trend attachment.
    # Cache key is keyed by the pipeline's asOf date so it auto-invalidates
    # whenever Stage 5 writes a new latest.json (daily after the pipeline run).
    latest   = _read_latest(s3)
    today_syd = datetime.now(ZoneInfo("Australia/Sydney")).date().isoformat()
    as_of    = (latest or {}).get("asOf") or today_syd
    cache_key = f"{CACHE_PREFIX}/rates-summary-{as_of}.json"

    cached = _read_cache(s3, cache_key)
    if cached is not None:
        print(f"INFO: cache hit for {as_of}")
        return _cors(200, json.dumps(cached))

    try:
        rows    = run_query(_SQL)
        payload = _build_response(rows)
        _attach_trends(payload, latest)
        _write_cache(s3, cache_key, payload)
        return _cors(200, json.dumps(payload))
    except Exception as exc:
        print(f"ERROR: {exc}")
        return _cors(500, json.dumps({"error": str(exc)}))


def _build_response(rows: list) -> dict:
    result = {
        "asOf": datetime.now(ZoneInfo("Australia/Sydney")).date().isoformat(),
        "lenderCount": 0,
        "variable": {},
        "variableIO": {},
        "investmentPI": {},
        "investmentIO": {},
        "fixed": {},
        "personalLoan": {},
        "businessLoan": {},
        "creditCard": {},
    }

    total_lenders = set()

    for row in rows:
        category = row.get("category")
        median = _f(row.get("median_rate"))
        p25    = _f(row.get("p25_rate"))
        p75    = _f(row.get("p75_rate"))
        cnt    = _i(row.get("product_count"))
        lc     = _i(row.get("lender_count"))
        total_lenders.add(lc)   # accumulate for overall count

        entry = {"median": median, "p25": p25, "p75": p75, "count": cnt}

        if category == "variable":
            result["variable"] = entry
            result["lenderCount"] = lc
        elif category == "variable_io":
            result["variableIO"] = entry
        elif category == "investment_pi":
            result["investmentPI"] = entry
        elif category == "investment_io":
            result["investmentIO"] = entry
        elif category == "fixed":
            term = row.get("term_years")
            if term:
                result["fixed"][str(_i(term))] = entry
        elif category == "personal_loan":
            result["personalLoan"] = entry
        elif category == "business_loan":
            result["businessLoan"] = entry
        elif category == "credit_card":
            result["creditCard"] = entry

    # Use max lender count seen across categories as overall figure
    if total_lenders:
        result["lenderCount"] = max(total_lenders)

    return result


def _read_latest(s3) -> dict | None:
    """Load summaries/latest.json from S3. Returns None on any error."""
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=f"{SUMMARIES_PREFIX}/latest.json")
        return json.loads(resp["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            print("INFO: no summary file found — trends unavailable on first run")
        else:
            print(f"WARNING: could not load summary file: {e}")
        return None
    except Exception as e:
        print(f"WARNING: unexpected error loading summary: {e}")
        return None


def _read_cache(s3, key: str) -> dict | None:
    """Return parsed JSON from S3 cache key, or None on miss/error."""
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(resp["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return None
        print(f"WARNING: cache read error: {e}")
        return None
    except Exception as e:
        print(f"WARNING: cache read error: {e}")
        return None


def _write_cache(s3, key: str, payload: dict) -> None:
    """Write payload as JSON to S3 cache key. Failures are non-fatal."""
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(payload),
            ContentType="application/json",
        )
        print(f"INFO: cache written to {key}")
    except Exception as e:
        print(f"WARNING: cache write failed: {e}")


def _attach_trends(payload: dict, latest: dict | None) -> None:
    """
    Attach trend/change to each stat-card category in-place using the
    already-loaded latest.json dict.  Also corrects asOf to reflect when the
    pipeline actually ran rather than when this Lambda executed.

    Behaviour by staleness:
      latest.json.asOf == today   → trends attached, no dataStale flag
      latest.json.asOf == yesterday → trends attached, dataStale=True set
      older or missing            → no trends, dataStale=True if file exists
    """
    if latest is None:
        return   # degrade gracefully — payload already has correct Athena stats

    summary_as_of = latest.get("asOf", "")
    today         = datetime.now(ZoneInfo("Australia/Sydney")).date()
    yesterday     = (today - timedelta(days=1)).isoformat()
    today_str     = today.isoformat()

    # Fix asOf to reflect when the data was actually ingested, not Lambda run time
    payload["asOf"] = summary_as_of

    if summary_as_of == today_str:
        # Pipeline has already run today — full trend data available
        pass
    elif summary_as_of == yesterday:
        # Before today's 7am pipeline run — data is yesterday's
        payload["dataStale"] = True
    else:
        # Summary is more than 1 day old (pipeline skipped or first run with null trends)
        payload["dataStale"] = True
        return   # don't attach stale trend arrows

    # Attach trend + change per stat-card category
    for key in _TREND_CATEGORIES:
        if key in payload and key in latest:
            payload[key]["trend"]  = latest[key].get("trend")
            payload[key]["change"] = latest[key].get("change")


def _f(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _i(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def _cors(status: int, body: str) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": body,
    }
