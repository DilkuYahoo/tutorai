import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import require_role, get_user_id, get_user_name
from shared.response import ok, bad_request, not_found, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["playerId", "delta", "note"])
    except ValidationError as e:
        return bad_request(str(e))

    player_id = body["playerId"]
    delta = int(body["delta"])
    note = body["note"].strip()

    if delta == 0:
        return bad_request("'delta' cannot be zero")
    if not note:
        return bad_request("'note' is required for manual adjustments")

    player = db.get_item(f"PLAYER#{player_id}", "#META")
    if not player:
        return not_found("Player not found")

    avail = int(player.get("balanceAvailable", 0))
    new_avail = avail + delta
    if new_avail < 0:
        return bad_request(f"Adjustment would result in negative balance ({new_avail})")

    now = utc_now()
    actor_id = get_user_id(event)
    actor_name = get_user_name(event)

    ledger_entry = {
        "PK": f"CREDITS#{player_id}",
        "SK": f"{now}#{generate_id()}",
        "type": "manual_adjustment",
        "delta": delta,
        "fromState": "available",
        "toState": "available",
        "balanceAvailable": new_avail,
        "balanceCommitted": int(player.get("balanceCommitted", 0)),
        "note": note,
        "adjustedBy": actor_name,
        "adjustedById": actor_id,
        "createdAt": now,
    }

    db.transact_write([
        {"Put": {"Item": ledger_entry}},
        {"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
            "UpdateExpression": "SET balanceAvailable = :a",
            "ExpressionAttributeValues": {":a": new_avail},
        }},
    ])

    return ok({
        "message": f"Credits adjusted by {delta:+d} for player {player_id}",
        "newBalance": new_avail,
    })
