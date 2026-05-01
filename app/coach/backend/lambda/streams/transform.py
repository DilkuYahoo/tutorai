"""
DynamoDB Streams → S3 Parquet transformer.

Reads NEW_AND_OLD_IMAGES events, extracts relevant entity types,
and appends Parquet rows to the reporting S3 bucket.

Lag: 10–60 seconds (acceptable for analytical queries).
"""
import io
import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3
from decimal import Decimal
from datetime import datetime, timezone

S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_PREFIX = os.environ.get("S3_PREFIX", "coachgenie")
_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def _deserialise(ddb_item: dict) -> dict:
    """Convert DynamoDB typed attributes to plain Python types."""
    deserialiser = boto3.dynamodb.types.TypeDeserializer()
    return {k: deserialiser.deserialize(v) for k, v in ddb_item.items()}


def _decimal_safe(v):
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def _write_parquet(records: list[dict], prefix: str):
    """Write records to S3 as newline-delimited JSON (NDJSON) partitioned by year/month.

    Note: pyarrow is available in requirements.txt for production Parquet.
    Using NDJSON here for Lambda cold-start resilience; Athena supports both.
    Switch to pyarrow.parquet for better compression in high-volume scenarios.
    """
    if not records:
        return
    now = datetime.now(timezone.utc)
    partition = f"year={now.year}/month={now.month:02d}"
    key = f"{S3_PREFIX}/reporting/{prefix}/{partition}/{now.strftime('%Y%m%dT%H%M%S%f')}.json"
    body = "\n".join(json.dumps({k: _decimal_safe(v) for k, v in r.items()}) for r in records)
    _get_s3().put_object(Bucket=S3_BUCKET, Key=key, Body=body.encode("utf-8"),
                          ContentType="application/x-ndjson")


def lambda_handler(event, context):
    sessions = []
    credit_ledger = []
    invoices = []
    coaches = []
    players = []
    package_purchases = []

    for record in event.get("Records", []):
        if record.get("eventName") not in ("INSERT", "MODIFY"):
            continue

        new_image = record.get("dynamodb", {}).get("NewImage")
        if not new_image:
            continue

        item = _deserialise(new_image)
        pk = item.get("PK", "")
        sk = item.get("SK", "")

        if pk.startswith("SESSION#") and sk == "#META":
            sessions.append(item)
        elif pk.startswith("CREDITS#"):
            credit_ledger.append(item)
        elif pk.startswith("INVOICE#") and sk == "#META":
            invoices.append(item)
        elif pk.startswith("COACH#") and sk == "#META":
            coaches.append(item)
        elif pk.startswith("PLAYER#") and sk == "#META":
            players.append(item)
        elif pk.startswith("PLAYER#") and sk.startswith("PKGPURCHASE#"):
            package_purchases.append(item)

    _write_parquet(sessions, "sessions")
    _write_parquet(credit_ledger, "credit_ledger")
    _write_parquet(invoices, "invoices")
    _write_parquet(coaches, "coaches")
    _write_parquet(players, "players")
    _write_parquet(package_purchases, "package_purchases")
