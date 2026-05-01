import json
import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone

import boto3

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, bad_request, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared.validation import LOW_CREDIT_THRESHOLD
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

    if not is_coach_or_super(event):
        return forbidden("Only coaches can complete sessions")

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    caller_id = get_user_id(event)
    if session.get("coachId") != caller_id and not is_coach_or_super(event):
        return forbidden("Not your session")

    if session.get("status") != "booked":
        return bad_request(f"Session cannot be completed (status: {session.get('status')})")

    # Backend enforced: cannot complete before scheduled start
    scheduled_at = datetime.fromisoformat(session["scheduledAt"])
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) < scheduled_at:
        return bad_request("Session cannot be completed before its scheduled start time")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        body = {}

    summary = body.get("summary", "")
    now = utc_now()
    player_id = session["playerId"]
    player = db.get_item(f"PLAYER#{player_id}", "#META")
    avail = int(player.get("balanceAvailable", 0))
    committed = int(player.get("balanceCommitted", 0))

    ledger_entry = {
        "PK": f"CREDITS#{player_id}",
        "SK": f"{now}#{generate_id()}",
        "type": "session_complete",
        "delta": -1,
        "fromState": "committed",
        "toState": "consumed",
        "balanceAvailable": avail,
        "balanceCommitted": committed - 1,
        "sessionId": session_id,
        "coachId": session["coachId"],
        "createdAt": now,
    }

    db.transact_write([
        {"Put": {"Item": ledger_entry}},
        {"Update": {
            "Key": {"PK": f"SESSION#{session_id}", "SK": "#META"},
            "UpdateExpression": "SET #s = :s, summary = :sum, completedAt = :t",
            "ExpressionAttributeNames": {"#s": "status"},
            "ExpressionAttributeValues": {":s": "completed", ":sum": summary, ":t": now},
        }},
        {"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
            "UpdateExpression": "SET balanceCommitted = :c",
            "ExpressionAttributeValues": {":c": committed - 1},
        }},
    ])

    _notify({
        "template": "session_completed",
        "recipientEmail": player.get("email"),
        "recipientName": player.get("name"),
        "variables": {
            "scheduledAt": session.get("scheduledAt"),
            "summary": summary,
            "coachName": "",
        },
    })

    if avail <= LOW_CREDIT_THRESHOLD:
        _notify({
            "template": "credit_low",
            "recipientEmail": player.get("email"),
            "recipientName": player.get("name"),
            "variables": {"creditsRemaining": avail},
        })

    return ok({"message": "Session completed"})
