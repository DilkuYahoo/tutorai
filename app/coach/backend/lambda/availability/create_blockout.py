import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import created, bad_request, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can manage availability")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["startDate", "endDate"])
    except ValidationError as e:
        return bad_request(str(e))

    start = body["startDate"]
    end = body["endDate"]
    if start > end:
        return bad_request("startDate must be before endDate")

    coach_id = get_user_id(event)

    # Check for sessions booked during block-out period
    sessions = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"COACH#{coach_id}",
        sk_name="GSI1SK",
        sk_between=(f"SESSION#{start}", f"SESSION#{end}~"),
    )
    conflicting = [s for s in sessions if s.get("status") == "booked"]

    blockout_id = generate_id()
    now = utc_now()
    item = {
        "PK": f"COACH#{coach_id}",
        "SK": f"BLOCKOUT#{start}#{blockout_id}",
        "id": blockout_id,
        "coachId": coach_id,
        "startDate": start,
        "endDate": end,
        "reason": body.get("reason", ""),
        "createdAt": now,
    }
    db.put_item(item)

    out = {k: v for k, v in item.items() if not k.startswith(("PK", "SK"))}
    out["conflictingSessions"] = len(conflicting)
    if conflicting:
        out["conflicts"] = [
            {
                "sessionId": s.get("id"),
                "scheduledAt": s.get("scheduledAt"),
                "playerId": s.get("playerId"),
            }
            for s in conflicting
        ]

    return created(out)
