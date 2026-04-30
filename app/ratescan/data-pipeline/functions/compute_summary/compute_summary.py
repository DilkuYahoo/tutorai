"""
compute_summary.py — Stage 5 of the RateScan pipeline.

Runs immediately after Stage 4 (Iceberg upsert) in the Step Functions state machine.
Queries Athena for today's rate stats across 7 categories, diffs them against the
previous day's summary stored in S3, and writes an updated summary JSON to:
  s3://{S3_BUCKET}/{SUMMARIES_PREFIX}/YYYY-MM-DD.json
  s3://{S3_BUCKET}/{SUMMARIES_PREFIX}/latest.json   (always the most recent)

The query Lambda (get_rates_summary.py) reads latest.json to attach trend data
to the /rates/summary API response without needing a second Athena query.

Trend threshold: 5 basis points (0.05%). Changes smaller than this are "stable".

This is a non-critical enrichment step — pipeline failure in this stage routes to
PipelineComplete (not NotifyOnFailure) so the core data ingestion is unaffected.

Note: athena_helper.py is a copy of app/ratescan/lambda/athena_helper.py.
      Keep in sync with that file if the Athena polling logic changes.
"""

import json
import logging
import os
import datetime
from zoneinfo import ZoneInfo

import boto3
from botocore.exceptions import ClientError

from athena_helper import run_query
from institution_meta import DISPLAY_NAMES, CATEGORIES

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

S3_BUCKET             = os.environ.get("S3_BUCKET", "ratescan.com.au")
SUMMARIES_PREFIX      = os.environ.get("SUMMARIES_PREFIX", "summaries")
DATABASE              = os.environ.get("ATHENA_DATABASE", "obdb")
CF_DISTRIBUTION_ID    = os.environ.get("CF_DISTRIBUTION_ID", "")
STATUS_PREFIX         = os.environ.get("STATUS_PREFIX", "pipeline-run")
INSTITUTIONS_PREFIX   = os.environ.get("INSTITUTIONS_PREFIX", "institutions")

STABLE_THRESHOLD = 0.05   # percentage points — changes smaller than this are "stable"

RATE_CATEGORIES = ("variable", "variableIO", "investmentPI", "investmentIO",
                   "personalLoan", "businessLoan", "creditCard")

# ── Athena SQL (7 stat-card categories; fixed-rate terms are excluded) ────────

_SQL = f"""
WITH normalised AS (
  SELECT
    productcategory,
    UPPER(lendingratetype) AS lendingratetype,
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
    AND TRY_CAST(rate AS DOUBLE) < 50
),

variable AS (
  SELECT
    'variable'                                        AS category,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND loanpurpose    = 'OWNER_OCCUPIED'
    AND repaymenttype  = 'PRINCIPAL_AND_INTEREST'
),

variable_io AS (
  SELECT
    'variable_io'                                     AS category,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 10.0
    AND loanpurpose    = 'OWNER_OCCUPIED'
    AND repaymenttype  = 'INTEREST_ONLY'
),

investment_pi AS (
  SELECT
    'investment_pi'                                   AS category,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND loanpurpose    = 'INVESTMENT'
    AND repaymenttype  = 'PRINCIPAL_AND_INTEREST'
),

investment_io AS (
  SELECT
    'investment_io'                                   AS category,
    ROUND(approx_percentile(rate_pct, 0.50), 2)      AS median_rate,
    ROUND(approx_percentile(rate_pct, 0.25), 2)      AS p25_rate,
    ROUND(approx_percentile(rate_pct, 0.75), 2)      AS p75_rate,
    CAST(COUNT(*) AS VARCHAR)                         AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR)            AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 9.0
    AND loanpurpose    = 'INVESTMENT'
    AND repaymenttype  = 'INTEREST_ONLY'
),

personal_loan AS (
  SELECT
    'personal_loan'                                   AS category,
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
UNION ALL SELECT * FROM variable_io
UNION ALL SELECT * FROM investment_pi
UNION ALL SELECT * FROM investment_io
UNION ALL SELECT * FROM personal_loan
UNION ALL SELECT * FROM business_loan
UNION ALL SELECT * FROM credit_card
"""

# Athena category name → summary JSON key
_CATEGORY_MAP = {
    "variable":     "variable",
    "variable_io":  "variableIO",
    "investment_pi":"investmentPI",
    "investment_io":"investmentIO",
    "personal_loan":"personalLoan",
    "business_loan":"businessLoan",
    "credit_card":  "creditCard",
}


def lambda_handler(event, context):
    s3      = boto3.client("s3")
    today   = datetime.datetime.now(ZoneInfo("Australia/Sydney")).date().isoformat()
    run_at  = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    logger.info(f"Stage 5: computing summary for {today}")

    # ── 1. Aggregate per-bank run status → institutions/latest.json ───────────
    _aggregate_institutions(s3, today, run_at)

    # ── 2. Query Athena ───────────────────────────────────────────────────────
    rows = run_query(_SQL)
    today_stats = _build_stats(rows)

    # ── 3. Load previous summary for trend comparison ─────────────────────────
    previous = _load_latest(s3)

    # ── 4. Build summary with trends ─────────────────────────────────────────
    summary = {
        "pipelineRunAt": run_at,
        "asOf":          today,
        "lenderCount":   today_stats.get("lenderCount", 0),
    }
    for key in RATE_CATEGORIES:
        entry = today_stats.get(key, {})
        if previous and key in previous:
            prev_median  = _f(previous[key].get("median"))
            today_median = _f(entry.get("median"))
            trend, change = _compute_trend(today_median, prev_median)
            entry["trend"]  = trend
            entry["change"] = change
        else:
            entry["trend"]  = None
            entry["change"] = None
        summary[key] = entry

    # ── 5. Write to S3 ────────────────────────────────────────────────────────
    body = json.dumps(summary, indent=2)
    dated_key  = f"{SUMMARIES_PREFIX}/{today}.json"
    latest_key = f"{SUMMARIES_PREFIX}/latest.json"

    for key in (dated_key, latest_key):
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
        logger.info(f"Wrote s3://{S3_BUCKET}/{key}")

    # ── 5. Invalidate CloudFront so browsers get fresh data immediately ───────
    _invalidate_cloudfront(run_at)

    return {"statusCode": 200, "summaryKey": dated_key}


