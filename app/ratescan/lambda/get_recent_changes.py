"""
get_recent_changes.py — GET /rates/recent-changes

Returns the top 10 lenders ordered by most recent rate update.
Each lender entry includes a flat list of products that were changed.

Note on prevRate: the current Iceberg table stores the latest snapshot only
(full overwrite each run), so previous rates are not available. The `prevRate`
field is omitted from the response; the frontend Delta component will render
nothing when prevRate is absent.

Fixed-term label mapping:
  P1Y / P12M → "Fixed 1Y"
  P2Y / P24M → "Fixed 2Y"
  ...
  P5Y / P60M → "Fixed 5Y"
"""

import json
import os
from collections import defaultdict
from datetime import date, datetime
from zoneinfo import ZoneInfo

import boto3
from botocore.exceptions import ClientError

from athena_helper import run_query

DATABASE         = os.environ.get("ATHENA_DATABASE", "obdb")
S3_BUCKET        = os.environ.get("S3_BUCKET", "ratescan.com.au")
SUMMARIES_PREFIX = os.environ.get("SUMMARIES_PREFIX", "summaries")
CACHE_PREFIX     = os.environ.get("CACHE_PREFIX", "cache")

# Fetch the 500 most-recently-updated rate rows (post-processing groups by lender)
_SQL = f"""
SELECT brand, product_name, lendingratetype, additionalvalue, rate_pct, lastupdated
FROM (
  SELECT
    brand,
    name                   AS product_name,
    UPPER(lendingratetype) AS lendingratetype,
    additionalvalue,
    CASE
      WHEN TRY_CAST(rate AS DOUBLE) < 1
        THEN ROUND(TRY_CAST(rate AS DOUBLE) * 100, 2)
      ELSE ROUND(TRY_CAST(rate AS DOUBLE), 2)
    END                    AS rate_pct,
    lastupdated
  FROM {DATABASE}.daily_rates
  WHERE productcategory = 'RESIDENTIAL_MORTGAGES'
    AND TRY_CAST(rate AS DOUBLE) IS NOT NULL
    AND TRY_CAST(rate AS DOUBLE) > 0
    AND brand IS NOT NULL
    AND lastupdated IS NOT NULL
    AND (
      UPPER(lendingratetype) = 'VARIABLE'
      OR (
        UPPER(lendingratetype) = 'FIXED'
        AND (
          REGEXP_LIKE(additionalvalue, '^P[1-5]Y$')
          OR REGEXP_LIKE(additionalvalue, '^P(12|24|36|48|60)M$')
        )
      )
    )
)
WHERE rate_pct BETWEEN 0.5 AND 20
ORDER BY lastupdated DESC
LIMIT 500
"""

# ISO 8601 duration → human-readable label
_TERM_LABELS = {
    "P1Y": "Fixed 1Y", "P12M": "Fixed 1Y",
    "P2Y": "Fixed 2Y", "P24M": "Fixed 2Y",
    "P3Y": "Fixed 3Y", "P36M": "Fixed 3Y",
    "P4Y": "Fixed 4Y", "P48M": "Fixed 4Y",
    "P5Y": "Fixed 5Y", "P60M": "Fixed 5Y",
}


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    s3 = boto3.client("s3")

    # Cache key is keyed by the pipeline's asOf date so it auto-invalidates
    # whenever Stage 5 writes a new latest.json (daily after the pipeline run).
    as_of     = _pipeline_as_of(s3)
    cache_key = f"{CACHE_PREFIX}/recent-changes-{as_of}.json"

    cached = _read_cache(s3, cache_key)
    if cached is not None:
        print(f"INFO: cache hit for {as_of}")
        return _cors(200, json.dumps(cached))

    try:
        rows    = run_query(_SQL)
        payload = _build_response(rows)
        _write_cache(s3, cache_key, payload)
        return _cors(200, json.dumps(payload))
    except Exception as exc:
        print(f"ERROR: {exc}")
        return _cors(500, json.dumps({"error": str(exc)}))


def _pipeline_as_of(s3) -> str:
    """Return the asOf date from summaries/latest.json, falling back to today (Sydney)."""
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=f"{SUMMARIES_PREFIX}/latest.json")
        data = json.loads(resp["Body"].read())
        return data.get("asOf") or datetime.now(ZoneInfo("Australia/Sydney")).date().isoformat()
    except Exception:
        return datetime.now(ZoneInfo("Australia/Sydney")).date().isoformat()


def _read_cache(s3, key: str):
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


def _write_cache(s3, key: str, payload) -> None:
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


def _build_response(rows: list) -> list:
    # Group products by brand; track the most recent lastupdated per brand
    by_brand: dict[str, dict] = {}

    for row in rows:
        brand       = (row.get("brand") or "").strip()
        if not brand:
            continue

        ratetype    = row.get("lendingratetype", "")
        addlval     = (row.get("additionalvalue") or "").strip().upper()
        rate        = _f(row.get("rate_pct"))
        updated     = (row.get("lastupdated") or "")[:10]   # keep date part only
        pname       = (row.get("product_name") or "").strip()

        if ratetype == "VARIABLE":
            ptype = "Variable"
        else:
            ptype = _TERM_LABELS.get(addlval) or _TERM_LABELS.get(addlval.upper(), "Fixed")

        if brand not in by_brand:
            by_brand[brand] = {
                "lender":    brand,
                "initials":  _initials(brand),
                "changedAt": updated,
                "products":  [],
            }
        else:
            # Keep the latest date for this lender
            if updated > by_brand[brand]["changedAt"]:
                by_brand[brand]["changedAt"] = updated

        by_brand[brand]["products"].append({
            "name": pname,
            "type": ptype,
            "rate": rate,
        })

    # Sort lenders by most recent change, take top 10
    sorted_lenders = sorted(
        by_brand.values(),
        key=lambda x: x["changedAt"],
        reverse=True,
    )[:10]

    # Deduplicate products per lender (same product may appear multiple times
    # due to multiple rate tiers), keeping the first occurrence
    for i, lender in enumerate(sorted_lenders):
        seen = set()
        unique_products = []
        for p in lender["products"]:
            key = (p["name"], p["type"])
            if key not in seen:
                seen.add(key)
                unique_products.append(p)
        lender["products"] = unique_products
        lender["id"] = i + 1   # stable integer key for frontend expand/collapse

    return sorted_lenders


def _initials(brand: str) -> str:
    """Generate up to 3-letter initials from a brand name."""
    words = brand.split()
    if len(words) == 1:
        return brand[:3].upper()
    return "".join(w[0] for w in words if w[0].isalpha())[:3].upper()


def _f(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


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
