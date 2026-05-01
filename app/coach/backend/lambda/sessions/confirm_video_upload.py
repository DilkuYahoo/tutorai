import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, get_role
from shared.response import ok, not_found, forbidden, preflight
from shared.ids import utc_now
from shared import db

NOTIFICATION_FUNCTION_NAME = os.environ.get("NOTIFICATION_FUNCTION_NAME", "")
_lambda_client = None


def _lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    params = event.get("pathParameters") or {}
    session_id = params.get("sessionId", "")
    video_id = params.get("videoId", "")

    video = db.get_item(f"SESSION#{session_id}", f"VIDEO#{video_id}")
    if not video:
        return not_found("Video not found")

    role = get_role(event)
    user_id = get_user_id(event)

    if video.get("uploaderId") != user_id:
        return forbidden("Not your upload")

    db.update_item(f"SESSION#{session_id}", f"VIDEO#{video_id}", {
        "status": "uploaded",
        "uploadedAt": utc_now(),
    })

    # If player uploaded, notify coach
    if video.get("uploaderType") == "player":
        session = db.get_item(f"SESSION#{session_id}", "#META")
        if session:
            coach = db.get_item(f"COACH#{session.get('coachId')}", "#META")
            if coach:
                try:
                    _lambda().invoke(
                        FunctionName=NOTIFICATION_FUNCTION_NAME,
                        InvocationType="Event",
                        Payload=__import__("json").dumps({
                            "template": "video_uploaded_by_player",
                            "recipientEmail": coach.get("email"),
                            "recipientName": coach.get("name"),
                            "variables": {"sessionId": session_id},
                        }).encode(),
                    )
                except Exception:
                    pass

    return ok({"message": "Video upload confirmed", "videoId": video_id})
