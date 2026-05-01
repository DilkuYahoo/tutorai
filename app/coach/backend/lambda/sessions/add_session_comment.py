import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, is_coach_or_super
from shared.response import created, bad_request, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
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

    if not is_coach_or_super(event):
        return forbidden("Only coaches can add session comments")

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    caller_id = get_user_id(event)
    if session.get("coachId") != caller_id and not is_coach_or_super(event):
        return forbidden("Not your session")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    comment_text = (body.get("comment") or "").strip()
    if not comment_text:
        return bad_request("'comment' is required")

    now = utc_now()
    comment_id = generate_id()
    item = {
        "PK": f"SESSION#{session_id}",
        "SK": f"COMMENT#{now}#{comment_id}",
        "id": comment_id,
        "sessionId": session_id,
        "coachId": caller_id,
        "comment": comment_text,
        "createdAt": now,
    }
    db.put_item(item)

    player = db.get_item(f"PLAYER#{session['playerId']}", "#META")
    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({
                "template": "session_comment",
                "recipientEmail": player.get("email"),
                "recipientName": player.get("name"),
                "variables": {"comment": comment_text, "scheduledAt": session.get("scheduledAt")},
            }).encode(),
        )
    except Exception:
        pass

    out = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(out)
