import json
import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone, timedelta

import boto3

from shared.auth import get_user_id, get_role
from shared.response import ok, bad_request, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared.validation import CANCELLATION_WINDOW_HOURS, LOW_CREDIT_THRESHOLD
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
        return bad_request(f"Session cannot be cancelled (status: {session.get('status')})")

    role = get_role(event)
    user_id = get_user_id(event)

    # Scope check
    if role == "coach" and session.get("coachId") != user_id:
        return forbidden("Not your session")
    if role == "player" and session.get("playerId") != user_id:
        return forbidden("Not your session")
    if role == "parent":
        children = db.query_pk(f"PARENT#{user_id}", sk_prefix="CHILD#")
        child_ids = {c.get("playerId") for c in children}
        if session.get("playerId") not in child_ids:
            return forbidden("Not your child's session")

    # Determine late cancel
    scheduled_at = datetime.fromisoformat(session["scheduledAt"])
    now_utc = datetime.now(timezone.utc)
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    hours_until = (scheduled_at - now_utc).total_seconds() / 3600
    late_cancel = hours_until < CANCELLATION_WINDOW_HOURS

    # During coach deregistration: always return credit (passed via body flag)
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        body = {}
    force_return = body.get("forceReturnCredit", False) and role == "super_coach"

    player_id = session["playerId"]
    player = db.get_item(f"PLAYER#{player_id}", "#META")
    avail = int(player.get("balanceAvailable", 0))
    committed = int(player.get("balanceCommitted", 0))
    now = utc_now()

    if late_cancel and not force_return:
        # Late cancel — credit forfeited
        ledger_entry = {
            "PK": f"CREDITS#{player_id}",
            "SK": f"{now}#{generate_id()}",
            "type": "late_cancel_forfeit",
            "delta": -1,
            "fromState": "committed",
            "toState": "consumed",
            "balanceAvailable": avail,
            "balanceCommitted": committed - 1,
            "sessionId": session_id,
            "createdAt": now,
        }
        new_avail, new_committed = avail, committed - 1
        credit_message = "Credit forfeited (late cancellation < 24 hours)"
    else:
        # Return credit to available
        ledger_entry = {
            "PK": f"CREDITS#{player_id}",
            "SK": f"{now}#{generate_id()}",
            "type": "cancellation_return",
            "delta": 1,
            "fromState": "committed",
            "toState": "available",
            "balanceAvailable": avail + 1,
            "balanceCommitted": committed - 1,
            "sessionId": session_id,
            "createdAt": now,
        }
        new_avail, new_committed = avail + 1, committed - 1
        credit_message = "Credit returned to available balance"

    db.transact_write([
        {"Put": {"Item": ledger_entry}},
        {"Update": {
            "Key": {"PK": f"SESSION#{session_id}", "SK": "#META"},
            "UpdateExpression": "SET #s = :s, cancelledAt = :t",
            "ExpressionAttributeNames": {"#s": "status"},
            "ExpressionAttributeValues": {":s": "cancelled", ":t": now},
        }},
        {"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
            "UpdateExpression": "SET balanceAvailable = :a, balanceCommitted = :c",
            "ExpressionAttributeValues": {":a": new_avail, ":c": new_committed},
        }},
    ])

    _notify({
        "template": "session_cancelled",
        "recipientEmail": player.get("email"),
        "recipientName": player.get("name"),
        "variables": {
            "scheduledAt": session.get("scheduledAt"),
            "lateCancellation": late_cancel and not force_return,
        },
    })

    if late_cancel and not force_return:
        coach = db.get_item(f"COACH#{session['coachId']}", "#META")
        super_coaches = db.query_gsi(index="GSI1", pk_name="GSI1PK", pk_value="COACHES",
                                     sk_name="GSI1SK", sk_prefix="active#")
        for sc in super_coaches:
            if sc.get("role") == "super_coach":
                _notify({
                    "template": "late_cancellation",
                    "recipientEmail": sc.get("email"),
                    "recipientName": sc.get("name"),
                    "variables": {
                        "playerName": player.get("name"),
                        "coachName": coach.get("name") if coach else "",
                        "scheduledAt": session.get("scheduledAt"),
                    },
                })
                break

    if new_avail <= LOW_CREDIT_THRESHOLD:
        _notify({
            "template": "credit_low",
            "recipientEmail": player.get("email"),
            "recipientName": player.get("name"),
            "variables": {"creditsRemaining": new_avail},
        })

    return ok({"message": "Session cancelled", "creditMessage": credit_message})
