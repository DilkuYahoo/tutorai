"""
Triggered by S3 ObjectCreated events on the CloudFront log bucket.
Parses each CloudFront access log (gzip TSV) and writes one DynamoDB
item per log line.

DynamoDB access patterns supported:
  - PK=DIST#{distributionId}  SK=LOG#{date}T{time}#{requestId}
      → fetch all logs for a distribution in a time window (GSI1 by time)
  - GSI1PK=DIST#{distributionId}  GSI1SK={timestamp}
      → time-range query per distribution
  - GSI2PK=DATE#{yyyy-mm-dd}  GSI2SK={distributionId}#{timestamp}
      → all traffic for a given calendar day
"""

import gzip
import io
import os
import boto3
import uuid
from datetime import datetime, timezone

# Import shared layer modules (available at /opt/python when deployed)
try:
    from shared.db import put_item
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
    from db import put_item

s3_client = boto3.client("s3")

# CloudFront W3C extended log format field order
CF_FIELDS = [
    "date", "time", "x_edge_location", "sc_bytes", "c_ip",
    "cs_method", "cs_host", "cs_uri_stem", "sc_status",
    "cs_referer", "cs_user_agent", "cs_uri_query", "cs_cookie",
    "x_edge_result_type", "x_edge_request_id", "x_host_header",
    "cs_protocol", "cs_bytes", "time_taken", "x_forwarded_for",
    "ssl_protocol", "ssl_cipher", "x_edge_response_result_type",
    "cs_protocol_version", "fle_status", "fle_encrypted_fields",
    "c_port", "time_to_first_byte", "x_edge_detailed_result_type",
    "sc_content_type", "sc_content_len", "sc_range_start", "sc_range_end",
]


def _parse_line(line: str, distribution_id: str) -> dict | None:
    if line.startswith("#") or not line.strip():
        return None

    parts = line.strip().split("\t")
    if len(parts) < 12:
        return None

    row = {}
    for i, field in enumerate(CF_FIELDS):
        row[field] = parts[i] if i < len(parts) else "-"

    date_str = row.get("date", "")
    time_str = row.get("time", "")
    if not date_str or not time_str:
        return None

    timestamp = f"{date_str}T{time_str}Z"
    request_id = row.get("x_edge_request_id", str(uuid.uuid4()))[:36]

    sc_status = row.get("sc_status", "0")
    try:
        status_int = int(sc_status)
    except ValueError:
        status_int = 0

    sc_bytes = row.get("sc_bytes", "0")
    try:
        bytes_int = int(sc_bytes)
    except ValueError:
        bytes_int = 0

    time_taken = row.get("time_taken", "0")
    try:
        time_taken_float = float(time_taken)
    except ValueError:
        time_taken_float = 0.0

    result_type = row.get("x_edge_result_type", "-")
    is_cache_hit = result_type in ("Hit", "RefreshHit")

    return {
        "PK": f"DIST#{distribution_id}",
        "SK": f"LOG#{timestamp}#{request_id}",
        "GSI1PK": f"DIST#{distribution_id}",
        "GSI1SK": timestamp,
        "GSI2PK": f"DATE#{date_str}",
        "GSI2SK": f"{distribution_id}#{timestamp}",
        "distributionId": distribution_id,
        "timestamp": timestamp,
        "date": date_str,
        "time": time_str,
        "clientIp": row.get("c_ip", "-"),
        "method": row.get("cs_method", "-"),
        "host": row.get("cs_host", "-"),
        "uriStem": row.get("cs_uri_stem", "-"),
        "status": str(status_int),
        "statusGroup": f"{status_int // 100}xx" if status_int else "unknown",
        "userAgent": row.get("cs_user_agent", "-"),
        "edgeLocation": row.get("x_edge_location", "-"),
        "resultType": result_type,
        "cacheHit": is_cache_hit,
        "bytes": bytes_int,
        "timeTaken": str(time_taken_float),
        "protocol": row.get("cs_protocol", "-"),
        "protocolVersion": row.get("cs_protocol_version", "-"),
        "referrer": row.get("cs_referer", "-"),
        "ttl": _ttl_90_days(),
    }


def _ttl_90_days() -> int:
    from datetime import timedelta
    return int((datetime.now(timezone.utc) + timedelta(days=90)).timestamp())


def lambda_handler(event, context):
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = record["s3"]["object"]["key"]

        # Distribution ID is the first path segment of the log key:
        # e.g.  EXXXXXXXXXXXXX.2024-01-15-12.abc123.gz
        filename = key.split("/")[-1]
        distribution_id = filename.split(".")[0] if "." in filename else "unknown"

        obj = s3_client.get_object(Bucket=bucket, Key=key)
        body = obj["Body"].read()

        with gzip.open(io.BytesIO(body), "rt", encoding="utf-8", errors="replace") as f:
            for line in f:
                item = _parse_line(line, distribution_id)
                if item:
                    try:
                        put_item(item)
                    except Exception:
                        pass
