import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import require_role
from shared.response import ok, bad_request, not_found, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach:
        return not_found("Coach not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    allowed = ["name", "bio", "rate", "socialLinks", "photoUrl"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return bad_request("No valid fields to update")

    updates["updatedAt"] = utc_now()

    # Keep GSI1SK in sync if name changes
    if "name" in updates:
        updates["GSI1SK"] = f"active#{updates['name'].lower()}"

    updated = db.update_item(f"COACH#{coach_id}", "#META", updates)
    coach_out = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(coach_out)
