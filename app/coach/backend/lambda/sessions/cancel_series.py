import json
import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone

import boto3

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, bad_request, not_found, forbidden, preflight
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
        return forbidden("Only coaches can cancel series")

    series_id = (event.get("pathParameters") or {}).get("seriesId", "")
    series = db.get_item(f"SERIES#{series_id}", "#META")
    if not series:
        return not_found("Series not found")

    caller_id = get_user_id(event)
    if series.get("coachId") != caller_id and not is_coach_or_super(event):
        return forbidden("Not your series")

    # Find all booked future sessions in this series
    coach_id = series["coachId"]
    player_id = series["playerId"]
    now_iso = datetime.now(timezone.utc).isoformat()

    all_coach_sessions = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"COACH#{coach_id}",
        sk_name="GSI1SK",
        sk_prefix=f"SESSION#{now_iso[:10]}",
    )
    future_series_sessions = [
        s for s in all_coach_sessions
        if s.get("seriesId") == series_id and s.get("status") == "booked"
    ]

    if not future_series_sessions:
        return ok({"message": "No future sessions to cancel", "cancelledCount": 0})

    count = len(future_series_sessions)
    now = utc_now()
    player = db.get_item(f"PLAYER#{player_id}", "#META")
    avail = int(player.get("balanceAvailable", 0))
    committed = int(player.get("balanceCommitted", 0))

    ops = []
    for s in future_series_sessions:
        session_id = s["id"]
        avail += 1
        committed -= 1
        ledger_entry = {
            "PK": f"CREDITS#{player_id}",
            "SK": f"{now}#{generate_id()}",
            "type": "cancellation_return",
            "delta": 1,
            "fromState": "committed",
            "toState": "available",
            "balanceAvailable": avail,
            "balanceCommitted": committed,
            "sessionId": session_id,
            "createdAt": now,
        }
        ops.append({"Put": {"Item": ledger_entry}})
        ops.append({"Update": {
            "Key": {"PK": f"SESSION#{session_id}", "SK": "#META"},
            "UpdateExpression": "SET #s = :s, cancelledAt = :t",
            "ExpressionAttributeNames": {"#s": "status"},
            "ExpressionAttributeValues": {":s": "cancelled", ":t": now},
        }})

    ops.append({"Update": {
        "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
        "UpdateExpression": "SET balanceAvailable = :a, balanceCommitted = :c",
        "ExpressionAttributeValues": {":a": avail, ":c": committed},
    }})
    ops.append({"Update": {
        "Key": {"PK": f"SERIES#{series_id}", "SK": "#META"},
        "UpdateExpression": "SET #s = :s",
        "ExpressionAttributeNames": {"#s": "status"},
        "ExpressionAttributeValues": {":s": "cancelled"},
    }})

    chunk_size = 99
    for i in range(0, len(ops), chunk_size):
        db.transact_write(ops[i:i + chunk_size])

    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=__import__("json").dumps({
                "template": "session_cancelled",
                "recipientEmail": player.get("email"),
                "recipientName": player.get("name"),
                "variables": {"cancelledCount": count, "creditsReturned": count},
            }).encode(),
        )
    except Exception:
        pass

    return ok({"message": f"Series cancelled. {count} future sessions cancelled and credits returned.", "cancelledCount": count})
