"""
get_matched_rates.py — POST /rates/matched

Accepts form submission parameters and returns the top 3 mortgage rates
that best match the user's profile (LVR, loan purpose, rate type,
repayment type).

Request body (JSON):
  {
    "propertyPurpose":  "live-in" | "investment",
    "loanPurpose":      "first-home" | "refinance" | ...,
    "rateType":         "variable" | "fixed-1y" | "fixed-2y" | "fixed-3y" | "fixed-4y" | "fixed-5y",
    "repaymentType":    "principal-and-interest" | "interest-only",
    "propertyValue":    "750000",
    "loanAmount":       "600000"
  }

Response body (JSON):
  [
    {
      "brand":          "Commonwealth Bank",
      "productName":    "Standard Variable Rate Home Loan",
      "rate":           6.24,
      "comparisonRate": 6.41,
      "applicationUri": "https://..."
    },
    ...
  ]
"""

import json
import os

import boto3

from athena_helper import run_query

DATABASE = os.environ.get("ATHENA_DATABASE", "obdb")

# ISO duration from form rateType value
_RATE_TYPE_MAP = {
    "variable": ("VARIABLE", None),
    "fixed-1y": ("FIXED", "P1Y"),
    "fixed-2y": ("FIXED", "P2Y"),
    "fixed-3y": ("FIXED", "P3Y"),
    "fixed-4y": ("FIXED", "P4Y"),
    "fixed-5y": ("FIXED", "P5Y"),
}

# Maps P-notation to equivalent month notation used by some CDR providers
_MONTH_ALIAS = {
    "P1Y": "P12M",
    "P2Y": "P24M",
    "P3Y": "P36M",
    "P4Y": "P48M",
    "P5Y": "P60M",
}

_PURPOSE_MAP = {
    "live-in":    "OWNER_OCCUPIED",
    "investment": "INVESTMENT",
}

_REPAYMENT_MAP = {
    "principal-and-interest": "PRINCIPAL_AND_INTEREST",
    "interest-only":          "INTEREST_ONLY",
}


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _cors(400, json.dumps({"error": "Invalid JSON body"}))

    property_value = _to_float(body.get("propertyValue"))
    loan_amount    = _to_float(body.get("loanAmount"))
    lvr            = loan_amount / property_value if property_value and loan_amount else None

    property_purpose = body.get("propertyPurpose", "")
    rate_type_raw    = body.get("rateType", "variable")
    repayment_raw    = body.get("repaymentType", "principal-and-interest")

    loan_purpose   = _PURPOSE_MAP.get(property_purpose, "OWNER_OCCUPIED")
    repayment_type = _REPAYMENT_MAP.get(repayment_raw, "PRINCIPAL_AND_INTEREST")
    lending_rate_type, additional_value = _RATE_TYPE_MAP.get(rate_type_raw, ("VARIABLE", None))

    try:
        sql    = _build_sql(loan_purpose, lending_rate_type, additional_value, repayment_type, lvr)
        rows   = run_query(sql)
        result = _build_response(rows)
        return _cors(200, json.dumps(result))
    except Exception as exc:
        print(f"ERROR: {exc}")
        return _cors(500, json.dumps({"error": str(exc)}))


def _build_sql(loan_purpose, lending_rate_type, additional_value, repayment_type, lvr):
    lvr_filter = ""
    if lvr is not None:
        # Include rows where tiers are absent (apply to all LVRs) or encompass this LVR
        lvr_filter = f"""
        AND (
          (
            TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) IS NULL
            AND TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) IS NULL
          )
          OR (
            (TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) IS NULL OR TRY_CAST("tiers.0.minimumvalue" AS DOUBLE) <= {lvr})
            AND (TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) IS NULL OR TRY_CAST("tiers.0.maximumvalue" AS DOUBLE) >= {lvr})
          )
        )"""

    additional_filter = ""
    if additional_value:
        month_alias = _MONTH_ALIAS.get(additional_value, additional_value)
        additional_filter = f"AND UPPER(additionalvalue) IN ('{additional_value}', '{month_alias}')"

    return f"""
SELECT
  brand,
  name            AS product_name,
  CASE
    WHEN TRY_CAST(rate AS DOUBLE) < 1
      THEN ROUND(TRY_CAST(rate AS DOUBLE) * 100, 2)
    ELSE ROUND(TRY_CAST(rate AS DOUBLE), 2)
  END             AS rate_pct,
  CASE
    WHEN TRY_CAST(comparisonrate AS DOUBLE) < 1
      THEN ROUND(TRY_CAST(comparisonrate AS DOUBLE) * 100, 2)
    ELSE ROUND(TRY_CAST(comparisonrate AS DOUBLE), 2)
  END             AS comparison_rate_pct,
  applicationuri
FROM {DATABASE}.daily_rates
WHERE productcategory   = 'RESIDENTIAL_MORTGAGES'
  AND UPPER(lendingratetype) = '{lending_rate_type}'
  AND UPPER(loanpurpose) = '{loan_purpose}'
  AND UPPER(repaymenttype) = '{repayment_type}'
  AND TRY_CAST(rate AS DOUBLE) IS NOT NULL
  AND TRY_CAST(rate AS DOUBLE) > 0
  AND (
    CASE
      WHEN TRY_CAST(rate AS DOUBLE) < 1 THEN TRY_CAST(rate AS DOUBLE) * 100
      ELSE TRY_CAST(rate AS DOUBLE)
    END
  ) BETWEEN 2 AND 20
  {additional_filter}
  {lvr_filter}
ORDER BY rate_pct ASC
LIMIT 3
"""


def _build_response(rows):
    result = []
    for row in rows:
        rate     = _f(row.get("rate_pct"))
        comp     = _f(row.get("comparison_rate_pct"))
        app_uri  = (row.get("applicationuri") or "").strip() or None
        if rate <= 0:
            continue
        result.append({
            "brand":          (row.get("brand") or "").strip(),
            "productName":    (row.get("product_name") or "").strip(),
            "rate":           rate,
            "comparisonRate": comp if comp > 0 else None,
            "applicationUri": app_uri,
        })
    return result


def _to_float(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _cors(status, body):
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    return {"statusCode": status, "headers": headers, "body": body}
