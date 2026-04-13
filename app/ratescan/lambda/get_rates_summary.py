"""
get_rates_summary.py — GET /rates/summary

Returns average, min, max and product count for:
  - Variable rate (all lenders)
  - Fixed rate by term: 1Y, 2Y, 3Y, 4Y, 5Y

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
from datetime import date, timezone, datetime

from athena_helper import run_query

DATABASE = os.environ.get("ATHENA_DATABASE", "obdb")

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
    'variable'                    AS category,
    NULL                          AS term_years,
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 8.0
    AND UPPER(loanpurpose)    = 'OWNER_OCCUPIED'
    AND UPPER(repaymenttype)  = 'PRINCIPAL_AND_INTEREST'
),

variable_io AS (
  SELECT
    'variable_io'                 AS category,
    NULL                          AS term_years,
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
  FROM normalised
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND lendingratetype = 'VARIABLE'
    AND rate_pct BETWEEN 5.0 AND 10.0
    AND UPPER(loanpurpose)    = 'OWNER_OCCUPIED'
    AND UPPER(repaymenttype)  = 'INTEREST_ONLY'
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
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
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
    'personal_loan'               AS category,
    NULL                          AS term_years,
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
  FROM normalised
  WHERE productcategory = 'PERS_LOANS'
    AND lendingratetype IN ('FIXED', 'VARIABLE')
    AND rate_pct BETWEEN 5.0 AND 20.0
),

business_loan AS (
  SELECT
    'business_loan'               AS category,
    NULL                          AS term_years,
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
  FROM normalised
  WHERE productcategory = 'BUSINESS_LOANS'
    AND lendingratetype IN ('FIXED', 'VARIABLE')
    AND rate_pct BETWEEN 5.0 AND 15.0
),

credit_card AS (
  SELECT
    'credit_card'                 AS category,
    NULL                          AS term_years,
    ROUND(AVG(rate_pct), 2)       AS avg_rate,
    ROUND(MIN(rate_pct), 2)       AS min_rate,
    ROUND(MAX(rate_pct), 2)       AS max_rate,
    CAST(COUNT(*) AS VARCHAR)     AS product_count,
    CAST(COUNT(DISTINCT brand) AS VARCHAR) AS lender_count
  FROM normalised
  WHERE productcategory = 'CRED_AND_CHRG_CARDS'
    AND lendingratetype = 'PURCHASE'
    AND rate_pct BETWEEN 8.0 AND 25.0
)

SELECT * FROM variable
UNION ALL
SELECT * FROM variable_io
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

    try:
        rows = run_query(_SQL)
        payload = _build_response(rows)
        return _cors(200, json.dumps(payload))
    except Exception as exc:
        print(f"ERROR: {exc}")
        return _cors(500, json.dumps({"error": str(exc)}))


def _build_response(rows: list) -> dict:
    result = {
        "asOf": date.today().isoformat(),
        "lenderCount": 0,
        "variable": {},
        "variableIO": {},
        "fixed": {},
        "personalLoan": {},
        "businessLoan": {},
        "creditCard": {},
    }

    total_lenders = set()

    for row in rows:
        category = row.get("category")
        avg  = _f(row.get("avg_rate"))
        mn   = _f(row.get("min_rate"))
        mx   = _f(row.get("max_rate"))
        cnt  = _i(row.get("product_count"))
        lc   = _i(row.get("lender_count"))
        total_lenders.add(lc)   # accumulate for overall count

        entry = {"avg": avg, "min": mn, "max": mx, "count": cnt}

        if category == "variable":
            result["variable"] = entry
            result["lenderCount"] = lc
        elif category == "variable_io":
            result["variableIO"] = entry
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
