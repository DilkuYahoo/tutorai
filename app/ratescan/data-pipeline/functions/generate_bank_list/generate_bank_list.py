import logging
import os
import json
import boto3

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get("S3_BUCKET", "ratescan.com.au")
CONFIG_S3_KEY = os.environ.get("CONFIG_S3_KEY", "config.json")


def lambda_handler(event, context):
    """
    Reads config.json from S3 and returns the list of bank names.

    This is the first step in the Step Functions pipeline. Its output
    {"banks": [...]} feeds into both the Stage 1 and Stage 2 Map states.

    Returns:
      {"banks": ["CBA", "ANZ", "NAB", ...]}
    """
    logger.info(f"Reading config from s3://{S3_BUCKET}/{CONFIG_S3_KEY}")
    s3_client = boto3.client("s3")
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=CONFIG_S3_KEY)
    config = json.loads(resp["Body"].read())
    banks = list(config["banks"].keys())
    logger.info(f"Found {len(banks)} banks in config")
    return {"banks": banks}
