import logging
import sys
import os
import json
import requests
import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get("S3_BUCKET", "ratescan.com.au")
S3_PREFIX = os.environ.get("S3_PREFIX", "products")
CONFIG_S3_KEY = os.environ.get("CONFIG_S3_KEY")   # e.g. "config.json" — set in Lambda env
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "30"))

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def load_config(s3_client=None):
    """Load config from S3 when CONFIG_S3_KEY is set, otherwise from local file."""
    if CONFIG_S3_KEY and s3_client:
        logger.info(f"Loading config from s3://{S3_BUCKET}/{CONFIG_S3_KEY}")
        resp = s3_client.get_object(Bucket=S3_BUCKET, Key=CONFIG_S3_KEY)
        return json.loads(resp["Body"].read())
    logger.info(f"Loading config from local file: {CONFIG_PATH}")
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def upload_to_s3(s3_client, data, bucket, key):
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, indent=4),
        ContentType="application/json",
    )
    logger.info(f"Uploaded to s3://{bucket}/{key}")


def fetch_openbanking_data(config, s3_client):
    logger.info("Starting to fetch open banking data")
    errors = []

    for bank, bank_config in config["banks"].items():
        logger.info(f"Processing bank: {bank}")
        try:
            base_url = bank_config["base_url"]
            headers = bank_config["headers_products"].copy()
            # Ensure User-Agent is set for WAF compatibility
            if "User-Agent" not in headers:
                headers["User-Agent"] = "Mozilla/5.0 (compatible; RateScan/1.0)"
            all_products = []
            url = base_url

            while url:
                logger.info(f"Fetching from URL: {url}")
                response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
                data = response.json()
                products = data.get("data", {}).get("products", [])
                all_products.extend(products)
                url = data.get("links", {}).get("next")

            s3_key = f"{S3_PREFIX}/{bank}/products.json"
            upload_to_s3(s3_client, all_products, S3_BUCKET, s3_key)
            logger.info(f"Collected {len(all_products)} products for {bank}")

        except (requests.RequestException, BotoCoreError, ClientError) as e:
            msg = f"Error for bank {bank}: {e}"
            logger.error(msg)
            errors.append(msg)

    return errors


def lambda_handler(event, context):
    """
    Lambda entry point.

    Event schema (all fields optional):
      {
        "bank": "CBA"   // process a single bank only (fan-out pattern)
      }

    Fan-out pattern (recommended):
      Invoke one Lambda per bank from the Step Functions Map state so all 124
      banks run in parallel, each completing well within the 15-min Lambda limit.
    """
    s3_client = boto3.client("s3")
    config = load_config(s3_client)

    target_bank = (event or {}).get("bank")
    if target_bank:
        if target_bank not in config["banks"]:
            return {"statusCode": 400, "body": {"message": f"Unknown bank: {target_bank}"}}
        scoped_config = {"banks": {target_bank: config["banks"][target_bank]}}
    else:
        scoped_config = config

    errors = fetch_openbanking_data(scoped_config, s3_client)

    if errors:
        logger.warning(f"{len(errors)} bank(s) failed: {errors}")

    return {
        "statusCode": 200 if not errors else 207,
        "body": {
            "message": "Fetch complete",
            "bank": target_bank or "all",
            "errors": errors,
        },
    }


if __name__ == "__main__":
    config_file = sys.argv[1] if len(sys.argv) > 1 else CONFIG_PATH
    target_bank = sys.argv[2] if len(sys.argv) > 2 else None

    with open(config_file) as f:
        config = json.load(f)

    if target_bank:
        if target_bank not in config["banks"]:
            print(f"Unknown bank: {target_bank}")
            sys.exit(1)
        config = {"banks": {target_bank: config["banks"][target_bank]}}

    # Local run: write to /tmp instead of S3
    class LocalS3:
        def put_object(self, Bucket, Key, Body, ContentType):
            path = os.path.join("/tmp", Key)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(Body)
            print(f"Written locally to {path}")

    errors = fetch_openbanking_data(config, LocalS3())
    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")
