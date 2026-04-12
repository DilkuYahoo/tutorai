import logging
import sys
import os
import json
import datetime
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


def read_products_from_s3(s3_client, bucket, key):
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return json.loads(response["Body"].read())


def upload_to_s3(s3_client, data, bucket, key):
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, indent=4),
        ContentType="application/json",
    )
    logger.info(f"Uploaded to s3://{bucket}/{key}")


def fetch_product_details(config, s3_client, target_bank=None):
    """
    Fetch per-product details for all banks (or a single bank if target_bank is set).

    Pass target_bank via the Lambda event to enable fan-out: invoke one Lambda
    per bank in parallel rather than processing all banks sequentially in one
    invocation (important for large configs that would exceed the 15-min limit).
    """
    logger.info("Starting to fetch product details")
    date_str = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d")
    errors = []

    banks = (
        {target_bank: config["banks"][target_bank]}
        if target_bank
        else config["banks"]
    )

    for bank, bank_config in banks.items():
        logger.info(f"Processing bank: {bank}")

        # Read product list written by the first Lambda (main.py)
        products_key = f"{S3_PREFIX}/{bank}/products.json"
        try:
            products = read_products_from_s3(s3_client, S3_BUCKET, products_key)
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                logger.warning(f"Products file not found in S3 for {bank}: {products_key}")
            else:
                logger.error(f"S3 error reading products for {bank}: {e}")
                errors.append(f"{bank}: {e}")
            continue

        product_ids = [p["productId"] for p in products]
        logger.info(f"Found {len(product_ids)} products for {bank}")

        base_url = bank_config["base_url"]
        headers = bank_config["headers_prd_details"]

        for product_id in product_ids:
            try:
                url = f"{base_url}/{product_id}"
                logger.info(f"Fetching details for {product_id} from {bank}")
                response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
                response.raise_for_status()
                data = response.json()

                s3_key = f"{S3_PREFIX}/{bank}/details/{date_str}/{product_id}.json"
                upload_to_s3(s3_client, data, S3_BUCKET, s3_key)

            except (requests.RequestException, BotoCoreError, ClientError) as e:
                msg = f"{bank}/{product_id}: {e}"
                logger.error(f"Error fetching product details — {msg}")
                errors.append(msg)

    return errors


def lambda_handler(event, context):
    """
    Lambda entry point.

    Event schema (all fields optional):
      {
        "bank": "CBA"   // process a single bank only (fan-out pattern)
      }

    Fan-out pattern (recommended for large configs):
      Invoke one Lambda per bank from an orchestrator (Step Functions / EventBridge)
      to stay well within the 15-minute execution limit.
    """
    target_bank = event.get("bank") if event else None

    s3_client = boto3.client("s3")
    config = load_config(s3_client)

    if target_bank and target_bank not in config["banks"]:
        return {
            "statusCode": 400,
            "body": {"message": f"Unknown bank: {target_bank}"},
        }

    errors = fetch_product_details(config, s3_client, target_bank=target_bank)

    if errors:
        logger.warning(f"{len(errors)} product(s) failed: {errors}")

    return {
        "statusCode": 200 if not errors else 207,
        "body": {
            "message": "Fetch complete",
            "bank": target_bank or "all",
            "errors": errors,
        },
    }


if __name__ == "__main__":
    target_bank = sys.argv[1] if len(sys.argv) > 1 else None
    config = load_config()  # reads local config.json (CONFIG_S3_KEY not set locally)

    # Local run: read/write from /tmp instead of S3
    class LocalS3:
        def get_object(self, Bucket, Key):
            path = os.path.join("/tmp", Key)
            try:
                with open(path, "rb") as f:
                    data = f.read()
                return {"Body": type("_R", (), {"read": lambda self: data})()}
            except FileNotFoundError:
                raise ClientError(
                    {"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}},
                    "GetObject",
                )

        def put_object(self, Bucket, Key, Body, ContentType):
            path = os.path.join("/tmp", Key)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(Body)
            print(f"Written locally to {path}")

    errors = fetch_product_details(config, LocalS3(), target_bank=target_bank)
    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")
