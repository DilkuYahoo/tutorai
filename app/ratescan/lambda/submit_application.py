import json
import os
import uuid
import boto3
from datetime import datetime, timezone

S3_BUCKET = os.environ.get("S3_BUCKET", "ratescan.com.au")

s3 = boto3.client("s3")

REQUIRED_FIELDS = ["name", "age", "mobile", "email", "propertyValue", "loanAmount", "propertyPurpose", "loanPurpose", "employmentType", "income", "expenses"]


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors(400, json.dumps({"error": "Invalid JSON"}))

    missing = [f for f in REQUIRED_FIELDS if not body.get(f)]
    if missing:
        return _cors(400, json.dumps({"error": f"Missing fields: {', '.join(missing)}"}))

    application_id = str(uuid.uuid4())
    payload = {
        **body,
        "id": application_id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"applications/{application_id}.json",
        Body=json.dumps(payload),
        ContentType="application/json",
    )

    return _cors(201, json.dumps({"id": application_id}))


def _cors(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": body,
    }
