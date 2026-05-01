import json
import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone

import boto3

from shared.auth import require_role
from shared.response import ok, bad_request, not_found, preflight
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

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    series_id = (event.get("pathParameters") or {}).get("seriesId", "")
    series = db.get_item(f"SERIES#{series_id}", "#META")
    if not series:
        return not_found("Series not found")

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

    coach_id = series["coachId"]
    player_id = series["playerId"]
    now_iso = datetime.now(timezone.utc).isoformat()

    all_sessions = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"COACH#{coach_id}",
        sk_name="GSI1SK",
        sk_prefix=f"SESSION#{now_iso[:10]}",
    )
    future = [s for s in all_sessions if s.get("seriesId") == series_id and s.get("status") == "booked"]

    count = len(future)
    now = utc_now()
    player = db.get_item(f"PLAYER#{player_id}", "#META")
    avail = int(player.get("balanceAvailable", 0))
    committed = int(player.get("balanceCommitted", 0))

    ops = []
    for s in future:
        session_id = s["id"]
        avail += 1
        committed -= 1
        ops.append({"Put": {"Item": {
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
        }}})
        ops.append({"Update": {
            "Key": {"PK": f"SESSION#{session_id}", "SK": "#META"},
            "UpdateExpression": "SET #s = :s",
            "ExpressionAttributeNames": {"#s": "status"},
            "ExpressionAttributeValues": {":s": "cancelled"},
        }})

    ops.append({"Update": {
        "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
        "UpdateExpression": "SET balanceAvailable = :a, balanceCommitted = :c",
        "ExpressionAttributeValues": {":a": avail, ":c": committed},
    }})
    ops.append({"Update": {
        "Key": {"PK": f"SERIES#{series_id}", "SK": "#META"},
        "UpdateExpression": "SET #s = :s, reassignedToCoachId = :nc",
        "ExpressionAttributeNames": {"#s": "status"},
        "ExpressionAttributeValues": {":s": "reassigned", ":nc": new_coach_id},
    }})

    chunk_size = 99
    for i in range(0, len(ops), chunk_size):
        db.transact_write(ops[i:i + chunk_size])

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
                    "cancelledCount": count,
                    "creditsReturned": count,
                },
            }).encode(),
        )
    except Exception:
        pass

    return ok({
        "message": f"Series reassigned. {count} future sessions cancelled; {count} credits returned. Player should rebook with {new_coach.get('name')}.",
        "cancelledCount": count,
        "newCoachId": new_coach_id,
    })
