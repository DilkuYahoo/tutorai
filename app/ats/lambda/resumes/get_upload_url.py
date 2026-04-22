import json
import os
import sys
import boto3
from botocore.config import Config
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, preflight
from shared.ids import generate_id

RESUME_BUCKET = os.environ.get("RESUME_BUCKET", "advicelab")
RESUME_PREFIX = os.environ.get("RESUME_PREFIX", "ats/resumes")
PRESIGN_EXPIRES = 300  # 5 minutes

_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name="ap-southeast-2", config=Config(signature_version="s3v4"))
    return _s3


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    candidate_id = body.get("candidateId")
    file_name    = body.get("fileName")
    content_type = body.get("contentType", "application/octet-stream")

    if not candidate_id or not file_name:
        return bad_request("candidateId and fileName are required")

    # Sanitise filename
    safe_name = "".join(c for c in file_name if c.isalnum() or c in (".", "-", "_"))
    s3_key = f"{RESUME_PREFIX}/{candidate_id}/{generate_id()}/{safe_name}"

    upload_url = _get_s3().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": RESUME_BUCKET,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGN_EXPIRES,
    )

    return ok({"uploadUrl": upload_url, "s3Key": s3_key})
