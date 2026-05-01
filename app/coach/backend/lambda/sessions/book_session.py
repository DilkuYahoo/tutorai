"""
Handles both ad-hoc and recurring series bookings.

Body:
  coachId, playerId, scheduledAt (ISO), sessionType ("adhoc"|"recurring"),
  venue (str)

  For recurring:
    recurringDay (monday–sunday), recurringSessions (int, defaults to balanceAvailable)

Returns for ad-hoc:   {session}
Returns for recurring: {confirmed: [...], conflicts: [...], conflictCount, confirmedCount}
"""
import json
import os
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timedelta, timezone

import boto3

from shared.auth import get_user_id, get_role
from shared.response import created, bad_request, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError
from shared.slots import check_conflicts
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


def _resolve_player_id(event, body) -> tuple[str, str | None]:
    """Return (playerId, parentId|None) based on caller role and body."""
    role = get_role(event)
    caller_id = get_user_id(event)
    if role == "parent":
        player_id = body.get("playerId")
        if not player_id:
            return None, None
        return player_id, caller_id
    if role in ("coach", "super_coach"):
        return body.get("playerId", ""), None
    # player books for themselves
    return caller_id, None


def _build_session_item(session_id, coach_id, player_id, parent_id, scheduled_at,
                         venue, session_type, series_id=None):
    return {
        "PK": f"SESSION#{session_id}",
        "SK": "#META",
        "GSI1PK": f"COACH#{coach_id}",
        "GSI1SK": f"SESSION#{scheduled_at}",
        "GSI2PK": f"PLAYER#{player_id}",
        "GSI2SK": f"SESSION#{scheduled_at}",
        "GSI3PK": "SESSIONS",
        "GSI3SK": f"booked#{scheduled_at}#{session_id}",
        "id": session_id,
        "coachId": coach_id,
        "playerId": player_id,
        "parentId": parent_id,
        "scheduledAt": scheduled_at,
        "endsAt": _ends_at(scheduled_at),
        "venue": venue,
        "status": "booked",
        "sessionType": session_type,
        "seriesId": series_id,
        "summary": None,
        "videoReviewFlag": False,
        "createdAt": utc_now(),
    }


def _ends_at(scheduled_at: str) -> str:
    dt = datetime.fromisoformat(scheduled_at)
    return (dt + timedelta(minutes=45)).isoformat()


