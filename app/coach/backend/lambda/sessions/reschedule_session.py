import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, get_role
from shared.response import ok, bad_request, not_found, forbidden, conflict, preflight
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


def _notify(payload):
    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps(payload).encode(),
        )
    except Exception:
        pass


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    if session.get("status") != "booked":
        return bad_request(f"Session cannot be rescheduled (status: {session.get('status')})")

    role = get_role(event)
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

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    new_scheduled_at = body.get("scheduledAt")
    if not new_scheduled_at:
        return bad_request("'scheduledAt' is required")

    # Validate new slot is available
    from datetime import datetime
    dt = datetime.fromisoformat(new_scheduled_at)
    date_str = dt.date().isoformat()
    time_str = dt.strftime("%H:%M")
    coach_id = session["coachId"]

    available = resolve_available_slots(coach_id, date_str, date_str)
    available_times = {s["time"] for s in available}
    if time_str not in available_times:
        return conflict("The requested slot is not available")

    from datetime import timedelta
    ends_at = (dt + timedelta(minutes=45)).isoformat()
    now = utc_now()

    db.update_item(f"SESSION#{session_id}", "#META", {
        "scheduledAt": new_scheduled_at,
        "endsAt": ends_at,
        "GSI1SK": f"SESSION#{new_scheduled_at}",
        "GSI2SK": f"SESSION#{new_scheduled_at}",
        "rescheduledAt": now,
        "previousScheduledAt": session.get("scheduledAt"),
    })

    player = db.get_item(f"PLAYER#{session['playerId']}", "#META")
    _notify({
        "template": "session_rescheduled",
        "recipientEmail": player.get("email"),
        "recipientName": player.get("name"),
        "variables": {
            "oldScheduledAt": session.get("scheduledAt"),
            "newScheduledAt": new_scheduled_at,
        },
    })

    return ok({"message": "Session rescheduled", "newScheduledAt": new_scheduled_at})
