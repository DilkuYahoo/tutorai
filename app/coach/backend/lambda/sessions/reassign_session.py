import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import require_role
from shared.response import ok, bad_request, not_found, conflict, preflight
from shared.ids import utc_now
from shared.slots import resolve_available_slots
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

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    if session.get("status") == "completed":
        return bad_request("Completed sessions cannot be reassigned")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    new_coach_id = body.get("newCoachId")
    if not new_coach_id:
        return bad_request("'newCoachId' is required")

    new_coach = db.get_item(f"COACH#{new_coach_id}", "#META")
    if not new_coach or new_coach.get("status") != "active":
        return not_found("New coach not found or inactive")

    # Validate new coach has availability at the session's time
    from datetime import datetime
    dt = datetime.fromisoformat(session["scheduledAt"])
    date_str = dt.date().isoformat()
    time_str = dt.strftime("%H:%M")
    available = resolve_available_slots(new_coach_id, date_str, date_str)
    if not any(s["time"] == time_str for s in available):
        return conflict("New coach is not available at the session's scheduled time")

    now = utc_now()
    db.update_item(f"SESSION#{session_id}", "#META", {
        "coachId": new_coach_id,
        "GSI1PK": f"COACH#{new_coach_id}",
        "reassignedAt": now,
        "previousCoachId": session.get("coachId"),
    })

    player = db.get_item(f"PLAYER#{session['playerId']}", "#META")
    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=__import__("json").dumps({
                "template": "session_reassigned",
                "recipientEmail": player.get("email"),
                "recipientName": player.get("name"),
                "variables": {
                    "newCoachName": new_coach.get("name"),
                    "scheduledAt": session.get("scheduledAt"),
                },
            }).encode(),
        )
    except Exception:
        pass

    return ok({"message": "Session reassigned", "newCoachId": new_coach_id})
