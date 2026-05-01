import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, bad_request, forbidden, not_found, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can update their profile")

    coach_id = get_user_id(event)
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach:
        return not_found("Coach profile not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    allowed = ["bio", "socialLinks", "photoUrl"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return bad_request("No valid fields to update")

    updates["updatedAt"] = utc_now()
    updated = db.update_item(f"COACH#{coach_id}", "#META", updates)
    out = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(out)