def _deduct_credit(player_id: str, session_id: str, now: str):
    """Write a booking_reserve ledger entry and decrement balanceAvailable + increment balanceCommitted."""
    player = db.get_item(f"PLAYER#{player_id}", "#META")
    avail = int(player.get("balanceAvailable", 0))
    committed = int(player.get("balanceCommitted", 0))
    return {
        "PK": f"CREDITS#{player_id}",
        "SK": f"{now}#{generate_id()}",
        "type": "booking_reserve",
        "delta": -1,
        "fromState": "available",
        "toState": "committed",
        "balanceAvailable": avail - 1,
        "balanceCommitted": committed + 1,
        "sessionId": session_id,
        "createdAt": now,
    }, avail, committed


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    role = get_role(event)
    if role not in ("player", "parent", "coach", "super_coach"):
        return forbidden("Not authorised to book sessions")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["coachId", "venue"])
    except ValidationError as e:
        return bad_request(str(e))

    coach_id = body["coachId"]
    venue = body["venue"]
    session_type = body.get("sessionType", "adhoc")

    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach or coach.get("status") != "active":
        return not_found("Coach not found")

    player_id, parent_id = _resolve_player_id(event, body)
    if not player_id:
        return bad_request("playerId is required")

    player = db.get_item(f"PLAYER#{player_id}", "#META")
    if not player:
        return not_found("Player not found")

    balance_avail = int(player.get("balanceAvailable", 0))

    # ── AD-HOC BOOKING ────────────────────────────────────────────────────
    if session_type == "adhoc":
        try:
            require_fields(body, ["scheduledAt"])
        except ValidationError as e:
            return bad_request(str(e))

        if balance_avail < 1:
            return bad_request("Insufficient credits. Purchase a session or package to book.")

        scheduled_at = body["scheduledAt"]
        session_id = generate_id()
        now = utc_now()
        ledger_item, avail, committed = _deduct_credit(player_id, session_id, now)

        session_item = _build_session_item(
            session_id, coach_id, player_id, parent_id, scheduled_at, venue, "adhoc"
        )

        db.transact_write([
            {"Put": {"Item": session_item}},
            {"Put": {"Item": ledger_item}},
            {"Update": {
                "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
                "UpdateExpression": "SET balanceAvailable = :a, balanceCommitted = :c",
                "ExpressionAttributeValues": {":a": avail - 1, ":c": committed + 1},
            }},
        ])

        _notify({
            "template": "session_booked",
            "recipientEmail": player.get("email"),
            "recipientName": player.get("name"),
            "variables": {
                "coachName": coach.get("name"),
                "scheduledAt": scheduled_at,
                "venue": venue,
            },
        })

        out = {k: v for k, v in session_item.items() if not k.startswith(("PK", "SK", "GSI"))}
        return created(out)

    # ── RECURRING SERIES BOOKING ───────────────────────────────────────────
    if session_type == "recurring":
        try:
            require_fields(body, ["recurringSessions", "recurringSlotsTime", "recurringDay"])
        except ValidationError as e:
            return bad_request(str(e))

        count = int(body["recurringSessions"])
        if balance_avail < count:
            return bad_request(
                f"Insufficient credits. Requested {count} sessions but only {balance_avail} available."
            )

        slot_time = body["recurringSlotsTime"]  # HH:MM
        day_name = body["recurringDay"].lower()

        # Generate target dates
        day_num = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
                   "friday": 4, "saturday": 5, "sunday": 6}[day_name]
        today = datetime.now(timezone.utc).date()
        # Find first occurrence on or after tomorrow
        days_ahead = (day_num - today.weekday()) % 7 or 7
        first = today + timedelta(days=days_ahead)
        proposed_dates = [(first + timedelta(weeks=i)).isoformat() for i in range(count)]

        conflicts = check_conflicts(coach_id, proposed_dates, slot_time)
        confirmed_dates = [d for d in proposed_dates if d not in conflicts]

        series_id = generate_id()
        now = utc_now()

        # Write series meta
        series_item = {
            "PK": f"SERIES#{series_id}",
            "SK": "#META",
            "GSI1PK": f"COACH#{coach_id}",
            "GSI1SK": f"SERIES#{day_name}#{slot_time}",
            "GSI2PK": f"PLAYER#{player_id}",
            "GSI2SK": f"SERIES#{series_id}",
            "id": series_id,
            "coachId": coach_id,
            "playerId": player_id,
            "parentId": parent_id,
            "dayOfWeek": day_name,
            "slotTime": slot_time,
            "venue": venue,
            "status": "active",
            "createdAt": now,
        }
        db.put_item(series_item)

        # Write confirmed sessions + ledger entries in batches (transact_write max 100 items)
        ops = []
        sessions_out = []
        new_avail = balance_avail
        new_committed = int(player.get("balanceCommitted", 0))

        for d in confirmed_dates:
            scheduled_at = f"{d}T{slot_time}:00+10:00"
            session_id = generate_id()
            session_item = _build_session_item(
                session_id, coach_id, player_id, parent_id, scheduled_at, venue, "recurring", series_id
            )
            ledger_item, _, _ = _deduct_credit(player_id, session_id, now)
            ledger_item["balanceAvailable"] = new_avail - 1
            ledger_item["balanceCommitted"] = new_committed + 1
            new_avail -= 1
            new_committed += 1
            ops.append({"Put": {"Item": session_item}})
            ops.append({"Put": {"Item": ledger_item}})
            sessions_out.append({k: v for k, v in session_item.items()
                                  if not k.startswith(("PK", "SK", "GSI"))})

        # Update player balance
        ops.append({"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
            "UpdateExpression": "SET balanceAvailable = :a, balanceCommitted = :c",
            "ExpressionAttributeValues": {":a": new_avail, ":c": new_committed},
        }})

        # transact_write supports max 100 items; split if needed
        chunk_size = 99
        for i in range(0, len(ops), chunk_size):
            db.transact_write(ops[i:i + chunk_size])

        _notify({
            "template": "session_booked",
            "recipientEmail": player.get("email"),
            "recipientName": player.get("name"),
            "variables": {
                "coachName": coach.get("name"),
                "sessionCount": len(confirmed_dates),
                "venue": venue,
            },
        })

        return created({
            "seriesId": series_id,
            "confirmedCount": len(confirmed_dates),
            "conflictCount": len(conflicts),
            "confirmed": sessions_out,
            "conflicts": conflicts,
        })

    return bad_request("sessionType must be 'adhoc' or 'recurring'")
