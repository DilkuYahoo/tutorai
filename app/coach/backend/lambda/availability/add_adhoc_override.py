import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import created, bad_request, forbidden, preflight
from shared.ids import utc_now
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
        require_fields(body, ["date", "slotTime", "type"])
    except ValidationError as e:
        return bad_request(str(e))

    override_type = body["type"]
    if override_type not in ("add", "remove"):
        return bad_request("'type' must be 'add' or 'remove'")

    coach_id = get_user_id(event)
    date_str = body["date"]
    slot_time = body["slotTime"]
    now = utc_now()

    item = {
        "PK": f"COACH#{coach_id}",
        "SK": f"AVAIL#OVERRIDE#{date_str}#{slot_time}",
        "coachId": coach_id,
        "date": date_str,
        "slotTime": slot_time,
        "type": override_type,
        "createdAt": now,
    }
    db.put_item(item)

    out = {k: v for k, v in item.items() if not k.startswith(("PK", "SK"))}
    return created(out)
