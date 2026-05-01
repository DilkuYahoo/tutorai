import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, get_role
from shared.response import created, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared import db

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

    role = get_role(event)
    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    user_id = get_user_id(event)
    if role == "coach" and session.get("coachId") != user_id:
        return forbidden("Not your session")
    if role == "player" and session.get("playerId") != user_id:
        return forbidden("Not your session")
    if role == "parent":
        children = db.query_pk(f"PARENT#{user_id}", sk_prefix="CHILD#")
        child_ids = {c.get("playerId") for c in children}
        if session.get("playerId") not in child_ids:
            return forbidden("Not your child's session")

    video_id = generate_id()
    uploader_type = "coach" if role in ("coach", "super_coach") else "player"
    key = f"{S3_PREFIX}/videos/sessions/{session_id}/{uploader_type}/{video_id}.mp4"

    url = _get_s3().generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": "video/mp4"},
        ExpiresIn=3600,
    )

    now = utc_now()
    video_item = {
        "PK": f"SESSION#{session_id}",
        "SK": f"VIDEO#{video_id}",
        "id": video_id,
        "sessionId": session_id,
        "uploaderType": uploader_type,
        "uploaderId": user_id,
        "key": key,
        "status": "uploading",
        "coachResponse": None,
        "createdAt": now,
    }
    db.put_item(video_item)

    return created({"videoId": video_id, "uploadUrl": url, "key": key})
