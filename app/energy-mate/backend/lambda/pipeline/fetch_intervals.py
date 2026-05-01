import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timedelta, timezone
import boto3
from shared import db, localvolts

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


def _store_intervals(nmi: str, intervals: list[dict]):
    for interval in intervals:
        interval_end = interval.get("intervalEnd")
        if not interval_end:
            continue
        item = {
            "PK": f"INTERVAL#{nmi}",
            "SK": interval_end,
            "importsAll": str(interval.get("importsAll", 0)),
            "exportsAll": str(interval.get("exportsAll", 0)),
            "costsAllVarRate": str(interval.get("costsAllVarRate", "N/A")),
            "earningsAllVarRate": str(interval.get("earningsAllVarRate", "N/A")),
            "costsAll": str(interval.get("costsAll", 0)),
            "earningsAll": str(interval.get("earningsAll", 0)),
            "costsAllVar": str(interval.get("costsAllVar", 0)),
            "costsAllFixed": str(interval.get("costsAllFixed", 0)),
            "earningsAllVar": str(interval.get("earningsAllVar", 0)),
            "earningsAllFixed": str(interval.get("earningsAllFixed", 0)),
            "quality": interval.get("quality", ""),
            "lastUpdate": interval.get("lastUpdate", ""),
            "importsAllUnits": interval.get("importsAllUnits", "Wh"),
            "exportsAllUnits": interval.get("exportsAllUnits", "Wh"),
        }
        db.put_item(item)


def lambda_handler(event, context):
    nmi = _get_nmi()
    now = datetime.now(timezone.utc)

    # Past 24hrs
    past_from = (now - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    past_to = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    past_intervals = localvolts.fetch_intervals(nmi, past_from, past_to)
    _store_intervals(nmi, past_intervals)

    # Next 24hrs (forecast)
    future_from = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    future_to = (now + timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    future_intervals = localvolts.fetch_intervals(nmi, future_from, future_to)
    _store_intervals(nmi, future_intervals)

    total = len(past_intervals) + len(future_intervals)
    print(f"Stored {total} intervals for NMI {nmi}")
    return {"statusCode": 200, "body": f"Stored {total} intervals"}
