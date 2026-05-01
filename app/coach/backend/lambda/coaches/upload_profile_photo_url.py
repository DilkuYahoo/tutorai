import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, forbidden, preflight
from shared.ids import generate_id

S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_PREFIX = os.environ.get("S3_PREFIX", "coachgenie")
_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can upload profile photos")

    coach_id = get_user_id(event)
    key = f"{S3_PREFIX}/photos/coaches/{coach_id}/{generate_id()}.jpg"

    url = _get_s3().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": S3_BUCKET,
            "Key": key,
            "ContentType": "image/jpeg",
        },
        ExpiresIn=300,
    )

    photo_url = f"https://coachgenie.cognifylabs.ai/{key}"
    return ok({"uploadUrl": url, "photoUrl": photo_url, "key": key})
