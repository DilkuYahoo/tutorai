import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import boto3
from shared import db, response

NMI_PARAM = "/energy-mate/nmi"
AEST_OFFSET = timedelta(hours=10)

_ssm = None


def _get_nmi() -> str:
    nmi = os.environ.get("NMI")
    if nmi:
        return nmi
    global _ssm
    if _ssm is None:
        _ssm = boto3.client("ssm", region_name="ap-southeast-2")
    resp = _ssm.get_parameter(Name=NMI_PARAM)
    return resp["Parameter"]["Value"]


def _to_float(val) -> float | None:
    if val is None or val == "N/A":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _today_aest_bounds() -> tuple[str, str]:
    """Return UTC ISO strings for start and end of today in AEST."""
    now_utc = datetime.now(timezone.utc)
    now_aest = now_utc + AEST_OFFSET
    today_aest_start = now_aest.replace(hour=0, minute=0, second=0, microsecond=0)
    today_aest_end = today_aest_start + timedelta(days=1)
    # Convert back to UTC for DynamoDB SK comparison
    start_utc = today_aest_start - AEST_OFFSET
    end_utc = today_aest_end - AEST_OFFSET
    return start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"), end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return response.preflight()

    try:
        nmi = _get_nmi()
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        from_str = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = (now + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")

        items = db.query_pk_between(f"INTERVAL#{nmi}", from_str, to_str)

        history = []
        forecast = []

        for item in items:
            interval_end = item.get("SK", "")
            record = {
                "intervalEnd": interval_end,
                "importRate": _to_float(item.get("costsAllVarRate")),
                "fitRate": _to_float(item.get("earningsAllVarRate")),
                "importsWh": _to_float(item.get("importsAll")) or 0,
                "exportsWh": _to_float(item.get("exportsAll")) or 0,
                "costCents": _to_float(item.get("costsAll")) or 0,
                "earnCents": _to_float(item.get("earningsAll")) or 0,
                "quality": item.get("quality", ""),
            }
            if interval_end <= now_str:
                history.append(record)
            else:
                forecast.append(record)

        # Billing aggregates for today (AEST)
        today_start, today_end = _today_aest_bounds()
        today_items = db.query_pk_between(f"INTERVAL#{nmi}", today_start, today_end)
        spend_cents = sum(_to_float(i.get("costsAll")) or 0 for i in today_items)
        earn_cents = sum(_to_float(i.get("earningsAll")) or 0 for i in today_items)

        return response.ok({
            "history": history,
            "forecast": forecast,
            "todayBilling": {
                "spendCents": round(spend_cents, 2),
                "earnCents": round(earn_cents, 2),
                "netCents": round(spend_cents - earn_cents, 2),
            },
        })

    except Exception as e:
        print(f"Error in get_history: {e}")
        return response.server_error(str(e))
