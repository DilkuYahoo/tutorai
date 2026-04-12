import logging
import sys
import os
import io
import csv
import json
import datetime
import glob
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get("S3_BUCKET", "ratescan.com.au")
S3_PREFIX = os.environ.get("S3_PREFIX", "products")
CSV_PREFIX = os.environ.get("CSV_PREFIX", "")
S3_READ_WORKERS = int(os.environ.get("S3_READ_WORKERS", "50"))

top_fields = [
    "productId", "name", "brand", "lastUpdated",
    "description", "applicationUri", "productCategory",
]


def flatten_dict(d, prefix=""):
    """Recursively flatten a dict using dot notation for nested keys."""
    items = []
    for k, v in d.items():
        new_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key).items())
        elif isinstance(v, list):
            if v and isinstance(v[0], dict):
                for i, item in enumerate(v):
                    items.extend(flatten_dict(item, f"{new_key}.{i}").items())
            else:
                items.append((new_key, str(v)))
        else:
            items.append((new_key, v))
    return dict(items)


def process_json_data(data):
    """Extract lending rate rows from a single product detail JSON."""
    product_data = data["data"]
    lending_rates = product_data.get("lendingRates", [])
    rows = []
    for rate in lending_rates:
        row = {field: product_data.get(field, "") for field in top_fields}
        row.update(flatten_dict(rate))
        rows.append(row)
    return rows


def list_detail_keys(s3_client, bucket, prefix, date_str):
    """List all s3 keys matching products/*/details/{date_str}/*.json."""
    keys = []
    paginator = s3_client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=f"{prefix}/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if f"/details/{date_str}/" in key and key.endswith(".json"):
                keys.append(key)
    return keys


def fetch_key(s3_client, bucket, key):
    """Fetch and parse a single S3 JSON object. Returns (key, rows, error)."""
    try:
        resp = s3_client.get_object(Bucket=bucket, Key=key)
        data = json.loads(resp["Body"].read())
        return key, process_json_data(data), None
    except Exception as e:
        return key, [], str(e)


def flatten_to_csv_buffer(all_rows):
    """Convert list of row dicts to an in-memory CSV buffer."""
    all_keys = set()
    for row in all_rows:
        all_keys.update(row.keys())
    fieldnames = top_fields + sorted(all_keys - set(top_fields))

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(all_rows)
    return buf.getvalue()


def lambda_handler(event, context):
    """
    Lambda entry point.

    Event schema (all fields optional):
      {
        "date": "2026-04-12"   // defaults to today (UTC)
      }
    """
    date_str = (event or {}).get("date") or datetime.datetime.now(
        datetime.UTC
    ).strftime("%Y-%m-%d")

    s3_client = boto3.client("s3")

    logger.info(f"Listing detail files for date {date_str}")
    keys = list_detail_keys(s3_client, S3_BUCKET, S3_PREFIX, date_str)
    logger.info(f"Found {len(keys)} product detail files")

    if not keys:
        logger.warning("No detail files found — skipping CSV write")
        return {"statusCode": 200, "body": {"message": "No files found", "csv_key": None}}

    # Fetch all JSONs concurrently
    all_rows = []
    errors = []
    with ThreadPoolExecutor(max_workers=S3_READ_WORKERS) as pool:
        futures = {pool.submit(fetch_key, s3_client, S3_BUCKET, k): k for k in keys}
        for future in as_completed(futures):
            key, rows, err = future.result()
            if err:
                logger.warning(f"Skipping {key}: {err}")
                errors.append(f"{key}: {err}")
            else:
                all_rows.extend(rows)

    if not all_rows:
        logger.warning("No lending rate rows produced")
        return {"statusCode": 200, "body": {"message": "No lending rates found", "csv_key": None}}

    csv_body = flatten_to_csv_buffer(all_rows)
    csv_key = f"{CSV_PREFIX}product-master-{date_str}.csv".lstrip("/")

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=csv_key,
        Body=csv_body.encode("utf-8"),
        ContentType="text/csv",
    )
    logger.info(f"Wrote {len(all_rows)} rows to s3://{S3_BUCKET}/{csv_key}")

    return {
        "statusCode": 200 if not errors else 207,
        "body": {
            "message": "Flatten complete",
            "csv_key": csv_key,
            "rows": len(all_rows),
            "errors": errors,
        },
    }


if __name__ == "__main__":
    # Local run: reads from /tmp/products/, writes to /tmp/
    # Usage:
    #   python flatten_json_to_csv.py                  # uses today's date
    #   python flatten_json_to_csv.py 2026-04-12
    date_str = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now(
        datetime.UTC
    ).strftime("%Y-%m-%d")

    products_dir = "/tmp/products"
    json_files = []
    if os.path.exists(products_dir):
        for bank in os.listdir(products_dir):
            details_dir = os.path.join(products_dir, bank, "details")
            if os.path.isdir(details_dir):
                dated_dir = os.path.join(details_dir, date_str)
                if os.path.isdir(dated_dir):
                    json_files.extend(glob.glob(os.path.join(dated_dir, "*.json")))

    all_rows = []
    for path in json_files:
        try:
            with open(path) as f:
                data = json.load(f)
            all_rows.extend(process_json_data(data))
        except Exception as e:
            print(f"Skipping {path}: {e}")

    if not all_rows:
        print("No lending rate rows found.")
        sys.exit(0)

    csv_body = flatten_to_csv_buffer(all_rows)
    out_path = f"/tmp/product-master-{date_str}.csv"
    with open(out_path, "w") as f:
        f.write(csv_body)
    print(f"Written {len(all_rows)} rows to {out_path}")