# ── helpers ───────────────────────────────────────────────────────────────────

def _aggregate_institutions(s3, today: str, run_at: str) -> None:
    """
    Read all pipeline-run/{today}/*.json status files written by Stage 2,
    join with institution_meta, fill in any banks with no status file as 'down',
    and write institutions/latest.json.  Non-fatal — failure only logs a warning.
    """
    try:
        paginator = s3.get_paginator("list_objects_v2")
        keys = [
            obj["Key"]
            for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=f"{STATUS_PREFIX}/{today}/")
            for obj in page.get("Contents", [])
        ]

        institutions = []
        for key in keys:
            try:
                resp = s3.get_object(Bucket=S3_BUCKET, Key=key)
                data = json.loads(resp["Body"].read())
                bank = data["bank"]
                institutions.append({
                    "key":           bank,
                    "name":          DISPLAY_NAMES.get(bank, bank.replace("_", " ")),
                    "category":      CATEGORIES.get(bank, "Other"),
                    "totalProducts": data.get("totalProducts", 0),
                    "succeeded":     data.get("succeeded", 0),
                    "failed":        data.get("failed", 0),
                    "status":        data.get("status", "unknown"),
                    "runDate":       data.get("date", today),
                })
            except Exception as e:
                logger.warning(f"Could not read status file {key}: {e}")

        # Fill in banks that never wrote a status file (Stage 1 or Stage 2 silently skipped them)
        reported = {i["key"] for i in institutions}
        try:
            cfg_resp = s3.get_object(Bucket=S3_BUCKET, Key="config.json")
            all_banks = set(json.loads(cfg_resp["Body"].read())["banks"].keys())
            for bank in sorted(all_banks - reported):
                institutions.append({
                    "key":           bank,
                    "name":          DISPLAY_NAMES.get(bank, bank.replace("_", " ")),
                    "category":      CATEGORIES.get(bank, "Other"),
                    "totalProducts": 0,
                    "succeeded":     0,
                    "failed":        0,
                    "status":        "down",
                    "runDate":       today,
                })
        except Exception as e:
            logger.warning(f"Could not read config.json to fill missing banks: {e}")

        _STATUS_ORDER = {"healthy": 0, "partial": 1, "down": 2, "unknown": 3}
        institutions.sort(key=lambda x: (_STATUS_ORDER.get(x["status"], 3), x["name"].lower()))

        payload = {
            "runDate":      today,
            "generatedAt":  run_at,
            "count":        len(institutions),
            "institutions": institutions,
        }
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=f"{INSTITUTIONS_PREFIX}/latest.json",
            Body=json.dumps(payload, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        logger.info(f"Wrote institutions/latest.json ({len(institutions)} banks)")
    except Exception as e:
        logger.warning(f"_aggregate_institutions failed (non-critical): {e}")


def _invalidate_cloudfront(caller_ref: str) -> None:
    if not CF_DISTRIBUTION_ID:
        logger.info("CF_DISTRIBUTION_ID not set — skipping CloudFront invalidation")
        return
    try:
        cf = boto3.client("cloudfront")
        cf.create_invalidation(
            DistributionId=CF_DISTRIBUTION_ID,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": ["/*"]},
                "CallerReference": caller_ref,
            },
        )
        logger.info(f"CloudFront invalidation created for distribution {CF_DISTRIBUTION_ID}")
    except Exception as e:
        logger.warning(f"CloudFront invalidation failed (non-critical): {e}")

def _build_stats(rows: list) -> dict:
    result      = {"lenderCount": 0}
    lender_counts = set()

    for row in rows:
        athena_cat = row.get("category")
        key        = _CATEGORY_MAP.get(athena_cat)
        if not key:
            continue

        median = _f(row.get("median_rate"))
        p25    = _f(row.get("p25_rate"))
        p75    = _f(row.get("p75_rate"))
        count  = _i(row.get("product_count"))
        lc     = _i(row.get("lender_count"))
        lender_counts.add(lc)

        result[key] = {"median": median, "p25": p25, "p75": p75, "count": count}

    if lender_counts:
        result["lenderCount"] = max(lender_counts)

    return result


def _load_latest(s3) -> dict | None:
    key = f"{SUMMARIES_PREFIX}/latest.json"
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(resp["Body"].read())
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            logger.info("No previous summary found — trends will be null on first run")
            return None
        logger.warning(f"Could not load previous summary: {e}")
        return None


def _compute_trend(today_median: float, prev_median: float) -> tuple:
    change = round(today_median - prev_median, 2)
    if abs(change) < STABLE_THRESHOLD:
        return "stable", change
    return ("down" if change < 0 else "up"), change


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
