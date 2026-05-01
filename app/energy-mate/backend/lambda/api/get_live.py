import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone
import boto3
from shared import db, localvolts, response

NMI_PARAM = "/energy-mate/nmi"

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


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return response.preflight()

    try:
        nmi = _get_nmi()
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Fetch just the current interval (API returns current period + forward by default)
        intervals = localvolts.fetch_intervals(nmi, now_str, now_str)

        if not intervals:
            return response.ok({
                "importRate": None,
                "fitRate": None,
                "importsWh": 0,
                "exportsWh": 0,
                "quality": "Fcst",
                "intervalEnd": now_str,
                "lastFetched": now_str,
            })

        current = intervals[0]

        # Upsert into DynamoDB to keep history fresh
        item = {
            "PK": f"INTERVAL#{nmi}",
            "SK": current.get("intervalEnd", now_str),
            "importsAll": str(current.get("importsAll", 0)),
            "exportsAll": str(current.get("exportsAll", 0)),
            "costsAllVarRate": str(current.get("costsAllVarRate", "N/A")),
            "earningsAllVarRate": str(current.get("earningsAllVarRate", "N/A")),
            "costsAll": str(current.get("costsAll", 0)),
            "earningsAll": str(current.get("earningsAll", 0)),
            "costsAllVar": str(current.get("costsAllVar", 0)),
            "costsAllFixed": str(current.get("costsAllFixed", 0)),
            "earningsAllVar": str(current.get("earningsAllVar", 0)),
            "earningsAllFixed": str(current.get("earningsAllFixed", 0)),
            "quality": current.get("quality", ""),
            "lastUpdate": current.get("lastUpdate", ""),
            "importsAllUnits": current.get("importsAllUnits", "Wh"),
            "exportsAllUnits": current.get("exportsAllUnits", "Wh"),
        }
        db.put_item(item)

        def to_float(val):
            try:
                return float(val) if val not in (None, "N/A") else None
            except (ValueError, TypeError):
                return None

        return response.ok({
            "importRate": to_float(current.get("costsAllVarRate")),
            "importRateUnits": current.get("costsAllVarRateUnits", "c/kWh"),
            "fitRate": to_float(current.get("earningsAllVarRate")),
            "fitRateUnits": current.get("earningsAllVarRateUnits", "c/kWh"),
            "importsWh": round((to_float(current.get("importsAll")) or 0) * 1000, 4),
            "exportsWh": round((to_float(current.get("exportsAll")) or 0) * 1000, 4),
            "quality": current.get("quality", ""),
            "intervalEnd": current.get("intervalEnd", now_str),
            "lastFetched": now_str,
        })

    except Exception as e:
        print(f"Error in get_live: {e}")
        return response.server_error(str(e))
