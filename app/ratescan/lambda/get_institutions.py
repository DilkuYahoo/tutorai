"""
get_institutions.py — GET /institutions

Reads institutions/latest.json written by Stage 5 of the pipeline.
Returns the full list of financial institutions with per-bank run status.
No Athena query needed — purely an S3 read.
"""

import json
import os

import boto3
from botocore.exceptions import ClientError

S3_BUCKET           = os.environ.get("S3_BUCKET", "ratescan.com.au")
INSTITUTIONS_PREFIX = os.environ.get("INSTITUTIONS_PREFIX", "institutions")
CACHE_PREFIX        = os.environ.get("CACHE_PREFIX", "cache")


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    s3 = boto3.client("s3")

    latest = _read_s3_json(s3, f"{INSTITUTIONS_PREFIX}/latest.json")
    if latest is None:
        return _cors(503, json.dumps({"error": "institutions data not yet available — pipeline has not completed its first run"}))

    run_date  = latest.get("runDate", "unknown")
    cache_key = f"{CACHE_PREFIX}/institutions-{run_date}.json"

    cached = _read_s3_json(s3, cache_key)
    if cached is not None:
        print(f"INFO: cache hit for institutions-{run_date}")
        return _cors(200, json.dumps(cached))

    _write_s3_json(s3, cache_key, latest)
    return _cors(200, json.dumps(latest))


def _read_s3_json(s3, key: str) -> dict | None:
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=key)
        return json.loads(resp["Body"].read())
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code not in ("NoSuchKey", "404"):
            print(f"WARNING: S3 error reading {key}: {e}")
        return None
    except Exception as e:
        print(f"WARNING: unexpected error reading {key}: {e}")
        return None


def _write_s3_json(s3, key: str, payload: dict) -> None:
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(payload),
            ContentType="application/json",
        )
    except Exception as e:
        print(f"WARNING: cache write failed for {key}: {e}")


def _cors(status: int, body: str) -> dict:
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
    if status == 200:
        headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return {"statusCode": status, "headers": headers, "body": body}
